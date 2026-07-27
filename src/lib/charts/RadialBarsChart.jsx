import React, { useMemo, useState, memo } from "react";
import { resolveTheme, arcPath, polar } from "./theme";
import { ChartCard, Legend, ChartTooltip, Stat } from "./chrome";

/**
 * RadialBarsChart — concentric progress rings (one per metric, value 0..100).
 * Props: title, theme, controls, items:[{label,value,color?}], size.
 * - Hover a ring for a tooltip (label + value%).
 * - Sort control reorders the rings by value (asc/desc) or original order.
 * - Legend swatch click toggles a ring (active:false dims + strikethrough).
 * - detailed=true (expand modal) draws each ring's value% as a label on the ring.
 */
const SIZE = 240;
const C = SIZE / 2;
const START = 135;
const SWEEP = 270;

const RadialBarsChart = memo(
  ({
    title = "Goals",
    subtitle,
    theme,
    controls,
    onControl,
    items = [
      { label: "Revenue", value: 82 },
      { label: "Signups", value: 64 },
      { label: "Retention", value: 91 },
    ],
    width = 380,
    size = "m",
    expandable = false,
    className = "",
  }) => {
    const t = resolveTheme(theme, "dark");

    // stable color per item (by original index)
    const colored = useMemo(
      () => items.map((it, i) => ({ ...it, color: it.color || t.series[i % t.series.length] })),
      [items, t.series]
    );

    // which rings are active (toggled via the legend). keyed by label.
    const [hidden, setHidden] = useState({});
    const isActive = (s) => !hidden[s.label];
    const toggle = (key) => setHidden((h) => ({ ...h, [key]: !h[key] }));

    const [sort, setSort] = useState("none"); // none | desc | asc
    const [hover, setHover] = useState(null); // index into `rings`

    const rings = useMemo(() => {
      const active = colored.filter(isActive);
      const ordered =
        sort === "desc" ? [...active].sort((a, b) => b.value - a.value)
        : sort === "asc" ? [...active].sort((a, b) => a.value - b.value)
        : active;
      const outer = C - 14;
      const step = 26;
      return ordered.slice(0, 4).map((it, i) => {
        const r = outer - i * step;
        const v = Math.min(it.value, 100);
        const end = START + (v / 100) * SWEEP;
        const mid = START + (v / 100) * SWEEP * 0.5;
        return {
          ...it,
          r,
          track: arcPath(C, C, r, START, START + SWEEP),
          prog: arcPath(C, C, r, START, end),
          // anchor for tooltip / detailed label at the end of the progress arc
          end: polar(C, C, r, end),
          mid: polar(C, C, r, mid),
        };
      });
    }, [colored, hidden, sort]);

    const legendItems = colored.map((s) => ({
      key: s.label,
      label: s.label,
      color: s.color,
      active: isActive(s),
      value: `${s.value}%`,
    }));

    const sortControl = {
      type: "sort",
      value: sort,
      options: [
        { label: "Original order", value: "none" },
        { label: "Highest first", value: "desc" },
        { label: "Lowest first", value: "asc" },
      ],
      onChange: (v) => setSort(v),
    };
    const resolvedControls = controls ?? [sortControl];

    const hovered = hover != null ? rings[hover] : null;

    // summary stats + a ranked breakdown table for the expanded/detailed view —
    // same visual language as DualLineChart's detailed mode.
    const overallStats = useMemo(() => {
      if (!rings.length) return null;
      const vals = rings.map((r) => r.value);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      const top = [...rings].sort((a, b) => b.value - a.value)[0];
      const bottom = [...rings].sort((a, b) => a.value - b.value)[0];
      return { avg, top, bottom };
    }, [rings]);

    const renderStats = () => overallStats && (
      <div
        style={{
          position: "relative", overflow: "hidden", borderRadius: 16, marginTop: 20,
          border: `1px solid ${t.accent}28`, padding: "18px 16px 16px",
          background: `linear-gradient(160deg, ${t.accent}14, transparent 65%)`,
          boxShadow: "0 8px 24px -14px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: t.accent }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <Stat theme={t} label="Average" value={`${Math.round(overallStats.avg)}%`} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: overallStats.top.color }}>{overallStats.top.label}</div>
            <div style={{ fontSize: 12, color: t.text.muted }}>Highest · {overallStats.top.value}%</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: overallStats.bottom.color }}>{overallStats.bottom.label}</div>
            <div style={{ fontSize: 12, color: t.text.muted }}>Lowest · {overallStats.bottom.value}%</div>
          </div>
        </div>
      </div>
    );

    const renderTable = () => (
      <div
        style={{
          marginTop: 20, borderRadius: 16, border: `1px solid ${t.control.border}`,
          overflow: "hidden", boxShadow: "0 8px 24px -16px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: t.text.secondary, background: t.mode === "light" ? "#f1f5f9" : "rgba(255,255,255,0.05)" }}>
                <th style={{ padding: "10px 14px", fontWeight: 700 }}>Metric</th>
                <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {[...rings].sort((a, b) => b.value - a.value).map((r, i) => (
                <tr
                  key={r.label}
                  style={{
                    borderTop: i === 0 ? "none" : `1px solid ${t.control.border}`,
                    background: i % 2 === 0 ? "transparent" : (t.mode === "light" ? "#f8fafc" : "rgba(255,255,255,0.02)"),
                    color: t.text.primary,
                  }}
                >
                  <td style={{ padding: "9px 14px", fontWeight: 600 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color }} />
                      {r.label}
                    </span>
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>
                    <span style={{ padding: "2px 9px", borderRadius: 999, fontWeight: 700, fontSize: 12, background: `${r.color}1a`, color: r.color }}>
                      {r.value}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <ChartCard
        theme={t}
        title={title}
        subtitle={subtitle}
        controls={resolvedControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
        footer={<Legend theme={t} items={legendItems} swatch="dot" onToggle={toggle} />}
        footerDetailed={<Legend theme={t} items={legendItems} swatch="dot" onToggle={toggle} />}
      >
        {({ detailed }) => (
          <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label={title}>
              {rings.map((r, i) => {
                const dim = hover != null && hover !== i;
                return (
                  <g key={r.label}>
                    <path d={r.track} fill="none" stroke={t.track} strokeWidth="12" strokeLinecap="round" opacity="0.5" />
                    <path
                      d={r.prog}
                      fill="none"
                      stroke={r.color}
                      strokeWidth="12"
                      strokeLinecap="round"
                      opacity={dim ? 0.4 : 1}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHover(i)}
                      onMouseMove={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}

              {/* detailed mode: value% label on each ring (at the arc midpoint) */}
              {detailed &&
                rings.map((r) => (
                  <text
                    key={`lbl-${r.label}`}
                    x={r.mid[0]}
                    y={r.mid[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill={t.text.primary}
                  >
                    {r.value}%
                  </text>
                ))}
            </svg>

            <ChartTooltip
              theme={t}
              visible={!!hovered}
              left={hovered ? `${(hovered.end[0] / SIZE) * 100}%` : "50%"}
              top={hovered ? `${(hovered.end[1] / SIZE) * 100}%` : "50%"}
              title={hovered ? hovered.label : ""}
              rows={hovered ? [{ label: "Progress", value: `${hovered.value}%`, color: hovered.color }] : []}
            />

            {detailed && renderStats()}
            {detailed && renderTable()}
          </div>
        )}
      </ChartCard>
    );
  }
);

RadialBarsChart.displayName = "RadialBarsChart";
export default RadialBarsChart;
