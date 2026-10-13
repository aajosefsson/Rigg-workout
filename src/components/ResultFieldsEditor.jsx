import { RESULT_VARS } from "../lib/constants";
import { PER_SET_ORDER, blockSets, describeFields } from "../lib/resultFields";


// Coach side: which fields to ask for, per set and/or per exercise
export function ResultFieldsEditor({ block, onChange, hasResults }) {
  const vars = block.variables || [];
  const sets = blockSets(block);
  const exercises = Array.isArray(block.exercises) ? block.exercises : [];
  const canDetail = PER_SET_ORDER.some((v) => vars.includes(v));
  const toggle = (v) =>
    onChange({
      variables: vars.includes(v) ? vars.filter((x) => x !== v) : [...vars, v],
    });
  const hasNumbered = /^\s*\d+\s*[.)]\s*\S/m.test(block.description || "");
  const fromDescription = () => {
    const names = String(block.description || "")
      .split("\n")
      .map((l) => l.trim().match(/^\d+\s*[.)]\s*(.+)$/))
      .filter(Boolean)
      .map((m) => m[1].replace(/^\d+\s*(reps?|x)\s+/i, "").trim())
      .filter(Boolean)
      .slice(0, 6);
    if (names.length) onChange({ exercises: names });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {RESULT_VARS.map((v) => (
          <label key={v} className="check-var">
            <input
              type="checkbox"
              checked={vars.includes(v)}
              onChange={() => toggle(v)}
            />
            {v}
          </label>
        ))}
      </div>
      {canDetail && (
        <>
          <div
            className="flex gap-2 mt-2"
            style={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <span className="muted small">Log per set:</span>
            <select
              aria-label="Log per set"
              value={sets}
              onChange={(e) => onChange({ sets: Number(e.target.value) })}
              style={{ width: "auto", padding: "4px 8px" }}
            >
              <option value={1}>Off</option>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} sets
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <div className="muted small" style={{ marginBottom: "6px" }}>
              Log each exercise separately (optional):
            </div>
            {exercises.map((name, i) => (
              <div
                key={i}
                className="flex gap-2 mb-2"
                style={{ alignItems: "center" }}
              >
                <span
                  className="muted small"
                  style={{ width: "18px", flexShrink: 0 }}
                >
                  {i + 1}.
                </span>
                <input
                  aria-label={`Exercise ${i + 1}`}
                  value={name}
                  placeholder="Exercise name"
                  onChange={(e) =>
                    onChange({
                      exercises: exercises.map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="btn btn-danger btn-xs"
                  aria-label={`Remove exercise ${i + 1}`}
                  onClick={() =>
                    onChange({ exercises: exercises.filter((_, j) => j !== i) })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              {exercises.length < 6 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => onChange({ exercises: [...exercises, ""] })}
                >
                  + Add exercise
                </button>
              )}
              {hasNumbered && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={fromDescription}
                >
                  Use the numbered lines above
                </button>
              )}
            </div>
          </div>
        </>
      )}
      <p className="muted small mt-2">{describeFields(block)}</p>
      {hasResults && (
        <p className="small mt-2" style={{ color: "#ff9c9c" }}>
          Results are already logged for this block. Changing the setup won't
          delete them, but they'll show as "earlier setup".
        </p>
      )}
    </div>
  );
}
