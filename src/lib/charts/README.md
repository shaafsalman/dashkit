# Chart Kit — `lib/charts`

Self-contained, **React-only** chart components (no charting library except
Recharts for two of them; everything else is inline SVG — no icon package
dependency inside the drawing code). Every component shares the same chrome
(card frame, header, controls, legend, tooltip, expand modal) and the same
theme resolver, so they read as one visual system regardless of which one you
drop into a layout.

## Shared chrome: `ChartCard` (`chrome.jsx`)

`ChartCard` is the glassmorphism wrapper every chart in this folder renders
into. It owns:

- **Header** — icon + title (auto-shrinking `FitText`, never truncates) +
  subtitle, with a controls cluster on the right (`controls`/`onControl`, see
  below) and an optional expand button (`expandable`).
- **Headline** — an optional big number block (`headline={{ label, value,
  change, legend }}`). `floatingHeader={true}` instead floats the headline
  top-right over the plot and reveals the controls cluster on hover — used by
  charts that want the number to feel embedded in the chart, not stacked
  above it (`DualLineChart`, `AreaTrendChart`, `StackedBarChart`,
  `RibbonStackChart`, `FunnelChart`).
- **Body** — your chart content. Children can be a plain node, or a
  render-prop function `({ detailed }) => node` — `detailed` is `true` only
  when rendering inside the expand modal, so a chart can show extra value
  labels / a data table there without cluttering the compact card view.
- **Expand modal** (`expandable={true}`) — a portal-rendered lightbox that
  re-renders the same body with `detailed: true`.
- **Footer** — usually a `Legend` (see below); `footerDetailed` overrides it
  for the expand modal specifically.
- **`controls`** — an array of control descriptors rendered as header pills:
  `{ type: "filter"|"sort"|"more"|"moreV"|"dropdown"|"period", ...}`, each
  optionally carrying `options`/`items`/`menu` (opens a popover), `value`,
  `onChange`/`onToggle`/`onClick`. Every component in this folder ships a
  sensible default `controls` array wired to its own internal state
  (sort/filter/period toggles) — pass your own `controls` array to fully
  replace it, or `onControl(type, control)` as a catch-all for controls
  without their own handler.

Common **size** values (`size` prop, body height in px — width is always
fluid/`100%`):

| size | height (px) |
|---|---|
| `xs` | 124 |
| `s` | 168 |
| `m` | 216 |
| `l` | 290 |
| `xl` | 372 |
| `fill` | stretches to whatever the parent (e.g. a CSS grid/bento cell) gives it, instead of a fixed pixel height |

Not every component in this file actually adapts its internal drawing to
`fill` — see each component's "Size" note below. Components built for `fill`
measure their real container with `useMeasuredBox` (`FunnelChart`,
`AreaTrendChart`, `NetworkGraphChart`, `DonutChart`, `DualLineChart`,
`StackedBarChart`); the rest use a fixed internal SVG `viewBox` that simply
scales/letterboxes to fit whatever box it's given.

`compact={true}` is a separate override from `size` — it forces the smallest
control density (icon-only pills, tightest padding) for callers who know a
`fill` chart is sitting in a visually small slot even though `size` alone
can't express that. Only some components expose it (see per-component props).

Other exports from `chrome.jsx` you can use directly when composing a custom
card: `HeaderControls`, `Legend`, `ChangePill`, `Stat`, `Icons`,
`ChartTooltip`, `SIZES`, `ICON_SIZE`.

## Shared theming: `resolveTheme` (`theme.js`)

Every component resolves its `theme` prop through `resolveTheme(theme,
fallbackMode)`:

- `theme="light"` / `theme="dark"` — one of the two full presets
  (`LIGHT_THEME`/`DARK_THEME`).
- `theme={{ ... }}` — a **partial override object**. Structural fields
  (`radius`, `pad`, `backdrop`, `accent`, `series`, `className`, etc.) apply
  as given. Color-scheme fields (`surface`, `border`, `track`, `grid`,
  `text`, `control`) are **ignored** and always come from the app's live
  dark-mode state instead — every call site in this codebase was written
  before dark mode existed and hardcodes light-mode color tokens, so honoring
  those here would silently re-break dark mode on toggle.
- `theme={{ solid: { ... } }}` — **the escape hatch.** `solid` is the one
  exception to the rule above: a card meant to look the same regardless of
  light/dark mode (a branded gradient KPI tile, a permanently-styled "solid"
  variant) puts its `surface`/`border`/`text`/`control`/`grid`/`track`
  overrides inside `solid`, and those apply unconditionally on top of the
  resolved light/dark base instead of being stripped.
- `theme` omitted / not an object — falls back to the live light/dark preset.

Several components also pass their own `DEFAULT_THEME` as the `theme` arg's
fallback (e.g. `HexHealthChart`, `GaugeCard`, `BarcodeMeterCard`,
`StackedBarChart`, `EarningsBarChart`) purely to seed structural defaults
(`radius`, `pad`, a starting `surface`/`accent`) — these are still passed
through `resolveTheme`, so their color fields get the same live-dark-mode
treatment as everything else.

