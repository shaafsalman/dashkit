/* Pure ECharts option builders for the Executive Overview bento mosaic.
   Every function here returns a plain option object — no React, no side effects. */

import { bento, baseOption, categoryAxis, valueAxis, areaGradient, withAlpha, FONT, MONO_FONT } from "./theme";

const T = bento;

/* ── shared formatters ─────────────────────────────────────────────────── */
export const fmtMoney = (n) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B`
    : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
      : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K`
        : `$${Math.round(n || 0).toLocaleString()}`;

export const fmtNum = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
    : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
      : Math.round(n || 0).toLocaleString();

const tooltipRow = (marker, name, value) =>
  `<div style="display:flex;align-items:center;gap:6px;font-family:${FONT};font-size:11px">
     ${marker}<span style="color:${T.text.secondary}">${name}</span>
     <span style="margin-left:auto;font-family:${MONO_FONT};color:${T.text.primary};font-variant-numeric:tabular-nums">${value}</span>
   </div>`;

/* ── 1. Revenue hero area line ─────────────────────────────────────────── */
export function buildRevenueHero({ labels = [], current = [], previous = [], currentLabel = "", previousLabel = "" }) {
  const base = baseOption(T);
  const series = [];

  if (previous.some((v) => v)) {
    series.push({
      name: previousLabel, type: "line", smooth: true, symbol: "none",
      lineStyle: { color: withAlpha(T.text.muted, 0.75), width: 1.5, type: "dashed" },
      data: previous,
      z: 1,
    });
  }
  series.push({
    name: currentLabel, type: "line", smooth: true, symbolSize: 5,
    showSymbol: false,
    itemStyle: { color: T.accent, borderColor: T.surfaceHero, borderWidth: 2 },
    lineStyle: { color: T.accent, width: 2.5, shadowColor: withAlpha(T.accent, 0.55), shadowBlur: 14, shadowOffsetY: 4 },
    areaStyle: { color: areaGradient(T.accent, 0.35) },
    emphasis: { focus: "series" },
    data: current,
    z: 3,
  });

  return {
    baseOption: {
      ...base,
      grid: { left: 44, right: 22, top: 34, bottom: 30, containLabel: true },
      tooltip: {
        ...base.tooltip,
        formatter: (ps) =>
          `<div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.08em;color:${T.text.muted};margin-bottom:4px">${ps[0]?.axisValue ?? ""}</div>` +
          ps.map((p) => tooltipRow(p.marker, p.seriesName, fmtMoney(p.value || 0))).join(""),
      },
      xAxis: categoryAxis(T, { data: labels }),
      yAxis: valueAxis(T, { axisLabel: { color: T.text.muted, fontSize: 10, fontFamily: MONO_FONT, formatter: (v) => fmtMoney(v) } }),
      series,
    },
    media: [
      {
        query: { maxWidth: 460 },
        option: {
          grid: { left: 8, right: 10, top: 22, bottom: 22, containLabel: true },
          xAxis: { axisLabel: { interval: 1, fontSize: 9 } },
          yAxis: { axisLabel: { fontSize: 9 } },
        },
      },
    ],
  };
}

/* ── 1b. Generic single-series area/line ───────────────────────────────── */
/** For any single time series that isn't the revenue-hero's prior-year
 *  comparison shape — Message Volume, Daily Spend, etc. ECharts' own grid
 *  (containLabel:true) and axis sizing replace hand-rolled viewBox/margin
 *  math entirely, so this never letterboxes or needs a manual height cap. */
