import React, { useMemo, useState, memo } from "react";
import { resolveTheme, polar } from "./theme";
import { ChartCard, ChartTooltip } from "./chrome";

/**
 * RadarChart — spider chart for a set of 0..max metrics.
 * Props: title, theme, controls, size, metrics:[{label,value}], max, accent.
 * Hover a vertex for an axis-label + value tooltip; detailed mode (expand modal)
 * renders the numeric value next to every vertex.
 */
const SIZE = 320;
const C = SIZE / 2;
const R = 110;

const SORTS = [
  { label: "Original order", value: "none" },
  { label: "Value (high → low)", value: "desc" },
  { label: "Value (low → high)", value: "asc" },
];

const RadarChart = memo(
  ({
    title = "Skill Profile",
    theme,
    controls,
    onControl,
    size = "m",
    metrics = [
      { label: "Speed", value: 80 },
      { label: "Comfort", value: 65 },
      { label: "Safety", value: 92 },
      { label: "Service", value: 74 },
      { label: "Value", value: 58 },
      { label: "On-Time", value: 88 },
    ],
    max = 100,
    accent,
    width = 400,
    expandable = false,
    className = "",
  }) => {
    const t = resolveTheme(theme, "dark");
    const color = accent || t.accent;

    const [sort, setSort] = useState("none");
    const [hover, setHover] = useState(null); // index of hovered vertex

    const sorted = useMemo(() => {
      if (sort === "none") return metrics;
      const arr = metrics.slice();
      arr.sort((a, b) => (sort === "desc" ? b.value - a.value : a.value - b.value));
      return arr;
    }, [metrics, sort]);

    const n = sorted.length;

    const { rings, axes, verts, poly, labels } = useMemo(() => {
      const ang = (i) => -90 + (i * 360) / n;
      const rings = [0.25, 0.5, 0.75, 1].map((f) =>
        sorted.map((_, i) => polar(C, C, R * f, ang(i)).join(",")).join(" ")
      );
      const axes = sorted.map((_, i) => polar(C, C, R, ang(i)));
      const verts = sorted.map((m, i) => {
        const frac = Math.min(m.value, max) / max;
        const p = polar(C, C, R * frac, ang(i));
        return { ...m, x: p[0], y: p[1], a: ang(i) };
      });
      const poly = verts.map((v) => `${v.x},${v.y}`).join(" ");
      const labels = sorted.map((m, i) => ({
        p: polar(C, C, R + 18, ang(i)),
        label: m.label,
        anchor: i === 0 || i === n / 2 ? "middle" : ang(i) > -90 && ang(i) < 90 ? "start" : "end",
      }));
      return { rings, axes, verts, poly, labels };
    }, [sorted, n, max]);

    const chartControls =
      controls ?? [
        { type: "sort", options: SORTS, value: sort, onChange: (v) => setSort(v) },
      ];

    const renderChart = ({ detailed }) => {
      const hv = hover != null ? verts[hover] : null;
      return (
        <div style={{ position: "relative" }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label={title}>
            {rings.map((pts, i) => (
              <polygon key={i} points={pts} fill="none" stroke={t.grid} strokeWidth="1" />
            ))}
            {axes.map((p, i) => (
              <line key={i} x1={C} y1={C} x2={p[0]} y2={p[1]} stroke={t.grid} strokeWidth="1" />
            ))}
            <polygon
              points={poly}
              fill={color}
              fillOpacity={hover != null ? 0.18 : 0.25}
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {verts.map((v, i) => (
              <g key={i}>
                <circle
                  cx={v.x}
                  cy={v.y}
                  r={hover === i ? 6 : 3.5}
                  fill={color}
                  style={{ cursor: "pointer", opacity: hover == null || hover === i ? 1 : 0.5 }}
                  onMouseEnter={() => setHover(i)}
                  onMouseMove={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
                {detailed && (
                  <text
                    x={v.x}
                    y={v.y - 9}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill={t.text.primary}
                  >
                    {v.value}
                  </text>
                )}
              </g>
            ))}
            {labels.map((l, i) => (
              <text
                key={i}
                x={l.p[0]}
                y={l.p[1] + 4}
                textAnchor={l.anchor}
                fontSize="13"
                fontWeight={hover === i ? "700" : "600"}
                fill={hover === i ? t.text.primary : t.text.secondary}
              >
                {l.label}
              </text>
            ))}
          </svg>
          <ChartTooltip
            theme={t}
            visible={hv != null}
            left={hv ? `${(hv.x / SIZE) * 100}%` : "50%"}
            top={hv ? `${(hv.y / SIZE) * 100}%` : "50%"}
            title={hv?.label}
            rows={hv ? [{ label: "Value", value: `${hv.value} / ${max}`, color }] : []}
          />
        </div>
      );
    };

    return (
      <ChartCard
        theme={t}
        title={title}
        controls={chartControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
      >
        {renderChart}
      </ChartCard>
    );
  }
);

RadarChart.displayName = "RadarChart";
export default RadarChart;
