import React, { useMemo, useState, memo } from "react";
import { resolveTheme } from "./theme";
import { ChartCard, ChartTooltip, Stat } from "./chrome";
import { useMeasuredBox } from "./useMeasuredBox";

/**
 * AreaTrendChart — single smooth gradient area with an emphasized endpoint dot.
 * Props: title, theme, controls, total, changePct, labels, values, accent.
 *
 * Interactions:
 *  - vertical crosshair + tooltip that follows the mouse, snapping to the
 *    nearest x and showing that point's value
 *  - "period" control re-buckets the series: Monthly (raw) / Quarterly
 *    (average of every 3 points)
 *  - detailed mode (expand modal) renders the value above every datapoint
 *
 * Sizing: when `size="fill"` (a bento/grid slot of unknown, variable aspect
 * ratio), the SVG viewBox is set to the container's REAL measured pixel size
 * every render, via useMeasuredBox. Previously this used a fixed 600x244
 * viewBox with the browser's default preserveAspectRatio="xMidYMid meet" —
 * fine at the one size it was designed for, but stretched into a taller
 * bento tile that fixed-ratio content gets letterboxed (centered, with dead
 * space above/below) instead of actually filling the tile. Matching the
 * viewBox to the real box every time means there is nothing to letterbox.
 * Fixed sizes ("xs".."xl", a designed, known pixel height via SIZES) keep
 * the original fixed viewBox — those aren't the bug and measuring there
 * would create a resize-feedback loop (box height depends on svg height
 * depends on viewBox depends on box height...).
 */
const FIXED_W = 600;
const FIXED_VBH = 244;
const FIXED_PT = 20;
const FIXED_PB = 230;
const FIXED_PL = 42;
const FIXED_PR = 8;

// Small FIXED PIXEL margins for the responsive ("fill") path — these do NOT
// scale with chart size the way viewBox-unit margins did, which is exactly
// what kept them proportionate at 244px tall and huge at 900px tall.
const MARGIN = { top: 28, right: 16, bottom: 34, left: 52 };

const fmtDefault = (v) => Number(v || 0).toLocaleString("en-US");
const smooth = (pts) => {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
};

/* re-bucket raw monthly series into the chosen period — a bucket with no
   real (non-null) months at all stays null rather than averaging to 0.
   Exported so ECharts-based panels (e.g. WhatsappManagement) can reuse the
   exact same period-toggle logic instead of duplicating it. */
export const bucketize = (labels, values, period) => {
  if (period !== "quarterly") return { labels, values };
  const labOut = [], valOut = [];
  for (let i = 0; i < values.length; i += 3) {
    const slice = values.slice(i, i + 3).filter((v) => v != null);
    valOut.push(slice.length ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length) : null);
    labOut.push(`Q${labOut.length + 1}`);
  }
  return { labels: labOut, values: valOut };
};

