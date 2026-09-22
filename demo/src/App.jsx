import { useEffect, useRef, useState } from "react";
import {
  DollarSign, Users, TrendingUp, Percent, Route, Gauge, Plane, Fuel,
  Trophy, MapPin, LayoutGrid, Table2, Boxes, Globe2,
  ChevronsLeft, ChevronsRight, Sun, Moon, SlidersHorizontal,
  ShoppingBag, MousePointerClick, UserPlus, CreditCard, Activity,
  ChevronDown, ChevronLeft, ChevronRight, Check, Copy, Code2,
} from "lucide-react";
import {
  KpiCard,
  ComparisonChart,
  RankedDataWidget,
  DualLineChart,
  FunnelChart,
  StackedBarChart,
  ProgressGauge,
  HexHealthChart,
  BarRankingChart,
  DonutChart,
  RadarChart,
  WaterfallChart,
  GradientStatCard,
  FleetSnapshotCard,
  TrendBarcodeCard,
  ActivityCalendar,
  ProgressTrackList,
  RadialBladeChart,
  PercentGradientCard,
  MetricsTable,
  WeekdayBars,
  RankedLocationBoard,
  CompositionBar,
  TargetBarcodeChart,
  RankedList,
  NetworkGraphChart,
  RibbonStackChart,
  BalanceStatsChart,
  ResponseRatePanels,
  GaugeCard,
  BarcodeMeterCard,
  EarningsBarChart,
  RadialBarsChart,
  AreaTrendChart,
  HeatmapGrid,
  SpeedometerChart,
  StatTiles,
  WorldMap,
  whiteTheme,
  solidTheme,
  SECTIONS,
  AIRPORT_TO_COUNTRY,
  AIRPORT_TO_NAME,
} from "dashkit";
import * as D from "./dummyData.js";

const NAV = [
  { key: "studio", label: "Component Studio", icon: SlidersHorizontal },
  { key: "overview", label: "Dashboard Example", icon: LayoutGrid },
  { key: "sizes", label: "Responsive Matrix", icon: Boxes },
  { key: "charts", label: "Charts", icon: TrendingUp },
  { key: "cards", label: "Dashboard Cards", icon: Table2 },
  { key: "geo", label: "World Map", icon: Globe2 },
];

const STUDIO_DATASETS = {
  commerce: {
    label: "Commerce",
    unit: "currency",
    totalLabel: "Gross revenue",
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    current: [42, 47, 45, 54, 58, 63, 61, 70, 74, 79, 86, 94],
    previous: [36, 39, 43, 46, 51, 55, 58, 61, 66, 69, 73, 78],
    ranking: [
      { label: "Subscriptions", value: 184000 }, { label: "Marketplace", value: 151000 },
      { label: "Enterprise", value: 126000 }, { label: "Services", value: 98000 },
      { label: "Partners", value: 72000 },
    ],
  },
  product: {
    label: "Product analytics",
    unit: "number",
    totalLabel: "Active users",
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    current: [8200, 9100, 9800, 11200, 12600, 13900, 15100, 16800, 18100, 19900, 21600, 23800],
    previous: [7100, 7600, 8400, 9100, 10300, 11400, 12700, 13800, 14900, 16400, 17900, 19100],
    ranking: [
      { label: "Workspace", value: 23800 }, { label: "Automations", value: 19400 },
      { label: "Reports", value: 16700 }, { label: "Integrations", value: 12300 },
      { label: "Developer API", value: 8900 },
    ],
  },
  operations: {
    label: "Operations",
    unit: "percent",
    totalLabel: "Completion rate",
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    current: [72, 75, 74, 79, 81, 84, 83, 87, 89, 91, 92, 94],
    previous: [68, 70, 73, 72, 76, 78, 80, 81, 83, 86, 87, 89],
    ranking: [
      { label: "Fulfilment", value: 96 }, { label: "Quality", value: 93 },
      { label: "Response", value: 89 }, { label: "Capacity", value: 84 },
      { label: "Backlog", value: 78 },
    ],
  },
};

const STUDIO_SIZES = {
  responsive: { label: "Fluid · container width", width: "100%", height: 420 },
  square: { label: "Square · 1:1", width: 420, height: 420, ratio: "1 / 1" },
  portrait: { label: "Portrait · 3:4", width: 360, height: 480, ratio: "3 / 4" },
  card: { label: "Standard · 3:2", width: 600, height: 400, ratio: "3 / 2" },
  wide: { label: "Wide · 16:9", width: 800, height: 450, ratio: "16 / 9" },
  ultrawide: { label: "Ultrawide · 2:1", width: 960, height: 480, ratio: "2 / 1" },
};

