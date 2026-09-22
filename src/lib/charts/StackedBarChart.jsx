import React, { useMemo, useState, memo } from "react";
import { resolveTheme, lighten, AXIS_CATEGORY_TICK, AXIS_VALUE_TICK, AXIS_GRID_PROPS } from "./theme";
import { ChartCard, Legend, ChartTooltip, Icons, SIZES } from "./chrome";
import { useMeasuredBox } from "./useMeasuredBox";
import { compactNumber } from "./format";

/**
 * StackedBarChart — "Team Performance": stacked rounded segments per period with
 * hatch texture, gridlines, hover tooltip. Chrome/theme/controls via ChartCard.
 */

const W_MIN = 640; // floor for the responsive viewBox width
const H = 640;
// The chart text is scaled to preserve a readable CSS-pixel size. Reserve the
// axis gutter in the same generous viewBox space so compact labels such as
// "25.0K" never lose their leading digit at narrow/container-driven sizes.
const PAD_L = 110;
const PAD_R = 30;
const PAD_X = PAD_L;
const TOP = 20;
const BASE = 590;
const SEG_GAP = 4;
const niceCeiling = (value) => {
  const safe = Math.max(Number(value) || 0, 1);
  const power = 10 ** Math.floor(Math.log10(safe));
  const normalized = safe / power;
  const stops = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const next = stops.find((stop) => stop > normalized + 1e-9) || 10;
  return next * power;
};
const DEFAULT_THEME = { base: "dark", surface: "#0c0d10", radius: 20, pad: 24, accent: "#e0701f" };