---

## Trend / line charts

### DualLineChart

<!-- screenshot: DualLineChart -->

A Recharts area+line combo: one primary series draws as a gradient-filled
area plus a solid line with an emphasized endpoint dot; every other series
draws as a dashed line only. Also does 2-series before/after comparisons and
N-series "compare mode".

**When to use it**

- A revenue/metric trend where you want a headline total *and* the shape of
  the trend in one card (`multiSeries` off, `singleSeries` off → before/after
  legacy shape, or `singleSeries` for just the trend line).
- Comparing 2+ named series over the same time axis at once (`multiSeries`)
  — e.g. current vs. target, or 3+ regions' performance.
- Not for a single ranked snapshot with no time axis — use `BarRankingChart`
  or `DonutChart` instead. Not for a big single number + shape with no
  comparison series — `AreaTrendChart` is lighter for that.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Revenue"` |
| `valueLabel` | string | `"Total Revenue"` |
| `total` | number | `620873` |
| `changePct` | number \| null | `null` |
| `labels` | string[] | 6 months |
| `before` / `after` | `{ label, color, values[] }` | sample series |
| `multiSeries` | `{key,label,color,values,dashed?}[]` \| null | `null` — replaces `before`/`after` entirely; last entry gets the area fill |
| `singleSeries` | bool | `false` — renders only the primary (`after`) series |
| `formatValue` | `(n)=>string` | `$#,###` |
| `showHeader` / `showBorder` | bool | `true` |
| `legendPortal` | DOM node \| null | `null` — renders the legend into another element instead of the card header |
| `size` | `"s"\|"m"\|"l"\|"xl"\|"fill"` | `"l"` |
| `expandable` | bool | `false` |

Note: `cursorIndex` (default `3`) is destructured but not referenced
anywhere in the render — currently a dead prop.

**Size:** explicitly `fill`-aware (`fillMode = size === "fill"` sizes the
plot via flex instead of a fixed height). Reads best as a wide rectangle —
`l`/`xl` or `fill` in a wide bento cell.

```jsx
import { DualLineChart } from "@/lib/charts";

<DualLineChart
  title="Revenue"
  total={620873}
  changePct={12.4}
  labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
  multiSeries={[
    { key: "target", label: "Target", color: "#94a3b8", values: [300, 320, 310, 340, 330, 360] },
    { key: "actual", label: "Actual", color: "#56e0a6", values: [280, 340, 300, 380, 410, 460] },
  ]}
  size="l"
  expandable
/>
```

### AreaTrendChart

<!-- screenshot: AreaTrendChart -->

A single smooth gradient-filled area line with an emphasized endpoint dot and
a mouse-following crosshair tooltip.

**When to use it**

- One metric over time where the shape + a headline total/delta is the whole
  story (active users, sessions, a single KPI trend).
- A "Monthly / Quarterly" re-bucketing toggle is built in for free.
- Not for comparing two or more series — use `DualLineChart`. Not for
  category comparisons with no time axis — use `BarRankingChart`.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Active Users"` |
| `total` | number | `24580` |
| `changePct` | number | `12.4` |
| `valueLabel` | string | `"This month"` |
| `labels` / `values` | string[] / number[] | 6 weeks |
| `accent` | color | theme accent |
| `formatValue` | `(n)=>string` | locale number |
| `size` | `"s"\|"m"\|"l"\|"xl"\|"fill"` | `"l"` |
| `radius` | number | theme radius |
| `expandable` | bool | `false` |

`bucketize(labels, values, period)` is also exported standalone for reuse by
other (e.g. ECharts-based) panels that want the same Monthly/Quarterly logic.

**Size:** explicitly `fill`-aware (measures its container and caps plot
height at 60% of it, leaving breathing room below). Wide rectangle at fixed
sizes; works well filling a tall bento slot too since it re-measures.

```jsx
import { AreaTrendChart } from "@/lib/charts";

<AreaTrendChart
  title="Active Users"
  total={24580}
  changePct={12.4}
  labels={["W1", "W2", "W3", "W4", "W5", "W6"]}
  values={[120, 180, 150, 240, 210, 320]}
  size="l"
/>
```

---

## Bar charts

### RibbonStackChart

<!-- screenshot: RibbonStackChart -->

Bottom-aligned stacked-segment bars per period, connected across periods by
smooth gradient ribbons per series — one engine that powers both a dark
"Sales Overview" style card and (via the `BalanceStatsChart` preset) a light
axis'd "Balance Statistics" card.

**When to use it**

- Multi-category totals across a handful of periods where you also want to
  see how each category's *share* flows from one period to the next (the
  ribbons are the point — plain `StackedBarChart` doesn't have them).
- Works with sparse data too — a period can omit its bar (`bar: false`) and
  the ribbon passes straight through the gap (see `BalanceStatsChart`'s
  Feb/Apr).
- Not for many periods (12+) — the ribbons get visually busy; use
  `StackedBarChart` or `DualLineChart` instead for long time series.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Sales Overview"` |
