import { useState, useMemo } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { MONO, spline, GRADIENTS } from "./_shared.jsx";

/* ── PERCENT GRADIENT CARD ───────────────────────────────────────────────────
 * One big percentage on a warm gradient, with the month-by-month series drawn
 * as a fine barcode strip along the bottom so the number has context.
 * ────────────────────────────────────────────────────────────────────────── */
export function PercentGradientCard({
  gradient = "amber", label, percent, caption, months = [], formatTick,
}) {
  const pct = Number(percent) || 0;
  const fmt = formatTick || ((v) => `${Math.round(v)}%`);

  // One bar per real month (not spline-upsampled) so each bar is a hover
  // target with its own month name + value.
  const monthBars = useMemo(
    () =>
      (months || [])
        .map((m) => ({
          name: String(m.name || m.month || "").trim(),
          value: Number(m.value) || 0,
        }))
        .filter((m) => m.value > 0),
    [months]
  );
  const max = Math.max(1, ...monthBars.map((m) => m.value));
  const [hover, setHover] = useState(null);
  const active = hover != null && monthBars[hover] ? monthBars[hover] : null;

  return (
    <div
      style={{
        height: "100%",
        background: GRADIENTS[gradient] || gradient,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        color: "#fff",
        overflow: "hidden",
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.92 }}>{label}</span>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...MONO, fontSize: 10, opacity: 0.78, letterSpacing: "0.14em" }}>
          {active ? active.name.toUpperCase() : "AVERAGE"}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 2, marginTop: 4 }}>
          <span style={{ fontSize: 76, fontWeight: 300, lineHeight: 0.9, letterSpacing: "-0.04em" }}>
            {Math.round(active ? active.value : pct)}
          </span>
          <span style={{ fontSize: 22, fontWeight: 300, opacity: 0.8, marginTop: 6 }}>%</span>
        </div>
        {active ? (
          <div style={{ ...MONO, fontSize: 11.5, opacity: 0.85, marginTop: 10, letterSpacing: "0.1em" }}>
            {fmt(active.value)} · LOAD FACTOR
          </div>
        ) : caption ? (
          <div style={{ fontSize: 12.5, opacity: 0.82, textAlign: "center", maxWidth: 230, marginTop: 10, lineHeight: 1.45 }}>
            {caption}
          </div>
        ) : null}
      </div>

      {/* monthly barcode strip — bars carry their month names (visible before
          hover too); hover a bar to see that month's load factor.
          Bar height reads straight off the 0–100 percent scale the values
          already live on (these are load-factor percentages), rather than
          stretched relative to the max in the set — squeezing e.g. 72–85%
          into an 87–100% height range made every bar look the same height.
          The value label sits `bottom: h%` and translates up by its own
          height, so it always rests just above the real bar top instead of
          being pinned to a fixed position that floats free over short bars. */}
      {monthBars.length > 1 && (
        <div
          style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 56, flexShrink: 0 }}
          onMouseLeave={() => setHover(null)}
        >
          {monthBars.map((m, i) => {
            const lit = hover === i;
            const h = Math.max(10, Math.min(100, m.value));
            return (
              <div
                key={i}
                onMouseEnter={() => setHover(i)}
                title={`${m.name}: ${fmt(m.value)}`}
                style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
              >
                <div style={{ flex: 1, minHeight: 0, width: "100%", position: "relative" }}>
                  <div
                    style={{
                      position: "absolute", left: 0, right: 0, bottom: 0,
                      height: `${h}%`,
                      background: "#fff",
                      borderRadius: "3px 3px 0 0",
                      opacity: lit ? 1 : 0.32 + (m.value / max) * 0.5,
                      boxShadow: lit ? "0 0 12px rgba(255,255,255,0.5)" : "none",
                      transition: "opacity .15s ease, box-shadow .15s ease",
                    }}
                  />
                  <span
                    style={{
                      ...MONO, position: "absolute", left: 0, right: 0, textAlign: "center",
                      bottom: `${h}%`, transform: "translateY(-3px)",
                      fontSize: 9.5, fontWeight: lit ? 700 : 600, color: "#fff",
                      opacity: lit ? 1 : 0.9,
                    }}
                  >
                    {Math.round(m.value)}
                  </span>
                </div>
                <span style={{ ...MONO, fontSize: 7.5, letterSpacing: "0.02em", color: "#fff", opacity: lit ? 1 : 0.65, marginTop: 4, flexShrink: 0 }}>
                  {String(m.name).slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── STATION TABLE ───────────────────────────────────────────────────────────
 * Flights, revenue and on-time performance per departure station — the three
 * per-station series the API returns, finally on the same row.
 * ────────────────────────────────────────────────────────────────────────── */

export default PercentGradientCard;
