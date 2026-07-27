import React, { useState, useMemo, memo, useCallback } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  Layers,
  TrendingUp,
  Calculator,
  Award,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const COLORS = [
  "#2196F3",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
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
const AXIS = { fontSize: 12, fill: "#4B5563", fontWeight: 700, fontFamily: MONO };
const GRID = {
  strokeDasharray: "3 3",
  stroke: "#e5e7eb",
  strokeOpacity: 1,
  vertical: false,
};

const color = (i) => COLORS[i % COLORS.length];
const fmt = (v, pct) =>
  pct
    ? `${Math.round(v)}%`
    : v >= 1e6
    ? `${(v / 1e6).toFixed(1)}M`
    : v >= 1e3
    ? `${(v / 1e3).toFixed(1)}K`
    : Math.round(v).toLocaleString();

const Tooltip = memo(({ active, payload, label, f }) =>
  active && payload?.length ? (
    <div className="bg-white border-2 border-gray-300 p-3">
      <div
        className="font-bold text-gray-900 border-b border-gray-200 pb-2 mb-2"
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
            <span className="text-gray-600 font-medium text-sm" style={{ fontFamily: SANS }}>
              {e.dataKey}
            </span>
          </div>
          <span className="font-bold text-gray-900 text-sm" style={{ fontFamily: MONO }}>
            {f(e.value)}
          </span>
        </div>
      ))}
    </div>
  ) : null
);

const BarLabel = memo(({ x, y, width, value, f, total }) =>
  value ? (
    <g>
      <text
        x={x + width / 2}
        y={y - 16}
        fill="#111827"
        textAnchor="middle"
        fontSize="10"
        fontWeight="800"
        fontFamily={MONO}
      >
        {f(value)}
      </text>
      <text
        x={x + width / 2}
        y={y - 5}
        fill="#6B7280"
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fontFamily={MONO}
      >
        {total > 0 ? ((value / total) * 100).toFixed(1) : 0}%
      </text>
    </g>
  ) : null
);

const Empty = memo(({ title, Icon }) => (
  <div className="bg-white border-2 border-gray-300">
    <div className="bg-white p-2.5 border-b border-gray-200 flex items-center gap-3">
      <Icon className="w-[18px] h-[18px] text-gray-500" />
      <h2 className="text-[15px] font-extrabold text-gray-900" style={{ fontFamily: SANS }}>
        {title}
      </h2>
    </div>
    <div className="text-center py-8 px-4">
      <div className="w-12 h-12 mx-auto bg-gray-100 border border-gray-300 flex items-center justify-center mb-4">
        <BarChart3 className="w-6 h-6 text-gray-400" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: SANS }}>
        Select Years to Compare
      </h3>
      <p className="text-gray-500 text-sm" style={{ fontFamily: SANS }}>
        Choose years from above to start analyzing
      </p>
    </div>
  </div>
));