export function buildAreaTrend({ labels = [], values = [], name = "", color = T.accent, formatValue = fmtNum }) {
  const base = baseOption(T);
  const lastIdx = labels.length - 1;
  const lastVal = values[values.length - 1];
  return {
    ...base,
    // With containLabel:true, ECharts expands the grid OUTWARD to fit axis
    // labels beyond whatever these numbers are — they aren't a label
    // budget, they're extra margin on top of it. 44/28 here on top of
    // auto-fit label space produced the huge dead gutter; small values let
    // containLabel do the actual (correct, minimal) sizing on its own.
    grid: { left: 6, right: 12, top: 20, bottom: 6, containLabel: true },
    tooltip: {
      ...base.tooltip,
      axisPointer: {
        type: "line",
        lineStyle: { color: withAlpha(color, 0.35), width: 1.5 },
      },
      formatter: (ps) => {
        const p = Array.isArray(ps) ? ps[0] : ps;
        return `<div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.08em;color:${T.text.muted};margin-bottom:4px">${p?.axisValue ?? ""}</div>` +
          tooltipRow(p?.marker ?? "", name, formatValue(p?.value || 0));
      },
    },
    // Minimal, not bare: real axis lines stay (the earlier fix for
    // invisible axes), but the vertical grid, tick marks, and every drop
    // shadow are gone — those were the actual clutter, not the data itself.
    xAxis: categoryAxis(T, {
      data: labels,
      axisLine: { show: true, lineStyle: { color: withAlpha(T.text.secondary, 0.4) } },
      axisTick: { show: false },
      axisLabel: { color: T.text.secondary, fontSize: 11, fontFamily: MONO_FONT, fontWeight: 500 },
      splitLine: { show: false },
    }),
    yAxis: valueAxis(T, {
      splitNumber: 4,
      axisLine: { show: true, lineStyle: { color: withAlpha(T.text.secondary, 0.4) } },
      axisLabel: { color: T.text.secondary, fontSize: 11, fontFamily: MONO_FONT, fontWeight: 500, formatter: (v) => formatValue(v) },
      splitLine: { lineStyle: { color: withAlpha(T.text.muted, 0.12), type: "dashed" } },
    }),
    series: [{
      name, type: "line", smooth: true, symbolSize: 7, showSymbol: false,
      itemStyle: { color, borderColor: "#fff", borderWidth: 2 },
      lineStyle: { color, width: 2.25 },
      // Clean 2-stop fade, no shadow — the earlier 3-stop-plus-shadow
      // version was what read as a "smudge" under the line.
      areaStyle: {
        color: {
          type: "linear", x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: withAlpha(color, 0.24) },
            { offset: 1, color: withAlpha(color, 0.02) },
          ],
        },
      },
      emphasis: { focus: "series", itemStyle: { borderWidth: 3 } },
      // Current-value marker — one crisp dot, no halo ring.
      markPoint: values.length
        ? {
            silent: true, symbol: "circle", symbolSize: 8, label: { show: false },
            itemStyle: { color, borderColor: "#fff", borderWidth: 2 },
            data: [{ coord: [lastIdx, lastVal] }],
          }
        : undefined,
      data: values,
    }],
  };
}

/* ── 1c. Generic categorical bar ───────────────────────────────────────── */
export function buildBarTrend({ labels = [], values = [], name = "", color = T.accent, formatValue = fmtNum }) {
  const base = baseOption(T);
  return {
    ...base,
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    tooltip: {
      ...base.tooltip,
      axisPointer: { type: "shadow", shadowStyle: { color: withAlpha(color, 0.06) } },
      formatter: (ps) => {
        const p = Array.isArray(ps) ? ps[0] : ps;
        return `<div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.08em;color:${T.text.muted};margin-bottom:4px">${p?.axisValue ?? ""}</div>` +
          tooltipRow(p?.marker ?? "", name, formatValue(p?.value || 0));
      },
    },
    xAxis: categoryAxis(T, {
      data: labels, boundaryGap: true,
      axisLine: { show: true, lineStyle: { color: withAlpha(T.text.secondary, 0.4) } },
      axisTick: { show: false },
      axisLabel: { color: T.text.secondary, fontSize: 11, fontFamily: MONO_FONT, fontWeight: 500 },
    }),
    yAxis: valueAxis(T, {
      splitNumber: 4,
      axisLine: { show: true, lineStyle: { color: withAlpha(T.text.secondary, 0.4) } },
      axisLabel: { color: T.text.secondary, fontSize: 11, fontFamily: MONO_FONT, fontWeight: 500, formatter: (v) => formatValue(v) },
      splitLine: { lineStyle: { color: withAlpha(T.text.muted, 0.12), type: "dashed" } },
    }),
    series: [{
      name, type: "bar", barMaxWidth: 34, barCategoryGap: "42%",
      // Single flat colour, no per-bar gradient or "peak" callout — every
      // bar reads the same, the values speak for themselves via the labels.
      itemStyle: { color, borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { opacity: 0.85 } },
      label: {
        show: true, position: "top", distance: 6,
        formatter: (p) => formatValue(p.value),
        color: T.text.secondary, fontSize: 11.5, fontFamily: MONO_FONT, fontWeight: 600,
      },
      data: values,
    }],
  };
}

