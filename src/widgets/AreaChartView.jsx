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

  const match = str.match(/^([a-z]+)-?(\d{2,4})$/i);
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

const groupByYear = (data) => {
  const yearGroups = {};
  const monthOrder = [];

  data.forEach((item) => {
    const parsed = parseMonth(item.name);
    if (parsed) {
      const { year, month, monthName } = parsed;
      if (!yearGroups[year]) {
        yearGroups[year] = {};
      }
      yearGroups[year][monthName] = item.value;

      if (!monthOrder.includes(monthName)) {
        monthOrder.push(monthName);
      }
    }
  });

  return { yearGroups, monthOrder };
};

const createParallelData = (data) => {
  const { yearGroups, monthOrder } = groupByYear(data);
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

const AreaChartView = ({ chartData, decimal = true }) => {
  const { parallelData, years } = createParallelData(chartData);
  const hasMultipleYears = years.length > 2;
  const [activeYear, setActiveYear] = useState(
    hasMultipleYears ? years[years.length - 1] : null,
  );

  const visibleYears = hasMultipleYears && activeYear ? [activeYear] : years;

  const allValues = parallelData.flatMap((item) =>
    visibleYears.map((year) => item[`year${year}`] || 0),
  );
  const maxValue = Math.max(...allValues);

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
            gap: 4,
            padding: "8px 16px 4px",
          }}
        >
          {years.map((year) => (
            <button
              key={year}
              onClick={() => setActiveYear(year)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: MONO,
                padding: "3px 12px",
                border: activeYear === year ? "1px solid #1F2937" : "1px solid #D1D5DB",
                background: activeYear === year ? "#1F2937" : "#F9FAFB",
                color: activeYear === year ? "#ffffff" : "#4B5563",
                cursor: "pointer",
                transition: "background-color 0.15s, border-color 0.15s",
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
            margin={{ top: 4, right: 12, left: -20, bottom: -10 }}
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

            <CartesianGrid
              strokeDasharray="2 4"
              stroke="rgba(148,163,184,0.3)"
              vertical={false}
              strokeWidth={1}
            />

            <XAxis
              dataKey="name"
              axisLine={true}
              tickLine={true}
              tick={{
                fontSize: 11,
                fill: "#475569",
                fontWeight: "600",
                fontFamily: SANS,
              }}
              height={50}
              interval={0}
              padding={{ left: 8, right: 8 }}
            />

            <YAxis
              axisLine={true}
              tickLine={true}
              tick={{
                fontSize: 10,
                fill: "#64748b",
                fontWeight: "500",
                fontFamily: MONO,
              }}
              tickFormatter={(value) => formatLabel(value, decimal)}
              domain={[0, maxValue * 1.1]}
              ticks={generateTickValues(maxValue * 1.1)}
              allowDecimals={decimal}
              width={80}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              height={24}
              iconType="line"
              wrapperStyle={{
                paddingBottom: "4px",
                fontSize: "12px",
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
                  strokeWidth={3}
                  fill={`url(#gradient${year})`}
                  connectNulls={false}
                  dot={{
                    fill: color,
                    strokeWidth: 2,
                    stroke: "#fff",
                    r: 4,
                  }}
                  activeDot={{
                    r: 6,
                    stroke: color,
                    strokeWidth: 3,
                    fill: "#fff",
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
