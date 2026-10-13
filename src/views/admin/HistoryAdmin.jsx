import { useState } from "react";
import { BLOCK_COLORS } from "../../lib/constants";
import { todayStr, formatDate } from "../../lib/dates";
import { useClassResults } from "../../hooks/useClassResults";
import { ResultsTable } from "../../components/ResultsTable";

// ─── HISTORY ADMIN ─────────────────────────────────────────────────────────────
export function HistoryAdmin({ periods, getSessionMembers }) {
  const [selPeriod, setSelPeriod] = useState(periods[0]?.id);
  const [selWod, setSelWod] = useState(null);
  const today = todayStr();
  const period = periods.find((p) => p.id === selPeriod);
  const past = period
    ? [...period.workouts]
        .filter((w) => w.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const wod = past.find((w) => w.id === selWod);
  const cr = useClassResults(wod?.id);
  return (
    <div>
      <div className="period-list mb-4">
        {periods.map((p) => (
          <button
            key={p.id}
            className={`period-pill ${selPeriod === p.id ? "active" : ""}`}
            onClick={() => {
              setSelPeriod(p.id);
              setSelWod(null);
            }}
          >
            {p.name || "Unnamed"}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <div>
          <h4
            style={{
              fontSize: "0.88rem",
              color: "#8a7a6a",
              marginBottom: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Past Sessions
          </h4>
          {past.length === 0 && (
            <p className="muted small">No past sessions yet.</p>
          )}
          {past.map((w) => (
            <div
              key={w.id}
              className={`card mb-2 ${selWod === w.id ? "card-orange" : ""}`}
              style={{ cursor: "pointer", padding: "12px 16px" }}
              onClick={() => setSelWod(w.id)}
            >
              <div className="flex-between">
                <div>
                  <span className="session-tag" style={{ fontSize: "0.72rem" }}>
                    #{w.sessionNumber}
                  </span>
                  <span
                    style={{
                      marginLeft: "8px",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    {w.title || "WoD"}
                  </span>
                </div>
                <span className="muted small">{formatDate(w.date)}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          {wod ? (
            <div>
              <h4
                style={{
                  fontSize: "0.88rem",
                  color: "#8a7a6a",
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Session #{wod.sessionNumber} Results
              </h4>
              <p
                style={{
                  fontSize: "0.82rem",
                  marginBottom: "12px",
                  color: "#c8bfb0",
                }}
              >
                {formatDate(wod.date)}
              </p>
              {wod.blocks.map((block, bi) => {
                const listed = getSessionMembers(wod.id);
                const mems = [
                  ...listed,
                  ...cr.entryMembers().filter((m) => !listed.includes(m)),
                ];
                return (
                  <div key={bi} className="card mb-3">
                    <div className="flex-center gap-2 mb-2">
                      <div
                        className="block-badge"
                        style={{
                          background: BLOCK_COLORS[block.name] || "#FF6B1A",
                          color: "#fff",
                          width: "22px",
                          height: "22px",
                          fontSize: "0.8rem",
                        }}
                      >
                        {block.name}
                      </div>
                      <span style={{ fontWeight: 600 }}>
                        Block {block.name}
                      </span>
                    </div>
                    {mems.length === 0 ? (
                      <p className="muted small">No participants recorded.</p>
                    ) : (
                      <ResultsTable
                        block={block}
                        members={mems}
                        unlisted={mems.filter((m) => !listed.includes(m))}
                        emptyColor="#555"
                        getVal={(m, k) => cr.get(block.name, m, k)}
                        getAll={(m) => cr.getAll(block.name, m)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card text-center" style={{ padding: "40px" }}>
              <p className="muted">Select a session to view results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
