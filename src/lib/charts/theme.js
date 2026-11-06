/**
 * Shared theming for the chart library.
 * Pass `theme="light"` / `theme="dark"`, or a partial object to override tokens
 * (e.g. `theme={{ base: "dark", accent: "#56e0a6" }}`). Every component resolves
 * its theme through `resolveTheme` so chrome (card, header, controls, legend)
 * and accents stay consistent.
 */

import { isDarkMode, isMonotone } from "../../isDarkMode";

// ---------------------------------------------------------------------------
// Color parsing. Inputs come from props AND from getComputedStyle, and modern
// browsers serialize computed colors in CSS Color 4 syntax — space-separated
// `rgb(250 250 250)`, `rgb(250 250 250 / 0.5)`, `color(srgb 0.98 0.98 0.98)`,
// `oklch(...)` — so a comma-only regex silently fails on real-world values.
// parseColor returns [r, g, b, alpha|null] with 0–255 channels, or null.
// ---------------------------------------------------------------------------

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

// "50%" -> 0.5 * scale; "0.5" -> 0.5; "none" -> 0
const num = (token, scale = 1) => {
  if (token == null || token === "none") return 0;
  const str = String(token).trim();
  if (str.endsWith("%")) return (parseFloat(str) / 100) * scale;
  return parseFloat(str);
};

const alphaOf = (token) => {
  if (token == null) return null;
  const a = String(token).trim().endsWith("%") ? num(token, 1) : parseFloat(token);
  return Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : null;
};

const hueDeg = (token) => {
  const str = String(token).trim();
  const v = parseFloat(str);
  if (str.endsWith("rad")) return (v * 180) / Math.PI;
  if (str.endsWith("grad")) return v * 0.9;
  if (str.endsWith("turn")) return v * 360;
  return v || 0;
};

// Split the inside of `fn( ... )` into channel tokens + optional alpha,
// accepting both legacy comma syntax and modern space / slash syntax.
const splitArgs = (body) => {
  const [main, slashAlpha] = body.split("/");
  const parts = main.includes(",")
    ? main.split(",").map((x) => x.trim()).filter(Boolean)
    : main.trim().split(/\s+/).filter(Boolean);
  const alpha = slashAlpha != null ? slashAlpha.trim() : parts[3];
  return { parts: parts.slice(0, 3), alpha };
};

const srgbEncode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

const oklabToRgb = (L, a, b) => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3; const m = m_ ** 3; const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => clamp255(srgbEncode(Math.max(0, Math.min(1, c))) * 255));
};

const hslToRgb = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((c) => clamp255(c * 255));
};

// Last resort for anything else (named colors, lab(), hwb(), display-p3 ...):
// let the browser rasterize it. Returns null outside a DOM / without canvas.
let probeCtx;
const parseViaCanvas = (source) => {
  if (typeof document === "undefined") return null;
  try {
    if (probeCtx === undefined) {
      const canvas = document.createElement("canvas");
      canvas.width = 1; canvas.height = 1;
      probeCtx = canvas.getContext && canvas.getContext("2d", { willReadFrequently: true });
    }
    if (!probeCtx) return null;
    // Reject strings the browser doesn't understand (fillStyle keeps its old value).
    // Invalid strings leave fillStyle unchanged, so try from two sentinels.
    probeCtx.fillStyle = "#000";
    probeCtx.fillStyle = source;
    if (probeCtx.fillStyle === "#000000") {
      probeCtx.fillStyle = "#fff";
      probeCtx.fillStyle = source;
      if (probeCtx.fillStyle === "#ffffff") return null;
    }
    probeCtx.clearRect(0, 0, 1, 1);
    probeCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probeCtx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return [0, 0, 0, 0];
    return [r, g, b, a === 255 ? null : a / 255];
  } catch {
    return null;
  }
};

