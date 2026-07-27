import React, { useMemo, useState, memo } from "react";
import { resolveTheme } from "./theme";
import { ChartCard } from "./chrome";

const DEFAULT_ITEMS = [
  { label: "MGQ–NBO", value: 6700 },
  { label: "MGQ–JED", value: 5200 },
  { label: "HGA–DXB", value: 3900 },
  { label: "NBO–JIB", value: 2800 },
  { label: "BSA–DXB", value: 1600 },
];

const SORT_OPTIONS = [
  { label: "Highest first", value: "desc" },
  { label: "Lowest first", value: "asc" },
  { label: "A–Z", value: "alpha" },
];

const BarRankingChart = memo(
  ({
    title = "Top Routes",
    subtitle,
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    items = DEFAULT_ITEMS,
    maxValue,
    formatValue,
    topN = 6,
    size = "m",
    width = 460,
    expandable = false,
    className = "",
    radius,
    compact = false,
  }) => {
    const t = resolveTheme(theme, "light");
    const fmt = formatValue || ((v) => Number(v || 0).toLocaleString("en-US"));
    const [sort, setSort] = useState("desc");
    const [hover, setHover] = useState(-1);

    const sorted = useMemo(() => {
      const arr = items.filter((it) => (it.value || 0) > 0).map((it, i) => ({ ...it, _i: i }));
      if (sort === "asc") arr.sort((a, b) => a.value - b.value);
      else if (sort === "alpha") arr.sort((a, b) => String(a.label).localeCompare(String(b.label)));
      else arr.sort((a, b) => b.value - a.value);
      return arr;
    }, [items, sort]);

    const max = maxValue || Math.max(...sorted.map((i) => i.value), 1);

    // iconOnly: true — a compact card has no width to spare for the label,
    // and "Sort" next to a swap-arrows icon is redundant anyway.
    const sortControl = { type: "sort", iconOnly: true, options: SORT_OPTIONS, value: sort, onChange: setSort };
    const mergedControls = controls || [sortControl];

    const track = t.track || (t.mode === "light" ? "#e9eef4" : "rgba(255,255,255,0.08)");

    return (
      <ChartCard
        theme={t}
        title={title}
        subtitle={subtitle}
        icon={icon}
        iconColor={iconColor}
        controls={mergedControls}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
        radius={radius}
        compact={compact}
      >
        {({ detailed }) => {
          const rows = detailed ? sorted : sorted.slice(0, topN);
          return (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
              {rows.map((it, i) => {
                const pct = Math.max((it.value / max) * 100, 1.5);
                const color = it.color || t.accent;
                const on = hover === i;
                return (
                  <div
                    key={it.label}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(-1)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 6px",
                      borderBottom: i === rows.length - 1 ? "none" : `1px solid ${t.mode === "light" ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)"}`,
                      background: on ? `${color}0c` : "transparent",
                      transition: "background .15s ease",
                      cursor: "default",
                    }}
                  >
                    {/* rank — a plain number, no medal chrome */}
                    <span style={{
                      width: 16, flexShrink: 0, textAlign: "right",
                      fontSize: 11, fontWeight: 700, color: t.text.muted,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {i + 1}
                    </span>

                    {/* label + inline proportion bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5, fontWeight: 600, color: t.text.primary,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        marginBottom: 4,
                      }}>
                        {it.label}
                      </div>
                      <div style={{ height: 4, background: track, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${pct}%`, background: color,
                          transition: "width .5s cubic-bezier(.4,0,.2,1)",
                          opacity: on ? 1 : 0.9,
                        }} />
                      </div>
                    </div>

                    {/* value — the number carries the weight; % dropped as
                        redundant with the bar itself */}
                    <span style={{
                      fontSize: 12.5, fontWeight: 700, color: on ? color : t.text.primary,
                      fontVariantNumeric: "tabular-nums", flexShrink: 0,
                      transition: "color .15s ease",
                    }}>
                      {fmt(it.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }}
      </ChartCard>
    );
  }
);

BarRankingChart.displayName = "BarRankingChart";
export default BarRankingChart;
