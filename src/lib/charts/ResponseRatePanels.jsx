import React, { useMemo, memo, useState } from "react";
import { resolveTheme } from "./theme";
import { ChartCard, ChartTooltip } from "./chrome";

/**
 * ResponseRatePanels — "Customer Satisfaction".
 * Rising panels: a soft downward gradient fill capped by a solid colored top
 * contour line (flat then sloping to a lower shelf), with dotted vertical guides
 * (left edge + shelf), a top dot, and a big percentage. Chrome via ChartCard.
 *
 * Each item: { value, caption, color? }. color defaults to the theme accent.
 */

const W = 560;
const H = 600; // taller viewBox so panels fill the (tall) card instead of letter-boxing
const BASE = 560;
const TOP = 40; // panels fill the card height
const AX = 66; // left gutter for the Y axis (fits the larger % labels)

const DEFAULT_ITEMS = [
  { value: 42, caption: "Response rate", color: "#1f2937" },
  { value: 62, caption: "Response rate", color: "#e0653a" },
  { value: 96, caption: "Response rate", color: "#7a2c18" },
];

const ResponseRatePanels = memo(
  ({
    title = "Customer Satisfaction",
    theme,
    controls,
    onControl,
    items = DEFAULT_ITEMS,
    width = 520,
    size = "m",
    expandable = false,
    className = "",
  }) => {
    const t = resolveTheme(theme, "light");
    const [hover, setHover] = useState(null); // panel key
    const [sort, setSort] = useState("none"); // none | asc | desc

    const yTicks = [0, 25, 50, 75, 100];
    const yOf = (p) => BASE - (p / 100) * (BASE - TOP);

    const ordered = useMemo(() => {
      const arr = items.map((it, i) => ({ ...it, _i: i }));
      if (sort === "asc") arr.sort((a, b) => a.value - b.value);
      else if (sort === "desc") arr.sort((a, b) => b.value - a.value);
      return arr;
    }, [items, sort]);

    const panels = useMemo(() => {
      const n = ordered.length;
      const gap = 26;
      const pw = (W - AX - gap * (n - 1)) / n;
      return ordered.map((it, i) => {
        const color = it.color || t.accent;
        const x0 = AX + i * (pw + gap);
        const x1 = x0 + pw;
        // Scale panel height — enforce a 28% minimum so short values stay readable
        const MIN_VIS = 28;
        const visualPct = Math.max(Math.min(it.value, 100), MIN_VIS);
        const h = ((BASE - TOP) * visualPct) / 100;
        const plateauY = BASE - h;
        const shelfX = x0 + pw * 0.66;
        const shelfY = plateauY + h * 0.2;
        const fill = `M ${x0} ${BASE} L ${x0} ${plateauY} L ${shelfX} ${plateauY} L ${x1} ${shelfY} L ${x1} ${BASE} Z`;
        const cap = `M ${x0} ${plateauY} L ${shelfX} ${plateauY} L ${x1} ${shelfY}`;
        const dotY = plateauY - 56;
        return { ...it, color, x0, x1, pw, shelfX, plateauY, dotY, labelY: dotY, fill, cap, key: it._i };
      });
    }, [ordered, t.accent]);

    const sortControl = {
      type: "sort",
      value: sort,
      options: [
        { label: "Original order", value: "none" },
        { label: "Lowest first", value: "asc" },
        { label: "Highest first", value: "desc" },
      ],
      onChange: (v) => setSort(v),
    };
    const resolvedControls = controls ?? [sortControl];

    return (
      <ChartCard
        theme={t}
        title={title}
        controls={resolvedControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
      >
        {({ detailed }) => (
          <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" role="img" aria-label={title}>
              <defs>
                {panels.map((p) => (
                  <linearGradient key={`g-${p.key}`} id={`rr-${p.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={p.color} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={p.color} stopOpacity="0" />
                  </linearGradient>
                ))}
              </defs>

              {/* Y axis + gridlines */}
              {yTicks.map((p) => (
                <g key={`yt-${p}`}>
                  <line x1={AX} y1={yOf(p)} x2={W} y2={yOf(p)} stroke={t.grid} strokeDasharray="4 5" />
                  <text x={AX - 8} y={yOf(p) + 6} textAnchor="end" fontSize="22" fontWeight="600" fill={t.text.secondary}>{p}%</text>
                </g>
              ))}
              {/* X + Y axis lines */}
              <line x1={AX} y1={TOP - 8} x2={AX} y2={BASE} stroke={t.text.muted} strokeOpacity="0.4" />
              <line x1={AX} y1={BASE} x2={W} y2={BASE} stroke={t.text.muted} strokeOpacity="0.4" />

              {panels.map((p) => {
                const on = hover === p.key;
                return (
                  <g key={p.key} opacity={hover == null || on ? 1 : 0.45}>
                    <path d={p.fill} fill={`url(#rr-${p.key})`} />
                    <line x1={p.x0} y1={p.plateauY} x2={p.x0} y2={BASE} stroke={p.color} strokeWidth="1.5" strokeDasharray="1.5 5" opacity="0.45" />
                    <line x1={p.shelfX} y1={p.plateauY} x2={p.shelfX} y2={BASE} stroke={p.color} strokeWidth="1.5" strokeDasharray="1.5 5" opacity="0.35" />
                    <path d={p.cap} fill="none" stroke={p.color} strokeWidth={on ? 7 : 5} strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={p.x0} cy={p.plateauY} r={on ? 6.5 : 5} fill={p.color} />
                    {/* value + caption above the bar — always visible */}
                    <text
                      x={(p.x0 + p.x1) / 2} y={p.plateauY - 44}
                      textAnchor="middle" fontSize="54" fontWeight="900" fill={p.color}
                      pointerEvents="none"
                    >
                      {p.value}<tspan fontSize="24" fontWeight="700" dy="-10" dx="2">%</tspan>
                    </text>
                    <text
                      x={(p.x0 + p.x1) / 2} y={p.plateauY - 12}
                      textAnchor="middle" fontSize="17" fontWeight="600" fill={t.text.secondary}
                      pointerEvents="none"
                    >
                      {p.caption}
                    </text>
                    {/* transparent hover hit-area */}
                    <rect
                      x={p.x0} y={TOP - 8} width={p.pw} height={BASE - (TOP - 8)}
                      fill="transparent"
                      onMouseEnter={() => setHover(p.key)}
                      onMouseMove={() => setHover(p.key)}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}
            </svg>

            {panels.map((p) => (
              <ChartTooltip
                key={`tt-${p.key}`}
                theme={t}
                visible={hover === p.key}
                left={`${((p.x0 + p.pw / 2) / W) * 100}%`}
                top={`${(p.plateauY / H) * 100}%`}
                title={p.caption}
                rows={[{ label: "Value", value: `${p.value}%`, color: p.color }]}
              />
            ))}

            {/* detailed: full value breakdown table */}
            {detailed && (
              <table style={{ width: "100%", marginTop: 18, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: t.text.muted }}>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Series</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Caption</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600, textAlign: "right" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {panels.map((p, i) => (
                    <tr key={`row-${p.key}`} style={{ borderTop: `1px solid ${t.control.border}`, color: t.text.secondary }}>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
                          Panel {i + 1}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px" }}>{p.caption}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: t.text.primary }}>{p.value}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </ChartCard>
    );
  }
);

ResponseRatePanels.displayName = "ResponseRatePanels";

export default ResponseRatePanels;
