export function SectionTitle({ children }) {
  return (
    <div className="section-header mb-3">
      <h4
        style={{
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: "1rem",
          letterSpacing: "0.08em",
          color: "#8a7a6a",
        }}
      >
        {children}
      </h4>
      <div className="section-line" />
    </div>
  );
}