| `series` | `{key,label,color}[]` bottom→top | 5-entry sample |
| `data` | `{label,total?,values,bar?}[]` | 3 months |
| `total` / `changePct` / `changeValue` | number | headline figures |
| `headlinePosition` | `"top"\|"bottom"\|"top-right"` | `"top"` |
| `formatValue` / `currency` / `decimals` | formatting | `$`, 2 decimals |
| `showAxis` / `yTicks` / `yMax` / `axisFormat` | left $-axis + gridlines | `showAxis=false` |
| `showLegend` / `showBarLabels` | bool | `true` / `!showAxis` |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"l"` |
| `topPad` / `padX` | number | internal SVG headroom overrides |

Note: `changeValue` is destructured and documented in the file's own
docstring, but nothing in the render actually reads it — only `total` and
`changePct` reach the JSX. Currently a dead prop.

**Size:** no dynamic `fill` handling — fixed internal `viewBox` sized from
the data (column count × gap). Reads as a wide rectangle; the component's own
doc comment specifies `s`/`m`/`l`/`xl` only (default `l`).

```jsx
import { RibbonStackChart, RIBBON_PALETTE } from "@/lib/charts";

<RibbonStackChart
  title="Sales Overview"
  total={9257.51}
  changePct={15.8}
  series={[
    { key: "china", label: "China", color: RIBBON_PALETTE[0] },
    { key: "ue", label: "UE", color: RIBBON_PALETTE[1] },
    { key: "usa", label: "USA", color: RIBBON_PALETTE[2] },
  ]}
  data={[
    { label: "Oct", values: { china: 1016, ue: 568, usa: 359 } },
    { label: "Nov", values: { china: 640, ue: 480, usa: 300 } },
    { label: "Dec", values: { china: 1800, ue: 900, usa: 700 } },
  ]}
  size="l"
/>
```

### BalanceStatsChart

<!-- screenshot: BalanceStatsChart -->

A thin preset wrapper over `RibbonStackChart`: light theme, `$`-axis with
dashed gridlines, bottom-left "Total Balance" headline, and bars only on
alternate periods (the ribbon flows through the gaps).

**When to use it**

- Whenever you want the "axis + ribbon" look out of the box without
  re-specifying `theme`, `showAxis`, `yTicks`, etc. — a balance/holdings
  trend over sparse checkpoints.
- Not for a dense monthly series or anything that needs `RibbonStackChart`'s
  dark/headline-value styling — use `RibbonStackChart` directly for that.

**Key props**

Only `size` (default `"l"`) is declared explicitly — everything else is
`...props`, spread onto `RibbonStackChart` *after* this component's own
hardcoded defaults (`series`, `data`, `total={50847}`, `theme="light"`,
`showAxis`, `yTicks={[0,25000,50000,75000,100000]}`, `showLegend={false}`,
`width={760}`, etc.), so any `RibbonStackChart` prop can be passed in to
override a specific default.

**Size:** same as `RibbonStackChart` — fixed viewBox, no `fill`. Wide
rectangle, default `l`.

```jsx
import { BalanceStatsChart } from "@/lib/charts";

<BalanceStatsChart size="l" total={50847} />
```

### StackedBarChart

<!-- screenshot: StackedBarChart -->

Stacked (or grouped, side-by-side) rounded bars per period with a subtle
diagonal hatch texture over each segment, dashed gridlines, and a hover
tooltip.

**When to use it**

- Team/category performance across many periods (defaults to 12 months) where
  segments should stack to a visible total — `grouped={false}` (default).
- Year-over-year style side-by-side comparison bars per category —
  `grouped={true}`.
- Not for only 2–3 periods where you also want to show flow between them —
  `RibbonStackChart` communicates that better. Not for a single series — use
  a simpler bar chart like `EarningsBarChart`.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Team Performance"` |
| `series` | `{key,label,color}[]` | 5-entry sample |
| `data` | `{label,values}[]` | 12 months |
| `grouped` | bool | `false` |
| `headerStatLabel` / `headerStatValue` / `headerStatChange` | floating-header KPI | `"Avg. Score"` / `"90%"` |
| `showLegend` | bool | `true` |
| `axisFormat` / `valueFormat` | `(n)=>string` | plain / `${n}%` |
| `heightScale` | number | `1` — shrinks plot height only, viewBox width stays full |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"l"` |
| `emptyLabel` | string | `"No data"` — shown when `data`/`series` is empty instead of a NaN-broken plot |

**Size:** measures its container (`useMeasuredBox`) to keep bar/text
proportions stable at any width, but plot **height** still comes from
`SIZES[size]` (falls back to `SIZES.m` for an unrecognized value like
`"fill"`) — so it doesn't truly grow to fill a `fill` slot's height, only its
width. Best as a wide rectangle at a fixed size (`l`/`xl`).

```jsx
import { StackedBarChart } from "@/lib/charts";

