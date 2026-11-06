import React, { useMemo, memo, useState, useId } from "react";
import { resolveTheme, arcPath as sharedArc } from "./theme";
import { ChartCard, ChartTooltip, Stat } from "./chrome";

/**
 * GaugeCard — "Synced Records": two KPIs above a semicircle gauge.
 * Chrome/theme/controls unified via ChartCard.
 *  - hover the arc -> tooltip with the value %
 *  - detailed mode (expand modal): larger gauge + tick labels + min/max readout
 */

const VBW = 320;
const VBH = 232;
const CX = 160;
// arc spans CY-R-SW/2 .. CY+R*sin30+SW/2 (+ endpoint labels) — centred in VBH
const CY = 144;
const R = 120;
const SW = 16;
const START = 210;
const END = -30;

const rad = (d) => (d * Math.PI) / 180;
const P = (r, d) => [CX + r * Math.cos(rad(d)), CY - r * Math.sin(rad(d))];
// true SVG arc (y-up degrees -> theme.arcPath's y-down degrees)
const arc = (a0, a1) => sharedArc(CX, CY, R, -a0, -a1);
// angle along the gauge for a given 0..100 value
const angleFor = (v) => START - (Math.min(Math.max(v, 0), 100) / 100) * (START - END);

const DEFAULT_THEME = { base: "dark", surface: "#1b1d21", radius: 16, pad: 24 };

const GaugeCard = memo(
  ({
    title = "Synced Records",
    subtitle,
    icon = null,
    theme,
    controls,
    onControl,
    stats = [
      { value: "16.4K", label: "Auto-Processed" },
      { value: "20K", label: "Pending Check" },
    ],
    value = 80.49,
    valueText,
    from = "#c8f24a",
    to = "#2bd45f",
    knobColor = "#22c55e",
    width = 460,
    size = "m",
    className = "",
  }) => {
    const t = resolveTheme(theme || DEFAULT_THEME, "dark");
    if (t.mono) { from = t.series[1]; to = t.series[0]; knobColor = t.series[0]; }
    const uid = useId().replace(/:/g, "");
    const [hover, setHover] = useState(false);

    const v = Math.min(Math.max(value, 0), 100);
    const { progEnd, knob } = useMemo(() => {
      const pe = angleFor(v);
      return { progEnd: pe, knob: P(R, pe) };
    }, [v]);
    const text = `${valueText ?? value}`.replace(/%+$/, "");
    const displayValue = `${text}%`;

    // tooltip anchored to the knob (the live datapoint), as viewBox %
    const tipLeft = `${(knob[0] / VBW) * 100}%`;
    const tipTop = `${(knob[1] / VBH) * 100}%`;
    const divider = t.border === "transparent" ? "#e5e7eb" : "rgba(255,255,255,0.1)";

    const ticks = [0, 25, 50, 75, 100];

    const Gauge = ({ detailed }) => (
      <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          width="100%"
          height="100%"
          role="img"
          aria-label={`${title}: ${displayValue}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ maxWidth: 520 }}
        >
          <defs>
            <linearGradient id={`${uid}-prog`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>

          {/* track */}
          <path d={arc(START, END)} fill="none" stroke={t.track} strokeWidth={SW} strokeLinecap="round" />
          {/* progress */}
          <path
            d={arc(START, progEnd)}
            fill="none"
            stroke={`url(#${uid}-prog)`}
            strokeWidth={SW}
            strokeLinecap="round"
            style={{ filter: hover ? `drop-shadow(0 0 6px ${to}aa)` : "none" }}
          />

          {/* detailed: tick marks + labels around the arc */}
          {detailed &&
            ticks.map((tk) => {
              const a = angleFor(tk);
              const inner = P(R - SW / 2 - 4, a);
              const outer = P(R + SW / 2 + 4, a);
              const lbl = P(R + SW / 2 + 18, a);
              return (
                <g key={tk}>
                  <line
                    x1={inner[0]} y1={inner[1]} x2={outer[0]} y2={outer[1]}
                    stroke={t.grid} strokeWidth="2"
                  />
                  <text
                    x={lbl[0]} y={lbl[1] + 4} textAnchor="middle"
                    fontSize="11" fontWeight="600" fill={t.text.muted}
                  >
                    {tk}
                  </text>
                </g>
              );
            })}

          {/* knob */}
          <circle
            cx={knob[0]} cy={knob[1]} r={hover ? 13 : 11}
            fill={knobColor} stroke={t.mono ? t.surface : "#0c2f1b"} strokeWidth="2"
          />

          {/* The primary value lives in the shared top-right header. Keep the
              center as a semantic label so the gauge never duplicates it. */}
          <text
            x={CX} y={CY - 4} textAnchor="middle"
            fontSize="14" fontWeight="700" fill={t.text.muted}
          >
            Progress
          </text>

          {/* endpoint scale labels, mirrored under both arc ends */}
          <text x={P(R, START)[0]} y={P(R, START)[1] + SW / 2 + 16} textAnchor="middle" fontSize="12" fontWeight="600" fill={t.text.muted}>0%</text>
          <text x={P(R, END)[0]} y={P(R, END)[1] + SW / 2 + 16} textAnchor="middle" fontSize="12" fontWeight="600" fill={t.text.muted}>100%</text>

          {/* hover capture over the gauge band */}
          <path
            d={arc(START, END)}
            fill="none"
            stroke="transparent"
            strokeWidth={SW + 22}
            strokeLinecap="round"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(true)}
            onMouseMove={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          />
        </svg>

        <ChartTooltip
          theme={t}
          visible={hover}
          left={tipLeft}
          top={tipTop}
          title={title}
          rows={[{ label: "Progress", value: `${v}%`, color: to }]}
        />
      </div>
    );

    return (
      <ChartCard
        theme={t}
        title={title}
        subtitle={subtitle}
        icon={icon}
        controls={controls}
        onControl={onControl}
        width={width}
        size={size}
        className={className}
        floatingHeader
        headline={{ value: displayValue }}
      >
        {({ detailed }) => (
          <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ height: 1, background: divider, marginBottom: 12, flexShrink: 0 }} />
            <div style={{ display: "grid", gridTemplateColumns: stats[1] ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 20, alignItems: "start", flexShrink: 0 }}>
              <Stat theme={t} {...stats[0]} />
              {stats[1] && <Stat theme={t} {...stats[1]} align="right" />}
            </div>
            <div style={{ flex: 1, minHeight: 150, marginTop: 8 }}><Gauge detailed={detailed} /></div>
          </div>
        )}
      </ChartCard>
    );
  }
);

GaugeCard.displayName = "GaugeCard";

export default GaugeCard;
