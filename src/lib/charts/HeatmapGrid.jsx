import React, { useMemo, memo } from "react";
import { resolveTheme } from "./theme";
import { ChartCard } from "./chrome";

/**
 * HeatmapGrid — activity heatmap (weeks x days), intensity = accent opacity.
 * Props: title, theme, controls, columns, rows, values:number[] (row-major), max, accent.
 */
const HeatmapGrid = memo(
  ({
    title = "Activity",
    theme,
    controls,
    onControl,
    columns = 26,
    rows = 7,
    values,
    max,
    accent,
    width = 560,
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

    return (
      <ChartCard
        theme={t}
        title={title}
        controls={controls}
        onControl={onControl}
        width={width}
        className={className}
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
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gridAutoRows: "1fr", gap: 4 }}>
          {cells.map((v, i) => (
            <div
              key={i}
              title={`${Math.round(v * 100)}%`}
              style={{ aspectRatio: "1 / 1", borderRadius: 3, background: v < 0.06 ? t.track : color, opacity: v < 0.06 ? 0.5 : 0.18 + 0.82 * v }}
            />
          ))}
        </div>
      </ChartCard>
    );
  }
);

HeatmapGrid.displayName = "HeatmapGrid";
export default HeatmapGrid;
