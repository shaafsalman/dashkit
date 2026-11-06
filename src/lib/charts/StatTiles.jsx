import React, { memo, useId } from "react";
import { resolveTheme, toneColor } from "./theme";
import { ChartCard, ChangePill } from "./chrome";
import { useMeasuredBox } from "./useMeasuredBox";

/**
 * StatTiles — responsive grid of KPI tiles, each with a value, delta and sparkline.
 * Props: title, theme, controls, tiles:[{label,value,change,spark:number[],color?}].
 */
const SW = 120;
const SH = 36;

const sparkPath = (vals, fillTo) => {
  if (!vals || vals.length < 2) return { line: "", area: "" };
  const max = Math.max(...vals), min = Math.min(...vals), span = max - min || 1;
  const x = (i) => (i * SW) / (vals.length - 1);
  const y = (v) => SH - ((v - min) / span) * (SH - 4) - 2;
  const pts = vals.map((v, i) => [x(i), y(v)]);
  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    line += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return { line, area: `${line} L ${SW} ${fillTo} L 0 ${fillTo} Z` };
};

const StatTiles = memo(
  ({
    title = "Overview",
    subtitle,
    theme,
    controls,
    onControl,
    tiles = [
      { label: "Revenue", value: "$48.2K", change: 12.4, spark: [10, 14, 12, 18, 16, 22, 26] },
      { label: "Orders", value: "1,284", change: 5.1, spark: [20, 18, 22, 19, 24, 23, 28] },
      { label: "Refunds", value: "312", change: -3.2, spark: [12, 14, 11, 13, 10, 9, 8] },
      { label: "Sessions", value: "92.4K", change: 8.7, spark: [30, 28, 33, 31, 38, 40, 44] },
    ],
    width = 560,
    size = "m",
    className = "",
  }) => {
    const t = resolveTheme(theme, "dark");
    const uid = useId().replace(/:/g, "");
    const onBrand = String(t.text.primary).toLowerCase() === "#ffffff";
    // Balanced columns: as many as fit at >=180px, then evened out so rows are
    // full (4 tiles -> 4x1 or 2x2, never 3 + an orphan).
    const [gridRef, gridBox] = useMeasuredBox({ width: 560, height: 200 });
    const fit = Math.max(1, Math.floor((gridBox.width + 12) / (180 + 12)));
    const cols = Math.min(tiles.length, Math.ceil(tiles.length / Math.ceil(tiles.length / fit)));
    const tileBg = onBrand ? "rgba(255,255,255,0.12)" : t.mode === "light" ? "#f6f8fb" : "rgba(255,255,255,0.03)";

    return (
      <ChartCard theme={t} title={title} subtitle={subtitle} controls={controls} onControl={onControl} width={width} size={size} className={className} floatingHeader headline={{ value: tiles[0]?.value ?? "—" }}>
        <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "1fr", gap: 12, height: "100%", minHeight: 0 }}>
          {tiles.map((tile, i) => {
            const color = toneColor(t, tile.color || t.series[i % t.series.length], i);
            const { line, area } = sparkPath(tile.spark, SH);
            return (
              <div key={tile.label} style={{ background: tileBg, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: onBrand ? "rgba(255,255,255,.74)" : t.text.muted, marginBottom: 6 }}>{tile.label}</div>
                    <div style={{ fontSize: 24, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.035em", color: t.text.primary }}>{tile.value}</div>
                  </div>
                  <ChangePill theme={t} value={tile.change} />
                </div>
                {/* sparkline grows into the tile's spare height (no dead gap under the value) */}
                <div style={{ flex: 1, paddingTop: 14, minHeight: 56, maxHeight: 200 }}>
                  <svg viewBox={`0 0 ${SW} ${SH}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id={`${uid}-st-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={area} fill={`url(#${uid}-st-${i})`} />
                    <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    );
  }
);

StatTiles.displayName = "StatTiles";
export default StatTiles;
