/**
 * Shared theming for the chart library.
 * Pass `theme="light"` / `theme="dark"`, or a partial object to override tokens
 * (e.g. `theme={{ base: "dark", accent: "#56e0a6" }}`). Every component resolves
 * its theme through `resolveTheme` so chrome (card, header, controls, legend)
 * and accents stay consistent.
 */

import { isDarkMode } from "../../isDarkMode";

export const lighten = (hex, amt) => {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  // Clamped to [0, 255]: without this, darken()-ing a channel that's already
  // near 0 (e.g. amber's blue channel, 0x0B in #F59E0B) sends `mix` negative.
  // (-18).toString(16) is the STRING "-12", not a valid two-digit hex pair —
  // padStart doesn't fix a value that's already 3 characters — so it got
  // spliced straight into the hex string as garbage (e.g. "#f492-12"), an
  // invalid CSS color that every browser here was falling back to black for.
  // That's what made every warm/yellow funnel band fade to black on its
  // right edge instead of shading the color that was actually passed in.
  const mix = (c) => Math.max(0, Math.min(255, Math.round(c + (255 - c) * amt)));
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
};

export const darken = (hex, amt) => lighten(hex, -amt);

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
    ...structural
  } = theme;
  const resolved = {
    ...base,
    ...structural,
    text: base.text,
    control: base.control,
    series: theme.series || base.series,
  };
  if (!solid) return resolved;
  return {
    ...resolved,
    ...solid,
    text: { ...resolved.text, ...(solid.text || {}) },
    control: { ...resolved.control, ...(solid.control || {}) },
  };
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
