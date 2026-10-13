import {
  SET_SHORT,
  blockSets,
  perSetVarsOf,
  singleVarsOf,
  entryKey,
  setNumbers,
  exerciseGroups,
} from "../lib/resultFields";

// Member side: the input fields for one block (per exercise and/or a row per set, as the coach asked for)
export function ResultInputs({ block, getValue, setValue, idPrefix }) {
  const sets = blockSets(block);
  const per = perSetVarsOf(block);
  const singles = singleVarsOf(block);
  const groups = exerciseGroups(block);
  const setNos = setNumbers(block);
  const id = (k) => `${idPrefix}_${k.replace(/\W+/g, "_")}`;
  const cols = `${sets > 1 ? "46px " : ""}repeat(${per.length}, minmax(0, 1fr))${sets > 1 ? " auto" : ""}`;
  const headStyle = {
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };
  // number keypad on phones for the one-value-per-box fields (time needs ":" so it keeps the normal keyboard)
  const keypad = {
    "Weight (kg)": "decimal",
    "Distance (m)": "decimal",
    Reps: "numeric",
  };
  const copyPrev = (exNo, sn) =>
    per.forEach((v) =>
      setValue(entryKey(v, sn, exNo), getValue(entryKey(v, sn - 1, exNo))),
    );
  return (
    <>
      {per.length > 0 &&
        groups.map((g) => (
          <div key={g.no} style={{ marginBottom: "16px" }}>
            {g.name && (
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.92rem",
                  marginBottom: "8px",
                }}
              >
                {g.name}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              {sets > 1 && <span />}
              {per.map((v) => (
                <span key={v} className="muted" style={headStyle}>
                  {v}
                </span>
              ))}
              {sets > 1 && <span />}
            </div>
            {setNos.map((sn) => (
              <div
                key={sn}
                style={{
                  display: "grid",
                  gridTemplateColumns: cols,
                  gap: "8px",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                {sets > 1 && (
                  <span className="muted small" style={{ fontWeight: 700 }}>
                    Set {sn}
                  </span>
                )}
                {per.map((v) => {
                  const k = entryKey(v, sn, g.no);
                  return (
                    <input
                      key={v}
                      id={id(k)}
                      style={{ padding: "8px" }}
                      value={getValue(k)}
                      placeholder={SET_SHORT[v]}
                      inputMode={keypad[v]}
                      autoComplete="off"
                      aria-label={`${g.name ? g.name + ", " : ""}${v}${sn ? `, set ${sn}` : ""}`}
                      onChange={(e) => setValue(k, e.target.value)}
                    />
                  );
                })}
                {sets > 1 &&
                  (sn > 1 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{ padding: "6px 8px", whiteSpace: "nowrap" }}
                      title={`Same as set ${sn - 1}`}
                      aria-label={`Copy set ${sn - 1} to set ${sn}${g.name ? ` for ${g.name}` : ""}`}
                      onClick={() => copyPrev(g.no, sn)}
                    >
                      ↑ same
                    </button>
                  ) : (
                    <span />
                  ))}
              </div>
            ))}
          </div>
        ))}
      {singles.length > 0 && (
        <div className="grid-2">
          {singles.map((v) => (
            <div key={v}>
              <label htmlFor={id(v)}>{v}</label>
              <input
                id={id(v)}
                value={getValue(v)}
                onChange={(e) => setValue(v, e.target.value)}
                placeholder={`Enter ${v.toLowerCase()}`}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
