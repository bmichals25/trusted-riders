export default function MapLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading map"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 380,
        background: "#0B0F1A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#7B8BA5",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 2,
        textTransform: "uppercase",
      }}
    >
      Loading map…
    </div>
  );
}