export const parseColor = (input) => {
  const source = String(input || "").trim();
  if (!source) return null;

  const hex = source.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let value = hex[1];
    if (value.length <= 4) value = value.replace(/(.)/g, "$1$1");
    const n = parseInt(value.slice(0, 6), 16);
    const alpha = value.length === 8 ? parseInt(value.slice(6), 16) / 255 : null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
  }

  const fn = source.match(/^([a-z-]+)\(\s*(.*)\s*\)$/i);
  if (fn) {
    const name = fn[1].toLowerCase();
    const body = fn[2];
    if (name === "rgb" || name === "rgba") {
      const { parts, alpha } = splitArgs(body);
      if (parts.length < 3) return null;
      return [...parts.map((p) => clamp255(num(p, 255))), alphaOf(alpha)];
    }
    if (name === "hsl" || name === "hsla") {
      const { parts, alpha } = splitArgs(body);
      if (parts.length < 3) return null;
      return [...hslToRgb(((hueDeg(parts[0]) % 360) + 360) % 360, num(parts[1], 1) / (String(parts[1]).endsWith("%") ? 1 : 100), num(parts[2], 1) / (String(parts[2]).endsWith("%") ? 1 : 100)), alphaOf(alpha)];
    }
    if (name === "color") {
      const [space, ...rest] = body.trim().split(/\s+/);
      if (/^srgb$/i.test(space)) {
        const { parts, alpha } = splitArgs(rest.join(" "));
        if (parts.length < 3) return null;
        return [...parts.map((p) => clamp255(num(p, 1) * 255)), alphaOf(alpha)];
      }
      if (/^srgb-linear$/i.test(space)) {
        const { parts, alpha } = splitArgs(rest.join(" "));
        if (parts.length < 3) return null;
        return [...parts.map((p) => clamp255(srgbEncode(Math.max(0, Math.min(1, num(p, 1)))) * 255)), alphaOf(alpha)];
      }
    }
    if (name === "oklab") {
      const { parts, alpha } = splitArgs(body);
      if (parts.length < 3) return null;
      return [...oklabToRgb(num(parts[0], 1), num(parts[1], 0.4), num(parts[2], 0.4)), alphaOf(alpha)];
    }
    if (name === "oklch") {
      const { parts, alpha } = splitArgs(body);
      if (parts.length < 3) return null;
      const L = num(parts[0], 1);
      const C = num(parts[1], 0.4);
      const h = (hueDeg(parts[2]) * Math.PI) / 180;
      return [...oklabToRgb(L, C * Math.cos(h), C * Math.sin(h)), alphaOf(alpha)];
    }
  }

  return parseViaCanvas(source);
};

