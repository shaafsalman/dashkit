import React, { useMemo, memo } from "react";
import { resolveTheme } from "./theme";
import { ChartCard } from "./chrome";
import { useMeasuredBox } from "./useMeasuredBox";

/**
 * HeatmapGrid — activity heatmap (weeks x days), intensity = accent opacity.
 * Props: title, theme, controls, columns, rows, values:number[] (row-major), max, accent.
 */
const HeatmapGrid = memo(
  ({
    title = "Activity",
    subtitle,
    theme,
    controls,
    onControl,
    columns = 26,
    rows = 7,
    values,
    max,
    accent,
    width = 560,
    size = "m",
    className = "",
  }) => {
    const t = resolveTheme(theme, "dark");
    const color = accent || t.accent;

    const cells = useMemo(() => {
      const n = columns * rows;
      const data = values && values.length ? values : Array.from({ length: n }, (_, i) => (Math.sin(i * 1.3) + 1) * 0.5 * (((i * 37) % 11) / 10));
      const mx = max || Math.max(...data, 1);
      return data.slice(0, n).map((v) => Math.max(0, Math.min(v / mx, 1)));
    }, [values, columns, rows, max]);

    const levels = [0.12, 0.34, 0.56, 0.78, 1];

    // Square cells sized to whichever axis is tighter, so the full grid always
    // fits the box (no clipped columns on phones) and sits centred in it.
    const [boxRef, box] = useMeasuredBox({ width: 320, height: 160 });
    const gap = box.width < 420 ? 3 : 4;
    // On narrow cards keep cells readable (>= 14px) by showing only the most
    // recent columns that fit, rather than shrinking all of them to specks.
    const MIN_CELL = 14;
    const visCols = Math.max(1, Math.min(columns, Math.floor((box.width + gap) / (MIN_CELL + gap))));
    const cell = Math.max(4, Math.floor(Math.min(
      (box.width - gap * (visCols - 1)) / visCols,
      (box.height - gap * (rows - 1)) / rows,
    )));
    const shown = cells
      .map((v, i) => ({ v, i, col: i % columns }))
      .filter((c) => c.col >= columns - visCols);

    return (
      <ChartCard
        theme={t}
        title={title}
        subtitle={subtitle}
        controls={controls}
        onControl={onControl}
        width={width}
        size={size}
        className={className}
        floatingHeader
        headline={{ value: `${Math.round((cells.reduce((sum, value) => sum + value, 0) / Math.max(cells.length, 1)) * 100)}%` }}
        footer={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 14, fontSize: 12, color: t.text.muted }}>
            <span>Less</span>
            {levels.map((l, i) => (
              <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: color, opacity: l }} />
            ))}
            <span>More</span>
          </div>
        }
      >
        <div ref={boxRef} style={{ height: size === "fill" ? "100%" : "var(--cc-h)", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${visCols}, ${cell}px)`, gridAutoRows: `${cell}px`, gap }}>
            {shown.map(({ v, i }) => (
              <div
                key={i}
                title={`${Math.round(v * 100)}%`}
                style={{ borderRadius: Math.max(2, cell / 5), background: v < 0.06 ? t.track : color, opacity: v < 0.06 ? 0.5 : 0.18 + 0.82 * v }}
              />
            ))}
          </div>
        </div>
      </ChartCard>
    );
  }
);

HeatmapGrid.displayName = "HeatmapGrid";
export default HeatmapGrid;
