import React, { useMemo, useState, memo } from "react";
import { resolveTheme } from "./theme";
import { ChartCard, Legend, ChartTooltip } from "./chrome";

/**
 * WaterfallChart — running total with increases/decreases and a final bar.
 * Props: title, theme, controls, items:[{label,value,type:"inc"|"dec"|"total"}], formatValue.
 *
 * Interactive:
 *  - per-bar hover tooltip (label, delta, running total)
 *  - legend + filter control toggle inc / dec / total visibility
 *  - detailed mode: running total above every bar, gridlines, value-axis + data table
 */
const W = 640;
const PT = 30;
const BASE = 270;
const VBH = BASE + 30;
const PL = 20;
const PR = 20;

const TYPE_META = [
  { key: "inc", label: "Increase" },
  { key: "dec", label: "Decrease" },
  { key: "total", label: "Total" },
];

const WaterfallChart = memo(
  ({
    title = "Cash Flow",
    theme,
    controls,
    onControl,
    items = [
      { label: "Start", value: 20, type: "total" },
      { label: "Sales", value: 38, type: "inc" },
      { label: "Refunds", value: 12, type: "dec" },
      { label: "Fees", value: 8, type: "dec" },
      { label: "Net", value: 38, type: "total" },
    ],
    incColor = "#34d399",
    decColor = "#f43f5e",
    formatValue,
    width = 520,
    size = "m",
    className = "",
  }) => {
    const t = resolveTheme(theme, "dark");
    const fmt = formatValue || ((v) => Number(v || 0).toLocaleString("en-US"));

    // which bar types are visible (toggled by legend / filter)
    const [active, setActive] = useState({ inc: true, dec: true, total: true });
    const [hover, setHover] = useState(null);
    const toggle = (key) => setActive((a) => ({ ...a, [key]: !a[key] }));

    const colorFor = (type) => (type === "total" ? t.accent : type === "dec" ? decColor : incColor);

    const { bars, y } = useMemo(() => {
      const n = items.length;
      const step = (W - PL - PR) / n;
      const barW = step * 0.56;
      let run = 0;
      const segs = items.map((it) => {
        let start, end, delta;
        if (it.type === "total") {
          start = 0;
          end = it.value;
          delta = it.value;
          run = it.value;
        } else {
          start = run;
          delta = it.type === "dec" ? -it.value : it.value;
          end = run + delta;
          run = end;
        }
        return { ...it, start, end, delta, running: run };
      });
      const maxV = Math.max(...segs.flatMap((s) => [s.start, s.end]), 1);
      const y = (v) => BASE - (v / maxV) * (BASE - PT);
      const bars = segs.map((s, i) => {
        const cx = PL + step * (i + 0.5);
        const top = Math.max(s.start, s.end);
        const bot = Math.min(s.start, s.end);
        return { ...s, i, cx, barW, x: cx - barW / 2, yTop: y(top), h: Math.max(y(bot) - y(top), 2), color: colorFor(s.type), connY: y(s.end) };
      });
      return { bars, y };
    }, [items, t.accent, incColor, decColor]);

    const isOn = (b) => active[b.type] !== false;
    const hb = hover != null ? bars[hover] : null;

    const legendItems = TYPE_META.map((m) => ({
      key: m.key,
      label: m.label,
      color: colorFor(m.key),
      active: active[m.key],
    }));

    const mergedControls =
      controls ?? [
        { type: "filter", items: legendItems.map((it) => ({ key: it.key, label: it.label, color: it.color, active: it.active })), onToggle: toggle },
      ];

    const renderBody = ({ detailed }) => (
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${VBH}`} width="100%" role="img" aria-label={title}>
          {/* baseline */}
          <line x1={PL} y1={BASE} x2={W - PR} y2={BASE} stroke={t.grid} strokeWidth="1" />
          {/* gridlines + value axis (detailed only) */}
          {detailed &&
            [0.25, 0.5, 0.75, 1].map((f) => {
              const gy = PT + (BASE - PT) * (1 - f);
              const maxV = Math.max(...bars.flatMap((s) => [s.start, s.end]), 1);
              return (
                <g key={f}>
                  <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke={t.grid} strokeWidth="1" strokeDasharray="2 4" opacity="0.6" />
                  <text x={PL - 4} y={gy + 4} textAnchor="end" fontSize="10" fill={t.text.muted}>{fmt(Math.round(maxV * f))}</text>
                </g>
              );
            })}

          {bars.map((b, i) => {
            const on = isOn(b);
            const dim = !on || (hover != null && hover !== i);
            const next = bars[i + 1];
            return (
              <g key={b.label} opacity={dim ? 0.32 : 1}>
                {i < bars.length - 1 && on && isOn(next) && (
                  <line x1={b.cx + b.barW / 2} y1={b.connY} x2={next.cx - next.barW / 2} y2={b.connY} stroke={t.text.muted} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
                )}
                {on && (
                  <rect
                    x={b.x}
                    y={b.yTop}
                    width={b.barW}
                    height={b.h}
                    rx="5"
                    fill={b.color}
                    style={{ transformOrigin: `${b.cx}px ${BASE}px`, transform: hover === i ? "scaleY(1.03)" : "none" }}
                  />
                )}
                {on && (
                  <text x={b.cx} y={b.yTop - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill={t.text.primary}>
                    {(b.type === "dec" ? "-" : b.type === "inc" ? "+" : "") + fmt(b.value)}
                  </text>
                )}
                {/* running total above each bar in detailed mode */}
                {detailed && on && b.type !== "total" && (
                  <text x={b.cx} y={b.yTop - 24} textAnchor="middle" fontSize="11" fontWeight="600" fill={t.text.muted}>
                    Σ {fmt(b.running)}
                  </text>
                )}
                <text x={b.cx} y={BASE + 20} textAnchor="middle" fontSize="12" fontWeight="500" fill={t.text.muted}>{b.label}</text>
                {/* hover hit-area spanning the full column height */}
                {on && (
                  <rect
                    x={b.cx - b.barW / 2 - 2}
                    y={PT}
                    width={b.barW + 4}
                    height={BASE - PT}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHover(i)}
                    onMouseMove={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                )}
              </g>
            );
          })}
        </svg>

        <ChartTooltip
          theme={t}
          visible={hb != null && isOn(hb)}
          left={hb ? `${(hb.cx / W) * 100}%` : "50%"}
          top={hb ? `${(hb.yTop / VBH) * 100}%` : "40%"}
          title={hb?.label}
          rows={
            hb
              ? [
                  { label: hb.type === "total" ? "Value" : "Delta", value: (hb.type === "dec" ? "-" : hb.type === "inc" ? "+" : "") + fmt(hb.value), color: hb.color },
                  { label: "Running total", value: fmt(hb.running) },
                ]
              : []
          }
        />

        {/* compact data table in detailed mode */}
        {detailed && (
          <div style={{ marginTop: 18, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: t.text.muted, textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", fontWeight: 600 }}>Item</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600 }}>Type</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Delta</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Running total</th>
                </tr>
              </thead>
              <tbody>
                {bars.map((b) => (
                  <tr key={b.label} style={{ borderTop: `1px solid ${t.grid}`, opacity: isOn(b) ? 1 : 0.4, color: t.text.secondary }}>
                    <td style={{ padding: "6px 8px", color: t.text.primary, fontWeight: 600 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color }} />
                        {b.label}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px" }}>{TYPE_META.find((m) => m.key === b.type)?.label ?? b.type}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{(b.type === "dec" ? "-" : b.type === "inc" ? "+" : "") + fmt(b.value)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: t.text.primary, fontWeight: 600 }}>{fmt(b.running)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );

    return (
      <ChartCard
        theme={t}
        title={title}
        controls={mergedControls}
        onControl={onControl}
        width={width}
        size={size}
        className={className}
        footer={<Legend theme={t} items={legendItems} swatch="dot" onToggle={toggle} />}
      >
        {renderBody}
      </ChartCard>
    );
  }
);

WaterfallChart.displayName = "WaterfallChart";
export default WaterfallChart;
