import React, { useMemo, useState, memo } from "react";
import { resolveTheme } from "./theme";
import { ChartCard, Legend, ChartTooltip } from "./chrome";

/**
 * ProgressGauge — "Project Progress": thick rounded horseshoe arc split into
 * proportional segments (last can be hatched) + centered %. Chrome via ChartCard.
 * - Hover an arc segment for a tooltip (label + value%).
 * - Legend swatch click toggles a segment (the gauge recomputes from the active set).
 * - Round knob stays pinned to the end of the progress (first) arc.
 * - detailed=true (expand modal) shows each segment's value as a legend row.
 */

const VBW = 360;
const VBH = 270;
const CX = 180;
const CY = 178;
const R = 116;
const SW = 42;

const DEFAULT_SEGMENTS = [
  { label: "Completed", value: 58, color: "#3aa564" },
  { label: "In Progress", value: 12, color: "#1f6b3b" },
  { label: "Pending", value: 30, color: "#cfd4d8", hatch: true },
];

const rad = (d) => (d * Math.PI) / 180;
const P = (r, d) => [CX + r * Math.cos(rad(d)), CY - r * Math.sin(rad(d))];
const arcPath = (a0, a1) => {
  const pts = [];
  const step = a0 > a1 ? -2 : 2;
  for (let a = a0; step < 0 ? a >= a1 : a <= a1; a += step) pts.push(P(R, a));
  pts.push(P(R, a1));
  return pts.map((p, i) => `${i ? "L" : "M"} ${p[0]} ${p[1]}`).join(" ");
};

const ProgressGauge = memo(
  ({
    title = "Project Progress",
    subtitle,
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    value = 41,
    valueLabel = "Project Ended",
    segments = DEFAULT_SEGMENTS,
    start = 210,
    end = -30,
    width = 420,
    size = "m",
    className = "",
  }) => {
    const t = resolveTheme(theme, "light");

    // resolve a stable color per segment (by index)
    const colored = useMemo(
      () => segments.map((s, i) => ({ ...s, color: s.color || t.series[i % t.series.length] })),
      [segments, t.series]
    );

    // which segments are active (toggled via the legend). keyed by label.
    const [hidden, setHidden] = useState({});
    const isActive = (s) => !hidden[s.label];
    const toggle = (key) => setHidden((h) => ({ ...h, [key]: !h[key] }));

    const [hover, setHover] = useState(null); // index into `arcs`

    const { arcs, knob, knobColor } = useMemo(() => {
      const active = colored.filter(isActive);
      const sweep = start - end;
      const totalVal = active.reduce((s, x) => s + x.value, 0) || 1;
      let cur = start;
      const arcs = active.map((s, i) => {
        const frac = s.value / totalVal;
        const a0 = cur;
        const a1 = cur - frac * sweep + (i < active.length - 1 ? 2.5 : 0);
        const mid = (cur + (cur - frac * sweep)) / 2;
        cur = cur - frac * sweep;
        return { ...s, pct: frac, d: arcPath(a0, a1), anchor: P(R, mid), key: i };
      });
      const progEnd = start - ((active[0]?.value || 0) / totalVal) * sweep;
      return { arcs, knob: P(R, progEnd), knobColor: active[0]?.color || t.accent };
    }, [colored, hidden, start, end, t.accent]);

    const fmtPct = (p) => `${Math.round(p * 100)}%`;

    const legendItems = colored.map((s) => {
      const a = arcs.find((x) => x.label === s.label);
      return {
        key: s.label,
        label: s.label,
        color: s.color,
        active: isActive(s),
        value: a ? `${s.value} · ${fmtPct(a.pct)}` : "—",
      };
    });

    const resolvedControls = controls ?? [];

    const hovered = hover != null ? arcs[hover] : null;
    const borderCol = t.mode === "light" ? "rgba(15,23,42,0.16)" : "rgba(255,255,255,0.22)";
    const baseTrack = t.mode === "light" ? "#eceff3" : "rgba(255,255,255,0.05)";

    return (
      <ChartCard
        theme={t}
        title={title}
        icon={icon}
        iconColor={iconColor}
        subtitle={subtitle}
        controls={resolvedControls}
        onControl={onControl}
        width={width}
        size={size}
        className={className}
        footer={<Legend theme={t} items={legendItems.map(({ value, ...rest }) => rest)} swatch="dot" onToggle={toggle} />}
        footerDetailed={<Legend theme={t} items={legendItems} swatch="dot" onToggle={toggle} />}
      >
        {({ detailed }) => (
          <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" role="img" aria-label={`${title}: ${value}%`}>
              <defs>
                <pattern id="pg-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="8" height="8" fill="#ffffff" />
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#c7ccd1" strokeWidth="2.4" />
                </pattern>
              </defs>
              {/* visible ring: border halo + solid base track behind the segments */}
              <path d={arcPath(start, end)} fill="none" stroke={borderCol} strokeWidth={SW + 3} strokeLinecap="round" />
              <path d={arcPath(start, end)} fill="none" stroke={baseTrack} strokeWidth={SW} strokeLinecap="round" />
              {arcs.map((a, i) => {
                const dim = hover != null && hover !== i;
                return (
                  <path
                    key={a.key}
                    d={a.d}
                    fill="none"
                    stroke={a.hatch ? "url(#pg-hatch)" : a.color}
                    strokeWidth={SW}
                    strokeLinecap="round"
                    opacity={dim ? 0.4 : 1}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHover(i)}
                    onMouseMove={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
              {/* round knob at the end of the progress (first) arc — white ring + crisp border */}
              <circle cx={knob[0]} cy={knob[1]} r="15" fill={knobColor} stroke="#ffffff" strokeWidth="3" />
              <circle cx={knob[0]} cy={knob[1]} r="16.5" fill="none" stroke={borderCol} strokeWidth="1.5" />
              <text x={CX} y={CY + 6} textAnchor="middle" fontSize="52" fontWeight="800" fill={t.text.primary}>{value}%</text>
              <text x={CX} y={CY + 30} textAnchor="middle" fontSize="13" fontWeight="600" fill={arcs[0]?.color || "#3aa564"}>{valueLabel}</text>

              {/* detailed mode: value label on every segment along the arc */}
              {detailed &&
                arcs.map((a) => (
                  <text
                    key={`lbl-${a.key}`}
                    x={a.anchor[0]}
                    y={a.anchor[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill={t.mode === "light" ? "#ffffff" : t.text.primary}
                  >
                    {fmtPct(a.pct)}
                  </text>
                ))}
            </svg>

            <ChartTooltip
              theme={t}
              visible={!!hovered}
              left={hovered ? `${(hovered.anchor[0] / VBW) * 100}%` : "50%"}
              top={hovered ? `${(hovered.anchor[1] / VBH) * 100}%` : "40%"}
              title={hovered ? hovered.label : ""}
              rows={
                hovered
                  ? [
                      { label: "Value", value: hovered.value, color: hovered.hatch ? "#c7ccd1" : hovered.color },
                      { label: "Share", value: fmtPct(hovered.pct) },
                    ]
                  : []
              }
            />
          </div>
        )}
      </ChartCard>
    );
  }
);

ProgressGauge.displayName = "ProgressGauge";

export default ProgressGauge;
