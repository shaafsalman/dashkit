# dashkit

**dashkit** is a dashboard component kit extracted from a production
internal app: charts, ranked-data widgets, gradient/solid stat cards, a
themed-section system for multi-section dashboards, and a geographic route
map. Tailwind-based styling, no app-specific coupling — pull in as much or
as little as you need.

## At a glance

| directory | what's in it |
|---|---|
| [`src/lib/charts/`](src/lib/charts/README.md) | General-purpose chart cards (Recharts + inline SVG) — `RibbonStackChart`, `DualLineChart`, `StackedBarChart`, `FunnelChart`, `NetworkGraphChart`, `DonutChart`, `RadarChart`, gauges, and more. |
| [`src/lib/dashboard/`](src/lib/dashboard/README.md) | Gradient/solid stat cards (`GradientStatCard`, `FleetSnapshotCard`, `PercentGradientCard`, `TrendBarcodeCard`, …) plus `sectionTheme.js` — a themed-section color system for pages built from multiple labeled sections that each commit to one hue. |
| [`src/lib/geo/`](src/lib/geo/README.md) | `WorldMap` — a geographic route map (arcs between airports/cities on a world projection) with its data-processing helpers. |
| [`src/widgets/`](src/widgets/README.md) | `RankedDataWidget`, a multi-view ranked-data card (list / vertical bar / pie / area / line views) with shared `WidgetHeader` / `WidgetFooter` chrome. |
| [`src/ComparisonChart.jsx`](docs/comparison-chart.md) | Multi-year bar/area/line comparison chart, standalone or embedded inside another widget's card. |
| [`src/KpiCard.jsx` & `src/LoadingState.jsx`](docs/kpi-and-loading.md) | The app-wide KPI tile, plus shared `LoadingState`/`EmptyState`/`ErrorState` placeholders. |

## Install

Copy the `src/` contents into your project, or add this repo as a dependency
(git URL / npm link). Peer dependency: `react` + `react-dom` ^18.
Chart-specific dependencies (`recharts`, `chart.js`, `react-chartjs-2`,
`chartjs-plugin-datalabels`, `echarts`, `echarts-for-react`, `lucide-react`)
are listed in `package.json`.

## Usage

```jsx
import { DualLineChart, RankedDataWidget, ComparisonChart, KpiCard } from "dashkit";
```

Every component is also exported individually from its own file if you only
want to pull in a subset.

## Demo

**Live:** https://shaafsalman.github.io/dashkit/ — every component in this
kit, rendered with deterministic fake data, including the full dashboard
overview layout, the world map, and `RankedDataWidget`/`ComparisonChart`
shown across three container sizes.

To run it locally: see `/demo`, or `npm run demo` from the repo root.

## Design language

Sharp corners (no `rounded-*` except circular legend dots/avatars),
`'Space Grotesk'` for labels/titles, `'JetBrains Mono'` for numeric ticks/
values, flat gray-family layering for card chrome (no translucent `rgba()`/
`backdrop-blur` washes).
