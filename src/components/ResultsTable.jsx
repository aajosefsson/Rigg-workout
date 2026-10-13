import { resultColumns, orphanEntries } from "../lib/resultFields";

// Read-only table of everyone's results for one block
export function ResultsTable({
  block,
  members,
  getVal,
  getAll,
  highlight,
  emptyColor,
  unlisted = [],
}) {
  const cols = resultColumns(block);
  const orphanText = (m) =>
    orphanEntries(block, getAll ? getAll(m) : null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
  const showOrphans = members.some((m) => orphanText(m));
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="results-table">
        <thead>
          <tr>
            <th>Member</th>
            {cols.map((c, i) => (
              <th key={i}>{c.label}</th>
            ))}
            {showOrphans && <th>Earlier setup</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const get = (k) => getVal(m, k);
            return (
              <tr key={m}>
                <td
                  style={{
                    fontWeight: 600,
                    fontSize: "0.87rem",
                    color: m === highlight ? "#FF6B1A" : undefined,
                  }}
                >
                  {m}
                  {m === highlight ? " ★" : ""}
                  {unlisted.includes(m) && (
                    <span
                      className="muted"
                      style={{ fontWeight: 400, fontSize: "0.72rem" }}
                    >
                      {" "}
                      · not on the list
                    </span>
                  )}
                </td>
                {cols.map((c, i) => {
                  const t = c.cell(get);
                  return (
                    <td
                      key={i}
                      style={{
                        color: t ? undefined : emptyColor,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {t || "—"}
                    </td>
                  );
                })}
                {showOrphans && (
                  <td
                    style={{
                      whiteSpace: "pre-line",
                      fontSize: "0.8rem",
                      color: "#c8bfb0",
                    }}
                  >
                    {orphanText(m) || "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