const Stat = memo(({ c, value, f, sm }) => (
  <div
    className={`flex gap-2 p-2 items-center bg-gray-50 border border-gray-300 ${
      sm ? "justify-between" : ""
    }`}
  >
    <c.icon className={`${sm ? "w-3.5 h-3.5" : "w-4 h-4"} text-gray-400 shrink-0`} />
    <div className="flex flex-col min-w-0 flex-1">
      <div
        className={`${sm ? "text-[9px]" : "text-[10px]"} text-gray-500 font-bold uppercase tracking-wide`}
        style={{ fontFamily: SANS }}
      >
        {c.label}
      </div>
      <div
        className={`${sm ? "text-sm" : "text-base"} font-extrabold text-gray-900`}
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
    height = 300,
    selectedYears = [],
  }) => {
    const [type, setType] = useState("bar");
    const [open, setOpen] = useState(true);

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

      const isMonth = rows.some((r) => MONTH_ORDER.includes(r.name));
      const sorted = (
        isMonth
          ? rows.sort(
              (a, b) =>
                MONTH_ORDER.indexOf(a.name) - MONTH_ORDER.indexOf(b.name)
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
      const barSize =
        n <= 2
          ? 24
          : n <= 4
          ? Math.max(14, 180 / (n * len))
          : Math.max(8, 140 / (n * len));
      return { chartData: sorted, stats, years, total, barSize };
    }, [data, selectedYears]);

    const f = useCallback((v) => fmt(v, showPercentage), [showPercentage]);
    const n = years.length;
    const h = open ? height + (n > 4 ? (n - 4) * 20 : 0) : height + 100;
    const labels = n <= 3;
    const sm = n > 4;
    const cols = Math.min(n, n <= 2 ? 2 : n <= 4 ? n : 5);

    const chart = useCallback(() => {
      const p = {
        data: chartData,
        margin: { top: 40, right: 20, left: 20, bottom: 10 },
      };
      const xa = <XAxis dataKey="displayName" tick={AXIS} />;
      const ya = <YAxis tickFormatter={f} tick={AXIS} width={55} />;
      const g = <CartesianGrid {...GRID} />;
      const tt = <RechartsTooltip content={<Tooltip f={f} />} />;

      if (type === "area")
        return (
          <AreaChart {...p}>
            <defs>
              {years.map((y, i) => (
                <linearGradient
                  key={y}
                  id={`g-${y}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={color(i)} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={color(i)} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            {g}
            {xa}
            {ya}
            {tt}
            {years.map((y, i) => (
              <Area
                key={y}
                type="monotone"
                dataKey={y}
                stroke={color(i)}
                fill={`url(#g-${y})`}
                strokeWidth={2.5}
              />
            ))}
          </AreaChart>
        );

      if (type === "line") {
        const w = n > 4 ? 2.5 : 4,
          r = n > 4 ? 3 : 5;
        return (
          <LineChart {...p}>
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
                label={
                  labels
                    ? ({ x, y: ly, value }) => (
                        <text
                          x={x}
                          y={ly - 10}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="700"
                          fontFamily={MONO}
                          fill="#111827"
                        >
                          {f(value)}
                        </text>
                      )
                    : false
                }
              />
            ))}
          </LineChart>
        );
      }

      return (
        <BarChart
          {...p}
          barSize={barSize}
          barGap={n > 4 ? 1 : 2}
          barCategoryGap={n > 4 ? "8%" : "12%"}
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
    }, [type, chartData, years, f, total, barSize, labels, n]);

    if (!n) return <Empty title={title} Icon={Icon} />;

    return (
      <div className="bg-white border-2 border-gray-300 overflow-hidden">
        <div className="bg-white p-2.5 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <Icon className="w-[18px] h-[18px] text-gray-500" />
              <h2
                className="text-[15px] font-extrabold text-gray-900"
                style={{ fontFamily: SANS, letterSpacing: "-0.01em" }}
              >
                {title}
              </h2>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                {years.map((y, i) => (
                  <div key={y} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color(i) }}
                    />
                    <span
                      className="text-xs font-bold text-gray-700"
                      style={{ fontFamily: MONO }}
                    >
                      {y}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex bg-white border border-gray-300">
                {CHART_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-colors ${
                      type === t.id
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                    style={{ fontFamily: SANS }}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-3">
          <ResponsiveContainer width="100%" height={h}>
            {chart()}
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-100 relative border-t-2 border-gray-300">
          <div
            className={`absolute -right-4 -translate-x-1/2 z-10 transition-all duration-300 ${
              open ? "-top-4" : "-top-4"
            }`}
          >
            <button
              onClick={() => setOpen((o) => !o)}
              className="bg-gray-900 hover:bg-gray-700 text-white p-1.5 border-2 border-white"
            >
              {open ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>
          <div
            className={`transition-all duration-500 overflow-hidden ${
              open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="p-3 pt-4">
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                }}
              >
                {years.map((y, i) => (
                  <div
                    key={y}
                    className="bg-white border border-gray-300 p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color(i) }}
                      />
                      <h4
                        className="font-extrabold text-gray-900"
                        style={{ fontFamily: MONO }}
                      >
                        {y}
                      </h4>
                    </div>
                    <div
                      className={`grid gap-2 ${
                        sm ? "grid-cols-1" : "grid-cols-3"
                      }`}
                    >
                      {STATS.filter(
                        (c) =>
                          !(
                            c.key === "sum" &&
                            showPercentage &&
                            stats[y]?.sum > 100
                          )
                      ).map((c) => (
                        <Stat
                          key={c.key}
                          c={c}
                          value={stats[y]?.[c.key] || 0}
                          f={f}
                          sm={sm}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default ComparisonChart;
