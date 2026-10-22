import { useState } from "react";
import {
  BLOCK_COLORS,
  BLOCK_TEMPLATES,
  nextSessionNumber,
  EMPTY_WOD,
  templatePatch,
} from "../../lib/constants";
import {
  DAYS,
  MONTHS,
  todayStr,
  formatDate,
  getMondayOfWeek,
  addDays,
  getWeekDates,
} from "../../lib/dates";
import { cleanBlock } from "../../lib/resultFields";
import { ResultFieldsEditor } from "../../components/ResultFieldsEditor";
import { TemplateBar } from "../../components/TemplateBar";

// ─── PLANNER ADMIN ─────────────────────────────────────────────────────────────
export function PlannerAdmin({
  period,
  updateWorkout,
  addWorkout,
  deleteWorkout,
  memberRoster,
  getSessionMembers,
  setSessionMembersForWod,
  profile,
  authUser,
}) {
  const today = todayStr();
  const periodMonday = getMondayOfWeek(period.startDate || today);
  const totalWeeks = period.durationWeeks || 8;
  const [weekOffset, setWeekOffset] = useState(() => {
    const todayM = getMondayOfWeek(today);
    const diff = Math.round(
      (new Date(todayM + "T12:00:00") - new Date(periodMonday + "T12:00:00")) /
        (7 * 24 * 3600 * 1000),
    );
    return Math.max(0, Math.min(totalWeeks - 1, diff));
  });
  const [selDate, setSelDate] = useState(null);
  const [editWod, setEditWod] = useState(null);
  const [modalTab, setModalTab] = useState("wod"); // "wod" | "participants"
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copyDate, setCopyDate] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [draftMems, setDraftMems] = useState([]); // participants of a session that isn't saved yet

  const weekStart = addDays(periodMonday, weekOffset * 7);
  const weekDates = getWeekDates(weekStart);
  const wodsForDate = (date) =>
    period.workouts
      .filter((w) => w.date === date)
      .sort(
        (a, b) =>
          (a.sessionNumber || 0) - (b.sessionNumber || 0) || a.id - b.id,
      );

  // wodId given -> edit that session; otherwise add a new one (max 2 per day)
  const openDay = (date, wodId) => {
    const list = wodsForDate(date);
    if (!wodId && list.length >= 2) return;
    setSelDate(date);
    setModalTab("wod");
    setConfirmDelete(false);
    const ex = wodId ? list.find((w) => w.id === wodId) : null;
    if (ex) {
      setEditWod({ ...ex, blocks: ex.blocks.map((b) => ({ ...b })) });
    } else {
      setEditWod({
        ...EMPTY_WOD(),
        date,
        sessionNumber: nextSessionNumber(period.workouts),
      });
    }
    setDraftMems([]);
    setCopyDate("");
    setCopyMsg("");
  };
  const saveWod = () => {
    const exists = period.workouts.some((w) => w.id === editWod.id);
    const cleaned = { ...editWod, blocks: editWod.blocks.map(cleanBlock) };
    if (exists) updateWorkout(period.id, cleaned);
    else {
      addWorkout(period.id, cleaned);
      if (draftMems.length) setSessionMembersForWod(cleaned.id, draftMems);
    }
    setSelDate(null);
    setEditWod(null);
  };
  // Copy this session (without results or participants) to another day, as a new session
  const copyWod = () => {
    setCopyMsg("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(copyDate || "")) {
      setCopyMsg("Pick a date to copy to.");
      return;
    }
    if (editWod.blocks.some((b) => !String(b.description || "").trim())) {
      setCopyMsg("Every block needs a description before it can be copied.");
      return;
    }
    if (wodsForDate(copyDate).length >= 2) {
      setCopyMsg("That day already has 2 sessions.");
      return;
    }
    const blocks = editWod.blocks.map((b) => ({
      ...cleanBlock(b),
      variables: [...(b.variables || [])],
    }));
    addWorkout(period.id, {
      ...editWod,
      blocks,
      id: Date.now(),
      date: copyDate,
      sessionNumber: nextSessionNumber(period.workouts),
    });
    setCopyMsg(`Copied to ${formatDate(copyDate)}.`);
  };

  const deleteDay = () => {
    const ex = period.workouts.find((w) => w.id === editWod.id);
    if (ex && !confirmDelete) {
      setConfirmDelete(true);
      return;
    } // saved sessions need a second click to confirm
    if (ex) deleteWorkout(period.id, ex.id); // also removes its participant list
    setSelDate(null);
    setEditWod(null);
  };

  // Participants for the open modal. A saved session updates its list right away; an unsaved
  // one keeps the list here and only stores it on Save, so Cancel leaves nothing behind.
  const currentWodId = editWod?.id;
  const isSavedWod =
    !!editWod && period.workouts.some((w) => w.id === currentWodId);
  const sessionMems = !editWod
    ? []
    : isSavedWod
      ? getSessionMembers(currentWodId)
      : draftMems;
  const setMems = (mems) =>
    isSavedWod
      ? setSessionMembersForWod(currentWodId, mems)
      : setDraftMems(mems);
  const toggleParticipant = (name) => {
    if (!editWod) return;
    if (sessionMems.includes(name))
      setMems(sessionMems.filter((n) => n !== name));
    else if (sessionMems.length < 16) setMems([...sessionMems, name]);
  };

  const allWeeks = Array.from({ length: totalWeeks }, (_, i) =>
    getWeekDates(addDays(periodMonday, i * 7)),
  );

  return (
    <div>
      <div className="flex-between mb-4">
        <h3 style={{ fontSize: "1.2rem" }}>
          Week {weekOffset + 1} of {totalWeeks}
        </h3>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset <= 0}
          >
            ← Prev
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const d = getMondayOfWeek(today);
              const diff = Math.round(
                (new Date(d + "T12:00:00") -
                  new Date(periodMonday + "T12:00:00")) /
                  (7 * 24 * 3600 * 1000),
              );
              setWeekOffset(Math.max(0, Math.min(totalWeeks - 1, diff)));
            }}
          >
            This Week
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() =>
              setWeekOffset((w) => Math.min(totalWeeks - 1, w + 1))
            }
            disabled={weekOffset >= totalWeeks - 1}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: "8px",
          marginBottom: "32px",
        }}
      >
        {weekDates.map((date, i) => {
          const list = wodsForDate(date);
          const d = new Date(date + "T12:00:00");
          return (
            <div
              key={date}
              className={`week-day-card ${date === today ? "today-card" : ""} ${list.length ? "has-wod-card" : ""}`}
              onClick={() => {
                if (list.length <= 1) openDay(date, list[0]?.id);
              }}
              style={{ position: "relative" }}
            >
              {date === today && (
                <span
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    color: "#FF6B1A",
                  }}
                >
                  ● TODAY
                </span>
              )}
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#8a7a6a",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                {DAYS[i]}
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  marginBottom: "6px",
                }}
              >
                {d.getDate()}
              </div>
              {list.length > 0 ? (
                <>
                  {list.map((wod) => {
                    const participants = getSessionMembers(wod.id);
                    return (
                      <div
                        key={wod.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDay(date, wod.id);
                        }}
                        style={{ marginBottom: "8px", cursor: "pointer" }}
                      >
                        <div
                          className="session-tag"
                          style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                        >
                          #{wod.sessionNumber}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            marginTop: "4px",
                            color: "#c8bfb0",
                          }}
                        >
                          {wod.title || "WoD"}
                        </div>
                        <div
                          style={{
                            marginTop: "6px",
                            display: "flex",
                            gap: "3px",
                          }}
                        >
                          {wod.blocks.map((b) => (
                            <span
                              key={b.name}
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "3px",
                                background: BLOCK_COLORS[b.name] || "#FF6B1A",
                                display: "inline-block",
                              }}
                            />
                          ))}
                        </div>
                        {participants.length > 0 && (
                          <div
                            style={{
                              marginTop: "6px",
                              fontSize: "0.68rem",
                              color: "#FF9A4D",
                            }}
                          >
                            👥 {participants.length}/16
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {list.length < 2 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{
                        marginTop: "2px",
                        fontSize: "0.65rem",
                        padding: "3px 6px",
                        whiteSpace: "normal",
                        lineHeight: 1.2,
                        textAlign: "left",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDay(date);
                      }}
                    >
                      + Add session
                    </button>
                  )}
                </>
              ) : (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.2)",
                    marginTop: "8px",
                  }}
                >
                  + Add WoD
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 8-week overview */}
      <div className="section-header">
        <h4
          style={{
            fontSize: "0.85rem",
            color: "#8a7a6a",
            fontFamily: "'Barlow Condensed',sans-serif",
            letterSpacing: "0.08em",
          }}
        >
          {totalWeeks}-WEEK OVERVIEW
        </h4>
        <div className="section-line" />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          marginBottom: "32px",
        }}
      >
        {allWeeks.map((week, wi) => {
          const sessionCount = week.reduce(
            (n, d) => n + wodsForDate(d).length,
            0,
          );
          const s = new Date(week[0] + "T12:00:00"),
            e = new Date(week[6] + "T12:00:00");
          return (
            <div
              key={wi}
              className={`card ${weekOffset === wi ? "card-orange" : ""}`}
              style={{ padding: "10px 16px", cursor: "pointer" }}
              onClick={() => setWeekOffset(wi)}
            >
              <div className="flex-between">
                <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  Week {wi + 1}: {s.getDate()}{" "}
                  {MONTHS[s.getMonth()].slice(0, 3)} – {e.getDate()}{" "}
                  {MONTHS[e.getMonth()].slice(0, 3)}
                </span>
                <div className="flex gap-2">
                  <div
                    style={{
                      display: "flex",
                      gap: "3px",
                      alignItems: "center",
                    }}
                  >
                    {week.map((d) => {
                      const w = wodsForDate(d).length > 0;
                      return (
                        <span
                          key={d}
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "2px",
                            background: w ? "#FF6B1A" : "rgba(255,255,255,0.1)",
                            display: "inline-block",
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="muted small">
                    {sessionCount} session{sessionCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Day modal */}
      {selDate && editWod && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && (setSelDate(null), setEditWod(null))
          }
        >
          <div className="modal-inner">
            {/* Modal header — a true fixed header, not part of the scrolling body, so Save/Cancel/Delete are always reachable with no gap */}
            <div
              className="modal-header flex-between"
              style={{ flexWrap: "wrap", gap: "10px" }}
            >
              <h3 style={{ color: "#FF6B1A" }}>{formatDate(selDate)}</h3>
              <div className="flex gap-2">
                <button className="btn btn-danger btn-sm" onClick={deleteDay}>
                  {confirmDelete ? "Confirm delete" : "Delete"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSelDate(null);
                    setEditWod(null);
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={saveWod}>
                  Save
                </button>
              </div>
            </div>

            <div className="modal-body">
              {/* Modal tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  marginBottom: "18px",
                }}
              >
                {[
                  ["wod", "WoD"],
                  ["participants", `Participants (${sessionMems.length}/16)`],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    style={{
                      padding: "7px 16px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: modalTab === k ? "#FF6B1A" : "#8a7a6a",
                      fontFamily: "'Barlow',sans-serif",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      borderBottom:
                        modalTab === k
                          ? "2px solid #FF6B1A"
                          : "2px solid transparent",
                      marginBottom: "-1px",
                      transition: "all 0.15s",
                    }}
                    onClick={() => setModalTab(k)}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* WoD tab */}
              {modalTab === "wod" && (
                <>
                  {profile && authUser && (
                    <TemplateBar
                      profile={profile}
                      authUser={authUser}
                      allowApply={!isSavedWod}
                      getCurrent={() => ({
                        title: editWod.title,
                        blocks: editWod.blocks,
                      })}
                      onApply={(t) =>
                        setEditWod((p) => ({
                          ...p,
                          title: p.title || t.title,
                          blocks: t.blocks,
                        }))
                      }
                    />
                  )}
                  {isSavedWod && (
                    <div className="card mb-3" style={{ padding: "12px 14px" }}>
                      <div
                        className="muted small"
                        style={{
                          marginBottom: "8px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Copy this session
                      </div>
                      <div
                        className="flex gap-2"
                        style={{ flexWrap: "wrap", alignItems: "center" }}
                      >
                        <input
                          type="date"
                          aria-label="Copy to date"
                          value={copyDate}
                          onChange={(e) => setCopyDate(e.target.value)}
                          style={{ width: "auto" }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={copyWod}
                        >
                          Copy to this day
                        </button>
                      </div>
                      {copyMsg && (
                        <p className="small mt-2" style={{ color: "#c8bfb0" }}>
                          {copyMsg}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="grid-2 mb-3">
                    <div>
                      <label>WoD Title</label>
                      <input
                        value={editWod.title}
                        onChange={(e) =>
                          setEditWod((p) => ({ ...p, title: e.target.value }))
                        }
                        placeholder="Session name"
                      />
                    </div>
                    <div>
                      <label>Session #</label>
                      <input
                        type="number"
                        value={editWod.sessionNumber}
                        onChange={(e) =>
                          setEditWod((p) => ({
                            ...p,
                            sessionNumber: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  {editWod.blocks.map((block, idx) => (
                    <div key={idx} className="card card-orange mb-3">
                      <div className="flex-between mb-2">
                        <span
                          style={{
                            fontWeight: 700,
                            color: BLOCK_COLORS[block.name] || "#FF6B1A",
                          }}
                        >
                          Block {block.name}
                        </span>
                        <button
                          className="btn btn-danger btn-xs"
                          onClick={() =>
                            setEditWod((p) => ({
                              ...p,
                              blocks: p.blocks.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          ✕
                        </button>
                      </div>
                      <div
                        className="flex gap-2 mb-2"
                        style={{ flexWrap: "wrap" }}
                      >
                        <span
                          className="muted small"
                          style={{ alignSelf: "center" }}
                        >
                          Templates:
                        </span>
                        {Object.keys(BLOCK_TEMPLATES).map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              setEditWod((p) => ({
                                ...p,
                                blocks: p.blocks.map((b, i) =>
                                  i === idx
                                    ? { ...b, ...templatePatch(name) }
                                    : b,
                                ),
                              }))
                            }
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={block.description}
                        onChange={(e) =>
                          setEditWod((p) => ({
                            ...p,
                            blocks: p.blocks.map((b, i) =>
                              i === idx
                                ? { ...b, description: e.target.value }
                                : b,
                            ),
                          }))
                        }
                        placeholder="Block description…"
                        style={{ marginBottom: "8px" }}
                      />
                      <ResultFieldsEditor
                        block={block}
                        onChange={(patch) =>
                          setEditWod((p) => ({
                            ...p,
                            blocks: p.blocks.map((b, i) =>
                              i === idx ? { ...b, ...patch } : b,
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                  {editWod.blocks.length < 4 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const n = ["A", "B", "C", "D"],
                          u = editWod.blocks.map((b) => b.name),
                          next = n.find((x) => !u.includes(x));
                        if (next)
                          setEditWod((p) => ({
                            ...p,
                            blocks: [
                              ...p.blocks,
                              {
                                name: next,
                                description: "",
                                variables: ["Rounds"],
                              },
                            ],
                          }));
                      }}
                    >
                      + Add Block
                    </button>
                  )}
                </>
              )}

              {/* Participants tab */}
              {modalTab === "participants" && (
                <div>
                  <div className="flex-between mb-3">
                    <p style={{ fontSize: "0.85rem", color: "#c8bfb0" }}>
                      Select up to 16 participants for this session.
                    </p>
                    {sessionMems.length > 0 && (
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setMems([])}
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {memberRoster.length === 0 ? (
                    <p className="muted small">
                      No members in roster yet. Add members in the Members tab
                      first.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {memberRoster.map((name) => {
                        const isIn = sessionMems.includes(name);
                        const isFull = !isIn && sessionMems.length >= 16;
                        return (
                          <button
                            key={name}
                            className={`member-pill ${isIn ? "active" : ""}`}
                            onClick={() => toggleParticipant(name)}
                            disabled={isFull}
                            style={
                              isFull
                                ? { opacity: 0.35, cursor: "not-allowed" }
                                : {}
                            }
                          >
                            {isIn ? "✓ " : ""}
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {sessionMems.length > 0 && (
                    <div
                      style={{
                        marginTop: "16px",
                        paddingTop: "14px",
                        borderTop: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "#8a7a6a",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: "8px",
                        }}
                      >
                        Registered ({sessionMems.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sessionMems.map((name) => (
                          <span
                            key={name}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "20px",
                              background: "rgba(255,107,26,0.12)",
                              border: "1px solid rgba(255,107,26,0.25)",
                              color: "#FF9A4D",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                            }}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
