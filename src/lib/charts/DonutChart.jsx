import React, { useMemo, useState, useRef, useEffect, memo } from "react";
import { ChevronRight } from "lucide-react";
import { resolveTheme, arcPath, polar } from "./theme";
import { ChartCard, ChartTooltip, Stat } from "./chrome";
import { useMeasuredBox } from "./useMeasuredBox";

/**
 * DonutChart — segmented ring with rounded caps and a centered total.
 * Props: title, theme, controls, segments:[{label,value,color?}], total?, centerLabel, size.
 * - Hover a segment for a tooltip (label, value, %).
 * - Legend swatch click toggles a segment (the ring recomputes from the active set).
 * - detailed=true (expand modal) draws each slice's value + % as labels around the ring.
 *
 * Layout: a donut is inherently square, but its bento slot rarely is. Given
 * the available box, the ring can only ever be as large as the SMALLER of
 * width/height — in a wide-short tile that leaves most of the width empty
 * if the legend is stacked below the ring (the original layout). Past a
 * landscape threshold, this switches to ring-left / legend-right: the same
 * width that would sit blank becomes real space for a proper vertical
 * legend list, instead of a horizontal-scroll strip that clips items with
 * no visible affordance. Portrait/near-square boxes keep the original
 * stacked ring-then-legend layout, where scrolling isn't needed.
 */
const SIZE = 220;
const C = SIZE / 2;
const DETAIL_MAX = 240; // cap the ring's rendered size in the expanded modal
const LANDSCAPE_RATIO = 1.35; // width:height beyond which ring+legend go side-by-side
const LEGEND_GAP = 20;

// single-row legend that scrolls horizontally instead of wrapping to more
// rows — a small right-edge fade + chevron hints there's more to scroll to.
const ScrollLegend = ({ theme: t, items, onToggle }) => {
  const ref = useRef(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 2);
  }, [items]);

  return (
    <div style={{ position: "relative", marginTop: 14 }}>
      <div
        ref={ref}
        style={{
          display: "flex", flexWrap: "nowrap", gap: 18, overflowX: "auto",
          paddingBottom: 2, paddingRight: overflowing ? 28 : 0,
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}
      >
        {items.map((it, i) => {
          const off = it.active === false;
          return (
            <span
              key={it.key ?? i}
              onClick={onToggle ? () => onToggle(it.key) : undefined}
              style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, cursor: onToggle ? "pointer" : "default", opacity: off ? 0.4 : 1 }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: it.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: t.text.secondary, whiteSpace: "nowrap" }}>{it.label}</span>
              {it.value != null && <span style={{ fontSize: 12, fontWeight: 700, color: t.text.secondary, whiteSpace: "nowrap" }}>{it.value}</span>}
            </span>
          );
        })}
      </div>
      {overflowing && (
        <div
          style={{
            position: "absolute", top: 0, right: 0, bottom: 2, width: 32,
            background: `linear-gradient(to right, transparent, ${t.mode === "light" ? "#ffffff" : "#1a1f2e"} 65%)`,
            display: "flex", alignItems: "center", justifyContent: "flex-end", pointerEvents: "none",
          }}
        >
          <ChevronRight size={14} color={t.text.muted} />
        </div>
      )}
    </div>
  );
};

