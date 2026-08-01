/**
 * sectionTheme — a color system for pages built from multiple themed
 * SECTIONS (a dashboard split into labeled blocks: "Revenue & Traffic",
 * "Fleet & Fuel", etc.), where each section commits to ONE hue across every
 * chart inside it instead of every card picking its own accent.
 *
 * `whiteTheme(key)` — white card, the section's hue as its one accent.
 * `solidTheme(key)` — a permanently-colored gradient card via `theme.js`'s
 * `solid` escape hatch, so it looks the same in light/dark mode (the same
 * contract a branded stat tile already follows). White text/line/grid on
 * the section's own gradient.
 *
 * The contrast WITHIN a section comes from mixing solid and white cards
 * that share the hue — not from mixing hues. Pick a card or two per section
 * to render `solidTheme`, leave the rest `whiteTheme`.
 *
 * Add or restyle hues by editing SECTIONS below; `accent` is the mid tone
 * (white-card charts), `from`/`to` are the same hue's dark→bright ends
 * (solid-card gradient).
 */

export const SECTIONS = {
  violet: { accent: "#7C3AED", from: "#4C1D95", to: "#8B5CF6" },
  aqua: { accent: "#0EA5E9", from: "#075985", to: "#22D3EE" },
  amber: { accent: "#F59E0B", from: "#B45309", to: "#FBBF24" },
  emerald: { accent: "#059669", from: "#065F46", to: "#10B981" },
  blue: { accent: "#3B82F6", from: "#1D4ED8", to: "#60A5FA" },
  rose: { accent: "#E11D48", from: "#881337", to: "#FB7185" },
  // Pure-neutral charcoal (no blue cast) — a deliberate cool-down section
  // among saturated ones, or the default when a page doesn't need color-
  // per-section at all.
  slate: { accent: "#3F3F46", from: "#131316", to: "#52525B" },
};

const FLAT = {
  surface: "#ffffff",
  backdrop: "none",
  radius: 0,
  border: "#dfe6e3",
  shadow: "0 1px 2px rgba(11,41,27,0.06), 0 8px 20px -14px rgba(11,41,27,0.22)",
};

export const whiteTheme = (key) => ({
  base: "light",
  accent: SECTIONS[key].accent,
  series: [SECTIONS[key].accent, "#94a3b8", SECTIONS[key].to, "#cbd5e1"],
  ...FLAT,
});

export const solidTheme = (key) => ({
  base: "light",
  accent: "#ffffff",
  pad: 16,
  radius: 0,
  backdrop: "none",
  shadow: "none",
  series: ["#ffffff", "rgba(255,255,255,0.55)", "rgba(255,255,255,0.3)"],
  solid: {
    surface: `linear-gradient(135deg, ${SECTIONS[key].from} 0%, ${SECTIONS[key].to} 100%)`,
    border: "transparent",
    grid: "rgba(255,255,255,0.2)",
    track: "rgba(255,255,255,0.18)",
    text: { primary: "#ffffff", secondary: "rgba(255,255,255,0.82)", muted: "rgba(255,255,255,0.62)" },
    control: { bg: "rgba(255,255,255,0.16)", border: "rgba(255,255,255,0.24)", text: "#ffffff", hover: "rgba(255,255,255,0.26)" },
  },
});

/**
 * One harmonized row height for a multi-section dashboard page: `100vh`
 * minus the fixed chrome above the scroll area (topbar + page header +
 * a sticky KPI strip + a section's own label row — budget ~300px unless
 * your chrome measures differently), split across however many stacked
 * rows one section needs. Every row on the page comes out the same height
 * whether it's alone in a single-row section or paired in a two-row one,
 * so N rows always add up to a whole number of "pages."
 */
export const sectionRowHeight = (rows = 2, chromePx = 300, gapPx = 12) =>
  `calc((100vh - ${chromePx}px) / ${rows} - ${((rows - 1) * gapPx) / rows}px)`;