<StackedBarChart
  title="Team Performance"
  series={[
    { key: "sales", label: "Sales", color: "#b3531f" },
    { key: "marketing", label: "Marketing", color: "#e0701f" },
  ]}
  data={[
    { label: "Jan", values: { sales: 80, marketing: 65 } },
    { label: "Feb", values: { sales: 92, marketing: 70 } },
  ]}
  size="l"
/>
```

### EarningsBarChart

<!-- screenshot: EarningsBarChart -->

A Recharts bar chart with a period switcher (Week/Last week/Month), a
reference line, headline earned/projected stats, and a special "today" bar
that splits into a solid "earned so far" segment plus a darker capped
"projected gap" segment.

**When to use it**

- Earnings/throughput-style dashboards where "today" (or the current, partial
  period) needs to visually read differently from completed periods.
- Not for a chart that needs a card `title`/`icon` in the header — this is
  the **only** component in the folder that doesn't accept a `title` prop at
  all; it renders an `eyebrow` label inside the body instead and the
  `ChartCard` header goes untitled.

**Key props**

| prop | type | default |
|---|---|---|
| `eyebrow` | string | `"OVERVIEW"` — small label above the headline (not `title`) |
| `periods` | `{value,label,primary,secondary,bars}[]` | 3-entry sample (week/last/month) |
| `refLine` | `{value,label}` | `{720, "$ 720"}` |
| `yMax` | number | `2000` |
| `accent` / `accentBright` / `accentDark` | color | blue triad |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"m"` |
| `expandable` | bool | `false` |

Note: `yTicks` is destructured but never used anywhere in the render — only
`yMax` drives the Y domain. Currently a dead prop.

**Size:** fixed chart height from `SIZES[size]` (no `fill` handling); no
`title`/`icon` header means it reads compact — good as a small-to-medium
card, `s`/`m`.

```jsx
import { EarningsBarChart } from "@/lib/charts";

<EarningsBarChart eyebrow="OVERVIEW" yMax={2000} size="m" />
```

### WaterfallChart

<!-- screenshot: WaterfallChart -->

A running-total chart: increase/decrease bars step from a starting "total"
bar to an ending "total" bar, connected by dashed step-lines, each bar
labeled with its signed delta.

**When to use it**

- Cash flow, budget bridges, or any "start → contributions/deductions → end"
  narrative where the running total matters as much as each delta.
- Not for plain category comparison (no running-total semantics needed) —
  use `BarRankingChart` or `StackedBarChart` instead.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Cash Flow"` |
| `items` | `{label,value,type:"inc"\|"dec"\|"total"}[]` | 5-entry sample |
| `incColor` / `decColor` | color | `#34d399` / `#f43f5e` |
| `formatValue` | `(n)=>string` | locale number |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"m"` |

No `subtitle`, `icon`/`iconColor`, or `expandable` prop — this one doesn't
expose an expand-modal toggle even though its body function already branches
on `detailed` internally (dead code path unless a future caller re-adds
`expandable`).

**Size:** fixed `viewBox` (640×300), no `fill` handling. Wide rectangle,
default `m`.

```jsx
import { WaterfallChart } from "@/lib/charts";

<WaterfallChart
  title="Cash Flow"
  items={[
    { label: "Start", value: 20, type: "total" },
    { label: "Sales", value: 38, type: "inc" },
    { label: "Refunds", value: 12, type: "dec" },
    { label: "Net", value: 46, type: "total" },
  ]}
  size="m"
/>
```

---

## Radial / gauge charts

### HexHealthChart

<!-- screenshot: HexHealthChart -->

A central hexagon (the overall score) ringed by up to five trapezoidal
petals, one per metric — each petal's length scales with its value.

**When to use it**

- An "overall health/score" rollup composed of exactly 3–5 sub-metrics
  (adoption, engagement, retention, etc.) where you want one glanceable shape
  instead of a bar list.
- Not for more than 5 metrics (only the first 5 are rendered — `.slice(0,
  5)`) — use `RadarChart` (which handles any number of axes) instead. Not for
  a single 0–100 value — use `ProgressGauge`, `GaugeCard`, or
  `SpeedometerChart`.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Account Health"` |
| `overall` / `overallLabel` | number / string | `89` / `"Overall Health"` |
| `metrics` | `{label,value,color?}[]`, max 5 used | 5-entry sample |
| `suffix` | string | `""` |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"m"` |

No `subtitle` or `expandable` prop exposed. Theme defaults to dark
(`DEFAULT_THEME = { base: "dark", ... }`) unless overridden.

**Size:** fixed square `viewBox` (360×320), no `fill` handling. Reads best
as a small-to-medium square card.

```jsx
import { HexHealthChart } from "@/lib/charts";

<HexHealthChart
  title="Account Health"
  overall={89}
  metrics={[
    { label: "Adoption", value: 92 },
    { label: "Engagement", value: 88 },
    { label: "Retention", value: 85 },
  ]}
  size="m"
