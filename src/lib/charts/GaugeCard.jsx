import React, { useMemo, memo, useState } from "react";
import { resolveTheme } from "./theme";
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
const CY = 140;
const R = 120;
const SW = 16;
const START = 210;
const END = -30;

const rad = (d) => (d * Math.PI) / 180;
const P = (r, d) => [CX + r * Math.cos(rad(d)), CY - r * Math.sin(rad(d))];
const arc = (a0, a1) => {
  const pts = [];
  const dir = a1 <= a0 ? -1 : 1;
  for (let a = a0; dir < 0 ? a >= a1 : a <= a1; a += dir * 2) pts.push(P(R, a));
  pts.push(P(R, a1));
  return pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
};
// angle along the gauge for a given 0..100 value
const angleFor = (v) => START - (Math.min(Math.max(v, 0), 100) / 100) * (START - END);

const DEFAULT_THEME = { base: "dark", surface: "#1b1d21", radius: 16, pad: 24 };

const GaugeCard = memo(
  ({
    title = "Synced Records",
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
    const [hover, setHover] = useState(false);

    const v = Math.min(Math.max(value, 0), 100);
    const { progEnd, knob } = useMemo(() => {
      const pe = angleFor(v);
      return { progEnd: pe, knob: P(R, pe) };
    }, [v]);
    const text = valueText ?? `${value}`;

    // tooltip anchored to the knob (the live datapoint), as viewBox %
    const tipLeft = `${(knob[0] / VBW) * 100}%`;
    const tipTop = `${(knob[1] / VBH) * 100}%`;
    const divider = t.border === "transparent" ? "#e5e7eb" : "rgba(255,255,255,0.1)";

    const ticks = [0, 25, 50, 75, 100];

    const Gauge = ({ detailed }) => (
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          width="100%"
          role="img"
          aria-label={`${title}: ${text}%`}
        >
          <defs>
            <linearGradient id="gc-prog" x1="0" y1="0" x2="1" y2="0">
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
            stroke="url(#gc-prog)"
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
            fill={knobColor} stroke="#0c2f1b" strokeWidth="2"
          />

          {/* center value */}
          <text
            x={CX} y={CY - 8} textAnchor="middle"
            fontSize="42" fontWeight="700" fill={t.text.primary} fontStyle="italic"
          >
            {text}
            <tspan fontSize="18">%</tspan>
          </text>

          {/* detailed: min/max endpoint labels */}
          {detailed && (
            <>
              <text x={P(R, START)[0]} y={P(R, START)[1] + 22} textAnchor="middle" fontSize="12" fill={t.text.secondary}>0%</text>
              <text x={P(R, END)[0]} y={P(R, END)[1] + 22} textAnchor="middle" fontSize="12" fill={t.text.secondary}>100%</text>
            </>
          )}

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
        icon={icon}
        controls={controls}
        onControl={onControl}
        width={width}
        size={size}
        className={className}
      >
        {({ detailed }) => (
          <>
            <div style={{ height: 1, background: divider, marginBottom: 10 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Stat theme={t} {...stats[0]} />
              {stats[1] && <Stat theme={t} {...stats[1]} align="right" />}
            </div>
            <Gauge detailed={detailed} />
          </>
        )}
      </ChartCard>
    );
  }
);

GaugeCard.displayName = "GaugeCard";

export default GaugeCard;