// vertical legend used in the side-by-side (landscape) layout — real list
// space instead of a horizontal scroll strip, since that space would
// otherwise sit empty beside a ring that can't grow past the box's height.
// Sits on its own translucent layer (heading + frosted panel) so it reads
// as a distinct surface from the ring, and scrolls internally rather than
// spilling past the card once it has more items than fit.
const VerticalLegend = ({ theme: t, items, onToggle, heading = "Breakdown" }) => (
  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, height: "100%", minHeight: 0 }}>
    {heading && (
      <div
        style={{
          fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          color: t.text.muted, marginBottom: 8, flexShrink: 0,
        }}
      >
        {heading}
      </div>
    )}
    <div
      style={{
        flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto",
        background: t.mode === "light" ? "rgba(15,23,42,0.035)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${t.mode === "light" ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 10, padding: "8px 10px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {items.map((it, i) => {
          const off = it.active === false;
          return (
            <div
              key={it.key ?? i}
              onClick={onToggle ? () => onToggle(it.key) : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 8, minWidth: 0,
                cursor: onToggle ? "pointer" : "default", opacity: off ? 0.4 : 1,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: it.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: t.text.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                {it.label}
              </span>
              {it.value != null && (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text.primary, flexShrink: 0 }}>{it.value}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const DonutChart = memo(
  ({
    title = "Distribution",
    subtitle,
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    segments = [
      { label: "Direct", value: 42 },
      { label: "Referral", value: 28 },
      { label: "Organic", value: 18 },
      { label: "Social", value: 12 },
    ],
    total,
    centerLabel = "Total",
    thickness = 26,
    formatValue,
    width = 380,
    size = "m",
    expandable = false,
    className = "",
    radius,
    compact: compactCard = false,
  }) => {
    const t = resolveTheme(theme, "dark");
    const fmt = formatValue || ((v) => Number(v || 0).toLocaleString("en-US"));
    const r = C - thickness / 2 - 6;

    // resolve a stable color per segment (by index, like the original)
    const colored = useMemo(
      () => segments.map((s, i) => ({ ...s, color: s.color || t.series[i % t.series.length] })),
      [segments, t.series]
    );

    // which segments are active (toggled via the legend). keyed by label.
    const [hidden, setHidden] = useState({});
    const isActive = (s) => !hidden[s.label];
    const toggle = (key) => setHidden((h) => ({ ...h, [key]: !h[key] }));

    const [hover, setHover] = useState(null); // index into `arcs`

    const { arcs, sum } = useMemo(() => {
      const active = colored.filter(isActive);
      const sum = active.reduce((acc, x) => acc + x.value, 0) || 1;
      let a = -90;
      const gap = active.length > 1 ? 4 : 0;
      const arcs = active.map((s) => {
        const pct = s.value / sum;
        const sweep = pct * 360;
        const a0 = a + gap / 2;
        const a1 = a + sweep - gap / 2;
        const mid = a + sweep / 2;
        a += sweep;
        return {
          ...s,
          pct,
          d: arcPath(C, C, r, a0, a1),
          mid,
          // tooltip / label anchor on the ring centerline
          anchor: polar(C, C, r, mid),
          // label anchor just outside the ring (detailed mode)
          outer: polar(C, C, r + thickness / 2 + 12, mid),
        };
      });
      return { arcs, sum };
    }, [colored, hidden, r, thickness]);

    const fmtPct = (p) => `${Math.round(p * 100)}%`;

    const legendItems = colored.map((s) => {
      const a = arcs.find((x) => x.label === s.label);
      return {
        key: s.label,
        label: s.label,
        color: s.color,
        active: isActive(s),
        value: a ? fmtPct(a.pct) : "—",
      };
    });

    const resolvedControls = controls ?? [];
    const compact = size === "xs"; // xs: hide the bottom legend, rely on hover

    const hovered = hover != null ? arcs[hover] : null;

    // compact ("fill") mode: measure the available box, decide row vs
    // column layout from its aspect ratio, and ring-fit within whatever
    // portion of the box the ring gets. detailed (modal) mode: no
    // measurement needed, just cap at a fixed, reasonable size.
    const [boxRef, measuredBox] = useMeasuredBox({ width: SIZE, height: SIZE });
    const isLandscape = measuredBox.width > measuredBox.height * LANDSCAPE_RATIO;
    const fitSize = isLandscape
      ? Math.max(0, Math.min(measuredBox.height, (measuredBox.width - LEGEND_GAP) * 0.5))
      : Math.max(0, Math.min(measuredBox.width, measuredBox.height));

    // summary stats + a full segment breakdown table for the expanded/detailed
    // view — same visual language as DualLineChart's detailed mode.
    const ranked = useMemo(() => [...arcs].sort((a, b) => b.value - a.value), [arcs]);
    const overallStats = useMemo(() => {
      if (!ranked.length) return null;
      return { total: sum, count: ranked.length, top: ranked[0], bottom: ranked[ranked.length - 1] };
    }, [ranked, sum]);

    const renderStats = () => overallStats && (
      <div
        style={{
          position: "relative", overflow: "hidden", borderRadius: 16, marginTop: 20,
          border: `1px solid ${t.accent}28`, padding: "18px 16px 16px",
          background: `linear-gradient(160deg, ${t.accent}14, transparent 65%)`,
          boxShadow: "0 8px 24px -14px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: t.accent }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span
            style={{
              width: 24, height: 24, borderRadius: "50%", background: t.accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 12px -3px ${t.accent}99`,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: t.text.primary }}>{centerLabel}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat theme={t} label="Total" value={fmt(overallStats.total)} />
          <Stat theme={t} label="Segments" value={overallStats.count} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: overallStats.top.color }}>{overallStats.top.label}</div>
            <div style={{ fontSize: 12, color: t.text.muted }}>Largest · {fmt(overallStats.top.value)}</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: overallStats.bottom.color }}>{overallStats.bottom.label}</div>
            <div style={{ fontSize: 12, color: t.text.muted }}>Smallest · {fmt(overallStats.bottom.value)}</div>
          </div>
        </div>
      </div>
    );

    const renderTable = () => (
      <div
        style={{
          marginTop: 20, borderRadius: 16, border: `1px solid ${t.control.border}`,
          overflow: "hidden", boxShadow: "0 8px 24px -16px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: t.text.secondary, background: t.mode === "light" ? "#f1f5f9" : "rgba(255,255,255,0.05)" }}>
                <th style={{ padding: "10px 14px", fontWeight: 700 }}>Segment</th>
                <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Value</th>
                <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr
                  key={r.label}
                  style={{
                    borderTop: i === 0 ? "none" : `1px solid ${t.control.border}`,
                    background: i % 2 === 0 ? "transparent" : (t.mode === "light" ? "#f8fafc" : "rgba(255,255,255,0.02)"),
                    color: t.text.primary,
                  }}
                >
                  <td style={{ padding: "9px 14px", fontWeight: 600 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color }} />
                      {r.label}
                    </span>
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>{fmt(r.value)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>
                    <span style={{ padding: "2px 9px", borderRadius: 999, fontWeight: 700, fontSize: 12, background: `${r.color}1a`, color: r.color }}>
                      {fmtPct(r.pct)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <ChartCard
        theme={t}
        title={title}
        subtitle={subtitle}
        icon={icon}
        iconColor={iconColor}
        controls={resolvedControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
        radius={radius}
        compact={compactCard}
        footer={compact || isLandscape ? null : <ScrollLegend theme={t} items={legendItems} onToggle={toggle} />}
        footerDetailed={<ScrollLegend theme={t} items={legendItems} onToggle={toggle} />}
      >
        {({ detailed }) => {
          const landscape = !detailed && isLandscape;
          const ringPx = detailed ? DETAIL_MAX : fitSize;
          return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <div
              ref={detailed ? null : boxRef}
              style={{
                flex: detailed ? "none" : 1, minHeight: 0, minWidth: 0, width: "100%",
                display: "flex", flexDirection: landscape ? "row" : "column",
                alignItems: "center", justifyContent: landscape ? "flex-start" : "center",
                gap: landscape ? LEGEND_GAP : 0,
              }}
            >
              <div
                style={{
                  position: "relative", flexShrink: 0,
                  width: ringPx || (detailed ? DETAIL_MAX : SIZE),
                  height: ringPx || (detailed ? DETAIL_MAX : SIZE),
                }}
              >
                <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" role="img" aria-label={title}>
                  <circle cx={C} cy={C} r={r} fill="none" stroke={t.track} strokeWidth={thickness} opacity="0.4" />
                  {arcs.map((a, i) => {
                    const dim = hover != null && hover !== i;
                    return (
                      <path
                        key={a.label}
                        d={a.d}
                        fill="none"
                        stroke={a.color}
                        strokeWidth={thickness}
                        strokeLinecap="round"
                        opacity={dim ? 0.4 : 1}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHover(i)}
                        onMouseMove={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })}

                  <text x={C} y={C - 2} textAnchor="middle" fontSize="34" fontWeight="800" fill={t.text.primary}>
                    {total ?? fmt(sum)}
                  </text>
                  <text x={C} y={C + 20} textAnchor="middle" fontSize="12" fontWeight="500" fill={t.text.muted}>
                    {centerLabel}
                  </text>
                </svg>

                <ChartTooltip
                  theme={t}
                  visible={!!hovered}
                  left={hovered ? `${(hovered.anchor[0] / SIZE) * 100}%` : "50%"}
                  top={hovered ? `${(hovered.anchor[1] / SIZE) * 100}%` : "50%"}
                  title={hovered ? hovered.label : ""}
                  rows={
                    hovered
                      ? [{ label: "Value", value: fmt(hovered.value), color: hovered.color }, { label: "Share", value: fmtPct(hovered.pct) }]
                      : []
                  }
                />
              </div>

              {landscape && (
                <div style={{ flex: 1, minWidth: 0, height: "100%", maxWidth: measuredBox.width - ringPx - LEGEND_GAP }}>
                  <VerticalLegend theme={t} items={legendItems} onToggle={toggle} />
                </div>
              )}
            </div>

            {detailed && renderStats()}
            {detailed && renderTable()}
          </div>
          );
        }}
      </ChartCard>
    );
  }
);

DonutChart.displayName = "DonutChart";
export default DonutChart;
