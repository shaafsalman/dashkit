import React, { useMemo, useState, memo } from "react";
import { resolveTheme, AXIS_CATEGORY_TICK, AXIS_VALUE_TICK, AXIS_GRID_PROPS, AXIS_LINE_PROPS } from "./theme";
import { ChartCard, SIZES } from "./chrome";
import { compactCurrency } from "./format";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, LabelList,
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
    secondary: { label: "Projected income", display: "$1.3K" },
    bars: DEFAULT_BARS,
  },
  {
    value: "last",
    label: "Last week",
    primary: { label: "Earned last week", display: "$7.1K" },
    secondary: { label: "Weekly average", display: "$1.2K" },
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
    primary: { label: "Earned this month", display: "$24.8K" },
    secondary: { label: "Projected income", display: "$31.2K" },
    bars: [
      { label: "W1", value: 5600 },
      { label: "W2", value: 6100 },
      { label: "W3", value: 5800 },
      { label: "W4", today: true, earned: 7300, projected: 9700 },
    ],
  },
];

const fmtMoney = (v) => compactCurrency(v);

const ReferenceValueLabel = ({ viewBox, value, fill }) => {
  if (!viewBox) return null;
  const x = (viewBox.x || 0) + (viewBox.width || 0) - 5;
  const y = (viewBox.y || 0) - 6;
  return (
    <text x={x} y={y} textAnchor="end" fill={fill} fontSize="11" fontWeight="700">
      {value}
    </text>
  );
};

const EarningsBarChart = memo(
  ({
    title = "Earnings overview",
    subtitle,
    icon,
    iconColor,
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
      projected: b.today ? (b.projected || 0) : undefined,
    })), [active]);

    const periodControl = {
      type: "period",
      options: periods.map((p) => ({ label: p.label, value: p.value })),
      value: period,
      onChange: (v) => setPeriod(v),
    };
    const mergedControls = controls || (periods.length > 1 ? [periodControl] : undefined);

    const tickFmt = (v) => compactCurrency(v);
    const resolvedTicks = yTicks || [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

    const renderChart = (detailed) => {
      const fluid = size === "fill" && !detailed;
      const chartH = detailed ? 260 : fluid ? undefined : Math.max((SIZES[size] ?? SIZES.m) - 110, 100);
      const primaryDisplay = active.primary?.display || fmtMoney(active.primary?.value || 0);
      const secondaryDisplay = active.secondary?.display || fmtMoney(active.secondary?.value || 0);
      return (
        <div style={{ position: "relative", height: fluid ? "100%" : undefined, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 8, marginBottom: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: t.text.muted }}>{active.secondary?.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text.secondary }}>{secondaryDisplay}</div>
          </div>
          {/* recharts */}
          <div style={{ height: chartH, flex: fluid ? 1 : undefined, minHeight: fluid ? 120 : undefined, marginRight: -1, marginBottom: -10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 24, right: 4, bottom: 0, left: 8 }} barCategoryGap="24%">
                <CartesianGrid {...AXIS_GRID_PROPS} stroke={t.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ ...AXIS_CATEGORY_TICK, fontSize: 12, fill: t.text.muted }}
                  {...AXIS_LINE_PROPS}
                />
                <YAxis
                  tickFormatter={tickFmt}
                  tick={{ ...AXIS_VALUE_TICK, fontSize: 12, fill: t.text.muted }}
                  {...AXIS_LINE_PROPS}
                  width={58}
                  ticks={resolvedTicks}
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
                  label={<ReferenceValueLabel value={refLine.label} fill={t.text.muted} />}
                />
                {/* regular bars */}
                <Bar dataKey="value" radius={[5, 5, 0, 0]} isAnimationActive={false} maxBarSize={56}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={accent} />
                  ))}
                  <LabelList dataKey="value" position="top" formatter={fmtMoney} fill={t.text.primary} fontSize={10} fontWeight={700} />
                </Bar>
                {/* today bar — earned (bottom) */}
                <Bar dataKey="earned" stackId="today" fill={accentBright} isAnimationActive={false} maxBarSize={56} />
                {/* today bar — projected gap (top, rounded) */}
                <Bar dataKey="extra" stackId="today" radius={[5, 5, 0, 0]} fill={accentDark} isAnimationActive={false} maxBarSize={56}>
                  <LabelList dataKey="projected" position="top" formatter={fmtMoney} fill={t.text.primary} fontSize={10} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    };

    return (
      <ChartCard
        theme={t}
        title={title}
        subtitle={subtitle}
        icon={icon}
        iconColor={iconColor}
        controls={mergedControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
        floatingHeader
        headline={{ value: active.primary?.display || fmtMoney(active.primary?.value || 0) }}
      >
        {({ detailed }) => renderChart(detailed)}
      </ChartCard>
    );
  }
);

EarningsBarChart.displayName = "EarningsBarChart";
export default EarningsBarChart;
