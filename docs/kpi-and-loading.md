# KpiCard & LoadingState

Two small, app-wide supporting components — a KPI tile and a shared set of
pending/empty/error placeholders — meant to be used everywhere their
category of content appears rather than hand-rolled per page.

## KpiCard

`src/KpiCard.jsx`

The app-wide KPI tile: a solid gradient-fill card with white text and a
white icon, used for headline metrics. Use one `KpiCard` per metric in a
**KPI strip** — a row of headline numbers pinned at the top of a dashboard
page (e.g. "Total Revenue", "Active Fleet", "On-Time %") — so every page's
top-of-page metrics read as the same visual language instead of each page
inventing its own tile style.

### Props

| prop | type | default | notes |
|------|------|---------|-------|
| `icon` | icon component | — | rendered top-left of the value/label stack |
| `label` | string | — | small caption under the value |
| `value` | string \| number | — | the headline number/text (shows `"—"` while `loading`) |
| `sub` | string | — | optional trailing caption, shown after the delta |
| `delta` | number | — | optional % change; renders a ▲/▼ arrow (green up, red down) |
| `tone` | one of `KPI_TONES` | `"forest"` | selects the gradient fill (see below) |
| `loading` | boolean | `false` | shows `"—"` in place of `value` |
| `onClick` | function | — | when provided, the card becomes a clickable/keyboard-focusable button |
| `className` | string | `""` | appended to the root element |
| `style` | object | `{}` | merged into the root element's inline style (after the tone's `backgroundImage`) |

### `tone` — verified `TONES` keys from source

`KpiCard.jsx` exports `KPI_TONES = Object.keys(TONES)`. The exact keys
defined in `TONES` (each a `135deg` gradient, verified directly against
source):

| tone key | gradient |
|---|---|
| `forest` | `#10B981 → #047857` (emerald) |
| `slate` | `#06B6D4 → #0E7490` (cyan) |
| `ocean` | `#3B82F6 → #1D4ED8` (blue) |
| `violet` | `#8B5CF6 → #6D28D9` (violet) |
| `ember` | `#FBBF24 → #F97316` (amber → orange) |
| `crimson` | `#F43F5E → #BE123C` (rose) |

All six are deep enough that white text/icons clear AA contrast — they
differ only in hue, so a row mixing several tones still reads as one
family rather than clashing.

```jsx
import { KpiCard, KPI_TONES } from "chart-kit";
import { DollarSign, Truck, Clock } from "lucide-react";

<div className="grid grid-cols-3 gap-3">
  <KpiCard icon={DollarSign} label="Total Revenue" value="$482K" delta={4.2} tone="forest" />
  <KpiCard icon={Truck} label="Active Fleet" value={128} sub="of 140" tone="ocean" />
  <KpiCard icon={Clock} label="On-Time %" value="96.4%" delta={-1.1} tone="crimson" />
</div>
```

`KPI_TONES` is exported for building tone pickers or validating a `tone`
prop programmatically rather than hardcoding the key list a second time.

<!-- screenshot: KpiCard-row -->

## LoadingState (+ EmptyState, ErrorState)

`src/LoadingState.jsx`

One shared pending/empty/error treatment for the whole app, so a panel that's
loading, empty, or errored always looks the same regardless of which page or
widget it's inside — no more one panel showing a spinner and another showing
a bare `"Loading…"` string.

The file exports three named components (`LoadingState` is also the
default export):

### `LoadingState`

| prop | type | default |
|------|------|---------|
| `label` | string | `"Loading"` |
| `className` | string | `""` |

Renders a centered spinner (`lucide-react`'s `Loader`, `animate-spin`) above
`{label}…`. Fills its container (`h-full w-full`), so drop it directly into
any panel/card body while data is pending. Sets `role="status"` /
`aria-live="polite"` for screen readers.

```jsx
import { LoadingState } from "chart-kit";

{loading ? <LoadingState label="Loading fleet data" /> : <MyChart data={data} />}
```

### `EmptyState`

| prop | type | default |
|------|------|---------|
| `icon` | icon component | — |
| `title` | string | `"No data"` |
| `message` | string | — |
| `className` | string | `""` |

Centered icon + title + optional longer message, for a panel that loaded
successfully but has nothing to show.

### `ErrorState`

| prop | type | default |
|------|------|---------|
| `icon` | icon component | — |
| `title` | string | `"Something went wrong"` |
| `message` | string | — |
| `onRetry` | function | — |
| `className` | string | `""` |

Same centered layout as `EmptyState`, plus an optional "Retry" button
(only rendered when `onRetry` is provided).

```jsx
import { EmptyState, ErrorState } from "chart-kit";
import { Inbox, AlertTriangle } from "lucide-react";

{error ? (
  <ErrorState icon={AlertTriangle} message={error.message} onRetry={refetch} />
) : !data.length ? (
  <EmptyState icon={Inbox} title="No routes yet" message="Add a route to see it here." />
) : (
  <MyChart data={data} />
)}
```
