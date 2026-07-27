# charts (standalone library)

Self-contained, **React-only** chart components (no chart library, no icon
package — inline SVG). Built to be lifted out into its own package / GitHub
repo with zero app coupling. The only peer dependency is `react`. Styling uses
Tailwind utility classes; if extracted, either keep Tailwind or replace the
`className` strings with plain CSS.

## Components

### `RibbonStackChart`

Bottom-aligned segmented ("pill") bars per period, connected by smooth gradient
ribbons per category. Dark card with header pills, headline value + delta, and a
bottom legend.

```jsx
import { RibbonStackChart, RIBBON_PALETTE } from "@/lib/charts";

<RibbonStackChart
  title="Sales Overview"
  total={9257.51}
  changePct={15.8}
  changeValue={143.5}
  series={[
    { key: "china",  label: "China",  color: "#3a2a8c" }, // bottom
    { key: "ue",     label: "UE",     color: "#6d5ae6" },
    { key: "usa",    label: "USA",    color: "#2f6bf5" },
    { key: "canada", label: "Canada", color: "#39a0f4" },
    { key: "other",  label: "Other",  color: "#56e0a6" }, // top
  ]}
  data={[
    { label: "Oct", total: 2988.20, values: { china: 1016, ue: 568, usa: 359, canada: 388, other: 657 } },
    { label: "Nov", total: 1765.09, values: { /* ... */ } },
    { label: "Dec", total: 4005.65, values: { /* ... */ } },
  ]}
/>
```

#### Props

| prop | type | default | notes |
|------|------|---------|-------|
| `title` | string | `"Sales Overview"` | card heading |
| `total` | number | — | big headline value |
| `changePct` | number | — | % delta; negative flips the arrow + color to red |
| `changeValue` | number | — | absolute delta |
| `series` | `{key,label,color}[]` | reference 5 | **bottom → top** stacking order |
| `data` | `{label,total?,values}[]` | reference | one entry per period; `total` optional (falls back to sum of `values`) |
| `formatValue` | `(n)=>string` | money | overrides headline + bar-label formatting |
| `currency` | string | `"$"` | prefix for the default formatter; pass `""` for counts |
| `decimals` | number | `2` | decimals for the default formatter |
| `onFilter` / `onSort` / `onMore` | `()=>void` | — | header-pill handlers (pills render regardless) |

If `formatValue` is omitted, values are formatted as `currency + #,###.##`.
For integer counts (passengers, cargo) pass `currency=""` and `decimals={0}`,
or your own `formatValue`.

`RIBBON_PALETTE` exports the brand colors (deep purple → teal) for building
series programmatically.
