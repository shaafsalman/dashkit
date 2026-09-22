import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { isDarkMode } from "../isDarkMode";
import { compactNumber } from "../lib/charts/format";

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels,
);

const LineChartView = ({
  chartData,
  compareMode = false,
  metrics = [],
  decimal = true,
  isMobile = false,
  barColor = "#3B82F6",
  colorPalette = [],
  showPercentage = false,
  showDollar = false,
  yearTogglePortal = null,
  // Shared with VerticalBarView/AreaChartView (computed once in
  // RankedDataWidget's sharedMaxValue) so the Y-axis stops moving when the
  // view type switches — falls back to this view's own scan when omitted.
  maxValue = null,
}) => {
  // Static read, not a hook: this component fully remounts on theme toggle
  // (DashboardLayout keys the page Outlet on `theme`). Chart.js draws to
  // canvas, which can't resolve CSS custom properties the way inline SVG
  // does, so its chrome colors are literal here — kept in sync with the
  // --chart-* vars in index.css by hand.
  const dark = isDarkMode();
  const chartChrome = dark
    ? {
        pointFill: "#202020",
        legendText: "#d4d4d4",
        tooltipBg: "#202020",
        tooltipTitle: "#f5f5f5",
        tooltipBody: "#d4d4d4",
        tooltipBorder: "#3a3a3a",
        gridLine: "rgba(255, 255, 255, 0.08)",
        tick: "#d4d4d4",
        axisBorder: "#3a3a3a",
        labelHalo: "#202020",
        labelHaloShadow: "rgba(32, 32, 32, 1)",
        toggleActiveBg: "#202020",
        toggleActiveText: "#f5f5f5",
        toggleInactiveText: "#737373",
      }
    : {
        pointFill: "#ffffff",
        legendText: "#475569",
        tooltipBg: "#ffffff",
        tooltipTitle: "#111827",
        tooltipBody: "#4B5563",
        tooltipBorder: "#D1D5DB",
        gridLine: "rgba(148, 163, 184, 0.18)",
        tick: "#64748b",
        axisBorder: "#e2e8f0",
        labelHalo: "#ffffff",
        labelHaloShadow: "rgba(255, 255, 255, 1)",
        toggleActiveBg: "#ffffff",
        toggleActiveText: "#111827",
        toggleInactiveText: "#9ca3af",
      };

  const parseMonth = (monthStr) => {
    const str = monthStr.toString().trim();

    const monthNames = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };

    if (/^\d{1,2}$/.test(str)) {
      const num = parseInt(str);
      return num >= 1 && num <= 12 ? num - 1 : null;
    }

    const patterns = [
      /^([a-z]+)-?(\d{2,4})$/i,
      /^(\d{2,4})-?([a-z]+)$/i,
      /^([a-z]+)\s+(\d{2,4})$/i,
      /^(\d{2,4})\s+([a-z]+)$/i,
      /^([a-z]+)$/i,
    ];

    for (const pattern of patterns) {
      const match = str.match(pattern);
      if (match) {
        const [, part1, part2] = match;

        const month1 = monthNames[part1.toLowerCase()];
        const month2 = part2 ? monthNames[part2.toLowerCase()] : undefined;

        if (month1 !== undefined) {
          const year = part2 ? parseInt(part2) : new Date().getFullYear();
          return { month: month1, year };
        } else if (month2 !== undefined) {
          const year = parseInt(part1);
          return { month: month2, year };
        }
      }
    }

    return null;
  };

  const isMonthData = (data) => {
    if (!data || data.length === 0) return false;

    let monthCount = 0;
    for (const item of data.slice(0, Math.min(5, data.length))) {
      if (parseMonth(item.name)) {
        monthCount++;
      }
    }

    return monthCount >= Math.ceil(data.length * 0.6);
  };

  const sortMonthData = (data) => {
    return [...data].sort((a, b) => {
      const monthA = parseMonth(a.name);
      const monthB = parseMonth(b.name);

      if (!monthA || !monthB) return 0;

      if (typeof monthA === "object" && typeof monthB === "object") {
        if (monthA.year !== monthB.year) {
          return monthA.year - monthB.year;
        }
        return monthA.month - monthB.month;
      }

      if (typeof monthA === "number" && typeof monthB === "number") {
        return monthA - monthB;
      }

      return 0;
    });
  };

  const extractYearFromName = (name) => {
    if (!name) return null;
    const match = name.toString().match(/(\d{2,4})$/);
    if (match) {
      let year = match[1];
      if (year.length === 2) {
        year = "20" + year;
      }
      return year;
    }
    return null;
  };

  const extractMonthFromName = (name) => {
    if (!name) return null;
    const monthPart = name.toString().toLowerCase().split(/[-\s]/)[0]?.trim();
    const monthMap = {
      january: "Jan",
      february: "Feb",
      march: "Mar",
      april: "Apr",
      may: "May",
      june: "Jun",
      july: "Jul",
      august: "Aug",
      september: "Sep",
      october: "Oct",
      november: "Nov",
      december: "Dec",
      jan: "Jan",
      feb: "Feb",
      mar: "Mar",
      apr: "Apr",
      jun: "Jun",
      jul: "Jul",
      aug: "Aug",
      sep: "Sep",
      oct: "Oct",
      nov: "Nov",
      dec: "Dec",
    };
    return monthMap[monthPart] || monthPart;
  };

  const detectMultipleYears = (data) => {
    const years = new Set();
    data.forEach((item) => {
      const year = extractYearFromName(item.name);
      if (year) years.add(year);
    });
    return Array.from(years).sort();
  };

  const groupDataByMonth = (data, years) => {
    if (years.length <= 1) return null;

    const monthOrder = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const groupedByMonth = {};

    data.forEach((item) => {
      const month = extractMonthFromName(item.name);
      const year = extractYearFromName(item.name);

      if (!month || !year) return;

      if (!groupedByMonth[month]) {
        groupedByMonth[month] = { name: month };
      }

      if (compareMode && metrics.length > 1) {
        metrics.forEach((metric) => {
          const key = `${metric.key}_${year}`;
          groupedByMonth[month][key] = item[metric.key] || 0;
        });
      } else {
        const key = `value_${year}`;
        groupedByMonth[month][key] = item.value || 0;
      }
    });

    return Object.values(groupedByMonth).sort((a, b) => {
      const aIndex = monthOrder.indexOf(a.name.toLowerCase());
      const bIndex = monthOrder.indexOf(b.name.toLowerCase());
      return aIndex - bIndex;
    });
  };

  const nullifyAllZeroData = (dataArray) => {
    return dataArray.map((v) =>
      v === 0 || v === null || v === undefined ? null : v,
    );
  };

  const [hoveredDataset, setHoveredDataset] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const chartRef = useRef(null);
  // 7px strokes with 5px dots read as a thick ribbon rather than a trend line.
  // 2.5 went too far the other way and looked faint, so this sits between:
  // clearly the primary mark on the plot, without swamping a bento tile.
  const defaultBorderWidth = 3.5;
  const defaultPointRadius = 4;

  const formatValue = (value) => {
    if (typeof value !== "number") return value;
    let formattedValue;
    if (value >= 1000000)
      formattedValue = `${(value / 1000000)
        .toFixed(decimal ? 1 : 0)
        .replace(/\.0$/, "")}M`;
    else if (value >= 1000)
      formattedValue = `${(value / 1000)
        .toFixed(decimal ? 1 : 0)
        .replace(/\.0$/, "")}K`;
    else formattedValue = compactNumber(value);

    if (showPercentage) {
      formattedValue = `${formattedValue}%`;
    }
    if (showDollar) {
      formattedValue = `$${formattedValue}`;
    }

    return formattedValue;
  };

  const detectedYears = detectMultipleYears(chartData);
  const hasMultipleYears = detectedYears.length > 1;
  const groupedData = hasMultipleYears
    ? groupDataByMonth(chartData, detectedYears)
    : null;

  const showYearSwitcher =
    compareMode &&
    metrics.length > 1 &&
    hasMultipleYears &&
    metrics.length * detectedYears.length > 2;

  useEffect(() => {
    if (showYearSwitcher && detectedYears.length > 0 && activeYear === null) {
      setActiveYear(detectedYears[detectedYears.length - 1]);
    }
  }, [showYearSwitcher, detectedYears]);

  const getDataRange = () => {
    if (!chartData || chartData.length === 0) return { min: 0, max: 1 };

    if (typeof maxValue === "number" && maxValue > 0) {
      return { min: 0, max: maxValue };
    }

    let allValues = [];

    if (hasMultipleYears && groupedData) {
      groupedData.forEach((item) => {
        if (compareMode && metrics.length > 1) {
          detectedYears.forEach((year) => {
            metrics.forEach((metric) => {
              const key = `${metric.key}_${year}`;
              const value = item[key];
              if (!isNaN(value) && value > 0) {
                allValues.push(value);
              }
            });
          });
        } else {
          detectedYears.forEach((year) => {
            const key = `value_${year}`;
            const value = item[key];
            if (!isNaN(value) && value > 0) {
              allValues.push(value);
            }
          });
        }
      });
    } else if (compareMode && metrics && metrics.length > 1) {
      chartData.forEach((item) => {
        metrics.forEach((metric) => {
          const rawValue = item[metric.key];
          const value =
            typeof rawValue === "string" ? parseFloat(rawValue) : rawValue;
          if (!isNaN(value) && value > 0) {
            allValues.push(value);
          }
        });
      });
    } else {
      chartData.forEach((item) => {
        const rawValue = item.value;
        const value =
          typeof rawValue === "string" ? parseFloat(rawValue) : rawValue;
        if (!isNaN(value) && value > 0) {
          allValues.push(value);
        }
      });
    }

    if (allValues.length === 0) return { min: 0, max: 1 };

    const dataMax = Math.max(...allValues);
    const dataMin = Math.min(...allValues);

    if (dataMax < 1) {
      let step;
      if (dataMax <= 0.1) {
        step = 0.05;
      } else if (dataMax <= 0.5) {
        step = 0.1;
      } else {
        step = 0.2;
      }

      return {
        min: 0,
        max: Math.ceil(dataMax / step) * step,
      };
    }

    const range = dataMax - dataMin;
    const buffer = Math.max(range * 0.3, 0.02);

    return {
      min:
        dataMax >= 10
          ? Math.floor(Math.max(0, dataMin - buffer * 1.5) / 2) * 2
          : Math.max(0, dataMin - buffer * 1.5),
      max:
        dataMax >= 10
          ? Math.ceil((dataMax + buffer) / 2) * 2
          : dataMax + buffer,
    };
  };

  const processedChartData = React.useMemo(() => {
    if (!chartData || chartData.length === 0)
      return { labels: [], datasets: [] };

    if (hasMultipleYears && groupedData) {
      const labels = groupedData.map((item) => item.name);
      const datasets = [];

      if (compareMode && metrics.length > 1) {
        const yearsToRender =
          showYearSwitcher && activeYear ? [activeYear] : detectedYears;

        yearsToRender.forEach((year, yearIndex) => {
          metrics.forEach((metric, metricIndex) => {
            const originalYearIndex = detectedYears.indexOf(year);
            const colorIndex = originalYearIndex * metrics.length + metricIndex;
            const color =
              colorPalette[colorIndex % colorPalette.length] || barColor;
            const key = `${metric.key}_${year}`;
            const yearLabel = year.toString();
            const rawData = groupedData.map((item) => item[key] || 0);

            datasets.push({
              label: `${metric.label} ${yearLabel}`,
              data: nullifyAllZeroData(rawData),
              borderColor: color,
              backgroundColor: color + "15",
              pointBackgroundColor: chartChrome.pointFill,
              pointBorderColor: color,
              pointBorderWidth: 3,
              pointRadius: defaultPointRadius,
              pointHoverRadius: 8,
              borderWidth: defaultBorderWidth,
              tension: 0.2,
              fill: false,
              spanGaps: false,
            });
          });
        });
      } else {
        detectedYears.forEach((year, index) => {
          const color = colorPalette[index % colorPalette.length] || barColor;
          const key = `value_${year}`;
          const yearLabel = year.toString();
          const rawData = groupedData.map((item) => item[key] || 0);

          datasets.push({
            label: `${yearLabel}`,
            data: nullifyAllZeroData(rawData),
            borderColor: color,
            backgroundColor: color + "15",
            pointBackgroundColor: chartChrome.pointFill,
            pointBorderColor: color,
            pointBorderWidth: 3,
            pointRadius: defaultPointRadius,
            pointHoverRadius: 8,
            borderWidth: defaultBorderWidth,
            tension: 0.2,
            fill: false,
            spanGaps: false,
          });
        });
      }

      return { labels, datasets };
    }

    const sortedChartData = isMonthData(chartData)
      ? sortMonthData(chartData)
      : chartData;
    const labels = sortedChartData.map((item) => item.name);

    const datasets = [];

    if (compareMode && metrics.length > 1) {
      metrics.forEach((metric, index) => {
        const color = colorPalette[index % colorPalette.length];
        const rawData = sortedChartData.map((item) => item[metric.key] || 0);
        datasets.push({
          label: metric.label || metric.key,
          data: nullifyAllZeroData(rawData),
          borderColor: color,
          backgroundColor: color + "15",
          pointBackgroundColor: chartChrome.pointFill,
          pointBorderColor: color,
          pointBorderWidth: 3,
          pointRadius: defaultPointRadius,
          pointHoverRadius: 8,
          borderWidth: defaultBorderWidth,
          tension: 0.2,
          fill: false,
          spanGaps: false,
          shadowOffsetX: 0,
          shadowOffsetY: 2,
          shadowBlur: 4,
          shadowColor: color + "40",
        });
      });
    } else {
      const color = barColor;
      const rawData = sortedChartData.map((item) => item.value || 0);
      datasets.push({
        label: "Value",
        data: nullifyAllZeroData(rawData),
        borderColor: color,
        backgroundColor: color + "15",
        pointBackgroundColor: chartChrome.pointFill,
        pointBorderColor: color,
        pointBorderWidth: 3,
        pointRadius: defaultPointRadius,
        pointHoverRadius: 8,
        borderWidth: defaultBorderWidth,
        tension: 0.2,
        fill: false,
        spanGaps: false,
      });
    }

    return { labels, datasets };
  }, [
    chartData,
    compareMode,
    metrics,
    barColor,
    colorPalette,
    hasMultipleYears,
    groupedData,
    detectedYears,
    activeYear,
    showYearSwitcher,
  ]);

  const dataRange = getDataRange();

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 2,
        right: 6,
        top: 2,
        bottom: 0,
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        display: (compareMode && metrics.length > 1) || hasMultipleYears,
        position: "top",
        align: "end",
        labels: {
          usePointStyle: true,
          // Rect to match the square swatches every other legend uses.
          pointStyle: "rect",
          // Legend was claiming ~50px of plot height on its own: 13px type,
          // 10px padding, and circles drawn from the old 7px line weight.
          padding: 6,
          font: {
            size: isMobile ? 10 : 11,
            weight: "700",
            family: SANS,
          },
          color: chartChrome.legendText,
          boxWidth: 6,
          boxHeight: 6,
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: chartChrome.tooltipBg,
        titleColor: chartChrome.tooltipTitle,
        bodyColor: chartChrome.tooltipBody,
        borderColor: chartChrome.tooltipBorder,
        // 1px hairline + tighter padding to match HoverTooltip and the
        // Recharts CustomTooltips; 2px/16px made this the heaviest tooltip.
        borderWidth: 1,
        cornerRadius: 0,
        padding: 10,
        displayColors: true,
        boxPadding: 4,
        usePointStyle: true,
        boxWidth: 9,
        boxHeight: 9,
        titleMarginBottom: 6,
        bodySpacing: 4,
        bodyFont: {
          size: isMobile ? 11 : 12,
          weight: "600",
          family: MONO,
        },
        titleFont: {
          size: isMobile ? 11 : 12,
          weight: "700",
          family: SANS,
        },
        filter: function (tooltipItem) {
          return tooltipItem.parsed.y !== null;
        },
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${formatValue(context.parsed.y)}`;
          },
        },
        external: function (context) {
          const tooltipEl = document.getElementById("chartjs-tooltip");
          if (tooltipEl) {
            tooltipEl.style.boxShadow =
              "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
          }
        },
      },
      datalabels: {
        // Previously every point on every series got a bordered, filled box —
        // 12 months × 2 series is 24 boxes that overlap each other and the
        // line itself. Values now appear only at the points that carry meaning
        // (each series' min, max and final point), unboxed, with the rest
        // available on hover. Matches DualLineChart's restraint.
        // 'auto' shows every label it can and drops only the ones that would
        // actually overlap a neighbour. Filtering to min/max/last instead hid
        // most of the values even when there was room for them.
        display: function (context) {
          const value = context.dataset.data[context.dataIndex];
          if (value === 0 || value === null || value === undefined) return false;
          return "auto";
        },
        anchor: "end",
        // Alternating top/bottom by dataset index worked for two series but
        // collided badly at three (Revenue/Costs/Profit all landing in the same
        // band). Every label now sits above its own point and 'auto' resolves
        // what genuinely cannot fit — with the offset stepped per series so
        // stacked lines do not compete for the same strip.
        align: "top",
        clamp: true,
        offset: function (context) {
          return 4 + (context.datasetIndex % 3) * 9;
        },
        // Tint each label to its own series so an unboxed number is still
        // unambiguously attributable when two lines run close together.
        color: function (context) {
          return context.dataset.borderColor;
        },
        font: {
          size: isMobile ? 11 : 12,
          weight: "800",
          family: MONO,
        },
        formatter: function (value) {
          if (value === 0 || value === null || value === undefined) return "";
          return formatValue(value);
        },
        // No box, but a solid white halo so the number stays legible where it
        // crosses a gridline or the other series' line.
        backgroundColor: null,
        borderWidth: 0,
        padding: 0,
        textStrokeColor: chartChrome.labelHalo,
        textStrokeWidth: 3,
        textShadowColor: chartChrome.labelHaloShadow,
        textShadowBlur: 6,
      },
    },
    scales: {
      // Same axis treatment as every Recharts chart in the app (see
      // lib/charts/theme.js's AXIS_*/GRID constants): no visible axis border,
      // only the horizontal (y-tick) gridlines, calm gray/mono tick labels.
      x: {
        grid: {
          // Vertical gridlines off — Recharts charts only ever draw the
          // horizontal ones (CartesianGrid vertical={false}).
          display: false,
        },
        ticks: {
          color: chartChrome.tick,
          font: {
            size: isMobile ? 10 : 11,
            weight: "600",
            family: SANS,
          },
          maxRotation: isMobile ? 45 : 0,
          // Drops month labels rather than shrinking the plot when the tile is
          // narrow — 12 labels never fit a 3-column bento tile.
          autoSkip: true,
          autoSkipPadding: 8,
          padding: 4,
        },
        border: {
          display: false,
        },
      },
      y: {
        min: dataRange.min,
        max: dataRange.max,
        grid: {
          display: true,
          color: chartChrome.gridLine,
          lineWidth: 1,
          // Dashed, matching every Recharts CartesianGrid in the app
          // (strokeDasharray="4 4").
          borderDash: [4, 4],
          drawOnChartArea: true,
          drawTicks: false,
        },
        ticks: {
          color: chartChrome.tick,
          font: {
            size: 10,
            weight: "500",
            family: MONO,
          },
          // Chart.js was generating up to 9 gridlines; 5 is enough to read a
          // trend and gives the plot back the vertical space.
          maxTicksLimit: 5,
          padding: 4,
          callback: function (value) {
            return formatValue(value);
          },
        },
        border: {
          display: false,
        },
      },
    },
    elements: {
      point: {
        hoverBorderWidth: 4,
        hoverRadius: 9,
        hitRadius: 15,
      },
      line: {
        borderJoinStyle: "round",
        borderCapStyle: "round",
      },
    },
    onHover: (event, activeElements, chart) => {
      chart.canvas.style.cursor =
        activeElements.length > 0 ? "pointer" : "default";

      if (activeElements.length > 0) {
        const datasetIndex = activeElements[0].datasetIndex;
        if (datasetIndex !== hoveredDataset) {
          setHoveredDataset(datasetIndex);

          chart.update("none");
        }
      } else {
        if (hoveredDataset !== null) {
          setHoveredDataset(null);
          chart.data.datasets.forEach((dataset) => {
            dataset.borderWidth = defaultBorderWidth;
            dataset.pointRadius = defaultPointRadius;
          });
          chart.update("none");
        }
      }
    },
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (chart) {
      chart.data.datasets.forEach((dataset) => {
        dataset.borderWidth = defaultBorderWidth;
        dataset.pointRadius = defaultPointRadius;
      });
      chart.update("none");
    }
  }, [compareMode, metrics, chartData]);

  const yearToggle = showYearSwitcher && (
    <div className="flex items-center gap-0.5 bg-gray-100 p-0.5">
      {detectedYears.map((year) => (
        <button
          key={year}
          onClick={() => setActiveYear(year)}
          style={{
            // Small white-chip-on-gray-track segment, matching the footer's
            // view switcher but a size down — it is a scope filter, not a
            // primary action, so it should not read as a pair of buttons.
            fontSize: 10,
            fontWeight: 700,
            fontFamily: MONO,
            padding: "2px 7px",
            borderRadius: 0,
            border: "none",
            background: activeYear === year ? chartChrome.toggleActiveBg : "transparent",
            color: activeYear === year ? chartChrome.toggleActiveText : chartChrome.toggleInactiveText,
            cursor: "pointer",
            transition: "background-color 0.15s, color 0.15s",
          }}
        >
          {year}
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-full h-full overflow-hidden relative">
      {/* Rendered in the widget header (via portal) when a target is
          supplied, so it doesn't eat into the plot area; falls back to
          floating inside the chart if no portal target exists yet. */}
      {yearToggle && yearTogglePortal
        ? createPortal(yearToggle, yearTogglePortal)
        : yearToggle && (
            <div className="flex items-center justify-end gap-1 px-5 pt-2 pb-1">
              {yearToggle}
            </div>
          )}
      <div className="h-full w-full relative z-10">
        <Line ref={chartRef} data={processedChartData} options={options} />
      </div>
    </div>
  );
};

export default LineChartView;
