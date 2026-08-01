# `lib/dashboard`

Thirteen summary-card components for building multi-section dashboard pages, plus `sectionTheme.js` — a small color system that ties them (and anything in `lib/charts`) to a page-wide "one hue per section" layout.

Everything here is imported from the package root:

```jsx
import {
  GradientStatCard, FleetSnapshotCard, TrendBarcodeCard, ActivityCalendar,
  ProgressTrackList, RadialBladeChart, PercentGradientCard, MetricsTable,
  WeekdayBars, RankedLocationBoard, CompositionBar, TargetBarcodeChart, RankedList,
  SECTIONS, whiteTheme, solidTheme, sectionRowHeight, GRADIENTS,
} from "lib/dashboard";
```

Two families of component live side by side here:

- **`theme`-driven cards** (everything except the three below) are wrapped in `ChartCard` from `../charts`. They take a `theme` object (resolved via `resolveTheme(theme, "light")`, so it's safe to omit) plus `title` / `icon` / `iconColor`, render an internal `Empty` state when their data prop is empty, and are always mounted `expandable` with no extra header controls — that's baked into each component, not something you configure from the outside.
- **Gradient tiles** — `GradientStatCard`, `FleetSnapshotCard`, `PercentGradientCard` — are plain `<div>`s, not `ChartCard`s. No title bar, no expand affordance. They take a `gradient` key (one of `GRADIENTS`: `blue`, `emerald`, `sky`, `violet`, `amber`) instead of a `theme` object. Since the lookup falls back to the raw string (`GRADIENTS[gradient] || gradient`), you can also hand one of these a literal CSS gradient — including one built from `SECTIONS[key].from`/`.to` — to lock a gradient tile to the same section hue as the `solidTheme()` cards around it.

Several components were extracted out of an internal aviation-ops app and still ship with aviation-flavored default titles, units, and (in a couple of cases) hardcoded icons/labels baked into their JSX rather than exposed as props. Each entry below calls that out and says exactly what's swappable via props vs. what requires editing the source.

## 1. `sectionTheme.js` — one hue per section

`sectionTheme.js` is the pattern for a dashboard page built out of multiple labeled sections (e.g. "Revenue & Traffic", "Fleet & Fuel", "Cost & Cash") where every chart *inside* a section commits to the **same accent color**, instead of each card picking its own. The page reads as blocks of color rather than a scatter of unrelated per-chart accents, and a reader can tell which section a chart belongs to before reading its title.

```js
export const SECTIONS = {
  violet:  { accent: "#7C3AED", from: "#4C1D95", to: "#8B5CF6" },
  aqua:    { accent: "#0EA5E9", from: "#075985", to: "#22D3EE" },
  amber:   { accent: "#F59E0B", from: "#B45309", to: "#FBBF24" },
  emerald: { accent: "#059669", from: "#065F46", to: "#10B981" },
  blue:    { accent: "#3B82F6", from: "#1D4ED8", to: "#60A5FA" },
  rose:    { accent: "#E11D48", from: "#881337", to: "#FB7185" },
  slate:   { accent: "#3F3F46", from: "#131316", to: "#52525B" }, // neutral cool-down / default
};
```

`accent` is the mid-tone used on white cards; `from`/`to` are the same hue's dark→bright ends, used as a fixed gradient on solid cards.

**`whiteTheme(key)`** — a white card themed to one section's accent. Pass its output as the `theme` prop of *any* `ChartCard`-based component in this file or in `lib/charts`:

```js
export const whiteTheme = (key) => ({
  base: "light",
  accent: SECTIONS[key].accent,
  series: [SECTIONS[key].accent, "#94a3b8", SECTIONS[key].to, "#cbd5e1"],
  surface: "#ffffff",
  backdrop: "none",
  radius: 0,
  border: "#dfe6e3",
  shadow: "0 1px 2px rgba(11,41,27,0.06), 0 8px 20px -14px rgba(11,41,27,0.22)",
});
```

**`solidTheme(key)`** — a permanently-colored gradient card via `lib/charts/theme.js`'s `solid` escape hatch, so it looks identical in light and dark mode (the same contract a branded stat tile already follows). White text/grid/track/control ink on top of the section's own `from → to` gradient:

```js
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
```

**The "solid vs. white card" contrast pattern:** the *within-section* contrast comes from mixing `solidTheme` and `whiteTheme` cards that share one hue — never from mixing hues. Pick one or two "hero" cards per section to render as `solidTheme`, leave the rest `whiteTheme`. A typical three-card violet section:

```jsx
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
  {/* hero card — solid violet gradient */}
  <RankedList theme={solidTheme("violet")} solid invertColor={SECTIONS.violet.accent}
    title="Top Routes" items={routes} formatValue={(v) => `${v.toLocaleString()} pax`} />

  {/* the other two stay white, same violet accent */}
  <TargetBarcodeChart theme={whiteTheme("violet")} title="Capacity" months={months} target={80} />
  <CompositionBar theme={whiteTheme("violet")} title="Cost Base" items={costLines} />
</div>
```

**`sectionRowHeight(rows, chromePx, gapPx)`** — one harmonized row height for the whole page. `100vh` minus the page's fixed chrome (topbar + header + sticky KPI strip + a section's own label row — budget ~300px unless your chrome measures differently), split across however many stacked rows one section needs, minus the gaps between them:

