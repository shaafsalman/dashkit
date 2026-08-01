import React, { useState } from "react";
import {
  AreaChart,
  Area as RechartsArea,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatLabel } from "./dataUtils.js";
import { AXIS_CATEGORY_TICK, AXIS_VALUE_TICK, AXIS_LINE_PROPS, AXIS_GRID_PROPS } from "../lib/charts/theme";

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border-2 border-gray-300 p-3 min-w-[150px]">
        <div className="text-sm font-bold text-gray-900 mb-2" style={{ fontFamily: SANS }}>
          {label}
        </div>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
            <div
              className="w-2.5 h-2.5 flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs font-medium text-gray-600" style={{ fontFamily: SANS }}>
              {entry.name}:
            </span>
            <span className="text-xs font-extrabold text-gray-900" style={{ fontFamily: MONO }}>
              {formatLabel(entry.value, true)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const parseMonth = (monthStr) => {
  const str = monthStr.toString().trim();

  const monthNames = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };

  // Was /^([a-z]+)-?(\d{2,4})$/ — no space allowed, so "Jan 2025" never
  // parsed and the whole series silently vanished.
  const match = str.match(/^([a-z]+)[-\s_]*(\d{2,4})$/i);
  if (match) {
    const monthName = match[1].toLowerCase();
    let year = parseInt(match[2]);
    if (year < 100) {
      year = year >= 50 ? 1900 + year : 2000 + year;
    }
    const month = monthNames[monthName];
    if (month !== undefined) {
      return { month, year, monthName };
    }
  }

  return null;
};

// In single-metric mode the widget emits points as `{name, value}`, but in
// compare mode it emits `{name, [metricKey]: n, ...}` with no `value` at all.
// Reading `item.value` unconditionally therefore returned undefined for every
// point in compare mode, nulled the whole series and rendered an empty chart.
const resolveValue = (item, valueKey) => {
  if (item.value !== undefined && item.value !== null) return item.value;
  if (valueKey && item[valueKey] !== undefined) return item[valueKey];
  return undefined;
};

const groupByYear = (data, valueKey) => {
  const yearGroups = {};
  const monthOrder = [];

  data.forEach((item) => {
    const parsed = parseMonth(item.name);
    if (parsed) {
      const { year, month, monthName } = parsed;
      if (!yearGroups[year]) {
        yearGroups[year] = {};
      }
      yearGroups[year][monthName] = resolveValue(item, valueKey);

      if (!monthOrder.includes(monthName)) {
        monthOrder.push(monthName);
      }
    }
  });

  return { yearGroups, monthOrder };
};

const createParallelData = (data, valueKey) => {
  const { yearGroups, monthOrder } = groupByYear(data, valueKey);
  const years = Object.keys(yearGroups).sort();

  const parallelData = monthOrder.map((month) => {
    const dataPoint = { name: month.charAt(0).toUpperCase() + month.slice(1) };
    years.forEach((year) => {
      const val = yearGroups[year][month];
      dataPoint[`year${year}`] =
        val === 0 || val === undefined || val === null ? null : val;
    });
    return dataPoint;
  });

  return { parallelData, years };
};

