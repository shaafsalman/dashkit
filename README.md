# chart-kit

Standalone React chart component library, extracted from an internal dashboard project so it can be reused across other projects. Tailwind-based styling, no app-specific coupling.

## Structure

- `src/lib/charts/` — general-purpose chart cards (Recharts + inline SVG): `RibbonStackChart`, `DualLineChart`, `StackedBarChart`, `FunnelChart`, `NetworkGraphChart`, `DonutChart`, `RadarChart`, gauges, etc. See [`src/lib/charts/README.md`](src/lib/charts/README.md) for the full component list and usage examples.
- `src/lib/echarts/` — ECharts-based tiles (`EChart`, `BentoTile`, `DeltaPill`) with a shared theme.
- `src/widgets/` — `RankedDataWidget`, a multi-view ranked-data card (list / vertical bar / pie / area / line views) with shared `WidgetHeader` / `WidgetFooter` chrome.
- `src/ComparisonChart.jsx`, `src/KpiCard.jsx`, `src/LoadingState.jsx` — supporting standalone components.

## Install

Copy the `src/` contents into your project, or add this repo as a dependency (git URL / npm link). Peer dependency: `react` + `react-dom` ^18. Chart-specific dependencies (`recharts`, `chart.js`, `react-chartjs-2`, `chartjs-plugin-datalabels`, `echarts`, `echarts-for-react`, `lucide-react`) are listed in `package.json`.

## Usage

```jsx
import { DualLineChart, RankedDataWidget, ComparisonChart } from "chart-kit";
```

Every component is also exported individually from its own file if you only want to pull in a subset.

## Design language

Sharp corners (no `rounded-*` except circular legend dots/avatars), `'Space Grotesk'` for labels/titles, `'JetBrains Mono'` for numeric ticks/values, flat gray-family layering for card chrome (no translucent `rgba()`/`backdrop-blur` washes).
