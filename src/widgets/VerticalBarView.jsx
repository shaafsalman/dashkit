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
} from "recharts";
import { formatLabel } from "./dataUtils.js";
import HoverTooltip from "./HoverTooltip";

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const MAX_BAR_WIDTH = 32;
const MIN_BAR_WIDTH = 28;

const COMPARE_MAX_BAR_WIDTH = 24;
const COMPARE_MIN_BAR_WIDTH = 12;
const COMPARE_BAR_CATEGORY_GAP = "20%";
const COMPARE_BAR_CATEGORY_GAP_DENSE = "12%";
const COMPARE_BAR_GAP = 2;
const COMPARE_LABEL_FONT_SIZE = "10px";

const YEAR_MAX_BAR_WIDTH = 28;
const YEAR_MIN_BAR_WIDTH = 24;
const YEAR_BAR_CATEGORY_GAP = "25%";
const YEAR_BAR_CATEGORY_GAP_DENSE = "15%";
const YEAR_BAR_GAP = 1;
const YEAR_LABEL_FONT_SIZE = "10px";

const COMBINED_MAX_BAR_WIDTH = 20;
const COMBINED_MIN_BAR_WIDTH = 14;
const COMBINED_BAR_CATEGORY_GAP = "18%";
const COMBINED_BAR_CATEGORY_GAP_DENSE = "10%";
const COMBINED_BAR_GAP = 1;
const COMBINED_LABEL_FONT_SIZE = "7px";

const CHART_MARGINS = {
  top: 16,
  right: -5,
  left: -5,
  bottom: -10,
};

const CHART_MARGINS_HORIZONTAL = {
  top: 10,
  right: 48,
  left: -20,
  bottom: 0,
};

const BAR_CATEGORY_GAP = "22%";
const BAR_CATEGORY_GAP_SCROLL = "8%";

const LABEL_FONT_SIZE = "10px";
const LABEL_FONT_SIZE_SCROLL = "9px";

const AXIS_FONT_SIZE = 12;
const AXIS_FONT_SIZE_SCROLL = 8;

