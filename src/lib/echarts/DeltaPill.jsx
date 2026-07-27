import React from "react";
import { bento, MONO_FONT } from "./theme";

/** Small +/- pill. Green positive, rose negative, tiny triangle glyph. */
export default function DeltaPill({ value, suffix = "%", precision = 1 }) {
  if (value == null || Number.isNaN(value)) return null;
  const up = value >= 0;
  const color = up ? bento.positive : bento.negative;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 999,
        background: `${color}1f`,
        color,
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: 8, lineHeight: 1 }}>{up ? "▲" : "▼"}</span>
      {up ? "+" : ""}{Number(value).toFixed(precision)}{suffix}
    </span>
  );
}
