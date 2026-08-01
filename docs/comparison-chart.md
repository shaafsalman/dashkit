# ComparisonChart

`src/ComparisonChart.jsx`

A multi-year (or generally multi-series) comparison chart: bar, area, or
line, switchable at runtime via a built-in Bar/Area/Line switcher. It plots
each selected year as its own series across a shared category axis (months,
by default, or any category), with a per-year Total row always visible in
the footer and an expandable Avg/Peak breakdown per year.

It ships in two integration modes:

- **Standalone card** — its own bordered card, header (icon + title +
  type switcher), plot, and footer (year totals, expand-to-stats,
  expand-to-modal).
- **Embedded** (`embedded` prop) — strips all of its own chrome down to just
  `ResponsiveContainer` + the plot, so it can be nested inside another
  widget's own card/header/footer. This is how `RankedDataWidget` uses it
  internally for its "area" and "line" view modes — see
  [Embedded inside RankedDataWidget](#embedded-inside-rankeddatawidget)
  below.

## What it renders

- **Bar** — one bar per year per category, grouped (no gap within a group,
  a category gap between groups), with a value + percent-of-total label
  stacked above each bar.
- **Area** — only the most recent (last) selected year is rendered as a
  filled gradient `Area`; every other year renders as a dashed `Line`
  overlay. (Filling every year independently produced a muddy overlap of
  semi-transparent fills, so only the primary year gets the fill.)
- **Line** — every year renders as a plain `Line` with dots and a value
  label per point. The most recent year's labels sit above its points;
  every other year's labels sit below, so labels don't collide when lines
  are close or cross.

All three types share the same `BarChart`/`ComposedChart`/`LineChart`
X/Y axes, grid, and tooltip styling from `src/lib/charts/theme.js`
(`AXIS_CATEGORY_TICK`, `AXIS_VALUE_TICK`, `AXIS_GRID_PROPS`).

## Props

| prop | type | default | notes |
|------|------|---------|-------|
| `title` | string | — | card heading (standalone mode) |
| `data` | `{ [year]: { name, label?, value }[] }` | — | one array of category points per year key |
| `headerIcon` | icon component | `BarChart3` | shown next to the title |
| `showPercentage` | boolean | `false` | formats values/labels as `%` instead of K/M-abbreviated numbers |
| `selectedYears` | `number[]` | `[]` | which keys of `data` to plot; sorted ascending internally |
| `defaultType` | `"bar" \| "area" \| "line"` | `"bar"` | initial chart type; the user can still switch via the header buttons (standalone mode only — `embedded` hides the switcher, so this becomes the *only* type shown) |
| `colors` | `string[] \| null` | `null` | per-series (per-year, by index) color palette; falls back to the module's built-in `COLORS` (drawn from `colorConfig.js`'s `chartPalettes.multiPalette`) when omitted |
| `showHeader` | boolean | `true` | when `false`, hides the icon+title row but keeps the type switcher + expand button (for hosts that render their own title elsewhere) |
| `embedded` | boolean | `false` | strips the outer card border/background, the header row (title *and* the Bar/Area/Line switcher), and the footer (totals + expand-to-stats) — renders only `ResponsiveContainer` + the plot |

### `colors` shape

A flat array of CSS color strings, indexed by year position (after
`selectedYears` is sorted ascending) — `colors[0]` is the earliest selected
year, `colors[colors.length - 1]` is the most recent. Colors wrap via modulo
if there are more years than colors. If omitted or empty, the component
falls back to its own built-in 6-color palette.

```jsx
colors={["#0f766e", "#0ea5e9"]} // e.g. 2025 = teal, 2026 = sky blue
```

### `selectedYears`

An array of numeric (or numeric-like) year keys that must exist on `data`.
The component sorts them ascending before use — plot order, color index,
and the "most recent = primary" logic (which year gets the filled Area /
above-line labels) all key off that sorted order, not the order you pass
them in.

## Expand-to-modal behavior

Every standalone render includes a "Maximize2" button in the header that
opens the same chart (same `type` state, so whatever the user last picked
persists) in a full-screen modal via `createPortal`. The modal:

- Locks `document.body` scroll while open.
- Closes on `Escape`, on clicking the backdrop, or via its own close button.
- Re-renders the chart at a fixed 420px height with a fuller Avg/Peak/Total
  stats grid underneath (3 stats per year instead of 2).

This is not available in `embedded` mode — embedded instances render only
the bare plot, with no expand button, no modal, and no footer.

## Usage

### Standalone

```jsx
import { ComparisonChart } from "chart-kit";

<ComparisonChart
  title="Monthly Revenue"
  data={{
    2025: [{ name: "January", value: 12000 }, { name: "February", value: 15500 }, /* ... */],
    2026: [{ name: "January", value: 14200 }, { name: "February", value: 16100 }, /* ... */],
  }}
  selectedYears={[2025, 2026]}
  defaultType="bar"
  colors={["#0f766e", "#0ea5e9"]}
/>
```

### Embedded inside RankedDataWidget

`src/widgets/RankedDataWidget.jsx` renders `ComparisonChart` with
`embedded` for its own `"area"` and `"line"` view modes (single-metric,
year-over-year comparisons only — its separate multi-metric compare mode
still uses `AreaChartView`/`LineChartView` instead, since a per-metric axis
doesn't fit ComparisonChart's "N years, one axis" model). It reshapes its
own `chartData` into `{ [year]: [{ name: monthName, value }] }`, expanding
abbreviated month names back to the full names `ComparisonChart`'s internal
sort expects, and passes its own `compareColors` through as `colors`:

```jsx
// inside RankedDataWidget.jsx, viewMode === "area" (single-metric branch)
<ComparisonChart
  title={title}
  data={byYearArea}          // { "2025": [{name:"January", value}, ...], "2026": [...] }
  selectedYears={areaYears}
  showPercentage={showPercentage}
  defaultType="area"
  embedded
  colors={compareColors && compareColors.length > 0 ? compareColors : undefined}
/>
```

The `"line"` view mode does the identical thing with `defaultType="line"`.
In both cases `embedded` means `RankedDataWidget`'s own `WidgetHeader` /
`WidgetFooter` supply all the chrome (title, view-mode switcher, stats
row) — `ComparisonChart` contributes only the plot itself, so the two
never show duplicate titles or duplicate Bar/Area/Line controls.

<!-- screenshot: ComparisonChart-bar -->

<!-- screenshot: ComparisonChart-area -->

<!-- screenshot: ComparisonChart-line -->