const colors = [
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

const AreaChartView = ({ chartData, decimal = true, valueKey = null, maxValue = null }) => {
  const { parallelData, years } = createParallelData(chartData, valueKey);
  const hasMultipleYears = years.length > 2;
  const [activeYear, setActiveYear] = useState(
    hasMultipleYears ? years[years.length - 1] : null,
  );

  const visibleYears = hasMultipleYears && activeYear ? [activeYear] : years;

  const allValues = parallelData.flatMap((item) =>
    visibleYears.map((year) => item[`year${year}`] || 0),
  );
  const localMaxValue = Math.max(...allValues);
  // Shared with VerticalBarView/LineChartView via the `maxValue` prop (passed
  // by RankedDataWidget) so the Y-axis stops moving when the view type
  // switches — falls back to this view's own scan when no shared value was
  // given (e.g. standalone usage outside the ranked widget).
  const resolvedMaxValue =
    typeof maxValue === "number" && maxValue > 0 ? maxValue : localMaxValue;

  const generateTickValues = (maxVal) => {
    if (maxVal < 1) {
      const step = maxVal <= 0.1 ? 0.02 : maxVal <= 0.5 ? 0.1 : 0.2;
      const normalizedMax = Math.ceil(maxVal / step) * step;
      const tickCount = Math.ceil(normalizedMax / step) + 1;
      return Array.from({ length: tickCount }, (_, i) => i * step);
    }

    const tickCount = 5;
    return Array.from({ length: tickCount }, (_, i) =>
      Math.round((maxVal * i) / (tickCount - 1)),
    );
  };

  return (
    <div className="w-full h-full overflow-hidden">
      {hasMultipleYears && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            padding: "4px 8px 2px",
          }}
        >
          {years.map((year) => (
            <button
              key={year}
              onClick={() => setActiveYear(year)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: MONO,
                padding: "2px 7px",
                border: "none",
                background: activeYear === year ? "var(--chart-tooltip-bg)" : "transparent",
                color: activeYear === year ? "var(--chart-tick-strong)" : "var(--chart-tick-dim)",
                cursor: "pointer",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              {year}
            </button>
          ))}
        </div>
      )}
      <div className="h-full" style={{ marginTop: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={parallelData}
            // left was -20, which pulled the plot over the Y-axis gutter and
            // clipped the tick labels once the axis width was trimmed.
            margin={{ top: 4, right: 12, left: 0, bottom: -10 }}
          >
            <defs>
              {visibleYears.map((year, index) => {
                const originalIndex = years.indexOf(year);
                const color = colors[originalIndex % colors.length];
                return (
                  <linearGradient
                    key={year}
                    id={`gradient${year}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.1} />
                  </linearGradient>
                );
              })}
            </defs>

            {/* Same axis treatment as the bar view and DualLineChart: dashed
                horizontal rules, no spines or tick marks, calm gray labels. */}
            <CartesianGrid
              {...AXIS_GRID_PROPS}
              vertical={false}
              strokeWidth={1}
            />

            <XAxis
              dataKey="name"
              {...AXIS_LINE_PROPS}
              tick={AXIS_CATEGORY_TICK}
              height={30}
              interval="preserveStartEnd"
              minTickGap={4}
              padding={{ left: 8, right: 8 }}
            />

            <YAxis
              {...AXIS_LINE_PROPS}
              tick={AXIS_VALUE_TICK}
              tickFormatter={(value) => formatLabel(value, decimal)}
              domain={[0, resolvedMaxValue]}
              ticks={generateTickValues(resolvedMaxValue)}
              allowDecimals={decimal}
              // 80px was dead gutter, but 38px clipped 4-glyph ticks like
              // "98%" / "250K". 46px fits them with a little air.
              width={46}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* `line` drew a dash-plus-ring marker that read as dated; a plain
                dot matches the legend style used elsewhere in the widget. */}
            <Legend
              verticalAlign="top"
              align="right"
              height={20}
              // Square swatch to match the bar and dual-line legends.
              iconType="square"
              iconSize={9}
              wrapperStyle={{
                paddingBottom: "2px",
                fontSize: "11px",
                fontWeight: "700",
                fontFamily: MONO,
              }}
            />

            {visibleYears.map((year) => {
              const originalIndex = years.indexOf(year);
              const color = colors[originalIndex % colors.length];
              return (
                <RechartsArea
                  key={year}
                  type="monotone"
                  dataKey={`year${year}`}
                  name={year}
                  stroke={color}
                  strokeWidth={2.5}
                  fill={`url(#gradient${year})`}
                  connectNulls={false}
                  // A ringed dot on all 12 months was heavier than the line it
                  // sat on; the point is now a small solid mark and the ring is
                  // reserved for the hovered one.
                  dot={{
                    fill: color,
                    strokeWidth: 0,
                    r: 2.5,
                  }}
                  activeDot={{
                    r: 5,
                    stroke: "#fff",
                    strokeWidth: 2,
                    fill: color,
                  }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AreaChartView;