const SCROLL_THRESHOLD_MOBILE = 4;
const SCROLL_THRESHOLD_DESKTOP = 12;
const VERTICAL_SCROLL_THRESHOLD = 12;
const DENSE_DATA_THRESHOLD = 8;

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
}) => {
  const [hoveredBar, setHoveredBar] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedYear, setSelectedYear] = useState(null);

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

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const shouldScrollVertical =
    isInverse && dataWithMissingYears.length > VERTICAL_SCROLL_THRESHOLD;
  const shouldScrollHorizontal =
    !isInverse &&
    !isMonthly &&
    dataWithMissingYears.length >
      (isMobile ? SCROLL_THRESHOLD_MOBILE : SCROLL_THRESHOLD_DESKTOP);
  const inverseHeight = shouldScrollVertical
    ? INVERSE_MAX_HEIGHT
    : calculateInverseHeight();

  const calculateBarSize = () => {
    if (isCombinedMode) {
      const totalBarsPerGroup = metrics.length + (total ? 1 : 0);
      const combinedBarSize = Math.min(
        COMPARE_MAX_BAR_WIDTH,
        Math.max(
          COMPARE_MIN_BAR_WIDTH,
          400 / (dataWithMissingYears.length * totalBarsPerGroup),
        ),
      );
      return Math.max(
        COMPARE_MIN_BAR_WIDTH,
        Math.min(combinedBarSize, COMPARE_MAX_BAR_WIDTH),
      );
    }

    if (isYearMode) {
      const multiplier = detectedYears.length;
      const yearBarSize = Math.min(
        YEAR_MAX_BAR_WIDTH,
        Math.max(
          YEAR_MIN_BAR_WIDTH,
          400 / (dataWithMissingYears.length * multiplier),
        ),
      );
      return Math.max(
        YEAR_MIN_BAR_WIDTH,
        Math.min(yearBarSize, YEAR_MAX_BAR_WIDTH),
      );
    }

    if (isCompareMode) {
      const totalBarsPerGroup = metrics.length + (total ? 1 : 0);
      const compareBarSize = Math.min(
        COMPARE_MAX_BAR_WIDTH,
        Math.max(
          COMPARE_MIN_BAR_WIDTH,
          400 / (dataWithMissingYears.length * totalBarsPerGroup),
        ),
      );
      return Math.max(
        COMPARE_MIN_BAR_WIDTH,
        Math.min(compareBarSize, COMPARE_MAX_BAR_WIDTH),
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
          Math.max(MIN_BAR_WIDTH, 400 / dataWithMissingYears.length),
        )
      : Math.min(
          MAX_BAR_WIDTH,
          Math.max(MIN_BAR_WIDTH, 560 / dataWithMissingYears.length),
        );

    return Math.max(MIN_BAR_WIDTH, Math.min(size, MAX_BAR_WIDTH));
  };

  const calculateChartWidth = () => {
    if (!shouldScrollHorizontal) return "100%";
    const barWidth = calculateBarSize();
    const minSpacing = 32;
    const totalWidth =
      dataWithMissingYears.length * (barWidth + minSpacing) + 200;
    return Math.max(1200, totalWidth);
  };

  const calculateCompareMaxValue = () => {
    if (!isSpecialMode) return maxValue;

    let maxSingleValue = 0;

    if (hasMultipleYears) {
      processedChartData.forEach((item) => {
        if (stacked && metrics.length > 1) {
          if (isCombinedMode && activeYear) {
            metrics.forEach((metric) => {
              const value = item[`${metric.key}_${activeYear}`] || 0;
              if (value > maxSingleValue) {
                maxSingleValue = value;
              }
            });
            if (total && item[`totalSum_${activeYear}`]) {
              if (item[`totalSum_${activeYear}`] > maxSingleValue) {
                maxSingleValue = item[`totalSum_${activeYear}`];
              }
            }
          } else {
            detectedYears.forEach((year) => {
              metrics.forEach((metric) => {
                const value = item[`${metric.key}_${year}`] || 0;
                if (value > maxSingleValue) {
                  maxSingleValue = value;
                }
              });
              if (total && item[`totalSum_${year}`]) {
                if (item[`totalSum_${year}`] > maxSingleValue) {
                  maxSingleValue = item[`totalSum_${year}`];
                }
              }
            });
          }
        } else {
          detectedYears.forEach((year) => {
            const value = item[`value_${year}`] || 0;
            if (value > maxSingleValue) {
              maxSingleValue = value;
            }
          });
        }
      });
    } else {
      processedChartData.forEach((item) => {
        metrics.forEach((metric) => {
          const value = item[metric.key] || 0;
          if (value > maxSingleValue) {
            maxSingleValue = value;
          }
        });

        if (total && item.totalSum) {
          if (item.totalSum > maxSingleValue) {
            maxSingleValue = item.totalSum;
          }
        }
      });
    }

    return Math.ceil(maxSingleValue * 1.05);
  };

  const compareMaxValue = calculateCompareMaxValue();

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
          const darkenedR = Math.max(0, Math.floor(r * 0.85));
          const darkenedG = Math.max(0, Math.floor(g * 0.85));
          const darkenedB = Math.max(0, Math.floor(b * 0.85));
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
        const darkenedR = Math.max(0, Math.floor(r * 0.85));
        const darkenedG = Math.max(0, Math.floor(g * 0.85));
        const darkenedB = Math.max(0, Math.floor(b * 0.85));
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
        const darkenedR = Math.max(0, Math.floor(r * 0.85));
        const darkenedG = Math.max(0, Math.floor(g * 0.85));
        const darkenedB = Math.max(0, Math.floor(b * 0.85));
        return `#${darkenedR.toString(16).padStart(2, "0")}${darkenedG
          .toString(16)
          .padStart(2, "0")}${darkenedB.toString(16).padStart(2, "0")}`;
      }
      return `${barColor}E6`;
    }
  };

  const getBarCategoryGap = () => {
    if (isCombinedMode) {
      return dataWithMissingYears.length > DENSE_DATA_THRESHOLD
        ? COMPARE_BAR_CATEGORY_GAP_DENSE
        : COMPARE_BAR_CATEGORY_GAP;
    }
    if (isYearMode) {
      return dataWithMissingYears.length > DENSE_DATA_THRESHOLD
        ? YEAR_BAR_CATEGORY_GAP_DENSE
        : YEAR_BAR_CATEGORY_GAP;
    }
    if (isCompareMode) {
      return dataWithMissingYears.length > DENSE_DATA_THRESHOLD
        ? COMPARE_BAR_CATEGORY_GAP_DENSE
        : COMPARE_BAR_CATEGORY_GAP;
    }
    return shouldScrollHorizontal ? BAR_CATEGORY_GAP_SCROLL : BAR_CATEGORY_GAP;
  };

  const getBarGap = () => {
    if (isCombinedMode) return COMPARE_BAR_GAP;
    if (isYearMode) return YEAR_BAR_GAP;
    if (isCompareMode) return COMPARE_BAR_GAP;
    return 0;
  };

  const getLabelFontSize = () => {
    if (isCombinedMode) return COMPARE_LABEL_FONT_SIZE;
    if (isYearMode) return YEAR_LABEL_FONT_SIZE;
    if (isCompareMode) return COMPARE_LABEL_FONT_SIZE;
    return shouldScrollHorizontal ? LABEL_FONT_SIZE_SCROLL : LABEL_FONT_SIZE;
  };

  const renderYearToggle = () => {
    if (!isCombinedMode || detectedYears.length <= 1) return null;

    const toggle = (
      <div className="flex items-center gap-1">
        {detectedYears.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-3 py-1.5 text-xs font-bold transition-colors ${
              selectedYear === year
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100 border border-gray-300"
            }`}
          >
            {year}
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

    // Right-aligned instead of centered, matching the Area/Line chart legend
    // placement. Year toggle (when present) already occupies the top-right
    // corner, so the legend drops below it there instead of overlapping.
    const topOffset = isCombinedMode && detectedYears.length > 1 ? "top-12" : "top-2";

    return (
      <div className={`absolute ${topOffset} right-2 bg-transparent z-10`}>
        <div className="flex flex-row flex-wrap justify-end space-x-1 md:space-x-2 gap-y-1">
          {legendItems.map((metric, index) => (
            <div
              key={metric.key}
              className="flex items-center space-x-1 md:space-x-2"
            >
              <div
                className="w-2 h-2 md:w-3 md:h-3 rounded-sm"
                style={{
                  backgroundColor:
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
                        ],
                }}
              />
              <span className="text-[10px] md:text-xs font-medium text-gray-700">
                {metric.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCompareBars = () => {
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

    return barsToRender.map((metric, index) => (
      <Bar
        key={metric.key}
        dataKey={metric.key}
        radius={[2, 2, 0, 0]}
        animationDuration={0}
        style={{ cursor: "pointer" }}
        onMouseEnter={(data, index) => {
          setHoveredBar(index);
        }}
        onMouseLeave={() => {
          setHoveredBar(null);
        }}
      >
        {processedChartData.map((entry, dataIndex) => (
          <Cell
            key={`cell-${metric.key}-${dataIndex}`}
            fill={getBarColor(dataIndex, index)}
            style={{
              cursor: "pointer",
              transition: "fill 0.2s ease-in-out",
            }}
          />
        ))}
        <LabelList
          dataKey={metric.key}
          position="top"
          formatter={(value, entry, listIndex) => {
            if (value <= 0) return "";

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
            fontSize: getLabelFontSize(),
            fill: "#374151",
            fontWeight: "600",
            fontFamily: MONO,
            backgroundColor: "rgba(248, 250, 252, 0.92)",
            padding: "4px 6px",
            borderRadius: "3px",
            lineHeight: "1.2",
            textAlign: "center",
          }}
          offset={2}
          dx={2}
        />
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

    return barsToRender.map((metric, index) => (
      <Bar
        key={metric.key}
        dataKey={metric.key}
        radius={[0, 6, 6, 0]}
        animationDuration={0}
        style={{ cursor: "pointer" }}
        onMouseEnter={(data, index) => {
          setHoveredBar(index);
        }}
        onMouseLeave={() => {
          setHoveredBar(null);
        }}
      >
        {processedChartData.map((entry, dataIndex) => (
          <Cell
            key={`cell-${metric.key}-${dataIndex}`}
            fill={getBarColor(dataIndex, index)}
            style={{
              cursor: "pointer",
              transition: "fill 0.2s ease-in-out",
            }}
          />
        ))}
        <LabelList
          dataKey={metric.key}
          position="right"
          formatter={(value, entry, listIndex) => {
            if (value <= 0) return "";

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
            fill: "#1e293b",
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
      radius={[2, 2, 0, 0]}
      animationDuration={0}
      style={{ cursor: "pointer" }}
      onMouseEnter={(data, index) => {
        setHoveredBar(index);
      }}
      onMouseLeave={() => {
        setHoveredBar(null);
      }}
    >
      {finalChartData.map((entry, index) => (
        <Cell
          key={`cell-${index}`}
          fill={getBarColor(index)}
          style={{
            cursor: "pointer",
            transition: "fill 0.2s ease-in-out",
          }}
        />
      ))}
      <LabelList
        dataKey="displayValue"
        position="top"
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
        style={{
          fontSize: getLabelFontSize(),
          fill: "#1e293b",
          fontWeight: "700",
          fontFamily: MONO,
        }}
        offset={8}
      />
      <LabelList
        dataKey="displayPercentage"
        position="insideTop"
        formatter={(value, entry, index) => {
          const isHovered = hoveredBar === index;
          const threshold = isHovered ? 2.5 : 3;
          return value >= 1 ? `${decimal ? value : Math.round(value)}%` : "";
        }}
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
      radius={[0, 6, 6, 0]}
      animationDuration={0}
      style={{ cursor: "pointer" }}
      onMouseEnter={(data, index) => {
        setHoveredBar(index);
      }}
      onMouseLeave={() => {
        setHoveredBar(null);
      }}
    >
      {finalChartData.map((entry, index) => (
        <Cell
          key={`cell-${index}`}
          fill={getBarColor(index)}
          style={{
            cursor: "pointer",
            transition: "fill 0.2s ease-in-out",
          }}
        />
      ))}
      <LabelList
        dataKey="displayValue"
        position="right"
        formatter={(value) => formatLabel(value, decimal)}
        style={{
          fontSize: LABEL_FONT_SIZE,
          fill: "#1e293b",
          fontWeight: "700",
          fontFamily: MONO,
        }}
        offset={10}
      />
      <LabelList
        dataKey="displayPercentage"
        position="insideLeft"
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

  const getTooltipValue = () => {
    if (!hoveredData) return "";

    if (isCombinedMode && activeYear) {
      let tooltipContent = [];

      if (total && hoveredData[`totalSum_${activeYear}`] !== undefined) {
        tooltipContent.push(
          `Total: ${formatLabel(
            hoveredData[`totalSum_${activeYear}`],
            decimal,
          )}`,
        );
      }

      metrics.forEach((metric) => {
        const value = hoveredData[`${metric.key}_${activeYear}`] || 0;
        if (value > 0) {
          tooltipContent.push(
            `${metric.label}: ${formatLabel(value, decimal)}`,
          );
        }
      });

      return tooltipContent.join("\n");
    }

    if (hasMultipleYears && !isCombinedMode) {
      let tooltipContent = [];

      if (stacked && metrics.length > 1) {
        detectedYears.forEach((year) => {
          if (total && hoveredData[`totalSum_${year}`] !== undefined) {
            tooltipContent.push(
              `Total ${year}: ${formatLabel(
                hoveredData[`totalSum_${year}`],
                decimal,
              )}`,
            );
          }

          metrics.forEach((metric) => {
            const value = hoveredData[`${metric.key}_${year}`] || 0;
            if (value > 0) {
              tooltipContent.push(
                `${metric.label} ${year}: ${formatLabel(value, decimal)}`,
              );
            }
          });
        });
      } else {
        detectedYears.forEach((year) => {
          const value = hoveredData[`value_${year}`] || 0;
          if (value > 0) {
            tooltipContent.push(`${year}: ${formatLabel(value, decimal)}`);
          }
        });
      }

      return tooltipContent.join("\n");
    }

    if (isCompareMode) {
      let tooltipContent = [];

      if (total && hoveredData.totalSum !== undefined) {
        tooltipContent.push(
          `Total: ${formatLabel(hoveredData.totalSum, decimal)}`,
        );
      }

      const metricValues = metrics
        .map((metric) => {
          const value = hoveredData[metric.key] || 0;
          if (value === 0) return null;

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

          return `${metric.label}: ${formatLabel(
            value,
            decimal,
          )}${percentageText}`;
        })
        .filter(Boolean);

      tooltipContent.push(...metricValues);
      return tooltipContent.join("\n");
    }

    return formatLabel(hoveredData.displayValue, decimal);
  };

  const hoveredData =
    hoveredBar !== null ? processedChartData[hoveredBar] : null;

  return (
    <div className="w-full h-full backdrop-blur-sm relative">
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
            height: inverseHeight,
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
                  strokeDasharray="2 4"
                  horizontal={false}
                  stroke="rgba(148,163,184,0.4)"
                  strokeWidth={1}
                />

                <XAxis
                  type="number"
                  axisLine={true}
                  tickLine={true}
                  tick={{
                    fontSize: 9,
                    fill: "#475569",
                    fontWeight: "600",
                    fontFamily: MONO,
                  }}
                  domain={[0, isSpecialMode ? compareMaxValue : "dataMax"]}
                  tickFormatter={(value) => {
                    if (
                      !isMonthly &&
                      chartData.length < horizontalThreshold &&
                      String(value).startsWith("__dummy__")
                    ) {
                      return "";
                    }
                    return value;
                  }}
                  allowDecimals={decimal}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={true}
                  tickLine={true}
                  tick={{
                    fontSize: 9,
                    textAnchor: "end",
                    width: 90,
                    fill: "#1e293b",
                    fontWeight: "700",
                    fontFamily: SANS,
                  }}
                  interval={0}
                  width={90}
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
              minWidth: shouldScrollHorizontal ? "1200px" : "auto",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={finalChartData}
                margin={CHART_MARGINS}
                barSize={calculateBarSize()}
                barCategoryGap={getBarCategoryGap()}
                barGap={getBarGap()}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  vertical={false}
                  stroke="rgba(148,163,184,0.4)"
                  strokeWidth={1}
                />

                <XAxis
                  dataKey="name"
                  axisLine={true}
                  tickLine={true}
                  tick={{
                    fontSize: shouldScrollHorizontal
                      ? AXIS_FONT_SIZE_SCROLL
                      : AXIS_FONT_SIZE,
                    fill: "#1e293b",
                    fontWeight: "900",
                    fontFamily: SANS,
                    angle: 0,
                    textAnchor: "middle",
                  }}
                  height={shouldScrollHorizontal ? 25 : 35}
                  interval={0}
                />

                <YAxis
                  axisLine={true}
                  tickLine={true}
                  tick={{
                    fontSize: 10,
                    fill: "#475569",
                    fontWeight: "600",
                    fontFamily: MONO,
                  }}
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
        value={getTooltipValue()}
        percentage={isSpecialMode ? null : hoveredData?.displayPercentage}
        subtitle={
          isSpecialMode
            ? isCombinedMode && activeYear
              ? `Year: ${activeYear}`
              : "Comparison metrics"
            : "Interactive data view"
        }
        multiline={isSpecialMode}
      />
    </div>
  );
};

export default VerticalBarView;