```js
export const sectionRowHeight = (rows = 2, chromePx = 300, gapPx = 12) =>
  `calc((100vh - ${chromePx}px) / ${rows} - ${((rows - 1) * gapPx) / rows}px)`;
```

```jsx
// A one-row section and a two-row section both come out to a whole number
// of "pages" — no row in either section is a different height than a row
// in the other.
<section style={{ height: sectionRowHeight(1) }}>{/* single row of cards */}</section>
<section style={{ height: `calc(${sectionRowHeight(2)} * 2 + 12px)` }}>
  <div style={{ height: sectionRowHeight(2) }}>{/* row 1 */}</div>
  <div style={{ height: sectionRowHeight(2) }}>{/* row 2 */}</div>
</section>
```

Signatures above (`SECTIONS` keys, `whiteTheme`/`solidTheme`/`sectionRowHeight` parameters and return shapes) were verified directly against `sectionTheme.js` source, not inferred from usage.

## 2. Components

### GradientStatCard
<!-- screenshot: GradientStatCard -->

A solid-gradient KPI tile with the headline `value` always in one of exactly two places (floated top-right, or big-and-centered) — deliberately never a third layout, so nothing on the card can float and overlap. Optionally adds a bottom row of small comparison `bars`, OR a composition mini-bar + legend (`breakdown`), OR a row of small stat `pills` along the bottom.

**When to use it:** a single headline metric on brand-colored real estate — with up to a few small bars (e.g. this-year-vs-last-year), a "what this number breaks into" composition strip, or small supporting stat pills underneath.

**Key props** (verified against the function signature):
| prop | default | notes |
|---|---|---|
| `gradient` | `"emerald"` | key into `GRADIENTS`, or any raw CSS `background` string |
| `label`, `value`, `caption` | — | header label, headline value, optional subtext |
| `icon` | — | rendered left of `label` |
| `bars` | `[]` | `{ label, value }[]`, small bottom bar comparison |
| `formatBarValue` | `compact` | formatter for bar values |
| `breakdown` | `[]` | `{ label, value, color? }[]`, renders as a segmented bar + legend instead of `bars` |
| `formatBreakdownValue` | `compact` | formatter for breakdown values |
| `pills` | `[]` | `{ label, value }[]`, small tiles pinned to the bottom |

**Size/aspect:** a plain `<div style="height:100%">` measured via `useMeasuredBox({ width: 320, height: 240 })` — fills whatever box you give it, but reads best as a small-to-medium tile (roughly square to modestly wide), the size of one KPI card in a grid.

