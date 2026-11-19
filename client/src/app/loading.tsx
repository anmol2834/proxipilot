export default function Loading() {
  // Shown while a route segment loads. A small centered spinner (SVG, no JS/CSS dependencies)
  // instead of nothing, so a slow navigation never looks like a blank, broken page.
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
      }}
    >
      <svg width="36" height="36" viewBox="0 0 50 50" aria-hidden="true">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#3562f5"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="90 150"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 25 25"
            to="360 25 25"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
}
