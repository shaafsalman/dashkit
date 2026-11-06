import React, { useMemo, useState, memo, useId } from "react";
import { resolveTheme, arcPath as sharedArc } from "./theme";
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
// arc spans CY-R-SW/2 .. CY+R*sin30+SW/2 — CY centres that span in VBH
const CY = 164;
const R = 116;
const SW = 42;

const DEFAULT_SEGMENTS = [
  { label: "Completed", value: 58, color: "#3aa564" },
  { label: "In Progress", value: 12, color: "#1f6b3b" },
  { label: "Pending", value: 30, color: "#cfd4d8", hatch: true },
];

const rad = (d) => (d * Math.PI) / 180;
const P = (r, d) => [CX + r * Math.cos(rad(d)), CY - r * Math.sin(rad(d))];
const SEG_GAP = 1.6; // degrees of air between neighbouring segments
// y-up degrees -> theme.arcPath's y-down degrees, so the arc is a true curve
const arcPath = (a0, a1) => sharedArc(CX, CY, R, -a0, -a1);

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
    const uid = useId().replace(/:/g, "");
    const colored = useMemo(
      () => segments.map((s, i) => ({ ...s, color: t.mono ? (s.hatch ? t.text.muted : t.series[i % t.series.length]) : s.color || t.series[i % t.series.length] })),
      [segments, t.series, t.mono]
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
      // Butt-capped segments with an even gap; only the two outer ends of
      // the horseshoe get round caps (drawn separately below), so segment
      // caps never overlap their neighbours and both ends mirror each other.
      const last = active.length - 1;
      const arcs = active.map((s, i) => {
        const frac = s.value / totalVal;
        const a0 = cur - (i > 0 ? SEG_GAP / 2 : 0);
        const a1 = cur - frac * sweep + (i < last ? SEG_GAP / 2 : 0);
        const mid = (cur + (cur - frac * sweep)) / 2;
        cur = cur - frac * sweep;
        return { ...s, pct: frac, d: arcPath(a0, Math.min(a0, a1)), anchor: P(R, mid), key: i };
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
        floatingHeader
        headline={{ value: `${value}%` }}
        footer={<Legend theme={t} items={legendItems.map(({ value, ...rest }) => rest)} swatch="dot" onToggle={toggle} />}
        footerDetailed={<Legend theme={t} items={legendItems} swatch="dot" onToggle={toggle} />}
      >
        {({ detailed }) => (
          <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" role="img" aria-label={`${title}: ${value}%`}>
              <defs>
                <pattern id={`${uid}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="8" height="8" fill={t.mode === "light" ? "#ffffff" : "rgba(255,255,255,0.04)"} />
                  <line x1="0" y1="0" x2="0" y2="8" stroke={t.mode === "light" ? "#c7ccd1" : "rgba(255,255,255,0.28)"} strokeWidth="2.4" />
                </pattern>
              </defs>
              {/* visible ring: border halo + solid base track behind the segments */}
              <path d={arcPath(start, end)} fill="none" stroke={borderCol} strokeWidth={SW + 3} strokeLinecap="round" />
              <path d={arcPath(start, end)} fill="none" stroke={baseTrack} strokeWidth={SW} strokeLinecap="round" />
              {arcs.map((a, i) => {
                const dim = hover != null && hover !== i;
                const fill = a.hatch ? `url(#${uid}-hatch)` : a.color;
                const cap = i === 0 ? P(R, start) : i === arcs.length - 1 ? P(R, end) : null;
                return (
                  <g key={a.key} opacity={dim ? 0.4 : 1}>
                  {cap && <circle cx={cap[0]} cy={cap[1]} r={SW / 2} fill={fill} />}
                  <path
                    key={a.key}
                    d={a.d}
                    fill="none"
                    stroke={fill}
                    strokeWidth={SW}
                    strokeLinecap="butt"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHover(i)}
                    onMouseMove={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                  </g>
                );
              })}
              {/* round knob at the end of the progress (first) arc — white ring + crisp border */}
              <circle cx={knob[0]} cy={knob[1]} r="15" fill={knobColor} stroke="#ffffff" strokeWidth="3" />
              <circle cx={knob[0]} cy={knob[1]} r="16.5" fill="none" stroke={borderCol} strokeWidth="1.5" />
              <text x={CX} y={CY + 8} textAnchor="middle" fontSize="48" fontWeight="800" letterSpacing="-1.5" fill={t.text.primary}>{value}<tspan fontSize="24" dx="2">%</tspan></text>
              <text x={CX} y={CY + 34} textAnchor="middle" fontSize="13" fontWeight="600" fill={t.text.muted}>{valueLabel}</text>

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
