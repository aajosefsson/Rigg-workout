import { useState } from "react";
import { WodEditor } from "./WodEditor";
import { nextSessionNumber, EMPTY_WOD } from "../../lib/constants";
import { todayStr, formatDate } from "../../lib/dates";

// ─── TODAY ADMIN ───────────────────────────────────────────────────────────────
export function TodayAdmin({
  period,
  updateWorkout,
  addWorkout,
  deleteWorkout,
  getSessionMembers,
  setSessionMembersForWod,
  memberRoster,
}) {
  const today = todayStr();
  const todayWods = period.workouts
    .filter((w) => w.date === today)
    .sort(
      (a, b) => (a.sessionNumber || 0) - (b.sessionNumber || 0) || a.id - b.id,
    );
  const [editing, setEditing] = useState(null);
  // A new WoD is a draft (with its own participant list) until Save; Cancel/Delete just drop it
  const [draft, setDraft] = useState(null);
  const [draftMembers, setDraftMembers] = useState([]);
  const canAddMore = todayWods.length + (draft ? 1 : 0) < 2;

  const startNew = () => {
    if (!canAddMore) return;
    const wod = {
      ...EMPTY_WOD(),
      sessionNumber: nextSessionNumber(period.workouts),
      date: today,
    };
    setDraft(wod);
    setDraftMembers([]);
  };
  const discardDraft = () => {
    setDraft(null);
    setDraftMembers([]);
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <div className="session-tag">📅 {formatDate(today)}</div>
          {period.focus && (
            <p className="muted small mt-1">Focus: {period.focus}</p>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={startNew}
          disabled={!canAddMore}
          style={!canAddMore ? { opacity: 0.45, cursor: "not-allowed" } : {}}
        >
          + New WoD
        </button>
      </div>
      {!canAddMore && (
        <p className="muted small mb-3">A day can have at most 2 sessions.</p>
      )}
      {todayWods.length === 0 && !draft && (
        <div className="card text-center" style={{ padding: "40px" }}>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>💪</div>
          <p className="muted">No workout scheduled for today. Create one!</p>
        </div>
      )}
      {todayWods.map((wod) => (
        <WodEditor
          key={wod.id}
          wod={wod}
          periodId={period.id}
          isEditing={editing === wod.id}
          onEdit={() => setEditing(editing === wod.id ? null : wod.id)}
          onSave={(w) => {
            updateWorkout(period.id, w);
            setEditing(null);
          }}
          onDelete={() => {
            deleteWorkout(period.id, wod.id);
            if (editing === wod.id) setEditing(null);
          }}
          getSessionMembers={getSessionMembers}
          setSessionMembersForWod={setSessionMembersForWod}
          memberRoster={memberRoster}
        />
      ))}
      {draft && (
        <WodEditor
          key={draft.id}
          wod={draft}
          periodId={period.id}
          isEditing
          onEdit={discardDraft}
          onSave={(w) => {
            addWorkout(period.id, w);
            if (draftMembers.length) setSessionMembersForWod(w.id, draftMembers);
            discardDraft();
          }}
          onDelete={discardDraft}
          getSessionMembers={() => draftMembers}
          setSessionMembersForWod={(_, mems) => setDraftMembers(mems)}
          memberRoster={memberRoster}
        />
      )}
    </div>
  );
}
