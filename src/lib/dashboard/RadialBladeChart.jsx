import { useState, useMemo } from "react";
import { Fuel } from "lucide-react";
import { ChartCard, resolveTheme } from "../charts";
import { MORD, MONO, NEG, polarPt, shortMonth, compact, Empty } from "./_shared.jsx";

/* ── RADIAL BLADE CHART ────────────────────────────────────────────────────────────────
 * Twelve blades, one per month, length = fuel burned per flight. Concentric
 * reference rings give the blades a scale to be read against, so the fan is
 * ordered rather than decorative.
 * ────────────────────────────────────────────────────────────────────────── */
export function RadialBladeChart({ theme, title = "Fuel Burn per Flight", icon, iconColor, months = [], unit = "L" }) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || "#F59E0B";
  const onBrand = String(t.text.primary).toLowerCase() === "#ffffff";
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    const byMonth = {};
    (months || []).forEach((m) => {
      const label = shortMonth(m.month || m.name);
      const flights = Number(m.flights) || 0;
      byMonth[label] = { label, perFlight: flights > 0 ? (Number(m.fuel) || 0) / flights : 0 };
    });
    const blades = MORD.map((label) => byMonth[label] || { label, perFlight: 0 });
    const live = blades.filter((b) => b.perFlight > 0);
    return {
      blades,
      max: Math.max(0.01, ...live.map((b) => b.perFlight)),
      avg: live.length ? live.reduce((s, b) => s + b.perFlight, 0) / live.length : 0,
      peak: live.length ? live.reduce((w, b) => (b.perFlight > w.perFlight ? b : w), live[0]) : null,
      any: live.length > 0,
    };
  }, [months]);

  if (!data.any) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No fuel uplift in range" />}
      </ChartCard>
    );
  }

  // The card cell is wider than it is tall, and a square viewBox with
  // preserveAspectRatio="meet" scales to the HEIGHT — so the spare width was
  // being thrown away. A wider viewBox costs the fan nothing (height still
  // sets the scale) and buys room for the month labels.
  const S_W = 500, S_H = 420, CX = S_W / 2, CY = S_H / 2;
  const R0 = 100, R1 = 176, SWEEP = 24, SKEW = 9;
  // Labels ride an ELLIPSE, not a circle: wide of the tips left/right where
  // there is spare width, but tight above/below where the viewBox is close.
  // Derived from the viewBox edges (minus a margin for the label's own text
  // box) rather than from R1, so a bigger label font can never clip the top
  // or bottom of the card no matter what radius the blades use.
  const LABEL_MARGIN = 22;
  const LRX = CX - LABEL_MARGIN;
  const LRY = CY - LABEL_MARGIN;
  const shown = hover != null && data.blades[hover].perFlight ? data.blades[hover] : null;
  // One reference ring only — the fleet average. Four concentric scale rings
  // read as a cage of borders around the blades.
  const avgR = R0 + (data.avg / data.max) * (R1 - R0);

  return (
    <ChartCard
      theme={t}
      size="fill"
      width="100%"
      expandable
      controls={[]}
      title={title}
      icon={icon}
      iconColor={iconColor}
      floatingHeader
      headline={{
        label: shown ? `${shown.label.toUpperCase()} · FUEL/FLIGHT` : "FUEL / FLIGHT",
        value: compact(shown ? shown.perFlight : data.avg),
        legend: <span style={{ ...MONO, fontSize: 10, letterSpacing: "0.06em", color: t.text.muted }}>{unit} per flight</span>,
      }}
    >
      {() => (
        <div style={{ height: "100%", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox={`0 0 ${S_W} ${S_H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }} role="img" aria-label="Fuel burn per flight by month">
            <defs>
              <linearGradient id="ff-hub" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={onBrand ? (t.series?.at(-1) || "#334155") : "#2E1065"} />
                <stop offset="100%" stopColor={onBrand ? (t.series?.at(-2) || "#64748B") : "#7C3AED"} />
              </linearGradient>
            </defs>
            {data.blades.map((b, i) => {
              const a0 = (i * 360) / 12 - SWEEP / 2;
              const a1 = a0 + SWEEP;
              const aMid = (a0 + a1) / 2 + SKEW / 2; // label follows the blade's own skew
              const has = b.perFlight > 0;
              const frac = has ? b.perFlight / data.max : 0;
              const rOut = R0 + (has ? Math.max(frac, 0.1) : 0.045) * (R1 - R0);
              const isPeak = data.peak && b.label === data.peak.label;
              const lit = hover === i;
              const bladeColor = onBrand
                ? (t.series[i % t.series.length] || "#cbd5e1")
                : isPeak ? NEG : accent;

              const [ix0, iy0] = polarPt(CX, CY, R0, a0);
              const [ix1, iy1] = polarPt(CX, CY, R0, a1);
              const [ox0, oy0] = polarPt(CX, CY, rOut, a0 + SKEW);
              const [ox1, oy1] = polarPt(CX, CY, rOut, a1 + SKEW);
              // Point on the label ellipse at angle aMid (polarPt assumes a
              // circle, so the x/y radii are applied separately here).
              const rad = ((aMid - 90) * Math.PI) / 180;
              const lx = CX + LRX * Math.cos(rad);
              const ly = CY + LRY * Math.sin(rad);
              // Anchor shifts from "start" to "end" past the horizontal
              // midline so labels on the left of the fan don't run back
              // over the blades themselves.
              const anchor = Math.cos(rad) > 0.15 ? "start" : Math.cos(rad) < -0.15 ? "end" : "middle";

              return (
                <g key={b.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <path
                    d={`M ${ix0},${iy0} A ${R0} ${R0} 0 0 1 ${ix1},${iy1} L ${ox1},${oy1} A ${rOut} ${rOut} 0 0 0 ${ox0},${oy0} Z`}
                    fill={!has ? t.grid : bladeColor}
                    opacity={!has ? 1 : lit ? 1 : onBrand ? 0.92 : isPeak ? 0.9 : 0.34 + frac * 0.4}
                    stroke={lit ? t.text.primary : "none"}
                    strokeWidth="1"
                  />
                  <text
                    x={lx} y={ly} textAnchor={anchor} dominantBaseline="central"
                    style={{ ...MONO, fontSize: lit || isPeak ? 28 : 22, fontWeight: lit || isPeak ? 700 : 600, fill: !has ? t.text.muted : onBrand ? t.text.primary : lit ? t.text.primary : isPeak ? NEG : t.text.secondary }}
                  >
                    {b.label}
                  </text>
                </g>
              );
            })}

            {/* average ring, drawn over the blades as the reference line */}
            <circle cx={CX} cy={CY} r={avgR} fill="none" stroke={t.text.secondary} strokeWidth="1.2" strokeDasharray="4 4" opacity="0.75" />

            {/* hub */}
            <circle cx={CX} cy={CY} r={R0 - 3} fill="url(#ff-hub)" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
            <text x={CX} y={CY - 2} textAnchor="middle" style={{ ...MONO, fontSize: 34, fontWeight: 700, fill: "#ffffff" }}>
              {compact(shown ? shown.perFlight : data.avg)}
            </text>
            <text x={CX} y={CY + 16} textAnchor="middle" style={{ ...MONO, fontSize: 13, letterSpacing: "0.08em", fill: "rgba(255,255,255,0.85)" }}>
              {shown ? shown.label.toUpperCase() : "AVERAGE"}
            </text>
          </svg>
        </div>
      )}
    </ChartCard>
  );
}

/* ── PERCENT GRADIENT CARD ───────────────────────────────────────────────────
 * One big percentage on a warm gradient, with the month-by-month series drawn
 * as a fine barcode strip along the bottom so the number has context.
 * ────────────────────────────────────────────────────────────────────────── */

export default RadialBladeChart;