export const lighten = (input, amt) => {
  const source = String(input || "").trim();
  const isHex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(source);
  const parsed = parseColor(source);
  if (!parsed) return source;
  const [r0, g0, b0, alpha] = parsed;

  // Positive values mix toward white; negative values mix toward black.
  // Alpha is preserved, so translucent brand-series colors can be shaded
  // without turning into invalid CSS (and therefore browser-fallback black).
  const mix = (channel) => {
    const next = amt >= 0
      ? channel + (255 - channel) * amt
      : channel * (1 + amt);
    return clamp255(next);
  };
  const [r, g, b] = [r0, g0, b0].map(mix);
  if (!isHex) return alpha == null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const body = [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  const alphaHex = alpha == null ? "" : clamp255(alpha * 255).toString(16).padStart(2, "0");
  return `#${body}${alphaHex}`;
};

export const darken = (hex, amt) => lighten(hex, -amt);

// Pick readable ink for a data fill. This is intentionally based on the fill
// itself rather than the card mode: brand cards often contain both white and
// charcoal marks at the same time, so a single card-wide text color cannot be
// correct for every segment/cell. Unparseable input keeps the old `light`
// fallback.
export const relativeLuminance = (input) => {
  const parsed = parseColor(input);
  if (!parsed) return null;
  const linear = parsed.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

export const contrastingText = (input, light = "#ffffff", dark = "#0f172a") => {
  const luminance = relativeLuminance(input);
  if (luminance == null) return light;
  return luminance > 0.42 ? dark : light;
};

// polar point (SVG y-down) and a sampled arc path — shared by radial charts.
export const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
// True SVG elliptical-arc commands (not a sampled polyline), so large rings
// stay perfectly round at any zoom. Sweeps >= 360deg are split in two because
// a single arc command can't describe a closed circle.
export const arcPath = (cx, cy, r, a0, a1) => {
  const dir = a1 >= a0 ? 1 : -1;
  let span = Math.abs(a1 - a0);
  if (span < 1e-6) return "";
  const f = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const parts = [`M ${f(polar(cx, cy, r, a0))}`];
  let from = a0;
  while (span > 1e-6) {
    const step = Math.min(span, 180);
    const to = from + dir * step;
    parts.push(`A ${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${f(polar(cx, cy, r, to))}`);
    from = to;
    span -= step;
  }
  return parts.join(" ");
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
 * Greyscale series ramps. Both are ordered most-prominent first and stay
 * distinguishable by lightness alone (no hue), for strictly monotone UIs.
 *  - on a DARK surface: white -> mid grey
 *  - on a LIGHT surface: black -> light grey
 */
export const MONO_SERIES_ON_DARK = ["#ffffff", "#a3a3a3", "#525252", "#d4d4d4", "#737373", "#3a3a3a"];
export const MONO_SERIES_ON_LIGHT = ["#000000", "#737373", "#d4d4d4", "#404040", "#a3a3a3", "#e5e5e5"];

const mono = (ink, surface, border, scheme) => {
  const a = (alpha) => `rgba(${ink},${alpha})`;
  const strong = scheme === "dark" ? "#ffffff" : "#000000";
  return {
    mode: scheme,
    mono: true,
    surface,
    border,
    backdrop: "none",
    accent: strong,
    text: scheme === "dark"
      ? { primary: "#ffffff", secondary: "#d4d4d4", muted: "#a3a3a3" }
      : { primary: "#000000", secondary: "#404040", muted: "#737373" },
    track: a(scheme === "dark" ? 0.12 : 0.08),
    grid: a(scheme === "dark" ? 0.1 : 0.12),
    control: {
      bg: a(scheme === "dark" ? 0.07 : 0.05),
      border: a(scheme === "dark" ? 0.16 : 0.16),
      text: scheme === "dark" ? "#d4d4d4" : "#404040",
      hover: a(scheme === "dark" ? 0.16 : 0.1),
    },
    tooltip: { bg: surface, border: a(0.2) },
    // Axis/tick colours are CSS custom properties the host normally defines
    // page-wide. A card whose surface differs from the page (inverse) must
    // re-scope them; ChartCard applies this map on its root element.
    vars: {
      "--chart-grid": a(scheme === "dark" ? 0.1 : 0.12),
      "--chart-tick": scheme === "dark" ? "#d4d4d4" : "#404040",
      "--chart-tick-dim": scheme === "dark" ? "#a3a3a3" : "#737373",
      "--chart-tick-strong": strong,
    },
  };
};

/**
 * Monotone surface variants, resolved against the live dark-mode state.
 *  - "mono":    follows the page. dark = near-black + white ink; light = white + black ink.
 *  - "inverse": the contrast card. dark = WHITE fill + black ink; light = BLACK fill + white ink.
 */
export const monoVariant = (variant, dark) => {
  if (variant === "mono") {
    return dark
      ? mono("255,255,255", "#000000", "rgba(255,255,255,0.14)", "dark")
      : mono("0,0,0", "#ffffff", "rgba(0,0,0,0.12)", "light");
  }
  if (variant === "inverse") {
    return dark
      ? mono("0,0,0", "#ffffff", "rgba(0,0,0,0.12)", "light")
      : mono("255,255,255", "#000000", "rgba(255,255,255,0.14)", "dark");
  }
  return null;
};

export const monoSeries = (surfaceScheme) =>
  surfaceScheme === "dark" ? MONO_SERIES_ON_DARK : MONO_SERIES_ON_LIGHT;

/**
 * The one colour gate every chart uses for a data colour: the caller's colour
 * normally, the i-th step of the greyscale ramp in monotone mode — so series
 * stay distinguishable by lightness instead of collapsing to one grey.
 */
export const toneColor = (t, color, i = 0) =>
  t.mono ? t.series[i % t.series.length] : color;

/**
 * Colour for series `i` of a chart that ships its own default palette:
 * explicit per-item colour > the theme's palette when one was passed >
 * the chart's designed default. Monotone always wins (greyscale ramp).
 */
export const seriesColor = (t, explicit, i, fallback) =>
  toneColor(t, explicit || (t.customSeries ? t.series[i % t.series.length] : fallback), i);

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
  const dark = isDarkMode();
  const base = PRESETS[dark ? "dark" : "light"];
  // Accept "mono" / "inverse" strings and { preset: "mono", inverse?: true }.
  if (theme === "mono" || theme === "inverse") theme = { variant: theme };
  // Page-wide monotone switch (setChartTone("mono")): every chart goes black &
  // white unless it explicitly opts out with { tone: "color" }. Structural
  // fields (radius, pad, ...) survive; colour fields are replaced by the
  // greyscale tokens below.
  if (isMonotone() && !(theme && typeof theme === "object" && theme.tone === "color")) {
    const obj = theme && typeof theme === "object" ? theme : {};
    theme = { ...obj, series: undefined, variant: obj.variant === "inverse" ? "inverse" : "mono" };
  }
  if (theme && typeof theme === "object" && theme.preset === "mono" && !theme.variant) {
    theme = { ...theme, variant: theme.inverse ? "inverse" : "mono" };
  } else if (theme && typeof theme === "object" && theme.inverse && theme.variant === "mono") {
    theme = { ...theme, variant: "inverse" };
  }
  if (!theme || typeof theme !== "object") return base;
  const variantTokens = monoVariant(theme.variant, dark);
  if (variantTokens) {
    const { variant: _variant, preset: _preset, inverse: _inverse, solid: _solid, base: _b, mode: _m, surface: _s, border: _bo, track: _t, grid: _g, text: _tx, control: _c, frame, series, ...rest } = theme;
    const resolved = {
      ...base,
      ...rest,
      ...variantTokens,
      series: series === "mono" || !series ? monoSeries(variantTokens.mode) : series,
    };
    return frame ? { ...resolved, border: frame.border ?? resolved.border } : resolved;
  }
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
    variant: _variant,
    preset: _preset,
    inverse: _inverse,
    ...structural
  } = theme;
  const resolved = {
    ...base,
    ...structural,
    text: base.text,
    control: base.control,
    series: theme.series === "mono"
      ? monoSeries(solid?.mode || base.mode)
      : theme.series || base.series,
    // charts with their own designed default colours defer to an explicit
    // theme palette (see seriesColor) instead of silently ignoring it
    customSeries: Array.isArray(theme.series),
  };
  if (!solid) return frame ? { ...resolved, border: frame.border ?? resolved.border } : resolved;
  const solidResolved = {
    ...resolved,
    ...solid,
    isSolid: true,
    text: { ...resolved.text, ...(solid.text || {}) },
    control: { ...resolved.control, ...(solid.control || {}) },
  };
  return frame ? { ...solidResolved, border: frame.border ?? solidResolved.border } : solidResolved;
};

/**
 * Tooltip surface for a resolved theme. `theme.tooltip = { bg, border }`
 * overrides it explicitly. Otherwise it is derived from the resolved theme,
 * never from the light/dark guess alone: a host whose dark mode isn't the
 * `<html class="dark">` convention (or a brand `solid` card with white text)
 * would otherwise get a white box under white text.
 *  - solid/brand themes reuse the opaque brand surface the text was chosen for;
 *  - everything else picks a light or dark glass by the luminance of
 *    `text.primary`, so the tooltip always contrasts with its own ink.
 */
export const tooltipColors = (t) => {
  const textIsLight = (relativeLuminance(t.text?.primary) ?? 0) > 0.42;
  const fallbackBg = textIsLight ? "rgba(20,20,20,0.92)" : "rgba(255,255,255,0.92)";
  const bg = t.tooltip?.bg || (t.isSolid && t.surface ? t.surface : fallbackBg);
  const border = t.tooltip?.border || t.control?.border || t.border;
  return { bg, border };
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