/* ── 1d. Grouped categorical bar (two series side-by-side per category) ── */
export function buildGroupedBarTrend({ labels = [], series = [], formatValue = fmtNum }) {
  const base = baseOption(T);
  return {
    ...base,
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      ...base.tooltip,
      axisPointer: { type: "shadow", shadowStyle: { color: withAlpha(T.text.muted, 0.06) } },
      formatter: (ps) =>
        `<div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.08em;color:${T.text.muted};margin-bottom:4px">${ps[0]?.axisValue ?? ""}</div>` +
        ps.map((p) => tooltipRow(p.marker, p.seriesName, formatValue(p.value || 0))).join(""),
    },
    xAxis: categoryAxis(T, {
      data: labels, boundaryGap: true,
      axisLine: { show: true, lineStyle: { color: withAlpha(T.text.secondary, 0.4) } },
      axisTick: { show: false },
      axisLabel: { color: T.text.secondary, fontSize: 11, fontFamily: MONO_FONT, fontWeight: 500 },
    }),
    yAxis: valueAxis(T, {
      splitNumber: 4,
      axisLine: { show: true, lineStyle: { color: withAlpha(T.text.secondary, 0.4) } },
      axisLabel: { color: T.text.secondary, fontSize: 11, fontFamily: MONO_FONT, fontWeight: 500, formatter: (v) => formatValue(v) },
      splitLine: { lineStyle: { color: withAlpha(T.text.muted, 0.12), type: "dashed" } },
    }),
    series: series.map((s) => ({
      name: s.label, type: "bar", barMaxWidth: 22, barGap: "10%", barCategoryGap: "34%",
      itemStyle: { color: s.color, borderRadius: [3, 3, 0, 0] },
      emphasis: { itemStyle: { opacity: 0.85 } },
      data: s.data,
    })),
  };
}

/* ── 2. Passenger trend line ───────────────────────────────────────────── */
export function buildPassengerTrend({ labels = [], current = [], previous = [], currentLabel = "", previousLabel = "" }) {
  const base = baseOption(T);
  const accent = T.series[1]; // teal
  const series = [];
  if (previous.some((v) => v)) {
    series.push({
      name: previousLabel, type: "line", smooth: true, symbol: "none",
      lineStyle: { color: withAlpha(T.text.muted, 0.7), width: 1.4, type: "dashed" },
      data: previous,
    });
  }
  series.push({
    name: currentLabel, type: "line", smooth: true, showSymbol: false, symbolSize: 5,
    itemStyle: { color: accent },
    lineStyle: { color: accent, width: 2.2 },
    areaStyle: { color: areaGradient(accent, 0.22) },
    data: current,
  });

  return {
    baseOption: {
      ...base,
      grid: { left: 38, right: 18, top: 26, bottom: 28, containLabel: true },
      tooltip: {
        ...base.tooltip,
        formatter: (ps) =>
          `<div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.08em;color:${T.text.muted};margin-bottom:4px">${ps[0]?.axisValue ?? ""}</div>` +
          ps.map((p) => tooltipRow(p.marker, p.seriesName, fmtNum(p.value || 0))).join(""),
      },
      xAxis: categoryAxis(T, { data: labels }),
      yAxis: valueAxis(T, { name: "Passengers", axisLabel: { color: T.text.muted, fontSize: 10, fontFamily: MONO_FONT, formatter: (v) => fmtNum(v) } }),
      series,
    },
    media: [
      {
        query: { maxWidth: 460 },
        option: {
          grid: { left: 6, right: 8, top: 20, bottom: 18, containLabel: true },
          xAxis: { axisLabel: { interval: 2, fontSize: 9 } },
          yAxis: [{ name: "", axisLabel: { fontSize: 9 } }],
        },
      },
    ],
  };
}

/* ── 3. Top routes horizontal bar ranking ──────────────────────────────── */
export function buildTopRoutes({ items = [], format = fmtMoney }) {
  const base = baseOption(T);
  const top = [...items].filter((d) => (d.value || 0) > 0).sort((a, b) => b.value - a.value).slice(0, 6).reverse();

  return {
    baseOption: {
      ...base,
      grid: { left: 8, right: 58, top: 10, bottom: 8, containLabel: true },
      tooltip: {
        ...base.tooltip,
        trigger: "item",
        formatter: (p) => tooltipRow(p.marker, p.name, format(p.value || 0)),
      },
      xAxis: { type: "value", show: false, max: "dataMax" },
      yAxis: {
        type: "category",
        data: top.map((d) => d.label ?? d.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: T.text.secondary, fontSize: 10.5, fontFamily: FONT },
      },
      series: [{
        type: "bar",
        barWidth: 11,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [
            { offset: 0, color: withAlpha(T.accent, 0.35) },
            { offset: 1, color: T.accent },
          ] },
        },
        label: {
          show: true, position: "right", distance: 8,
          color: T.text.primary, fontFamily: MONO_FONT, fontSize: 10,
          formatter: (p) => format(p.value || 0),
        },
        data: top.map((d) => d.value || 0),
      }],
    },
    media: [
      { query: { maxWidth: 460 }, option: { grid: { left: 4, right: 48, top: 6, bottom: 4, containLabel: true }, yAxis: { axisLabel: { fontSize: 9 } } } },
    ],
  };
}

