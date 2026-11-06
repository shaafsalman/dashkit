/**
 * Reads the host app's dark-mode state directly off the DOM (`<html
 * class="dark">`), rather than any particular state-management pattern —
 * this library doesn't own theme state, so it has no localStorage key or
 * React context to read. Toggle dark mode in your own app however you like;
 * as long as you add/remove a `dark` class on `<html>` (the same convention
 * Tailwind's `darkMode: "class"` uses), every chart here picks it up.
 *
 * Charts resolve their theme at RENDER time via this function (see
 * `lib/charts/theme.js`'s `resolveTheme`), not through a live subscription —
 * if you toggle dark mode with a React state change rather than a full
 * reload, force a remount of the chart tree (e.g. `key={theme}` on a root
 * wrapper) so colors actually refresh.
 */
export const isDarkMode = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark");

export default isDarkMode;

/**
 * Page-wide monotone (black & white) switch, same convention as dark mode:
 * a `chart-mono` class on <html>. While it is set, every chart resolves to
 * the greyscale "mono" theme (white/black ink on the live light/dark
 * surface) unless that chart opts out with `theme={{ tone: "color" }}`.
 * Like dark mode, charts read it at render time — remount the chart tree
 * (e.g. `key={tone}`) after toggling.
 */
export const isMonotone = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("chart-mono");

export const setChartTone = (tone) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("chart-mono", tone === "mono");
};