/>
```

### ProgressGauge

<!-- screenshot: ProgressGauge -->

A thick rounded horseshoe arc split into proportional colored segments (the
last can be diagonally hatched), with a centered big percentage and a round
knob pinned to the end of the first (progress) segment.

**When to use it**

- Project/task completion broken into a few weighted states (Completed / In
  Progress / Pending) where the segments should visually sum to the whole
  arc.
- Not for a single continuous 0–100 metric with no sub-segments — use
  `GaugeCard` or `SpeedometerChart` instead, which are built for that.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Project Progress"` |
| `value` | number | `41` — the big centered % |
| `valueLabel` | string | `"Project Ended"` |
| `segments` | `{label,value,color?,hatch?}[]` | 3-entry sample (Completed/In Progress/Pending) |
| `start` / `end` | degrees | `210` / `-30` |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"m"` |

No `expandable` prop exposed — and unlike `WaterfallChart`, this one isn't
even reachable via a future prop add without also touching the `ChartCard`
call, since `expandable` is never passed through at all.

**Size:** fixed `viewBox` (360×270), no `fill`. Small-to-medium square-ish
card, default `m`.

```jsx
import { ProgressGauge } from "@/lib/charts";

<ProgressGauge
  title="Project Progress"
  value={41}
  segments={[
    { label: "Completed", value: 58, color: "#3aa564" },
    { label: "In Progress", value: 12, color: "#1f6b3b" },
    { label: "Pending", value: 30, color: "#cfd4d8", hatch: true },
  ]}
  size="m"
/>
```

### GaugeCard

<!-- screenshot: GaugeCard -->

Two KPI stats stacked above a semicircle gradient gauge (arc + knob), with a
big italic center percentage.

**When to use it**

- A single "sync/completion %" metric that deserves two supporting KPIs above
  it (e.g. "Auto-Processed" / "Pending Check" counts) in a compact card.
- Not for multiple segments within the gauge — use `ProgressGauge`. Not for
  a period-switchable value — use `SpeedometerChart`, which has a built-in
  period control.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Synced Records"` |
| `stats` | `[{value,label}, {value,label}]` | 2-entry sample |
| `value` | number (0–100) | `80.49` |
| `valueText` | string | falls back to `value` |
| `from` / `to` | gradient colors | `#c8f24a` → `#2bd45f` |
| `knobColor` | color | `#22c55e` |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"m"` |

No `subtitle`, `iconColor`, or `expandable` prop.

**Size:** fixed `viewBox` (320×232), no `fill`. Small-square-to-medium card.

```jsx
import { GaugeCard } from "@/lib/charts";

<GaugeCard
  title="Synced Records"
  value={80.49}
  stats={[
    { value: "16.4K", label: "Auto-Processed" },
    { value: "20K", label: "Pending Check" },
  ]}
  size="m"
/>
```

### BarcodeMeterCard

<!-- screenshot: BarcodeMeterCard -->

A big percentage, two KPI stats, and a stylized "barcode" meter — a row of
ticks where the ticks up to the current progress are lit with the accent
color and the rest are dimmed.

**When to use it**

- An anomaly-rate / detection-rate style card where a literal progress bar
  feels too plain but a full gauge is overkill — the barcode motif reads as a
  distinct, denser meter.
- Comes with a built-in Weekly/Monthly/Quarterly period control that swaps
  the whole dataset (`percentText`, `progress`, KPI stats) via an internal
  `PERIODS` map — pass explicit `progress`/`percentText`/`stats` to bypass it
  entirely.
- Not for a value that needs an axis or segments — use `ProgressGauge` or
  `GaugeCard`.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Anomalies"` |
| `percentText` | string | period-driven (e.g. `"15,12"`) |
| `stats` | `[{value,label}, {value,label}]` | period-driven |
| `progress` | number 0–1 | period-driven |
| `accent` | color | `#c2f53b` |
| `ticks` | number | `46` |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"s"` — the only component defaulting to `"s"` |

No `subtitle`, `iconColor`, or `expandable` prop.

**Size:** fixed meter width (520 viewBox units scaled to 100%), no `fill`.
Designed as a small, compact card — default `s`.

```jsx
import { BarcodeMeterCard } from "@/lib/charts";

<BarcodeMeterCard title="Anomalies" size="s" />
```

### RadialBarsChart

<!-- screenshot: RadialBarsChart -->

Concentric progress rings, one per metric (0–100), nested from the outside
in — like several `GaugeCard` arcs stacked as rings around a shared center.

**When to use it**

- 2–4 related 0–100 goals/metrics you want to compare at a glance as nested
  rings (Revenue/Signups/Retention style goal tracking).
- Only the first 4 items render (`.slice(0, 4)`) — for more metrics use
  `RadarChart` or `BarRankingChart` instead.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Goals"` |
| `items` | `{label,value,color?}[]`, max 4 used | 3-entry sample |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"m"` |
| `expandable` | bool | `false` |

No `icon`/`iconColor` prop.

**Size:** fixed square `viewBox` (240×240), no `fill`. Small-square card.

```jsx
import { RadialBarsChart } from "@/lib/charts";

