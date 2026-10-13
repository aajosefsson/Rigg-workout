export function DeactivatedNotice({ email, onLogout }) {
  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}
    >
      <div className="card text-center" style={{ padding: "32px" }}>
        <h2
          style={{ fontSize: "1.5rem", color: "#FF6B1A", marginBottom: "8px" }}
        >
          ACCOUNT DEACTIVATED
        </h2>
        <p className="muted small">
          The account{email ? ` ${email}` : ""} has been deactivated. If you
          think this is a mistake, contact your admin.
        </p>
        <button className="btn btn-ghost mt-4" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
