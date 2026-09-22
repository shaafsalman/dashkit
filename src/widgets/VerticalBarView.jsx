import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LabelList,
  Tooltip as RechartsTooltip,
} from "recharts";
import { formatLabel } from "./dataUtils.js";
import HoverTooltip from "./HoverTooltip";
import useContainerDensity from "./useContainerDensity.js";
import { AXIS_CATEGORY_TICK, AXIS_VALUE_TICK, AXIS_LINE_PROPS, AXIS_GRID_PROPS } from "../lib/charts/theme";

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// Upper clamps raised across the board: calculateBarSize divides the REAL plot
// width by the bar count, so on a full-width tile every mode was hitting its
// ceiling and drawing thin bars marooned in white space. The minimums are
// unchanged, so narrow tiles behave exactly as before.
const MAX_BAR_WIDTH = 46;
const MIN_BAR_WIDTH = 28;

const COMPARE_MAX_BAR_WIDTH = 34;
const YEAR_MAX_BAR_WIDTH = 42;
const COMBINED_MAX_BAR_WIDTH = 28;

// Compare/year/combined modes render `categories * barsPerGroup` bars in one
// plot (e.g. 12 months x 2 metrics = 24). The old per-mode MIN_BAR_WIDTH
// floors (12/24/14px) and fixed gap percentages were an independent guess
// from the actual bar-size math below — once `categories * barsPerGroup`
// bars at their floor width, plus gaps, exceeded the real measured plotWidth,
// Recharts rendered the excess off-canvas rather than shrinking anything,
// which is why bars silently vanished past a certain month. `computeBarSize`
// is the exact algebraic inverse of Recharts' own layout equation — bar
// width, category gap and bar gap all come from ONE shared source of truth
// (`getDensityTier`, keyed on total bar count) — so the total rendered width
// can never exceed plotWidth, for any category/metric count. There is no
// "target" minimum any more, only a 2px sanity floor.
const ABS_MIN_BAR_WIDTH = 2;

const getDensityTier = (totalBars) => {
  if (totalBars <= 16) return { gapFrac: 0.16, barGapPx: 2 }; // sparse
  if (totalBars <= 32) return { gapFrac: 0.1, barGapPx: 1.5 }; // dense
  return { gapFrac: 0.05, barGapPx: 1 }; // very dense
};

const computeBarSize = (plotWidth, categories, barsPerGroup, modeMax) => {
  const totalBars = categories * barsPerGroup;
  const { gapFrac, barGapPx } = getDensityTier(totalBars);
  const raw =
    (plotWidth * (1 - gapFrac) - categories * (barsPerGroup - 1) * barGapPx) /
    totalBars;
  return Math.max(ABS_MIN_BAR_WIDTH, Math.min(raw, modeMax));
};

// Value-label sizing keyed on the FINAL computed bar width — labels always
// render (never hidden for lack of room, per explicit design ask); below
// ~13px there isn't room for horizontal text at any reasonable size, so the
// label rotates instead of disappearing.
const getLabelSizing = (barSize) => {
  if (barSize >= 24) return { fontSize: 11, rotate: false, compact: false };
  if (barSize >= 18) return { fontSize: 9, rotate: false, compact: false };
  if (barSize >= 13) return { fontSize: 7.5, rotate: false, compact: false };
  if (barSize >= 9) return { fontSize: 6.5, rotate: true, compact: false };
  return { fontSize: 6, rotate: true, compact: true };
};

