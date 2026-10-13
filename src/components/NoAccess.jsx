export function NoAccess() {
  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}
    >
      <div className="card text-center" style={{ padding: "32px" }}>
        <h2
          style={{ fontSize: "1.5rem", color: "#FF6B1A", marginBottom: "8px" }}
        >
          NO ACCESS
        </h2>
        <p className="muted small">
          Your role doesn't have access to this area.
        </p>
      </div>
    </div>
  );
}