/* ── 4. Passengers by aircraft type donut ──────────────────────────────── */
export function buildAircraftDonut({ items = [], centreLabel = "Passengers" }) {
  const base = baseOption(T);
  const data = [...items].filter((d) => (d.value || 0) > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const palette = [T.accent, T.series[1], T.series[2], T.series[3], "#60a5fa"];

  return {
    ...base,
    grid: undefined,
    tooltip: { ...base.tooltip, trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { show: false },
    graphic: [
      { type: "text", left: "center", top: "42%", style: { text: fmtNum(total), fill: T.text.primary, font: `600 20px ${MONO_FONT}`, textAlign: "center" } },
      { type: "text", left: "center", top: "56%", style: { text: centreLabel, fill: T.text.muted, font: `500 9px ${MONO_FONT}`, textAlign: "center" } },
    ],
    series: [{
      type: "pie",
      radius: ["62%", "88%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: T.surface, borderWidth: 3, borderRadius: 4 },
      emphasis: { scaleSize: 6 },
      data: data.map((d, i) => ({
        name: d.label ?? d.name,
        value: d.value || 0,
        itemStyle: { color: palette[i % palette.length] },
      })),
    }],
  };
}

/** HTML legend items to render outside the canvas, matching buildAircraftDonut. */
export function aircraftLegendItems(items = []) {
  const data = [...items].filter((d) => (d.value || 0) > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;
  const palette = [T.accent, T.series[1], T.series[2], T.series[3], "#60a5fa"];
  return data.map((d, i) => ({
    name: d.label ?? d.name,
    value: d.value || 0,
    share: ((d.value || 0) / total) * 100,
    color: palette[i % palette.length],
  }));
}

/* ── 5. Load factor gauge / radial progress ring ───────────────────────── */
export function buildLoadFactorGauge({ value = 0, label = "Load Factor", target = null }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return {
    ...baseOption(T),
    grid: undefined,
    tooltip: { show: false },
    series: [{
      type: "gauge",
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max: 100,
      radius: "96%",
      center: ["50%", "56%"],
      progress: { show: true, width: 10, roundCap: true, itemStyle: { color: T.accent, shadowColor: withAlpha(T.accent, 0.6), shadowBlur: 12 } },
      axisLine: { roundCap: true, lineStyle: { width: 10, color: [[1, T.grid]] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      title: { show: true, offsetCenter: [0, "34%"], color: T.text.muted, fontFamily: MONO_FONT, fontSize: 9 },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, "-2%"],
        color: T.text.primary,
        fontFamily: MONO_FONT,
        fontSize: 26,
        fontWeight: 600,
        formatter: (n) => `${Math.round(n)}%`,
      },
      data: [{ value: v, name: target != null ? `${label} · tgt ${target}%` : label }],
    }],
  };
}

/* ── 6. Fuel uplift by supplier bar ────────────────────────────────────── */
export function buildFuelBySupplier({ items = [], unit = "L" }) {
  const base = baseOption(T);
  const data = [...items].filter((d) => (d.value || 0) > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  const amber = T.series[2];

  return {
    baseOption: {
      ...base,
      grid: { left: 40, right: 16, top: 20, bottom: 34, containLabel: true },
      tooltip: {
        ...base.tooltip,
        formatter: (ps) =>
          ps.map((p) => tooltipRow(p.marker, p.axisValue, `${fmtNum(p.value || 0)} ${unit}`)).join(""),
      },
      xAxis: categoryAxis(T, {
        boundaryGap: true,
        data: data.map((d) => d.label ?? d.name),
        axisLabel: { color: T.text.muted, fontSize: 9, fontFamily: MONO_FONT, hideOverlap: true, interval: 0, rotate: data.length > 5 ? 30 : 0 },
      }),
      yAxis: valueAxis(T, { axisLabel: { color: T.text.muted, fontSize: 10, fontFamily: MONO_FONT, formatter: (v) => fmtNum(v) } }),
      series: [{
        type: "bar",
        barMaxWidth: 26,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: amber },
            { offset: 1, color: withAlpha(amber, 0.22) },
          ] },
        },
        data: data.map((d) => d.value || 0),
      }],
    },
    media: [
      { query: { maxWidth: 460 }, option: { grid: { left: 6, right: 8, top: 14, bottom: 40, containLabel: true }, xAxis: { axisLabel: { rotate: 45, fontSize: 8 } } } },
    ],
  };
}

export default {
  buildRevenueHero,
  buildPassengerTrend,
  buildTopRoutes,
  buildAircraftDonut,
  aircraftLegendItems,
  buildLoadFactorGauge,
  buildFuelBySupplier,
};
