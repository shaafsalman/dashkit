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
}) => {
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
  const defaultBorderWidth = 7;
  const defaultPointRadius = 5;

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
    else
      formattedValue = decimal
        ? value.toLocaleString()
        : Math.round(value).toLocaleString();

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
              pointBackgroundColor: "#ffffff",
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
            pointBackgroundColor: "#ffffff",
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
          pointBackgroundColor: "#ffffff",
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
        pointBackgroundColor: "#ffffff",
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
        left: 8,
        right: 8,
        top: 10,
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
          pointStyle: "circle",
          padding: 10,
          font: {
            size: isMobile ? 12 : 13,
            weight: "600",
            family: SANS,
          },
          color: "#1e293b",
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "#ffffff",
        titleColor: "#111827",
        bodyColor: "#4B5563",
        borderColor: "#D1D5DB",
        borderWidth: 2,
        cornerRadius: 0,
        padding: 16,
        displayColors: true,
        boxPadding: 6,
        usePointStyle: true,
        titleMarginBottom: 8,
        bodySpacing: 6,
        font: {
          size: isMobile ? 12 : 13,
          family: SANS,
        },
        titleFont: {
          size: isMobile ? 13 : 14,
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
        display: function (context) {
          const chart = context.chart;
          const datasets = chart.data.datasets;
          if (datasets.length <= 1) return true;

          const allValues = [];
          datasets.forEach((ds) => {
            ds.data.forEach((v) => {
              if (v > 0) allValues.push(v);
            });
          });
          const maxVal = Math.max(...allValues);
          const currentVal = context.dataset.data[context.dataIndex];

          if (currentVal < maxVal * 0.05) return false;
          return true;
        },
        anchor: "end",
        align: "top",
        clamp: true,
        offset: function (context) {
          const datasetIndex = context.datasetIndex;
          return datasetIndex === 0 ? 8 : 24;
        },
        color: function (context) {
          return context.dataset.borderColor;
        },
        color: "#1e293b",
        font: {
          size: isMobile ? 10 : 11,
          weight: "700",
          family: MONO,
        },
        formatter: function (value, context) {
          if (value === 0 || value === null || value === undefined) return "";
          return formatValue(value);
        },
        backgroundColor: function (context) {
          return "rgba(255, 255, 255, 0.9)";
        },
        borderColor: function (context) {
          return context.dataset.borderColor + "60";
        },
        borderRadius: 0,
        borderWidth: 1,
        padding: {
          top: 4,
          bottom: 4,
          left: 6,
          right: 6,
        },
        textShadowColor: "rgba(255, 255, 255, 0.8)",
        textShadowBlur: 2,
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: "rgba(148, 163, 184, 0.15)",
          lineWidth: 1,
          drawBorder: true,
          drawOnChartArea: true,
          drawTicks: true,
        },
        ticks: {
          color: "#475569",
          font: {
            size: isMobile ? 11 : 12,
            weight: "600",
            family: SANS,
          },
          maxRotation: isMobile ? 45 : 0,
          padding: 6,
        },
        border: {
          color: "#cbd5e1",
          width: 1,
        },
      },
      y: {
        min: dataRange.min,
        max: dataRange.max,
        grid: {
          display: true,
          color: "rgba(148, 163, 184, 0.15)",
          lineWidth: 1,
          drawBorder: true,
          drawOnChartArea: true,
          drawTicks: true,
        },
        ticks: {
          color: "#475569",
          font: {
            size: isMobile ? 11 : 12,
            weight: "600",
            family: MONO,
          },
          padding: 6,
          callback: function (value) {
            return formatValue(value);
          },
        },
        border: {
          color: "#cbd5e1",
          width: 1,
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
    <div className="flex items-center gap-1">
      {detectedYears.map((year) => (
        <button
          key={year}
          onClick={() => setActiveYear(year)}
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontFamily: MONO,
            padding: "3px 12px",
            borderRadius: 0,
            border: activeYear === year ? "1px solid #1F2937" : "1px solid #D1D5DB",
            background: activeYear === year ? "#1F2937" : "#F9FAFB",
            color: activeYear === year ? "#ffffff" : "#4B5563",
            cursor: "pointer",
            transition: "background-color 0.15s, border-color 0.15s",
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
