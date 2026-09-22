import { useState, useMemo } from "react";
import {
  AXIS_GRID_PROPS,
  AXIS_VALUE_TICK,
  ChartCard,
  resolveTheme,
} from "../charts";
import { useMeasuredBox, MORD, MONO, shortMonth, compact, Empty, spline } from "./_shared.jsx";

/* ── TREND BARCODE ───────────────────────────────────────────────────────────
 * A smooth monthly curve over vertical strips, split into three states: earlier
 * months faded, the latest quarter solid, months with no data yet greyed out.
 * ────────────────────────────────────────────────────────────────────────── */
export function TrendBarcodeCard({
  theme, title, icon, iconColor, months = [],
  headlineValue, headlineLabel, stats = [], formatValue,
  currentWindow = 3,
}) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || "#F59E0B";
  const fmt = formatValue || compact;
  const [hover, setHover] = useState(null);
  const [boxRef, box] = useMeasuredBox({ width: 700, height: 190 });

  const data = useMemo(() => {
    const byMonth = {};
    (months || []).forEach((m) => {
      byMonth[shortMonth(m.month || m.name)] = Number(m.value) || 0;
    });
    const series = MORD.map((label) => ({ label, value: byMonth[label] ?? null }));
    let last = -1;
    series.forEach((d, i) => { if (d.value != null && d.value > 0) last = i; });
    return { series, last, max: Math.max(1, ...series.map((d) => d.value || 0)) };
  }, [months]);

  const hasData = data.last >= 1;

  // Geometry in real pixels — the viewBox matches the measured box exactly, so
  // nothing is scaled and the marker dots stay circular.
  const W = Math.max(240, box.width);
  const H = Math.max(90, box.height);
  const plotLeft = 40;
  const plotRight = 6;
  const baseline = H - 4;
  const top = 18;
  const plotWidth = Math.max(1, W - plotLeft - plotRight);
  const xOf = (i) => plotLeft + (i * plotWidth) / 11;
  const yOf = (v) => baseline - ((v || 0) / data.max) * (baseline - top);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((fraction) => ({
    fraction,
    value: data.max * fraction,
    y: top + (1 - fraction) * (baseline - top),
  }));

  const pts = hasData
    ? data.series.map((d, i) => ({
        x: xOf(i),
        y: yOf(d.value != null && d.value > 0 ? d.value : data.series[data.last].value),
      }))
    : [];

  // ~13px between strips whatever the card width.
  const PER = Math.max(3, Math.min(8, Math.round(W / 11 / 13)));
  const samples = hasData ? spline(pts, PER) : [];
  const currentStart = Math.max(0, data.last - (currentWindow - 1));

  const stateOf = (seg) => (seg > data.last ? "future" : seg >= currentStart ? "current" : "past");

  const runs = useMemo(() => {
    const out = [];
    let cur = null;
    samples.forEach((s) => {
      const st = stateOf(s.seg);
      if (!cur || cur.state !== st) {
        if (cur) cur.pts.push(s); // overlap by one so runs join seamlessly
        cur = { state: st, pts: [s] };
        out.push(cur);
      } else cur.pts.push(s);
    });
    return out;
  }, [samples, data.last, currentStart]);

  const hoveredX = hasData && hover != null ? pts[hover]?.x : null;

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
      headline={
        headlineValue != null
          ? { value: headlineValue, legend: <span style={{ fontSize: 11.5, color: t.text.muted }}>{headlineLabel}</span> }
          : undefined
      }
    >
      {() => (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div ref={boxRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {!hasData ? (
              <Empty t={t} label="Not enough monthly data in range" />
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: "block" }} role="img" aria-label={title}>
                {yTicks.map((tick) => (
                  <g key={tick.fraction}>
                    <line
                      x1={plotLeft}
                      y1={tick.y}
                      x2={W - plotRight}
                      y2={tick.y}
                      stroke={t.grid}
                      strokeDasharray={AXIS_GRID_PROPS.strokeDasharray}
                    />
                    <text
                      x={plotLeft - 8}
                      y={tick.y + 3}
                      textAnchor="end"
                      {...AXIS_VALUE_TICK}
                      fill={t.text.muted}
                    >
                      {fmt(tick.value)}
                    </text>
                  </g>
                ))}

                {samples.map((s, i) => {
                  const st = stateOf(s.seg);
                  return (
                    <line
                      key={i}
                      x1={s.x} y1={baseline} x2={s.x} y2={s.y}
                      stroke={st === "future" ? t.grid : accent}
                      strokeWidth="4"
                      opacity={st === "future" ? 1 : st === "current" ? 1 : 0.32}
                    />
                  );
                })}

                {runs.map((r, i) => (
                  <polyline
                    key={i}
                    points={r.pts.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={r.state === "future" ? "#cbd5e1" : accent}
                    strokeWidth={r.state === "current" ? 3 : 2.2}
                    opacity={r.state === "past" ? 0.5 : 1}
                    strokeLinecap="round"
                  />
                ))}

                {[{ p: pts[currentStart], solid: false }, { p: pts[data.last], solid: true }].map((m, i) =>
                  m.p ? (
                    <circle key={i} cx={m.p.x} cy={m.p.y} r="5" fill={m.solid ? accent : "#ffffff"} stroke={accent} strokeWidth="2.5" />
                  ) : null
                )}

                {data.series.map((d, i) => (
                  <rect
                    key={d.label}
                    x={xOf(i) - plotWidth / 22} y="0" width={plotWidth / 11} height={H}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </svg>
            )}

            {/* Tooltip now tracks the hovered column's x position instead of
                sitting fixed in the top-left corner, and fades/lifts in
                rather than just appearing. Clamped inside the box so it
                can't run off either edge for the first/last months. */}
            {hasData && hover != null && data.series[hover].value != null && hoveredX != null && (
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: `${Math.min(Math.max(hoveredX, 46), W - 46)}px`,
                  transform: "translate(-50%, 0)",
                  background: "#fff",
                  border: `1px solid ${t.control.border}`,
                  borderRadius: 8,
                  boxShadow: "0 8px 20px -6px rgba(15,23,42,0.22)",
                  padding: "6px 11px",
                  pointerEvents: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  animation: "wm-tooltip-in .14s cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                <span style={{ ...MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: t.text.muted }}>
                  {data.series[hover].label.toUpperCase()}
                </span>
                <span style={{ ...MONO, fontSize: 15, fontWeight: 700, color: accent }}>
                  {fmt(data.series[hover].value)}
                </span>
              </div>
            )}
          </div>

          {hasData && (
            <div style={{ display: "flex", flexShrink: 0 }}>
              {data.series.map((d, i) => (
                <span
                  key={d.label}
                  style={{
                    ...MONO, flex: 1, textAlign: "center", fontSize: 8.5,
                    fontWeight: hover === i ? 700 : 400,
                    color: i > data.last ? t.text.muted : hover === i ? t.text.primary : t.text.secondary,
                  }}
                >
                  {d.label}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 18, paddingTop: 12, marginTop: 8, borderTop: `1px solid ${t.control.border}`, flexShrink: 0, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              {stats.map((s) => (
                <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {s.icon && <span style={{ color: t.text.muted, display: "flex" }}>{s.icon}</span>}
                  <span style={{ ...MONO, fontSize: 14.5, fontWeight: 700, color: t.text.primary }}>{s.value}</span>
                  <span style={{ fontSize: 11.5, color: t.text.muted }}>{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

/* ── FLIGHT CALENDAR ─────────────────────────────────────────────────────────
 * A real month grid, one cell per day, shaded by that day's flight count. Steps
 * month by month through whatever range the data covers.
 * ────────────────────────────────────────────────────────────────────────── */

export default TrendBarcodeCard;