const DEFAULT_SERIES = [
  { key: "sales", label: "Sales", color: "#b3531f" },
  { key: "marketing", label: "Marketing", color: "#e0701f" },
  { key: "product", label: "Product Manager", color: "#f08a3c" },
  { key: "design", label: "Design Team", color: "#f7d9b8" },
  { key: "seo", label: "SEO", color: "#5c2c12" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DEFAULT_DATA = MONTHS.map((m, i) => ({
  label: m,
  values: {
    sales: 70 + ((i * 7) % 25),
    marketing: 60 + ((i * 5) % 30),
    product: 65 + ((i * 11) % 28),
    design: 75 + ((i * 3) % 22),
    seo: 55 + ((i * 13) % 30),
  },
}));

const StackedBarChart = memo(
  ({
    title = "Team Performance",
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    headerStatLabel = "Avg. Score",
    headerStatValue = "90%",
    headerStatChange,
    floatingHeader = false,
    showLegend = true,
    series = DEFAULT_SERIES,
    data = DEFAULT_DATA,
    suffix = "%",
    grouped = false, // side-by-side bars per category instead of stacked (YoY)
    axisFormat, // optional (val:number)=>string for Y-axis tick labels
    valueFormat, // optional (val:number)=>string for tooltip / segment labels
    width = 1120,
    size = "l",
    heightScale = 1, // shrinks plot height only (viewBox stays full width) — no CSS letterboxing
    expandable = false,
    className = "",
    emptyLabel = "No data", // shown instead of the plot when data/series is empty
  }) => {
    const t = resolveTheme(theme || DEFAULT_THEME, "dark");
    // Shadow the module-level H/BASE with scaled versions so only the plot
    // area (not the bar width/aspect) shrinks.
    const H = Math.round(640 * heightScale);
    const BASE = Math.round(590 - (640 - H));

    // The viewBox WIDTH is derived from the real container so its aspect
    // ratio always equals the rendered box's. A fixed 1000x640 viewBox in a
    // card that is wide but height-capped (`.cc-body svg{max-height:--cc-h}`)
    // scales to fit the HEIGHT, so the drawing rendered at roughly half the
    // available width and sat centered — the dead space on both sides. With
    // the ratios equal there is nothing left for the browser to letterbox.
    const [boxRef, box] = useMeasuredBox({ width: 1000, height: 300 });
    const fluid = size === "fill";
    const plotH = fluid
      ? Math.max(box.height || 300, 180)
      : Math.max((SIZES[size] || SIZES.m) * heightScale, 80);
    const W = Math.max(Math.round((H * box.width) / plotH), W_MIN);
    // viewBox units per CSS pixel — keeps text at a stable on-screen size no
    // matter how wide the card gets.
    const u = H / plotH;
    const fpx = (cssPx) => Math.round(cssPx * u * 10) / 10;
    const valueTick = { ...AXIS_VALUE_TICK, fontSize: fpx(12) };
    const categoryTick = { ...AXIS_CATEGORY_TICK, fontSize: fpx(12.5) };
    const fmtAxis = axisFormat || ((v) => compactNumber(v));
    const fmtVal = valueFormat || ((v) => `${compactNumber(v)}${suffix}`);
    const [hover, setHover] = useState(null);
    // own state: which series are hidden (keyed by series key)
    const [hidden, setHidden] = useState({});

    const toggle = (key) =>
      setHidden((h) => ({ ...h, [key]: !h[key] }));

    // series actually drawn (respecting the hidden toggles)
    const activeSeries = useMemo(
      () => series.filter((sr) => !hidden[sr.key]),
      [series, hidden]
    );

    const { cols, barW, gridY, maxTotal } = useMemo(() => {
      const n = data.length;
      const step = (W - PAD_L - PAD_R) / n;
      const gridY = Array.from({ length: 5 }, (_, k) => TOP + ((BASE - TOP) * k) / 4);

      if (grouped) {
        // side-by-side: each category holds one sub-bar per active series
        const m = Math.max(activeSeries.length, 1);
        // Keep grouped columns visually light instead of letting two series
        // consume almost the entire category slot. The axis/domain remains
        // independent from this presentation width (and from legend toggles).
        const barW = Math.min(step * 0.24, fpx(34));
        const barGap = fpx(6);
        const groupW = m * barW + Math.max(0, m - 1) * barGap;
        const allVals = data.flatMap((d) =>
          series.map((sr) => d.values?.[sr.key] || 0)
        );
        const dataMax = Math.max(...allVals, 1);
        const maxTotal = niceCeiling(dataMax);
        const scale = (BASE - TOP) / maxTotal;
        const cols = data.map((d, i) => {
          const cx = PAD_L + step * (i + 0.5);
          const x0 = cx - groupW / 2;
          const segs = activeSeries.map((sr, k) => {
            const value = d.values?.[sr.key] || 0;
            const h = Math.max(value * scale, value > 0 ? 3 : 0);
            const topY = BASE - h;
            return { ...sr, value, topY, h, x: x0 + k * (barW + barGap), w: barW };
          });
          return { ...d, cx, segs, i };
        });
        return { cols, barW, gridY, maxTotal };
      }

      // Cap in CSS px so a 2-bar "Both" view doesn't render two slabs half
      // the card wide, while a 12-month view still fills the space.
      const barW = Math.min(step * 0.7, fpx(78));
      const totals = data.map((d) =>
        series.reduce((s, sr) => s + (d.values?.[sr.key] || 0), 0)
      );
      const maxTotal = niceCeiling(Math.max(...totals, 1));
      const scale = (BASE - TOP - Math.max(activeSeries.length - 1, 0) * SEG_GAP) / maxTotal;
      const cols = data.map((d, i) => {
        const cx = PAD_L + step * (i + 0.5);
        let yBottom = BASE;
        const segs = activeSeries.map((sr) => {
          const value = d.values?.[sr.key] || 0;
          const h = Math.max(value * scale, value > 0 ? 4 : 0);
          const topY = yBottom - h;
          const seg = { ...sr, value, topY, h };
          yBottom = topY - SEG_GAP;
          return seg;
        });
        return { ...d, cx, segs, i };
      });
      return { cols, barW, gridY, maxTotal };
    }, [data, series, activeSeries, grouped, W, H, BASE, u]);

    const tip = hover != null ? cols[hover] : null;
    // position the tooltip over the hovered column as viewBox-relative percentages
    const tipLeft = tip ? `${Math.max(8, Math.min((tip.cx / W) * 100, 88))}%` : "50%";
    const tipTopPct = tip ? (Math.min(...tip.segs.map((s) => s.topY ?? TOP), BASE) / H) * 100 : 40;
    const tipTop = `${tipTopPct}%`;
    // a tall stack tops out near the card edge — flip the tooltip below the
    // anchor there, or it renders clipped by the card boundary
    const tipFlip = tipTopPct < 35;

    // filter control + legend share this state
    const filterItems = series.map((sr) => ({
      key: sr.key,
      label: sr.label,
      color: sr.color,
      active: !hidden[sr.key],
    }));
    const filterControl = { type: "filter", items: filterItems, onToggle: toggle };
    const mergedControls = controls
      ? [...controls, filterControl]
      : [filterControl];

    const legendItems = series.map((sr) => ({
      key: sr.key,
      label: sr.label,
      color: sr.color,
      active: !hidden[sr.key],
    }));

    // With no categories `step` divides by zero and every derived coordinate
    // becomes NaN, which React renders as a blank card. Bail to an explicit
    // empty state instead — the card (and its period control) stays mounted.
    const isEmpty = !data.length || !series.length;

    const renderEmpty = () => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 140, height: "100%", color: t.text.muted, fontSize: 13 }}>
        {emptyLabel}
      </div>
    );

    const renderChart = (detailed) => (
      <div
        ref={boxRef}
        style={{ position: "relative", width: "100%", height: fluid && !detailed ? "100%" : plotH, minHeight: 0 }}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label={title}>
          <defs>
            <pattern id="tp-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.10" />
            </pattern>
            {series.map((sr) => (
              <linearGradient key={`g-${sr.key}`} id={`tp-${sr.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sr.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={sr.color} stopOpacity="1" />
              </linearGradient>
            ))}
          </defs>

          {gridY.map((y, i) => {
            const val = maxTotal * ((gridY.length - 1 - i) / (gridY.length - 1));
            return (
              <g key={i}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke={t.grid} strokeDasharray={AXIS_GRID_PROPS.strokeDasharray} />
                <text x={PAD_L - 8} y={y + fpx(4)} textAnchor="end" {...valueTick} fill={t.text.muted}>
                  {fmtAxis(val)}
                </text>
              </g>
            );
          })}

          {cols.map((c) => (
            <g
              key={c.label}
              onMouseEnter={() => setHover(c.i)}
              style={{ cursor: "pointer" }}
            >
              <rect x={c.cx - barW / 2 - 6} y={TOP} width={barW + 12} height={BASE - TOP} fill="transparent" />
              {c.segs.map(
                (s) =>
                  s.value > 0 && (
                    <g key={s.key} opacity={hover == null || hover === c.i ? 1 : 0.45} style={{ transition: "opacity .18s ease" }}>
                      <rect x={s.x ?? c.cx - barW / 2} y={s.topY} width={s.w ?? barW} height={s.h} rx={Math.min(8, (s.w ?? barW) / 2, s.h / 2)} fill={`url(#tp-${s.key})`} />
                      <rect x={s.x ?? c.cx - barW / 2} y={s.topY} width={s.w ?? barW} height={s.h} rx={Math.min(8, (s.w ?? barW) / 2, s.h / 2)} fill="url(#tp-hatch)" />
                      {grouped && !detailed && (s.w ?? barW) >= fpx(18) && (
                        <text
                          x={(s.x ?? c.cx - barW / 2) + (s.w ?? barW) / 2}
                          y={Math.max(fpx(13), s.topY - fpx(10))}
                          textAnchor="middle"
                          fontSize={fpx(12)}
                          fontWeight="750"
                          fontFamily="'JetBrains Mono', monospace"
                          fill={t.text.primary}
                        >
                          {fmtVal(s.value)}
                        </text>
                      )}
                      {/* detailed-only: value label centered in each segment (when it fits) */}
                      {detailed && s.h >= 16 && (
                        <text
                          x={(s.x ?? c.cx - barW / 2) + (s.w ?? barW) / 2}
                          y={s.topY + s.h / 2 + 4}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="700"
                          fill={t.mode === "light" ? "#0f172a" : "#ffffff"}
                        >
                          {fmtVal(s.value)}
                        </text>
                      )}
                    </g>
                  )
              )}
              <text x={c.cx} y={BASE + fpx(18)} textAnchor="middle" dominantBaseline="middle" {...categoryTick} fill={t.text.secondary}>
                {c.label}
              </text>
            </g>
          ))}
        </svg>

        <ChartTooltip
          theme={t}
          visible={!!tip}
          left={tipLeft}
          top={tipTop}
          flip={tipFlip}
          title={tip ? tip.tooltipLabel || tip.label : ""}
          rows={
            tip
              ? [...tip.segs]
                  .reverse()
                  .map((s) => ({
                    label: s.label,
                    color: s.color,
                    value: fmtVal(s.value),
                  }))
              : []
          }
        />
      </div>
    );

    return (
      <ChartCard
        theme={t}
        title={title}
        icon={icon ?? <Icons.users size={18} />}
        iconColor={iconColor}
        controls={mergedControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
        style={{ position: "relative" }}
        floatingHeader={floatingHeader}
        headline={
          floatingHeader
            ? {
                label: headerStatLabel,
                value: headerStatValue,
                change: headerStatChange,
                legend: showLegend ? <Legend theme={t} items={legendItems} swatch="dot" onToggle={toggle} compact /> : null,
              }
            : undefined
        }
        footer={!floatingHeader && showLegend ? <Legend theme={t} items={legendItems} swatch="dot" onToggle={toggle} /> : null}
      >
        {({ detailed }) => (isEmpty ? renderEmpty() : renderChart(detailed))}
      </ChartCard>
    );
  }
);

StackedBarChart.displayName = "StackedBarChart";

export default StackedBarChart;
