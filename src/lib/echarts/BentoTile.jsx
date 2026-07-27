import React from "react";
import { bento, FONT, MONO_FONT } from "./theme";

/**
 * The core bento surface. Everything on the dark mosaic sits inside one of these.
 * `span` is a tailwind-ish grid span descriptor applied via inline gridColumn /
 * gridRow so mixed 2x2 / 1x2 / 3x1 tiles compose predictably.
 */
export default function BentoTile({
  span = {},
  title,
  eyebrow,
  action,
  hero = false,
  className = "",
  bodyClassName = "",
  style = {},
  children,
}) {
  const { col = 1, row = 1 } = span;

  return (
    <div
      className={`bento-tile ${className}`}
      style={{
        gridColumn: `span ${col}`,
        gridRow: `span ${row}`,
        background: hero ? bento.surfaceHero : bento.surface,
        border: `1px solid ${bento.border}`,
        borderRadius: bento.radius,
        boxShadow: `${bento.innerHighlight}, ${bento.shadow}`,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        padding: 18,
        transition: "transform 320ms cubic-bezier(.34,1.4,.64,1), border-color 320ms ease",
        fontFamily: FONT,
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {(eyebrow || title || action) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            {eyebrow && (
              <div style={{ fontFamily: MONO_FONT, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: bento.text.muted }}>
                {eyebrow}
              </div>
            )}
            {title && (
              <div style={{ marginTop: eyebrow ? 4 : 0, fontSize: 13.5, fontWeight: 600, color: bento.text.primary, letterSpacing: "-0.01em" }}>
                {title}
              </div>
            )}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      <div className={bodyClassName} style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
