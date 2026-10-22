import { useState } from "react";
import { ClassProgress } from "../../components/ClassProgress";

// ─── MEMBERS ADMIN ─────────────────────────────────────────────────────────────
export function MembersAdmin({ memberRoster, editMemberRoster, allWorkouts }) {
  const [progressFor, setProgressFor] = useState(null);
  const [newName, setNewName] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [confirmRename, setConfirmRename] = useState(null); // {from, to}
  const [search, setSearch] = useState("");

  const addMember = () => {
    const n = newName.trim();
    if (!n || memberRoster.includes(n) || memberRoster.length >= 30) return;
    editMemberRoster([...memberRoster, n]);
    setNewName("");
  };

  const deleteMember = (name) => {
    if (confirmDel === name) {
      editMemberRoster(memberRoster.filter((n) => n !== name));
      setConfirmDel(null);
    } else {
      setConfirmDel(name);
      setEditingName(null);
      setConfirmRename(null);
    }
  };

  const startEdit = (name) => {
    setEditingName(name);
    setEditValue(name);
    setConfirmDel(null);
    setConfirmRename(null);
  };

  // A rename is confirmed first: logged results and attendance stay under the old name
  const saveEdit = (originalName) => {
    const trimmed = editValue.trim();
    setEditingName(null);
    if (!trimmed || trimmed === originalName) return;
    // don't allow duplicate names (ignore the one being edited)
    if (memberRoster.some((n) => n === trimmed && n !== originalName)) return;
    setConfirmRename({ from: originalName, to: trimmed });
  };
  const applyRename = () => {
    const { from, to } = confirmRename;
    editMemberRoster(memberRoster.map((n) => (n === from ? to : n)));
    setConfirmRename(null);
  };

  const filteredRoster = memberRoster.filter((n) =>
    n.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h3 style={{ fontSize: "1.1rem" }}>Member Roster</h3>
          <p className="muted small mt-1">
            {memberRoster.length}/30 members · Max 16 per class session
          </p>
        </div>
      </div>

      {/* Add member */}
      {memberRoster.length < 30 ? (
        <div className="card mb-4" style={{ padding: "16px 20px" }}>
          <label>Add New Member</label>
          <div className="flex gap-3 mt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter full name…"
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              style={{ maxWidth: "300px" }}
            />
            <button className="btn btn-primary btn-sm" onClick={addMember}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <div className="card mb-4 card-orange" style={{ padding: "12px 16px" }}>
          <p style={{ fontSize: "0.85rem", color: "#FF9A4D" }}>
            Maximum of 30 members reached.
          </p>
        </div>
      )}

      {/* Search */}
      {memberRoster.length > 0 && (
        <div className="mb-3" style={{ maxWidth: "300px" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search members…"
          />
        </div>
      )}

      {/* Roster grid */}
      {filteredRoster.length === 0 && memberRoster.length > 0 ? (
        <p className="muted small">No members match "{search}".</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            gap: "8px",
          }}
        >
          {filteredRoster.map((name, i) => (
            <div
              key={name}
              className="card"
              style={{
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div
                className="flex-center gap-2"
                style={{ flex: 1, minWidth: 0 }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "rgba(255,107,26,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#FF6B1A",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                {editingName === name ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(name);
                      if (e.key === "Escape") setEditingName(null);
                    }}
                    autoFocus
                    style={{ padding: "3px 8px", fontSize: "0.88rem", flex: 1 }}
                  />
                ) : (
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
                )}
              </div>

              <div className="flex gap-1" style={{ flexShrink: 0 }}>
                {editingName === name ? (
                  <>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => saveEdit(name)}
                    >
                      ✓
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setEditingName(null)}
                    >
                      ✕
                    </button>
                  </>
                ) : confirmRename?.from === name ? (
                  <>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={applyRename}
                    >
                      Rename
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setConfirmRename(null)}
                    >
                      No
                    </button>
                  </>
                ) : confirmDel === name ? (
                  <>
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => deleteMember(name)}
                    >
                      Delete
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setConfirmDel(null)}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setProgressFor(name)}
                      title={`Progress for ${name}`}
                    >
                      Progress
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => startEdit(name)}
                      style={{ color: "#c8bfb0" }}
                    >
                      ✎
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => deleteMember(name)}
                      style={{ color: "#ff7070" }}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
              {(confirmRename?.from === name || confirmDel === name) && (
                <p
                  className="small"
                  style={{ flexBasis: "100%", color: "#ff9c9c", margin: 0 }}
                >
                  {confirmRename?.from === name
                    ? `Rename to "${confirmRename.to}"? Earlier results and attendance stay under "${name}".`
                    : `Remove ${name} from the roster? Earlier results and attendance stay under this name.`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {progressFor && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setProgressFor(null)}
        >
          <div className="modal-inner">
            <div className="modal-header flex-between">
              <h3 style={{ color: "#FF6B1A" }}>Progress · {progressFor}</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setProgressFor(null)}
              >
                Close
              </button>
            </div>
            <div className="modal-body">
              <ClassProgress
                key={progressFor}
                member={progressFor}
                allWorkouts={allWorkouts}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