const ACCENT_PRESETS = [
  { label: "Electric Blue", value: "#3B82F6" },
  { label: "Emerald", value: "#059669" },
  { label: "Aqua", value: "#0EA5E9" },
  { label: "Violet", value: "#7C3AED" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Rose", value: "#E11D48" },
];

// Brand-surface charts deliberately use neutral data ink. The selected brand
// preset owns the card background; it must not also recolor every data series.
// This white-to-slate scale stays legible on every preset and keeps multi-series
// charts coherent instead of producing a rainbow on a saturated surface.
const BRAND_DATA_PALETTE = ["#FFFFFF", "#E2E8F0", "#CBD5E1", "#94A3B8", "#64748B", "#334155"];
const NEUTRAL_DATA_PALETTE = ["#3B82F6", "#94A3B8", "#0EA5E9", "#7C3AED", "#F59E0B", "#E11D48"];

const CONTAINER_OPTIONS = [
  ...Object.entries(STUDIO_SIZES).map(([value, item]) => ({ value, label: item.label })),
  { value: "custom", label: "Custom" },
];

const RADIUS_OPTIONS = [
  { value: "0", label: "Square · 0px" },
  { value: "8", label: "Soft · 8px" },
  { value: "16", label: "Rounded · 16px" },
  { value: "24", label: "Pillowed · 24px" },
];

const BORDER_OPTIONS = [
  { value: "none", label: "No border" },
  { value: "subtle", label: "Subtle border" },
  { value: "strong", label: "Strong border" },
];

const CHART_GROUPS = [
  { label: "Change over time", items: [
    { key: "trend", label: "Trend comparison", component: "DualLineChart" },
    { key: "comparison", label: "Multi-year comparison", component: "ComparisonChart" },
    { key: "areaTrend", label: "Area trend", component: "AreaTrendChart" },
    { key: "stacked", label: "Stacked columns", component: "StackedBarChart" },
    { key: "ribbon", label: "Ribbon stack", component: "RibbonStackChart" },
    { key: "earnings", label: "Earnings bars", component: "EarningsBarChart" },
    { key: "waterfall", label: "Waterfall bridge", component: "WaterfallChart" },
    { key: "trendBarcode", label: "Trend barcode", component: "TrendBarcodeCard" },
    { key: "weekday", label: "Weekday bars", component: "WeekdayBars" },
    { key: "targetBarcode", label: "Target barcode", component: "TargetBarcodeChart" },
  ]},
  { label: "Ranking & distribution", items: [
    { key: "ranking", label: "Bar ranking", component: "BarRankingChart" },
    { key: "radar", label: "Radar profile", component: "RadarChart" },
    { key: "heatmap", label: "Activity heatmap", component: "HeatmapGrid" },
    { key: "responses", label: "Response panels", component: "ResponseRatePanels" },
    { key: "activityCalendar", label: "Activity calendar", component: "ActivityCalendar" },
    { key: "rankedList", label: "Ranked list", component: "RankedList" },
    { key: "progressTracks", label: "Progress tracks", component: "ProgressTrackList" },
    { key: "metricsTable", label: "Metrics table", component: "MetricsTable" },
  ]},
  { label: "Composition", items: [
    { key: "donut", label: "Donut composition", component: "DonutChart" },
    { key: "funnel", label: "Conversion funnel", component: "FunnelChart" },
    { key: "radial", label: "Radial bars", component: "RadialBarsChart" },
    { key: "composition", label: "Composition bar", component: "CompositionBar" },
    { key: "radialBlade", label: "Radial blade", component: "RadialBladeChart" },
  ]},
  { label: "Progress & health", items: [
    { key: "gauge", label: "Progress gauge", component: "ProgressGauge" },
    { key: "gaugeCard", label: "Gauge card", component: "GaugeCard" },
    { key: "speedometer", label: "Speedometer", component: "SpeedometerChart" },
    { key: "barcode", label: "Barcode meter", component: "BarcodeMeterCard" },
    { key: "health", label: "Health score", component: "HexHealthChart" },
    { key: "percentGradient", label: "Percent gradient", component: "PercentGradientCard" },
  ]},
  { label: "Summary & relationships", items: [
    { key: "stats", label: "Stat tiles", component: "StatTiles" },
    { key: "balance", label: "Balance statistics", component: "BalanceStatsChart" },
    { key: "network", label: "Network graph", component: "NetworkGraphChart" },
    { key: "kpi", label: "KPI card", component: "KpiCard" },
    { key: "gradientStat", label: "Gradient statistic", component: "GradientStatCard" },
    { key: "fleetSnapshot", label: "Resource snapshot", component: "FleetSnapshotCard" },
    { key: "rankedLocations", label: "Location ranking", component: "RankedLocationBoard" },
    { key: "rankedWidget", label: "Multi-view ranking", component: "RankedDataWidget" },
    { key: "worldMap", label: "World map", component: "WorldMap" },
  ]},
];

const CHART_OPTIONS = CHART_GROUPS.flatMap((group) => group.items);

const studioCompact = (value) => {
  const number = Number(value || 0);
  const absolute = Math.abs(number);
  const sign = number < 0 ? "−" : "";
  const trim = (result) => result.replace(/\.0$/, "");
  if (absolute >= 1e9) return `${sign}${trim((absolute / 1e9).toFixed(1))}B`;
  if (absolute >= 1e6) return `${sign}${trim((absolute / 1e6).toFixed(1))}M`;
  if (absolute >= 1e3) return `${sign}${trim((absolute / 1e3).toFixed(1))}K`;
  return `${sign}${trim(absolute.toFixed(Number.isInteger(absolute) ? 0 : 1))}`;
};

const studioFormat = (value, unit) => {
  if (unit === "currency") return `$${studioCompact(value)}`;
  if (unit === "percent") return `${Math.round(value)}%`;
  return studioCompact(value);
};

function makeStudioCode({ chart, title, subtitle, accent, seriesColors, surface, radius, frameBorder, data }) {
  const meta = CHART_OPTIONS.find((item) => item.key === chart) || CHART_OPTIONS[0];
  const quotedTitle = JSON.stringify(title);
  const quotedSubtitle = JSON.stringify(subtitle);
  const surfaceTheme = surface === "accent"
    ? `base: "solid",\n    solid: { surface: "linear-gradient(145deg, ${accent} 0%, ${accent}CC 100%)" },`
    : `base: "light",`;
  const common = `title=${quotedTitle}\n  theme={{\n    ${surfaceTheme}\n    accent: "${accent}",\n    series: ${JSON.stringify(seriesColors)},\n    radius: ${Number(radius)},\n    frame: { border: "${frameBorder}" }\n  }}\n  size="fill"`;
  const arrays = `const labels = ${JSON.stringify(data.labels)};\nconst current = ${JSON.stringify(data.current)};\nconst previous = ${JSON.stringify(data.previous)};`;
  let props = common;
  let declarations = arrays;

  if (chart === "trend") props += `\n  subtitle=${quotedSubtitle}\n  labels={labels}\n  before={{ label: "Previous", color: "${seriesColors[1]}", values: previous }}\n  after={{ label: "Current", color: "${seriesColors[0]}", values: current }}`;
  else if (chart === "comparison") {
    declarations += `\nconst data = { 2025: labels.map((name, i) => ({ name, value: previous[i] })), 2026: labels.map((name, i) => ({ name, value: current[i] })) };`;
    props += `\n  data={data}\n  selectedYears={[2025, 2026]}\n  defaultType="line"`;
  } else if (["ranking", "donut"].includes(chart)) {
    declarations = `const items = ${JSON.stringify(data.ranking || [], null, 2)};`;
    props += chart === "ranking" ? `\n  items={items}` : `\n  segments={items}`;
  } else if (chart === "stacked") {
    declarations += `\nconst data = labels.map((label, i) => ({ label, values: { previous: previous[i], current: current[i] } }));`;
    props += `\n  series={[{ key: "previous", label: "Previous", color: "${seriesColors[1]}" }, { key: "current", label: "Current", color: "${seriesColors[0]}" }]}\n  data={data}\n  grouped`;
  } else if (chart === "areaTrend") props += `\n  subtitle=${quotedSubtitle}\n  labels={labels}\n  values={current}\n  accent="${seriesColors[0]}"`;
  else if (chart === "heatmap") props += `\n  columns={24}\n  rows={7}\n  accent="${accent}"`;
  else if (["gauge", "gaugeCard", "speedometer", "health"].includes(chart)) props += `\n  value={84}`;
  else if (chart === "funnel") props += `\n  stages={[{ label: "Visitors", value: 12000 }, { label: "Activated", value: 6800 }, { label: "Customers", value: 2100 }]}`;

  return `import { ${meta.component} } from "dashkit";\n\n${declarations}\n\nexport function AnalyticsCard() {\n  return (\n    <div style={{ width: "100%", aspectRatio: "16 / 9" }}>\n      <${meta.component}\n        ${props.split("\n").join("\n        ")}\n      />\n    </div>\n  );\n}`;
}

function SectionLabel({ children, accent }) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-2">
      <span style={{ width: 5, height: 22, background: accent }} className="flex-shrink-0" />
      <span className="text-[17px] font-bold" style={{ color: accent, fontFamily: "'Space Grotesk', sans-serif" }}>{children}</span>
      <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
    </div>
  );
}

