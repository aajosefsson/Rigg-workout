import { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { blockSets, exercisesOf } from "../lib/resultFields";

// A shared library of sessions the staff can reuse.
// templates/{id} = { orgId, name, title, blocks, createdBy, createdByName, createdAt }
export function TemplateBar({ profile, authUser, getCurrent, onApply, allowApply }) {
  const orgId = profile.orgId,
    uid = authUser.uid;
  const [list, setList] = useState([]);
  const [loadErr, setLoadErr] = useState(false);
  const [picked, setPicked] = useState("");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "templates"), where("orgId", "==", orgId)),
      (snap) => {
        setList(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name), "sv")),
        );
        setLoadErr(false);
      },
      () => setLoadErr(true),
    );
    return unsub;
  }, [orgId]);

  const chosen = list.find((t) => t.id === picked);
  const canDelete = !!chosen && (profile.role === "admin" || chosen.createdBy === uid);

  const apply = () => {
    if (!chosen) return;
    onApply({
      title: chosen.title || "",
      blocks: (chosen.blocks || []).map((b) => ({
        ...b,
        variables: [...(b.variables || [])],
        exercises: [...(b.exercises || [])],
      })),
    });
    setNote(`Loaded "${chosen.name}". Review it, then Save.`);
  };

  const saveAs = async () => {
    const nm = name.trim();
    if (!nm) {
      setNote("Give the template a name.");
      return;
    }
    const cur = getCurrent();
    if (!cur.blocks.length || cur.blocks.some((b) => !String(b.description || "").trim())) {
      setNote("Every block needs a description before the session can be saved as a template.");
      return;
    }
    setBusy(true);
    try {
      await setDoc(doc(collection(db, "templates")), {
        orgId,
        name: nm,
        title: String(cur.title || "").trim(),
        blocks: cur.blocks.map((b) => ({
          name: b.name,
          description: b.description.trim(),
          variables: b.variables || [],
          sets: blockSets(b),
          exercises: exercisesOf(b),
        })),
        createdBy: uid,
        createdByName: profile.name || authUser.email,
        createdAt: serverTimestamp(),
      });
      setNaming(false);
      setName("");
      setNote(`Saved as template "${nm}".`);
    } catch {
      setNote("Could not save the template. Check your permissions and try again.");
    }
    setBusy(false);
  };

  const removeTemplate = async () => {
    if (!chosen) return;
    try {
      await deleteDoc(doc(db, "templates", chosen.id));
      setPicked("");
      setConfirmDel(false);
      setNote("Template deleted.");
    } catch {
      setNote("Could not delete the template.");
    }
  };

  return (
    <div className="card mb-3" style={{ padding: "12px 14px" }}>
      <div
        className="muted small"
        style={{ marginBottom: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}
      >
        Templates
      </div>
      {allowApply && (
        <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <select
            aria-label="Template"
            value={picked}
            onChange={(e) => {
              setPicked(e.target.value);
              setConfirmDel(false);
            }}
            style={{ width: "auto", minWidth: "180px", flex: "1 1 180px" }}
          >
            <option value="">
              {list.length ? "Start from a template…" : "No templates yet"}
            </option>
            {list.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-sm" disabled={!chosen} onClick={apply}>
            Use
          </button>
          {canDelete &&
            (confirmDel ? (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>
                  Keep
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={removeTemplate}>
                  Confirm delete
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirmDel(true)}>
                Delete template
              </button>
            ))}
        </div>
      )}
      {naming ? (
        <div className="flex gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <input
            aria-label="Template name"
            value={name}
            placeholder="Template name"
            onChange={(e) => setName(e.target.value)}
            style={{ flex: "1 1 180px" }}
          />
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveAs}>
            {busy ? "Saving…" : "Save template"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setNaming(false);
              setName("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setNaming(true);
            setName(String(getCurrent().title || ""));
            setNote("");
          }}
        >
          Save this session as a template
        </button>
      )}
      {loadErr && (
        <p className="small mt-2" style={{ color: "#ff7070" }}>
          Could not load the templates. Check your connection.
        </p>
      )}
      {note && (
        <p className="small mt-2" style={{ color: "#c8bfb0" }}>
          {note}
        </p>
      )}
    </div>
  );
}
