import { useEffect, useState } from "react";
import {
  DollarSign, Users, TrendingUp, Percent, Route, Gauge, Plane, Fuel,
  Trophy, MapPin, LayoutGrid, Table2, Boxes, Globe2,
  ChevronsLeft, ChevronsRight, Sun, Moon,
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
  WorldMap,
  whiteTheme,
  solidTheme,
  SECTIONS,
  AIRPORT_TO_COUNTRY,
  AIRPORT_TO_NAME,
} from "dashkit";
import * as D from "./dummyData.js";

const NAV = [
  { key: "overview", label: "Dummy Overview", icon: LayoutGrid },
  { key: "sizes", label: "Ranked & Comparison — all sizes", icon: Boxes },
  { key: "charts", label: "Charts", icon: TrendingUp },
  { key: "cards", label: "Dashboard Cards", icon: Table2 },
  { key: "geo", label: "World Map", icon: Globe2 },
];

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
            formatValue={(v) => v.toLocaleString()}
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
            <RankedList theme={whiteTheme("slate")} title="Station Performance" icon={<Gauge size={18} />} subtitle="By flights" items={D.stations.map((s) => ({ label: s.name, value: s.flights }))} formatValue={(v) => v.toLocaleString()} />
          </div>
          <div className="h-full min-h-0 lg:col-span-3">
            <RankedList
              theme={solidTheme("slate")} title="Top Destinations" icon={<MapPin size={18} />}
              subtitle="By passengers" items={D.destinations} formatValue={(v) => v.toLocaleString()}
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
              formatValue={(v) => v.toLocaleString()} {...D.networkProps}
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
      <Named name="FunnelChart" height={h}><FunnelChart theme="light" size="fill" title="Conversion" icon={<Route size={16} />} stages={[{label:"Impressions",value:185256,color:"#7C3AED"},{label:"Clicks",value:112125,color:"#8B5CF6"},{label:"Signups",value:41527,color:"#A78BFA"}]} formatValue={(v)=>v.toLocaleString()} /></Named>
      <Named name="StackedBarChart" height={h}><StackedBarChart theme="light" size="fill" title="Cost vs Profit" icon={<DollarSign size={16} />} series={[{key:"cost",label:"Cost",color:"#F59E0B"},{key:"profit",label:"Profit",color:"#10B981"}]} data={D.revenueByMonth.slice(0,8).map((m,i)=>({label:m.name,values:{cost:m.value*0.7,profit:m.value*0.3}}))} /></Named>
      <Named name="ProgressGauge" height={h}><ProgressGauge theme="light" size="fill" title="Seat Utilisation" icon={<Gauge size={16} />} value={78} valueLabel="Load Factor" segments={[{label:"Occupied",value:78,color:"#15462D"},{label:"Boarding",value:12,color:"#267B54"},{label:"Available",value:10,color:"#60BD91",hatch:true}]} /></Named>
      <Named name="HexHealthChart" height={h}><HexHealthChart theme="light" title="Operational Health" icon={<Gauge size={16} />} overall={78} overallLabel="Load Factor" metrics={D.healthMetrics} suffix="%" size="fill" /></Named>
      <Named name="BarRankingChart" height={h}><BarRankingChart theme="light" size="fill" title="Top Routes" icon={<Trophy size={16} />} items={D.routes.map(r=>({label:r.name,value:r.value}))} formatValue={(v)=>`$${(v/1e6).toFixed(1)}M`} /></Named>
      <Named name="DonutChart" height={h}><DonutChart theme="light" size="fill" title="Cost Mix" icon={<DollarSign size={16} />} data={D.costBreakdown.map(c=>({label:c.name,value:c.value}))} formatValue={(v)=>`$${(v/1e6).toFixed(1)}M`} /></Named>
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
      <Named name="TrendBarcodeCard" height={h}><TrendBarcodeCard theme="light" title="Flight Activity" icon={<Plane size={18} />} iconColor="#F59E0B" months={D.flightsByMonth} headlineValue="1.8K" headlineLabel="flights flown" formatValue={(v)=>v.toLocaleString()} stats={[{icon:<Gauge size={16}/>,value:"3.8K",label:"block hours"}]} /></Named>
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
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return [dark, setDark];
}

export default function App() {
  const [page, setPage] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useDarkMode();

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#141414]">
      <aside
        className={`${collapsed ? "w-16" : "w-64"} flex-shrink-0 border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#1b1b1b] p-4 transition-[width] duration-200 overflow-hidden`}
      >
        <div className="mb-6 flex items-center justify-between gap-2">
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-lg font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>dashkit</div>
              <div className="text-[11px] text-gray-400 whitespace-nowrap">component showcase — dummy data</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex-shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = page === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setPage(n.key)}
                title={collapsed ? n.label : undefined}
                className={`flex items-center gap-2 rounded px-3 py-2 text-left text-[13px] font-medium ${collapsed ? "justify-center px-2" : ""} ${
                  active
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                }`}
              >
                <Icon size={15} className="flex-shrink-0" />
                {!collapsed && n.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => setDark((d) => !d)}
          title={collapsed ? (dark ? "Switch to light mode" : "Switch to dark mode") : undefined}
          className={`mt-4 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[13px] font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 ${collapsed ? "justify-center px-2" : ""}`}
        >
          {dark ? <Sun size={15} className="flex-shrink-0" /> : <Moon size={15} className="flex-shrink-0" />}
          {!collapsed && (dark ? "Light mode" : "Dark mode")}
        </button>

        {!collapsed && (
          <div className="mt-8 text-[10px] text-gray-400 leading-relaxed">
            All data on this page is fake and deterministic — nothing here calls a real API.
          </div>
        )}
      </aside>
      {/* key forces a full remount on theme toggle — most chart components
          are memoized and read isDarkMode() once at render time, so without
          this they'd keep their stale colors after the .dark class flips. */}
      <main key={dark ? "dark" : "light"} className="flex-1 p-6 overflow-y-auto" style={{ maxHeight: "100vh" }}>
        {page === "overview" && <OverviewDemo />}
        {page === "sizes" && <SizesDemo />}
        {page === "charts" && <ChartsGallery />}
        {page === "cards" && <CardsGallery />}
        {page === "geo" && <GeoDemo />}
      </main>
    </div>
  );
}
