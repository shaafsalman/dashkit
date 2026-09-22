import React, { useMemo, useState, memo } from "react";
import { resolveTheme, polar, arcPath } from "./theme";
import { ChartCard, ChartTooltip } from "./chrome";

/**
 * SpeedometerChart — 180° needle gauge.
 * Props: title, theme, controls, value, max, min, unit, label, from/to (arc gradient),
 *        periods:[{label,value}] (functional period control), size.
 *
 * - Hover the arc (or the value text) to reveal a tooltip with the current value.
 * - detailed=true (expand modal) shows min/max tick labels + a value row.
 */
const VBW = 320;
const VBH = 200;
const CX = 160;
const CY = 172;
const R = 124;

const DEFAULT_PERIODS = [
  { label: "Today", value: 68 },
  { label: "This Week", value: 74 },
  { label: "This Month", value: 81 },
];

const SpeedometerChart = memo(
  ({
    title = "Throughput",
    subtitle,
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    value,
    periods = DEFAULT_PERIODS,
    max = 100,
    min = 0,
    unit = "%",
    label = "of capacity",
    from = "#56e0a6",
    to = "#2bd45f",
    width = 380,
    size = "m",
    expandable = false,
    className = "",
  }) => {
    const t = resolveTheme(theme, "dark");

    // period selection drives the displayed value when no explicit value is passed.
    const [period, setPeriod] = useState(periods[0]?.value ?? 0);
    const current = value != null ? value : period;
    const [hover, setHover] = useState(false);

    const clamped = Math.min(Math.max(current, min), max);
    const frac = max > min ? (clamped - min) / (max - min) : 0;
    const angle = 180 + frac * 180;
    const needle = useMemo(() => polar(CX, CY, R - 26, angle), [angle]);

    // tooltip anchored at the needle tip, as viewBox-relative percentages.
    const tipLeft = `${(needle[0] / VBW) * 100}%`;
    const tipTop = `${(needle[1] / VBH) * 100}%`;

    // min/max tick anchors (ends of the 180° arc).
    const minTick = useMemo(() => polar(CX, CY, R, 180), []);
    const maxTick = useMemo(() => polar(CX, CY, R, 360), []);

    const builtControls = controls ?? [
      {
        type: "period",
        value: period,
        options: periods,
        onChange: (v) => setPeriod(v),
      },
    ];

    return (
      <ChartCard
        theme={t}
        title={title}
        subtitle={subtitle}
        icon={icon}
        iconColor={iconColor}
        controls={value != null ? controls : builtControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
        floatingHeader
        headline={{ value: `${current}${unit}` }}
      >
        {({ detailed }) => (
          <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" role="img" aria-label={`${title}: ${current}${unit}`}>
              <defs>
                <linearGradient id="sp-arc" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={from} />
                  <stop offset="100%" stopColor={to} />
                </linearGradient>
              </defs>

              {/* track */}
              <path d={arcPath(CX, CY, R, 180, 360)} fill="none" stroke={t.track} strokeWidth="16" strokeLinecap="round" />
              {/* progress arc — hoverable */}
              <path
                d={arcPath(CX, CY, R, 180, angle)}
                fill="none"
                stroke="url(#sp-arc)"
                strokeWidth="16"
                strokeLinecap="round"
                style={{ opacity: hover ? 1 : 0.92, cursor: "pointer" }}
                onMouseEnter={() => setHover(true)}
                onMouseMove={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
              />
              {/* wide transparent hit-area so the thin arc is easy to hover */}
              <path
                d={arcPath(CX, CY, R, 180, 360)}
                fill="none"
                stroke="transparent"
                strokeWidth="30"
                strokeLinecap="round"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHover(true)}
                onMouseMove={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
              />

              {/* needle + knob */}
              <line x1={CX} y1={CY} x2={needle[0]} y2={needle[1]} stroke={t.text.primary} strokeWidth="4" strokeLinecap="round" />
              <circle cx={CX} cy={CY} r="9" fill={t.text.primary} />

              {/* center value */}
              <text x={CX} y={CY - 20} textAnchor="middle" fontSize="13" fontWeight="700" fill={t.text.muted}>{label}</text>

              {/* detailed mode: min/max tick labels under the arc ends */}
              {detailed && (
                <g>
                  <text x={minTick[0]} y={minTick[1] + 22} textAnchor="middle" fontSize="12" fontWeight="600" fill={t.text.secondary}>
                    {min}{unit}
                  </text>
                  <text x={maxTick[0]} y={maxTick[1] + 22} textAnchor="middle" fontSize="12" fontWeight="600" fill={t.text.secondary}>
                    {max}{unit}
                  </text>
                </g>
              )}
            </svg>

            <ChartTooltip
              theme={t}
              visible={hover}
              left={tipLeft}
              top={tipTop}
              title={title}
              rows={[{ label, value: `${current}${unit}`, color: to }]}
            />

            {/* detailed mode: min / value / max readout below the gauge */}
            {detailed && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: `1px solid ${t.control.border}`,
                }}
              >
                {[
                  { k: "Min", v: `${min}${unit}`, c: t.text.muted },
                  { k: "Value", v: `${current}${unit}`, c: t.accent },
                  { k: "Max", v: `${max}${unit}`, c: t.text.muted },
                ].map((d) => (
                  <div key={d.k} style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 12, color: t.text.muted, marginBottom: 2 }}>{d.k}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: d.c }}>{d.v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ChartCard>
    );
  }
);

SpeedometerChart.displayName = "SpeedometerChart";
export default SpeedometerChart;