<RadialBarsChart
  title="Goals"
  items={[
    { label: "Revenue", value: 82 },
    { label: "Signups", value: 64 },
    { label: "Retention", value: 91 },
  ]}
  size="m"
/>
```

### SpeedometerChart

<!-- screenshot: SpeedometerChart -->

A classic 180° needle gauge: gradient arc, needle + knob pointing to the
current value, big centered number.

**When to use it**

- A single throughput/capacity metric that benefits from the literal
  "speedometer" reading, optionally switchable across a small set of periods
  via the built-in `periods` control (Today/This Week/This Month by
  default).
- Behavioral note: passing an explicit `value` prop switches the component to
  **controlled** mode and drops the built-in period control entirely unless
  you also pass your own `controls` — leave `value` unset to use the
  uncontrolled `periods` selector instead.
- Not for a value composed of sub-segments — use `ProgressGauge`.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Throughput"` |
| `value` | number \| undefined | uncontrolled (driven by `periods`) when omitted |
| `periods` | `{label,value}[]` | 3-entry sample |
| `max` / `min` | number | `100` / `0` |
| `unit` | string | `"%"` |
| `from` / `to` | gradient colors | `#56e0a6` → `#2bd45f` |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"m"` |

**Size:** fixed `viewBox` (320×200 — short and wide), no `fill`. Best as a
small-to-medium, short-and-wide card.

```jsx
import { SpeedometerChart } from "@/lib/charts";

<SpeedometerChart
  title="Throughput"
  periods={[
    { label: "Today", value: 68 },
    { label: "This Week", value: 74 },
    { label: "This Month", value: 81 },
  ]}
  size="m"
/>
```

### DonutChart

<!-- screenshot: DonutChart -->

A segmented ring with rounded caps and a centered total. Adapts its own
layout: in a landscape (wide-short) box it switches to ring-left /
scrollable-vertical-legend-right instead of the default stacked
ring-then-horizontal-legend, so a wide bento slot doesn't leave the ring's
width dead-empty.

**When to use it**

- Part-of-whole breakdowns with a natural "total" to headline (traffic
  source split, revenue by category).
- Not for more than ~6 segments — labels and the ring both get cramped; use
  `BarRankingChart` for a longer ranked list instead.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Distribution"` |
| `segments` | `{label,value,color?}[]` | 4-entry sample |
| `total` | number \| string | sum of active segments |
| `centerLabel` | string | `"Total"` |
| `thickness` | number | `26` |
| `formatValue` | `(n)=>string` | locale number |
| `size` | `"s"\|"m"\|"l"\|"xl"\|"fill"` | `"m"` |
| `radius` | number | theme radius |
| `compact` (passed as `compact`, internally renamed `compactCard`) | bool | `false` |
| `expandable` | bool | `false` |

**Size:** genuinely adaptive — measures its box (`useMeasuredBox`) and
switches ring/legend layout at a landscape threshold, so it works well at any
size including `fill`. Otherwise reads best as a small-to-medium square.

```jsx
import { DonutChart } from "@/lib/charts";

<DonutChart
  title="Distribution"
  segments={[
    { label: "Direct", value: 42 },
    { label: "Referral", value: 28 },
    { label: "Organic", value: 18 },
    { label: "Social", value: 12 },
  ]}
  size="m"
/>
```

### RadarChart

<!-- screenshot: RadarChart -->

A spider/radar chart: a filled polygon over N metric axes (default 6), each
plotted 0..`max` from a shared center, with concentric reference rings.

**When to use it**

- Profiling something across many (5+) qualitative-feeling dimensions at once
  (skill/service ratings) where the *shape* of the polygon is the point.
- Sorting axes (via the built-in sort control) reorders vertices around the
  ring, which changes the polygon's shape, not just a label order — useful
  for spotting the biggest gaps, but be aware it's not purely cosmetic.
- Not for 2–4 metrics — `RadialBarsChart` or `HexHealthChart` read better at
  that count.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Skill Profile"` |
| `metrics` | `{label,value}[]` | 6-entry sample |
| `max` | number | `100` |
| `accent` | color | theme accent |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"m"` |
| `expandable` | bool | `false` |

No `subtitle`, `icon`/`iconColor` prop.

**Size:** fixed square `viewBox` (320×320), no `fill`. Small-to-medium
square card (a radar chart's shape is inherently square).

```jsx
import { RadarChart } from "@/lib/charts";

<RadarChart
  title="Skill Profile"
  metrics={[
    { label: "Speed", value: 80 },
    { label: "Comfort", value: 65 },
    { label: "Safety", value: 92 },
    { label: "Service", value: 74 },
  ]}
  size="m"
/>
```

---

## Ranking / table charts

### BarRankingChart

<!-- screenshot: BarRankingChart -->

A plain ranked list — no SVG at all — of rows: rank number, label, an inline
proportion bar, and the value, sorted by a built-in Highest/Lowest/A–Z
control.

**When to use it**

- A top-N leaderboard (top routes, top products, top agents) where reading
  exact ranks and values matters more than a chart shape.
- `topN` caps the compact-card view (default 6); the expand modal
  (`detailed`) shows every row, and the row list scrolls internally
  (`overflowY: auto`) rather than growing the card.
- Not for part-of-whole framing — use `DonutChart`. Not for a trend over
  time — use `AreaTrendChart`/`DualLineChart`.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Top Routes"` |
