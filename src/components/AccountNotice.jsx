export function AccountNotice({ email, error, onLogout }) {
  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}
    >
      <div className="card text-center" style={{ padding: "32px" }}>
        <h2
          style={{ fontSize: "1.5rem", color: "#FF6B1A", marginBottom: "8px" }}
        >
          ACCOUNT NOT SET UP
        </h2>
        <p className="muted small">
          You're signed in{email ? ` as ${email}` : ""}, but this account isn't
          linked to an organization yet. Ask your admin for an invite.
        </p>
        {error && (
          <p
            style={{ color: "#ff7070", fontSize: "0.82rem", marginTop: "10px" }}
          >
            {error}
          </p>
        )}
        <button className="btn btn-ghost mt-4" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
