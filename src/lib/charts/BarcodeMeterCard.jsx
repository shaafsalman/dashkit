import React, { useMemo, useState, memo } from "react";
import { resolveTheme } from "./theme";
import { ChartCard, ChartTooltip, Stat } from "./chrome";

/**
 * BarcodeMeterCard — "Anomalies": big %, two KPIs, stylized barcode meter.
 * The meter is a progress bar: ticks up to `progress` are lit with the accent,
 * the remainder are dimmed. Hover the meter for a tooltip (percent + detected/total).
 * Chrome / theme / controls / detailed-mode unified via ChartCard.
 */

const W = 520;
const MH = 60;
const START_X = 96;
const END_PAD = 6;
const DEFAULT_THEME = { base: "dark", surface: "#1b1d21", radius: 16, pad: 24 };

/* Per-period datasets so the period control actually changes the chart. */
const PERIODS = {
  weekly: { percentText: "12,40", progress: 0.124, detected: "0.61K", total: "4.9K" },
  monthly: { percentText: "15,12", progress: 0.151, detected: "2.84K", total: "20.8K" },
  quarterly: { percentText: "18,76", progress: 0.188, detected: "9.12K", total: "62.4K" },
};

const BarcodeMeterCard = memo(
  ({
    title = "Anomalies",
    icon = null,
    theme,
    controls,
    onControl,
    percentText,
    stats,
    progress,
    accent = "#c2f53b",
    ticks = 46,
    width = 460,
    size = "s",
    className = "",
  }) => {
    const t = resolveTheme(theme || DEFAULT_THEME, "dark");
    const [period, setPeriod] = useState("monthly");
    const [hover, setHover] = useState(false);

    const data = PERIODS[period] || PERIODS.monthly;
    const pct = progress != null ? progress : data.progress;
    const pctText = percentText != null ? percentText : data.percentText;
    const kpis = stats || [
      { value: data.detected, label: "Detected" },
      { value: data.total, label: "Total Items" },
    ];

    const tickEls = useMemo(() => {
      const gap = (W - START_X - END_PAD) / ticks;
      return Array.from({ length: ticks }, (_, i) => ({
        x: START_X + i * gap + gap / 2,
        h: 30 + (i % 2 === 0 ? 6 : 0),
        lit: (i + 0.5) / ticks <= pct,
      }));
    }, [ticks, pct]);

    const periodControls = controls ?? [
      {
        type: "period",
        value: period,
        options: [
          { label: "Weekly", value: "weekly" },
          { label: "Monthly", value: "monthly" },
          { label: "Quarterly", value: "quarterly" },
        ],
        onChange: (v) => setPeriod(v),
      },
    ];

    const pctLabel = pctText.replace(",", ".");
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

    const body = (detailed) => (
      <>
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, color: t.text.primary, marginBottom: 12 }}>
          {pctText}
          <span style={{ fontSize: 24, color: t.text.muted, verticalAlign: "top" }}>%</span>
        </div>
        <div style={{ height: 1, background: t.mode === "light" ? "rgba(15,23,42,0.1)" : "rgba(255,255,255,0.1)", marginBottom: 16 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <Stat theme={t} {...kpis[0]} />
          {kpis[1] && <Stat theme={t} {...kpis[1]} align="right" />}
        </div>

        <div style={{ position: "relative" }}>
          <svg viewBox={`0 0 ${W} ${MH}`} width="100%" role="img" aria-label={`${title} meter: ${pctLabel}%`}>
            <rect x="0" y={MH / 2 - 18} width="22" height="36" rx="4" fill={t.mode === "light" ? "#0f172a" : "#ffffff"} />
            <rect x="30" y={MH / 2 - 18} width="8" height="36" rx="3" fill={accent} />
            <rect x="46" y={MH / 2 - 18} width="34" height="36" rx="5" fill={t.mode === "light" ? "#cbd5e1" : "#4a4d52"} />
            {tickEls.map((tk, i) => (
              <line
                key={i}
                x1={tk.x}
                y1={MH / 2 - tk.h / 2}
                x2={tk.x}
                y2={MH / 2 + tk.h / 2}
                stroke={tk.lit ? accent : t.mode === "light" ? "#94a3b8" : "#5a5d63"}
                strokeWidth="2"
                strokeLinecap="round"
                opacity={tk.lit ? (hover ? 1 : 0.95) : hover ? 0.4 : 0.5}
              />
            ))}
            {/* transparent overlay drives the hover tooltip across the meter */}
            <rect
              x="0"
              y="0"
              width={W}
              height={MH}
              fill="transparent"
              onMouseEnter={() => setHover(true)}
              onMouseMove={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
            />
          </svg>

          <ChartTooltip
            theme={t}
            visible={hover}
            left={`${(pct * 100).toFixed(0)}%`}
            top="6%"
            title={`${periodLabel} · ${pctLabel}% anomalies`}
            rows={[
              { label: "Detected", value: kpis[0]?.value, color: accent },
              { label: "Total Items", value: kpis[1]?.value, color: t.mode === "light" ? "#94a3b8" : "#5a5d63" },
            ]}
          />
        </div>

        {detailed && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18, fontSize: 13 }}>
            <thead>
              <tr style={{ color: t.text.muted, textAlign: "left" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Period</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Anomaly %</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Detected</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Total Items</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERIODS).map(([key, d]) => {
                const sel = key === period;
                return (
                  <tr key={key} style={{ borderTop: `1px solid ${t.control.border}`, color: t.text.secondary }}>
                    <td style={{ padding: "6px 8px", fontWeight: sel ? 700 : 500, color: sel ? t.text.primary : t.text.secondary }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: sel ? accent : t.track }} />
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px", fontWeight: 700, color: t.text.primary }}>{d.percentText.replace(",", ".")}%</td>
                    <td style={{ padding: "6px 8px" }}>{d.detected}</td>
                    <td style={{ padding: "6px 8px" }}>{d.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </>
    );

    return (
      <ChartCard
        theme={t}
        title={title}
        icon={icon}
        controls={periodControls}
        onControl={onControl}
        width={width}
        size={size}
        className={className}
      >
        {({ detailed }) => body(detailed)}
      </ChartCard>
    );
  }
);

BarcodeMeterCard.displayName = "BarcodeMeterCard";

export default BarcodeMeterCard;
