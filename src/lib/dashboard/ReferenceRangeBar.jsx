import { useEffect, useState } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { MONO, NEG } from "./_shared.jsx";

/* ── REFERENCE RANGE BAR ─────────────────────────────────────────────────────
 * Where one result sits against its normal range and critical limits, the way
 * lab systems draw it: a track, the normal band, the critical zones at either
 * end, a solid marker for this result and a hollow one for the previous result.
 * The marker travels from the previous value to this one on mount, so the
 * direction of change is the first thing the eye catches.
 * ────────────────────────────────────────────────────────────────────────── */

const defaultFormat = (v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function ReferenceRangeBar({
  theme,
  title,
  subtitle,
  icon,
  iconColor,
  label,
  value,
  previous,
  previousLabel = "Previous",
  range,
  critLow,
  critHigh,
  unit = "",
  formatValue = defaultFormat,
}) {
  const t = resolveTheme(theme, "light");
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const [lo, hi] = range;
  const span = hi - lo || 1;
  const hasPrev = previous != null && Number.isFinite(previous);
  const min = Math.min(critLow ?? lo - span * 0.5, value, hasPrev ? previous : value) - span * 0.12;
  const max = Math.max(critHigh ?? hi + span * 0.5, value, hasPrev ? previous : value) + span * 0.12;
  const pct = (v) => ((v - min) / (max - min)) * 100;

  const critical = (critLow != null && value <= critLow) || (critHigh != null && value >= critHigh);
  const status = critical ? "Critical" : value > hi ? "High" : value < lo ? "Low" : "Normal";
  const ink = critical ? NEG : t.text.primary;
  const band = `color-mix(in srgb, ${t.text.primary} 24%, transparent)`;
  const danger = `color-mix(in srgb, ${NEG} 24%, transparent)`;
  const motion = prefersReducedMotion() ? "none" : "left 700ms cubic-bezier(0.22, 1, 0.36, 1)";
  const delta = hasPrev ? value - previous : null;

  const ticks = [lo, hi, critLow, critHigh].filter((v) => v != null);
  // edge labels hang inward so they never poke past the card
  const anchor = (p) => (p < 6 ? "translateX(0)" : p > 94 ? "translateX(-100%)" : "translateX(-50%)");

  const swatch = (bg, round = 3) => <span style={{ width: 14, height: 8, borderRadius: round, background: bg, display: "inline-block" }} />;

  return (
    <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title ?? label} subtitle={subtitle} icon={icon} iconColor={iconColor}>
      {() => (
        <div
          role="img"
          aria-label={`${label ?? title ?? "Result"} ${formatValue(value)} ${unit}, ${status.toLowerCase()}; normal ${formatValue(lo)} to ${formatValue(hi)}${hasPrev ? `; ${previousLabel.toLowerCase()} ${formatValue(previous)}` : ""}`}
          style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16 }}
        >
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "6px 12px" }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: ink }}>{formatValue(value)}</span>
            {unit && <span style={{ ...MONO, fontSize: 13, color: t.text.muted }}>{unit}</span>}
            <span
              style={{
                alignSelf: "center", fontSize: 12, fontWeight: 700, lineHeight: "20px", padding: "0 8px", borderRadius: 6,
                color: critical ? "#fff" : t.text.primary,
                background: critical ? NEG : t.control.bg,
                border: `1px solid ${critical ? NEG : t.control.border}`,
              }}
            >
              {status}
            </span>
            {delta != null && (
              <span style={{ ...MONO, fontSize: 12, color: t.text.secondary }}>
                {delta > 0 ? "+" : delta < 0 ? "−" : "±"}{formatValue(Math.abs(delta))} vs {previousLabel.toLowerCase()}
              </span>
            )}
          </div>

          <div>
            <div style={{ position: "relative", height: 10, borderRadius: 5, background: t.track }}>
              {critLow != null && <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pct(critLow)}%`, background: danger, borderRadius: "5px 0 0 5px" }} />}
              {critHigh != null && <span style={{ position: "absolute", top: 0, bottom: 0, left: `${pct(critHigh)}%`, right: 0, background: danger, borderRadius: "0 5px 5px 0" }} />}
              <span style={{ position: "absolute", top: 0, bottom: 0, left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`, background: band }} />
              {hasPrev && (
                <span
                  title={`${previousLabel} ${formatValue(previous)}`}
                  style={{
                    position: "absolute", top: "50%", left: `${pct(previous)}%`, width: 11, height: 11, boxSizing: "border-box",
                    transform: "translate(-50%, -50%)", borderRadius: "50%", border: `2px solid ${t.text.secondary}`, background: t.surface,
                  }}
                />
              )}
              <span
                style={{
                  position: "absolute", top: "50%", width: 4, height: 20, borderRadius: 2, background: ink,
                  transform: "translate(-50%, -50%)",
                  left: `${settled || !hasPrev ? pct(value) : pct(previous)}%`,
                  transition: motion,
                }}
              />
            </div>
            <div style={{ position: "relative", height: 16, marginTop: 6 }}>
              {ticks.map((v) => (
                <span
                  key={v}
                  style={{
                    ...MONO, position: "absolute", left: `${pct(v)}%`, transform: anchor(pct(v)), whiteSpace: "nowrap",
                    fontSize: 11, color: v === critLow || v === critHigh ? NEG : t.text.muted,
                  }}
                >
                  {formatValue(v)}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 16px", fontSize: 11, color: t.text.muted }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{swatch(band)} Normal {formatValue(lo)}–{formatValue(hi)}</span>
            {(critLow != null || critHigh != null) && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{swatch(danger)} Critical</span>}
            {hasPrev && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 9, height: 9, boxSizing: "border-box", borderRadius: "50%", border: `2px solid ${t.text.secondary}` }} /> {previousLabel} {formatValue(previous)}
              </span>
            )}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export default ReferenceRangeBar;
