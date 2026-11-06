import React, { useMemo, useState, memo, useId } from "react";
import { resolveTheme, lighten, contrastingText, seriesColor } from "./theme";
import { ChartCard, ChartTooltip, Legend } from "./chrome";

/**
 * HexHealthChart — "Account Health": central hexagon (overall) ringed by up to
 * five value-driven trapezoidal petals. Chrome/theme/controls via ChartCard.
 *
 * Theme-aware: the center hexagon + overall/petal label colors adapt to the
 * card theme (dark center on dark, light center on light). Hover any petal for
 * a metric/value tooltip; detailed mode (expand modal) renders bigger value
 * labels plus a per-metric data table. Sort + filter (legend) controls wired.
 */

const VBW = 360;
const VBH = 320;
const PALETTE = ["#6d5ae6", "#3aa0f4", "#4fd1b0", "#56e0a6", "#5b4fd6"];
// Petals sit on the hexagon's edges (edge normals at 90, 30, -30, ...). For a
// given metric count pick the edges that keep the flower balanced: mirrored
// about the vertical axis and centred on the hub.
const SLOTS_BY_COUNT = {
  1: [90],
  2: [90, -90],
  3: [90, -30, 210],
  4: [30, 150, 210, 330],
  5: [90, 30, -30, 210, 150],
  6: [90, 30, -30, -90, 210, 150],
};
const CX = 180;
const CY = 160;
const HEX_R = 52;
const BASE_LEN = 92;
const GAP = 5; // px gap between hub, petals and neighbouring petals
const TAN30 = Math.tan(Math.PI / 6);
const DEFAULT_THEME = { base: "dark", surface: "#0f1420", radius: 20, pad: 24 };

const DEFAULT_METRICS = [
  { label: "Adoption", value: 92 },
  { label: "Engagement", value: 88 },
  { label: "Retention", value: 85 },
  { label: "Support", value: 90 },
  { label: "Security", value: 90 },
];

const SORTS = [
  { label: "Original order", value: "none" },
  { label: "Value (high → low)", value: "desc" },
  { label: "Value (low → high)", value: "asc" },
];

const rad = (d) => (d * Math.PI) / 180;
const P = (r, d) => [CX + r * Math.cos(rad(d)), CY - r * Math.sin(rad(d))];
// point at distance `d` along the edge normal `phi`, shifted `w` along the edge
const E = (phi, d, w) => {
  const n = [Math.cos(rad(phi)), -Math.sin(rad(phi))];
  const tg = [-n[1], n[0]];
  return [CX + d * n[0] + w * tg[0], CY + d * n[1] + w * tg[1]];
};
const safeId = (v) => String(v).replace(/[^a-zA-Z0-9_-]/g, "_");