```jsx
<GradientStatCard
  gradient="violet"
  label="Net Revenue"
  value="$482K"
  caption="Last 30 days"
  breakdown={[
    { label: "Net revenue", value: 482000 },
    { label: "Costs", value: 191000 },
  ]}
/>
```

### FleetSnapshotCard
<!-- screenshot: FleetSnapshotCard -->

A purpose-built gradient overview tile: a floating count top-right, a real bar chart of a monthly series in the middle (rounded gradient bars with per-bar hover), and a row of lucide-iconed stat tiles at the bottom.

**When to use it:** a fleet/inventory-style overview where you want one big count, a 12-month utilization trend, and 2–3 supporting stats on one tile. Note: unlike `GradientStatCard`, the "aircraft" unit label under the count, the `Plane` icon, and the "Monthly utilisation" title are hardcoded in the component's JSX, not props — this card is ready to use as-is for a fleet/aviation dashboard, but repurposing the copy/icon for another domain means editing the source, not passing different props.

**Key props:**
| prop | default | notes |
|---|---|---|
| `gradient` | `"violet"` | key into `GRADIENTS`, or raw CSS gradient |
| `aircraft` | `0` | the floating headline count (labeled "aircraft" in the UI) |
| `utilisation` | `[]` | `{ label, value }[]`, monthly bar series with hover |
| `stats` | `[]` | `{ icon, label, value }[]`, bottom stat tiles |

**Size/aspect:** same `useMeasuredBox({ width: 320, height: 240 })` pattern as `GradientStatCard` — small-to-medium tile, fills its box.

```jsx
<FleetSnapshotCard
  gradient="violet"
  aircraft={14}
  utilisation={[
    { label: "Jan", value: 62 }, { label: "Feb", value: 71 }, { label: "Mar", value: 68 },
  ]}
  stats={[
    { icon: <Wrench size={13} />, label: "In maintenance", value: 2 },
    { icon: <Clock size={13} />, label: "Avg block hrs", value: "6.4h" },
  ]}
/>
```

### TrendBarcodeCard
<!-- screenshot: TrendBarcodeCard -->

A smooth Catmull-Rom spline drawn over 12 monthly vertical "barcode" strips. Strips split into three visual states — earlier months faded, the most recent `currentWindow` months solid, and months with no data yet greyed out — so the eye reads "trend so far this quarter" at a glance.

**When to use it:** a 12-month trend where the recent window matters more than the full year, and you want a headline number plus a couple of footer stats alongside it.

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `title`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `months` | `[]` | `{ month \| name, value }[]` — month can be a name or a 1–12 number |
| `headlineValue`, `headlineLabel` | — | optional headline readout in the card header |
| `stats` | `[]` | `{ icon?, label, value }[]` footer stats |
| `formatValue` | `compact` | tooltip/value formatter |
| `currentWindow` | `3` | how many trailing months render "solid" instead of "past" |

**Size/aspect:** generic, domain-neutral. Measured via `useMeasuredBox({ width: 700, height: 190 })` — designed as a **wide rectangle** (12 months need horizontal room); works inside `ChartCard`'s `size="fill"` so it stretches to whatever box you give it.

```jsx
<TrendBarcodeCard
  theme={whiteTheme("aqua")}
  title="Monthly Signups"
  months={[{ month: "Jan", value: 1200 }, { month: "Feb", value: 1450 }]}
  headlineValue="14.2K"
  headlineLabel="last 12 months"
  currentWindow={3}
  stats={[{ label: "vs prior quarter", value: "+8.4%" }]}
/>
```

### ActivityCalendar
<!-- screenshot: ActivityCalendar -->

A real month-grid calendar — one cell per day, shaded by that day's value, month-by-month stepper, and a footer that swaps between "hovered day detail" and a month summary (busiest day, daily average). Dates are parsed numerically (never `new Date(string)`), so a UTC-vs-local offset can't shift a day.

