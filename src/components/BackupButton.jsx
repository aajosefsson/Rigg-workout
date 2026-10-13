import { useState } from "react";
import { downloadBackup } from "../lib/backup";

export function BackupButton({ orgId }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      await downloadBackup(orgId);
    } catch (e) {
      console.error("Backup failed:", e);
      setErr(
        `Could not create the backup (${e?.code || "error"}). Check your connection and try again.`,
      );
    }
    setBusy(false);
  };
  return (
    <div style={{ textAlign: "right" }}>
      <button
        className="btn btn-ghost btn-sm"
        disabled={busy}
        style={{ opacity: busy ? 0.6 : 1 }}
        onClick={run}
      >
        {busy ? "Preparing backup…" : "Download backup"}
      </button>
      {err && (
        <div
          style={{ color: "#ff7070", fontSize: "0.8rem", marginTop: "6px" }}
        >
          {err}
        </div>
      )}
    </div>
  );
}
