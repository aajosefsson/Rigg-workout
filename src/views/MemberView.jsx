import { useState, useEffect, useRef } from "react";
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
import { useClassResults } from "../hooks/useClassResults";
import { ResultInputs } from "../components/ResultInputs";
import { ResultsTable } from "../components/ResultsTable";

// ─── MEMBER VIEW ───────────────────────────────────────────────────────────────
export function MemberView({ allWorkouts, periods, getSessionMembers, memberRoster }) {
  const today = todayStr();
  const todayMonday = getMondayOfWeek(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [memberName, setMemberName] = useState(() => {
    try {
      return localStorage.getItem("rigg_member_name") || "";
    } catch {
      return "";
    }
  });
  const [calMonth, setCalMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  useEffect(() => {
    try {
      if (memberName) localStorage.setItem("rigg_member_name", memberName);
      else localStorage.removeItem("rigg_member_name");
    } catch {
      // storage can be blocked (private mode); remembering the name is only a convenience
    }
  }, [memberName]);

  const weekStart = addDays(todayMonday, weekOffset * 7);
  const weekDates = getWeekDates(weekStart);

  // Week arrows: if the selected date isn't in the new week, pick today, the first day
  // with a session, or Monday
  const goToWeek = (offset) => {
    const dates = getWeekDates(addDays(todayMonday, offset * 7));
    setWeekOffset(offset);
    if (!dates.includes(selectedDate)) {
      const firstWod = dates.find((d) => allWorkouts.some((w) => w.date === d));
      setSelectedDate(dates.includes(today) ? today : firstWod || dates[0]);
    }
  };

  const wodsForDate = (date) =>
    allWorkouts
      .filter((w) => w.date === date)
      .sort(
        (a, b) =>
          (a.sessionNumber || 0) - (b.sessionNumber || 0) || a.id - b.id,
      );
  const dayWods = wodsForDate(selectedDate);
  const [sessionIdx, setSessionIdx] = useState(0);
  useEffect(() => {
    setSessionIdx(0);
  }, [selectedDate]); // always start on the first session of a day
  const wod = dayWods[Math.min(sessionIdx, Math.max(dayWods.length - 1, 0))];
  const period = periods.find((p) => p.workouts.some((w) => w.id === wod?.id));
  const sessionMems = wod ? getSessionMembers(wod.id) : [];

  // Class results live in one document per session, with one entry per member and block
  const cr = useClassResults(wod?.id);
  const [drafts, setDrafts] = useState({}); // block name -> {variable: value} typed by the selected member
  const [saveErr, setSaveErr] = useState("");
  useEffect(() => {
    setDrafts({});
    setSaveErr("");
  }, [wod?.id, memberName]);
  const valueFor = (block, v) =>
    drafts[block.name]?.[v] ?? cr.get(block.name, memberName, v);
  // Anyone who logs a result is shown on the session, even if they weren't ticked as a participant
  const resultMems = [
    ...sessionMems,
    ...cr.entryMembers().filter((m) => !sessionMems.includes(m)),
  ];
  const unlistedMems = resultMems.filter((m) => !sessionMems.includes(m));
  const isBlockSaved = (block) =>
    !!(wod && memberName && cr.isSaved(block.name, memberName));
  const allBlocksSaved =
    wod &&
    memberName &&
    wod.blocks.length > 0 &&
    wod.blocks.every(isBlockSaved);

  const [openBlockIdx, setOpenBlockIdx] = useState(null);
  const blockRefs = useRef([]);
  const [openClassResults, setOpenClassResults] = useState({});
  const toggleClassResults = (name) =>
    setOpenClassResults((p) => ({ ...p, [name]: !p[name] }));
  useEffect(() => {
    setOpenClassResults({});
  }, [wod?.id]);

  // When the WoD or the selected member changes, jump to the first not-yet-logged block
  useEffect(() => {
    if (!wod || !memberName) {
      setOpenBlockIdx(null);
      return;
    }
    if (!cr.ready) return; // wait until this session's saved results have loaded
    const firstIncomplete = wod.blocks.findIndex((b) => !isBlockSaved(b));
    setOpenBlockIdx(firstIncomplete === -1 ? null : firstIncomplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wod?.id, memberName, cr.ready]);

  const handleBlockDone = (bi) => {
    const block = wod.blocks[bi];
    const vals = {};
    fieldKeys(block).forEach((k) => {
      vals[k] = String(valueFor(block, k) ?? "")
        .trim()
        .slice(0, 200);
    });
    setSaveErr("");
    // saved instantly on this device, then synced; if the database refuses it we say so
    cr.saveBlock(block.name, memberName, vals).catch((err) => {
      console.error("Saving results failed:", err);
      setSaveErr(
        `Your results could not be saved (${err?.code || "error"}). Check your connection and press Done again.`,
      );
      setOpenBlockIdx(bi); // bring the block back, with everything you typed still in it
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
    } else {
      setOpenBlockIdx(null);
    }
  };

  const touchStart = useRef(null);
  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return; // clientX can legitimately be 0
    const dx = e.changedTouches[0].clientX - touchStart.current;
    const ci = weekDates.indexOf(selectedDate);
    if (dx > 60 && ci > 0) setSelectedDate(weekDates[ci - 1]);
    else if (dx < -60 && ci < 6) setSelectedDate(weekDates[ci + 1]);
    touchStart.current = null;
  };

  // Calendar helpers
  const calDays = () => {
    const first = new Date(calMonth.year, calMonth.month, 1);
    const last = new Date(calMonth.year, calMonth.month + 1, 0);
    const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(d);
    return days;
  };
  const calDateStr = (d) => {
    if (!d) return null;
    return `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  const jumpToDate = (ds) => {
    setSelectedDate(ds);
    const newMonday = getMondayOfWeek(ds);
    const diff = Math.round(
      (new Date(newMonday + "T12:00:00") -
        new Date(todayMonday + "T12:00:00")) /
        (7 * 24 * 3600 * 1000),
    );
    setWeekOffset(diff);
  };

  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "780px" }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          className="muted small"
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: "4px",
          }}
        >
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
        <h1 style={{ fontSize: "3rem", lineHeight: 1, color: "#FF6B1A" }}>
          WORKOUT
          <br />
          OF THE DAY
        </h1>
        {period && (
          <p className="muted small mt-2">
            {period.name}
            {period.focus ? ` · ${period.focus}` : ""}
          </p>
        )}
      </div>

      {/* Week navigation + day strip */}
      <div style={{ marginBottom: "16px" }}>
        <div className="flex-between mb-2">
          <button
            className="wod-nav-btn"
            onClick={() => goToWeek(weekOffset - 1)}
          >
            ← Week
          </button>
          <span
            style={{ fontSize: "0.82rem", color: "#8a7a6a", fontWeight: 600 }}
          >
            {new Date(weekDates[0] + "T12:00:00").getDate()}{" "}
            {MONTHS[new Date(weekDates[0] + "T12:00:00").getMonth()].slice(
              0,
              3,
            )}{" "}
            – {new Date(weekDates[6] + "T12:00:00").getDate()}{" "}
            {MONTHS[new Date(weekDates[6] + "T12:00:00").getMonth()].slice(
              0,
              3,
            )}
          </span>
          <button
            className="wod-nav-btn"
            onClick={() => goToWeek(weekOffset + 1)}
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
            const dayCount = wodsForDate(date).length;
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
                  transition: "all 0.15s",
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
                  {Array.from({ length: Math.min(dayCount, 2) }).map((_, k) => (
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

      {/* Two sessions on the same day: pick which one to view */}
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

      {/* Member selector — above the WoD card, always visible without scrolling */}
      {wod && (
        <div className="card mb-4" style={{ padding: "12px 18px" }}>
          <div
            className="flex-between"
            style={{ flexWrap: "wrap", gap: "10px" }}
          >
            <label
              htmlFor="member-select"
              style={{
                fontSize: "0.75rem",
                color: "#8a7a6a",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: 0,
              }}
            >
              Who are you?
            </label>
            <div style={{ maxWidth: "220px", flex: "1 1 180px" }}>
              <select
                id="member-select"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                style={{ fontWeight: 600 }}
              >
                <option value="">Select your name…</option>
                {memberRoster.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* WoD card or empty state */}
      {wod ? (
        <div
          className="card mb-4"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex-between mb-3">
            <div>
              <span className="session-tag">Session #{wod.sessionNumber}</span>
              <h3 style={{ fontSize: "1.2rem", marginTop: "6px" }}>
                {wod.title || "WoD"}
              </h3>
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: selectedDate === today ? "#FF6B1A" : "#8a7a6a",
              }}
            >
              {selectedDate === today
                ? "● TODAY"
                : selectedDate > today
                  ? "Upcoming"
                  : "Past session"}
            </div>
          </div>
          {cr.error && (
            <div
              className="mb-3"
              style={{ color: "#ff7070", fontSize: "0.82rem" }}
            >
              Class results can't be loaded right now ({cr.error}). Please try
              again in a moment.
            </div>
          )}
          {wod.blocks.map((block, bi) => {
            const saved = isBlockSaved(block);
            const open = openBlockIdx === bi;
            return (
              <div
                key={bi}
                ref={(el) => {
                  blockRefs.current[bi] = el;
                }}
                style={{
                  marginBottom: bi < wod.blocks.length - 1 ? "24px" : 0,
                  paddingBottom: bi < wod.blocks.length - 1 ? "24px" : 0,
                  borderBottom:
                    bi < wod.blocks.length - 1
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

                {memberName && (
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
                          {describeFields(block).replace(
                            "Members log:",
                            "Log:",
                          )}
                        </p>
                        <ResultInputs
                          block={block}
                          idPrefix={`home_${wod.id}_${block.name}`}
                          getValue={(k) => valueFor(block, k)}
                          setValue={(k, val) =>
                            setDrafts((p) => ({
                              ...p,
                              [block.name]: {
                                ...(p[block.name] || {}),
                                [k]: val,
                              },
                            }))
                          }
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
                          style={{ justifyContent: "center" }}
                          onClick={() => handleBlockDone(bi)}
                        >
                          ✓ Done —{" "}
                          {bi < wod.blocks.length - 1
                            ? `Next: Block ${wod.blocks[bi + 1].name}`
                            : "Finish"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setOpenBlockIdx(bi)}
                      >
                        Log Results for Block {block.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {allBlocksSaved && (
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
                ✓ All results saved — great work, {memberName}!
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center mb-4" style={{ padding: "32px" }}>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🗓️</div>
          <p className="muted">
            No session planned for {formatDate(selectedDate)}
          </p>
          <p className="muted small mt-2">
            Use the arrows above to browse the week, or tap a date in the
            calendar below.
          </p>
        </div>
      )}

      {/* Class results table */}
      {wod && resultMems.length > 0 && (
        <div className="mb-6">
          <div className="section-header mb-3">
            <h4
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: "1rem",
                letterSpacing: "0.08em",
                color: "#8a7a6a",
              }}
            >
              CLASS RESULTS
            </h4>
            <div className="section-line" />
          </div>
          {wod.blocks.map((block, bi) => {
            const open = !!openClassResults[block.name];
            return (
              <div key={bi} className="card mb-3">
                <div
                  className="flex-between"
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleClassResults(block.name)}
                >
                  <div className="flex-center gap-2">
                    <div
                      className="block-badge"
                      style={{
                        background: BLOCK_COLORS[block.name] || "#FF6B1A",
                        color: "#fff",
                        width: "22px",
                        height: "22px",
                        fontSize: "0.78rem",
                      }}
                    >
                      {block.name}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      Block {block.name}
                    </span>
                  </div>
                  <span className="muted small">
                    {open ? "▲ Hide" : "▼ View"}
                  </span>
                </div>
                {open && (
                  <div style={{ marginTop: "12px" }}>
                    <ResultsTable
                      block={block}
                      members={resultMems}
                      unlisted={unlistedMems}
                      highlight={memberName}
                      emptyColor="#444"
                      getVal={(m, k) => cr.get(block.name, m, k)}
                      getAll={(m) => cr.getAll(block.name, m)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mini calendar */}
      <div className="card">
        <div className="flex-between mb-3">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() =>
              setCalMonth((m) => ({
                ...m,
                month: m.month === 0 ? 11 : m.month - 1,
                year: m.month === 0 ? m.year - 1 : m.year,
              }))
            }
          >
            ←
          </button>
          <h4
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: "1rem",
              letterSpacing: "0.06em",
            }}
          >
            {MONTHS[calMonth.month]} {calMonth.year}
          </h4>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() =>
              setCalMonth((m) => ({
                ...m,
                month: m.month === 11 ? 0 : m.month + 1,
                year: m.month === 11 ? m.year + 1 : m.year,
              }))
            }
          >
            →
          </button>
        </div>
        <div className="cal-grid mb-2">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: "0.7rem",
                color: "#8a7a6a",
                fontWeight: 700,
                padding: "4px 0",
              }}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="cal-grid">
          {calDays().map((d, i) => {
            const ds = calDateStr(d);
            const hasWod = ds ? allWorkouts.some((w) => w.date === ds) : false;
            const isTod = ds === today;
            const isSel = ds === selectedDate;
            return (
              <div
                key={i}
                className={`cal-day ${hasWod ? "has-wod" : ""} ${isTod ? "is-today" : ""} ${isSel && !isTod ? "is-selected" : ""} ${!d ? "other-month" : ""}`}
                onClick={() => {
                  if (d && ds) jumpToDate(ds);
                }}
              >
                {d && (
                  <>
                    <span>{d}</span>
                    {hasWod && <div className="cal-dot" />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
