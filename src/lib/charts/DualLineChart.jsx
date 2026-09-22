import React, { useMemo, memo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { resolveTheme, AXIS_CATEGORY_TICK, AXIS_VALUE_TICK, AXIS_LINE_PROPS, AXIS_GRID_PROPS } from "./theme";
import { ChartCard, Stat, SIZES } from "./chrome";
import { compactCurrency } from "./format";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const fmtMoneyDefault = (v) => compactCurrency(v);

const DEFAULTS = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  before: { label: "Before", color: "#94a3b8", values: [320, 300, 250, 360, 300, 380] },
  after: { label: "After", color: "#e0653a", values: [410, 380, 360, 420, 470, 560] },
};

// Buckets N series at once (was hardcoded to exactly before/after).
const toQuarterly = (labels, seriesList) => {
  const qLabels = [];
  const sums = seriesList.map(() => []);
  for (let i = 0; i < labels.length; i += 3) {
    qLabels.push(`Q${qLabels.length + 1}`);
    seriesList.forEach((s, si) => {
      let sum = 0;
      for (let j = i; j < Math.min(i + 3, labels.length); j++) {
        sum += Number(s.values?.[j] || 0);
      }
      sums[si].push(sum);
    });
  }
  return {
    labels: qLabels,
    seriesList: seriesList.map((s, si) => ({ ...s, values: sums[si] })),
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
    // Compare-mode entry point: an array of { key, label, color, values },
    // one per metric — same "N distinct series, all visible/toggleable at
    // once" contract VerticalBarView's compare mode and LineChartView's
    // compareMode already have. When provided, this REPLACES before/after
    // entirely (they're ignored). The last entry gets the gradient-area fill
    // and a solid line (the "primary" series, matching `after`'s old role);
    // every other entry renders as a dashed line only (matching `before`'s
    // old role) unless it sets its own `dashed: false`.
    multiSeries = null,
    cursorIndex = 3,
    formatValue,
    width = 520,
    size = "l",
    expandable = false,
    className = "",
    // Renders only the primary series — same component, chrome and
    // interactions as the multi-series version, so single-metric trends stay
    // visually consistent with the comparisons sitting next to them. Ignored
    // when multiSeries has more than one entry (compare mode is inherently
    // multi-series).
    singleSeries = false,
    // Both default to today's behaviour so existing usages are unaffected.
    // `showHeader={false}` is for hosts that already render their own title
    // (the ranked widget), where the card's title + headline duplicate it.
    showHeader = true,
    showBorder = true,
    // Portal target for the legend (e.g. the ranked widget's own footer,
    // centered) — when given, the legend renders there instead of floating
    // in the card's own header cluster, freeing that space for the total.
    legendPortal = null,
  }) => {
    const uid = useRef(`dl-${Math.random().toString(36).slice(2, 6)}`).current;
    const t = resolveTheme(theme, "light");
    const fmt = formatValue || fmtMoneyDefault;
    const [period, setPeriod] = useState("monthly");

    // Normalize every call site (legacy before/after, or new multiSeries)
    // into one shape everything below operates on. This is the ONLY place
    // that knows which prop shape the caller used.
    const baseSeriesList = useMemo(() => {
      if (multiSeries && multiSeries.length > 0) {
        return multiSeries.map((s, i) => ({
          key: s.key ?? s.label ?? `series-${i}`,
          label: s.label,
          color: s.color,
          values: s.values,
          dashed: s.dashed ?? i < multiSeries.length - 1,
          area: i === multiSeries.length - 1,
        }));
      }
      if (singleSeries) {
        return [{ key: "after", label: after.label, color: after.color, values: after.values, dashed: false, area: true }];
      }
      return [
        { key: "before", label: before.label, color: before.color, values: before.values, dashed: true, area: false },
        { key: "after", label: after.label, color: after.color, values: after.values, dashed: false, area: true },
      ];
    }, [multiSeries, before, after, singleSeries]);

    const isMulti = baseSeriesList.length > 2 || (multiSeries && multiSeries.length > 0);

    const [hiddenKeys, setHiddenKeys] = useState(() => new Set());
    const toggleSeries = (key) =>
      setHiddenKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });

    const bucketed = useMemo(() => {
      if (period === "quarterly") {
        const q = toQuarterly(labels, baseSeriesList);
        return { labels: q.labels, seriesList: q.seriesList };
      }
      return { labels, seriesList: baseSeriesList };
    }, [period, labels, baseSeriesList]);

    const { labels: curLabels, seriesList } = bucketed;
    // At least one series must always stay visible — an all-hidden chart has
    // nothing left to plot and no way back via the (now-empty) legend.
    const visibleSeriesList = seriesList.filter((s) => !hiddenKeys.has(s.key));
    const isKeyOn = (key) => (visibleSeriesList.length > 0 ? !hiddenKeys.has(key) : true);

    // Primary series (the one with the area fill) drives the headline total,
    // the "last real point" marker, and — in the 2-series legacy shape —
    // used to be called `curAfter`.
    const primary = seriesList[seriesList.length - 1];
    const secondaries = seriesList.slice(0, -1);

    // Null-out 0-valued months so Recharts breaks the line instead of spiking to 0
    const chartData = useMemo(() => curLabels.map((label, i) => {
      const row = { label };
      seriesList.forEach((s) => {
        const v = s.values?.[i];
        row[s.label] = (v != null && v !== 0) ? v : null;
      });
      return row;
    }), [curLabels, seriesList]);

    /**
     * Y domain. Anchoring at 0 is right when the values run down to it, but for
     * a band that sits high and narrow — load factor bouncing 49–89% — it
     * spends half the plot on empty space and flattens the shape into a
     * straight-ish line. When the data occupies less than ~55% of a
     * zero-anchored axis, the axis zooms to a padded window around the data
     * instead. Percentages additionally clamp to 0–100.
     */
    const yDomain = useMemo(() => {
      const vals = chartData
        .flatMap((d) => seriesList.map((s) => d[s.label]))
        .filter((v) => typeof v === "number" && Number.isFinite(v));
      if (!vals.length) return [0, "auto"];

      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      if (hi <= 0 || lo < 0) return ["auto", "auto"];

      const spread = hi - lo;
      // Data already reaches most of the way to zero — keep the zero baseline.
      if (spread === 0 || lo / hi < 0.45) return [0, "auto"];

      const pad = Math.max(spread * 0.25, hi * 0.02);
      return [Math.max(0, lo - pad), hi + pad];
    }, [chartData, seriesList]);

    // Index of the most recent month that actually has data for the primary
    // series. chartData nulls out missing/zero months, so this is the last
    // non-null — i.e. the point a reader cares about most ("where are we
    // now"), which gets a marker while every other point stays dotless.
    const lastIdx = useMemo(() => {
      for (let i = chartData.length - 1; i >= 0; i--) {
        if (chartData[i][primary.label] != null) return i;
      }
      return -1;
    }, [chartData, primary.label]);

    // single compact "more" pill instead of separate Monthly + Filter pills — expands
    // into one popover with period switch + series toggles, keeps the header small
    const periodControl = controls || [
      {
        type: "more",
        multiSelect: true,
        menu: [
          { label: "Monthly", value: "monthly", active: period === "monthly", onClick: () => setPeriod("monthly") },
          { label: "Quarterly", value: "quarterly", active: period === "quarterly", onClick: () => setPeriod("quarterly") },
          ...seriesList.map((s) => ({
            label: s.label, color: s.color, active: isKeyOn(s.key), onClick: () => toggleSeries(s.key),
          })),
        ],
      },
    ];

    const legendItems = seriesList.map((s) => ({ key: s.key, label: s.label, color: s.color, active: isKeyOn(s.key) }));

    // Rendered into ChartCard's own floating header cluster (via headline.legend
    // below) instead of floating inside the chart body — a legend box sitting over
    // the plot was eating vertical space the chart itself needed.
    const legendNode = (
      <div style={{ display: "flex", flexWrap: isMulti ? "wrap" : "nowrap", alignItems: "center", gap: 10 }}>
        {legendItems.map((it) => (
          <span
            key={it.key}
            onClick={() => toggleSeries(it.key)}
            style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", opacity: it.active === false ? 0.4 : 1 }}
          >
            <span
              style={{
                width: 8, height: 8, borderRadius: 0,
                background: it.active === false ? "transparent" : it.color,
                border: `1px solid ${it.color}`,
              }}
            />
            <span
              style={{
                fontSize: 11, fontWeight: 700, color: t.text.secondary,
                textDecoration: it.active === false ? "line-through" : "none",
              }}
            >
              {it.label}
            </span>
          </span>
        ))}
      </div>
    );

    // summary stats for the expanded/detailed view — total, average, highest, lowest per series
    const calcStats = (values) => {
      const nums = (values || []).filter((v) => v != null && !isNaN(v));
      if (!nums.length) return { total: 0, avg: 0, high: 0, low: 0 };
      const total = nums.reduce((s, v) => s + v, 0);
      return { total, avg: total / nums.length, high: Math.max(...nums), low: Math.min(...nums) };
    };

    const renderStats = () => {
      const groups = seriesList.map((s) => ({ label: s.label, color: s.color, stats: calcStats(s.values) }));
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

    // Delta column only makes sense for exactly two series (a before/after
    // comparison) — with 3+ metrics "a - b" is arbitrary about which two, so
    // it drops rather than picking an arbitrary pair.
    const showDelta = seriesList.length === 2;

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
                {seriesList.map((s) => (
                  <th key={s.key} style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 0, background: s.color }} />{s.label}
                    </span>
                  </th>
                ))}
                {showDelta && <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Δ</th>}
              </tr>
            </thead>
            <tbody>
              {curLabels.map((lb, i) => {
                const rawValues = seriesList.map((s) => s.values?.[i]);
                const reported = rawValues.map((rv) => rv !== null && rv !== undefined && Number(rv) !== 0);
                const nums = rawValues.map((rv) => Number(rv || 0));
                const delta = showDelta ? nums[1] - nums[0] : 0;
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
                    {seriesList.map((s, si) => (
                      <td key={s.key} style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>
                        {reported[si] ? fmt(nums[si]) : "—"}
                      </td>
                    ))}
                    {showDelta && (
                      <td style={{ padding: "9px 14px", textAlign: "right" }}>
                        {reported[0] && reported[1] ? (
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
          <div style={{ ...(fillMode ? { flex: 1, minHeight: 0 } : { height: chartH }), width: "100%", marginLeft: -6, marginRight: -1, marginBottom: -10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={primary.color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={primary.color} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {/* Tick fill comes from the resolved theme, not the shared
                    AXIS_*_TICK constants' own `fill` — those read a global
                    light/dark CSS var, which stays dark-text-on-light
                    regardless of what THIS card's background is, going
                    illegible on a solid gradient card. */}
                <CartesianGrid {...AXIS_GRID_PROPS} stroke={t.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ ...AXIS_CATEGORY_TICK, fill: t.text.secondary }}
                  {...AXIS_LINE_PROPS}
                />
                <YAxis
                  tickFormatter={fmt}
                  tick={{ ...AXIS_VALUE_TICK, fill: t.text.muted }}
                  {...AXIS_LINE_PROPS}
                  width={44}
                  domain={yDomain}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    // The primary series is drawn as an invisible-stroke Area
                    // (for the gradient fill) PLUS a separate visible Line on
                    // top (for the crisp stroke) — both share the same
                    // dataKey, so Recharts' default tooltip lists that series
                    // twice. Dedupe by dataKey, preferring whichever entry
                    // actually has a real stroke color.
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
                {isKeyOn(primary.key) && (
                  <Area
                    type="monotone"
                    dataKey={primary.label}
                    fill={`url(#${uid})`}
                    stroke="none"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
                {secondaries.map((s) => isKeyOn(s.key) && (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.label}
                    stroke={s.color}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                    strokeDasharray={s.dashed ? "5 4" : undefined}
                    isAnimationActive={false}
                  />
                ))}
                {isKeyOn(primary.key) && (
                  <Line
                    type="monotone"
                    dataKey={primary.label}
                    stroke={primary.color}
                    strokeWidth={3}
                    dot={(d) =>
                      d.index === lastIdx && d.cx != null && d.cy != null ? (
                        <g key={`cur-${d.index}`} pointerEvents="none">
                          <circle cx={d.cx} cy={d.cy} r={8} fill={primary.color} fillOpacity={0.18} />
                          <circle cx={d.cx} cy={d.cy} r={4.5} fill={primary.color} stroke="#fff" strokeWidth={2} />
                        </g>
                      ) : null
                    }
                    activeDot={{ r: 5, fill: primary.color, stroke: "#fff", strokeWidth: 2 }}
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
      <>
      <ChartCard
        theme={t}
        title={showHeader ? title : null}
        icon={showHeader ? icon : null}
        iconColor={iconColor}
        subtitle={showHeader ? subtitle : null}
        controls={periodControl}
        onControl={onControl}
        width={width}
        size={size}
        className={`${showBorder ? "" : "!border-0 !shadow-none"} ${className}`}
        // Headline is deliberately NOT gated by showHeader: hosts hide the
        // duplicated title but still want the big total top-right. Legend
        // drops out of the headline entirely when portaled elsewhere — it's
        // rendered via the portal below instead, not in both places.
        headline={{ value: fmt(total), change: changePct, legend: legendPortal ? null : legendNode }}
        expandable={expandable}
        floatingHeader
      >
        {({ detailed }) => renderChart(detailed)}
      </ChartCard>
      {legendPortal && createPortal(legendNode, legendPortal)}
      </>
    );
  }
);

DualLineChart.displayName = "DualLineChart";
export default DualLineChart;
