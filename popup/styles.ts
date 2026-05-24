import type React from "react"

export const styles: Record<string, React.CSSProperties> = {
  outer: {
    padding: 12,
    background: "#1a1a1a",
    color: "#fff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    minWidth: 512,
    maxWidth: 512,
    boxSizing: "border-box"
  },
  container: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 8,
    padding: 12,
    background: "#161616",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
  },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 6,
    objectFit: "cover",
    flexShrink: 0
  },
  title: { fontSize: 18, margin: 0, fontWeight: 600 },
  meta: { marginLeft: "auto", fontSize: 12, color: "#bdbdbd" },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  optionBox: {
    background: "#2a2a2a",
    borderRadius: 12,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  left: { display: "flex", alignItems: "center", gap: 12 },
  labelGroup: { display: "flex", flexDirection: "column" },
  toggleLabel: { fontSize: 14, color: "#e0e0e0" },
  toggleDesc: { fontSize: 12, color: "#bdbdbd", marginTop: 4 },
  toggleSwitch: {
    position: "relative",
    display: "inline-block",
    width: 48,
    height: 24,
    flexShrink: 0
  },
  toggleSliderBase: {
    position: "absolute",
    cursor: "pointer",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#4a4a4a",
    transition: "0.18s",
    borderRadius: 24,
    display: "flex",
    alignItems: "center",
    padding: "0 4px"
  },
  toggleCircleBase: {
    height: 18,
    width: 18,
    backgroundColor: "#ffffff",
    borderRadius: "50%",
    transition: "0.18s"
  },
  sliderInner: { width: "220px", maxWidth: "40%", minWidth: "120px" },
  rangeInput: {
    width: "100%",
    appearance: "none",
    height: 6,
    borderRadius: 4,
    background:
      "linear-gradient(to right, #667eea 0%, #764ba2 var(--q, 80%), #4a4a4a var(--q, 80%))",
    outline: "none"
  }
}
