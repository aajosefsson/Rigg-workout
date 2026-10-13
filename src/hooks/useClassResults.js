import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// ─── Class results: one document per session ──────────────────────────────────
// classResults/{sessionId} = { results: { "<block>|<member>": { "<variable>": "value" } },
//                              saved:   { "<block>|<member>": true }, updatedAt }
// Every write only touches ONE member's entry (merge), so two people logging at the same
// time can never overwrite each other, and everyone watching sees changes live.
export function useClassResults(wodId) {
  // The latest answer from the database, tagged with the session it belongs to. Until the
  // answer for the CURRENT session has arrived, the hook reports empty data and ready = false.
  const [snapState, setSnapState] = useState({
    id: null,
    results: {},
    saved: {},
    error: "", // e.g. "permission-denied" when results can't be read
  });

  useEffect(() => {
    if (wodId === undefined || wodId === null) return;
    const id = String(wodId);
    const unsub = onSnapshot(
      doc(db, "classResults", id),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        setSnapState({
          id,
          results: d.results || {},
          saved: d.saved || {},
          error: "",
        });
      },
      (err) => {
        console.error("Could not read class results:", err);
        setSnapState((prev) => ({
          ...(prev.id === id ? prev : { results: {}, saved: {} }),
          id,
          error: err?.code || "error",
        }));
      },
    );
    return unsub;
  }, [wodId]);

  const isCurrent =
    wodId !== undefined && wodId !== null && snapState.id === String(wodId);
  const data = isCurrent ? snapState : { results: {}, saved: {} };
  const ready = isCurrent; // true once the first answer for this session has arrived
  const error = isCurrent ? snapState.error : "";

  const ref = () => doc(db, "classResults", String(wodId));
  const entry = (block, member) => `${block}|${member}`;
  return {
    ready,
    error,
    get: (block, member, variable) =>
      data.results[entry(block, member)]?.[variable] || "",
    isSaved: (block, member) => !!data.saved[entry(block, member)],
    getAll: (block, member) => data.results[entry(block, member)] || {},
    // everyone who has logged anything for this session, whether or not they are on the participant list
    entryMembers: () => {
      const names = new Set();
      [...Object.keys(data.results), ...Object.keys(data.saved)].forEach(
        (k) => {
          const i = k.indexOf("|");
          if (i > 0) names.add(k.slice(i + 1));
        },
      );
      return [...names].sort((a, b) => a.localeCompare(b, "sv"));
    },
    anyForBlock: (block) =>
      Object.keys(data.results).some((k) => k.startsWith(`${block}|`)),
    // one field (used by the admin results table)
    setField: (block, member, variable, value) =>
      setDoc(
        ref(),
        {
          results: { [entry(block, member)]: { [variable]: value } },
          saved: {},
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    // a whole block for one member + mark it as done (used on Home)
    saveBlock: (block, member, vals) => {
      const payload = {
        results: Object.keys(vals).length
          ? { [entry(block, member)]: vals }
          : {},
        saved: { [entry(block, member)]: true },
        updatedAt: serverTimestamp(),
      };
      return setDoc(ref(), payload, { merge: true });
    },
  };
}
