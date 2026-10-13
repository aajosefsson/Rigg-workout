import { useState } from "react";
import {
  BLOCK_COLORS,
  BLOCK_TEMPLATES,
  templatePatch,
} from "../../lib/constants";
import { cleanBlock, fieldList, fieldKeys } from "../../lib/resultFields";
import { useClassResults } from "../../hooks/useClassResults";
import { ResultFieldsEditor } from "../../components/ResultFieldsEditor";

// ─── WOD EDITOR ───────────────────────────────────────────────────────────────
export function WodEditor({
  wod,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  getSessionMembers,
  setSessionMembersForWod,
  memberRoster,
}) {
  const cr = useClassResults(wod.id);
  const [local, setLocal] = useState(wod);
  const members = getSessionMembers(wod.id);
  const resultMembers = [
    ...members,
    ...cr.entryMembers().filter((m) => !members.includes(m)),
  ];
  // Editing always starts from the saved session, so Cancel throws away unsaved changes
  const toggleEdit = () => {
    if (!isEditing) setLocal(wod);
    onEdit();
  };
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [confirmDel, setConfirmDel] = useState(false);
  const toggleBlockView = (name) =>
    setExpandedBlocks((p) => ({ ...p, [name]: !p[name] }));

  const addBlock = () => {
    const n = ["A", "B", "C", "D"],
      u = local.blocks.map((b) => b.name),
      next = n.find((x) => !u.includes(x));
    if (!next) return;
    setLocal((p) => ({
      ...p,
      blocks: [
        ...p.blocks,
        { name: next, description: "", variables: ["Rounds"] },
      ],
    }));
  };
  const removeBlock = (i) =>
    setLocal((p) => ({ ...p, blocks: p.blocks.filter((_, j) => j !== i) }));
  const updateBlock = (i, u) =>
    setLocal((p) => ({
      ...p,
      blocks: p.blocks.map((b, j) => (j === i ? { ...b, ...u } : b)),
    }));
  const toggleMember = (name) => {
    const cur = getSessionMembers(wod.id);
    if (cur.includes(name)) {
      setSessionMembersForWod(
        wod.id,
        cur.filter((n) => n !== name),
      );
    } else if (cur.length < 16) {
      setSessionMembersForWod(wod.id, [...cur, name]);
    }
  };

  return (
    <div className="card mb-4">
      <div
        className="flex-between mb-3"
        style={{ flexWrap: "wrap", gap: "8px" }}
      >
        <div className="flex-center gap-3" style={{ flexWrap: "wrap" }}>
          {isEditing ? (
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <div style={{ width: "110px" }}>
                <label style={{ marginBottom: "3px" }}>Session #</label>
                <input
                  type="number"
                  value={local.sessionNumber}
                  onChange={(e) =>
                    setLocal((p) => ({
                      ...p,
                      sessionNumber: Number(e.target.value),
                    }))
                  }
                  style={{ padding: "5px 8px", fontSize: "0.88rem" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "180px" }}>
                <label style={{ marginBottom: "3px" }}>WoD Title</label>
                <input
                  value={local.title}
                  onChange={(e) =>
                    setLocal((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="WoD Title"
                  style={{ padding: "5px 10px", fontSize: "0.9rem" }}
                />
              </div>
            </div>
          ) : (
            <>
              <span className="session-tag">Session #{wod.sessionNumber}</span>
              <h3 style={{ fontSize: "1.1rem" }}>
                {wod.title || "Untitled WoD"}
              </h3>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={toggleEdit}>
            {isEditing ? "Cancel" : "Edit"}
          </button>
          {isEditing && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                onSave({ ...local, blocks: local.blocks.map(cleanBlock) })
              }
            >
              Save
            </button>
          )}
          {confirmDel && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmDel(false)}
            >
              Keep
            </button>
          )}
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (!confirmDel) {
                setConfirmDel(true);
                return;
              }
              onDelete();
            }}
          >
            {confirmDel ? "Confirm delete" : "Delete"}
          </button>
        </div>
      </div>

      {isEditing ? (
        <>
          {local.blocks.map((block, idx) => (
            <div key={idx} className="card card-orange mb-3">
              <div className="flex-between mb-2">
                <div className="flex-center gap-2">
                  <div
                    className="block-badge"
                    style={{
                      background: BLOCK_COLORS[block.name] || "#FF6B1A",
                      color: "#fff",
                    }}
                  >
                    {block.name}
                  </div>
                  <span style={{ fontWeight: 600 }}>Block {block.name}</span>
                </div>
                <button
                  className="btn btn-danger btn-xs"
                  onClick={() => removeBlock(idx)}
                >
                  Remove
                </button>
              </div>
              <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                <span className="muted small" style={{ alignSelf: "center" }}>
                  Templates:
                </span>
                {Object.keys(BLOCK_TEMPLATES).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => updateBlock(idx, templatePatch(name))}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <textarea
                value={block.description}
                onChange={(e) =>
                  updateBlock(idx, { description: e.target.value })
                }
                placeholder="Describe the block…"
                style={{ marginBottom: "10px" }}
              />
              <div>
                <label>Result Variables</label>
                <ResultFieldsEditor
                  block={block}
                  onChange={(patch) => updateBlock(idx, patch)}
                  hasResults={cr.anyForBlock(block.name)}
                />
              </div>
            </div>
          ))}
          {local.blocks.length < 4 && (
            <button className="btn btn-ghost btn-sm mb-4" onClick={addBlock}>
              + Add Block
            </button>
          )}
        </>
      ) : (
        <div className="mb-4">
          {wod.blocks.map((block, idx) => {
            const resultsOpen = !!expandedBlocks[block.name];
            return (
              <div
                key={idx}
                style={{
                  marginBottom: "16px",
                  paddingLeft: "12px",
                  borderLeft: `3px solid ${BLOCK_COLORS[block.name] || "#FF6B1A"}`,
                }}
              >
                <div className="flex-center gap-2 mb-1">
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
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                    Block {block.name}
                  </span>
                </div>
                <pre
                  style={{
                    fontFamily: "'Barlow',sans-serif",
                    fontSize: "0.85rem",
                    color: "#c8bfb0",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {block.description}
                </pre>
                {resultMembers.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => toggleBlockView(block.name)}
                    >
                      {resultsOpen ? "▲ Hide Results" : "▼ View Results"}
                    </button>
                    {resultsOpen && (
                      <div style={{ marginTop: "10px", overflowX: "auto" }}>
                        <table className="results-table">
                          <thead>
                            <tr>
                              <th>Member</th>
                              {fieldList(block).map((f) => (
                                <th key={f.key}>{f.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {resultMembers.map((member) => (
                              <tr key={member}>
                                <td
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.87rem",
                                  }}
                                >
                                  {member}
                                  {!members.includes(member) && (
                                    <span
                                      className="muted"
                                      style={{
                                        fontWeight: 400,
                                        fontSize: "0.72rem",
                                      }}
                                    >
                                      {" "}
                                      · not on the list
                                    </span>
                                  )}
                                </td>
                                {fieldKeys(block).map((v) => (
                                  <td key={v}>
                                    <input
                                      key={cr.get(block.name, member, v)}
                                      defaultValue={cr.get(
                                        block.name,
                                        member,
                                        v,
                                      )}
                                      onBlur={(e) => {
                                        const nv = e.target.value;
                                        if (
                                          nv !== cr.get(block.name, member, v)
                                        )
                                          cr.setField(
                                            block.name,
                                            member,
                                            v,
                                            nv,
                                          ).catch(() => {});
                                      }}
                                      placeholder="—"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Participant management */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingTop: "16px",
          marginTop: "8px",
        }}
      >
        <h4
          style={{ fontSize: "0.9rem", marginBottom: "10px", color: "#FF6B1A" }}
        >
          Class Participants ({members.length}/16)
        </h4>
        <div className="flex flex-wrap gap-2 mb-4">
          {memberRoster.map((name) => (
            <button
              key={name}
              className={`member-pill ${members.includes(name) ? "active" : ""}`}
              onClick={() => toggleMember(name)}
              disabled={!members.includes(name) && members.length >= 16}
              style={
                !members.includes(name) && members.length >= 16
                  ? { opacity: 0.35, cursor: "not-allowed" }
                  : {}
              }
            >
              {members.includes(name) ? "✓ " : ""}
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
