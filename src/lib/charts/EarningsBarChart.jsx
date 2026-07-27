import React, { useMemo, useState, memo } from "react";
import { resolveTheme } from "./theme";
import { ChartCard, SIZES } from "./chrome";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

const DEFAULT_THEME = { base: "light", surface: "#ffffff", radius: 24, pad: 24 };

const DEFAULT_BARS = [
  { label: "MON", value: 1290 },
  { label: "TUE", value: 1300 },
  { label: "WED", value: 1180 },
  { label: "THU", value: 1480 },
  { label: "FRI", value: 1380 },
  { label: "TODAY", today: true, earned: 960, projected: 1290 },
];

const DEFAULT_PERIODS = [
  {
    value: "week",
    label: "This week",
    primary: { label: "Earned so far today", display: "$960" },
    secondary: { label: "Projected income", display: "$1,290" },
    bars: DEFAULT_BARS,
  },
  {
    value: "last",
    label: "Last week",
    primary: { label: "Earned last week", display: "$7,140" },
    secondary: { label: "Weekly average", display: "$1,190" },
    bars: [
      { label: "MON", value: 1120 },
      { label: "TUE", value: 1240 },
      { label: "WED", value: 980 },
      { label: "THU", value: 1360 },
      { label: "FRI", value: 1210 },
      { label: "SAT", value: 1230 },
    ],
  },
  {
    value: "month",
    label: "This month",
    primary: { label: "Earned this month", display: "$24,800" },
    secondary: { label: "Projected income", display: "$31,200" },
    bars: [
      { label: "W1", value: 5600 },
      { label: "W2", value: 6100 },
      { label: "W3", value: 5800 },
      { label: "W4", today: true, earned: 7300, projected: 9700 },
    ],
  },
];

const fmtMoney = (v) => `$${Number(v || 0).toLocaleString("en-US")}`;

const EarningsBarChart = memo(
  ({
    eyebrow = "OVERVIEW",
    theme,
    controls,
    onControl,
    periods = DEFAULT_PERIODS,
    refLine = { value: 720, label: "$ 720" },
    yMax = 2000,
    yTicks,
    accent = "#1f6fe5",
    accentBright = "#2b8bff",
    accentDark = "#16467f",
    width = 480,
    size = "m",
    expandable = false,
    className = "",
  }) => {
    const t = resolveTheme(theme || DEFAULT_THEME, "light");
    const [period, setPeriod] = useState(periods[0]?.value);

    const active = useMemo(
      () => periods.find((p) => p.value === period) || periods[0],
      [periods, period]
    );

    // Normalise bars: regular bars have `value`; today bars split into earned + extra (gap to projected)
    const chartData = useMemo(() => (active.bars || []).map((b) => ({
      label: b.label,
      isToday: !!b.today,
      value: b.today ? undefined : (b.value || 0),
      earned: b.today ? (b.earned || 0) : undefined,
      extra: b.today ? Math.max(0, (b.projected || 0) - (b.earned || 0)) : undefined,
    })), [active]);

    const periodControl = {
      type: "period",
      options: periods.map((p) => ({ label: p.label, value: p.value })),
      value: period,
      onChange: (v) => setPeriod(v),
    };
    const mergedControls = controls || (periods.length > 1 ? [periodControl] : undefined);

    const tickFmt = (v) => {
      if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
      if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
      return `$${v}`;
    };

    const renderChart = (detailed) => {
      const chartH = detailed ? 260 : Math.max((SIZES[size] ?? SIZES.m) - 110, 100);
      return (
        <div style={{ position: "relative" }}>
          {/* eyebrow */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: t.text.muted, marginBottom: 10, textTransform: "uppercase" }}>
            {eyebrow}
          </div>
          {/* headline stats */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 13, lineHeight: 1.3, color: t.text.muted, maxWidth: "50%" }}>
              {active.primary?.label}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: t.text.primary }}>
              {active.primary?.display}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: t.text.muted }}>{active.secondary?.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text.secondary }}>{active.secondary?.display}</div>
          </div>
          {/* recharts */}
          <div style={{ height: chartH, marginRight: -1, marginBottom: -10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="10%">
                <CartesianGrid strokeDasharray="4 5" stroke={t.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: t.text.muted, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={tickFmt}
                  tick={{ fontSize: 11, fill: t.text.muted }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={[0, yMax]}
                />
                <Tooltip
                  formatter={(v, name) => [
                    fmtMoney(v),
                    name === "extra" ? "Projected (gap)" : name === "earned" ? "Earned" : "Revenue",
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${t.border}`,
                    background: t.surface,
                    fontSize: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,.08)",
                  }}
                  labelStyle={{ color: t.text.primary, fontWeight: 600 }}
                  cursor={{ fill: `${accent}10` }}
                />
                <ReferenceLine
                  y={refLine.value}
                  stroke={accent}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={{
                    value: refLine.label,
                    fill: t.text.muted,
                    fontSize: 11,
                    fontWeight: 600,
                    position: "insideTopLeft",
                    offset: 4,
                  }}
                />
                {/* regular bars */}
                <Bar dataKey="value" radius={[5, 5, 0, 0]} isAnimationActive={false} maxBarSize={80}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={accent} />
                  ))}
                </Bar>
                {/* today bar — earned (bottom) */}
                <Bar dataKey="earned" stackId="today" fill={accentBright} isAnimationActive={false} maxBarSize={80} />
                {/* today bar — projected gap (top, rounded) */}
                <Bar dataKey="extra" stackId="today" radius={[5, 5, 0, 0]} fill={accentDark} isAnimationActive={false} maxBarSize={80} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    };

    return (
      <ChartCard
        theme={t}
        controls={mergedControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
      >
        {({ detailed }) => renderChart(detailed)}
      </ChartCard>
    );
  }
);

EarningsBarChart.displayName = "EarningsBarChart";
export default EarningsBarChart;
