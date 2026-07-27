/* Bento design tokens + shared ECharts base option.
   ECharts renders to canvas and cannot read CSS custom properties, so every
   colour here is a literal value that gets injected into the option objects.

   These values mirror the app's EXISTING palette (tailwind.config.js):
   primary #068A4B, secondary #37A169, info #2A8DD4, warning #FFB020,
   danger #E53939, success #0D8F53, dark #0B291B. Do not introduce new
   brand colours here — the page is light-themed and green-led. */

export const bento = {
  surface: "#ffffff",
  surfaceHero: "#ffffff",
  border: "#e3ebe6",
  innerHighlight: "inset 0 1px 0 rgba(255,255,255,0.9)",
  shadow: "0 4px 6px -1px rgba(5,74,41,0.10), 0 2px 4px -1px rgba(5,74,41,0.06)",
  radius: 16,
  gap: 12,
  text: {
    primary: "#0B291B",
    secondary: "#475569",
    muted: "#94a3b8",
  },
  grid: "#eef2f7",
  axis: "#e2e8f0",
  positive: "#0D8F53",
  negative: "#E53939",
  accent: "#068A4B",
  series: ["#068A4B", "#2A8DD4", "#FFB020", "#37A169", "#E53939", "#0D8F53"],
};

// Matches MainDashboard/ExecutiveOverview.jsx's HEAD/MONO constants exactly —
// that page's own ECharts gauge already uses this pair, so this keeps every
// canvas-rendered chart in the app on one font family instead of two.
export const FONT = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
export const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

/** Shared skeleton every builder in chartOptions.js spreads over. */
export function baseOption(theme = bento) {
  return {
    backgroundColor: "transparent",
    color: theme.series,
    animationDuration: 650,
    animationEasing: "cubicOut",
    textStyle: { color: theme.text.secondary, fontFamily: FONT, fontSize: 11 },
    grid: { left: 42, right: 20, top: 28, bottom: 34, containLabel: true },
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: "#ffffff",
      borderColor: theme.border,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: theme.text.primary, fontFamily: FONT, fontSize: 11 },
      axisPointer: { lineStyle: { color: theme.axis }, crossStyle: { color: theme.axis } },
    },
  };
}

/** Category x-axis in house style. */
export function categoryAxis(theme = bento, extra = {}) {
  return {
    type: "category",
    boundaryGap: false,
    axisLine: { lineStyle: { color: theme.axis } },
    axisTick: { show: false },
    axisLabel: {
      color: theme.text.muted,
      fontSize: 10,
      fontFamily: MONO_FONT,
      hideOverlap: true,
    },
    splitLine: { show: false },
    ...extra,
  };
}

/** Value y-axis in house style. */
export function valueAxis(theme = bento, extra = {}) {
  return {
    type: "value",
    nameLocation: "end",
    nameGap: 12,
    nameTextStyle: { color: theme.text.muted, fontSize: 10, fontFamily: MONO_FONT },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: theme.text.muted, fontSize: 10, fontFamily: MONO_FONT },
    splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
    ...extra,
  };
}

/** Vertical fade from an accent colour to transparent, for area fills. */
export function areaGradient(hex, topOpacity = 0.32) {
  return {
    type: "linear",
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: withAlpha(hex, topOpacity) },
      { offset: 1, color: withAlpha(hex, 0) },
    ],
  };
}

export function withAlpha(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export default bento;
