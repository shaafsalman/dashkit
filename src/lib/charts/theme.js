/**
 * Shared theming for the chart library.
 * Pass `theme="light"` / `theme="dark"`, or a partial object to override tokens
 * (e.g. `theme={{ base: "dark", accent: "#56e0a6" }}`). Every component resolves
 * its theme through `resolveTheme` so chrome (card, header, controls, legend)
 * and accents stay consistent.
 */

import { isDarkMode } from "../../isDarkMode";

export const lighten = (input, amt) => {
  const source = String(input || "").trim();
  let channels;
  let alpha = null;
  let output = "hex";

  const hex = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let value = hex[1];
    if (value.length === 3) value = value.replace(/(.)/g, "$1$1");
    if (value.length === 8) {
      alpha = value.slice(6);
      value = value.slice(0, 6);
    }
    const n = parseInt(value, 16);
    channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const rgb = source.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (!rgb) return source;
    channels = rgb.slice(1, 4).map(Number);
    alpha = rgb[4] == null ? null : Number(rgb[4]);
    output = "rgb";
  }

  // Positive values mix toward white; negative values mix toward black.
  // Alpha is preserved, so translucent brand-series colors can be shaded
  // without turning into invalid CSS (and therefore browser-fallback black).
  const mix = (channel) => {
    const next = amt >= 0
      ? channel + (255 - channel) * amt
      : channel * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  const [r, g, b] = channels.map(mix);
  if (output === "rgb") return alpha == null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const body = [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  return `#${body}${alpha || ""}`;
};

export const darken = (hex, amt) => lighten(hex, -amt);

// Pick readable ink for a data fill. This is intentionally based on the fill
// itself rather than the card mode: brand cards often contain both white and
// charcoal marks at the same time, so a single card-wide text color cannot be
// correct for every segment/cell.
export const contrastingText = (input, light = "#ffffff", dark = "#0f172a") => {
  const source = String(input || "").trim();
  let rgb;
  const hex = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let value = hex[1];
    if (value.length === 3) value = value.replace(/(.)/g, "$1$1");
    const n = parseInt(value.slice(0, 6), 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const match = source.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!match) return light;
    rgb = match.slice(1, 4).map(Number);
  }
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.42 ? dark : light;
};

// polar point (SVG y-down) and a sampled arc path — shared by radial charts.
export const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
export const arcPath = (cx, cy, r, a0, a1, step = 2) => {
  const dir = a1 >= a0 ? 1 : -1;
  const pts = [];
  for (let a = a0; dir > 0 ? a <= a1 : a >= a1; a += dir * step) pts.push(polar(cx, cy, r, a));
  pts.push(polar(cx, cy, r, a1));
  return pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
};

// brand series palette (deep purple -> teal). Reuse for stacked series.
export const SERIES_PALETTE = [
  "#3a2a8c",
  "#6d5ae6",
  "#2f6bf5",
  "#39a0f4",
  "#56e0a6",
  "#7c8aa5",
];

// Deep glassmorphism (iOS-style frosted glass): translucent surfaces, blur
// backdrop, hairline light border, NO box shadow.
export const LIGHT_THEME = {
  mode: "light",
  surface: "rgba(255,255,255,0.62)",
  border: "rgba(15,23,42,0.10)",
  shadow: "none",
  backdrop: "blur(22px) saturate(180%)",
  radius: 20,
  pad: 16,
  text: { primary: "#0f172a", secondary: "#475569", muted: "#7c8aa0" },
  accent: "#10B981",
  track: "rgba(15,23,42,0.08)",
  grid: "rgba(15,23,42,0.10)",
  control: {
    bg: "rgba(255,255,255,0.5)",
    border: "rgba(15,23,42,0.12)",
    text: "#475569",
    hover: "rgba(255,255,255,0.85)",
  },
  series: SERIES_PALETTE,
};

export const DARK_THEME = {
  mode: "dark",
  // Pure neutral (R=G=B) charcoal — the previous rgba(20,24,33,...) had
  // B > R/G, which reads as navy/bluish-black, not the jet-black the rest of
  // the app uses. Every value below is neutral gray or a white/black alpha.
  surface: "rgba(32,32,32,0.62)",
  border: "rgba(255,255,255,0.10)",
  shadow: "none",
  backdrop: "blur(22px) saturate(160%)",
  radius: 22,
  pad: 16,
  text: { primary: "#ffffff", secondary: "#d4d4d4", muted: "#a3a3a3" },
  accent: "#56e0a6",
  track: "rgba(255,255,255,0.10)",
  grid: "rgba(255,255,255,0.08)",
  control: {
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.12)",
    text: "#d4d4d4",
    hover: "rgba(255,255,255,0.14)",
  },
  series: SERIES_PALETTE,
};

