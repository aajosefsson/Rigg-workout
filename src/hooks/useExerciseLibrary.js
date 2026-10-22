import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { videoLookup } from "../lib/exercises";

// exercises/{id} = { name, videoUrl, updatedAt }. Public to read (Home needs it), admin-only to write.
export function useExerciseLibrary() {
  const [list, setList] = useState([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "exercises"),
      (snap) => {
        setList(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name), "sv")),
        );
        setError(false);
      },
      () => setError(true),
    );
    return unsub;
  }, []);
  const videoFor = useMemo(() => videoLookup(list), [list]);
  return { list, error, videoFor };
}
