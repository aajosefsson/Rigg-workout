import { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  collection,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { BLOCK_COLORS, BLOCK_TEMPLATES, templatePatch } from "../lib/constants";
import {
  DAYS,
  MONTHS,
  todayStr,
  formatDate,
  getMondayOfWeek,
  addDays,
  getWeekDates,
} from "../lib/dates";
import {
  blockSets,
  exercisesOf,
  isDetailed,
  perSetVarsOf,
  describeResults,
} from "../lib/resultFields";
import { ResultFieldsEditor } from "../components/ResultFieldsEditor";
import { ProgressPanel } from "../components/ProgressPanel";
import { TemplateBar } from "../components/TemplateBar";
import { entriesFromWorkouts } from "../lib/progress";

// ─── CLIENT PLAN (a coach's private schedule for one client) ───────────────────
export function ClientPlan({
  client,
  profile,
  authUser,
  coachName,
  allClients = [],
  onBack,
}) {
  const today = todayStr();
  const orgId = profile.orgId;
  const [workouts, setWorkouts] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(today));
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [copyClient, setCopyClient] = useState("");
  const [copyDate, setCopyDate] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const copyOptions = allClients.some((c) => c.id === client.id)
    ? allClients
    : [client, ...allClients];

  // Live: the coach sees a client's results the moment they are logged, and setup changes show up at once
  useEffect(() => {
    const base = [
      where("orgId", "==", orgId),
      where("clientId", "==", client.id),
    ];
    const q =
      profile.role === "coach"
        ? query(
            collection(db, "clientWorkouts"),
            ...base,
            where("coachId", "==", authUser.uid),
          )
        : query(collection(db, "clientWorkouts"), ...base);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setWorkouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadErr("");
      },
      () =>
        setLoadErr(
          "Could not load this client's sessions. Check your connection and the Firestore rules.",
        ),
    );
    return unsub;
  }, [client.id, orgId, profile.role, authUser.uid]);

  const byDate = {};
  workouts.forEach((w) => {
    (byDate[w.date] = byDate[w.date] || []).push(w);
  });
  Object.values(byDate).forEach((list) =>
    list.sort(
      (a, b) =>
        (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0),
    ),
  );
  const weekDates = getWeekDates(weekStart);
  const wkStartD = new Date(weekDates[0] + "T12:00:00"),
    wkEndD = new Date(weekDates[6] + "T12:00:00");
  const weekLabel = `${wkStartD.getDate()} ${MONTHS[wkStartD.getMonth()].slice(0, 3)} – ${wkEndD.getDate()} ${MONTHS[wkEndD.getMonth()].slice(0, 3)}`;
  const upcoming = workouts
    .filter((w) => w.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);
  const recent = workouts
    .filter((w) => w.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  // wid given -> edit that session; otherwise add a new one (max 2 per day)
  const openDay = (date, wid) => {
    const list = byDate[date] || [];
    if (!wid && list.length >= 2) return;
    const ex = wid ? list.find((w) => w.id === wid) : null;
    setFormErr("");
    setConfirmDel(false);
    setWeekStart(getMondayOfWeek(date));
    setEditing(
      ex
        ? {
            id: ex.id,
            date: ex.date,
            title: ex.title || "",
            blocks: (ex.blocks || []).map((b) => ({
              ...b,
              variables: [...(b.variables || [])],
            })),
            results: ex.results || null,
          }
        : {
            date,
            title: "",
            blocks: [
              {
                name: "A",
                description: "",
                variables: ["Rounds", "Weight (kg)"],
              },
            ],
            results: null,
          },
    );
  };

  const setBlock = (i, patch) =>
    setEditing((p) => ({
      ...p,
      blocks: p.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)),
    }));
  const addBlock = () =>
    setEditing((p) => {
      const next = ["A", "B", "C", "D"].find(
        (n) => !p.blocks.some((b) => b.name === n),
      );
      return next
        ? {
            ...p,
            blocks: [
              ...p.blocks,
              { name: next, description: "", variables: ["Rounds"] },
            ],
          }
        : p;
    });
  const removeBlock = (i) =>
    setEditing((p) => ({ ...p, blocks: p.blocks.filter((_, j) => j !== i) }));

  const save = async () => {
    setFormErr("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editing.date || "")) {
      setFormErr("Pick a date.");
      return;
    }
    if (!editing.blocks.length) {
      setFormErr("Add at least one block.");
      return;
    }
    if (editing.blocks.some((b) => !b.description.trim())) {
      setFormErr("Every block needs a description.");
      return;
    }
    if (
      workouts.filter((w) => w.date === editing.date && w.id !== editing.id)
        .length >= 2
    ) {
      setFormErr(
        "A day can have at most 2 sessions. Pick another date or open one of the existing sessions.",
      );
      return;
    }
    setSaving(true);
    const blocks = editing.blocks.map((b) => ({
      name: b.name,
      description: b.description.trim(),
      variables: b.variables || [],
      sets: blockSets(b),
      exercises: exercisesOf(b),
    }));
    const base = {
      date: editing.date,
      title: (editing.title || "").trim(),
      blocks,
    };
    try {
      if (editing.id) {
        await updateDoc(doc(db, "clientWorkouts", editing.id), {
          ...base,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(collection(db, "clientWorkouts")), {
          ...base,
          orgId,
          clientId: client.id,
          coachId: client.coachId,
          createdBy: authUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setWeekStart(getMondayOfWeek(base.date));
      setEditing(null);
      setSavedNote("Session saved. The client sees it straight away.");
      setTimeout(() => setSavedNote(""), 5000);
    } catch {
      setFormErr(
        "Could not save. Check your permissions and connection, then try again.",
      );
    }
    setSaving(false);
  };

  // Copies what is in the editor (without results) to another day and/or another client
  const copySession = async () => {
    setCopyMsg("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(copyDate || "")) {
      setCopyMsg("Pick a date to copy to.");
      return;
    }
    if (editing.blocks.some((b) => !b.description.trim())) {
      setCopyMsg("Every block needs a description before it can be copied.");
      return;
    }
    const target =
      copyOptions.find((c) => c.id === (copyClient || client.id)) || client;
    setCopyBusy(true);
    try {
      const baseQ = [
        where("orgId", "==", orgId),
        where("clientId", "==", target.id),
        where("date", "==", copyDate),
      ];
      const q =
        profile.role === "coach"
          ? query(
              collection(db, "clientWorkouts"),
              ...baseQ,
              where("coachId", "==", authUser.uid),
            )
          : query(collection(db, "clientWorkouts"), ...baseQ);
      const existing = await getDocs(q);
      if (existing.size >= 2) {
        setCopyMsg(`${target.name} already has 2 sessions on that day.`);
        setCopyBusy(false);
        return;
      }
      const blocks = editing.blocks.map((b) => ({
        name: b.name,
        description: b.description.trim(),
        variables: b.variables || [],
        sets: blockSets(b),
        exercises: exercisesOf(b),
      }));
      await setDoc(doc(collection(db, "clientWorkouts")), {
        date: copyDate,
        title: (editing.title || "").trim(),
        blocks,
        orgId,
        clientId: target.id,
        coachId: target.coachId,
        createdBy: authUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCopyMsg(
        `Copied to ${target.id === client.id ? "this client" : target.name} on ${formatDate(copyDate)}.`,
      );
    } catch {
      setCopyMsg("Could not copy the session. Check your permissions and try again.");
    }
    setCopyBusy(false);
  };

  const del = async () => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    try {
      await deleteDoc(doc(db, "clientWorkouts", editing.id));
      setEditing(null);
    } catch {
      setFormErr("Could not delete the session.");
    }
  };

  // what each block asks the client to log, e.g. "B: 3 exercises × 5 sets"
  const setupSummary = (w) =>
    (w.blocks || [])
      .filter((b) => isDetailed(b) && perSetVarsOf(b).length)
      .map((b) => {
        const n = exercisesOf(b).length,
          st = blockSets(b);
        return `${b.name}: ${[n ? `${n} exercise${n !== 1 ? "s" : ""}` : "", st > 1 ? `${st} sets` : ""].filter(Boolean).join(" × ")}`;
      })
      .join(" · ");

  const sessionRow = (w) => (
    <div
      key={w.id}
      className="card mb-2"
      style={{ padding: "10px 16px", cursor: "pointer" }}
      onClick={() => openDay(w.date, w.id)}
    >
      <div className="flex-between">
        <div>
          <span className="session-tag" style={{ fontSize: "0.72rem" }}>
            {formatDate(w.date)}
          </span>
          <span
            style={{ marginLeft: "8px", fontWeight: 600, fontSize: "0.9rem" }}
          >
            {w.title || "Session"}
          </span>
          {setupSummary(w) && (
            <div className="muted small" style={{ marginTop: "4px" }}>
              Logging: {setupSummary(w)}
            </div>
          )}
        </div>
        <span className="muted small">
          {(w.blocks || []).length} block
          {(w.blocks || []).length !== 1 ? "s" : ""}
          {w.results ? " · results logged" : ""}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "900px" }}
    >
      <button className="btn btn-ghost btn-sm mb-3" onClick={onBack}>
        ← All clients
      </button>
      <div className="mb-4">
        <h1 style={{ fontSize: "2rem", color: "#FF6B1A" }}>{client.name}</h1>
        <p className="muted small">
          {client.email} · Coach: {coachName}
        </p>
      </div>

      {loadErr && (
        <div
          className="card mb-4"
          style={{ color: "#ff7070", fontSize: "0.85rem" }}
        >
          {loadErr}
        </div>
      )}
      {savedNote && (
        <p className="small mb-3" style={{ color: "#7dde7d" }}>
          {savedNote}
        </p>
      )}

      <div className="flex-between mb-3">
        <h3 style={{ fontSize: "1.15rem" }}>{weekLabel}</h3>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            ← Prev
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(getMondayOfWeek(today))}
          >
            This week
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            Next →
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(105px,1fr))",
          gap: "8px",
          marginBottom: "28px",
        }}
      >
        {weekDates.map((date, i) => {
          const list = byDate[date] || [];
          const d = new Date(date + "T12:00:00");
          return (
            <div
              key={date}
              role="button"
              tabIndex={0}
              className={`week-day-card ${date === today ? "today-card" : ""} ${list.length ? "has-wod-card" : ""}`}
              style={{ position: "relative" }}
              onClick={() => {
                if (list.length <= 1) openDay(date, list[0]?.id);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && list.length <= 1) {
                  e.preventDefault();
                  openDay(date, list[0]?.id);
                }
              }}
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
                  {list.map((w, k) => (
                    <div
                      key={w.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDay(date, w.id);
                      }}
                      style={{ marginBottom: "8px", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#c8bfb0" }}>
                        {w.title || `Session ${k + 1}`}
                      </div>
                      <div
                        style={{
                          marginTop: "4px",
                          display: "flex",
                          gap: "3px",
                        }}
                      >
                        {(w.blocks || []).map((b) => (
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
                    </div>
                  ))}
                  {list.length < 2 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{
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
                  + Add session
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="section-header mb-3">
        <h4
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "1rem",
            letterSpacing: "0.08em",
            color: "#8a7a6a",
          }}
        >
          UPCOMING SESSIONS
        </h4>
        <div className="section-line" />
      </div>
      {upcoming.length === 0 ? (
        <p className="muted small mb-4">
          Nothing scheduled yet. Click a day above to add a session.
        </p>
      ) : (
        <div className="mb-4">{upcoming.map(sessionRow)}</div>
      )}

      {recent.length > 0 && (
        <>
          <div className="section-header mb-3">
            <h4
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: "1rem",
                letterSpacing: "0.08em",
                color: "#8a7a6a",
              }}
            >
              RECENT SESSIONS
            </h4>
            <div className="section-line" />
          </div>
          {recent.map(sessionRow)}
        </>
      )}

      <div className="flex-between mt-4 mb-3">
        <h4
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "1rem",
            letterSpacing: "0.08em",
            color: "#8a7a6a",
          }}
        >
          PROGRESS
        </h4>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowProgress((v) => !v)}
        >
          {showProgress ? "Hide" : "Show"}
        </button>
      </div>
      {showProgress && (
        <div className="card mb-4">
          <ProgressPanel entries={entriesFromWorkouts(workouts)} />
        </div>
      )}

      {editing && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="modal-inner">
            <div
              className="modal-header flex-between"
              style={{ flexWrap: "wrap", gap: "10px" }}
            >
              <h3 style={{ color: "#FF6B1A" }}>
                {editing.id ? "Edit session" : "New session"}
              </h3>
              <div className="flex gap-2">
                {editing.id && (
                  <button className="btn btn-danger btn-sm" onClick={del}>
                    {confirmDel ? "Confirm delete" : "Delete"}
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                  onClick={save}
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            <div className="modal-body">
              {formErr && (
                <div
                  style={{
                    color: "#ff7070",
                    fontSize: "0.85rem",
                    marginBottom: "12px",
                  }}
                >
                  {formErr}
                </div>
              )}
              <TemplateBar
                profile={profile}
                authUser={authUser}
                allowApply={!editing.id}
                getCurrent={() => ({
                  title: editing.title,
                  blocks: editing.blocks,
                })}
                onApply={(t) =>
                  setEditing((p) => ({
                    ...p,
                    title: p.title || t.title,
                    blocks: t.blocks,
                  }))
                }
              />
              {editing.id && (
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
                    <select
                      aria-label="Copy to client"
                      value={copyClient || client.id}
                      onChange={(e) => setCopyClient(e.target.value)}
                      style={{ width: "auto", minWidth: "170px", flex: "1 1 170px" }}
                    >
                      {copyOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id === client.id ? `${c.name} (this client)` : c.name}
                        </option>
                      ))}
                    </select>
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
                      disabled={copyBusy}
                      onClick={copySession}
                    >
                      {copyBusy ? "Copying…" : "Copy"}
                    </button>
                  </div>
                  {copyMsg && (
                    <p className="small mt-2" style={{ color: "#c8bfb0" }}>
                      {copyMsg}
                    </p>
                  )}
                </div>
              )}
              {workouts.some(
                (w) => w.date === editing.date && w.id !== editing.id,
              ) && (
                <p className="muted small mb-3">
                  This day already has another session. A day can have at most
                  2.
                </p>
              )}
              <div className="grid-2 mb-3">
                <div>
                  <label htmlFor="cw-title">Title</label>
                  <input
                    id="cw-title"
                    value={editing.title}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="e.g. Lower body strength"
                  />
                </div>
                <div>
                  <label htmlFor="cw-date">Date</label>
                  <input
                    id="cw-date"
                    type="date"
                    value={editing.date}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, date: e.target.value }))
                    }
                  />
                </div>
              </div>
              {editing.blocks.map((block, idx) => (
                <div key={block.name} className="card card-orange mb-3">
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
                      onClick={() => removeBlock(idx)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap" }}>
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
                        onClick={() => setBlock(idx, templatePatch(name))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={block.description}
                    onChange={(e) =>
                      setBlock(idx, { description: e.target.value })
                    }
                    placeholder="Block description…"
                    style={{ marginBottom: "8px" }}
                  />
                  <ResultFieldsEditor
                    block={block}
                    onChange={(patch) => setBlock(idx, patch)}
                    hasResults={!!editing.results?.[block.name]}
                  />
                  {editing.results?.[block.name] && (
                    <div className="small mt-2" style={{ color: "#7dde7d" }}>
                      Client's result:{" "}
                      {describeResults(
                        block,
                        (k) => editing.results[block.name][k],
                        editing.results[block.name],
                      ) || "—"}
                    </div>
                  )}
                </div>
              ))}
              {editing.blocks.length < 4 && (
                <button className="btn btn-ghost btn-sm" onClick={addBlock}>
                  + Add Block
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