**When to use it:** any daily time series you want browsed a month at a time — activity counts, orders, incidents, logins — rather than plotted as a continuous line.

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `title` | `"Flight Calendar"` | fully overridable via prop |
| `days` | `[]` | `{ date: "YYYY-MM-DD", value }[]` |
| `unitLabel` | `"flights"` | fully overridable via prop, shown in the headline and footer |

**Size/aspect:** needs room for a 7-column × up to 6-row grid plus a header/footer — best in a **square-ish to tall** box; too short and rows get cramped.

```jsx
<ActivityCalendar
  theme={whiteTheme("emerald")}
  title="Order Calendar"
  unitLabel="orders"
  days={[{ date: "2026-07-01", value: 42 }, { date: "2026-07-02", value: 55 }]}
/>
```

### ProgressTrackList
<!-- screenshot: ProgressTrackList -->

One horizontal "runway" per row: an SVG aircraft glyph slides to a position along the track equal to that row's share of the top row's value, over threshold marks and a solid/dashed centerline. Rows are sorted descending and stretch to fill the card's height when there are few of them, and scroll when there are many.

**When to use it:** ranking a set of named entities by a utilization-style metric where the "how far along" visual (not just a number) is the point — this is themed here around fleet tail numbers / flight hours (the aircraft SVG glyph and "runway" track styling are baked into the component, not swappable via props), so it's ready to use as-is for an aviation utilization board; for another domain, treat the glyph/track chrome as inherited defaults to fork if you need a different icon.

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `title` | `"Fleet Utilisation by Tail"` | overridable via prop |
| `tails` | `[]` | `{ name, value }[]` |

**Size/aspect:** a **tall list** — rows use `flex: 1 1 0` so a short list stretches to fill a tall card instead of clumping at the top; a long list scrolls under a sticky column header.

```jsx
<ProgressTrackList
  theme={whiteTheme("blue")}
  title="Fleet Utilisation by Tail"
  tails={[{ name: "5Y-ABC", value: 812 }, { name: "5Y-XYZ", value: 640 }]}
/>
```

### RadialBladeChart
<!-- screenshot: RadialBladeChart -->

Twelve radial "blades," one per calendar month, blade length encoding a computed per-flight rate — with one dashed reference ring for the yearly average and a hub readout that swaps to the hovered month.

**When to use it:** a 12-month efficiency/rate metric you want as a circular "wheel" rather than a linear bar chart — this one is themed and hard-wired around aviation fuel burn specifically: it computes `perFlight = fuel / flights` internally from each month's `{ fuel, flights }` pair (not a generic `value`), so the input shape itself — not just the icon/labels — is fuel-burn-specific. Swap the `unit` prop for a different unit label, but reusing this for a different per-something-else rate means adapting the `fuel`/`flights` fields it reads.

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `title` | `"Fuel Burn per Flight"` | overridable via prop |
| `months` | `[]` | `{ month, fuel, flights }[]` — per-flight rate is derived as `fuel / flights` |
| `unit` | `"L"` | unit label shown under the hub value |

**Size/aspect:** SVG `viewBox` is `500×420` (deliberately wider than tall to leave room for month labels beside the wheel), centered with `preserveAspectRatio="xMidYMid meet"` inside whatever box you give it — best in a **roughly square** cell; very short or very narrow boxes waste the spare space the wide viewBox was built to use.

```jsx
<RadialBladeChart
  theme={whiteTheme("amber")}
  months={[{ month: "Jan", fuel: 48000, flights: 210 }, { month: "Feb", fuel: 51000, flights: 225 }]}
  unit="L"
/>
```

### PercentGradientCard
<!-- screenshot: PercentGradientCard -->

A gradient tile built around one big percentage: the average by default, or — hover a bar in the monthly barcode strip along the bottom — that specific month's value instead. Bar height reads directly off the 0–100 scale so values in a tight range (e.g. 72–85%) don't get stretched into looking identical.

**When to use it:** a single 0–100% metric (load factor, utilization rate, completion rate) with a 12-month strip for context underneath. Note: the hover sub-label reads `"{value}% · LOAD FACTOR"` — that trailing "LOAD FACTOR" text is a hardcoded string in the component, not prop-driven; swap it in source for a different percentage metric, or just rely on `caption` for the non-hovered state (which is a normal prop).

