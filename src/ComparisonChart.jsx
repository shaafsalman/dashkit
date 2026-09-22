import React, { useState, useMemo, memo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BarChart,
  Bar,
  ComposedChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { AXIS_CATEGORY_TICK, AXIS_VALUE_TICK, AXIS_GRID_PROPS } from "./lib/charts/theme";
import { resolveTheme } from "./lib/charts/theme";
import { ChartCard } from "./lib/charts/chrome";
import { compactNumber } from "./lib/charts/format";
import useContainerDensity from "./widgets/useContainerDensity.js";
import {
  BarChart3,
  Layers,
  TrendingUp,
  Calculator,
  Award,
  Target,
  ChevronDown,
  ChevronUp,
  Maximize2,
  X,
} from "lucide-react";

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// Fallback only — every widget in Dashboard.jsx now passes its own `colors`
// pair (see DashboardComponents.WIDGET_CONFIGS). Drawn from the app's actual
// established multi-category palette (colorConfig.js's chartPalettes.
// multiPalette, the same one the station/country breakdown lists use) — not
// an invented one.
const COLORS = [
  "#0f766e",
  "#0ea5e9",
  "#FFA500",
  "#22c55e",
  "#4ecdc4",
  "#ffeaa7",
];
const CHART_TYPES = [
  { id: "bar", label: "Bar", icon: BarChart3 },
  { id: "area", label: "Area", icon: Layers },
  { id: "line", label: "Line", icon: TrendingUp },
];
const STATS = [
  { key: "sum", label: "Total", icon: Calculator },
  { key: "average", label: "Avg", icon: Target },
  { key: "highest", label: "Peak", icon: Award },
];
const MONTHS = {
  January: "Jan",
  February: "Feb",
  March: "Mar",
  April: "Apr",
  May: "May",
  June: "Jun",
  July: "Jul",
  August: "Aug",
  September: "Sep",
  October: "Oct",
  November: "Nov",
  December: "Dec",
};
const MONTH_ORDER = Object.keys(MONTHS);
const MONTH_INDEX = new Map(
  MONTH_ORDER.flatMap((month, index) => [[month, index], [MONTHS[month], index]])
);

const fmt = (v, pct) =>
  pct
    ? `${Math.round(v)}%`
    : compactNumber(v);

const Tooltip = memo(({ active, payload, label, f }) =>
  active && payload?.length ? (
    <div className="bg-[var(--chart-tooltip-bg)] border-2 border-[var(--chart-tooltip-border)] p-3">
      <div
        className="font-bold text-gray-900 dark:text-white border-b border-[var(--chart-tooltip-border)] pb-2 mb-2"
        style={{ fontFamily: SANS }}
      >
        {label}
      </div>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: e.color }}
            />
            <span className="text-gray-600 dark:text-gray-300 font-medium text-sm" style={{ fontFamily: SANS }}>
              {e.dataKey}
            </span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white text-sm" style={{ fontFamily: MONO }}>
            {f(e.value)}
          </span>
        </div>
      ))}
    </div>
  ) : null
);

// Font size follows the actual rendered bar width (Recharts hands the label
// renderer the real `width` it drew, same signal VerticalBarView's
// getLabelSizing uses) — a fixed 10px/9px pair was fine at 24px-wide bars but
// collided into unreadable overlap once density pushed bars down to auto-fit
// widths in the single digits.
const barLabelSizing = (width) => {
  if (width >= 24) return { main: 10, sub: 8 };
  if (width >= 16) return { main: 9, sub: 7 };
  if (width >= 10) return { main: 7, sub: 6 };
  return { main: 6, sub: 0 }; // too narrow for two stacked lines — value only
};

// With bars touching (barGap 0), a label wider than its OWN bar spills into
// the neighboring bar's label — that's the fused/overlapping text. There's
// no live text-measurement API available in this render-prop, so estimate
// width from JetBrains Mono's fixed glyph advance (~0.6x font size for a
// monospace face) and, only when that estimate exceeds the bar's width,
// tell the SVG renderer to compress the glyphs down to fit exactly — text
// that already fits is left alone rather than stretched to fill the width.
const fitToWidth = (text, fontSize, maxWidth) => {
  const estWidth = String(text).length * fontSize * 0.62;
  return estWidth > maxWidth
    ? { textLength: maxWidth, lengthAdjust: "spacingAndGlyphs" }
    : {};
};

