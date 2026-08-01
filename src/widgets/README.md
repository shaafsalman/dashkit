# `widgets` — RankedDataWidget

A multi-view "ranked data" card: give it an array of `{ name, value }`-shaped items and a title, and it renders a self-contained widget with a header (title, year nav, metric picker), a body that can switch between six chart renderings of the same data, and a footer (stats cards, view-mode switcher, sort controls). This is the component callers import and use directly.

```jsx
import { RankedDataWidget } from "chart-kit/widgets";
```

Everything else in this folder — `WidgetHeader.jsx`, `WidgetFooter.jsx`, `HorizontalBarView.jsx`, `VerticalBarView.jsx`, `PieChartView.jsx`, `AreaChartView.jsx`, `LineChartView.jsx`, `HoverTooltip.jsx`, `CustomTooltip.jsx` — are **internal view components `RankedDataWidget` composes** based on the selected `viewMode`. They're exported from `index.js` for advanced/standalone use, but normal usage never imports them directly.

`dataUtils.js` (value/label formatting helpers), `useContainerDensity.js` (a `ResizeObserver`-based hook that measures the widget's own rendered width — not the viewport — to pick `"sm" | "md" | "lg"` chrome density) and `colorConfig.js` (color palettes) are plain utility modules the components above import; they aren't part of the public surface.

## Files

| File | Role |
|---|---|
| `RankedDataWidget.jsx` | **Primary export.** Owns all state (selected view, metric, year, compare mode, sort), computes shared derived data (sorted items, max value, stats), and renders the chosen internal view inside `WidgetHeader`/`WidgetFooter`. |
| `WidgetHeader.jsx` | Title, `HeaderIcon`, year prev/next nav, metric-selector pills, expand/collapse button. Also hosts two portal slots (`chartYearToggleRef`, for a chart view's own year toggle) that individual views render into instead of floating over the plot. |
| `WidgetFooter.jsx` | Stat cards (Sum/Average/Highest, or per-metric in compare mode), the view-mode segmented switcher, the Compare toggle, sort controls, and a centered legend portal slot (`chartLegendRef`). |
| `HorizontalBarView.jsx` | Renders `viewMode="horizontal"` — the ranked list rows. |
| `VerticalBarView.jsx` | Renders `viewMode="vertical"` — Recharts `BarChart`, including all the year/compare/combined grouping logic. |
| `PieChartView.jsx` | Renders `viewMode="pie"` — a hand-drawn SVG donut + legend panel. |
| `AreaChartView.jsx` | Recharts `AreaChart` used by `viewMode="area"` in its multi-metric compare branch. |
| `LineChartView.jsx` | Chart.js/canvas line chart used by `viewMode="line"` in its multi-metric compare branch. |
| `HoverTooltip.jsx` | Shared flat-card hover tooltip used by the Recharts-based views. |
| `CustomTooltip.jsx` | A second, mostly-inert Recharts tooltip component (its value/percentage row is commented out in source — it currently renders only the row label and a color dot). |
| `dataUtils.js` | `formatValue`/`formatLabel` (K/M-suffix number formatting) and an unused-by-the-widget `calculateStats` helper. |
| `useContainerDensity.js` | The container-query-width hook described above. |
| `colorConfig.js` | `colors` + `chartPalettes.multiPalette` (30 colors) + `chartPalettes.headerCards`. **Note:** this is a separate file from `lib/geo/colorConfig.js` — the two are not shared, and their `multiPalette` arrays differ slightly (this one's 3rd entry is `colors.yellow`; the geo one's is `colors.seaBlue`). |

## `viewMode` — verified against source

There is no single always-controlled `viewMode` prop. Instead:

- **`defaultViewMode`** (default `"horizontal"`) — which view is selected initially.
- **`availableViewModes`** (default `["horizontal", "vertical", "pie", "area", "line", "dualline"]`) — which view-mode buttons appear in the footer's switcher for the user to click between. The user changes the live view themselves via that switcher; the widget owns `viewMode` as internal state from there.

The full set of view-mode strings the code recognizes (in `RankedDataWidget.jsx`'s `filteredViewModes` allowlist) is:

```
"horizontal" | "vertical" | "pie" | "funnel" | "area" | "line" | "dualline"
```

`"funnel"` is **opt-in only** — it's excluded from the default `availableViewModes` and must be added explicitly. It also disappears automatically whenever `metrics.length > 1`, along with `"area"`, because those two views can only display one series and would otherwise silently drop every metric but the selected one. The safe-for-multi-metric subset the code enforces is `["horizontal", "vertical", "line", "dualline", "pie"]`.

| `viewMode` | Renders | Best for |
|---|---|---|
| `horizontal` | `HorizontalBarView` — a scrollable ranked list: rank #, optional keyword-matched icon, label, value, share %, and a horizontal bar per row. | Many ranked items in limited height — the default, list-style view. Rows auto-group consecutive same-month entries from different years into a compact stacked block. |
| `vertical` | `VerticalBarView` — Recharts `BarChart`. Auto-detects monthly names (`"Jan-25"`) and multiple years in the data to add a year toggle/grouping on its own. | Month-by-month trends, or comparing a handful of categories side by side. Also the view compare-mode multi-metric bars render in (grouped/stacked per metric). |
| `pie` | `PieChartView` — a flat SVG donut with a value-driven legend panel (list or hover tooltip shows the %). | Share-of-whole with a small number of slices — the legend panel scrolls but the disc itself reads best with roughly ≤6 slices before colors start repeating meaningfully (the palette has 30 entries, cycled by index, so more slices than that reuse colors). |
| `area` | Single metric: the shared `ComparisonChart` component (also used standalone elsewhere in the app), opened on its "area" tab — same trend chart, not a lookalike. Multi-metric compare mode: the local Recharts `AreaChartView` instead (one area per metric; `ComparisonChart`'s "N years" model doesn't fit multiple metrics). | A trend line with fill, using the same comparison-chart rendering as the standalone `ComparisonChart` wherever it appears elsewhere in the dashboard. |
| `line` | Same split as `area`: single metric → `ComparisonChart`'s "line" tab; multi-metric compare mode → the local Chart.js-based `LineChartView`. | Same trend use case as `area`, without the fill. |
| `dualline` | The shared `lib/charts` `DualLineChart`. Single metric: renders it as a **before/after year pair** (e.g. last year vs. this year) with a cursor readout and an expandable detail table. Compare mode (multiple metrics): renders **one line per metric** on the same axis instead of one line per year. | A two-series trend comparison — either one metric across two years, or (in compare mode) two-plus metrics against each other over the same period. |
| `funnel` *(opt-in)* | The shared `lib/charts` `FunnelChart`, fed the ranked items as stages, shaded in a single-hue orange ramp. Suppresses the widget's own expand button (the funnel has its own detail affordance). | Sequential/stage-based ranked data (conversion-style funnels). Must be added to `availableViewModes` explicitly and is dropped automatically for multi-metric data. |

<!-- screenshot: RankedDataWidget-list -->
<!-- screenshot: RankedDataWidget-vertical -->
<!-- screenshot: RankedDataWidget-pie -->
<!-- screenshot: RankedDataWidget-line -->

## `compareMode` / multi-metric data

`metrics` is an array of `{ key, label, getItemValue: (item) => number, skipCustomMax?: boolean }`. The default is a single implicit metric reading `item.value`:

```js
metrics = [{ key: "default", label: "Default", getItemValue: (item) => item.value }]
```

- With exactly one metric, the header shows no metric picker and every view renders that one series.
- With **more than one** metric, the header shows underlined metric-selector pills, and (if `showComparable` is true) the footer shows a "Compare" toggle button. Toggling it into `compareMode` switches from "one selected metric at a time" to **all metrics rendered together** as a multi-series chart (stacked/grouped bars in `vertical`, multiple areas/lines, one line per metric in `dualline`, a stacked total in `pie`'s selected-metric readout, etc.) — see the `viewMode` table above for exactly how each view handles it.
- `compareMode` can also start `true` by default via `defaultComparable` or `defaultCompare`, or automatically whenever `metrics.length > 1 && relative_percentage === "external"`.
- `showCompareFooter` controls whether the per-metric stat cards still render in the footer while in compare mode.
- `relative_percentage` (`"relative" | "group_total" | "external" | "conventional_scale"`) controls how `VerticalBarView` computes the little percentage sub-label under each compare-mode bar; `external_sums` supplies the reference totals for the `"external"` mode.

## Year-over-year support

Two independent mechanisms exist:

1. **`enableYearNavigation`** + `availableYears` + `currentYear` + `onYearChange` + `yearData` — a fully caller-driven year switch. When enabled, the header shows prev/next arrows; changing year swaps the entire underlying item set via `yearData[year][dataType]`, calling `onYearChange`.
2. **Auto-detected multi-year data** — if a single `items`/`allItems` array already contains multiple years of monthly-named entries (`"Jan-25"`, `"Jan 2025"`, etc.), `RankedDataWidget` detects it (`detectMultipleYearsFromItems` / a looser trailing-year regex fallback) and exposes a `hasMultiYearData` flag that unlocks the footer's Compare toggle even outside the `metrics.length > 1` case — each view (`vertical`, `pie`, `line`, `area`, `dualline`) then builds its own internal year toggle/legend from that same data, portaled into the header/footer slots rather than floating over the plot.

## Theming / colors

- **`barColor`** (default `"#10B981"`) — the single accent used for default (non-compare, single-metric) rows/bars/lines across `HorizontalBarView`, `VerticalBarView`, `ComparisonChart`, `LineChartView`, and as `DualLineChart`'s current-year color/theme accent.
- **`colorPalette`** (default `["#10B981", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B"]`) — consumed directly by `LineChartView`'s compare-mode (multi-metric) dataset colors.
- **`compareColors`** (optional array) — the color source for `VerticalBarView`'s compare/year/combined-mode bars and legend swatches, and for `dualline`'s compare-mode line colors. Falls back to `VerticalBarView`'s own built-in ~30-color default array if omitted (bars), or to `colorPalette` if omitted (dualline).
- `RankedDataWidget` also computes a memoized **`MULTI_COLORS`** from `chartPalettes.multiPalette` (this folder's `colorConfig.js`, falling back to `colorPalette` if unavailable) and passes it to `VerticalBarView` as a `colorPalette` prop — **note:** `VerticalBarView`'s own prop list does not currently destructure a `colorPalette` prop, so this particular value is passed but not read; `compareColors` (above) is what actually drives its bar colors.
- **`PieChartView` ignores every color prop** — it always uses its own hardcoded, locally-defined 30-color array (near-identical to, but not imported from, `colorConfig.js`'s `multiPalette`), indexed by each item's position in the full (unfiltered) item list.

## Other notable props

`items` / `allItems` (the latter is used for stats/max-value calculations when it's a superset of the displayed `items`), `title`, `dataType`, `renderItemContent` (fully overrides list-row rendering), `initialItemsToShow` (default 50, capped at 8 on mobile), `headerIcon`, `enableSorting`, `numbered_ranking`, `itemIcon` / `showItemIcons` (override or disable the list view's keyword-matched row icons), `filterZeroValues`, `verticalInverse`, `decimal`, `showPercentage`, `showDollar`, `showFooter`, `total`, `isLoading` (shows a shape-matched skeleton per view), `defaultMetricsCollapsed`, `customMaxValue`, `preserveNaturalOrder`.

`height` (default `"h-[60vh]"`) sets the widget's container height — but only while the viewport is **wider** than 768px (`isNarrow` gate, width-only). On a narrow/mobile-width viewport the widget always forces `h-[75vh]` regardless of what `height` is set to. A separate `isMobile` flag (viewport height ≤800px **or** width ≤768px) drives compact styling (smaller fonts, tighter item limits) independently of that height override. Clicking the header's expand icon opens a full-size copy in a centered modal (`max-w-[1100px] h-[80vh]`) via a portal, while the original tile keeps its place in the page grid.

## Usage

```jsx
import { RankedDataWidget } from "chart-kit/widgets";
import { TrendingUp } from "lucide-react";

const routeItems = [
  { name: "Mogadishu – Nairobi", value: 18400 },
  { name: "Mogadishu – Dubai", value: 9200 },
  { name: "Hargeisa – Jeddah", value: 5100 },
  { name: "Entebbe – Mogadishu", value: 3300 },
  { name: "Garowe – Nairobi", value: 2100 },
];

function TopRoutesCard() {
  return (
    <RankedDataWidget
      items={routeItems}
      title="Top Routes by Passengers"
      headerIcon={TrendingUp}
      defaultViewMode="horizontal"
      availableViewModes={["horizontal", "vertical", "pie", "line"]}
      barColor="#10B981"
      numbered_ranking
      height="h-[420px]"
    />
  );
}
```

Two-metric compare example:

```jsx
<RankedDataWidget
  items={monthlyItems} // [{ name: "Jan-25", revenue: 120000, cost: 84000 }, ...]
  title="Revenue vs. Cost"
  metrics={[
    { key: "revenue", label: "Revenue", getItemValue: (item) => item.revenue },
    { key: "cost", label: "Cost", getItemValue: (item) => item.cost },
  ]}
  defaultViewMode="vertical"
  availableViewModes={["vertical", "line", "dualline"]}
  showComparable
  defaultComparable
  compareColors={["#0f766e", "#dc2626"]}
/>
```