**Key props:**
| prop | default | notes |
|---|---|---|
| `gradient` | `"amber"` | key into `GRADIENTS`, or raw CSS gradient |
| `label` | — | small header label |
| `percent` | — | the default (non-hovered) headline percentage |
| `caption` | — | shown under the headline when nothing is hovered and there's no monthly data hovered |
| `months` | `[]` | `{ name \| month, value }[]`, rendered as the bottom barcode strip (only shown when >1 month) |
| `formatTick` | `` (v) => `${Math.round(v)}%` `` | formatter used in the hover sub-label |

**Size/aspect:** plain `<div style="height:100%">`, no measured/fixed box — a small-to-medium **square-ish tile**, similar footprint to `GradientStatCard`.

```jsx
<PercentGradientCard
  gradient="amber"
  label="On-Time Performance"
  percent={87}
  caption="Rolling 12-month average"
  months={[{ name: "Jan", value: 82 }, { name: "Feb", value: 89 }]}
/>
```

### MetricsTable
<!-- screenshot: MetricsTable -->

A compact data table — top 7 rows sorted descending by the first metric, each row with a plain value column plus one column rendered as an inline mini progress-bar-with-percentage (on-time performance vs. an implicit 75% good/bad threshold).

**When to use it:** a short leaderboard-style table where most columns are plain numbers but one benefits from an at-a-glance bar. As shipped this is entirely aviation-ops shaped: the column headers ("Station", "Flights", "Revenue", "On-time") and the row shape (`{ name, flights, revenue, otp }`) are hardcoded in the component, not prop-driven — reusing it for a different dataset means editing the source's column labels and field names, not just passing different props.

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `title` | `"Station Performance"` | overridable via prop |
| `stations` | `[]` | `{ name, flights, revenue, otp }[]`; rows with `name` falsy/"unknown" or `flights <= 0` are dropped |
| `formatMoney` | `` (n) => `$${compact(n)}` `` | formatter for the revenue column |

**Size/aspect:** a **wide rectangle** (four columns), scrolls vertically inside its box past 7 rows... actually caps at 7 rows so it rarely needs to scroll; width matters more than height.

```jsx
<MetricsTable
  theme={whiteTheme("slate")}
  stations={[
    { name: "MGQ", flights: 182, revenue: 940000, otp: 88 },
    { name: "HGA", flights: 96, revenue: 410000, otp: 71 },
  ]}
/>
```

### WeekdayBars
<!-- screenshot: WeekdayBars -->

Seven bars, Monday through Sunday, each daily record bucketed by weekday and summed; every bar sits in a full-height track so busy and quiet days read against the same ceiling, with the busiest day picked out and named in the header.

**When to use it:** "what day of the week is busiest" for any daily series — orders, tickets, logins, flights.

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `title` | `"Weekly Flight Volume"` | overridable via prop |
| `days` | `[]` | `{ date: "YYYY-MM-DD", value }[]` |
| `unitLabel` | `"Flights"` | overridable via prop, shown in the header |

**Size/aspect:** generic and domain-neutral aside from its defaults. `ChartCard size="fill"` — a **wide rectangle** reads best (7 bars need horizontal room) but it stretches to whatever box it's given.

```jsx
<WeekdayBars
  theme={whiteTheme("rose")}
  title="Weekly Order Volume"
  unitLabel="Orders"
  days={[{ date: "2026-07-06", value: 240 }, { date: "2026-07-07", value: 310 }]}
/>
```

### RankedLocationBoard
<!-- screenshot: RankedLocationBoard -->

Parses `"ORIGIN-DEST"` route strings, sums values by destination code, then renders a ranked board: rank number, an airport-code "plate," city/country, a share rail, value, and share %.