const AreaTrendChart = memo(
  ({
    title = "Active Users",
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    total = 24580,
    changePct = 12.4,
    valueLabel = "This month",
    labels = ["W1", "W2", "W3", "W4", "W5", "W6"],
    values = [120, 180, 150, 240, 210, 320],
    accent,
    formatValue,
    width = 520,
    size = "l",
    expandable = false,
    className = "",
    radius,
  }) => {
    const t = resolveTheme(theme, "dark");
    const color = accent || t.accent;
    const fmt = formatValue || fmtDefault;

    const [period, setPeriod] = useState("monthly");
    const [hover, setHover] = useState(null); // index of hovered datum

    const isFill = size === "fill";
    // Measures a STABLE outer box (never itself height-capped) — the plot
    // region below is then rendered at a fraction of that measurement. If
    // this ref were on the capped element instead, capping its height would
    // change what the observer reports, which would re-cap smaller next
    // render, cascading toward zero over a few frames.
    const [boxRef, box] = useMeasuredBox({ width: FIXED_W, height: FIXED_VBH });
    // Plot area reads as "too tall" once a fill chart is stretched to fill
    // its whole bento slot — cap it so there's always visible breathing
    // room below the plot, regardless of how tall the slot is.
    const PLOT_HEIGHT_RATIO = 0.6;
    const plotHeight = isFill ? Math.max(120, Math.round(box.height * PLOT_HEIGHT_RATIO)) : FIXED_VBH;

    // Fixed sizes keep the original designed viewBox; "fill" tracks the
    // real container so nothing ever gets letterboxed inside it.
    const W = isFill ? box.width : FIXED_W;
    const VBH = isFill ? plotHeight : FIXED_VBH;
    const PT = isFill ? MARGIN.top : FIXED_PT;
    const PB = isFill ? VBH - MARGIN.bottom : FIXED_PB;
    const PL = isFill ? MARGIN.left : FIXED_PL;
    const PR = isFill ? MARGIN.right : FIXED_PR;

    const { labels: lbls, values: vals } = useMemo(
      () => bucketize(labels, values, period),
      [labels, values, period]
    );

    const { line, area, pts, end, min: vmin, span } = useMemo(() => {
      const n = vals.length;
      const realVals = vals.filter((v) => v != null);
      const max = Math.max(...realVals, 1);
      const min = Math.min(...realVals, 0);
      const span = max - min || 1;
      const x = (i) => PL + (i * (W - PL - PR)) / Math.max(n - 1, 1);
      const y = (v) => PB - ((v - min) / span) * (PB - PT);
      // only the leading contiguous run of real values gets a line/area — a
      // gap (not a drop to zero) after the last populated month.
      let validCount = 0;
      while (validCount < n && vals[validCount] != null) validCount++;
      const pts = vals.slice(0, validCount).map((v, i) => [x(i), y(v)]);
      const line = smooth(pts);
      const area = pts.length > 1 ? `${line} L ${pts[pts.length - 1][0]} ${PB} L ${pts[0][0]} ${PB} Z` : "";
      return { line, area, pts, end: pts[pts.length - 1], min, span };
    }, [vals, W, VBH, PT, PB, PL, PR]);

    const xAt = (i) => PL + (i * (W - PL - PR)) / Math.max(vals.length - 1, 1);

    // map a mouse event to the nearest datapoint index. viewBox units equal
    // real CSS pixels when isFill (viewBox === measured box), so no rect-width
    // rescaling is needed there — kept for the fixed-size path where they differ.
    const handleMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = isFill ? e.clientX - rect.left : ((e.clientX - rect.left) / rect.width) * W;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const d = Math.abs(pts[i][0] - px);
        if (d < bestD) { bestD = d; best = i; }
      }
      setHover(best);
    };

    const periodOpts = [
      { label: "Monthly", value: "monthly" },
      { label: "Quarterly", value: "quarterly" },
    ];
    const allControls = controls ?? [
      { type: "period", options: periodOpts, value: period, onChange: setPeriod },
    ];

    const periodLabel = period === "quarterly" ? "Quarterly" : "Monthly";

    // summary stats + a full breakdown table for the expanded/detailed view —
    // same visual language as DualLineChart's detailed mode (gradient card,
    // colored top bar, avatar dot, 4-stat grid, striped table).
    const stats = useMemo(() => {
      const nums = vals.filter((v) => v != null && !isNaN(v));
      if (!nums.length) return { total: 0, avg: 0, high: 0, low: 0 };
      const total = nums.reduce((s, v) => s + v, 0);
      return { total, avg: total / nums.length, high: Math.max(...nums), low: Math.min(...nums) };
    }, [vals]);

    const renderStats = () => (
      <div
        style={{
          position: "relative", overflow: "hidden", borderRadius: 16, marginTop: 20,
          border: `1px solid ${color}28`, padding: "18px 16px 16px",
          background: `linear-gradient(160deg, ${color}14, transparent 65%)`,
          boxShadow: "0 8px 24px -14px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span
            style={{
              width: 24, height: 24, borderRadius: "50%", background: color,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 12px -3px ${color}99`,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: t.text.primary }}>{valueLabel}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat theme={t} label="Total" value={fmt(stats.total)} />
          <Stat theme={t} label="Average" value={fmt(stats.avg)} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{fmt(stats.high)}</div>
            <div style={{ fontSize: 12, color: t.text.muted }}>Highest</div>
          </div>
          <Stat theme={t} label="Lowest" value={fmt(stats.low)} />
        </div>
      </div>
    );

    const renderTable = () => (
      <div
        style={{
          marginTop: 20, borderRadius: 16, border: `1px solid ${t.control.border}`,
          overflow: "hidden", boxShadow: "0 8px 24px -16px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: t.text.secondary, background: t.mode === "light" ? "#f1f5f9" : "rgba(255,255,255,0.05)" }}>
                <th style={{ padding: "10px 14px", fontWeight: 700 }}>{period === "quarterly" ? "Quarter" : "Month"}</th>
                <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />{valueLabel}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lbls.map((lb, i) => (
                <tr
                  key={lb}
                  style={{
                    borderTop: i === 0 ? "none" : `1px solid ${t.control.border}`,
                    background: i % 2 === 0 ? "transparent" : (t.mode === "light" ? "#f8fafc" : "rgba(255,255,255,0.02)"),
                    color: t.text.primary,
                  }}
                >
                  <td style={{ padding: "9px 14px", color: t.text.secondary, fontWeight: 600 }}>{lb}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600, opacity: vals[i] == null ? 0.4 : 1 }}>{vals[i] != null ? fmt(vals[i]) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <ChartCard
        theme={t}
        title={title}
        icon={icon}
        iconColor={iconColor}
        controls={allControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
        radius={radius}
        headline={{ label: `${valueLabel} · ${periodLabel}`, value: fmt(total), change: changePct }}
        floatingHeader
      >
        {({ detailed }) => {
          const h = hover != null && hover < pts.length ? hover : null;
          const hx = h != null ? pts[h][0] : null;
          const hy = h != null ? pts[h][1] : null;
          return (
            <div ref={isFill ? boxRef : null} style={{ position: "relative", width: "100%", height: isFill ? "100%" : undefined }}>
              <svg
                viewBox={`0 0 ${W} ${VBH}`}
                width="100%"
                height={isFill ? "100%" : undefined}
                preserveAspectRatio={isFill ? "none" : "xMidYMid meet"}
                role="img"
                aria-label={title}
              >
                <defs>
                  <linearGradient id="at-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Y-axis gridlines + labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                  const yv = PB - f * (PB - PT);
                  const val = vmin + f * span;
                  return (
                    <g key={`yt-${i}`}>
                      <line x1={PL} y1={yv} x2={W - PR} y2={yv} stroke={t.grid} strokeDasharray="4 5" strokeWidth="1" />
                      <text x={PL - 6} y={yv + 4} textAnchor="end" fontSize="11" fontWeight="500" fill={t.text.muted}>{fmt(val)}</text>
                    </g>
                  );
                })}
                <path d={area} fill="url(#at-fill)" />
                <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                {/* detailed: value above every point */}
                {detailed && pts.map((p, i) => (
                  <text key={`v${i}`} x={p[0]} y={p[1] - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill={t.text.secondary}>
                    {fmt(vals[i])}
                  </text>
                ))}

                {/* crosshair at the nearest x */}
                {h != null && (
                  <g pointerEvents="none">
                    <line x1={hx} y1={PT - 12} x2={hx} y2={PB} stroke={color} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
                    <circle cx={hx} cy={hy} r="9" fill={color} opacity="0.18" />
                    <circle cx={hx} cy={hy} r="5" fill={color} stroke={t.surface} strokeWidth="2.5" />
                  </g>
                )}

                {/* emphasized endpoint dot (hidden while hovering) — sits at
                    the last real datapoint, not at a zero-padded trailing month */}
                {h == null && end && (
                  <>
                    <circle cx={end[0]} cy={end[1]} r="9" fill={color} opacity="0.2" />
                    <circle cx={end[0]} cy={end[1]} r="5" fill={color} stroke={t.surface} strokeWidth="2.5" />
                  </>
                )}

                {/* Thin the axis so labels never collide. With a 30-day range
                    every label rendered on top of its neighbour and the axis
                    became an unreadable smear — show at most ~8, always
                    including the first and last so the range stays readable. */}
                {lbls.map((lb, i) => {
                  const step = Math.max(1, Math.ceil(lbls.length / 8));
                  const isEdge = i === 0 || i === lbls.length - 1;
                  if (!isEdge && i % step !== 0) return null;
                  // Drop a tick adjacent to the last one to avoid overlap.
                  if (!isEdge && lbls.length - 1 - i < step * 0.6) return null;
                  return (
                    <text
                      key={`${lb}-${i}`}
                      x={xAt(i)}
                      y={PB + 18}
                      textAnchor={i === 0 ? "start" : i === lbls.length - 1 ? "end" : "middle"}
                      fontSize="12"
                      fill={t.text.muted}
                    >
                      {lb}
                    </text>
                  );
                })}

                {/* transparent hover overlay drives the crosshair */}
                <rect
                  x="0" y="0" width={W} height={VBH} fill="transparent"
                  onMouseMove={handleMove}
                  onMouseLeave={() => setHover(null)}
                />
              </svg>

              <ChartTooltip
                theme={t}
                visible={h != null}
                left={hx != null ? `${(hx / W) * 100}%` : "50%"}
                top={hy != null ? `${(hy / VBH) * 100}%` : "40%"}
                title={h != null ? lbls[h] : ""}
                rows={h != null ? [{ label: valueLabel, value: fmt(vals[h]), color }] : []}
              />

              {detailed && renderStats()}
              {detailed && renderTable()}
            </div>
          );
        }}
      </ChartCard>
    );
  }
);

AreaTrendChart.displayName = "AreaTrendChart";
export default AreaTrendChart;
