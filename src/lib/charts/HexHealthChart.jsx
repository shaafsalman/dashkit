import React, { useMemo, useState, memo } from "react";
import { resolveTheme, lighten } from "./theme";
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
const SLOTS = [90, 30, -30, -150, 150];
const CX = 180;
const CY = 168;
const HEX_R = 60;
const BASE_LEN = 86;
const GAP_DEG = 5;
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

const HexHealthChart = memo(
  ({
    title = "Account Health",
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

    const [sort, setSort] = useState("none");
    const [hover, setHover] = useState(null); // hovered petal key
    const [off, setOff] = useState({}); // { [key]: true } => hidden

    // theme-aware center + label colors. Dark theme -> dark center (light text);
    // light theme -> light center (dark text), so the hub never clashes.
    const isLight = t.mode === "light";
    const hubFill = isLight ? "#ffffff" : "#0b0f18";
    const hubStroke = isLight ? "rgba(15,23,42,0.12)" : "#1c2433";
    const hubValueFill = t.text.primary;
    const hubLabelFill = t.text.muted;
    // petal labels sit on saturated petals: white reads on both themes.
    const petalLabelFill = "#ffffff";

    const ordered = useMemo(() => {
      const arr = metrics.slice(0, 5);
      if (sort === "none") return arr;
      const a = arr.slice();
      a.sort((x, y) => (sort === "desc" ? y.value - x.value : x.value - y.value));
      return a;
    }, [metrics, sort]);

    const petals = useMemo(
      () =>
        ordered.map((m, i) => {
          const phi = SLOTS[i];
          const color = m.color || PALETTE[i % PALETTE.length];
          const len = BASE_LEN * (0.62 + 0.38 * (Math.min(m.value, 100) / 100));
          const a0 = phi - 30 + GAP_DEG;
          const a1 = phi + 30 - GAP_DEG;
          const ri = HEX_R + 3;
          const ro = HEX_R + len;
          const A = P(ri, a0), B = P(ri, a1), C = P(ro, a1), D = P(ro, a0);
          const L = P(HEX_R + len * 0.52, phi);
          return {
            ...m,
            color,
            d: `M ${A} L ${B} L ${C} L ${D} Z`,
            lx: L[0],
            ly: L[1],
            key: m.label || i,
          };
        }),
      [ordered]
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
          <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" role="img" aria-label={`${title}: ${overall}`}>
            <defs>
              {petals.map((p) => (
                <linearGradient key={`g-${p.key}`} id={`hex-${p.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lighten(p.color, 0.18)} />
                  <stop offset="100%" stopColor={p.color} />
                </linearGradient>
              ))}
            </defs>

            {petals.map((p) => {
              const hidden = off[p.key];
              const dim = hover != null && hover !== p.key;
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
                    fill={`url(#hex-${p.key})`}
                    stroke={p.color}
                    strokeWidth="9"
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
              y={CY - 2}
              textAnchor="middle"
              fontSize={detailed ? "44" : "40"}
              fontWeight="800"
              fill={hubValueFill}
            >
              {overall}
            </text>
            <text
              x={CX}
              y={CY + 18}
              textAnchor="middle"
              fontSize="11"
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
        icon={icon}
        iconColor={iconColor}
        controls={chartControls}
        onControl={onControl}
        width={width}
        size={size}
        className={className}
        footer={legend}
      >
        {renderChart}
      </ChartCard>
    );
  }
);

HexHealthChart.displayName = "HexHealthChart";

export default HexHealthChart;
