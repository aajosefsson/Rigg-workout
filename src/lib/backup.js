import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { todayStr } from "./dates";

// ─── Backup (admin, read-only) ─────────────────────────────────────────────────
// Firestore Timestamps become ISO strings so the file is plain JSON
export const toPlain = (v) => {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(toPlain);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, toPlain(x)]),
    );
  return v;
};

// Only reads from the database, never writes
export async function downloadBackup(orgId) {
  const planningIds = ["cf_periods", "cf_session_members", "cf_member_roster"];
  const [planningSnaps, crSnap, cwSnap] = await Promise.all([
    Promise.all(planningIds.map((id) => getDoc(doc(db, "riggworkout", id)))),
    getDocs(collection(db, "classResults")),
    getDocs(
      query(collection(db, "clientWorkouts"), where("orgId", "==", orgId)),
    ),
  ]);
  const byId = (snap) =>
    Object.fromEntries(snap.docs.map((d) => [d.id, toPlain(d.data())]));
  const backup = {
    exportedAt: new Date().toISOString(),
    planning: Object.fromEntries(
      planningSnaps.map((s, i) => [
        planningIds[i],
        s.exists() ? toPlain(s.data()) : null,
      ]),
    ),
    classResults: byId(crSnap),
    clientWorkouts: byId(cwSnap),
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `rigg-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
