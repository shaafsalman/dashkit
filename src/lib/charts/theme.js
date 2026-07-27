/**
 * Shared theming for the chart library.
 * Pass `theme="light"` / `theme="dark"`, or a partial object to override tokens
 * (e.g. `theme={{ base: "dark", accent: "#56e0a6" }}`). Every component resolves
 * its theme through `resolveTheme` so chrome (card, header, controls, legend)
 * and accents stay consistent.
 */

export const lighten = (hex, amt) => {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * amt);
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
  surface: "rgba(20,24,33,0.55)",
  border: "rgba(255,255,255,0.10)",
  shadow: "none",
  backdrop: "blur(22px) saturate(160%)",
  radius: 22,
  pad: 16,
  text: { primary: "#ffffff", secondary: "#cbd5e1", muted: "#94a3b8" },
  accent: "#56e0a6",
  track: "rgba(255,255,255,0.10)",
  grid: "rgba(255,255,255,0.08)",
  control: {
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.12)",
    text: "#e2e8f0",
    hover: "rgba(255,255,255,0.14)",
  },
  series: SERIES_PALETTE,
};

const PRESETS = { light: LIGHT_THEME, dark: DARK_THEME };

/**
 * Resolve a theme prop into a full token object.
 * @param theme        "light" | "dark" | partial-object | undefined
 * @param fallbackMode the component's natural default ("light" | "dark")
 */
export const resolveTheme = (theme, fallbackMode = "dark") => {
  if (typeof theme === "string") return PRESETS[theme] || PRESETS[fallbackMode];
  const base = PRESETS[theme?.base || theme?.mode || fallbackMode] || PRESETS[fallbackMode];
  if (!theme || typeof theme !== "object") return base;
  return {
    ...base,
    ...theme,
    text: { ...base.text, ...(theme.text || {}) },
    control: { ...base.control, ...(theme.control || {}) },
    series: theme.series || base.series,
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
