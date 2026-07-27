import React, { useMemo, memo, useState, useRef } from "react";
import { resolveTheme } from "./theme";
import { ChartCard, Stat, SIZES } from "./chrome";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const fmtMoneyDefault = (v) => `$${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const DEFAULTS = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  before: { label: "Before", color: "#94a3b8", values: [320, 300, 250, 360, 300, 380] },
  after: { label: "After", color: "#e0653a", values: [410, 380, 360, 420, 470, 560] },
};

const toQuarterly = (labels, before, after) => {
  const qLabels = [];
  const bVals = [];
  const aVals = [];
  for (let i = 0; i < labels.length; i += 3) {
    qLabels.push(`Q${qLabels.length + 1}`);
    let bs = 0, as = 0;
    for (let j = i; j < Math.min(i + 3, labels.length); j++) {
      bs += Number(before.values?.[j] || 0);
      as += Number(after.values?.[j] || 0);
    }
    bVals.push(bs);
    aVals.push(as);
  }
  return {
    labels: qLabels,
    before: { ...before, values: bVals },
    after: { ...after, values: aVals },
  };
};

const DualLineChart = memo(
  ({
    title = "Revenue",
    subtitle,
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    valueLabel = "Total Revenue",
    total = 620873,
    changePct = null,
    labels = DEFAULTS.labels,
    before = DEFAULTS.before,
    after = DEFAULTS.after,
    cursorIndex = 3,
    formatValue,
    width = 520,
    size = "l",
    expandable = false,
    className = "",
    // Renders only the `after` series — same component, chrome and interactions
    // as the two-series version, so single-metric trends stay visually
    // consistent with the YoY comparisons sitting next to them. The prior-year
    // line, its legend entry, its toggle, its stats card and its table columns
    // all drop out together; `before` is then ignored entirely.
    singleSeries = false,
  }) => {
    const uid = useRef(`dl-${Math.random().toString(36).slice(2, 6)}`).current;
    const t = resolveTheme(theme, "light");
    const fmt = formatValue || fmtMoneyDefault;
    const [period, setPeriod] = useState("monthly");
    const [series, setSeries] = useState({ before: true, after: true });

    const bucketed = useMemo(() => {
      if (period === "quarterly") return toQuarterly(labels, before, after);
      return { labels, before, after };
    }, [period, labels, before, after]);

    const { labels: curLabels, before: curBefore, after: curAfter } = bucketed;
    const beforeOn = singleSeries ? false : series.before;
    const afterOn = series.after;

    // Null-out 0-valued months so Recharts breaks the line instead of spiking to 0
    const chartData = useMemo(() => curLabels.map((label, i) => {
      const bv = curBefore.values?.[i];
      const av = curAfter.values?.[i];
      return {
        label,
        [curBefore.label]: (bv != null && bv !== 0) ? bv : null,
        [curAfter.label]: (av != null && av !== 0) ? av : null,
      };
    }), [curLabels, curBefore, curAfter]);

    // Index of the most recent month that actually has data. chartData nulls
    // out missing/zero months, so this is the last non-null — i.e. the point a
    // reader cares about most ("where are we now"), which gets a marker while
    // every other point stays dotless to keep the line clean.
    const lastIdx = useMemo(() => {
      for (let i = chartData.length - 1; i >= 0; i--) {
        if (chartData[i][curAfter.label] != null) return i;
      }
      return -1;
    }, [chartData, curAfter.label]);

    const toggleSeries = (key) => setSeries((s) => ({ ...s, [key]: !s[key] }));

    // single compact "more" pill instead of separate Monthly + Filter pills — expands
    // into one popover with period switch + series toggles, keeps the header small
    const periodControl = controls || [
      {
        type: "more",
        multiSelect: true,
        menu: [
          { label: "Monthly", value: "monthly", active: period === "monthly", onClick: () => setPeriod("monthly") },
          { label: "Quarterly", value: "quarterly", active: period === "quarterly", onClick: () => setPeriod("quarterly") },
          ...(singleSeries ? [] : [{ label: curBefore.label, color: curBefore.color, active: beforeOn, onClick: () => toggleSeries("before") }]),
          { label: curAfter.label, color: curAfter.color, active: afterOn, onClick: () => toggleSeries("after") },
        ],
      },
    ];

    const legendItems = [
      ...(singleSeries ? [] : [{ key: "before", label: curBefore.label, color: curBefore.color, active: beforeOn }]),
      { key: "after", label: curAfter.label, color: curAfter.color, active: afterOn },
    ];

    // summary stats for the expanded/detailed view — total, average, highest, lowest per series
    const calcStats = (values) => {
      const nums = (values || []).filter((v) => v != null && !isNaN(v));
      if (!nums.length) return { total: 0, avg: 0, high: 0, low: 0 };
      const total = nums.reduce((s, v) => s + v, 0);
      return { total, avg: total / nums.length, high: Math.max(...nums), low: Math.min(...nums) };
    };

    const renderStats = () => {
      const groups = [
        ...(singleSeries ? [] : [{ label: curBefore.label, color: curBefore.color, stats: calcStats(curBefore.values) }]),
        { label: curAfter.label, color: curAfter.color, stats: calcStats(curAfter.values) },
      ];
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 20 }}>
          {groups.map((g) => (
            <div
              key={g.label}
              style={{
                position: "relative", overflow: "hidden", borderRadius: 0,
                border: `1px solid ${g.color}28`, padding: "18px 16px 16px",
                background: `linear-gradient(160deg, ${g.color}14, transparent 65%)`,
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: g.color }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span
                  style={{
                    width: 24, height: 24, borderRadius: "50%", background: g.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: t.text.primary }}>{g.label}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <Stat theme={t} label="Total" value={fmt(g.stats.total)} />
                <Stat theme={t} label="Average" value={fmt(g.stats.avg)} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: g.color }}>{fmt(g.stats.high)}</div>
                  <div style={{ fontSize: 12, color: t.text.muted }}>Highest</div>
                </div>
                <Stat theme={t} label="Lowest" value={fmt(g.stats.low)} />
              </div>
            </div>
          ))}
        </div>
      );
    };

    const renderTable = () => (
      <div
        style={{
          marginTop: 20, borderRadius: 0, border: `1px solid ${t.control.border}`,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: t.text.secondary, background: t.mode === "light" ? "#f1f5f9" : "rgba(255,255,255,0.05)" }}>
                <th style={{ padding: "10px 14px", fontWeight: 700 }}>{period === "quarterly" ? "Quarter" : "Month"}</th>
                {!singleSeries && (
                  <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 0, background: curBefore.color }} />{curBefore.label}
                    </span>
                  </th>
                )}
                <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 0, background: curAfter.color }} />{curAfter.label}
                  </span>
                </th>
                {!singleSeries && <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Δ</th>}
              </tr>
            </thead>
            <tbody>
              {curLabels.map((lb, i) => {
                const rawB = curBefore.values?.[i];
                const rawA = curAfter.values?.[i];
                const bReported = rawB !== null && rawB !== undefined && Number(rawB) !== 0;
                const aReported = rawA !== null && rawA !== undefined && Number(rawA) !== 0;
                const b = Number(rawB || 0);
                const a = Number(rawA || 0);
                const delta = a - b;
                const deltaColor = delta >= 0 ? "#10B981" : "#f43f5e";
                return (
                  <tr
                    key={lb}
                    style={{
                      borderTop: i === 0 ? "none" : `1px solid ${t.control.border}`,
                      background: i % 2 === 0 ? "transparent" : (t.mode === "light" ? "#f8fafc" : "rgba(255,255,255,0.02)"),
                      color: t.text.primary,
                    }}
                  >
                    <td style={{ padding: "9px 14px", color: t.text.secondary, fontWeight: 600 }}>{lb}</td>
                    {!singleSeries && <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>{bReported ? fmt(b) : "—"}</td>}
                    <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>{aReported ? fmt(a) : "—"}</td>
                    {!singleSeries && (
                      <td style={{ padding: "9px 14px", textAlign: "right" }}>
                        {bReported && aReported ? (
                          <span style={{ padding: "2px 9px", borderRadius: 0, fontWeight: 700, fontSize: 12, background: `${deltaColor}1a`, color: deltaColor }}>
                            {delta >= 0 ? "+" : ""}{fmt(delta)}
                          </span>
                        ) : (
                          <span style={{ color: t.text.secondary }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );

    const renderChart = (detailed) => {
      const fillMode = size === "fill" && !detailed;
      const chartH = detailed ? 260 : (fillMode ? undefined : (SIZES[size] ?? SIZES.m));
      return (
        <div style={{ position: "relative", ...(fillMode ? { display: "flex", flexDirection: "column", height: "100%" } : {}) }}>
          {/* compact legend badge in the top-right corner — frees the space a bottom legend row used to take.
              Inset (not flush 0,0) so it never reads as clipped by the card's rounded corner. */}
          <div
            style={{
              position: "absolute", top: 6, right: 6, zIndex: 5,
              maxWidth: "calc(100% - 12px)", overflow: "hidden",
              display: "flex", alignItems: "center", gap: 10,
              padding: "3px 9px", borderRadius: 999,
              background: "rgba(255,255,255,0.85)", backdropFilter: "blur(6px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            {legendItems.map((it) => (
              <span
                key={it.key}
                onClick={() => toggleSeries(it.key)}
                style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", opacity: it.active === false ? 0.4 : 1 }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: it.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: t.text.secondary }}>{it.label}</span>
              </span>
            ))}
          </div>
          <div style={{ ...(fillMode ? { flex: 1, minHeight: 0 } : { height: chartH }), width: "100%", marginLeft: -6, marginRight: -1, marginBottom: -10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={curAfter.color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={curAfter.color} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 5" stroke={t.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: t.text.muted, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={fmt}
                  tick={{ fontSize: 11, fill: t.text.muted }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    // The current-year series is drawn as an invisible-stroke
                    // Area (for the gradient fill) PLUS a separate visible
                    // Line on top (for the crisp stroke) — both share the
                    // same dataKey, so Recharts' default tooltip lists that
                    // series twice. Dedupe by dataKey, preferring whichever
                    // entry actually has a real stroke color.
                    const byKey = new Map();
                    payload.forEach((p) => {
                      const existing = byKey.get(p.dataKey);
                      if (!existing || (existing.stroke === "none" && p.stroke !== "none")) {
                        byKey.set(p.dataKey, p);
                      }
                    });
                    return (
                      <div style={{ borderRadius: 12, border: `1px solid ${t.border}`, background: t.surface, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,.08)", padding: "8px 12px" }}>
                        <div style={{ color: t.text.primary, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                        {[...byKey.values()].map((p) => (
                          <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.stroke !== "none" ? p.stroke : p.color, flexShrink: 0 }} />
                            <span style={{ color: t.text.secondary }}>{p.dataKey}:</span>
                            <span style={{ fontWeight: 600, color: t.text.primary }}>{p.value != null ? fmt(p.value) : "—"}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {afterOn && (
                  <Area
                    type="monotone"
                    dataKey={curAfter.label}
                    fill={`url(#${uid})`}
                    stroke="none"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
                {beforeOn && (
                  <Line
                    type="monotone"
                    dataKey={curBefore.label}
                    stroke={curBefore.color}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                    strokeDasharray="5 4"
                    isAnimationActive={false}
                  />
                )}
                {afterOn && (
                  <Line
                    type="monotone"
                    dataKey={curAfter.label}
                    stroke={curAfter.color}
                    strokeWidth={3}
                    dot={(d) =>
                      d.index === lastIdx && d.cx != null && d.cy != null ? (
                        <g key={`cur-${d.index}`} pointerEvents="none">
                          <circle cx={d.cx} cy={d.cy} r={8} fill={curAfter.color} fillOpacity={0.18} />
                          <circle cx={d.cx} cy={d.cy} r={4.5} fill={curAfter.color} stroke="#fff" strokeWidth={2} />
                        </g>
                      ) : null
                    }
                    activeDot={{ r: 5, fill: curAfter.color, stroke: "#fff", strokeWidth: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {detailed && renderStats()}
          {detailed && renderTable()}
        </div>
      );
    };

    return (
      <ChartCard
        theme={t}
        title={title}
        icon={icon}
        iconColor={iconColor}
        subtitle={subtitle}
        controls={periodControl}
        onControl={onControl}
        width={width}
        size={size}
        className={className}
        headline={{ value: fmt(total), change: changePct }}
        expandable={expandable}
        floatingHeader
      >
        {({ detailed }) => renderChart(detailed)}
      </ChartCard>
    );
  }
);

DualLineChart.displayName = "DualLineChart";
export default DualLineChart;
