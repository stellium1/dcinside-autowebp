import type React from "react"

import { styles } from "./styles"

type ToggleRowProps = {
  label: string
  desc: string | null
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}

export function ToggleRow({
  label,
  desc,
  checked,
  disabled = false,
  onChange
}: ToggleRowProps) {
  const sliderStyle = {
    ...styles.toggleSliderBase,
    background:
      !disabled && checked ? "#667eea" : disabled ? "#3a3a3a" : "#4a4a4a",
    opacity: disabled ? 0.6 : 1,
    pointerEvents: disabled ? "none" : undefined
  } as React.CSSProperties

  const circleStyle = {
    ...styles.toggleCircleBase,
    transform: checked ? "translateX(24px)" : "translateX(0)",
    opacity: disabled ? 0.7 : 1
  } as React.CSSProperties

  return (
    <div style={{ ...styles.optionBox, opacity: disabled ? 0.85 : 1 }}>
      <div style={styles.left}>
        <label style={styles.toggleSwitch}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            style={{ opacity: 0, width: 0, height: 0 }}
            disabled={disabled}
          />
          <span style={sliderStyle}>
            <span style={circleStyle} />
          </span>
        </label>

        <div style={styles.labelGroup}>
          <span style={styles.toggleLabel}>{label}</span>
          {desc ? <span style={styles.toggleDesc}>{desc}</span> : null}
        </div>
      </div>
    </div>
  )
}