| `items` | `{label,value,color?}[]` | 5-entry sample |
| `maxValue` | number | max of `items` |
| `topN` | number | `6` |
| `formatValue` | `(n)=>string` | locale number |
| `size` | `"s"\|"m"\|"l"\|"xl"\|"fill"` | `"m"` |
| `radius` | number | theme radius |
| `compact` | bool | `false` |
| `expandable` | bool | `false` |

**Size:** no SVG/viewBox at all — it's a scrollable flex column of rows, so
it naturally fills whatever height it's given. Genuinely works at any `size`
including `fill`; reads well as a tall or wide-short card.

```jsx
import { BarRankingChart } from "@/lib/charts";

<BarRankingChart
  title="Top Routes"
  items={[
    { label: "MGQ–NBO", value: 6700 },
    { label: "MGQ–JED", value: 5200 },
    { label: "HGA–DXB", value: 3900 },
  ]}
  topN={6}
  size="m"
/>
```

### ResponseRatePanels

<!-- screenshot: ResponseRatePanels -->

"Rising panel" bars: each item is a soft downward-gradient fill capped by a
solid colored contour line (flat, then sloping down to a lower shelf), with
dotted vertical guide lines and a large percentage printed above each panel.

**When to use it**

- A small set (2–4) of response/satisfaction-rate style percentages where
  each one deserves a large, individually-styled panel rather than a plain
  bar — this is a deliberately more editorial/illustrative treatment than
  `StackedBarChart` or `BarRankingChart`.
- Not for more than a handful of items (each panel needs real width for its
  big number) and not for anything that needs to stack/compare sub-segments
  — use `StackedBarChart` for that.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Customer Satisfaction"` |
| `items` | `{value,caption,color?}[]` | 3-entry sample |
| `size` | `"s"\|"m"\|"l"\|"xl"` | `"m"` |
| `expandable` | bool | `false` |

No `icon`/`iconColor`/`subtitle` prop.

**Size:** the SVG uses `preserveAspectRatio="none"`, so it always stretches
non-uniformly to fill whatever box it's given (rather than letterboxing) —
usable at any size, but extreme aspect ratios can visually distort the panel
shapes. Reads best as a medium-to-large, tallish card.

```jsx
import { ResponseRatePanels } from "@/lib/charts";

<ResponseRatePanels
  title="Customer Satisfaction"
  items={[
    { value: 42, caption: "Response rate", color: "#1f2937" },
    { value: 62, caption: "Response rate", color: "#e0653a" },
    { value: 96, caption: "Response rate", color: "#7a2c18" },
  ]}
  size="m"
/>
```

### StatTiles

<!-- screenshot: StatTiles -->

A responsive CSS grid of small KPI tiles, each with a label, a big value, a
`ChangePill` delta, and its own inline sparkline SVG.

**When to use it**

- A row of 3–6 headline KPIs (Revenue/Orders/Refunds/Sessions) that each want
  their own trend sparkline, rather than one big chart — this is the only
  component in the folder built as a *tile grid*, not a single plot.
- Not for a single metric's detailed trend — use `AreaTrendChart` for that
  one metric instead.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Overview"` |
| `tiles` | `{label,value,change,spark:number[],color?}[]` | 4-entry sample |
| `width` | number | `560` |

No `size`, `icon`/`iconColor`, `subtitle`, `radius`, or `expandable` prop —
`size` isn't passed to `ChartCard` at all, so it always renders at
`ChartCard`'s own default (`m`).

**Size:** the tile grid itself is `repeat(auto-fit, minmax(150px, 1fr))`, so
it reflows its own column count with card width regardless of `size` (which
only affects the outer card's fixed body height via `ChartCard`'s default).
Best as a wide rectangle card.

```jsx
import { StatTiles } from "@/lib/charts";

<StatTiles
  title="Overview"
  tiles={[
    { label: "Revenue", value: "$48.2K", change: 12.4, spark: [10, 14, 12, 18, 16, 22, 26] },
    { label: "Orders", value: "1,284", change: 5.1, spark: [20, 18, 22, 19, 24, 23, 28] },
  ]}
/>
```

### HeatmapGrid

<!-- screenshot: HeatmapGrid -->

A calendar/activity-style heatmap: a CSS grid of small square cells
(`columns` × `rows`), each cell's opacity encoding its intensity, with a
"Less → More" swatch legend in the footer.

**When to use it**

- Activity-over-time grids (commit history, daily active users) where the
  point is spotting a pattern of intensity across many small cells, not
  reading exact values.
- Not for a handful of categories where exact values matter — use
  `BarRankingChart` or `StackedBarChart` instead.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Activity"` |