const PRESETS = { light: LIGHT_THEME, dark: DARK_THEME };

/**
 * Resolve a theme prop into a full token object.
 *
 * Color scheme (light vs dark) always comes from the app's real, live dark-mode
 * state (`isDarkMode()`), NOT from the `theme` prop's `base`/`mode` or from the
 * `fallbackMode` param — every call site across the app was written before dark
 * mode existed and hardcodes `base: "light"` plus light color tokens (surface,
 * border, text, control, grid, track). Honoring those here would silently
 * re-break dark mode. Structural/per-instance choices (radius, backdrop, pad,
 * shadow, accent, series, className, etc.) are NOT color-scheme-specific, so
 * they still pass through from the caller as before.
 *
 * @param theme        "light" | "dark" | partial-object | undefined (color-scheme
 *                      fields are ignored; structural fields still apply)
 * @param fallbackMode  unused — kept for call-site compatibility
 *
 * `theme.solid` is the one deliberate escape hatch from the rule above: a
 * card that's meant to be a permanently-colored gradient tile (branded KPI
 * cards, a "solid" chart variant) should look the same in light and dark
 * mode, same as GradientStatCard already does — so `solid`'s surface/border/
 * text/control/grid/track apply unconditionally, on top of the resolved
 * light/dark base, instead of being stripped like the top-level fields are.
 */
export const resolveTheme = (theme, fallbackMode = "dark") => {
  const base = PRESETS[isDarkMode() ? "dark" : "light"];
  if (!theme || typeof theme !== "object") return base;
  const {
    base: _base,
    mode: _mode,
    surface: _surface,
    border: _border,
    track: _track,
    grid: _grid,
    text: _text,
    control: _control,
    solid,
    frame,
    ...structural
  } = theme;
  const resolved = {
    ...base,
    ...structural,
    text: base.text,
    control: base.control,
    series: theme.series || base.series,
  };
  if (!solid) return frame ? { ...resolved, border: frame.border ?? resolved.border } : resolved;
  const solidResolved = {
    ...resolved,
    ...solid,
    text: { ...resolved.text, ...(solid.text || {}) },
    control: { ...resolved.control, ...(solid.control || {}) },
  };
  return frame ? { ...solidResolved, border: frame.border ?? solidResolved.border } : solidResolved;
};

// Outer card style derived from the theme (used by ChartCard).
export const cardStyle = (t, extra = {}) => ({
  background: t.surface,
  border: t.border === "transparent" ? "none" : `1px solid ${t.border}`,
  borderRadius: t.radius,
  boxShadow: t.shadow,
  padding: t.pad,
  ...extra,
});

/**
 * One shared axis/grid treatment for every Recharts chart in the app — bar,
 * area, dual-line, comparison. Before this, each component defined its own
 * tick fontSize/weight/family/color (9 vs 10 vs 11 vs 12px, MONO vs no
 * family, theme.text.muted vs a hardcoded hex...), so switching between chart
 * types — or just looking at two widgets side by side — read as a style
 * change on top of the data change. Colors are CSS custom properties (see
 * index.css), so they repaint on theme toggle without any of this needing
 * the live `t` theme object.
 */
export const CHART_FONT_SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
export const CHART_FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

// Category axis (names, months, station codes) — bolder, sans.
export const AXIS_CATEGORY_TICK = {
  fontSize: 11, fontWeight: 600, fontFamily: CHART_FONT_SANS, fill: "var(--chart-tick)",
};
// Value axis (numbers) — lighter, mono, dimmer.
export const AXIS_VALUE_TICK = {
  fontSize: 10, fontWeight: 500, fontFamily: CHART_FONT_MONO, fill: "var(--chart-tick-dim)",
};
// No visible spine or tick marks on either axis — the dashed grid line carries
// the scale instead, matching the comparison chart's reference look.
export const AXIS_LINE_PROPS = { axisLine: false, tickLine: false };
export const AXIS_GRID_PROPS = { strokeDasharray: "4 4", stroke: "var(--chart-grid)" };