const BarLabel = memo(({ x, y, width, value, f, total }) => {
  if (!value) return null;
  const s = barLabelSizing(width);
  // Reverted: aligning every label in a group to the tallest bar's height
  // seemed cleaner, but with bars now touching (barGap 0) it removed the
  // ONLY thing keeping two adjacent labels apart — each bar's OWN height is
  // what naturally staggers them vertically so they don't collide
  // horizontally. Without that stagger the two labels sat at the identical
  // height right next to each other and fused into unreadable text.
  const subY = y - 5;
  const mainY = s.sub ? subY - (s.main + 2) : y - 6;
  const mainText = f(value);
  const subText = `${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%`;
  return (
    <g>
      <text
        x={x + width / 2}
        y={mainY}
        fill="var(--chart-tick-strong)"
        textAnchor="middle"
        fontSize={s.main}
        fontWeight="800"
        fontFamily={MONO}
        {...fitToWidth(mainText, s.main, width)}
      >
        {mainText}
      </text>
      {s.sub > 0 && (
        <text
          x={x + width / 2}
          y={subY}
          fill="var(--chart-tick-dim)"
          textAnchor="middle"
          fontSize={s.sub}
          fontWeight="600"
          fontFamily={MONO}
          {...fitToWidth(subText, s.sub, width)}
        >
          {subText}
        </text>
      )}
    </g>
  );
});

const Empty = memo(({ title, Icon }) => (
  <div className="h-full bg-[var(--chart-tooltip-bg)] border-2 border-[var(--chart-tooltip-border)]">
    <div className="bg-[var(--chart-tooltip-bg)] p-2.5 border-b border-[var(--chart-tooltip-border)] flex items-center gap-3">
      <Icon className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" />
      <h2 className="text-[15px] font-extrabold text-gray-900 dark:text-white" style={{ fontFamily: SANS }}>
        {title}
      </h2>
    </div>
    <div className="text-center py-8 px-4">
      <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-white/10 border border-[var(--chart-tooltip-border)] flex items-center justify-center mb-4">
        <BarChart3 className="w-6 h-6 text-gray-400" />
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1" style={{ fontFamily: SANS }}>
        Select Years to Compare
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm" style={{ fontFamily: SANS }}>
        Choose years from above to start analyzing
      </p>
    </div>
  </div>
));

const Stat = memo(({ c, value, f, sm }) => (
  <div
    className={`flex items-center bg-gray-50 dark:bg-white/5 border border-[var(--chart-tooltip-border)] ${
      sm ? "gap-1 p-1" : "gap-2 p-2"
    }`}
  >
    <c.icon className={`${sm ? "w-3 h-3" : "w-4 h-4"} text-gray-400 shrink-0`} />
    <div className="flex flex-col min-w-0 flex-1">
      <div
        className={`${sm ? "text-[9px]" : "text-[10px]"} text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wide`}
        style={{ fontFamily: SANS }}
      >
        {c.label}
      </div>
      <div
        className={`${sm ? "text-sm" : "text-base"} font-extrabold text-gray-900 dark:text-white`}
        style={{ fontFamily: MONO }}
      >
        {f(value)}
      </div>
    </div>
  </div>
));

