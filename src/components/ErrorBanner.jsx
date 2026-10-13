// Red banner at the top of a page (planning couldn't be loaded or saved)
export function ErrorBanner({ children }) {
  return (
    <div
      className="page"
      role="alert"
      style={{
        position: "relative",
        zIndex: 1,
        paddingTop: "12px",
        paddingBottom: 0,
        maxWidth: "900px",
      }}
    >
      <div
        className="card"
        style={{
          padding: "10px 16px",
          fontSize: "0.85rem",
          color: "#ff7070",
          borderColor: "rgba(220,50,50,0.35)",
          background: "rgba(220,50,50,0.08)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
