import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// One-time move of the old single-blob results (riggworkout/cf_results + cf_saved_results)
// into the per-session documents. Runs once, when an admin opens the app after the upgrade.
export async function migrateLegacyResults(validIds, onStart) {
  const markerRef = doc(db, "riggworkout", "cf_migration");
  const marker = await getDoc(markerRef);
  if (marker.exists() && marker.data().resultsMigrated)
    return { skipped: true, count: 0 };
  onStart && onStart();

  const [rSnap, sSnap] = await Promise.all([
    getDoc(doc(db, "riggworkout", "cf_results")),
    getDoc(doc(db, "riggworkout", "cf_saved_results")),
  ]);
  const legacyResults = rSnap.exists() ? rSnap.data().value || {} : {};
  const legacySaved = sSnap.exists() ? sSnap.data().value || {} : {};

  // legacy key = `${sessionId}_${block}_${member}` (the member name may itself contain "_")
  const split = (key) => {
    const i = key.indexOf("_");
    const j = key.indexOf("_", i + 1);
    return i < 0 || j < 0
      ? null
      : {
          wod: key.slice(0, i),
          block: key.slice(i + 1, j),
          member: key.slice(j + 1),
        };
  };
  const byWod = {};
  const bucket = (wod) =>
    (byWod[wod] = byWod[wod] || { results: {}, saved: {} });

  Object.entries(legacyResults).forEach(([key, vals]) => {
    const p = split(key);
    if (!p || !validIds.has(p.wod) || !vals || typeof vals !== "object") return;
    const clean = {};
    Object.entries(vals).forEach(([variable, value]) => {
      if (value !== "" && value != null) clean[variable] = String(value);
    });
    if (Object.keys(clean).length)
      bucket(p.wod).results[`${p.block}|${p.member}`] = clean;
  });
  Object.entries(legacySaved).forEach(([key, flag]) => {
    const p = split(key);
    if (!p || !flag || !validIds.has(p.wod)) return;
    bucket(p.wod).saved[`${p.block}|${p.member}`] = true;
  });

  let count = 0;
  for (const wod of Object.keys(byWod)) {
    const ref = doc(db, "classResults", wod);
    const existing = await getDoc(ref);
    const ex = existing.exists() ? existing.data() : {};
    const results = {};
    const saved = {};
    // never overwrite anything that has already been logged in the new storage
    Object.entries(byWod[wod].results).forEach(([k, v]) => {
      if (!(ex.results && ex.results[k])) results[k] = v;
    });
    Object.entries(byWod[wod].saved).forEach(([k, v]) => {
      if (!(ex.saved && ex.saved[k])) saved[k] = v;
    });
    if (Object.keys(results).length || Object.keys(saved).length) {
      await setDoc(
        ref,
        { results, saved, updatedAt: serverTimestamp() },
        { merge: true },
      );
      count++;
    }
  }
  await setDoc(
    markerRef,
    { resultsMigrated: true, migratedAt: serverTimestamp() },
    { merge: true },
  );
  return { skipped: false, count };
}
