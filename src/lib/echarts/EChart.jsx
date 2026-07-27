import React, { useEffect, useRef } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart, BarChart, PieChart, GaugeChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Explicit, tree-shaken registration — only what the bento mosaic actually uses.
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

/**
 * Dumb wrapper. It receives a complete ECharts option and renders it — no chart
 * logic lives here; all option building happens in chartOptions.js.
 */
export default function EChart({ option, height = 220, ariaLabel, className = "", onClick }) {
  const events = onClick ? { click: onClick } : undefined;
  const wrapRef = useRef(null);
  const chartRef = useRef(null);

  // ECharts sizes its canvas once from the container's box at mount time and
  // never re-measures on its own. When height="100%" is nested a couple of
  // flex layers deep (fill-size ChartCard bodies), the container can still
  // be settling its own height at that instant — the canvas then locks in
  // too short, leaving dead space below the chart that no data ever fills.
  // A ResizeObserver on the actual box + an explicit .resize() call keeps
  // the canvas in sync with whatever height the flex layout lands on.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance?.().resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", height }}
    >
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={option}
        notMerge
        lazyUpdate
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "canvas" }}
        onEvents={events}
      />
    </div>
  );
}