// 0-decimal M/K for the smallest label tier — formatLabel's fixed .toFixed(1)
// is too wide to fit a rotated 6px label; other chart views depend on
// formatLabel's precision, so this stays local rather than changing it.
const formatCompactLabel = (value) => {
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${Math.round(value / 1000000)}M`;
  if (abs >= 1000) return `${Math.round(value / 1000)}K`;
  return `${Math.round(value)}`;
};

const CHART_MARGINS = {
  // Reserves a clean band for the legend, which floats at top-2 inside the plot
  // box. At the old 16px the tallest bars and their value labels ran straight
  // into it.
  top: 34,
  right: 4,
  // The YAxis now declares an explicit 34px width, so the negative pull-in that
  // used to claw back Recharts' oversized default gutter is no longer needed.
  left: 0,
  bottom: -10,
};

const CHART_MARGINS_HORIZONTAL = {
  top: 10,
  // The value label here renders at LABEL_FONT_SIZE (12px), not 9px — "37.2M"
  // at 12px mono bold is ~38px, plus its own 10px offset from the bar end =
  // ~48px needed; 40 was still clipping it to "37.2" or narrower.
  right: 56,
  // The YAxis width reduction below (90 -> 45) already reclaims the empty
  // band on its own — stacking a MORE negative margin on top of that (as a
  // previous pass did, -45) double-counted the fix and pushed the category
  // labels clean off the left edge, invisible. This only needs to claw back
  // Recharts' small default gutter now, not the whole 90px.
  left: -8,
  bottom: 0,
};

const BAR_CATEGORY_GAP = "22%";
// 22% between rows reads fine for a handful of vertical bars, but stacked
// down a tall horizontal-list tile (8-10 station/route rows) it compounds
// into a lot of dead vertical space between bars that are otherwise packed
// tight — this mode gets its own, tighter default.
const BAR_CATEGORY_GAP_HORIZONTAL = "8%";
const BAR_CATEGORY_GAP_SCROLL = "8%";

// Bumped a step: at 10px the values were the smallest type on the chart while
// being the thing you actually read off it.
const LABEL_FONT_SIZE = "12px";
const LABEL_FONT_SIZE_SCROLL = "10px";

const AXIS_FONT_SIZE = 12;
const AXIS_FONT_SIZE_SCROLL = 8;

const VERTICAL_SCROLL_THRESHOLD = 12;

const INVERSE_MIN_HEIGHT = 300;
const INVERSE_MAX_HEIGHT = 600;
const INVERSE_ITEM_HEIGHT = 45;

const VerticalBarView = ({
  chartData,
  barColor,
  maxValue,
  isInverse = false,
  decimal = true,
  dummyYears = true,
  stacked = false,
  metrics = [],
  relative_percentage = "relative",
  external_sums = [],
  total = false,
  horizontalThreshold = 5,
  showPercentage = false,
  compareColors = [
    "#0f766e",
    "#facc15",
    "#22c55e",
    "#0ea5e9",
    "#22c55e",
    "#a8a89f",
    "#d7c8b3",
    "#0ea5e9",
    "#e1d0c6",
    "#d1d5db",
    "#9ca3af",
    "#6b7280",
    "#0f172a",
    "#000000",
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#14b8a6",
    "#96ceb4",
    "#ffeaa7",
    "#dda0dd",
    "#ffa07a",
    "#20b2aa",
    "#87ceeb",
    "#deb887",
    "#cd853f",
    "#bc8f8f",
    "#708090",
    "#2f4f4f",
    "#8b4513",
  ],
  yearTogglePortal = null,
  // Portal target for the compare-mode metric legend — the ranked widget's
  // own footer (centered), instead of floating over the plot where it ate
  // into the bars' vertical room.
  legendPortal = null,
}) => {
  const [hoveredBar, setHoveredBar] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedYear, setSelectedYear] = useState(null);
  // Legend entries double as visibility toggles; a hidden series' dataKey lives
  // here and its bars are filtered out of the chart.
  const [hiddenSeries, setHiddenSeries] = useState(() => new Set());

  const toggleSeries = (key) =>
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // Real rendered width of this chart, so bar sizing scales with the bento tile
  // instead of assuming a fixed 400px plot.
  const [plotRef, , measuredWidth] = useContainerDensity();

  const generateTickValues = (maxVal) => {
    const roundedMax = Math.ceil(maxVal / 5) * 5;
    const tickCount = 5;
    return Array.from(
      { length: tickCount },
      (_, i) => Math.round((roundedMax * i) / (tickCount - 1) / 5) * 5,
    );
  };

  const isMonthlyData = (data) => {
    const monthNames = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];

    const monthAbbreviations = [
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

    return data.some((item) => {
      const name = item.name?.toLowerCase();
      const nameWithoutYear = name?.split(/[-\s]\d{4}/)[0]?.trim();
      const monthPart = name?.split(/[-\s]/)[0]?.trim();

      return (
        monthNames.includes(name) ||
        monthNames.includes(nameWithoutYear) ||
        monthNames.includes(monthPart) ||
        monthAbbreviations.includes(name) ||
        monthAbbreviations.includes(nameWithoutYear) ||
        monthAbbreviations.includes(monthPart)
      );
    });
  };

  const extractYearFromName = (name) => {
    if (!name) return null;
    const match = name.match(/(\d{2,4})$/);
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
    const monthPart = name.toLowerCase().split(/[-\s]/)[0]?.trim();
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

  const detectedYears = detectMultipleYears(chartData);
  const hasMultipleYears = detectedYears.length > 1;
  const hasMultipleMetrics = stacked && metrics.length > 1;
  const isCompareMode = hasMultipleMetrics && !hasMultipleYears;
  const isCombinedMode = hasMultipleYears && hasMultipleMetrics;

  useEffect(() => {
    if (isCombinedMode && detectedYears.length > 0 && !selectedYear) {
      setSelectedYear(detectedYears[detectedYears.length - 1]);
    }
  }, [isCombinedMode, detectedYears, selectedYear]);

  const activeYear = isCombinedMode ? selectedYear : null;

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
        groupedByMonth[month] = {
          name: month,
          originalName: month,
        };
      }

      if (stacked && metrics.length > 1) {
        metrics.forEach((metric) => {
          const key = `${metric.key}_${year}`;
          groupedByMonth[month][key] = item[metric.key] || 0;
        });
      } else {
        const key = `value_${year}`;
        groupedByMonth[month][key] =
          typeof item.rawValue === "number" ? item.rawValue : item.value || 0;
      }
    });

    const result = Object.values(groupedByMonth).sort((a, b) => {
      const aIndex = monthOrder.indexOf(a.name.toLowerCase());
      const bIndex = monthOrder.indexOf(b.name.toLowerCase());
      return aIndex - bIndex;
    });

    result.forEach((item) => {
      let totalValue = 0;
      if (stacked && metrics.length > 1) {
        years.forEach((year) => {
          metrics.forEach((metric) => {
            totalValue += item[`${metric.key}_${year}`] || 0;
          });
        });
      } else {
        years.forEach((year) => {
          totalValue += item[`value_${year}`] || 0;
        });
      }
      item.totalValue = totalValue;

      if (total) {
        let groupTotal = 0;
        years.forEach((year) => {
          let yearTotal = 0;
          metrics.forEach((metric) => {
            yearTotal += item[`${metric.key}_${year}`] || 0;
          });
          item[`totalSum_${year}`] = yearTotal;
          groupTotal += yearTotal;
        });
        item.groupTotal = groupTotal;
      }
    });

    return result;
  };

  const addMissingYears = (data) => {
    if (!dummyYears) return data;

    const isMonthData = isMonthlyData(data);

    if (!isMonthData) return data;

    const sampleItem = data.find((item) => /\d{2,4}/.test(item.name));

    let yearSuffix = "";

    if (sampleItem) {
      const yearMatch = sampleItem.name.match(/(\d{2,4})/);
      if (yearMatch) {
        let year = yearMatch[1];
        if (sampleItem.name.includes(" ")) {
          yearSuffix = " " + year;
        } else {
          yearSuffix = "-" + year;
        }
      }
    }

    const allMonths = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const existingMonths = new Set(
      data.map((item) => {
        const name = item.name?.toLowerCase();
        const monthPart = name?.split(/[-\s]/)[0]?.trim();
        return monthPart || name;
      }),
    );

    const completeData = [...data];

    allMonths.forEach((month) => {
      const monthKey = month.toLowerCase();
      if (!existingMonths.has(monthKey)) {
        const newDataPoint = {
          name: month + yearSuffix,
          value: 0,
          rawValue: 0,
        };

        if (stacked && metrics.length > 1) {
          metrics.forEach((metric) => {
            newDataPoint[metric.key] = 0;
          });
          newDataPoint.totalValue = 0;
        }

        completeData.push(newDataPoint);
      }
    });

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
    return completeData.sort((a, b) => {
      const aMonth = a.name?.toLowerCase().split(/[-\s]/)[0]?.trim();
      const bMonth = b.name?.toLowerCase().split(/[-\s]/)[0]?.trim();
      const aIndex = monthOrder.indexOf(aMonth);
      const bIndex = monthOrder.indexOf(bMonth);
      return aIndex - bIndex;
    });
  };

  const sortMonthlyData = (data) => {
    if (!isMonthlyData(data)) return data;

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

    return [...data].sort((a, b) => {
      const aMonth = a.name?.toLowerCase().split(/[-\s]/)[0]?.trim();
      const bMonth = b.name?.toLowerCase().split(/[-\s]/)[0]?.trim();
      const aIndex = monthOrder.indexOf(aMonth);
      const bIndex = monthOrder.indexOf(bMonth);

      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    });
  };

  const filterZeroValueItems = (data) => {
    if (!stacked || metrics.length <= 1) return data;

    return data.filter((item) => {
      const hasNonZeroValues = metrics.some((metric) => {
        const value = item[metric.key] || 0;
        return value > 0;
      });

      const isMonthData = isMonthlyData(data);
      const isDummyMonth =
        isMonthData &&
        metrics.every((metric) => {
          const value = item[metric.key] || 0;
          return value === 0;
        }) &&
        item.value === 0 &&
        item.rawValue === 0;

      return hasNonZeroValues || (isDummyMonth && dummyYears);
    });
  };

  const findExternalReference = (itemName) => {
    if (!external_sums || external_sums.length === 0) return null;
    return external_sums.find((external) => external.name === itemName);
  };

  const getExternalReferenceValue = (externalItem) => {
    if (!externalItem) return 0;

    const possibleKeys = ["revenue", "netRevenue", "total", "totalRevenue"];
    for (const key of possibleKeys) {
      if (externalItem[key] !== undefined && externalItem[key] !== null) {
        return externalItem[key];
      }
    }

    const numericKeys = Object.keys(externalItem).filter(
      (key) => typeof externalItem[key] === "number" && key !== "rank",
    );

    return numericKeys.length > 0 ? externalItem[numericKeys[0]] : 0;
  };

  const isYearMode = hasMultipleYears && !hasMultipleMetrics;
  const isSpecialMode = isCompareMode || isYearMode || isCombinedMode;

  const groupedData = hasMultipleYears
    ? groupDataByMonth(chartData, detectedYears)
    : null;

  let dataWithMissingYears = hasMultipleYears
    ? groupedData
    : addMissingYears(chartData);
  dataWithMissingYears = hasMultipleYears
    ? dataWithMissingYears
    : sortMonthlyData(dataWithMissingYears);

  if (stacked && metrics.length > 1 && !hasMultipleYears) {
    dataWithMissingYears = filterZeroValueItems(dataWithMissingYears);
  }

  const totalSum = dataWithMissingYears.reduce((sum, item) => {
    if (hasMultipleYears) {
      return sum + (item.totalValue || 0);
    }
    if (stacked && item.totalValue !== undefined) {
      return sum + item.totalValue;
    }
    return (
      sum + (typeof item.rawValue === "number" ? item.rawValue : item.value)
    );
  }, 0);

  const calculateMetricSums = () => {
    if (!stacked || metrics.length <= 1) return {};

    const metricSums = {};

    if (hasMultipleYears) {
      detectedYears.forEach((year) => {
        metrics.forEach((metric) => {
          const key = `${metric.key}_${year}`;
          metricSums[key] = dataWithMissingYears.reduce((sum, item) => {
            return sum + (item[key] || 0);
          }, 0);
        });
      });
    } else {
      metrics.forEach((metric) => {
        metricSums[metric.key] = dataWithMissingYears.reduce((sum, item) => {
          return sum + (item[metric.key] || 0);
        }, 0);
      });
    }

    return metricSums;
  };

  const metricSums = calculateMetricSums();

  const processedChartData = dataWithMissingYears.map((item, index) => {
    const formatMonthName = (name) => {
      if (typeof name === "string") {
        const lowerName = name.toLowerCase();
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
        };
        return monthMap[lowerName] || name;
      }
      return name;
    };

    if (hasMultipleYears) {
      const totalPercentage =
        totalSum > 0 ? (item.totalValue / totalSum) * 100 : 0;

      const processedItem = {
        ...item,
        index,
        name: formatMonthName(item.name),
        displayTotalValue: decimal
          ? item.totalValue
          : Math.round(item.totalValue),
        displayPercentage: decimal
          ? Math.round(totalPercentage * 10) / 10
          : Math.round(totalPercentage),
        originalName: item.name,
      };

      return processedItem;
    }

    if (stacked && item.totalValue !== undefined) {
      const totalPercentage =
        totalSum > 0 ? (item.totalValue / totalSum) * 100 : 0;

      const processedItem = {
        ...item,
        index,
        name: formatMonthName(item.name),
        displayTotalValue: decimal
          ? item.totalValue
          : Math.round(item.totalValue),
        displayPercentage: decimal
          ? Math.round(totalPercentage * 10) / 10
          : Math.round(totalPercentage),
        originalName: item.name,
      };

      const groupTotal = metrics.reduce((sum, metric) => {
        return sum + (item[metric.key] || 0);
      }, 0);
      processedItem.groupTotal = groupTotal;

      if (relative_percentage === "relative") {
        const metricValues = metrics.map((metric) => {
          const value = item[metric.key] || 0;
          return value;
        });
        const maxValueInItem = Math.max(...metricValues, 0);
        processedItem.maxValueInItem = maxValueInItem;
        processedItem.relativePercentages = {};

        metrics.forEach((metric) => {
          const value = item[metric.key] || 0;
          const percentage =
            maxValueInItem > 0 ? (value / maxValueInItem) * 100 : 0;
          processedItem.relativePercentages[metric.key] = percentage;
        });
      } else if (relative_percentage === "group_total") {
        processedItem.groupPercentages = {};
        metrics.forEach((metric) => {
          const value = item[metric.key] || 0;
          const percentage = groupTotal > 0 ? (value / groupTotal) * 100 : 0;
          processedItem.groupPercentages[metric.key] = percentage;
        });
      } else if (relative_percentage === "external") {
        const externalRef = findExternalReference(item.name);
        const externalRefValue = getExternalReferenceValue(externalRef);
        processedItem.externalReference = externalRef;
        processedItem.externalReferenceValue = externalRefValue;
        processedItem.externalPercentages = {};

        metrics.forEach((metric) => {
          const value = item[metric.key] || 0;
          const percentage =
            externalRefValue > 0 ? (value / externalRefValue) * 100 : 0;
          processedItem.externalPercentages[metric.key] = percentage;
        });
      }

      metrics.forEach((metric) => {
        if (item[metric.key] !== undefined) {
          processedItem[metric.key] = item[metric.key];
        }
      });

      if (total) {
        processedItem.totalSum = groupTotal;
      }

      return processedItem;
    } else {
      const rawValue =
        typeof item.rawValue === "number" ? item.rawValue : item.value;
      const totalPercentage = totalSum > 0 ? (rawValue / totalSum) * 100 : 0;

      return {
        ...item,
        index,
        name: formatMonthName(item.name),
        displayValue: decimal ? rawValue : Math.round(rawValue),
        displayPercentage: decimal
          ? Math.round(totalPercentage * 10) / 10
          : Math.round(totalPercentage),
        originalName: item.name,
      };
    }
  });

  const formatAxisValue = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    }
    return value.toString();
  };

  const isMonthly = isMonthlyData(dataWithMissingYears) || hasMultipleYears;

  const finalChartData =
    chartData.length < horizontalThreshold && !isMonthly
      ? [
          ...processedChartData,
          ...Array.from(
            { length: Math.max(6, 8 - chartData.length) },
            (_, i) => ({
              name: ``,
              displayValue: 0,
              value: 0,
              rawValue: 0,
              displayPercentage: 0,
              index: processedChartData.length + i,
              originalName: ``,
            }),
          ),
        ]
      : processedChartData;

  const calculateInverseHeight = () => {
    const calculatedHeight = Math.max(
      INVERSE_MIN_HEIGHT,
      dataWithMissingYears.length * INVERSE_ITEM_HEIGHT + 100,
    );
    return Math.min(calculatedHeight, INVERSE_MAX_HEIGHT);
  };

  // Overflow is a property of this component's box, not of the browser
  // viewport. A 300px card inside a desktop dashboard needs the same density
  // behavior as a 300px card on a phone.
  const responsivePlotWidth = Math.max((measuredWidth || 400) - 40, 160);
  const categoryCapacity = Math.max(3, Math.floor(responsivePlotWidth / 64));
  const shouldScrollVertical =
    isInverse && dataWithMissingYears.length > VERTICAL_SCROLL_THRESHOLD;
  const shouldScrollHorizontal =
    !isInverse &&
    !isMonthly &&
    dataWithMissingYears.length > categoryCapacity;
  const inverseHeight = shouldScrollVertical
    ? INVERSE_MAX_HEIGHT
    : calculateInverseHeight();

  // Bar widths used to divide a hardcoded 400px, so a chart in a 9-column tile
  // drew the same skinny bars as one in a 3-column tile. Divide the REAL plot
  // width instead (minus the axis gutter) so bars grow with the tile; the
  // existing MIN/MAX clamps still bound the result.
  const plotWidth = responsivePlotWidth;

  const calculateBarSize = () => {
    if (isCombinedMode) {
      const totalBarsPerGroup = metrics.length + (total ? 1 : 0);
      return computeBarSize(
        plotWidth,
        dataWithMissingYears.length,
        totalBarsPerGroup,
        COMBINED_MAX_BAR_WIDTH,
      );
    }

    if (isYearMode) {
      return computeBarSize(
        plotWidth,
        dataWithMissingYears.length,
        detectedYears.length,
        YEAR_MAX_BAR_WIDTH,
      );
    }

    if (isCompareMode) {
      const totalBarsPerGroup = metrics.length + (total ? 1 : 0);
      return computeBarSize(
        plotWidth,
        dataWithMissingYears.length,
        totalBarsPerGroup,
        COMPARE_MAX_BAR_WIDTH,
      );
    }

    if (isInverse) {
      const size = shouldScrollVertical
        ? MIN_BAR_WIDTH
        : Math.min(
            MAX_BAR_WIDTH,
            Math.max(MIN_BAR_WIDTH, 320 / dataWithMissingYears.length),
          );
      return Math.max(MIN_BAR_WIDTH, Math.min(size, MAX_BAR_WIDTH));
    }

    const size = shouldScrollHorizontal
      ? Math.min(
          MAX_BAR_WIDTH,
          Math.max(MIN_BAR_WIDTH, plotWidth / dataWithMissingYears.length),
        )
      : Math.min(
          MAX_BAR_WIDTH,
          Math.max(MIN_BAR_WIDTH, plotWidth / dataWithMissingYears.length),
        );

    return Math.max(MIN_BAR_WIDTH, Math.min(size, MAX_BAR_WIDTH));
  };

  const calculateChartWidth = () => {
    if (!shouldScrollHorizontal) return "100%";
    // One readable category slot per item. The old 1200px hard floor made a
    // six-item chart comically wide; the new width grows only as much as the
    // actual category count requires.
    return Math.max(measuredWidth || 0, dataWithMissingYears.length * 64 + 56);
  };

  const categoryTickInterval = isMonthly
    ? Math.max(0, Math.ceil(dataWithMissingYears.length / categoryCapacity) - 1)
    : 0;

  // Shared with AreaChartView/LineChartView via the `maxValue` prop
  // (computed once in RankedDataWidget's sharedMaxValue) so the Y-axis stops
  // moving when the view type switches. Compare/combined mode's stacked-sum
  // ceiling is computed there too, matching this component's own
  // `totalValue`/chartData math instead of re-deriving it independently here.
  const compareMaxValue = maxValue;

  const handleChartMouseMove = (e) => {
    if (!e || e.activeTooltipIndex === undefined) {
      setHoveredBar(null);
      return;
    }
    setHoveredBar(e.activeTooltipIndex);

    if (e.activePayload && e.activePayload.length > 0) {
      setMousePosition({
        x: e.chartX || 0,
        y: e.chartY || 0,
      });
    }
  };

  const handleChartMouseLeave = () => {
    setHoveredBar(null);
  };

  const getBarColor = (index, metricIndex = 0) => {
    if (isSpecialMode) {
      if (metricIndex === 0 && total && (isCompareMode || isCombinedMode)) {
        const blueColor = "#0ea5e9";
        if (hoveredBar === index) {
          const hex = blueColor.replace("#", "");
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          const darkenedR = Math.max(0, Math.floor(r * 0.62));
          const darkenedG = Math.max(0, Math.floor(g * 0.62));
          const darkenedB = Math.max(0, Math.floor(b * 0.62));
          return `#${darkenedR.toString(16).padStart(2, "0")}${darkenedG
            .toString(16)
            .padStart(2, "0")}${darkenedB.toString(16).padStart(2, "0")}`;
        }
        return `${blueColor}E6`;
      }

      const adjustedIndex =
        total && (isCompareMode || isCombinedMode)
          ? metricIndex - 1
          : metricIndex;
      const color = compareColors[adjustedIndex % compareColors.length];
      if (hoveredBar === index) {
        const hex = color.replace("#", "");
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const darkenedR = Math.max(0, Math.floor(r * 0.62));
        const darkenedG = Math.max(0, Math.floor(g * 0.62));
        const darkenedB = Math.max(0, Math.floor(b * 0.62));
        return `#${darkenedR.toString(16).padStart(2, "0")}${darkenedG
          .toString(16)
          .padStart(2, "0")}${darkenedB.toString(16).padStart(2, "0")}`;
      }
      return `${color}E6`;
    } else {
      if (hoveredBar === index) {
        const hex = barColor.replace("#", "");
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const darkenedR = Math.max(0, Math.floor(r * 0.62));
        const darkenedG = Math.max(0, Math.floor(g * 0.62));
        const darkenedB = Math.max(0, Math.floor(b * 0.62));
        return `#${darkenedR.toString(16).padStart(2, "0")}${darkenedG
          .toString(16)
          .padStart(2, "0")}${darkenedB.toString(16).padStart(2, "0")}`;
      }
      return `${barColor}E6`;
    }
  };

  // Same shared density tier calculateBarSize() uses, keyed on the SAME total
  // bar count per mode — gap and bar-size were previously two independent,
  // unsynced sources of truth, which was part of what let bars overflow.
  const getSpecialModeTotalBars = () => {
    if (isCombinedMode || isCompareMode) {
      return dataWithMissingYears.length * (metrics.length + (total ? 1 : 0));
    }
    if (isYearMode) {
      return dataWithMissingYears.length * detectedYears.length;
    }
    return null;
  };

  const getBarCategoryGap = () => {
    const totalBars = getSpecialModeTotalBars();
    if (totalBars !== null) {
      return `${getDensityTier(totalBars).gapFrac * 100}%`;
    }
    if (isInverse) return BAR_CATEGORY_GAP_HORIZONTAL;
    return shouldScrollHorizontal ? BAR_CATEGORY_GAP_SCROLL : BAR_CATEGORY_GAP;
  };

  const getBarGap = () => {
    const totalBars = getSpecialModeTotalBars();
    return totalBars !== null ? getDensityTier(totalBars).barGapPx : 0;
  };

  // Only used by the default (single-series) bar render now — compare/year/
  // combined modes size their labels off the actual computed bar width via
  // getLabelSizing() instead.
  const getLabelFontSize = () =>
    shouldScrollHorizontal ? LABEL_FONT_SIZE_SCROLL : LABEL_FONT_SIZE;

  const renderYearToggle = () => {
    if (!isCombinedMode || detectedYears.length <= 1) return null;

    // Light segmented track: the selected year is a white chip on gray rather
    // than a solid black fill, so it reads as scope rather than as a primary
    // action competing with the metric selector beside it.
    // Plain text years with an underline on the active one — same language as
    // the metric selector beside it. The boxed segmented track read as a third
    // competing control group in an already busy header.
    const toggle = (
      <div className="flex items-center gap-2.5">
        {detectedYears.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`relative pb-0.5 text-[11px] font-bold transition-colors duration-150 ${
              selectedYear === year
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
            style={{ fontFamily: MONO }}
          >
            {year}
            <span
              className={`absolute inset-x-0 -bottom-px h-[2px] ${
                selectedYear === year ? "bg-gray-900" : "bg-transparent"
              }`}
            />
          </button>
        ))}
      </div>
    );

    return yearTogglePortal
      ? createPortal(toggle, yearTogglePortal)
      : (
        <div className="absolute top-2 right-2 z-20 bg-white p-1 border-2 border-gray-300">
          {toggle}
        </div>
      );
  };

  const renderLegend = () => {
    if (!isSpecialMode) return null;
    if (isCompareMode && metrics.length <= 1) return null;

    const legendItems = [];

    if (isCombinedMode && activeYear) {
      if (total) {
        legendItems.push({
          key: `totalSum_${activeYear}`,
          label: `Total`,
        });
      }
      metrics.forEach((metric) => {
        legendItems.push({
          key: `${metric.key}_${activeYear}`,
          label: metric.label,
        });
      });
    } else if (hasMultipleYears && !isCombinedMode) {
      if (stacked && metrics.length > 1) {
        detectedYears.forEach((year) => {
          if (total) {
            legendItems.push({
              key: `totalSum_${year}`,
              label: `Total ${year}`,
            });
          }
          metrics.forEach((metric) => {
            legendItems.push({
              key: `${metric.key}_${year}`,
              label: `Total ${year}`,
            });
          });
        });
      } else {
        detectedYears.forEach((year) => {
          legendItems.push({
            key: `value_${year}`,
            label: year,
          });
        });
      }
    } else {
      if (total) {
        legendItems.push({
          key: "totalSum",
          label: "Total",
        });
      }
      legendItems.push(...metrics);
    }

    // Right-aligned, matching the Area/Line chart legend placement. The year
    // toggle now portals into the widget header, so the legend no longer has to
    // duck below it — it only still does when there is no portal target and the
    // toggle falls back to rendering inline at top-right.
    const topOffset =
      !yearTogglePortal && isCombinedMode && detectedYears.length > 1
        ? "top-12"
        : "top-2";

    const legendContent = (
        <div className={`flex flex-row flex-wrap gap-y-1 ${legendPortal ? "justify-center gap-1 md:gap-2" : "justify-end space-x-1 md:space-x-2"}`}>
          {legendItems.map((metric, index) => {
            const hidden = hiddenSeries.has(metric.key);
            const swatch =
              (isCompareMode || isCombinedMode) &&
              index === 0 &&
              total &&
              (metric.key === "totalSum" ||
                metric.key.startsWith("totalSum_"))
                ? "#0ea5e9"
                : compareColors[
                    ((isCompareMode || isCombinedMode) && total
                      ? index - 1
                      : index) % compareColors.length
                  ];
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => toggleSeries(metric.key)}
                title={hidden ? `Show ${metric.label}` : `Hide ${metric.label}`}
                className="flex items-center space-x-1 md:space-x-2 cursor-pointer transition-opacity duration-150 hover:opacity-70"
              >
                {/* Hidden series keep their swatch outlined rather than filled,
                    so the row still reads as "this series exists, it is off". */}
                <div
                  className="w-2 h-2 md:w-3 md:h-3 rounded-sm border"
                  style={{
                    backgroundColor: hidden ? "transparent" : swatch,
                    borderColor: swatch,
                  }}
                />
                <span
                  className={`text-[10px] md:text-xs font-medium transition-colors duration-150 ${
                    hidden ? "text-gray-400 line-through" : "text-gray-700"
                  }`}
                >
                  {metric.label}
                </span>
              </button>
            );
          })}
        </div>
    );

    return legendPortal ? (
      createPortal(legendContent, legendPortal)
    ) : (
      <div className={`absolute ${topOffset} right-2 bg-transparent z-10`}>
        {legendContent}
      </div>
    );
  };

  const renderCompareBars = () => {
    const barsToRender = [];
    // Labels always render now (never hidden for lack of room) — sizing and,
    // below ~13px, rotation is keyed on the ACTUAL computed bar width so text
    // never collides with its neighbour instead of just disappearing.
    const labelSizing = getLabelSizing(calculateBarSize());

    if (isCombinedMode && activeYear) {
      if (total) {
        barsToRender.push({
          key: `totalSum_${activeYear}`,
          label: `Total`,
          year: activeYear,
        });
      }
      metrics.forEach((metric) => {
        barsToRender.push({
          key: `${metric.key}_${activeYear}`,
          label: metric.label,
          year: activeYear,
          originalMetric: metric,
        });
      });
    } else if (hasMultipleYears && !isCombinedMode) {
      if (stacked && metrics.length > 1) {
        detectedYears.forEach((year) => {
          if (total) {
            barsToRender.push({
              key: `totalSum_${year}`,
              label: `Total ${year}`,
              year,
            });
          }
          metrics.forEach((metric) => {
            barsToRender.push({
              key: `${metric.key}_${year}`,
              label: `${metric.label} ${year}`,
              year,
              originalMetric: metric,
            });
          });
        });
      } else {
        detectedYears.forEach((year) => {
          barsToRender.push({
            key: `value_${year}`,
            label: year,
            year,
          });
        });
      }
    } else {
      if (total) {
        barsToRender.push({
          key: "totalSum",
          label: "Total",
        });
      }
      barsToRender.push(...metrics);
    }

    // Index is kept from the unfiltered list so a series keeps its color when
    // another one is toggled off.
    return barsToRender
      .map((metric, index) => ({ metric, index }))
      .filter(({ metric }) => !hiddenSeries.has(metric.key))
      .map(({ metric, index }) => (
      <Bar
        key={metric.key}
        dataKey={metric.key}
        radius={[0, 0, 0, 0]}
        animationDuration={0}
        isAnimationActive={false}
        style={{ cursor: "pointer" }}
      >
        {processedChartData.map((entry, dataIndex) => (
          <Cell
            key={`cell-${metric.key}-${dataIndex}`}
            fill={getBarColor(dataIndex, index)}
            style={{
              cursor: "pointer",
              transition: "fill 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        ))}
        {(() => {
          // Returns { main, sub } — main is always the formatted value; sub
          // is the matching percentage text (or null when no percentage
          // applies), rendered as its own line below main, matching the
          // comparison chart's BarLabel (bold value / lighter % stacked
          // underneath) instead of one "value %" string on one line.
          const getLabelParts = (value) => {
            // A month with no data for this metric arrives as undefined, not
            // 0 — undefined <= 0 is false, not a guard, so it used to fall
            // through into the formatting branches below and render literal
            // "undefined"/"undefined%" text once the overflow bug (above)
            // stopped hiding those off-canvas bars.
            if (!Number.isFinite(value) || value <= 0) return null;

            const formattedValue = labelSizing.compact
              ? formatCompactLabel(value)
              : formatLabel(value, decimal);
            const pct = (p) => (decimal ? Math.round(p * 10) / 10 : Math.round(p));

            if (isCombinedMode && activeYear && barsToRender.length > 1) {
              if (metric.key.startsWith("totalSum_")) {
                return { main: formattedValue, sub: null };
              }
              if (relative_percentage === "conventional_scale") {
                const metricSum = metricSums[metric.key] || 0;
                if (metricSum === 0) return { main: formattedValue, sub: null };
                return { main: formattedValue, sub: `${pct((value / metricSum) * 100)}%` };
              }
            }

            if (hasMultipleYears && stacked && barsToRender.length > 1 && !isCombinedMode) {
              if (metric.key.startsWith("totalSum_")) {
                return { main: formattedValue, sub: null };
              }
              if (relative_percentage === "conventional_scale") {
                const metricSum = metricSums[metric.key] || 0;
                if (metricSum === 0) return { main: formattedValue, sub: null };
                return { main: formattedValue, sub: `${pct((value / metricSum) * 100)}%` };
              }
            }

            if (isCompareMode && barsToRender.length > 1) {
              if (metric.key === "totalSum") {
                return { main: formattedValue, sub: "100%" };
              }

              if (relative_percentage === "relative") {
                const matchingItem = processedChartData.find((item) => {
                  const itemValue = item[metric.key];
                  return Math.abs(itemValue - value) < 0.01;
                });
                if (matchingItem) {
                  const allMetricValues = metrics.map((m) => matchingItem[m.key] || 0);
                  const maxValueInItem = Math.max(...allMetricValues, 0);
                  const percentage = maxValueInItem > 0 ? (value / maxValueInItem) * 100 : 0;
                  if (percentage > 0) return { main: formattedValue, sub: `${pct(percentage)}%` };
                }
              } else if (relative_percentage === "group_total") {
                const matchingItem = processedChartData.find((item) => {
                  const itemValue = item[metric.key];
                  return Math.abs(itemValue - value) < 0.01;
                });
                if (matchingItem && matchingItem.groupTotal > 0) {
                  return { main: formattedValue, sub: `${pct((value / matchingItem.groupTotal) * 100)}%` };
                }
              } else if (relative_percentage === "conventional_scale") {
                const metricSum = metricSums[metric.key] || 0;
                if (metricSum === 0) return { main: formattedValue, sub: null };
                return { main: formattedValue, sub: `${pct((value / metricSum) * 100)}%` };
              } else if (relative_percentage === "external") {
                const matchingItem = processedChartData.find((item) => {
                  const itemValue = item[metric.key];
                  return Math.abs(itemValue - value) < 0.01;
                });
                if (matchingItem && matchingItem.externalReferenceValue > 0) {
                  return {
                    main: formattedValue,
                    sub: `${pct((value / matchingItem.externalReferenceValue) * 100)}%`,
                  };
                }
              }
            }

            return { main: formattedValue, sub: null };
          };

          // Recharts' default LabelList renderer can't rotate text, and below
          // ~13px bars there's no horizontal room for even the smallest
          // reasonable font — a custom `content` renderer is required (not
          // optional) to keep labels always visible instead of colliding or
          // getting clipped.
          return (
            <LabelList
              dataKey={metric.key}
              isAnimationActive={false}
              content={(labelProps) => {
                const { x, y, width, value } = labelProps;
                const parts = getLabelParts(value);
                if (!parts) return null;
                const cx = x + width / 2;
                const mainStyle = {
                  fontSize: labelSizing.fontSize,
                  fill: "var(--chart-tick-strong)",
                  fontWeight: 700,
                  fontFamily: MONO,
                  letterSpacing: "-0.02em",
                };
                const subStyle = {
                  fontSize: Math.max(labelSizing.fontSize - 2, 6),
                  fill: "var(--chart-tick-dim)",
                  fontWeight: 600,
                  fontFamily: MONO,
                };

                if (labelSizing.rotate) {
                  // Too little width to stack two lines legibly — one
                  // combined line, same as the always-show guarantee below.
                  const text = parts.sub ? `${parts.main} ${parts.sub}` : parts.main;
                  const labelY = y - 6;
                  return (
                    <text
                      x={cx}
                      y={labelY}
                      textAnchor="start"
                      transform={`rotate(-90 ${cx} ${labelY})`}
                      style={mainStyle}
                    >
                      {text}
                    </text>
                  );
                }

                // Two stacked lines — bold value on top, lighter percentage
                // directly below it, closer to the bar cap. Same layout for
                // every bar (no alternating/staggered heights).
                const subY = y - 5;
                const mainY = parts.sub ? subY - (labelSizing.fontSize + 2) : y - 6;
                return (
                  <>
                    <text x={cx} y={mainY} textAnchor="middle" style={mainStyle}>
                      {parts.main}
                    </text>
                    {parts.sub && (
                      <text x={cx} y={subY} textAnchor="middle" style={subStyle}>
                        {parts.sub}
                      </text>
                    )}
                  </>
                );
              }}
            />
          );
        })()}
      </Bar>
    ));
  };

  const renderCompareBarsHorizontal = () => {
    const barsToRender = [];

    if (isCombinedMode && activeYear) {
      if (total) {
        barsToRender.push({
          key: `totalSum_${activeYear}`,
          label: `Total`,
          year: activeYear,
        });
      }
      metrics.forEach((metric) => {
        barsToRender.push({
          key: `${metric.key}_${activeYear}`,
          label: metric.label,
          year: activeYear,
          originalMetric: metric,
        });
      });
    } else if (hasMultipleYears && !isCombinedMode) {
      if (stacked && metrics.length > 1) {
        detectedYears.forEach((year) => {
          if (total) {
            barsToRender.push({
              key: `totalSum_${year}`,
              label: `Total ${year}`,
              year,
            });
          }
          metrics.forEach((metric) => {
            barsToRender.push({
              key: `${metric.key}_${year}`,
              label: `${metric.label} ${year}`,
              year,
              originalMetric: metric,
            });
          });
        });
      } else {
        detectedYears.forEach((year) => {
          barsToRender.push({
            key: `value_${year}`,
            label: year,
            year,
          });
        });
      }
    } else {
      if (total) {
        barsToRender.push({
          key: "totalSum",
          label: "Total",
        });
      }
      barsToRender.push(...metrics);
    }

    // Index is kept from the unfiltered list so a series keeps its color when
    // another one is toggled off.
    return barsToRender
      .map((metric, index) => ({ metric, index }))
      .filter(({ metric }) => !hiddenSeries.has(metric.key))
      .map(({ metric, index }) => (
      <Bar
        key={metric.key}
        dataKey={metric.key}
        radius={[0, 0, 0, 0]}
        animationDuration={0}
        isAnimationActive={false}
        style={{ cursor: "pointer" }}
      >
        {processedChartData.map((entry, dataIndex) => (
          <Cell
            key={`cell-${metric.key}-${dataIndex}`}
            fill={getBarColor(dataIndex, index)}
            style={{
              cursor: "pointer",
              transition: "fill 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        ))}
        <LabelList
          dataKey={metric.key}
          position="right"
          isAnimationActive={false}
          formatter={(value, entry, listIndex) => {
            // A month with no data for this metric arrives as undefined, not
            // 0 — undefined <= 0 is false, not a guard, so it used to fall
            // through into the formatting branches below and render literal
            // "undefined"/"undefined%" text once the overflow bug (above)
            // stopped hiding those off-canvas bars.
            if (!Number.isFinite(value) || value <= 0) return "";

            const formattedValue = formatLabel(value, decimal);

            if (isCombinedMode && activeYear && barsToRender.length > 1) {
              if (metric.key.startsWith("totalSum_")) {
                return `${formattedValue}`;
              }

              if (relative_percentage === "conventional_scale") {
                const metricSum = metricSums[metric.key] || 0;
                if (metricSum === 0) return formattedValue;

                const percentage = (value / metricSum) * 100;
                const displayPercentage = decimal
                  ? Math.round(percentage * 10) / 10
                  : Math.round(percentage);

                return `${formattedValue} ${displayPercentage}%`;
              }
            }

            if (
              hasMultipleYears &&
              stacked &&
              barsToRender.length > 1 &&
              !isCombinedMode
            ) {
              if (metric.key.startsWith("totalSum_")) {
                return `${formattedValue}`;
              }

              if (relative_percentage === "conventional_scale") {
                const metricSum = metricSums[metric.key] || 0;
                if (metricSum === 0) return formattedValue;

                const percentage = (value / metricSum) * 100;
                const displayPercentage = decimal
                  ? Math.round(percentage * 10) / 10
                  : Math.round(percentage);

                return `${formattedValue} ${displayPercentage}%`;
              }
            }

            if (isCompareMode && barsToRender.length > 1) {
              if (metric.key === "totalSum") {
                return `${formattedValue} (100%)`;
              }

              if (relative_percentage === "relative") {
                const matchingItem = processedChartData.find((item) => {
                  const itemValue = item[metric.key];
                  return Math.abs(itemValue - value) < 0.01;
                });

                if (matchingItem) {
                  const allMetricValues = metrics.map(
                    (m) => matchingItem[m.key] || 0,
                  );
                  const maxValueInItem = Math.max(...allMetricValues, 0);
                  const percentage =
                    maxValueInItem > 0 ? (value / maxValueInItem) * 100 : 0;

                  if (percentage > 0) {
                    const displayPercentage = decimal
                      ? Math.round(percentage * 10) / 10
                      : Math.round(percentage);
                    return `${formattedValue} ${displayPercentage}%`;
                  }
                }
              } else if (relative_percentage === "group_total") {
                const matchingItem = processedChartData.find((item) => {
                  const itemValue = item[metric.key];
                  return Math.abs(itemValue - value) < 0.01;
                });

                if (matchingItem && matchingItem.groupTotal > 0) {
                  const percentage = (value / matchingItem.groupTotal) * 100;
                  const displayPercentage = decimal
                    ? Math.round(percentage * 10) / 10
                    : Math.round(percentage);
                  return `${formattedValue} ${displayPercentage}%`;
                }
              } else if (relative_percentage === "conventional_scale") {
                const metricSum = metricSums[metric.key] || 0;
                if (metricSum === 0) return formattedValue;

                const percentage = (value / metricSum) * 100;
                const displayPercentage = decimal
                  ? Math.round(percentage * 10) / 10
                  : Math.round(percentage);

                return `${formattedValue} ${displayPercentage}%`;
              } else if (relative_percentage === "external") {
                const matchingItem = processedChartData.find((item) => {
                  const itemValue = item[metric.key];
                  return Math.abs(itemValue - value) < 0.01;
                });

                if (matchingItem && matchingItem.externalReferenceValue > 0) {
                  const percentage =
                    (value / matchingItem.externalReferenceValue) * 100;
                  const displayPercentage = decimal
                    ? Math.round(percentage * 10) / 10
                    : Math.round(percentage);
                  return `${formattedValue} ${displayPercentage}%`;
                }
              }
            }

            return formattedValue;
          }}
          style={{
            fontSize: "9px",
            fill: "var(--chart-tick-strong)",
            fontWeight: "700",
            fontFamily: MONO,
          }}
          offset={2}
        />
      </Bar>
    ));
  };

  const renderRegularBar = () => (
    <Bar
      dataKey="displayValue"
      radius={[0, 0, 0, 0]}
      animationDuration={0}
        isAnimationActive={false}
      style={{ cursor: "pointer" }}
    >
      {finalChartData.map((entry, index) => (
        <Cell
          key={`cell-${index}`}
          fill={getBarColor(index)}
          style={{
            cursor: "pointer",
            transition: "fill 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      ))}
      <LabelList
        dataKey="displayValue"
        position="top"
        offset={9}
        isAnimationActive={false}
        formatter={(value) => {
          if (
            !isMonthly &&
            chartData.length < horizontalThreshold &&
            value === 0
          ) {
            return "";
          }

          return formatLabel(value, decimal);
        }}
        textAnchor="middle"
        style={{
          fontSize: getLabelFontSize(),
          fill: "var(--chart-tick-strong)",
          fontWeight: "700",
          fontFamily: MONO,
          letterSpacing: "-0.02em",
        }}
      />
      <LabelList
        dataKey="displayPercentage"
        position="insideTop"
        isAnimationActive={false}
        formatter={(value) => (value >= 1 ? `${decimal ? value : Math.round(value)}%` : "")}
        style={{
          fontSize: getLabelFontSize(),
          fill: "#ffffff",
          fontWeight: "900",
          fontFamily: MONO,
          textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
        }}
      />
    </Bar>
  );

  const renderRegularBarHorizontal = () => (
    <Bar
      dataKey="displayValue"
      radius={[0, 0, 0, 0]}
      animationDuration={0}
        isAnimationActive={false}
      style={{ cursor: "pointer" }}
    >
      {finalChartData.map((entry, index) => (
        <Cell
          key={`cell-${index}`}
          fill={getBarColor(index)}
          style={{
            cursor: "pointer",
            transition: "fill 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      ))}
      <LabelList
        dataKey="displayValue"
        position="right"
        isAnimationActive={false}
        formatter={(value) => formatLabel(value, decimal)}
        style={{
          fontSize: LABEL_FONT_SIZE,
          fill: "var(--chart-tick-strong)",
          fontWeight: "700",
          fontFamily: MONO,
        }}
        offset={10}
      />
      <LabelList
        dataKey="displayPercentage"
        position="insideLeft"
        isAnimationActive={false}
        formatter={(value, entry, index) => {
          const isHovered = hoveredBar === index;
          const threshold = isHovered ? 2.5 : 3;
          return value >= threshold
            ? `${decimal ? value : Math.round(value)}%`
            : "";
        }}
        style={{
          fontSize: LABEL_FONT_SIZE,
          fill: "#ffffff",
          fontWeight: "900",
          fontFamily: MONO,
          textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
        }}
      />
    </Bar>
  );

  // One color swatch per row, matching the same series color the bar itself
  // renders in (see getBarColor) — "Total" rows get the same fixed blue that
  // getBarColor gives the total bar; every other row's color is keyed on its
  // position within `metrics`, exactly like the legend's swatch lookup.
  const TOTAL_SWATCH_COLOR = "#0ea5e9";

  const getTooltipRows = () => {
    if (!hoveredData) return [];

    if (isCombinedMode && activeYear) {
      const rows = [];

      if (total && hoveredData[`totalSum_${activeYear}`] !== undefined) {
        rows.push({
          label: "Total",
          text: formatLabel(hoveredData[`totalSum_${activeYear}`], decimal),
          color: TOTAL_SWATCH_COLOR,
        });
      }

      metrics.forEach((metric, i) => {
        const value = hoveredData[`${metric.key}_${activeYear}`] || 0;
        if (value > 0) {
          rows.push({
            label: metric.label,
            text: formatLabel(value, decimal),
            color: compareColors[i % compareColors.length],
          });
        }
      });

      return rows;
    }

    if (hasMultipleYears && !isCombinedMode) {
      const rows = [];

      if (stacked && metrics.length > 1) {
        detectedYears.forEach((year) => {
          if (total && hoveredData[`totalSum_${year}`] !== undefined) {
            rows.push({
              label: `Total ${year}`,
              text: formatLabel(hoveredData[`totalSum_${year}`], decimal),
              color: TOTAL_SWATCH_COLOR,
            });
          }

          metrics.forEach((metric, i) => {
            const value = hoveredData[`${metric.key}_${year}`] || 0;
            if (value > 0) {
              rows.push({
                label: `${metric.label} ${year}`,
                text: formatLabel(value, decimal),
                color: compareColors[i % compareColors.length],
              });
            }
          });
        });
      } else {
        detectedYears.forEach((year, i) => {
          const value = hoveredData[`value_${year}`] || 0;
          if (value > 0) {
            rows.push({
              label: String(year),
              text: formatLabel(value, decimal),
              color: compareColors[i % compareColors.length],
            });
          }
        });
      }

      return rows;
    }

    if (isCompareMode) {
      const rows = [];

      if (total && hoveredData.totalSum !== undefined) {
        rows.push({
          label: "Total",
          text: formatLabel(hoveredData.totalSum, decimal),
          color: TOTAL_SWATCH_COLOR,
        });
      }

      metrics.forEach((metric, i) => {
        const value = hoveredData[metric.key] || 0;
        if (value === 0) return;

        let percentageText = "";
        if (relative_percentage === "relative") {
          const percentage =
            hoveredData.relativePercentages?.[metric.key] || 0;
          const displayPercentage = decimal
            ? Math.round(percentage * 10) / 10
            : Math.round(percentage);
          percentageText = ` (${displayPercentage}%)`;
        } else if (relative_percentage === "group_total") {
          const percentage = hoveredData.groupPercentages?.[metric.key] || 0;
          const displayPercentage = decimal
            ? Math.round(percentage * 10) / 10
            : Math.round(percentage);
          percentageText = ` (${displayPercentage}%)`;
        } else if (relative_percentage === "conventional_scale") {
          const metricSum = metricSums[metric.key] || 0;
          if (metricSum > 0) {
            const percentage = (value / metricSum) * 100;
            const displayPercentage = decimal
              ? Math.round(percentage * 10) / 10
              : Math.round(percentage);
            percentageText = ` (${displayPercentage}%)`;
          }
        } else if (relative_percentage === "external") {
          const percentage =
            hoveredData.externalPercentages?.[metric.key] || 0;
          const displayPercentage = decimal
            ? Math.round(percentage * 10) / 10
            : Math.round(percentage);
          percentageText = ` (${displayPercentage}%)`;
        }

        rows.push({
          label: metric.label,
          text: `${formatLabel(value, decimal)}${percentageText}`,
          color: compareColors[i % compareColors.length],
        });
      });

      return rows;
    }

    return [
      {
        label: null,
        text: formatLabel(hoveredData.displayValue, decimal),
        color: barColor,
      },
    ];
  };

  const hoveredData =
    hoveredBar !== null ? processedChartData[hoveredBar] : null;

  return (
    <div ref={plotRef} className="w-full h-full backdrop-blur-sm relative">
      {renderYearToggle()}
      {renderLegend()}
      {isInverse ? (
        <div
          className={`w-full ${
            shouldScrollVertical
              ? "overflow-y-auto overflow-x-hidden custom-scrollbar-minimal"
              : ""
          } bg-white rounded-md`}
          style={{
            // Fixed pixel height only makes sense when the list needs an
            // internal scroll viewport; otherwise it should fill whatever
            // height the bento tile actually gives it (100%), not a value
            // computed from item count alone — that value was frequently
            // shorter than the tile, leaving dead space below the chart.
            height: shouldScrollVertical ? inverseHeight : "100%",
            maxHeight: shouldScrollVertical
              ? `${INVERSE_MAX_HEIGHT}px`
              : "none",
          }}
        >
          <div
            className="p-2 md:p-4"
            style={{
              height: shouldScrollVertical
                ? `${dataWithMissingYears.length * 28 + 120}px`
                : "100%",
              minHeight: shouldScrollVertical
                ? `${INVERSE_MAX_HEIGHT}px`
                : "auto",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={finalChartData}
                margin={CHART_MARGINS_HORIZONTAL}
                barSize={calculateBarSize()}
                barCategoryGap={getBarCategoryGap()}
                barGap={getBarGap()}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}
              >
                <defs>
                  <linearGradient id="barGradientH" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={barColor} stopOpacity={0.9} />
                    <stop
                      offset="100%"
                      stopColor={barColor}
                      stopOpacity={0.95}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  {...AXIS_GRID_PROPS}
                  horizontal={false}
                  strokeWidth={1}
                />

                {/* Content-less: HoverTooltip (below) already renders the
                    readout from `hoveredBar` state. This exists purely so
                    Recharts draws its native cursor rect behind the hovered
                    category — the "shaded ground" ComparisonChart gets for
                    free by using Tooltip natively, which a manual
                    mousemove-tracked overlay doesn't get on its own. */}
                <RechartsTooltip
                  content={() => null}
                  cursor={{ fill: "var(--chart-hover-cursor)" }}
                />

                <XAxis
                  type="number"
                  {...AXIS_LINE_PROPS}
                  tick={AXIS_VALUE_TICK}
                  domain={[0, isSpecialMode ? compareMaxValue : maxValue]}
                  tickFormatter={(value) => {
                    if (
                      !isMonthly &&
                      chartData.length < horizontalThreshold &&
                      String(value).startsWith("__dummy__")
                    ) {
                      return "";
                    }
                    return formatAxisValue(value);
                  }}
                  allowDecimals={decimal}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  {...AXIS_LINE_PROPS}
                  tick={{
                    ...AXIS_CATEGORY_TICK,
                    textAnchor: "end",
                    // Was 90 — sized for much longer labels than the 3-4
                    // letter station/route codes actually shown here, which
                    // left most of that width as blank space in front of the
                    // (right-aligned) text.
                    width: 45,
                  }}
                  interval={0}
                  width={45}
                />

                {isSpecialMode
                  ? renderCompareBarsHorizontal()
                  : renderRegularBarHorizontal()}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div
          className={`h-full bg-white overflow-x-auto ${
            shouldScrollHorizontal
              ? "overflow-x-auto overflow-y-hidden custom-scrollbar-minimal"
              : ""
          }`}
        >
          <div
            style={{
              width: calculateChartWidth(),
              height: "100%",
              minWidth: 0,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={finalChartData}
                margin={CHART_MARGINS}
                barSize={calculateBarSize()}
                barCategoryGap={getBarCategoryGap()}
                barGap={getBarGap()}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}
              >
                {/* Shared axis/grid treatment (lib/charts/theme.js) — same
                    dashed rules, no spines or tick marks, same tick styling
                    every Recharts chart in the app uses. */}
                <CartesianGrid
                  {...AXIS_GRID_PROPS}
                  vertical={false}
                  strokeWidth={1}
                />

                {/* Content-less: HoverTooltip (below) already renders the
                    readout from `hoveredBar` state. This exists purely so
                    Recharts draws its native cursor rect behind the hovered
                    category — the "shaded ground" ComparisonChart gets for
                    free by using Tooltip natively, which a manual
                    mousemove-tracked overlay doesn't get on its own. */}
                <RechartsTooltip
                  content={() => null}
                  cursor={{ fill: "var(--chart-hover-cursor)" }}
                />

                <XAxis
                  dataKey="name"
                  {...AXIS_LINE_PROPS}
                  tick={{
                    ...AXIS_CATEGORY_TICK,
                    fontSize: shouldScrollHorizontal
                      ? AXIS_FONT_SIZE_SCROLL
                      : AXIS_FONT_SIZE,
                    angle: 0,
                    textAnchor: "middle",
                  }}
                  height={shouldScrollHorizontal ? 25 : 35}
                  interval={categoryTickInterval}
                />

                <YAxis
                  {...AXIS_LINE_PROPS}
                  // Recharts reserves 60px by default; formatted ticks here are
                  // at most ~4 glyphs ("8M", "250K"), so the rest was dead
                  // gutter between the card edge and the plot.
                  width={34}
                  tick={AXIS_VALUE_TICK}
                  tickMargin={4}
                  tickFormatter={(value) => {
                    if (value >= 1000000) {
                      return `${Math.round(value / 1000000)}M`;
                    } else if (value >= 1000) {
                      return `${Math.round(value / 1000)}K`;
                    }
                    return value.toString();
                  }}
                  domain={[0, isSpecialMode ? compareMaxValue : maxValue]}
                  ticks={generateTickValues(
                    isSpecialMode ? compareMaxValue : maxValue,
                  )}
                  allowDecimals={decimal}
                />

                {isSpecialMode ? renderCompareBars() : renderRegularBar()}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <HoverTooltip
        isVisible={hoveredBar !== null}
        position="top-right"
        name={hoveredData?.originalName || hoveredData?.name}
        rows={getTooltipRows()}
        percentage={isSpecialMode ? null : hoveredData?.displayPercentage}
        subtitle={
          isSpecialMode
            ? isCombinedMode && activeYear
              ? `Year: ${activeYear}`
              : "Comparison metrics"
            : "Interactive data view"
        }
      />
    </div>
  );
};

export default VerticalBarView;