const HexHealthChart = memo(
  ({
    title = "Account Health",
    subtitle,
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    overall = 89,
    overallLabel = "Overall Health",
    metrics = DEFAULT_METRICS,
    suffix = "",
    width = 420,
    size = "m",
    className = "",
  }) => {
    const t = resolveTheme(theme || DEFAULT_THEME, "dark");

    const uid = useId().replace(/:/g, "");
    const [sort, setSort] = useState("none");
    const [hover, setHover] = useState(null); // hovered petal key
    const [off, setOff] = useState({}); // { [key]: true } => hidden

    // theme-aware center + label colors. Dark theme -> dark center (light text);
    // light theme -> light center (dark text), so the hub never clashes.
    const isLight = t.mode === "light";
    const onBrand = String(t.text.primary).toLowerCase() === "#ffffff";
    const hubFill = onBrand ? (t.series?.at(-1) || "#334155") : isLight ? "#ffffff" : "#0b0f18";
    const hubStroke = onBrand ? "rgba(255,255,255,0.5)" : isLight ? "rgba(15,23,42,0.12)" : "#1c2433";
    const hubValueFill = onBrand ? "#ffffff" : t.text.primary;
    const hubLabelFill = onBrand ? "#cbd5e1" : t.text.muted;

    const ordered = useMemo(() => {
      const arr = metrics.slice(0, 6);
      if (sort === "none") return arr;
      const a = arr.slice();
      a.sort((x, y) => (sort === "desc" ? y.value - x.value : x.value - y.value));
      return a;
    }, [metrics, sort]);

    const petals = useMemo(
      () =>
        ordered.map((m, i, all) => {
          const phi = SLOTS_BY_COUNT[all.length][i];
          const color = onBrand && !m.color ? t.series[i % t.series.length] : seriesColor(t, m.color, i, PALETTE[i % PALETTE.length]);
          // Trapezoid on the hex-ring: inner edge parallel to the hub's edge,
          // sides along the 60deg wedge so neighbours keep an even gap.
          const len = BASE_LEN * (0.55 + 0.45 * (Math.min(Math.max(m.value, 0), 100) / 100));
          const apothem = HEX_R * Math.cos(Math.PI / 6);
          const di = apothem + GAP;
          const dout = di + len;
          const side = GAP / 2 / Math.cos(Math.PI / 6);
          const wi = di * TAN30 - side;
          const wo = dout * TAN30 - side;
          const A = E(phi, di, -wi), B = E(phi, di, wi), C = E(phi, dout, wo), D = E(phi, dout, -wo);
          const L = E(phi, di + len * 0.5, 0);
          return {
            ...m,
            color,
            gid: `${uid}-hex-${i}-${safeId(m.label || i)}`,
            d: `M ${A} L ${B} L ${C} L ${D} Z`,
            lx: L[0],
            ly: L[1],
            key: m.label || i,
          };
        }),
      [ordered, onBrand, t.series, t.mono, t.customSeries, uid]
    );

    const hexPts = useMemo(
      () => [0, 60, 120, 180, 240, 300].map((d) => P(HEX_R, d).join(",")).join(" "),
      []
    );

    const toggle = (key) => setOff((o) => ({ ...o, [key]: !o[key] }));

    const chartControls =
      controls ?? [
        { type: "sort", options: SORTS, value: sort, onChange: (v) => setSort(v) },
        {
          type: "filter",
          items: petals.map((p) => ({
            key: p.key,
            label: p.label,
            color: p.color,
            active: !off[p.key],
          })),
          onToggle: toggle,
        },
      ];

    const renderChart = ({ detailed }) => {
      const hv = hover != null ? petals.find((p) => p.key === hover && !off[p.key]) : null;
      return (
        <div style={{ position: "relative" }}>
          <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${title}: ${overall}`}>
            <defs>
              {petals.map((p) => (
                <linearGradient key={`g-${p.key}`} id={p.gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lighten(p.color, 0.18)} />
                  <stop offset="100%" stopColor={p.color} />
                </linearGradient>
              ))}
            </defs>

            {petals.map((p) => {
              const hidden = off[p.key];
              const dim = hover != null && hover !== p.key;
              const petalLabelFill = contrastingText(p.color);
              return (
                <g
                  key={p.key}
                  style={{
                    cursor: "pointer",
                    opacity: hidden ? 0.12 : dim ? 0.45 : 1,
                    transform: hover === p.key ? "scale(1.03)" : "none",
                    transformOrigin: `${CX}px ${CY}px`,
                  }}
                  onMouseEnter={() => !hidden && setHover(p.key)}
                  onMouseMove={() => !hidden && setHover(p.key)}
                  onMouseLeave={() => setHover(null)}
                >
                  <path
                    d={p.d}
                    fill={`url(#${p.gid})`}
                    stroke={p.color}
                    strokeWidth="6"
                    strokeLinejoin="round"
                  />
                  <text
                    x={p.lx}
                    y={p.ly - 6}
                    textAnchor="middle"
                    fontSize={detailed ? "13" : "11"}
                    fontWeight="600"
                    fill={petalLabelFill}
                    opacity="0.92"
                  >
                    {p.label}
                  </text>
                  <text
                    x={p.lx}
                    y={p.ly + (detailed ? 13 : 11)}
                    textAnchor="middle"
                    fontSize={detailed ? "18" : "15"}
                    fontWeight="800"
                    fill={petalLabelFill}
                  >
                    {p.value}
                    {suffix}
                  </text>
                </g>
              );
            })}

            <polygon points={hexPts} fill={hubFill} stroke={hubStroke} strokeWidth="1.5" />
            <text
              x={CX}
              y={CY + 6}
              textAnchor="middle"
              fontSize={detailed ? "40" : "36"}
              fontWeight="800"
              fill={hubValueFill}
            >
              {overall}
            </text>
            <text
              x={CX}
              y={CY + 24}
              textAnchor="middle"
              fontSize="10"
              fontWeight="500"
              fill={hubLabelFill}
            >
              {overallLabel}
            </text>
          </svg>

          <ChartTooltip
            theme={t}
            visible={hv != null}
            left={hv ? `${(hv.lx / VBW) * 100}%` : "50%"}
            top={hv ? `${(hv.ly / VBH) * 100}%` : "40%"}
            title={hv?.label}
            rows={hv ? [{ label: "Score", value: `${hv.value}${suffix || " / 100"}`, color: hv.color }] : []}
          />

          {detailed && (
            <table
              style={{
                width: "100%",
                marginTop: 18,
                borderCollapse: "collapse",
                fontSize: 13,
                color: t.text.secondary,
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", color: t.text.muted }}>
                  <th style={{ padding: "6px 8px", fontWeight: 600 }}>Metric</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {petals.map((p) => (
                  <tr
                    key={`row-${p.key}`}
                    style={{
                      borderTop: `1px solid ${t.grid}`,
                      opacity: off[p.key] ? 0.4 : 1,
                    }}
                  >
                    <td style={{ padding: "7px 8px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />
                        {p.label}
                      </span>
                    </td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: t.text.primary }}>
                      {p.value}
                      {suffix}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${t.grid}` }}>
                  <td style={{ padding: "7px 8px", fontWeight: 700, color: t.text.primary }}>{overallLabel}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 800, color: t.text.primary }}>
                    {overall}
                    {suffix}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      );
    };

    const legend = (
      <Legend
        theme={t}
        swatch="dot"
        items={petals.map((p) => ({
          key: p.key,
          label: p.label,
          color: p.color,
          value: `${p.value}${suffix}`,
          active: !off[p.key],
        }))}
        onToggle={toggle}
      />
    );

    return (
      <ChartCard
        theme={t}
        title={title}
        subtitle={subtitle}
        icon={icon}
        iconColor={iconColor}
        controls={chartControls}
        onControl={onControl}
        width={width}
        size={size}
        className={className}
        floatingHeader
        headline={{ value: `${overall}${suffix}` }}
        footer={legend}
      >
        {renderChart}
      </ChartCard>
    );
  }
);

HexHealthChart.displayName = "HexHealthChart";

export default HexHealthChart;
