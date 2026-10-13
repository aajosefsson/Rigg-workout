import { useState, useEffect, useRef } from "react";
import {
  doc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { BLOCK_COLORS } from "../lib/constants";
import {
  DAYS,
  MONTHS,
  todayStr,
  formatDate,
  getMondayOfWeek,
  addDays,
  getWeekDates,
} from "../lib/dates";
import { fieldKeys, describeFields } from "../lib/resultFields";
import { ResultInputs } from "../components/ResultInputs";
import { SectionTitle } from "../components/SectionTitle";

// ─── MY PLAN (a client's own sessions and results) ─────────────────────────────
export function MyPlanView({ profile, authUser, org }) {
  const today = todayStr();
  const uid = authUser.uid;
  const [workouts, setWorkouts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(today));
  const [sessionIdx, setSessionIdx] = useState(0);
  const [openBlockIdx, setOpenBlockIdx] = useState(null);
  const [drafts, setDrafts] = useState({}); // `${sessionId}_${block}` -> {variable: value}
  const [savingKey, setSavingKey] = useState(null);
  const [saveErr, setSaveErr] = useState("");
  const blockRefs = useRef([]);
  const jumped = useRef(false);

  // Live: if the coach changes the session (for example which fields to log), it updates here at once
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "clientWorkouts"), where("clientId", "==", uid)),
      (snap) => {
        setWorkouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStatus("ready");
      },
      () => setStatus("error"),
    );
    return unsub;
  }, [uid]);

  const created = (w) => (w.createdAt?.toMillis ? w.createdAt.toMillis() : 0);
  const wodsForDate = (date) =>
    workouts
      .filter((w) => w.date === date)
      .sort((a, b) => created(a) - created(b));
  const upcoming = workouts
    .filter((w) => w.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || created(a) - created(b));
  const recent = workouts
    .filter((w) => w.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || created(a) - created(b));

  // First load: if nothing is planned today, jump to the next planned session
  useEffect(() => {
    if (status !== "ready" || jumped.current) return;
    jumped.current = true;
    if (wodsForDate(today).length === 0 && upcoming.length) {
      setSelectedDate(upcoming[0].date);
      setWeekStart(getMondayOfWeek(upcoming[0].date));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    setSessionIdx(0);
  }, [selectedDate]);

  const dayWods = wodsForDate(selectedDate);
  const wod = dayWods[Math.min(sessionIdx, Math.max(dayWods.length - 1, 0))];
  const isSaved = (w, block) => !!w?.doneBlocks?.[block.name];
  const allDone =
    !!wod && wod.blocks.length > 0 && wod.blocks.every((b) => isSaved(wod, b));

  // When the session changes, open the first block that isn't logged yet
  useEffect(() => {
    if (!wod) {
      setOpenBlockIdx(null);
      return;
    }
    const first = wod.blocks.findIndex((b) => !isSaved(wod, b));
    setOpenBlockIdx(first === -1 ? null : first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wod?.id]);

  const pickDate = (date) => {
    setSelectedDate(date);
    setWeekStart(getMondayOfWeek(date));
  };

  const draftFor = (w, block) =>
    drafts[`${w.id}_${block.name}`] ?? w.results?.[block.name] ?? {};
  const setDraft = (w, block, variable, value) =>
    setDrafts((p) => ({
      ...p,
      [`${w.id}_${block.name}`]: {
        ...(p[`${w.id}_${block.name}`] ?? w.results?.[block.name] ?? {}),
        [variable]: value,
      },
    }));

  const handleBlockDone = async (bi) => {
    const block = wod.blocks[bi];
    const key = `${wod.id}_${block.name}`;
    const draft = draftFor(wod, block);
    const vals = {};
    fieldKeys(block).forEach((k) => {
      const t = String(draft[k] ?? "").trim();
      if (t) vals[k] = t.slice(0, 200);
    });
    setSavingKey(key);
    setSaveErr("");
    try {
      await updateDoc(doc(db, "clientWorkouts", wod.id), {
        [`results.${block.name}`]: vals,
        [`doneBlocks.${block.name}`]: true,
        updatedAt: serverTimestamp(),
      });
      const next = bi + 1;
      if (next < wod.blocks.length) {
        setOpenBlockIdx(next);
        setTimeout(() => {
          blockRefs.current[next]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 80);
      } else setOpenBlockIdx(null);
    } catch {
      setSaveErr(
        "Could not save your results. Check your connection and try again.",
      );
    }
    setSavingKey(null);
  };

  if (status === "loading")
    return (
      <div
        className="page text-center muted"
        style={{ position: "relative", zIndex: 1 }}
      >
        Loading your plan…
      </div>
    );
  if (status === "error")
    return (
      <div
        className="page"
        style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}
      >
        <div className="card" style={{ color: "#ff7070", fontSize: "0.9rem" }}>
          Could not load your plan. Check your connection and reload the page.
        </div>
      </div>
    );

  const weekDates = getWeekDates(weekStart);
  const wkA = new Date(weekDates[0] + "T12:00:00"),
    wkB = new Date(weekDates[6] + "T12:00:00");
  const sessionRow = (w) => (
    <div
      key={w.id}
      className="card mb-2"
      style={{ padding: "10px 16px", cursor: "pointer" }}
      onClick={() => pickDate(w.date)}
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
        </div>
        <span className="muted small">
          {w.blocks.length > 0 && w.blocks.every((b) => w.doneBlocks?.[b.name])
            ? "✓ logged"
            : `${w.blocks.length} block${w.blocks.length !== 1 ? "s" : ""}`}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "780px" }}
    >
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          className="muted small"
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: "4px",
          }}
        >
          {org?.name || "Your coach"} · personal program
        </div>
        <h1 style={{ fontSize: "3rem", lineHeight: 1, color: "#FF6B1A" }}>
          MY
          <br />
          PLAN
        </h1>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "12px",
            padding: "5px 14px",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: "0.75rem",
            color: "#b9ada0",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="1.5"></rect>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
          </svg>
          Only visible to you and your coach
        </div>
      </div>

      {/* Week navigation + day strip */}
      <div style={{ marginBottom: "16px" }}>
        <div className="flex-between mb-2">
          <button
            className="wod-nav-btn"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            ← Week
          </button>
          <span
            style={{ fontSize: "0.82rem", color: "#8a7a6a", fontWeight: 600 }}
          >
            {wkA.getDate()} {MONTHS[wkA.getMonth()].slice(0, 3)} –{" "}
            {wkB.getDate()} {MONTHS[wkB.getMonth()].slice(0, 3)}
          </span>
          <button
            className="wod-nav-btn"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            Week →
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7,1fr)",
            gap: "4px",
          }}
        >
          {weekDates.map((date, i) => {
            const count = wodsForDate(date).length;
            const isSel = date === selectedDate;
            const isTod = date === today;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  padding: "8px 4px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  background: isSel
                    ? "#FF6B1A"
                    : isTod
                      ? "rgba(255,107,26,0.2)"
                      : "rgba(255,255,255,0.04)",
                  color: isSel ? "#fff" : isTod ? "#FF6B1A" : "#f0ebe3",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <span
                  style={{ fontSize: "0.65rem", fontWeight: 700, opacity: 0.7 }}
                >
                  {DAYS[i].slice(0, 1)}
                </span>
                <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                  {new Date(date + "T12:00:00").getDate()}
                </span>
                <span style={{ display: "flex", gap: "3px", height: "5px" }}>
                  {Array.from({ length: Math.min(count, 2) }).map((_, k) => (
                    <span
                      key={k}
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: isSel ? "#fff" : "#FF6B1A",
                        display: "block",
                      }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {dayWods.length > 1 && (
        <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          {dayWods.map((w, i) => (
            <button
              key={w.id}
              type="button"
              className={`period-pill ${wod?.id === w.id ? "active" : ""}`}
              onClick={() => setSessionIdx(i)}
            >
              Session {i + 1}
              {w.title ? ` · ${w.title}` : ""}
            </button>
          ))}
        </div>
      )}

      {/* The selected session */}
      {wod ? (
        <div className="card mb-4">
          <div className="flex-between mb-3">
            <div>
              <span className="session-tag">{formatDate(wod.date)}</span>
              <h3 style={{ fontSize: "1.2rem", marginTop: "6px" }}>
                {wod.title || "Session"}
              </h3>
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: wod.date === today ? "#FF6B1A" : "#8a7a6a",
              }}
            >
              {wod.date === today
                ? "● TODAY"
                : wod.date > today
                  ? "Upcoming"
                  : "Past session"}
            </div>
          </div>

          {wod.blocks.map((block, bi) => {
            const key = `${wod.id}_${block.name}`;
            const saved = isSaved(wod, block);
            const open = openBlockIdx === bi;
            const draft = draftFor(wod, block);
            const last = bi === wod.blocks.length - 1;
            return (
              <div
                key={block.name}
                ref={(el) => {
                  blockRefs.current[bi] = el;
                }}
                style={{
                  marginBottom: !last ? "24px" : 0,
                  paddingBottom: !last ? "24px" : 0,
                  borderBottom: !last
                    ? "1px solid rgba(255,255,255,0.06)"
                    : undefined,
                  scrollMarginTop: "80px",
                }}
              >
                <div className="flex-center gap-3 mb-2">
                  <div
                    className="block-badge"
                    style={{
                      background: BLOCK_COLORS[block.name] || "#FF6B1A",
                      color: "#fff",
                    }}
                  >
                    {block.name}
                  </div>
                  <span
                    style={{
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      letterSpacing: "0.04em",
                    }}
                  >
                    BLOCK {block.name}
                  </span>
                </div>
                <pre
                  style={{
                    fontFamily: "'Barlow',sans-serif",
                    fontSize: "0.95rem",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                    color: "#e0d8ce",
                    paddingLeft: "40px",
                  }}
                >
                  {block.description}
                </pre>

                <div style={{ marginLeft: "40px", marginTop: "12px" }}>
                  {saved && !open ? (
                    <button
                      type="button"
                      onClick={() => setOpenBlockIdx(bi)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid rgba(80,200,80,0.25)",
                        background: "rgba(80,200,80,0.06)",
                        color: "#7dde7d",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>✓ Results logged for Block {block.name}</span>
                      <span style={{ color: "#8a7a6a", fontWeight: 500 }}>
                        Edit
                      </span>
                    </button>
                  ) : open ? (
                    <div
                      className="card"
                      style={{
                        border: "1px solid rgba(255,107,26,0.25)",
                        padding: "16px",
                      }}
                    >
                      <p
                        className="muted small"
                        style={{ marginBottom: "12px" }}
                      >
                        {describeFields(block).replace("Members log:", "Log:")}
                      </p>
                      <ResultInputs
                        block={block}
                        idPrefix={key}
                        getValue={(k) => draft[k] ?? ""}
                        setValue={(k, val) => setDraft(wod, block, k, val)}
                      />
                      {saveErr && (
                        <div
                          style={{
                            color: "#ff7070",
                            fontSize: "0.82rem",
                            marginTop: "10px",
                          }}
                        >
                          {saveErr}
                        </div>
                      )}
                      <button
                        className="btn btn-primary mt-3 w-full"
                        style={{
                          justifyContent: "center",
                          opacity: savingKey === key ? 0.6 : 1,
                        }}
                        disabled={savingKey === key}
                        onClick={() => handleBlockDone(bi)}
                      >
                        {savingKey === key
                          ? "Saving…"
                          : `✓ Done — ${!last ? `Next: Block ${wod.blocks[bi + 1].name}` : "Finish"}`}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setOpenBlockIdx(bi)}
                    >
                      Log results for Block {block.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {allDone && (
            <div
              className="mt-4"
              style={{
                padding: "14px 18px",
                textAlign: "center",
                borderRadius: "10px",
                border: "1px solid rgba(80,200,80,0.2)",
                background: "rgba(80,200,80,0.04)",
              }}
            >
              <div style={{ color: "#7dde7d", fontWeight: 600 }}>
                ✓ All results saved — great work, {profile.name}!
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center mb-4" style={{ padding: "32px" }}>
          <p className="muted">
            No session planned for {formatDate(selectedDate)}
          </p>
          <p className="muted small mt-2">
            Pick another day above, or check your upcoming sessions below.
          </p>
        </div>
      )}

      <SectionTitle>UPCOMING SESSIONS</SectionTitle>
      {upcoming.length === 0 ? (
        <p className="muted small mb-4">
          Nothing scheduled yet. Your coach will add sessions here.
        </p>
      ) : (
        <div className="mb-4">{upcoming.slice(0, 8).map(sessionRow)}</div>
      )}

      {recent.length > 0 && (
        <>
          <SectionTitle>RECENT SESSIONS</SectionTitle>
          {recent.slice(0, 8).map(sessionRow)}
        </>
      )}
    </div>
  );
}
