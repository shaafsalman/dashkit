import { ChartCard, resolveTheme } from "../charts";
import { useMeasuredBox, MONO, compact, GRADIENTS } from "./_shared.jsx";

export function GradientStatCard({
  gradient = "emerald", label, value, caption, icon, pills = [], bars = [], formatBarValue,
  breakdown = [], formatBreakdownValue,
}) {
  // Simple, deliberately boring layout: the value always floats top-right,
  // full stop — no donut, no legend, no branch where the number's position
  // depends on which other props happen to be passed. A `pie`+donut variant
  // used to live here and kept producing overlap bugs (legend rows running
  // out under the ring, mismatched right-hand clearance) because the ring's
  // size, the value's position and the legend's width all had to be kept in
  // sync by hand. A year-over-year comparison is just two bars — `bars`
  // already does that, with visible labels, and can't develop that class of
  // bug because nothing on this card floats except the value.
  const [cardRef, card] = useMeasuredBox({ width: 320, height: 240 });
  const short = card.height < 250;
  const barMax = bars.reduce((m, b) => Math.max(m, Number(b.value) || 0), 1);
  const barFmt = formatBarValue || compact;
  const hasBreakdown = breakdown.length > 0;
  const breakdownFmt = formatBreakdownValue || compact;
  const breakdownTotal = breakdown.reduce((s, b) => s + (Number(b.value) || 0), 0);
  const pad = short ? 12 : 16;
  // A breakdown always floats the value top-right too — same reasoning as
  // `short`: one consistent place for the number, so a taller card that also
  // carries a breakdown doesn't fall back to a second, redundant giant value
  // sitting in the middle on top of the composition bar.
  const float = short || hasBreakdown;
  const bigFont = short ? 30 : 38;
  const rightGuard = float ? 84 : 0;

  return (
    <div
      ref={cardRef}
      style={{
        position: "relative",
        height: "100%",
        background: GRADIENTS[gradient] || gradient,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        color: "#fff",
        overflow: "hidden",
      }}
    >
      {float && (
        <div style={{ position: "absolute", top: pad - 2, right: pad, textAlign: "right" }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: rightGuard }}>
        {icon && <span style={{ display: "flex", opacity: 0.85 }}>{icon}</span>}
        <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.02em", opacity: 0.9 }}>{label}</span>
      </div>
      {caption && (
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6, paddingRight: rightGuard }}>
          {caption}
        </div>
      )}

      {!float && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ fontSize: bigFont, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 }}>{value}</div>
        </div>
      )}

      {/* Composition bar: what the headline number breaks down INTO (e.g.
          revenue split into net revenue vs. costs), not a second number to
          compare it against — a single segmented bar can't overlap or run
          out of room the way the earlier donut+legend / two-bar-comparison
          attempts did, and it actually says something the caption doesn't. */}
      {hasBreakdown && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
          <div style={{ display: "flex", height: 22, borderRadius: 4, overflow: "hidden" }}>
            {breakdown.map((b, i) => {
              const share = breakdownTotal ? (Number(b.value) || 0) / breakdownTotal * 100 : 0;
              return (
                <div
                  key={b.label}
                  title={`${b.label}: ${breakdownFmt(b.value)} (${share.toFixed(0)}%)`}
                  style={{
                    width: `${Math.max(share, 1.5)}%`,
                    background: b.color || (i === 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.32)"),
                    borderRight: i < breakdown.length - 1 ? "2px solid rgba(0,0,0,0.12)" : "none",
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {breakdown.map((b, i) => {
              const share = breakdownTotal ? (Number(b.value) || 0) / breakdownTotal * 100 : 0;
              return (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 9, height: 9, borderRadius: 2, flexShrink: 0,
                      background: b.color || (i === 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.32)"),
                    }}
                  />
                  <span style={{ fontSize: 12, opacity: 0.9 }}>{b.label}</span>
                  <span style={{ ...MONO, fontSize: 12.5, fontWeight: 700 }}>{breakdownFmt(b.value)}</span>
                  <span style={{ ...MONO, fontSize: 10.5, opacity: 0.7 }}>{share.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bars.length > 0 && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", gap: 10, marginTop: 12 }}>
          {bars.map((b, i) => {
            const v = Number(b.value) || 0;
            const h = 18 + (v / barMax) * 82;
            return (
              <div key={i} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                <span style={{ ...MONO, fontSize: 12.5, fontWeight: 700 }}>{barFmt(v)}</span>
                <div
                  title={`${b.label}: ${barFmt(v)}`}
                  style={{
                    width: "100%",
                    height: `${h}%`,
                    background: "rgba(255,255,255,0.9)",
                    opacity: 0.35 + (v / barMax) * 0.6,
                    borderRadius: "3px 3px 0 0",
                  }}
                />
                <span style={{ fontSize: 11, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {pills.length > 0 && (
        // No right-clearance here: pills sit at the bottom (marginTop: auto),
        // well clear of the donut/floating-number's vertical range up top —
        // reserving space for them was just cramping the pill row for
        // nothing.
        <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 10 }}>
          {pills.map((p) => (
            <div
              key={p.label}
              style={{
                flex: 1,
                minWidth: 0,
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.18)",
                padding: "6px 8px",
              }}
            >
              <div style={{ fontSize: 10.5, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.label}</div>
              <div style={{ ...MONO, fontSize: 16, fontWeight: 700, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── FLEET SNAPSHOT ─────────────────────────────────────────────────────────
 * Purpose-built fleet overview tile: aircraft count floating top-right, a
 * real monthly-utilisation bar chart in the middle (rounded gradient bars +
 * month labels), and lucide-iconed stat tiles at the bottom. Every number
 * maps to real data. */

export default GradientStatCard;
