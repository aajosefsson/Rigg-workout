import { useState } from "react";
import { TodayAdmin } from "./TodayAdmin";
import { MembersAdmin } from "./MembersAdmin";
import { PlannerAdmin } from "./PlannerAdmin";
import { HistoryAdmin } from "./HistoryAdmin";
import { ExerciseLibraryAdmin } from "./ExerciseLibraryAdmin";
import { useExerciseLibrary } from "../../hooks/useExerciseLibrary";
import { todayStr, formatDate, addDays } from "../../lib/dates";
import { BackupButton } from "../../components/BackupButton";

// ─── ADMIN VIEW ────────────────────────────────────────────────────────────────
export function AdminView({
  periods,
  activePeriod,
  activePeriodId,
  setActivePeriodId,
  updatePeriod,
  addPeriod,
  deletePeriod,
  addWorkout,
  updateWorkout,
  deleteWorkout,
  setSessionMembersForWod,
  getSessionMembers,
  memberRoster,
  editMemberRoster,
  orgId,
  profile,
  authUser,
}) {
  const library = useExerciseLibrary();
  const allWorkouts = periods.flatMap((p) => p.workouts || []);
  const [tab, setTab] = useState("today");
  const [confirmDel, setConfirmDel] = useState(false);
  const [periodExpanded, setPeriodExpanded] = useState(false);

  return (
    <div className="page" style={{ position: "relative", zIndex: 1 }}>
      <div className="flex-between mb-4">
        <div>
          <h1 style={{ fontSize: "2rem", color: "#FF6B1A" }}>CLASSES</h1>
          <p className="muted small">
            Group sessions, planning and participants
          </p>
        </div>
        <BackupButton orgId={orgId} />
      </div>

      {/* Period bar */}
      <div className="card mb-4" style={{ padding: "16px 20px" }}>
        <div className="flex-between mb-3">
          <h3 style={{ fontSize: "1rem", color: "#FF6B1A" }}>
            Training Periods
          </h3>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPeriodExpanded((p) => !p)}
            >
              {periodExpanded ? "Hide Details" : "Edit Details"}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                addPeriod();
                setPeriodExpanded(true);
              }}
            >
              + New Period
            </button>
          </div>
        </div>
        <div className="period-list">
          {periods.map((p) => (
            <button
              key={p.id}
              className={`period-pill ${activePeriodId === p.id ? "active" : ""}`}
              onClick={() => {
                setActivePeriodId(p.id);
                setConfirmDel(false);
              }}
            >
              {p.name || "Unnamed Period"}
            </button>
          ))}
        </div>
        {activePeriod && !periodExpanded && (
          <p className="muted small mt-2">
            {activePeriod.focus ? `${activePeriod.focus} · ` : ""}
            {activePeriod.startDate && activePeriod.durationWeeks
              ? `${formatDate(activePeriod.startDate)} – ${formatDate(addDays(activePeriod.startDate, activePeriod.durationWeeks * 7 - 1))}`
              : "No dates set"}
          </p>
        )}
        {activePeriod && periodExpanded && (
          <>
            <div className="grid-2 mt-3">
              <div>
                <label>Period Name</label>
                <input
                  value={activePeriod.name}
                  onChange={(e) =>
                    updatePeriod(activePeriod.id, { name: e.target.value })
                  }
                  placeholder="e.g. Spring Strength Block"
                />
              </div>
              <div>
                <label>Focus / Theme</label>
                <input
                  value={activePeriod.focus}
                  onChange={(e) =>
                    updatePeriod(activePeriod.id, { focus: e.target.value })
                  }
                  placeholder="e.g. Back Squat & Gymnastics"
                />
              </div>
              <div>
                <label>Start Date</label>
                <input
                  type="date"
                  value={activePeriod.startDate || todayStr()}
                  onChange={(e) =>
                    updatePeriod(activePeriod.id, { startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Duration (weeks)</label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={activePeriod.durationWeeks || 8}
                  onChange={(e) =>
                    updatePeriod(activePeriod.id, {
                      durationWeeks: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="flex-between mt-3">
              <p className="muted small">
                {activePeriod.startDate && activePeriod.durationWeeks
                  ? `Ends: ${formatDate(addDays(activePeriod.startDate, activePeriod.durationWeeks * 7 - 1))}`
                  : ""}
              </p>
              <div className="flex gap-2">
                {confirmDel && (
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "#ff7070",
                      alignSelf: "center",
                    }}
                  >
                    Delete this period?
                  </span>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirmDel) {
                      deletePeriod(activePeriodId);
                      setConfirmDel(false);
                    } else setConfirmDel(true);
                  }}
                >
                  {confirmDel ? "Confirm Delete" : "Delete Period"}
                </button>
                {confirmDel && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmDel(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {[
          ["today", "Today's Session"],
          ["planner", "Week Planner"],
          ["members", "Members"],
          ["history", "History"],
          ["library", "Exercises"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={`admin-tab ${tab === k ? "active" : ""}`}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "today" && activePeriod && (
        <TodayAdmin
          period={activePeriod}
          updateWorkout={updateWorkout}
          addWorkout={addWorkout}
          deleteWorkout={deleteWorkout}
          getSessionMembers={getSessionMembers}
          setSessionMembersForWod={setSessionMembersForWod}
          memberRoster={memberRoster}
        />
      )}
      {tab === "planner" && activePeriod && (
        <PlannerAdmin
          period={activePeriod}
          updateWorkout={updateWorkout}
          addWorkout={addWorkout}
          deleteWorkout={deleteWorkout}
          memberRoster={memberRoster}
          getSessionMembers={getSessionMembers}
          setSessionMembersForWod={setSessionMembersForWod}
          profile={profile}
          authUser={authUser}
        />
      )}
      {tab === "members" && (
        <MembersAdmin
          memberRoster={memberRoster}
          editMemberRoster={editMemberRoster}
          allWorkouts={allWorkouts}
        />
      )}
      {tab === "library" && <ExerciseLibraryAdmin library={library} />}
      {tab === "history" && (
        <HistoryAdmin periods={periods} getSessionMembers={getSessionMembers} />
      )}
    </div>
  );
}
