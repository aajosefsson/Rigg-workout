import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { entriesFromClassResults } from "../lib/progress";
import { ProgressPanel } from "./ProgressPanel";

// Progress for a member of the group classes: collects their results from every session
export function ClassProgress({ member, allWorkouts }) {
  const [docs, setDocs] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "classResults"));
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = d.data();
        });
        if (!cancelled) setDocs(map);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (failed)
    return (
      <p style={{ color: "#ff7070", fontSize: "0.85rem" }}>
        Could not load the results. Check your connection and try again.
      </p>
    );
  if (!docs) return <p className="muted small">Loading progress…</p>;
  return (
    <ProgressPanel entries={entriesFromClassResults(allWorkouts, docs, member)} />
  );
}