function Frame({ title, sub, w, h, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <div className="text-[12px] font-bold text-gray-700 dark:text-gray-200">{title}</div>
        {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
      </div>
      <div style={{ width: w, height: h }} className="border border-dashed border-gray-300 dark:border-white/15 bg-white dark:bg-transparent overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// Labels a gallery cell with the component's exact export name, so the
// gallery doubles as a visual index — no guessing which import produced
// which card.
function Named({ name, height, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="w-fit rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {name}
      </span>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

// Same 5-section shape as the production dashboard this library was
// extracted from — one hue per section, a solid card or two for contrast,
// everything else white with that hue as its one accent. This is the
// reference layout: copy a section's structure wholesale into your own page.
function OverviewDemo() {
  // overflow:hidden + gridAutoRows are load-bearing, not decoration — a grid
  // container's explicit `height` only bounds ITS OWN box; without a row-
  // track sizing rule, an auto row still sizes to its tallest child's
  // content height and, past the container's edge, paints straight over
  // whatever sits in normal flow right after it (the next section's grid,
  // which starts exactly `height` + margin down regardless of overflow).
  const ROW = (vh) => ({ height: `${vh}vh`, overflow: "hidden", gridAutoRows: "1fr" });
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {D.kpis.map((k, i) => (
          <KpiCard
            key={k.label}
            icon={[DollarSign, TrendingUp, Users, Percent, Gauge, Plane][i]}
            label={k.label}
            value={k.value}
            sub={k.sub}
            delta={k.delta}
            tone={k.tone}
          />
        ))}
      </div>

      {/* ── Revenue & Traffic (emerald) ───────────────────────────────── */}
      <SectionLabel accent={SECTIONS.emerald.accent}>Revenue &amp; Traffic</SectionLabel>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-8" style={ROW(42)}>
        <div className="lg:col-span-3">
          <DualLineChart
            theme={solidTheme("emerald")} size="fill"
            title="Revenue by Month" icon={<DollarSign size={18} />}
            subtitle="2026 vs 2025" valueLabel="Total Revenue"
            formatValue={(v) => `$${(v / 1e6).toFixed(1)}M`}
            labels={D.revenueByMonth.map((m) => m.name)}
            before={{ label: "2025", color: "rgba(255,255,255,0.5)", values: D.revenueByMonthPrev.map((m) => m.value) }}
            after={{ label: "2026", color: "#ffffff", values: D.revenueByMonth.map((m) => m.value) }}
            total={D.revenueByMonth.reduce((s, m) => s + m.value, 0)}
          />
        </div>
        <div className="lg:col-span-3">
          <DualLineChart
            theme={whiteTheme("emerald")} size="fill"
            title="Passengers by Month" icon={<Users size={18} />}
            subtitle="2026 vs 2025" valueLabel="Total Passengers"
            formatValue={(v) => `${Math.round(v / 1000)}K`}
            labels={D.passengersByMonth.map((m) => m.name)}
            before={{ label: "2025", color: "#94a3b8", values: D.passengersByMonthPrev.map((m) => m.value) }}
            after={{ label: "2026", color: SECTIONS.emerald.accent, values: D.passengersByMonth.map((m) => m.value) }}
            total={D.passengersByMonth.reduce((s, m) => s + m.value, 0)}
          />
        </div>
        <div className="lg:col-span-2">
          <FunnelChart
            theme={whiteTheme("emerald")} size="fill"
            title="Revenue Funnel" icon={<Route size={18} />}
            stages={[
              { label: "Revenue", value: 26700000, color: SECTIONS.emerald.from },
              { label: "Net Revenue", value: 20500000, color: SECTIONS.emerald.accent },
              { label: "Operating Income", value: 3100000, color: SECTIONS.emerald.to },
            ]}
            formatValue={(v) => `$${(v / 1e6).toFixed(1)}M`}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 mt-3" style={ROW(42)}>
        <div>
          <DualLineChart
            theme={whiteTheme("emerald")} size="fill"
            title="Passenger Load Factor" icon={<Percent size={18} />}
            subtitle="2026 vs 2025" valueLabel="Load Factor"
            formatValue={(v) => `${Math.round(v)}%`}
            labels={D.loadFactorByMonth.map((m) => m.name)}
            before={{ label: "2025", color: "#94a3b8", values: D.loadFactorByMonth.map((m) => Math.max(40, m.value - 6)) }}
            after={{ label: "2026", color: SECTIONS.emerald.accent, values: D.loadFactorByMonth.map((m) => m.value) }}
            total={78}
          />
        </div>
        <div className="lg:col-span-2">
          <RankedList
            theme={solidTheme("emerald")} title="Passengers by Route" icon={<Route size={18} />}
            items={D.routesPax} formatValue={(v) => `${Math.round(v / 1000)}K`}
            solid invertColor={SECTIONS.emerald.accent} prevLabel="2025"
          />
        </div>
      </div>

      {/* ── Trends & Route Performance (aqua) ─────────────────────────── */}
      <SectionLabel accent={SECTIONS.aqua.accent}>Trends &amp; Route Performance</SectionLabel>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5" style={ROW(42)}>
        <div className="lg:col-span-3">
          <StackedBarChart
            theme={whiteTheme("aqua")} size="fill"
            title="Monthly Revenue YoY" icon={<TrendingUp size={18} />}
            series={[{ key: "prev", label: "2025", color: "#94a3b8" }, { key: "cur", label: "2026", color: SECTIONS.aqua.accent }]}
            data={D.revenueByMonth.map((m, i) => ({ label: m.name, values: { prev: D.revenueByMonthPrev[i]?.value || 0, cur: m.value } }))}
            grouped
          />
        </div>
        <div className="lg:col-span-2">
          <GradientStatCard
            gradient={`linear-gradient(135deg, ${SECTIONS.aqua.from} 0%, ${SECTIONS.aqua.to} 100%)`}
            icon={<TrendingUp size={15} />}
            label="Revenue Growth"
            value="+20.8%"
            caption="$26.7M vs $22.1M in 2025"
            pills={[{ label: "Op. Margin", value: "11.6%" }, { label: "Yield", value: "$0.10" }]}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7 mt-3" style={ROW(42)}>
        <div className="lg:col-span-2">
          <RankedList
            theme={solidTheme("aqua")} title="Top Routes" icon={<Trophy size={18} />}
            subtitle="By revenue" items={D.routes} formatValue={(v) => `$${(v / 1e6).toFixed(1)}M`}
            solid invertColor={SECTIONS.aqua.accent} prevLabel="2025"
          />
        </div>
        <div className="lg:col-span-5">
          <StackedBarChart
            theme={whiteTheme("aqua")} size="fill"
            title="Passengers by Route · Monthly" icon={<Route size={18} />}
            series={D.routes.slice(0, 4).map((r, i) => ({ key: r.name, label: r.name, color: i % 2 ? SECTIONS.aqua.to : SECTIONS.aqua.accent }))}
            data={D.passengersByMonth.slice(0, 8).map((m) => ({
              label: m.name,
              values: Object.fromEntries(D.routes.slice(0, 4).map((r, i) => [r.name, Math.round(m.value * (0.35 - i * 0.06))])),
            }))}
          />
        </div>
      </div>

      {/* ── Flight Operations (amber) ─────────────────────────────────── */}
      <SectionLabel accent={SECTIONS.amber.accent}>Flight Operations</SectionLabel>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12" style={ROW(42)}>
        <div className="lg:col-span-8">
          <TrendBarcodeCard
            theme={whiteTheme("amber")} title="Flight Activity" icon={<Plane size={18} />} iconColor={SECTIONS.amber.accent}
            months={D.flightsByMonth} headlineValue="1.8K" headlineLabel="flights flown"
            formatValue={(v) => studioFormat(v, "number")}
            stats={[{ icon: <Gauge size={16} />, value: "3.8K", label: "block hours" }, { icon: <TrendingUp size={16} />, value: "2.1", label: "hrs / flight" }]}
          />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-4">
          <div className="flex-1">
            <GradientStatCard
              gradient={`linear-gradient(135deg, ${SECTIONS.amber.from} 0%, ${SECTIONS.amber.to} 100%)`}
              icon={<Plane size={15} />} label="Network" value="1.8K"
              caption="5 aircraft · 12 stations"
              pills={[{ label: "Block hours", value: "3.8K" }, { label: "On-time", value: "87%" }]}
            />
          </div>
          <div className="flex-1">
            <GradientStatCard
              gradient={`linear-gradient(135deg, ${SECTIONS.amber.to} 0%, ${SECTIONS.amber.from} 100%)`}
              icon={<Users size={15} />} label="Traffic" value="210.4K"
              caption="Load factor 78%"
              pills={[{ label: "Pax / flight", value: "117" }, { label: "Cargo (kg)", value: "62K" }]}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 mt-3" style={ROW(42)}>
        <div className="lg:col-span-5">
          <ActivityCalendar theme={whiteTheme("amber")} icon={<Route size={18} />} iconColor={SECTIONS.amber.accent} days={D.flightsByDay} unitLabel="flights" />
        </div>
        <div className="lg:col-span-4">
          <WeekdayBars theme={whiteTheme("amber")} icon={<TrendingUp size={18} />} iconColor={SECTIONS.amber.accent} days={D.flightsByDay} unitLabel="Flights" />
        </div>
        <div className="lg:col-span-3">
          <PercentGradientCard
            gradient={`linear-gradient(135deg, ${SECTIONS.amber.from} 0%, ${SECTIONS.amber.to} 100%)`}
            label="Seat Utilisation" percent={78}
            caption="Average load factor across all flights in range"
            months={D.loadFactorByMonth}
          />
        </div>
      </div>

      {/* ── Fleet & Fuel (violet) ──────────────────────────────────────── */}
      <SectionLabel accent={SECTIONS.violet.accent}>Fleet &amp; Fuel</SectionLabel>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12" style={{ height: "84vh", overflow: "hidden", gridTemplateRows: "1fr 1fr" }}>
        <div className="lg:col-span-5 lg:row-span-2" style={{ height: "100%" }}>
          <ProgressTrackList theme={whiteTheme("violet")} icon={<Plane size={18} />} iconColor={SECTIONS.violet.accent} tails={D.tails} />
        </div>
        <div className="lg:col-span-4" style={{ height: "calc(42vh - 6px)" }}>
          <RadialBladeChart theme={whiteTheme("violet")} icon={<Fuel size={18} />} iconColor={SECTIONS.violet.accent} months={D.fuelMonths} unit="L" />
        </div>
        <div className="lg:col-span-3" style={{ height: "calc(42vh - 6px)" }}>
          <GradientStatCard
            gradient={`linear-gradient(135deg, ${SECTIONS.violet.from} 0%, ${SECTIONS.violet.to} 100%)`}
            icon={<Plane size={15} />} label="Fleet Snapshot" value="5"
            caption="aircraft in service"
            pills={[{ label: "Stations", value: "12" }, { label: "Fuel/flight", value: "6.5K L" }]}
          />
        </div>
        <div className="lg:col-span-4" style={{ height: "calc(42vh - 6px)" }}>
          <TargetBarcodeChart theme={whiteTheme("violet")} icon={<Percent size={18} />} iconColor={SECTIONS.violet.accent} title="Load Factor by Month" months={D.loadFactorByMonth} target={75} unit="%" />
        </div>
        <div className="lg:col-span-3" style={{ height: "calc(42vh - 6px)" }}>
          <TargetBarcodeChart
            theme={solidTheme("violet")} icon={<Fuel size={18} />} iconColor="#ffffff"
            title="Fuel Uplift by Month"
            months={D.fuelMonths.map((m) => ({ name: m.name, value: m.fuel }))}
            target={D.fuelMonths.reduce((s, m) => s + m.fuel, 0) / D.fuelMonths.length}
            unit="L" formatValue={(v) => `${Math.round(v / 1000)}K`}
          />
        </div>
      </div>

      {/* ── Global Network & Cost (charcoal) ──────────────────────────── */}
      <SectionLabel accent={SECTIONS.slate.accent}>Global Network &amp; Cost</SectionLabel>
      <div className="flex flex-col gap-3">
        {/* Page 1 — World Map takes the full page height on the left; the
            right rail stacks Station Performance and Top Destinations. */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12" style={{ height: "68vh", overflow: "hidden", gridTemplateRows: "1fr 1fr" }}>
          <div className="h-full min-h-0 lg:col-span-9 lg:row-span-2">
            <WorldMap allCities={D.worldMapCities} isMobile={false} />
          </div>
          <div className="h-full min-h-0 lg:col-span-3">
            <RankedList theme={whiteTheme("slate")} title="Station Performance" icon={<Gauge size={18} />} subtitle="By flights" items={D.stations.map((s) => ({ label: s.name, value: s.flights }))} formatValue={(v) => studioFormat(v, "number")} />
          </div>
          <div className="h-full min-h-0 lg:col-span-3">
            <RankedList
              theme={solidTheme("slate")} title="Top Destinations" icon={<MapPin size={18} />}
              subtitle="By passengers" items={D.destinations} formatValue={(v) => studioFormat(v, "number")}
              solid invertColor={SECTIONS.slate.accent} prevLabel="2025"
            />
          </div>
        </div>

        {/* Page 2 — Network Connectivity at full height with Cost Base
            (white, 30%) and Network Summary (solid, 30%) on the right rail. */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12" style={{ height: "68vh", overflow: "hidden", gridTemplateRows: "7fr 3fr" }}>
          <div className="h-full min-h-0 lg:col-span-9 lg:row-span-2">
            <NetworkGraphChart
              theme={solidTheme("slate")} size="fill" expandable title="Network Connectivity" icon={<Route size={18} />} iconColor="#ffffff"
              formatValue={(v) => studioFormat(v, "number")} {...D.networkProps}
            />
          </div>
          <div className="h-full min-h-0 lg:col-span-3">
            <CompositionBar theme={{ ...whiteTheme("slate"), pad: 8 }} icon={<DollarSign size={18} />} iconColor={SECTIONS.slate.accent} items={D.costBreakdown} formatMoney={(v) => `$${(v / 1e6).toFixed(1)}M`} />
          </div>
          <div className="h-full min-h-0 lg:col-span-3">
            <GradientStatCard
              gradient={`linear-gradient(135deg, ${SECTIONS.slate.from} 0%, ${SECTIONS.slate.to} 100%)`}
              icon={<Route size={15} />} label="Network Summary" value={String(D.networkProps.activeAirports)}
              caption={`airports · ${D.networkProps.routeDirections} route directions`}
              pills={[{ label: "Primary hub", value: D.networkProps.primaryHub }, { label: "Busiest", value: D.networkProps.busiestRoute }]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function ChartPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, CHART_OPTIONS.findIndex((item) => item.key === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef(null);
  const selected = CHART_OPTIONS[selectedIndex];

  useEffect(() => setActiveIndex(selectedIndex), [selectedIndex]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => !rootRef.current?.contains(event.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (index) => {
    onChange(CHART_OPTIONS[index].key);
    setActiveIndex(index);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) event.preventDefault();
    if (event.key === "Escape") return setOpen(false);
    if (event.key === "ArrowDown" || event.key === "ArrowRight") choose((selectedIndex + 1) % CHART_OPTIONS.length);
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") choose((selectedIndex - 1 + CHART_OPTIONS.length) % CHART_OPTIONS.length);
    if (event.key === "Home") choose(0);
    if (event.key === "End") choose(CHART_OPTIONS.length - 1);
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <div className="flex gap-1.5">
        <button type="button" aria-label="Previous chart" onClick={() => choose((selectedIndex - 1 + CHART_OPTIONS.length) % CHART_OPTIONS.length)} className="flex w-10 shrink-0 items-center justify-center border border-gray-200 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900 dark:border-white/10 dark:bg-[#202020] dark:hover:border-white dark:hover:text-white"><ChevronLeft size={16} /></button>
        <button
          type="button" aria-label={`Choose chart component: ${selected.label}`} aria-haspopup="listbox" aria-expanded={open}
          className={`${controlClass} flex min-w-0 flex-1 items-center justify-between gap-3 text-left`}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="min-w-0"><span className="block truncate">{selected.label}</span><span className="block truncate font-mono text-[9px] font-medium text-gray-400">{selected.component}</span></span>
          <ChevronDown size={15} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button type="button" aria-label="Next chart" onClick={() => choose((selectedIndex + 1) % CHART_OPTIONS.length)} className="flex w-10 shrink-0 items-center justify-center border border-gray-200 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900 dark:border-white/10 dark:bg-[#202020] dark:hover:border-white dark:hover:text-white"><ChevronRight size={16} /></button>
      </div>
      <div className="mt-1.5 text-center font-mono text-[9px] text-gray-400">← → or ↑ ↓ switches instantly · click name for catalog</div>
      {open && (
        <div role="listbox" aria-label="Chart component" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(62vh,520px)] overflow-y-auto border border-gray-300 bg-white p-1.5 shadow-2xl dark:border-white/15 dark:bg-[#202020]">
          {CHART_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2 pb-1 pt-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">{group.label}</div>
              {group.items.map((item) => {
                const index = CHART_OPTIONS.findIndex((option) => option.key === item.key);
                const isSelected = item.key === value;
                const isActive = index === activeIndex;
                return (
                  <button
                    type="button" role="option" aria-selected={isSelected} key={item.key}
                    onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(index)}
                    className={`flex w-full items-center gap-2 px-2 py-2 text-left ${isActive ? "bg-gray-100 dark:bg-white/10" : ""}`}
                  >
                    <span className="flex w-4 shrink-0 justify-center">{isSelected && <Check size={13} />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-gray-800 dark:text-white">{item.label}</span><span className="block truncate font-mono text-[9px] text-gray-400">{item.component}</span></span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepperSelect({ value, onChange, options, ariaLabel }) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const step = (direction) => onChange(options[(index + direction + options.length) % options.length].value);
  const onKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    step(event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1);
  };

  return (
    <div className="flex" onKeyDown={onKeyDown}>
      <button type="button" aria-label={`Previous ${ariaLabel}`} onClick={() => step(-1)} className="flex w-10 shrink-0 items-center justify-center border border-r-0 border-gray-200 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900 dark:border-white/10 dark:bg-[#202020] dark:hover:border-white dark:hover:text-white"><ChevronLeft size={16} /></button>
      <select aria-label={ariaLabel} className={`${controlClass} min-w-0 flex-1`} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <button type="button" aria-label={`Next ${ariaLabel}`} onClick={() => step(1)} className="flex w-10 shrink-0 items-center justify-center border border-l-0 border-gray-200 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900 dark:border-white/10 dark:bg-[#202020] dark:hover:border-white dark:hover:text-white"><ChevronRight size={16} /></button>
    </div>
  );
}

const controlClass = "h-10 w-full border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-800 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 dark:border-white/10 dark:bg-[#202020] dark:text-white dark:focus:border-white";

function StudioDemo() {
  const [chart, setChart] = useState("trend");
  const [datasetKey, setDatasetKey] = useState("product");
  const [title, setTitle] = useState("Product momentum");
  const [subtitle, setSubtitle] = useState("Current period vs previous period");
  const [accent, setAccent] = useState("#3B82F6");
  const [neutralSeriesColors, setNeutralSeriesColors] = useState(NEUTRAL_DATA_PALETTE);
  const [brandSeriesColors, setBrandSeriesColors] = useState(BRAND_DATA_PALETTE);
  const [surface, setSurface] = useState("light");
  const [radius, setRadius] = useState("0");
  const [borderStyle, setBorderStyle] = useState("subtle");
  const [sizeKey, setSizeKey] = useState("responsive");
  const [customWidth, setCustomWidth] = useState(680);
  const [customHeight, setCustomHeight] = useState(420);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const data = STUDIO_DATASETS[datasetKey];
  const preset = STUDIO_SIZES[sizeKey];
  const width = sizeKey === "custom" ? customWidth : preset.width;
  const height = sizeKey === "custom" ? customHeight : preset.height;
  const previewStyle = sizeKey !== "custom" && preset.ratio
    ? { width, maxWidth: "100%", aspectRatio: preset.ratio }
    : { width, maxWidth: "100%", height };
  const format = (value) => studioFormat(value, data.unit);
  const ranking = data.ranking.map((item) => ({ ...item, name: item.label }));
  const total = data.current.reduce((sum, value) => sum + value, 0);
  const weekdaySample = Array.from({ length: 35 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 5 + index));
    const source = data.current[index % data.current.length] || 0;
    const weekdayFactor = [0.52, 0.94, 1.08, 1, 1.16, 0.86, 0.6][index % 7];
    return {
      date: date.toISOString().slice(0, 10),
      value: Math.max(1, Math.round(source * weekdayFactor)),
    };
  });
  const solidBase = solidTheme("violet");
  const frameBorder = borderStyle === "none"
    ? "transparent"
    : borderStyle === "strong"
      ? (surface === "accent" ? "rgba(255,255,255,.62)" : "rgba(15,23,42,.34)")
      : (surface === "accent" ? "rgba(255,255,255,.24)" : "rgba(15,23,42,.10)");
  const activeSeriesColors = surface === "accent" ? brandSeriesColors : neutralSeriesColors;
  const setActiveSeriesColor = (index, value) => {
    const normalized = value.toUpperCase();
    const setter = surface === "accent" ? setBrandSeriesColors : setNeutralSeriesColors;
    setter((colors) => colors.map((color, colorIndex) => colorIndex === index ? normalized : color));
  };
  const resetActiveSeriesColors = () => {
    if (surface === "accent") setBrandSeriesColors(BRAND_DATA_PALETTE);
    else setNeutralSeriesColors(NEUTRAL_DATA_PALETTE);
  };
  const componentTheme = surface === "accent"
    ? { ...solidBase, radius: Number(radius), frame: { border: frameBorder }, series: activeSeriesColors, solid: { ...solidBase.solid, surface: `linear-gradient(145deg, ${accent} 0%, ${accent}CC 100%)` } }
    : { ...whiteTheme("violet"), radius: Number(radius), frame: { border: frameBorder }, accent, series: activeSeriesColors };
  const plotAccent = activeSeriesColors[0];
  const plotMuted = activeSeriesColors[1];
  const chromeAccent = surface === "accent" ? activeSeriesColors[0] : accent;
  const brandGradient = `linear-gradient(145deg, ${accent} 0%, ${accent}CC 100%)`;
  const studioCode = makeStudioCode({ chart, title, subtitle, accent, seriesColors: activeSeriesColors, surface, radius, frameBorder, data: { ...data, ranking } });

  const copyCode = async () => {
    await navigator.clipboard.writeText(studioCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const renderChart = () => {
    if (chart === "comparison") {
      const comparisonData = {
        2025: data.labels.map((name, index) => ({ name, value: data.previous[index] })),
        2026: data.labels.map((name, index) => ({ name, value: data.current[index] })),
      };
      return <ComparisonChart title={title} subtitle={subtitle} data={comparisonData} selectedYears={[2025, 2026]} defaultType="line" colors={[activeSeriesColors[1], activeSeriesColors[0]]} libraryCard theme={componentTheme} size="fill" expandable />;
    }
    if (chart === "areaTrend") {
      return <AreaTrendChart theme={componentTheme} size="fill" title={title} subtitle={subtitle} icon={<TrendingUp size={17} />} total={data.unit === "percent" ? data.current.at(-1) : total} valueLabel={data.totalLabel} labels={data.labels} values={data.current} accent={plotAccent} formatValue={format} expandable />;
    }
    if (chart === "stacked") {
      return <StackedBarChart theme={componentTheme} size="fill" title={title} subtitle={subtitle} icon={<Table2 size={17} />} series={[{ key: "previous", label: "Previous", color: plotMuted }, { key: "current", label: "Current", color: plotAccent }]} data={data.labels.map((label, index) => ({ label, values: { previous: data.previous[index], current: data.current[index] } }))} grouped suffix="" axisFormat={format} valueFormat={format} floatingHeader headerStatLabel={data.totalLabel} headerStatValue={format(data.current.at(-1))} />;
    }
    if (chart === "ribbon") {
      return <RibbonStackChart theme={componentTheme} size="fill" width="100%" title={title} subtitle={subtitle} icon={<TrendingUp size={17} />} series={[{ key: "previous", label: "Previous", color: plotMuted }, { key: "current", label: "Current", color: plotAccent }]} data={data.labels.map((label, index) => ({ label, total: data.previous[index] + data.current[index], values: { previous: data.previous[index], current: data.current[index] } }))} total={total} formatValue={format} axisFormat={format} showAxis showBarLabels floatingHeader expandable />;
    }
    if (chart === "earnings") {
      return <EarningsBarChart theme={componentTheme} size="fill" width="100%" title={title} subtitle={subtitle} accent={plotAccent} accentBright={surface === "accent" ? "rgba(255,255,255,.78)" : `${accent}CC`} accentDark={plotAccent} expandable />;
    }
    if (chart === "waterfall") {
      const start = data.current[0];
      const middle = data.current[Math.floor(data.current.length / 2)];
      const end = data.current.at(-1);
      return <WaterfallChart theme={componentTheme} size="fill" title={title} subtitle={subtitle} icon={<TrendingUp size={17} />} items={[{ label: "Starting", value: start, type: "total" }, { label: "Mid-period", value: Math.abs(middle - start), type: middle >= start ? "inc" : "dec" }, { label: "Recent", value: Math.abs(end - middle), type: end >= middle ? "inc" : "dec" }, { label: "Current", value: end, type: "total" }]} formatValue={format} />;
    }
    if (chart === "ranking") {
      return <BarRankingChart theme={componentTheme} size="fill" title={title} subtitle={subtitle} icon={<Trophy size={17} />} items={ranking} formatValue={format} />;
    }
    if (chart === "radar") {
      const metrics = ranking.map((item) => ({ label: item.label, value: data.unit === "percent" ? item.value : Math.round((item.value / ranking[0].value) * 100) }));
      return <RadarChart theme={componentTheme} size="fill" title={title} subtitle={subtitle} metrics={metrics} accent={plotAccent} expandable />;
    }
    if (chart === "heatmap") {
      return <HeatmapGrid theme={componentTheme} width="100%" size="fill" title={title} subtitle={subtitle} accent={plotAccent} columns={Math.max(12, data.labels.length * 2)} rows={7} />;
    }
    if (chart === "responses") {
      const items = ranking.slice(0, 3).map((item, index) => ({ value: data.unit === "percent" ? item.value : Math.round((item.value / ranking[0].value) * 100), caption: item.label, color: activeSeriesColors[index] }));
      return <ResponseRatePanels theme={componentTheme} size="fill" width="100%" title={title} subtitle={subtitle} items={items} expandable />;
    }
    if (chart === "donut") {
      const segments = ranking.map((item, index) => ({
        ...item,
        color: activeSeriesColors[index % activeSeriesColors.length],
      }));
      const segmentTotal = ranking.reduce((sum, item) => sum + item.value, 0);
      return <DonutChart theme={componentTheme} size="fill" title={title} subtitle={subtitle} icon={<Activity size={17} />} segments={segments} total={data.unit === "percent" ? "100%" : format(segmentTotal)} formatValue={format} />;
    }
    if (chart === "funnel") {
      const stages = ranking.slice(0, 4).map((item, index) => ({
        label: item.label,
        value: item.value,
        color: activeSeriesColors[index],
      }));
      return <FunnelChart theme={componentTheme} size="fill" title={title} subtitle={subtitle} icon={<MousePointerClick size={17} />} stages={stages} formatValue={format} />;
    }
    if (chart === "gauge") {
      const value = data.unit === "percent" ? data.current.at(-1) : Math.min(100, Math.round((data.current.at(-1) / (Math.max(...data.current) * 1.2)) * 100));
      return <ProgressGauge theme={componentTheme} size="fill" title={title} subtitle={subtitle} icon={<Gauge size={17} />} value={value} valueLabel={data.totalLabel} segments={[{ label: "Complete", value, color: plotAccent }, { label: "In progress", value: Math.max(0, 100 - value), color: activeSeriesColors[2], hatch: true }]} />;
    }
    if (chart === "gaugeCard") {
      const value = data.unit === "percent" ? data.current.at(-1) : Math.min(100, Math.round((data.current.at(-1) / (Math.max(...data.current) * 1.2)) * 100));
      return <GaugeCard theme={componentTheme} size="fill" width="100%" title={title} subtitle={subtitle} value={value} valueText={`${value}`} from={activeSeriesColors[3]} to={plotAccent} knobColor={plotAccent} stats={[{ value: format(data.current.at(-1)), label: "Current" }, { value: format(data.previous.at(-1)), label: "Previous" }]} />;
    }
    if (chart === "speedometer") {
      const value = data.unit === "percent" ? data.current.at(-1) : Math.min(100, Math.round((data.current.at(-1) / (Math.max(...data.current) * 1.2)) * 100));
      return <SpeedometerChart theme={componentTheme} size="fill" width="100%" title={title} subtitle={subtitle} value={value} unit="%" label={data.totalLabel} from={activeSeriesColors[3]} to={plotAccent} expandable />;
    }
    if (chart === "barcode") {
      const progress = data.unit === "percent" ? data.current.at(-1) / 100 : data.current.at(-1) / Math.max(...data.current);
      return <BarcodeMeterCard theme={componentTheme} size="fill" width="100%" title={title} subtitle={subtitle} progress={progress} percentText={`${Math.round(progress * 100)}`} accent={plotAccent} stats={[{ value: format(data.current.at(-1)), label: "Current" }, { value: format(total), label: "Period total" }]} />;
    }
    if (chart === "health") {
      const metrics = ranking.map((item) => ({ label: item.label, value: data.unit === "percent" ? item.value : Math.round((item.value / ranking[0].value) * 100) }));
      const overall = Math.round(metrics.reduce((sum, item) => sum + item.value, 0) / metrics.length);
      return <HexHealthChart theme={componentTheme} size="fill" title={title} subtitle={subtitle} icon={<Activity size={17} />} overall={overall} overallLabel="Overall score" metrics={metrics} suffix="%" />;
    }
    if (chart === "radial") {
      const items = ranking.slice(0, 4).map((item) => ({ label: item.label, value: data.unit === "percent" ? item.value : Math.round((item.value / ranking[0].value) * 100) }));
      return <RadialBarsChart theme={componentTheme} size="fill" width="100%" title={title} subtitle={subtitle} items={items} expandable />;
    }
    if (chart === "stats") {
      const tiles = ranking.slice(0, 4).map((item, index) => ({ label: item.label, value: format(item.value), change: [12.4, 7.8, -2.1, 4.6][index], spark: data.current.slice(Math.max(0, index), Math.max(0, index) + 7), color: activeSeriesColors[index] }));
      return <StatTiles theme={componentTheme} width="100%" size="fill" title={title} subtitle={subtitle} tiles={tiles} />;
    }
    if (chart === "balance") {
      return <BalanceStatsChart theme={componentTheme} size="fill" width="100%" title={title} subtitle={subtitle} total={total} formatValue={format} axisFormat={format} series={activeSeriesColors.slice(0, 3).map((color, index) => ({ key: ["low", "mid", "high"][index], label: ["Low", "Mid", "High"][index], color }))} />;
    }
    if (chart === "network") {
      const nodes = ["Core", "Web", "Mobile", "API", "Data", "Ops"];
      const edges = nodes.slice(1).map((node, index) => ({ from: "Core", to: node, value: ranking[index % ranking.length].value }));
      return <NetworkGraphChart theme={componentTheme} size="fill" width="100%" title={title} subtitle={subtitle} nodes={nodes} edges={edges} primaryHub="Core" activeAirports={nodes.length} routeDirections={edges.length} busiestRoute="Core-Web" formatValue={format} expandable />;
    }
    const monthly = data.labels.map((name, index) => ({ name, month: name, value: data.current[index] }));
    const genericRows = ranking.map((item, index) => ({ name: item.label, label: item.label, value: item.value, prev: Math.round(item.value * (0.84 + index * 0.025)) }));
    if (chart === "trendBarcode") return <TrendBarcodeCard theme={componentTheme} title={title} icon={<TrendingUp size={17} />} iconColor={plotAccent} months={monthly} headlineValue={format(data.current.at(-1))} headlineLabel={data.totalLabel} formatValue={format} stats={[]} />;
    if (chart === "weekday") return <WeekdayBars theme={componentTheme} title={title} icon={<Activity size={17} />} iconColor={plotAccent} days={weekdaySample} unitLabel="Events" />;
    if (chart === "targetBarcode") return <TargetBarcodeChart theme={componentTheme} title={title} icon={<Activity size={17} />} iconColor={plotAccent} months={monthly} target={data.previous.reduce((sum, value) => sum + value, 0) / data.previous.length} unit="" formatValue={format} />;
    if (chart === "activityCalendar") return <ActivityCalendar theme={componentTheme} title={title} icon={<Activity size={17} />} iconColor={plotAccent} days={D.flightsByDay.map((day, index) => ({ ...day, value: data.current[index % data.current.length] }))} unitLabel="events" />;
    if (chart === "rankedList") return <RankedList theme={componentTheme} title={title} subtitle={subtitle} icon={<Trophy size={17} />} iconColor={chromeAccent} items={genericRows} formatValue={format} />;
    if (chart === "progressTracks") return <ProgressTrackList theme={componentTheme} title={title} subtitle={subtitle} icon={<Activity size={17} />} iconColor={plotAccent} tails={genericRows} headlineValue={format(ranking[0]?.value || 0)} unitLabel={data.totalLabel} formatValue={format} />;
    if (chart === "metricsTable") return <MetricsTable theme={componentTheme} title={title} icon={<Table2 size={17} />} iconColor={chromeAccent} stations={genericRows.map((row, index) => ({ name: row.name, flights: row.value, revenue: row.value * 12, otp: 72 + index * 5 }))} formatMoney={format} />;
    if (chart === "composition") return <CompositionBar theme={componentTheme} title={title} icon={<Boxes size={17} />} iconColor={chromeAccent} items={genericRows} formatMoney={format} palette={activeSeriesColors} />;
    if (chart === "radialBlade") return <RadialBladeChart theme={componentTheme} title={title} icon={<Activity size={17} />} iconColor={chromeAccent} months={monthly.map((month, index) => ({ ...month, flights: Math.max(1, data.previous[index]), fuel: month.value * Math.max(1, data.previous[index]) }))} unit="" />;
    if (chart === "percentGradient") return <PercentGradientCard gradient={brandGradient} label={title} percent={data.unit === "percent" ? data.current.at(-1) : Math.round((data.current.at(-1) / Math.max(...data.current)) * 100)} caption={subtitle} months={monthly.map((month) => ({ ...month, value: data.unit === "percent" ? month.value : Math.round((month.value / Math.max(...data.current)) * 100) }))} />;
    if (chart === "kpi") return <div style={{ height: "100%", display: "grid", placeItems: "center" }}><KpiCard icon={TrendingUp} label={title} value={format(data.current.at(-1))} sub={subtitle} delta={12.4} tone="ocean" style={{ width: "min(100%, 440px)", backgroundImage: brandGradient }} /></div>;
    if (chart === "gradientStat") return <GradientStatCard gradient={brandGradient} label={title} value={format(data.current.at(-1))} caption={subtitle} bars={monthly} formatBarValue={format} />;
    if (chart === "fleetSnapshot") return <FleetSnapshotCard gradient={brandGradient} aircraft={format(data.current.at(-1))} utilisation={monthly} stats={genericRows.slice(0, 3).map((row) => ({ label: row.label, value: format(row.value) }))} />;
    if (chart === "rankedLocations") return <RankedLocationBoard theme={componentTheme} title={title} icon={<MapPin size={17} />} iconColor={chromeAccent} routes={D.routesPax} airportCountry={AIRPORT_TO_COUNTRY} airportName={AIRPORT_TO_NAME} />;
    if (chart === "rankedWidget") return <RankedDataWidget title={title} items={genericRows} allItems={genericRows} headerIcon={Trophy} barColor={plotAccent} initialItemsToShow={8} height="h-full" showFooter={false} />;
    if (chart === "worldMap") return <div style={{ height: "100%", overflow: "hidden" }}><WorldMap allCities={D.worldMapCities} /></div>;
    return (
      <DualLineChart
        theme={componentTheme} size="fill" title={title} subtitle={subtitle}
        icon={<TrendingUp size={17} />} valueLabel={data.totalLabel} formatValue={format}
        labels={data.labels} total={data.unit === "percent" ? data.current.at(-1) : total}
        before={{ label: "Previous", color: activeSeriesColors[1], values: data.previous }}
        after={{ label: "Current", color: activeSeriesColors[0], values: data.current }}
      />
    );
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-7 flex flex-col gap-4 border-b border-gray-200 pb-6 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Interactive component lab</div>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-gray-950 dark:text-white sm:text-4xl">Build a chart for any product.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">General-purpose data, live parameters, and real container constraints. Every control below maps to a reusable component prop.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400">
          <span className="border border-gray-200 px-2.5 py-1.5 dark:border-white/10">React 18</span>
          <span className="border border-gray-200 px-2.5 py-1.5 dark:border-white/10">Responsive</span>
          <span className="border border-gray-200 px-2.5 py-1.5 dark:border-white/10">Themeable</span>
          <span className="border border-gray-200 px-2.5 py-1.5 dark:border-white/10">Accessible</span>
        </div>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border border-gray-200 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03] xl:sticky xl:top-0 xl:self-start">
          <div className="mb-4 flex items-center gap-2 text-sm font-extrabold text-gray-900 dark:text-white"><SlidersHorizontal size={16} /> Properties</div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Component"><ChartPicker value={chart} onChange={setChart} /></Field>
            <Field label="Dataset">
              <select className={controlClass} value={datasetKey} onChange={(e) => setDatasetKey(e.target.value)}>
                {Object.entries(STUDIO_DATASETS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
            </Field>
            <Field label="Title"><input className={controlClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Subtitle"><input className={controlClass} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></Field>
            <Field label="Surface">
              <select className={controlClass} value={surface} onChange={(e) => setSurface(e.target.value)}><option value="light">Neutral</option><option value="accent">Brand color</option></select>
            </Field>
            <Field label="Corner radius"><StepperSelect ariaLabel="Corner radius" value={radius} onChange={setRadius} options={RADIUS_OPTIONS} /></Field>
            <Field label="Outer border"><StepperSelect ariaLabel="Outer border" value={borderStyle} onChange={setBorderStyle} options={BORDER_OPTIONS} /></Field>
            <Field label="Accent color">
              <div className="mb-2 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Accent presets">
                {ACCENT_PRESETS.map((preset) => <button key={preset.value} type="button" role="radio" aria-checked={accent.toUpperCase() === preset.value} aria-label={preset.label} title={preset.label} onClick={() => setAccent(preset.value)} className={`h-8 border-2 transition-transform hover:-translate-y-0.5 ${accent.toUpperCase() === preset.value ? "border-gray-950 dark:border-white" : "border-transparent"}`} style={{ background: preset.value }} />)}
              </div>
              <div className="flex h-10 border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-[#202020]"><input aria-label="Custom accent color" type="color" className="h-full w-11 cursor-pointer border-0 bg-transparent" value={accent} onChange={(e) => setAccent(e.target.value.toUpperCase())} /><input aria-label="Accent hex value" className="min-w-0 flex-1 bg-transparent px-2 font-mono text-xs uppercase outline-none dark:text-white" value={accent} readOnly /></div>
            </Field>
            <Field label="Series colors">
              <div className="grid grid-cols-6 gap-1.5" aria-label={`${surface === "accent" ? "Brand" : "Neutral"} series palette`}>
                {activeSeriesColors.map((color, index) => (
                  <label key={index} className="relative h-9 cursor-pointer border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-[#202020]" title={`Series ${index + 1}: ${color}`}>
                    <span className="block h-full w-full" style={{ background: color }} />
                    <input aria-label={`Series color ${index + 1}`} type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={color} onChange={(event) => setActiveSeriesColor(index, event.target.value)} />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-wide text-gray-400">{surface === "accent" ? "Brand · white to slate" : "Data series"}</span>
                <button type="button" onClick={resetActiveSeriesColors} className="text-[9px] font-bold uppercase tracking-wide text-gray-500 underline-offset-2 hover:underline dark:text-gray-400">Reset palette</button>
              </div>
            </Field>
            <Field label="Container">
              <StepperSelect ariaLabel="Container size" value={sizeKey} onChange={setSizeKey} options={CONTAINER_OPTIONS} />
              <div className="mt-1.5 text-center font-mono text-[9px] text-gray-400">← → or ↑ ↓ switches instantly</div>
            </Field>
            {sizeKey === "custom" && <div className="grid grid-cols-2 gap-3"><Field label="Width"><input type="number" min="280" max="1200" className={controlClass} value={customWidth} onChange={(e) => setCustomWidth(Number(e.target.value))} /></Field><Field label="Height"><input type="number" min="240" max="800" className={controlClass} value={customHeight} onChange={(e) => setCustomHeight(Number(e.target.value))} /></Field></div>}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden border border-gray-200 bg-[#F6F7FB] dark:border-white/10 dark:bg-[#101010]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#1b1b1b]">
            <div><div className="text-xs font-bold text-gray-800 dark:text-white">Live preview</div><div className="font-mono text-[10px] text-gray-400">{width === "100%" ? "fluid width" : `${width}px`} × {height}px</div></div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowCode((value) => !value)} className="flex h-8 items-center gap-1.5 border border-gray-200 px-2.5 text-[10px] font-bold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"><Code2 size={13} /> {showCode ? "Hide code" : "View code"}</button>
              <button type="button" onClick={copyCode} className="flex h-8 items-center gap-1.5 bg-gray-950 px-2.5 text-[10px] font-bold text-white dark:bg-white dark:text-gray-950">{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy code"}</button>
              <div className="ml-1 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Live</span></div>
            </div>
          </div>
          <div className="overflow-x-auto p-3 sm:p-6 lg:p-10">
            <div className="mx-auto transition-[width,height] duration-300" style={previewStyle}>
              {renderChart()}
            </div>
          </div>
          <div className="grid border-t border-gray-200 bg-white dark:border-white/10 dark:bg-[#1b1b1b] sm:grid-cols-3">
            {[{ icon: ShoppingBag, label: "Domain", value: data.label }, { icon: UserPlus, label: "Data points", value: String(data.current.length) }, { icon: CreditCard, label: "Value format", value: data.unit }].map(({ icon: Icon, label, value }) => <div key={label} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-white/5 sm:border-b-0 sm:border-r sm:last:border-r-0"><Icon size={15} className="text-gray-400" /><div><div className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</div><div className="text-xs font-bold capitalize text-gray-800 dark:text-white">{value}</div></div></div>)}
          </div>
          {showCode && (
            <div className="border-t border-gray-200 bg-[#0D1117] p-4 dark:border-white/10">
              <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-400">React · generated from current properties</span><button type="button" onClick={copyCode} className="flex items-center gap-1.5 text-[10px] font-bold text-white">{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}</button></div>
              <pre className="max-h-80 overflow-auto whitespace-pre p-0 font-mono text-[11px] leading-5 text-slate-300"><code>{studioCode}</code></pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const SIZE_PRESETS = [
  { key: "square", label: "Small square", w: 300, h: 300 },
  { key: "wide", label: "Wide rectangle", w: 640, h: 260 },
  { key: "tall", label: "Tall rectangle", w: 300, h: 560 },
];

function SizesDemo() {
  const rankedProps = {
    items: D.routes.map((r) => ({ ...r, value: r.value })),
    title: "Top Routes",
    headerIcon: Trophy,
    metrics: [{ key: "value", label: "Revenue", getItemValue: (i) => i.value }],
    colorPalette: ["#0EA5E9", "#22D3EE", "#38BDF8", "#7DD3FC"],
    barColor: "#0EA5E9",
  };

  return (
    <div>
      <p className="max-w-3xl text-[13px] text-gray-500">
        <code className="bg-gray-100 px-1">RankedDataWidget</code> and <code className="bg-gray-100 px-1">ComparisonChart</code> are
        designed to fill whatever box you give them — no fixed aspect ratio baked in. Same props, three container shapes below.
      </p>

      <SectionLabel accent={SECTIONS.aqua.accent}>RankedDataWidget — list view</SectionLabel>
      <div className="flex flex-wrap gap-6">
        {SIZE_PRESETS.map((p) => (
          <Frame key={p.key} title={p.label} sub={`${p.w}×${p.h}`} w={p.w} h={p.h}>
            <RankedDataWidget {...rankedProps} defaultViewMode="horizontal" height="h-full" />
          </Frame>
        ))}
      </div>

      <SectionLabel accent={SECTIONS.aqua.accent}>RankedDataWidget — vertical bar view</SectionLabel>
      <div className="flex flex-wrap gap-6">
        {SIZE_PRESETS.map((p) => (
          <Frame key={p.key} title={p.label} sub={`${p.w}×${p.h}`} w={p.w} h={p.h}>
            <RankedDataWidget {...rankedProps} defaultViewMode="vertical" height="h-full" />
          </Frame>
        ))}
      </div>

      <SectionLabel accent={SECTIONS.aqua.accent}>RankedDataWidget — pie view</SectionLabel>
      <div className="flex flex-wrap gap-6">
        {SIZE_PRESETS.map((p) => (
          <Frame key={p.key} title={p.label} sub={`${p.w}×${p.h}`} w={p.w} h={p.h}>
            <RankedDataWidget {...rankedProps} defaultViewMode="pie" height="h-full" />
          </Frame>
        ))}
      </div>

      <SectionLabel accent={SECTIONS.violet.accent}>ComparisonChart — bar type</SectionLabel>
      <div className="flex flex-wrap gap-6">
        {SIZE_PRESETS.map((p) => (
          <Frame key={p.key} title={p.label} sub={`${p.w}×${p.h}`} w={p.w} h={p.h}>
            <ComparisonChart
              title="Revenue"
              data={D.comparisonRevenueData}
              selectedYears={[2025, 2026]}
              defaultType="bar"
              colors={["#9ca3af", SECTIONS.violet.accent]}
              embedded
            />
          </Frame>
        ))}
      </div>

      <SectionLabel accent={SECTIONS.violet.accent}>ComparisonChart — area type</SectionLabel>
      <div className="flex flex-wrap gap-6">
        {SIZE_PRESETS.map((p) => (
          <Frame key={p.key} title={p.label} sub={`${p.w}×${p.h}`} w={p.w} h={p.h}>
            <ComparisonChart
              title="Passengers"
              data={D.comparisonPaxData}
              selectedYears={[2025, 2026]}
              defaultType="area"
              colors={["#9ca3af", SECTIONS.violet.accent]}
              embedded
            />
          </Frame>
        ))}
      </div>

      <SectionLabel accent={SECTIONS.violet.accent}>ComparisonChart — line type</SectionLabel>
      <div className="flex flex-wrap gap-6">
        {SIZE_PRESETS.map((p) => (
          <Frame key={p.key} title={p.label} sub={`${p.w}×${p.h}`} w={p.w} h={p.h}>
            <ComparisonChart
              title="Revenue"
              data={D.comparisonRevenueData}
              selectedYears={[2025, 2026]}
              defaultType="line"
              colors={["#9ca3af", SECTIONS.violet.accent]}
              embedded
            />
          </Frame>
        ))}
      </div>
    </div>
  );
}

function ChartsGallery() {
  const grid = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
  const h = 280;
  return (
    <div className={grid}>
      <Named name="DualLineChart" height={h}><DualLineChart theme="light" size="fill" title="Revenue Trend" icon={<TrendingUp size={16} />} labels={D.revenueByMonth.map(m=>m.name)} after={{label:"2026",color:"#3B82F6",values:D.revenueByMonth.map(m=>m.value)}} before={{label:"2025",color:"#94a3b8",values:D.revenueByMonthPrev.map(m=>m.value)}} total={D.revenueByMonth.reduce((s,m)=>s+m.value,0)} formatValue={(v)=>`$${(v/1e6).toFixed(1)}M`} /></Named>
      <Named name="FunnelChart" height={h}><FunnelChart theme="light" size="fill" title="Conversion" icon={<Route size={16} />} stages={[{label:"Impressions",value:185256,color:"#7C3AED"},{label:"Clicks",value:112125,color:"#8B5CF6"},{label:"Signups",value:41527,color:"#A78BFA"}]} formatValue={(v)=>studioFormat(v, "number")} /></Named>
      <Named name="StackedBarChart" height={h}><StackedBarChart theme="light" size="fill" title="Cost vs Profit" icon={<DollarSign size={16} />} series={[{key:"cost",label:"Cost",color:"#F59E0B"},{key:"profit",label:"Profit",color:"#10B981"}]} data={D.revenueByMonth.slice(0,8).map((m,i)=>({label:m.name,values:{cost:m.value*0.7,profit:m.value*0.3}}))} /></Named>
      <Named name="ProgressGauge" height={h}><ProgressGauge theme="light" size="fill" title="Seat Utilisation" icon={<Gauge size={16} />} value={78} valueLabel="Load Factor" segments={[{label:"Occupied",value:78,color:"#15462D"},{label:"Boarding",value:12,color:"#267B54"},{label:"Available",value:10,color:"#60BD91",hatch:true}]} /></Named>
      <Named name="HexHealthChart" height={h}><HexHealthChart theme="light" title="Operational Health" icon={<Gauge size={16} />} overall={78} overallLabel="Load Factor" metrics={D.healthMetrics} suffix="%" size="fill" /></Named>
      <Named name="BarRankingChart" height={h}><BarRankingChart theme="light" size="fill" title="Top Routes" icon={<Trophy size={16} />} items={D.routes.map(r=>({label:r.name,value:r.value}))} formatValue={(v)=>`$${(v/1e6).toFixed(1)}M`} /></Named>
      <Named name="DonutChart" height={h}><DonutChart theme="light" size="fill" title="Cost Mix" icon={<DollarSign size={16} />} segments={D.costBreakdown.map(c=>({label:c.name,value:c.value}))} formatValue={(v)=>`$${(v/1e6).toFixed(1)}M`} /></Named>
      <Named name="RadarChart" height={h}><RadarChart theme="light" size="fill" title="Health Radar" icon={<Gauge size={16} />} data={D.healthMetrics.map(m=>({label:m.label,value:m.value}))} /></Named>
      <Named name="WaterfallChart" height={h}><WaterfallChart theme="light" size="fill" title="Revenue Bridge" icon={<TrendingUp size={16} />} data={[{label:"Start",value:20000000},{label:"New Routes",value:4200000},{label:"Fuel Cost",value:-1800000},{label:"End",value:22400000,isTotal:true}]} formatValue={(v)=>`$${(v/1e6).toFixed(1)}M`} /></Named>
    </div>
  );
}

function CardsGallery() {
  const grid = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
  const h = 280;
  return (
    <div className={grid}>
      <Named name="GradientStatCard" height={h}><GradientStatCard gradient="emerald" icon={<DollarSign size={15} />} label="Revenue" value="$26.7M" caption="vs $22.1M last year" pills={[{label:"Margin",value:"11.6%"},{label:"YoY",value:"+20.8%"}]} /></Named>
      <Named name="FleetSnapshotCard" height={h}><FleetSnapshotCard gradient="violet" aircraft={24} utilisation={D.flightsByMonth.slice(0,8).map(m=>({label:m.name,value:m.value}))} stats={[{icon:<Plane size={12}/>,label:"Stations",value:"12"},{icon:<Fuel size={12}/>,label:"Fuel/flight",value:"6.5K L"}]} /></Named>
      <Named name="TrendBarcodeCard" height={h}><TrendBarcodeCard theme="light" title="Flight Activity" icon={<Plane size={18} />} iconColor="#F59E0B" months={D.flightsByMonth} headlineValue="1.8K" headlineLabel="flights flown" formatValue={(v)=>studioFormat(v, "number")} stats={[{icon:<Gauge size={16}/>,value:"3.8K",label:"block hours"}]} /></Named>
      <Named name="ActivityCalendar" height={h}><ActivityCalendar theme="light" title="Flight Calendar" icon={<Route size={18} />} iconColor="#3B82F6" days={D.flightsByDay} unitLabel="flights" /></Named>
      <Named name="ProgressTrackList" height={h}><ProgressTrackList theme="light" icon={<Plane size={18} />} iconColor="#10B981" tails={D.tails} /></Named>
      <Named name="RadialBladeChart" height={h}><RadialBladeChart theme="light" icon={<Fuel size={18} />} iconColor="#F59E0B" months={D.fuelMonths} unit="L" /></Named>
      <Named name="PercentGradientCard" height={h}><PercentGradientCard gradient="amber" label="Seat Utilisation" percent={78} caption="Average load factor across all flights in range" months={D.loadFactorByMonth} /></Named>
      <Named name="MetricsTable" height={h}><MetricsTable theme="light" icon={<Gauge size={18} />} iconColor="#3B82F6" stations={D.stations} formatMoney={(v)=>`$${(v/1e6).toFixed(1)}M`} /></Named>
      <Named name="WeekdayBars" height={h}><WeekdayBars theme="light" icon={<Route size={18} />} iconColor="#F59E0B" days={D.flightsByDay} unitLabel="Flights" /></Named>
      <Named name="RankedLocationBoard" height={h}><RankedLocationBoard theme="light" icon={<MapPin size={18} />} iconColor="#3B82F6" routes={D.routes} airportCountry={AIRPORT_TO_COUNTRY} airportName={AIRPORT_TO_NAME} /></Named>
      <Named name="CompositionBar" height={h}><CompositionBar theme="light" icon={<DollarSign size={18} />} iconColor="#8B5CF6" items={D.costBreakdown} formatMoney={(v)=>`$${(v/1e6).toFixed(1)}M`} /></Named>
      <Named name="TargetBarcodeChart" height={h}><TargetBarcodeChart theme="light" icon={<Percent size={18} />} iconColor="#059669" title="Load Factor by Month" months={D.loadFactorByMonth} target={75} unit="%" /></Named>
      <Named name="RankedList" height={h}><RankedList theme="light" title="Top Routes" icon={<Trophy size={18} />} subtitle="By revenue" items={D.routes} formatValue={(v)=>`$${(v/1e6).toFixed(1)}M`} prevLabel="2025" /></Named>
    </div>
  );
}

function GeoDemo() {
  return (
    <div>
      <p className="max-w-3xl text-[13px] text-gray-500 mb-3">
        Plots animated route arcs between coordinate pairs on a real, pannable/zoomable world map. The airport codes here are sample
        data — see <code className="bg-gray-100 px-1">src/lib/geo/README.md</code> for how to swap in your own location set.
      </p>
      <div style={{ height: "70vh" }}>
        <WorldMap allCities={D.worldMapCities} isMobile={false} />
      </div>
    </div>
  );
}

// Live dark-mode state, mirrored onto <html class="dark"> — the same class
// every component in the library reads via isDarkMode() (see
// src/isDarkMode.js), so toggling this is what actually re-themes charts,
// not just the shell chrome around them.
function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleDark = () => {
    const next = !dark;
    // resolveTheme() reads this class during render. Set it before updating
    // React state so the keyed chart remount resolves the correct palette on
    // the very first dark/light frame instead of retaining stale light ink.
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  };
  return [dark, toggleDark];
}

export default function App() {
  const [page, setPage] = useState("studio");
  const [collapsed, setCollapsed] = useState(false);
  const [dark, toggleDark] = useDarkMode();

  return (
    <div className="min-h-screen bg-white dark:bg-[#141414] lg:flex">
      <aside
        className={`${collapsed ? "lg:w-16" : "lg:w-64"} sticky top-0 z-30 w-full flex-shrink-0 border-b border-gray-200 bg-white p-3 transition-[width] duration-200 dark:border-white/10 dark:bg-[#1b1b1b] lg:h-screen lg:border-b-0 lg:border-r lg:p-4 lg:overflow-hidden`}
      >
        <div className="mb-3 flex items-center justify-between gap-2 lg:mb-6">
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <div className="text-lg font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>dashkit</div>
            <div className="hidden whitespace-nowrap text-[11px] text-gray-400 sm:block">stable, responsive data components</div>
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden flex-shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 lg:block"
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = page === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setPage(n.key)}
                title={collapsed ? n.label : undefined}
                className={`flex shrink-0 items-center gap-2 rounded px-3 py-2 text-left text-[13px] font-medium lg:w-full ${collapsed ? "lg:justify-center lg:px-2" : ""} ${
                  active
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                }`}
              >
                <Icon size={15} className="flex-shrink-0" />
                <span className={collapsed ? "lg:hidden" : ""}>{n.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          onClick={toggleDark}
          title={collapsed ? (dark ? "Switch to light mode" : "Switch to dark mode") : undefined}
          className={`absolute right-12 top-3 flex items-center gap-2 rounded px-3 py-2 text-left text-[13px] font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 lg:static lg:mt-4 lg:w-full ${collapsed ? "lg:justify-center lg:px-2" : ""}`}
        >
          {dark ? <Sun size={15} className="flex-shrink-0" /> : <Moon size={15} className="flex-shrink-0" />}
          <span className={`hidden sm:inline ${collapsed ? "lg:hidden" : ""}`}>{dark ? "Light mode" : "Dark mode"}</span>
        </button>

        {!collapsed && (
          <div className="mt-8 hidden text-[10px] leading-relaxed text-gray-400 lg:block">
            Deterministic sample data. No network calls or product-specific assumptions.
          </div>
        )}
      </aside>
      {/* key forces a full remount on theme toggle — most chart components
          are memoized and read isDarkMode() once at render time, so without
          this they'd keep their stale colors after the .dark class flips. */}
      <main key={dark ? "dark" : "light"} className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:max-h-screen">
        {page === "studio" && <StudioDemo />}
        {page === "overview" && <OverviewDemo />}
        {page === "sizes" && <SizesDemo />}
        {page === "charts" && <ChartsGallery />}
        {page === "cards" && <CardsGallery />}
        {page === "geo" && <GeoDemo />}
      </main>
    </div>
  );
}
