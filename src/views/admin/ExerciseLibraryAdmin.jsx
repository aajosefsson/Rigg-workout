import { useState } from "react";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { embedUrl, exerciseId, parseLibraryList } from "../../lib/exercises";

// ─── EXERCISE LIBRARY (admin): name + video link per exercise ──────────────────
export function ExerciseLibraryAdmin({ library }) {
  const { list, error } = library;
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [bulk, setBulk] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [search, setSearch] = useState("");

  const put = (n, url) =>
    setDoc(doc(db, "exercises", exerciseId(n)), {
      name: n.trim(),
      videoUrl: url.trim(),
      updatedAt: serverTimestamp(),
    });

  const addOne = async () => {
    const n = name.trim();
    if (!n || n.length > 80) return setMsg("Give the exercise a name (max 80 characters).");
    if (!embedUrl(link)) return setMsg("The link must be a Google Drive or YouTube link starting with https://.");
    setBusy(true);
    try {
      await put(n, link);
      setName("");
      setLink("");
      setMsg(`Saved "${n}".`);
    } catch {
      setMsg("Could not save. Check your connection and permissions.");
    }
    setBusy(false);
  };

  const parsed = parseLibraryList(bulk);
  const good = parsed.filter((p) => !p.error);
  const bad = parsed.filter((p) => p.error);
  const importAll = async () => {
    if (!good.length) return;
    setBusy(true);
    let failed = 0;
    for (const p of good) {
      try {
        await put(p.name, p.url);
      } catch {
        failed++;
      }
    }
    setBusy(false);
    if (failed) setMsg(`Imported ${good.length - failed} of ${good.length}. ${failed} failed, try again.`);
    else {
      setMsg(`Imported ${good.length} exercises.${bad.length ? ` ${bad.length} lines were skipped.` : ""}`);
      setBulk("");
    }
  };

  const remove = async (id) => {
    if (confirmDel !== id) return setConfirmDel(id);
    try {
      await deleteDoc(doc(db, "exercises", id));
      setConfirmDel(null);
    } catch {
      setMsg("Could not delete.");
    }
  };

  const shown = list.filter((e) => String(e.name).toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <h3 style={{ fontSize: "1.1rem" }}>Exercise library</h3>
      <p className="muted small mb-4">
        A video per exercise name. Clients see a ▶ button wherever the exercise is listed in a block
        ("Log each exercise separately"). Share each Drive video as "Anyone with the link".
      </p>
      {error && <p className="small mb-3" style={{ color: "#ff7070" }}>Could not load the library.</p>}

      <div className="card mb-4">
        <div className="muted small" style={{ fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>
          Add one
        </div>
        <div className="grid-2 mb-3">
          <input aria-label="Exercise name" placeholder="Exercise name" value={name} onChange={(e) => setName(e.target.value)} />
          <input aria-label="Video link" placeholder="https://drive.google.com/file/d/…" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={addOne}>
          Save
        </button>
      </div>

      <div className="card mb-4">
        <div className="muted small" style={{ fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>
          Paste many
        </div>
        <p className="muted small mb-3">One per line: Name | link. Importing a name that exists replaces its link.</p>
        <textarea
          aria-label="Exercises to import"
          rows={6}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder={"Marklyft | https://drive.google.com/file/d/…/view\nFront squat | https://drive.google.com/file/d/…/view"}
        />
        {parsed.length > 0 && (
          <p className="small mt-2" style={{ color: "#c8bfb0" }}>
            {good.length} ready to import{bad.length ? `, ${bad.length} with problems:` : "."}
          </p>
        )}
        {bad.map((p, i) => (
          <p key={i} className="small" style={{ color: "#ff9c9c", margin: "2px 0" }}>
            {p.name || "(no name)"}: {p.error}
          </p>
        ))}
        <button className="btn btn-primary btn-sm mt-2" disabled={busy || !good.length} onClick={importAll}>
          {busy ? "Importing…" : `Import ${good.length || ""}`}
        </button>
      </div>

      {msg && <p className="small mb-3" style={{ color: "#c8bfb0" }}>{msg}</p>}

      <div className="flex-between mb-3">
        <h4 style={{ fontSize: "0.95rem" }}>{list.length} exercises</h4>
        <input aria-label="Search exercises" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: "200px" }} />
      </div>
      {shown.map((e) => (
        <div key={e.id} className="card mb-2" style={{ padding: "10px 14px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ flex: "1 1 160px" }}>{e.name}</strong>
          <a href={e.videoUrl} target="_blank" rel="noreferrer" className="small" style={{ color: "#FF9A4D" }}>
            Open video
          </a>
          {confirmDel === e.id ? (
            <>
              <button className="btn btn-danger btn-xs" onClick={() => remove(e.id)}>Delete</button>
              <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDel(null)}>No</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-xs" style={{ color: "#ff7070" }} onClick={() => remove(e.id)}>✕</button>
          )}
        </div>
      ))}
    </div>
  );
}