| `columns` / `rows` | number | `26` / `7` |
| `values` | number[] (row-major, length `columns*rows`) | generated sample pattern |
| `max` | number | max of `values` |
| `accent` | color | theme accent |
| `width` | number | `560` |

No `size`, `icon`/`subtitle`, or `expandable` prop — `size` isn't passed to
`ChartCard`, so it always renders at the default `m` body height; the grid
itself uses `aspectRatio: "1/1"` per cell and `gridAutoRows: "1fr"`, so cells
reflow to whatever width/height the card ends up with.

**Size:** no `size` control exposed; effectively fixed at `ChartCard`'s
default height. Reads best as a wide rectangle (many columns).

```jsx
import { HeatmapGrid } from "@/lib/charts";

<HeatmapGrid title="Activity" columns={26} rows={7} />
```

---

## Network / flow charts

### FunnelChart

<!-- screenshot: FunnelChart -->

The classic solid tapering funnel: one trapezoid per stage, each stage's
bottom edge equals the next stage's top edge, with the stage label (top-left
corner), % of top (top-right corner), and value (bottom-center) printed
inside each band. Uses a compressed width scale so even a stage that's a few
percent of the top stays wide enough to hold its own label.

**When to use it**

- Conversion/drop-off sequences (visits → signups → trials → paid) where
  both the shape and the exact retained-% / lost-vs-prior numbers matter —
  hover any band for a tooltip with all three.
- Not for a flow with branching/multiple paths — use `NetworkGraphChart`
  instead, which is built for arbitrary node/edge topology.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Conversion"` |
| `stages` | `{label,value,color?}[]` | 4-entry sample |
| `formatValue` | `(n)=>string` | locale number |
| `headline` | `{label?,value,change?}` | defaults to the top stage's value |
| `size` | `"s"\|"m"\|"l"\|"xl"\|"fill"` | `"m"` |
| `radius` | number | theme radius |
| `compact` | bool | `false` |
| `showBandValues` | bool | `true` — suppress when a host already shows the number elsewhere |
| `showHeader` | bool | `true` |
| `expandable` | bool | `false` |

**Size:** explicitly no fixed `viewBox` — always measures its real container
(`useMeasuredBox`, both in the normal card and in the expand modal) and
renders at that exact size. Genuinely `fill`-safe; also reads well as a
tallish card since bands stack vertically.

```jsx
import { FunnelChart } from "@/lib/charts";

<FunnelChart
  title="Conversion"
  stages={[
    { label: "Visits", value: 12000 },
    { label: "Signups", value: 6400 },
    { label: "Trials", value: 3100 },
    { label: "Paid", value: 1280 },
  ]}
  size="m"
/>
```

### NetworkGraphChart

<!-- screenshot: NetworkGraphChart -->

A hub-and-spoke node-link graph (nodes on an ellipse around an optional
detected hub), paired with a ranked scrollable rail of every node's volume
and four live stat tiles above — click or hover any node/edge/rail-row to
focus and highlight its connections everywhere at once.

**When to use it**

- Route/connectivity networks (airports, service dependencies) where both
  the topology (who connects to whom, and how heavily) and a ranked numeric
  breakdown are useful side by side.
- Automatically detects a "hub" node only when one node truly connects to
  at least half the others (or pass `primaryHub` explicitly) — otherwise no
  node is drawn as a hub and all nodes sit on a uniform ellipse.
- Not for a simple stage-to-stage flow with no branching — use `FunnelChart`.
  Not for fewer than ~5 nodes — the rail + tiles + graph layout wants some
  real data to be worth the space it takes.

**Key props**

| prop | type | default |
|---|---|---|
| `title` | string | `"Network Connectivity"` |
| `nodes` | string[] | `[]` |
| `edges` | `{from,to,value}[]` | `[]` |
| `nodeTotals` | `{[code]:number}` | derived from `edges` if omitted |
| `activeAirports` / `routeDirections` / `busiestRoute` | override text for the default (non-focused) stat tiles | derived from data |
| `primaryHub` | string | auto-detected |
| `formatValue` | `(n)=>string` | locale number |
| `width` | string \| number | `"100%"` |
| `size` | `"s"\|"m"\|"l"\|"xl"\|"fill"` | **`"fill"`** — the only component in the folder defaulting to `fill` |
| `expandable` | bool | **`true`** — the only component defaulting `expandable` to `true` (every other chart defaults to `false`) |
| `radius` | number | theme radius |
| `compact` | bool | `false` |

**Size:** explicitly no fixed `viewBox` (`useMeasuredBox` on the graph pane).
Needs real room for the tiles row + graph + rail together — best as a large,
wide `fill` card, not a small square.

```jsx
import { NetworkGraphChart } from "@/lib/charts";

<NetworkGraphChart
  title="Network Connectivity"
  nodes={["MGQ", "NBO", "JED", "DXB", "JIB"]}
  edges={[
    { from: "MGQ", to: "NBO", value: 6700 },
    { from: "MGQ", to: "JED", value: 5200 },
    { from: "MGQ", to: "DXB", value: 3900 },
  ]}
  size="fill"
/>
```
