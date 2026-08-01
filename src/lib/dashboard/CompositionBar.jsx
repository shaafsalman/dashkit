import { useState, useMemo } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { MONO, compact, Empty } from "./_shared.jsx";

/* ── COMPOSITION BAR ────────────────────────────────────────────────────────────
 * The cost base as overlapping circles — area is spend, so the three biggest
 * lines dominate visually — with every line itemised as a share bar beneath.
 * ────────────────────────────────────────────────────────────────────────── */
export function CompositionBar({ theme, title = "Cost Base", icon, iconColor, items = [], formatMoney, palette }) {
  const t = resolveTheme(theme, "light");
  const money = formatMoney || ((n) => `$${compact(n)}`);
  const [hover, setHover] = useState(null);

  const PALETTE = palette || ["#8B5CF6", "#3B82F6", "#F59E0B", "#10B981", "#06B6D4", "#EC4899"];
  const OTHER_COLOR = "#CBD5E1";
  const MAX_SEGMENTS = 5;

  // A single composition bar in place of the old bubble mosaic: the old
  // circle-packing layout had a fixed set of positions sized for three
  // roughly-similar bubbles, so close cost lines could overlap, and the label
  // font shrank with radius down to an unreadable ~3px at the floor size.
  // Rects laid out in a flex row can never overlap regardless of how the
  // values compare, and every segment gets a full-size, legible legend row
  // instead of text baked into its own shape. An "Other" bucket for whatever
  // falls past the top 5 also means the bar always reconciles with the total
  // the subtitle promises — the old bubbles-plus-top-4-list never did.
  const data = useMemo(() => {
    const rows = (items || [])
      .map((d) => ({ name: String(d.name || "").trim(), value: Number(d.value) || 0 }))
      .filter((d) => d.name && d.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = rows.reduce((s, d) => s + d.value, 0);
    const segments = rows.slice(0, MAX_SEGMENTS).map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));
    const restValue = rows.slice(MAX_SEGMENTS).reduce((s, d) => s + d.value, 0);
    if (restValue > 0) segments.push({ name: "Other", value: restValue, color: OTHER_COLOR });
    return { segments, total };
  }, [items]);

  if (!data.segments.length) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No cost breakdown in range" />}
      </ChartCard>
    );
  }

  const shown = hover != null ? data.segments[hover] : data.segments[0];
  const shownShare = data.total ? (shown.value / data.total) * 100 : 0;

  return (
    <ChartCard
      theme={t}
      size="fill"
      width="100%"
      expandable
      controls={[]}
      headerMarginBottom={4}
      title={title}
      icon={icon}
      iconColor={iconColor}
      subtitle={`${money(data.total)} total`}
    >
      {() => (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
          {/* hero readout — the biggest line by default, whatever's hovered
              (bar or legend row) while a hover is active */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: t.text.primary, lineHeight: 1 }}>
              {money(shown.value)}
            </span>
            <span style={{ fontSize: 12.5, color: t.text.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {shown.name} · {shownShare.toFixed(0)}%
            </span>
          </div>

          {/* composition bar — segments are plain flex widths, so they can
              never overlap the way the old bubbles could */}
          <div
            style={{ display: "flex", height: 26, marginTop: 8, flexShrink: 0, borderRadius: 3, overflow: "hidden" }}
            onMouseLeave={() => setHover(null)}
          >
            {data.segments.map((d, i) => {
              const share = data.total ? (d.value / data.total) * 100 : 0;
              const lit = hover === i;
              return (
                <div
                  key={d.name}
                  onMouseEnter={() => setHover(i)}
                  title={`${d.name}: ${money(d.value)} (${share.toFixed(0)}%)`}
                  style={{
                    width: `${Math.max(share, 1.5)}%`,
                    background: d.color,
                    opacity: hover == null || lit ? 1 : 0.42,
                    borderRight: i < data.segments.length - 1 ? "2px solid #fff" : "none",
                    cursor: "pointer",
                    transition: "opacity .15s ease",
                  }}
                />
              );
            })}
          </div>

          {/* full legend — every segment on the bar gets its own row, so
              nothing shown in the bar is left unlabelled below it. Rows are
              spread with space-evenly (there are at most 6, since segments
              are capped at 5 + "Other") rather than top-aligned in a flex:1
              block — top-aligning left a slab of dead space below the last
              row whenever the card was taller than the row count needed. */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-evenly", overflowY: "auto", marginTop: 4 }}>
            {data.segments.map((d, i) => {
              const share = data.total ? (d.value / data.total) * 100 : 0;
              const lit = hover === i;
              return (
                <div
                  key={d.name}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: 9, padding: "5px 4px", flexShrink: 0,
                    borderTop: i === 0 ? "none" : `1px solid ${t.control.border}`,
                    background: lit ? (t.mode === "light" ? "#f8fafc" : "rgba(255,255,255,0.05)") : "transparent",
                    transition: "background .15s ease",
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 12.5, fontWeight: 600, color: t.text.primary, flex: 1,
                      minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {d.name}
                  </span>
                  <span style={{ ...MONO, fontSize: 11.5, fontWeight: 700, color: t.text.primary }}>{money(d.value)}</span>
                  <span style={{ ...MONO, fontSize: 10.5, color: t.text.muted, minWidth: 32, textAlign: "right" }}>
                    {share.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

/* ── CAPACITY BARCODE ────────────────────────────────────────────────────────
 * Rounded gradient-filled monthly bars with a hatched band above a target
 * threshold (dashed reference line) — reads as "how far past/short of target"
 * at a glance. Fills whatever box it's given (square, wide, or tall — no
 * fixed aspect ratio baked in), with an always-responsive hover tooltip.
 * ────────────────────────────────────────────────────────────────────────── */

export default CompositionBar;
