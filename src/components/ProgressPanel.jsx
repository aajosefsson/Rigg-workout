import { useState } from "react";
import { LineChart } from "./LineChart";
import { METRICS, fmtSet, groupByExercise, shortDate, summarize } from "../lib/progress";

// entries: [{ date, name, sets, session }] from any source (a client's sessions or a class member's results)
export function ProgressPanel({ entries }) {
  const [sel, setSel] = useState("");
  const [metricSel, setMetricSel] = useState("");
  const list = groupByExercise(entries);

  if (!list.length) {
    return (
      <p className="muted small">
        No progress to show yet. It's built from results logged per exercise, so
        each exercise needs a name in the block setup ("Log each exercise
        separately") and results with weight or reps.
      </p>
    );
  }
  const g = list.find((x) => x.key === sel) || list[0];
  const available = Object.keys(METRICS).filter(
    (k) => summarize(g.items, k) !== null,
  );
  if (!available.length) {
    return <p className="muted small">No weight or reps logged for {g.name} yet.</p>;
  }
  const metric = available.includes(metricSel) ? metricSel : available[0];
  const M = METRICS[metric];
  const { pts, first, last, best, diff, pct } = summarize(g.items, metric);

  return (
    <div>
      <div className="grid-2 mb-3">
        <div>
          <label htmlFor="prog-ex">Exercise</label>
          <select id="prog-ex" value={g.key} onChange={(e) => setSel(e.target.value)}>
            {list.map((x) => (
              <option key={x.key} value={x.key}>
                {x.name} ({x.items.length})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="prog-metric">Show</label>
          <select
            id="prog-metric"
            value={metric}
            onChange={(e) => setMetricSel(e.target.value)}
          >
            {available.map((k) => (
              <option key={k} value={k}>
                {METRICS[k].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mb-3" style={{ flexWrap: "wrap" }}>
        <span className="small">
          <span className="muted">First</span> <strong>{first} {M.unit}</strong>
        </span>
        <span className="small">
          <span className="muted">Latest</span> <strong>{last} {M.unit}</strong>
        </span>
        <span className="small">
          <span className="muted">Best</span> <strong>{best} {M.unit}</strong>
        </span>
        {pts.length > 1 && (
          <span className="small" style={{ color: diff >= 0 ? "#7dde7d" : "#ff9c9c" }}>
            <strong>
              {diff > 0 ? "+" : ""}
              {diff} {M.unit}
              {pct !== null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}
            </strong>
          </span>
        )}
      </div>

      <LineChart points={pts} unit={M.unit} />
      {pts.length === 1 && (
        <p className="muted small mt-2">
          Only one session logged so far. A trend appears after the next one.
        </p>
      )}

      <div style={{ overflowX: "auto", marginTop: "14px" }}>
        <table className="results-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Session</th>
              <th>Sets</th>
              <th>{M.label}</th>
            </tr>
          </thead>
          <tbody>
            {[...pts].reverse().map((pt, i) => (
              <tr key={i}>
                <td>{shortDate(pt.date)}</td>
                <td>{pt.session}</td>
                <td>{pt.sets.map(fmtSet).join(" · ")}</td>
                <td style={{ fontWeight: 600 }}>
                  {pt.value} {M.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
