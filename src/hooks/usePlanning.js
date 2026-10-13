import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { EMPTY_PERIOD, DEFAULT_MEMBERS, DEMO_PERIOD } from "../lib/constants";

// Returns the stored value, or undefined when the document doesn't exist.
// A failed read THROWS, so it can never be mistaken for "no data yet".
const load = async (key) => {
  const snap = await getDoc(doc(db, "riggworkout", key));
  return snap.exists() ? snap.data().value : undefined;
};
// Rejects when the write fails; the caller decides how to show it
const save = (key, val) => setDoc(doc(db, "riggworkout", key), { value: val });

// The class planning (periods and sessions, participants per session, member roster)
export function usePlanning(isAdminUser) {
  const [periods, setPeriods] = useState([]);
  const [activePeriodId, setActivePeriodId] = useState(DEMO_PERIOD.id);
  const [sessionMembers, setSessionMembers] = useState({});
  const [memberRoster, setMemberRoster] = useState([]);
  const [planningStatus, setPlanningStatus] = useState("loading"); // loading | ready | error
  const loaded = planningStatus === "ready";
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Dev-only test hook: ?simulateLoadFailure=1 makes the planning read fail (stripped from production builds)
        if (
          import.meta.env.DEV &&
          new URLSearchParams(window.location.search).get(
            "simulateLoadFailure",
          ) === "1"
        )
          throw new Error("Simulated planning load failure (dev only)");
        const [p, sm, mr] = await Promise.all([
          load("cf_periods"),
          load("cf_session_members"),
          load("cf_member_roster"),
        ]);
        // Demo data only when the document really doesn't exist yet (first run)
        setPeriods(p ?? [DEMO_PERIOD]);
        setSessionMembers(sm ?? {});
        setMemberRoster(mr ?? DEFAULT_MEMBERS);
        setPlanningStatus("ready");
      } catch (err) {
        console.error("Could not load the planning:", err);
        setPlanningStatus("error");
      }
    })();
  }, []);

  // Planning is saved ONLY after an admin has changed it: the edit actions below mark their
  // document as dirty, and this effect writes the dirty ones. Loading data, signing in or a
  // role change never marks anything dirty, so they never trigger a write.
  // Never call setPeriods/setSessionMembers/setMemberRoster directly for admin edits; use the edit* helpers.
  const dirty = useRef({
    cf_periods: false,
    cf_session_members: false,
    cf_member_roster: false,
  });
  const markDirty = (key) => {
    dirty.current[key] = true;
  };
  const canSave = loaded && isAdminUser && !saveFailed;
  useEffect(() => {
    const current = {
      cf_periods: periods,
      cf_session_members: sessionMembers,
      cf_member_roster: memberRoster,
    };
    Object.entries(current).forEach(([key, value]) => {
      if (!dirty.current[key]) return;
      dirty.current[key] = false;
      if (!canSave) return;
      // No silent retry: after a failed write all saving stops and the admin is told to reload
      save(key, value).catch((err) => {
        console.error(`Could not save ${key}:`, err);
        setSaveFailed(true);
      });
    });
  }, [periods, sessionMembers, memberRoster, canSave]);

  const activePeriod =
    periods.find((p) => p.id === activePeriodId) || periods[0];
  const allWorkouts = periods.flatMap((p) => p.workouts);

  // Every admin edit goes through these; each marks the document it changes as dirty
  const editPeriods = (fn) => {
    markDirty("cf_periods");
    setPeriods(fn);
  };
  const editMemberRoster = (roster) => {
    markDirty("cf_member_roster");
    setMemberRoster(roster);
  };
  const setSessionMembersForWod = (wodId, mems) => {
    markDirty("cf_session_members");
    setSessionMembers((prev) => ({ ...prev, [wodId]: mems }));
  };
  const getSessionMembers = (wodId) => sessionMembers[wodId] || [];
  // Removes the participant lists of deleted sessions (the one place this is done)
  const dropSessionMembers = (wodIds) => {
    if (!wodIds.some((id) => id in sessionMembers)) return;
    markDirty("cf_session_members");
    setSessionMembers((prev) => {
      const next = { ...prev };
      wodIds.forEach((id) => delete next[id]);
      return next;
    });
  };

  const updatePeriod = (id, updates) =>
    editPeriods((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  const addPeriod = () => {
    const np = EMPTY_PERIOD();
    editPeriods((prev) => [...prev, np]);
    setActivePeriodId(np.id);
  };
  const dropClassResults = (wodId) => {
    deleteDoc(doc(db, "classResults", String(wodId))).catch(() => {});
  };
  const deletePeriod = (id) => {
    const wodIds = (periods.find((p) => p.id === id)?.workouts || []).map(
      (w) => w.id,
    );
    wodIds.forEach(dropClassResults);
    dropSessionMembers(wodIds);
    editPeriods((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next.length ? next : [EMPTY_PERIOD()];
    });
    const rem = periods.filter((p) => p.id !== id);
    setActivePeriodId(rem.length ? rem[0].id : null);
  };
  const addWorkout = (periodId, wod) =>
    editPeriods((prev) =>
      prev.map((p) =>
        p.id === periodId ? { ...p, workouts: [...p.workouts, wod] } : p,
      ),
    );
  const updateWorkout = (periodId, wod) =>
    editPeriods((prev) =>
      prev.map((p) =>
        p.id === periodId
          ? {
              ...p,
              workouts: p.workouts.map((w) => (w.id === wod.id ? wod : w)),
            }
          : p,
      ),
    );
  const deleteWorkout = (periodId, wodId) => {
    dropClassResults(wodId);
    dropSessionMembers([wodId]);
    editPeriods((prev) =>
      prev.map((p) =>
        p.id === periodId
          ? { ...p, workouts: p.workouts.filter((w) => w.id !== wodId) }
          : p,
      ),
    );
  };

  // The raw setters (setPeriods, setSessionMembers, setMemberRoster) are deliberately NOT
  // returned: every change from outside goes through the edit* helpers, which mark it dirty.
  return {
    periods,
    activePeriodId,
    setActivePeriodId,
    memberRoster,
    planningStatus,
    loaded,
    saveFailed,
    activePeriod,
    allWorkouts,
    editPeriods,
    editMemberRoster,
    setSessionMembersForWod,
    getSessionMembers,
    updatePeriod,
    addPeriod,
    deletePeriod,
    addWorkout,
    updateWorkout,
    deleteWorkout,
  };
}