const ComparisonChart = memo(
  ({
    title,
    data,
    headerIcon: Icon = BarChart3,
    showPercentage = false,
    selectedYears = [],
    // Every widget defaulting to "bar" made a page of 15 of these read as one
    // repeated chart with a different title — callers can vary this per widget
    // (see DashboardComponents.WIDGET_CONFIGS' defaultType) for visual variety.
    defaultType = "bar",
    // Same story for color: every widget comparing the same years (2025 vs
    // 2026) picked the same fixed COLORS[i] by year index, so all 15 cards
    // rendered the identical blue/teal pair. Callers now pass their own
    // per-widget pair/palette; COLORS is the fallback when they don't.
    colors = null,
    // Hosts that already render their own title (the ranked widget's own
    // WidgetHeader) don't want this card's icon+title+switcher row too —
    // same "host owns the chrome, chart owns the plot" split DualLineChart
    // already uses via its own showHeader prop.
    showHeader = true,
    // The ranked widget hosts this chart INSIDE its own card (own border,
    // own WidgetHeader, own WidgetFooter stats row) — it wants just the
    // plot, none of this component's own chrome. `embedded` strips the
    // outer card (border/background), the header row (title AND this
    // component's own Bar/Area/Line switcher — redundant next to the host's
    // own view-mode switcher, which already picks bar vs area vs line), and
    // the footer (year totals + expand-to-stats — the host's own footer
    // already shows equivalent stats). Just ResponsiveContainer + the plot.
    embedded = false,
    libraryCard = false,
    subtitle,
    theme,
    width = "100%",
    size = "fill",
    expandable = false,
  }) => {
    const cardTheme = resolveTheme(theme, "light");
    const [type, setType] = useState(defaultType);
    const palette = colors && colors.length > 0 ? colors : COLORS;
    const color = useCallback((i) => palette[i % palette.length], [palette]);
    // SVG <linearGradient> ids are global to the whole document, not scoped
    // per <svg> — every widget comparing the same years built the exact same
    // id ("g-2026"), so whichever widget's gradient happened to land first
    // in the DOM "won" and got reused by every other widget's Area fill
    // (the "orange outline, wrong-color fill" bug). Needs a real per-instance
    // id, the same fix DualLineChart already uses for its own gradient.
    const uid = useRef(`cc-${Math.random().toString(36).slice(2, 8)}`).current;
    // Starts collapsed: this now renders inside a fixed-height bento cell
    // (like every other chart in the app), so the stats panel opening by
    // default and pushing the card past its cell's height was the direct
    // cause of it visually overlapping the row below.
    const [open, setOpen] = useState(false);
    // Own rendered width, not the viewport — this sits in bento cells as
    // narrow as 4/12 columns next to 8/12-column siblings, so a viewport
    // breakpoint would still render full-width chrome into a narrow box.
    const [densityRef, density, measuredWidth] = useContainerDensity();
    const compact = density !== "lg";
    // Plot density is intentionally independent from chrome density. A
    // 640px card still needs compact icon controls, but it has ample room for
    // twelve axis labels and values. Only genuinely narrow plots suppress
    // direct value labels; the tooltip remains available for every point.
    const plotCompact = measuredWidth != null && measuredWidth < 440;

    // Fullscreen modal — same expand/Escape/scroll-lock convention the
    // shared ChartCard already uses everywhere else in the chart library.
    const [expanded, setExpanded] = useState(false);
    useEffect(() => {
      if (!expanded) return undefined;
      const onKey = (e) => e.key === "Escape" && setExpanded(false);
      document.addEventListener("keydown", onKey);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prevOverflow;
      };
    }, [expanded]);

    const { chartData, stats, years, total, barSize } = useMemo(() => {
      if (!selectedYears?.length)
        return { chartData: [], stats: {}, years: [], total: 0, barSize: 24 };
      const years = [...selectedYears].sort((a, b) => a - b);
      const names = new Set();
      years.forEach((y) =>
        data?.[y]?.forEach?.((i) => names.add(i.name || i.label))
      );

      const rows = Array.from(names)
        .map((name) => {
          const r = { name, displayName: MONTHS[name] || name };
          years.forEach((y) => {
            r[y] =
              data?.[y]?.find?.((d) => (d.name || d.label) === name)?.value ||
              0;
          });
          return r;
        })
        .filter((r) => years.some((y) => r[y] > 0));

      const isMonth = rows.some((r) => MONTH_INDEX.has(r.name));
      const sorted = (
        isMonth
          ? rows.sort(
              (a, b) =>
                (MONTH_INDEX.get(a.name) ?? Number.MAX_SAFE_INTEGER) -
                (MONTH_INDEX.get(b.name) ?? Number.MAX_SAFE_INTEGER)
            )
          : rows.sort(
              (a, b) =>
                Math.max(...years.map((y) => b[y])) -
                Math.max(...years.map((y) => a[y]))
            )
      ).slice(0, 12);

      const stats = {};
      years.forEach((y) => {
        const v = sorted.map((r) => r[y]).filter((x) => x > 0);
        const sum = v.reduce((a, b) => a + b, 0);
        stats[y] = {
          sum,
          average: v.length ? sum / v.length : 0,
          highest: v.length ? Math.max(...v) : 0,
        };
      });

      const total = sorted.reduce(
        (s, r) => s + years.reduce((ys, y) => ys + r[y], 0),
        0
      );
      const n = years.length,
        len = sorted.length;
      // A fixed px barSize (the old n<=2 branch always used 24, ignoring
      // category count entirely) guarantees overflow once there are enough
      // categories that bars×barSize+gaps exceeds the plot width — exactly
      // the "24 bars it fails" failure mode fixed in VerticalBarView. Cap a
      // max width only while there's clearly room (few categories); beyond
      // that, leave barSize undefined so Recharts auto-fits bars to the
      // actual rendered container width — the only way to guarantee no
      // overflow without a container measurement.
      const barSize =
        len <= 3 ? 40 : len <= 6 ? 28 : len <= 10 ? 18 : undefined;
      return { chartData: sorted, stats, years, total, barSize };
    }, [data, selectedYears]);

    const f = useCallback((v) => fmt(v, showPercentage), [showPercentage]);
    const n = years.length;
    const labels = !plotCompact && !libraryCard;
    // A narrow bento cell needs the same compact stat treatment a 5-year
    // comparison already gets — both are "not enough width per column".
    const sm = n > 4 || compact;
    // Total now lives in the always-visible footer row (not in this expanded
    // panel), so each year-box only holds Avg+Peak — light enough that even
    // compact cards can afford 2 side by side instead of stacking them.
    const cols = Math.min(n, compact ? 2 : n <= 4 ? n : 5);

    const chart = useCallback(() => {
      const p = {
        data: chartData,
        // left:20/right:20 doubled up with the YAxis's own reserved width —
        // that width already IS the left gutter, so the margin on top of it
        // was pure dead space. top:40/bottom:10 were sized generously before
        // BarLabel existed; its two stacked lines only need ~26px of
        // headroom above the tallest bar.
        margin: compact
          ? { top: 30, right: 4, left: 2, bottom: 2 }
          : { top: 26, right: 8, left: 0, bottom: 0 },
      };
      const categorySlots = Math.max(3, Math.floor((measuredWidth || 600) / 50));
      const tickInterval = Math.max(0, Math.ceil(chartData.length / categorySlots) - 1);
      const xa = <XAxis dataKey="displayName" tick={{ ...AXIS_CATEGORY_TICK, fill: cardTheme.text.secondary }} axisLine={false} tickLine={false} interval={tickInterval} />;
      // 34px clipped the leading digit off 5-glyph ticks like "36.0K" — the
      // "6.0K"/"7.0K" truncation the user caught. 44px is the actual minimum
      // for that width at the shared axis font size.
      const ya = <YAxis tickFormatter={f} tick={{ ...AXIS_VALUE_TICK, fill: cardTheme.text.muted }} axisLine={false} tickLine={false} width={compact ? 44 : 55} />;
      const g = <CartesianGrid {...AXIS_GRID_PROPS} stroke={cardTheme.grid} vertical={false} />;
      const tt = <RechartsTooltip content={<Tooltip f={f} />} />;

      if (type === "area") {
        // Only the LAST (most recent) year gets a filled Area — filling
        // every year independently meant two semi-transparent fills
        // overlapping wherever one year's curve sat above another's,
        // blending into a muddy smear that read as a rendering glitch.
        // Matches DualLineChart's own "primary gets the fill, everything
        // else is a plain line" convention.
        const primaryIdx = years.length - 1;
        return (
          // ComposedChart, not AreaChart — mixing an Area with a plain Line
          // child inside <AreaChart> silently dropped the Line entirely (the
          // "where's the orange" bug: only the primary/filled year rendered
          // at all). DualLineChart mixes Area+Line the same way and always
          // uses ComposedChart for exactly this reason.
          <ComposedChart {...p}>
            <defs>
              <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color(primaryIdx)} stopOpacity={0.8} />
                <stop offset="95%" stopColor={color(primaryIdx)} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            {g}
            {xa}
            {ya}
            {tt}
            {years.map((y, i) =>
              i === primaryIdx ? (
                <Area
                  key={y}
                  type="monotone"
                  dataKey={y}
                  stroke={color(i)}
                  fill={`url(#g-${uid})`}
                  strokeWidth={2.5}
                />
              ) : (
                <Line
                  key={y}
                  type="monotone"
                  dataKey={y}
                  stroke={color(i)}
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={false}
                />
              )
            )}
          </ComposedChart>
        );
      }

      if (type === "line") {
        const w = n > 4 ? 2.5 : 4,
          r = n > 4 ? 3 : 5;
        const lastIdx = chartData.length - 1;
        // Each series' label used to sit at a fixed offset above its OWN
        // point regardless of the other series — wherever the two lines'
        // values were close (or crossed), both labels landed almost exactly
        // on top of each other. A per-point "whichever is lower goes below"
        // comparison was tried first, but two lines crossing means the two
        // points sit at nearly the same y anyway — the offset direction
        // flips at the crossing, which doesn't add reliable clearance right
        // where the collision is worst. A fixed role per SERIES is what
        // actually guarantees separation everywhere: the current year
        // (index === primaryIdx, the accent-colored line) always labels
        // above, every other year always labels below. Not an index-based
        // alternating stagger (rejected earlier for bar labels) — this is
        // one constant role per line, not alternating per category.
        const primaryIdx = years.length - 1;
        const makeLabel = (i) => ({ x, y: ly, value, index }) => {
          if (value == null) return null;
          const goesBelow = i !== primaryIdx;
          return (
            <text
              x={x}
              y={goesBelow ? ly + r + 14 : ly - 10}
              // Last category sits at the plot's right edge — centering the
              // text there let half of it overflow past the boundary.
              textAnchor={index === lastIdx ? "end" : "middle"}
              fontSize={12}
              fontWeight="700"
              fontFamily={MONO}
              fill="var(--chart-tick-strong)"
            >
              {f(value)}
            </text>
          );
        };
        return (
          <LineChart
            {...p}
            margin={{ ...p.margin, right: (p.margin?.right ?? (n > 4 ? 8 : 4)) + 16 }}
          >
            {g}
            {xa}
            {ya}
            {tt}
            {years.map((y, i) => (
              <Line
                key={y}
                type="monotone"
                dataKey={y}
                stroke={color(i)}
                strokeWidth={w}
                dot={{ r, fill: color(i), strokeWidth: 2, stroke: "#fff" }}
                activeDot={{
                  r: r + 2,
                  fill: color(i),
                  strokeWidth: 2,
                  stroke: "#fff",
                }}
                label={labels ? makeLabel(i) : false}
              />
            ))}
          </LineChart>
        );
      }

      // Gaps also need to shrink with category count, not just year count —
      // 12% category gap eats a lot of width once there are 10+ categories,
      // the same overflow source as the old fixed barSize.
      const len = chartData.length;
      return (
        <BarChart
          {...p}
          barSize={barSize}
          // Bars for the SAME month sit flush together (no gap) — they're one
          // group. The gap that actually needs to read clearly is BETWEEN
          // different months, via barCategoryGap below.
          barGap={0}
          barCategoryGap={len > 8 ? "14%" : len > 4 ? "20%" : "28%"}
        >
          {g}
          {xa}
          {ya}
          {tt}
          {years.map((y, i) => (
            <Bar
              key={y}
              dataKey={y}
              fill={color(i)}
              radius={0}
              label={labels ? <BarLabel f={f} total={total} /> : false}
            />
          ))}
        </BarChart>
      );
    }, [type, chartData, years, f, total, barSize, labels, n, compact, color, uid, measuredWidth, cardTheme.text.secondary, cardTheme.text.muted, cardTheme.grid]);

    if (libraryCard) {
      if (!n) return <Empty title={title} Icon={Icon} />;
      const primaryYear = years[years.length - 1];
      const latest = chartData[chartData.length - 1]?.[primaryYear] || 0;
      const typeControl = {
        type: "dropdown",
        value: type,
        options: CHART_TYPES.map((item) => ({ label: item.label, value: item.id })),
        onChange: setType,
      };
      return (
        <ChartCard
          theme={cardTheme}
          title={title}
          subtitle={subtitle}
          icon={<Icon size={18} />}
          controls={[typeControl]}
          headline={{ value: f(latest) }}
          floatingHeader
          expandable={expandable}
          width={width}
          size={size}
        >
          <div ref={densityRef} style={{ width: "100%", height: "100%", minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chart()}
            </ResponsiveContainer>
          </div>
        </ChartCard>
      );
    }

    // Embedded: just the plot, none of this component's own card/header/
    // footer/type-switcher — the ranked widget supplies all of that itself.
    if (embedded) {
      if (!n) return null;
      return (
        <div ref={densityRef} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart()}
          </ResponsiveContainer>
        </div>
      );
    }

    if (!n) return <Empty title={title} Icon={Icon} />;

    return (
      // h-full + overflow-hidden: this now sits in a fixed-height bento cell
      // like every other chart in the app (see Dashboard.jsx's OPERATIONS_BENTO).
      // The old version had no idea how tall its cell was — it computed its
      // own pixel height from `height`/`open` and just kept growing, which
      // spilled it into the row below. Clipping to the cell and giving the
      // chart body flex:1 (instead of a fixed px ResponsiveContainer height)
      // means it now fills whatever room the grid actually gives it.
      <div
        ref={densityRef}
        className="h-full flex flex-col overflow-hidden bg-[var(--chart-tooltip-bg)] border-2 border-[var(--chart-tooltip-border)]"
      >
        <div className={`shrink-0 border-b border-[var(--chart-tooltip-border)] ${compact ? "p-1.5" : "p-2"}`}>
          <div className={`flex items-center justify-between flex-wrap ${compact ? "gap-1" : "gap-2"}`}>
            {showHeader ? (
              <div className={`flex items-center min-w-0 ${compact ? "gap-1.5" : "gap-2.5"}`}>
                <Icon className={`${compact ? "w-3.5 h-3.5" : "w-[18px] h-[18px]"} text-gray-500 dark:text-gray-400 flex-shrink-0`} />
                <h2
                  className={`truncate font-extrabold text-gray-900 dark:text-white ${compact ? "text-[11px]" : "text-[15px]"}`}
                  style={{ fontFamily: SANS, letterSpacing: "-0.01em" }}
                >
                  {title}
                </h2>
              </div>
            ) : (
              // Keeps the Bar/Area/Line switcher + expand button pinned right
              // even with no title on the left — a host that hides the
              // duplicated title still wants these controls.
              <div />
            )}
            <div className={`flex items-center flex-wrap ${compact ? "gap-1.5" : "gap-4"}`}>
              {/* Year legend moved to the always-visible footer row — showing
                  it here too was redundant. */}
              <div className="flex border border-[var(--chart-tooltip-border)]">
                {CHART_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    title={t.label}
                    className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                      compact ? "p-1" : "px-2.5 py-1.5"
                    } ${
                      type === t.id
                        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                    }`}
                    style={{ fontFamily: SANS }}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {!compact && t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setExpanded(true)}
                title="Expand"
                aria-label="Expand chart"
                className="flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-800 dark:text-gray-500 dark:hover:text-white transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className={`flex-1 min-h-0 ${compact ? "p-1" : "p-2"}`}>
          <ResponsiveContainer width="100%" height="100%">
            {chart()}
          </ResponsiveContainer>
        </div>

        <div className="shrink-0 border-t border-[var(--chart-tooltip-border)]">
          {/* Redesigned: a click target with nothing showing until tapped
              wasted the whole footer row. Now the per-year Total is always
              visible — the single most useful number — and the chevron only
              expands to the extra Average/Peak breakdown, not the Total
              itself. Not a floating absolutely-positioned button either — a
              button poking above the panel edge got clipped by the new
              overflow-hidden. */}
          <div className={`flex items-center justify-between gap-2 ${compact ? "px-1.5 py-1" : "px-3 py-1"}`}>
            <div className="flex items-center gap-3 min-w-0 overflow-x-auto">
              {years.map((y, i) => (
                <div key={y} className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color(i) }}
                  />
                  <span
                    className={`font-bold text-gray-500 dark:text-gray-400 ${compact ? "text-[9px]" : "text-[10px]"}`}
                    style={{ fontFamily: SANS }}
                  >
                    {y}
                  </span>
                  <span
                    className={`font-extrabold text-gray-900 dark:text-white ${compact ? "text-[11px]" : "text-xs"}`}
                    style={{ fontFamily: MONO }}
                  >
                    {f(stats[y]?.sum || 0)}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setOpen((o) => !o)}
              title={open ? "Hide averages & peaks" : "Show averages & peaks"}
              className="flex-shrink-0 flex items-center justify-center p-1 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-white transition-colors"
            >
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          {open && (
            <div
              className={`overflow-y-auto ${compact ? "p-1.5 pt-0.5" : "p-3 pt-1"}`}
              style={{ maxHeight: compact ? 90 : 130 }}
            >
              <div
                className={compact ? "grid gap-1.5" : "grid gap-3"}
                style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                }}
              >
                {years.map((y, i) => (
                  <div
                    key={y}
                    className={`border border-[var(--chart-tooltip-border)] ${compact ? "p-1.5" : "p-3"}`}
                  >
                    <div className={`flex items-center gap-2 ${compact ? "mb-1" : "mb-2"}`}>
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color(i) }}
                      />
                      <h4
                        className={`font-extrabold text-gray-900 dark:text-white ${compact ? "text-xs" : ""}`}
                        style={{ fontFamily: MONO }}
                      >
                        {y}
                      </h4>
                    </div>
                    {/* Total dropped here — it's already in the always-visible
                        row above, showing it twice was the wasted space. Avg
                        and Peak side by side, always 2 columns: with Total
                        gone there are only ever two of these, so a single
                        stacked column just wasted height for no reason. */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {STATS.filter((c) => c.key !== "sum").map((c) => (
                        <Stat
                          key={c.key}
                          c={c}
                          value={stats[y]?.[c.key] || 0}
                          f={f}
                          sm={compact}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {expanded && createPortal(
          <div
            onClick={() => setExpanded(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,6,23,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--chart-tooltip-bg)]"
              style={{ width: "min(1040px, 96vw)", maxHeight: "92vh", overflow: "auto", border: `1px solid var(--chart-tooltip-border)`, boxShadow: "0 40px 90px -30px rgba(0,0,0,0.55)" }}
            >
              <div className="flex items-center justify-between gap-2 p-4 border-b border-[var(--chart-tooltip-border)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <h2 className="truncate text-lg font-extrabold text-gray-900 dark:text-white" style={{ fontFamily: SANS }}>
                    {title}
                  </h2>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Year legend dropped here too — the stats grid below
                      always shows each year's own dot+label already. */}
                  <div className="flex border border-[var(--chart-tooltip-border)]">
                    {CHART_TYPES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setType(t.id)}
                        title={t.label}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-colors ${
                          type === t.id
                            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                        }`}
                        style={{ fontFamily: SANS }}
                      >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setExpanded(false)}
                    aria-label="Close"
                    className="flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-800 dark:text-gray-500 dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div style={{ height: 420 }} className="p-4">
                <ResponsiveContainer width="100%" height="100%">
                  {chart()}
                </ResponsiveContainer>
              </div>

              <div className="p-4 pt-0">
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${Math.min(n, n <= 2 ? 2 : n <= 4 ? n : 5)}, minmax(0, 1fr))` }}
                >
                  {years.map((y, i) => (
                    <div key={y} className="border border-[var(--chart-tooltip-border)] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color(i) }} />
                        <h4 className="font-extrabold text-gray-900 dark:text-white" style={{ fontFamily: MONO }}>{y}</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {STATS.filter(
                          (c) => !(c.key === "sum" && showPercentage && stats[y]?.sum > 100)
                        ).map((c) => (
                          <Stat key={c.key} c={c} value={stats[y]?.[c.key] || 0} f={f} sm={false} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
);

export default ComparisonChart;