**When to use it:** ranking traffic/volume by destination when your source data is already origin-destination route pairs. This one's data-shaping logic (not just labels) is route-specific: it splits each `name`/`route` string on `"-"` and takes the second segment as the destination code, so reusing it outside an airline-route context means feeding it strings in that same `"X-Y"` pair format.

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `title` | `"Top Destinations"` | overridable via prop |
| `routes` | `[]` | `{ name \| route: "MGQ-DXB", value \| passengers }[]` |
| `airportCountry` | `{}` | code → country name lookup |
| `airportName` | `{}` | code → city/display name lookup |

**Size/aspect:** a **tall list**, top 8 destinations, scrolls past that.

```jsx
<RankedLocationBoard
  theme={whiteTheme("aqua")}
  routes={[{ route: "MGQ-DXB", passengers: 4200 }, { route: "HGA-IST", passengers: 1800 }]}
  airportName={{ DXB: "Dubai", IST: "Istanbul" }}
  airportCountry={{ DXB: "UAE", IST: "Türkiye" }}
/>
```

### CompositionBar
<!-- screenshot: CompositionBar -->

A hero readout (the biggest line by default, or whatever's hovered) above a single segmented composition bar — top 5 items plus an "Other" bucket for the rest, so the bar always reconciles with the total the subtitle promises — with a full legend row underneath every segment.

**When to use it:** "what does this total break down into," generically — cost base, revenue by category, storage by type. Reasonably domain-neutral as shipped (`title` defaults to `"Cost Base"` but the shape/logic isn't hardcoded to any one field set beyond `{ name, value }`).

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `title` | `"Cost Base"` | overridable via prop |
| `items` | `[]` | `{ name, value }[]` — top 5 by value become their own segment, the rest collapse into "Other" |
| `formatMoney` | `` (n) => `$${compact(n)}` `` | formatter for the hero value and legend rows |
| `palette` | 6-color default (`#8B5CF6,#3B82F6,#F59E0B,#10B981,#06B6D4,#EC4899`) | override the per-segment color sequence |

**Size/aspect:** fills its box (`ChartCard size="fill"`); legend rows are spaced with `justify-content: space-evenly` up to 6 rows (5 + "Other") and scroll past that — works as a **small square tile** (just the hero + bar) up through a **tall** card with room for the full legend.

```jsx
<CompositionBar
  theme={whiteTheme("violet")}
  items={[
    { name: "Fuel", value: 210000 }, { name: "Crew", value: 140000 }, { name: "Maintenance", value: 88000 },
  ]}
/>
```

### TargetBarcodeChart
<!-- screenshot: TargetBarcodeChart -->

Twelve rounded, gradient-filled monthly bars against a dashed target threshold line — a diagonal hatch pattern fills the portion of any bar above target, so "how far past/short of target" reads at a glance, with a per-bar hover tooltip.

**When to use it:** any monthly metric evaluated against a fixed target/quota (capacity, load factor, quota attainment) — generic and domain-neutral as shipped. The component's own comment explicitly calls out that **it fills whatever box it's given (square, wide, or tall — no fixed aspect ratio baked in)**, with label font size and top-margin both derived from the actual measured per-bar width so labels never overlap or clip even in a narrow slot.

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `title` | `"Capacity"` | overridable via prop |
| `months` | `[]` | `{ month \| name, value }[]` |
| `target` | `75` | the dashed threshold line's value |
| `unit` | `"%"` | used by the default formatter |
| `formatValue` | `` (v) => `${Math.round(v)}${unit}` `` | value/tooltip formatter |

**Size/aspect:** measured via `useMeasuredBox({ width: 320, height: 200 })`, but explicitly designed to fill **any** box — square, wide, or tall.

```jsx
<TargetBarcodeChart
  theme={whiteTheme("emerald")}
  title="Capacity Utilization"
  months={[{ month: "Jan", value: 71 }, { month: "Feb", value: 84 }]}
  target={80}
  unit="%"
/>
```

### RankedList
<!-- screenshot: RankedList -->

The newest and most general component in this library: a ranked `{ label, value, prev? }[]` list — rank badge, name, a share rail, and the value on the right — generalized from the ranked-widget's own List view (`HorizontalBarView`) to any label/value data instead of one app's dataset shape.

**When to use it:** any top-N ranking — routes, products, customers, regions — where you either just need a clean ranked bar list, or (its standout feature) want to show the **same ranking compared against a prior period** in one view.

**Key props:**
| prop | default | notes |
|---|---|---|
| `theme`, `icon`, `iconColor` | — | standard `ChartCard` theming |
| `title`, `subtitle` | — | header text; the header also shows a headline = sum of the shown rows' `value` |
| `items` | `[]` | `{ label, value, prev? }[]` — top 8 by `value`, zero/negative values dropped |
| `formatValue` | identity | formatter applied to both `value` and `prev` |
| `solid` | `false` | see below |
| `invertColor` | — | see below |
| `prevLabel` | `"prev"` | text after the delta badge, e.g. `"▲ 12% vs prev"` |

**The 2-period comparison feature:** add a `prev` number to any item and the row automatically grows a second, dimmer "ghost" rail underneath the main share rail — both rails are drawn on the **same scale** (`max` is computed across both `value` and `prev` for every row), so the ghost rail literally shows where the value used to sit relative to where it is now. Alongside it you get:
- a `▲`/`▼` delta-percent line under the label: `▲ 12% vs prev` (computed as `(value - prev) / prev`, and `prevLabel` controls the trailing text)
- the prior value stacked in smaller, muted type directly under the current value on the right

This only activates if **at least one** item in the list has `prev != null` — mix rows with and without it freely; rows without `prev` just show the current-period rail and value.

```jsx
<RankedList
  theme={whiteTheme("blue")}
  title="Top Routes"
  subtitle="by passengers, last 30 days"
  items={[
    { label: "MGQ → DXB", value: 4200, prev: 3750 },
    { label: "MGQ → IST", value: 2100, prev: 2400 },
    { label: "HGA → JED", value: 1800 }, // no `prev` — renders as a single-rail row
  ]}
  formatValue={(v) => v.toLocaleString()}
  prevLabel="prior 30 days"
/>
```

**`solid` + `invertColor` — theming on a solid-gradient card:** when `RankedList` sits on a `solidTheme()` card, the theme's own `accent` is white (white-on-gradient ink). The row-hover interaction normally fills the row with `accent` and flips its text to white for contrast — on a solid card that would invert to white-on-white and disappear. Pass `solid` plus `invertColor` (the section's real hue, e.g. `SECTIONS.blue.accent`) so hover instead fills the row **white** and uses `invertColor` as the ink — legible either way the card is themed:

```jsx
<RankedList
  theme={solidTheme("blue")}
  solid
  invertColor={SECTIONS.blue.accent}
  title="Top Routes"
  items={routes}
/>
```

**Size/aspect:** `ChartCard size="fill"`, rows scroll past 8 — a **tall-to-medium rectangle**, similar footprint to `ProgressTrackList`/`RankedLocationBoard`.

---

## Note on the "old name" banner comments

Each file's own leading `/* ── NAME ── */` banner comment already reflects the current export name (`RadialBladeChart.jsx`'s own banner reads "RADIAL BLADE CHART", `ActivityCalendar.jsx`'s reads "ACTIVITY CALENDAR", etc. — verified directly against source). The old names (`FUEL FAN`, `FLIGHT CALENDAR`, `FLEET RUNWAY STRIPS`, `STATION TABLE`, `DESTINATION BOARD`, `COST BUBBLES`, `CAPACITY BARCODE`) only survive as trailing, orphaned "next section" comment blocks at the *end* of the *preceding* file in this directory — an artifact of how these files were split out of one larger source file — not inside the renamed component's own file. Nothing here needs a find-and-replace on a banner; it's already done. What *does* still carry the old domain (aviation ops) is sample content — default titles/units and, in a few components, hardcoded icons or field-shape assumptions — called out per-component above.
