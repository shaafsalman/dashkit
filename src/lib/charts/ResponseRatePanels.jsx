import React, { useMemo, memo, useState } from "react";
import { resolveTheme } from "./theme";
import { ChartCard, ChartTooltip } from "./chrome";
import { useMeasuredBox } from "./useMeasuredBox";

/**
 * ResponseRatePanels — "Customer Satisfaction".
 * Rising panels: a soft downward gradient fill capped by a solid colored top
 * contour line (flat then sloping to a lower shelf), with dotted vertical guides
 * (left edge + shelf), a top dot, and a big percentage. Chrome via ChartCard.
 *
 * Each item: { value, caption, color? }. color defaults to the theme accent.
 */

const DEFAULT_ITEMS = [
  { value: 42, caption: "Response rate", color: "#1f2937" },
  { value: 62, caption: "Response rate", color: "#e0653a" },
  { value: 96, caption: "Response rate", color: "#7a2c18" },
];

const ResponseRatePanels = memo(
  ({
    title = "Customer Satisfaction",
    subtitle,
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
    const [panelRef, panelBox] = useMeasuredBox({ width: 560, height: 320 });

    const ordered = useMemo(() => {
      const arr = items.map((it, i) => ({ ...it, _i: i }));
      if (sort === "asc") arr.sort((a, b) => a.value - b.value);
      else if (sort === "desc") arr.sort((a, b) => b.value - a.value);
      return arr;
    }, [items, sort]);

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
    const average = ordered.length
      ? Math.round(ordered.reduce((sum, item) => sum + Number(item.value || 0), 0) / ordered.length)
      : 0;

    const chartW = Math.max(panelBox.width, 280);
    const chartH = Math.max(panelBox.height, 180);
    const axisW = chartW < 420 ? 34 : 48;
    // Keep a real label band above the 100% gridline. The old 34–46px top
    // offset let a large first value rise outside the SVG/body and appear
    // cut off beneath the card header.
    const top = chartH < 260 ? 56 : 78;
    const base = chartH - 24;
    const panels = useMemo(() => {
      const gap = Math.max(8, Math.min(26, chartW * 0.022));
      const count = Math.max(ordered.length, 1);
      const panelW = (chartW - axisW - gap * (count - 1)) / count;
      return ordered.map((item, index) => {
        const value = Math.max(0, Math.min(100, Number(item.value) || 0));
        const color = item.color || t.accent;
        const x0 = axisW + index * (panelW + gap);
        const x1 = x0 + panelW;
        const visible = Math.max(value, 18);
        const height = ((base - top) * visible) / 100;
        const plateauY = base - height;
        const shelfX = x0 + panelW * 0.68;
        const shelfY = plateauY + height * 0.2;
        return {
          ...item, value, color, x0, x1, panelW, shelfX, plateauY,
          fill: `M ${x0} ${base} L ${x0} ${plateauY} L ${shelfX} ${plateauY} L ${x1} ${shelfY} L ${x1} ${base} Z`,
          cap: `M ${x0} ${plateauY} L ${shelfX} ${plateauY} L ${x1} ${shelfY}`,
        };
      });
    }, [ordered, chartW, axisW, base, top, t.accent]);

    const renderPanels = () => (
      <div ref={panelRef} style={{ position: "relative", height: "100%", minHeight: 180 }}>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height="100%" role="img" aria-label={title} style={{ display: "block" }}>
          <defs>{panels.map((panel) => <linearGradient key={panel._i} id={`rr-${panel._i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={panel.color} stopOpacity="0.46" /><stop offset="100%" stopColor={panel.color} stopOpacity="0.04" /></linearGradient>)}</defs>
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = base - ((base - top) * tick) / 100;
            return <g key={tick}><line x1={axisW} y1={y} x2={chartW} y2={y} stroke={t.grid} strokeDasharray="4 5" /><text x={axisW - 7} y={y + 4} textAnchor="end" fontSize="10" fontFamily="'JetBrains Mono', monospace" fill={t.text.muted}>{tick}%</text></g>;
          })}
          {panels.map((panel) => {
            const active = hover == null || hover === panel._i;
            const labelSize = Math.max(17, Math.min(36, panel.panelW * 0.18));
            const valueY = Math.max(labelSize + 5, panel.plateauY - 28);
            const captionY = Math.max(labelSize + 22, panel.plateauY - 8);
            return <g key={panel._i} opacity={active ? 1 : 0.42} style={{ transition: "opacity .18s ease" }}>
              <path d={panel.fill} fill={`url(#rr-${panel._i})`} />
              <line x1={panel.x0} y1={panel.plateauY} x2={panel.x0} y2={base} stroke={panel.color} strokeWidth="1.25" strokeDasharray="2 5" opacity="0.45" />
              <line x1={panel.shelfX} y1={panel.plateauY} x2={panel.shelfX} y2={base} stroke={panel.color} strokeWidth="1.25" strokeDasharray="2 5" opacity="0.35" />
              <path d={panel.cap} fill="none" stroke={panel.color} strokeWidth={hover === panel._i ? 5 : 3.5} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={panel.x0} cy={panel.plateauY} r={hover === panel._i ? 5 : 4} fill={panel.color} />
              <text x={(panel.x0 + panel.x1) / 2} y={valueY} textAnchor="middle" fontSize={labelSize} fontWeight="850" fill={panel.color}>{panel.value}<tspan fontSize={labelSize * 0.46} dx="2">%</tspan></text>
              <text x={(panel.x0 + panel.x1) / 2} y={captionY} textAnchor="middle" fontSize={Math.max(10, Math.min(13, panel.panelW * 0.07))} fontWeight="700" fill={t.text.secondary}>{panel.caption}</text>
              <rect x={panel.x0} y={top - 8} width={panel.panelW} height={base - top + 8} fill="transparent" onMouseEnter={() => setHover(panel._i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }} />
            </g>;
          })}
        </svg>
        {panels.map((panel) => <ChartTooltip key={panel._i} theme={t} visible={hover === panel._i} left={`${((panel.x0 + panel.panelW / 2) / chartW) * 100}%`} top={`${(panel.plateauY / chartH) * 100}%`} title={panel.caption} rows={[{ label: "Value", value: `${panel.value}%`, color: panel.color }]} />)}
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
        floatingHeader
        headline={{ value: `${average}%` }}
      >
        {() => renderPanels()}
      </ChartCard>
    );
  }
);

ResponseRatePanels.displayName = "ResponseRatePanels";

export default ResponseRatePanels;
