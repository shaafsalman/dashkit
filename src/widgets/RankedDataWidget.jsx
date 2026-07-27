import React, { useMemo, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  BarChart3,
  TrendingUp,
  Hash,
} from "lucide-react";
import { chartPalettes } from "./colorConfig";
import HorizontalBarView from "./HorizontalBarView.jsx";
import VerticalBarView from "./VerticalBarView.jsx";
import PieChartView from "./PieChartView";
import AreaChartView from "./AreaChartView";
import LineChartView from "./LineChartView";
import WidgetHeader from "./WidgetHeader.jsx";
import WidgetFooter from "./WidgetFooter.jsx";

const parseMonthString = (str) => {
  if (!str) return null;
  const cleaned = str.toString().trim().toLowerCase();
  const match = cleaned.match(
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-(\d{2})$/
  );
  if (!match) return null;
  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  return { month: months[match[1]], year: 2000 + parseInt(match[2]) };
};

const sortItemsByMonth = (items) => {
  return [...items].sort((a, b) => {
    const pA = parseMonthString(a.name);
    const pB = parseMonthString(b.name);
    if (!pA || !pB) return 0;
    if (pA.year !== pB.year) return pA.year - pB.year;
    return pA.month - pB.month;
  });
};

const detectMultipleYearsFromItems = (items) => {
  const years = new Set();
  items.forEach((item) => {
    const parsed = parseMonthString(item.name);
    if (parsed) years.add(parsed.year);
  });
  return Array.from(years).sort();
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerHeight <= 800 || window.innerWidth <= 768);
    };
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    window.addEventListener("orientationchange", checkIsMobile);
    return () => {
      window.removeEventListener("resize", checkIsMobile);
      window.removeEventListener("orientationchange", checkIsMobile);
    };
  }, []);
  return isMobile;
};

const LoadingState = ({ viewMode = "horizontal", isMobile = false }) => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="relative">
      <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 bg-accent/10 rounded-full blur-2xl animate-pulse" />
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 border-4 sm:border-5 md:border-6 lg:border-7 xl:border-8 border-gray-200/60 rounded-full animate-pulse" />
      <div
        className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-40 xl:h-40 border-4 sm:border-5 md:border-6 lg:border-7 xl:border-8 border-transparent border-t-accent rounded-full animate-spin"
        style={{ animationDuration: "1.8s" }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-3.5 lg:h-3.5 bg-accent rounded-full animate-ping" />
        <div className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-3.5 lg:h-3.5 bg-accent rounded-full" />
      </div>
    </div>
  </div>
);

const RankedDataWidget = ({
  items = [],
  allItems = [],
  title,
  dataType,
  metrics = [
    { key: "default", label: "Default", getItemValue: (item) => item.value },
  ],
  renderItemContent,
  initialItemsToShow = 50,
  className = "",
  headerIcon: HeaderIcon,
  enableSorting = true,
  defaultMetricKey = "default",
  defaultViewMode = "horizontal",
  availableViewModes = ["horizontal", "vertical", "pie", "area", "line"],
  colorPalette = [
    "#10B981",
    "#3B82F6",
    "#6366F1",
    "#8B5CF6",
    "#EC4899",
    "#F59E0B",
  ],
  compareColors,
  customMaxValue = null,
  preserveNaturalOrder = false,
  barColor = "#10B981",
  pie_legend = true,
  numbered_ranking = false,
  filterZeroValues = false,
  verticalInverse = false,
  decimal = true,
  enableYearNavigation = false,
  availableYears = [],
  currentYear = new Date().getFullYear(),
  onYearChange = () => {},
  yearData = {},
  showPercentage = false,
  showDollar = false,
  showComparable = false,
  defaultComparable = false,
  relative_percentage = "relative",
  external_sums = [],
  showFooter = true,
  total = false,
  showCompareFooter = true,
  isLoading = false,
  height = "h-[60vh]",
  defaultCompare = false,
  defaultMetricsCollapsed = false,
}) => {
  const isMobile = useIsMobile();

  const MULTI_COLORS = useMemo(() => {
    try {
      return typeof chartPalettes !== "undefined" && chartPalettes.multiPalette
        ? chartPalettes.multiPalette
        : colorPalette;
    } catch (e) {
      return colorPalette;
    }
  }, [colorPalette]);

  const filteredViewModes = useMemo(
    () =>
      availableViewModes.filter((mode) =>
        ["horizontal", "vertical", "pie", "area", "line"].includes(mode)
      ),
    [availableViewModes]
  );

  const safeDefaultViewMode = useMemo(
    () =>
      filteredViewModes.includes(defaultViewMode)
        ? defaultViewMode
        : filteredViewModes[0],
    [filteredViewModes, defaultViewMode]
  );

  const validDefaultMetric = useMemo(() => {
    const validMetrics = metrics.map((m) => m.key);
    return validMetrics.includes(defaultMetricKey)
      ? defaultMetricKey
      : validMetrics[0];
  }, [metrics, defaultMetricKey]);

  const [expandedView, setExpandedView] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState(validDefaultMetric);
  const [viewMode, setViewMode] = useState(safeDefaultViewMode);
  const [sortDirection, setSortDirection] = useState("desc");
  const [isNaturalOrder, setIsNaturalOrder] = useState(preserveNaturalOrder);
  const [hiddenSlices, setHiddenSlices] = useState([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  // DOM node a chart view's own per-year toggle (e.g. LineChartView's
  // "2025 / 2026" filter) portals into, so it renders in the header instead
  // of floating inside the chart body and eating into the plot.
  const [chartYearTogglePortal, setChartYearTogglePortal] = useState(null);
  const [compareMode, setCompareMode] = useState(
    defaultComparable ||
      defaultCompare ||
      (metrics.length > 1 && relative_percentage === "external")
  );

  useEffect(() => {
    setSelectedMetric(validDefaultMetric);
  }, [validDefaultMetric]);

  useEffect(() => {
    if (currentYear && availableYears.includes(currentYear)) {
      setSelectedYear(currentYear);
    } else if (availableYears.length > 0) {
      setSelectedYear(availableYears[0]);
    }
  }, [currentYear, availableYears]);

  useEffect(() => {
    setViewMode(safeDefaultViewMode);
  }, [safeDefaultViewMode]);

  const selectedMetricObj = useMemo(
    () => metrics.find((m) => m.key === selectedMetric) || metrics[0],
    [metrics, selectedMetric]
  );

  const getItemValue = selectedMetricObj.getItemValue;

  const getCurrentYearData = useMemo(() => {
    if (!enableYearNavigation || !dataType || !yearData) {
      return { items: items || [], allItems: allItems || [] };
    }
    const yearSpecificData = yearData[selectedYear];
    if (!yearSpecificData) {
      return { items: items || [], allItems: allItems || [] };
    }
    const yearItems = yearSpecificData[dataType] || [];
    return { items: yearItems, allItems: yearItems };
  }, [enableYearNavigation, dataType, yearData, selectedYear, items, allItems]);

  const activeItems = getCurrentYearData.items || [];
  const activeAllItems = getCurrentYearData.allItems || [];
  const activeDataForCalculations =
    activeAllItems.length > 0 ? activeAllItems : activeItems;

  const detectedYearsInData = useMemo(() => {
    return detectMultipleYearsFromItems(activeItems);
  }, [activeItems]);

  const hasMultiYearData = detectedYearsInData.length > 1;

  const { sortedItems, maxValue, totalSum } = useMemo(() => {
    const safeItems = activeItems || [];
    const filteredItems = filterZeroValues
      ? safeItems.filter((item) => (getItemValue(item) || 0) !== 0)
      : safeItems;

    const itemValues = activeDataForCalculations.map(
      (item) => getItemValue(item) || 0
    );
    const totalSum = itemValues.reduce((sum, value) => sum + value, 0);
    const naturalMaxValue = itemValues.length > 0 ? Math.max(...itemValues) : 0;

    let calculatedMaxValue;
    if (selectedMetricObj.skipCustomMax) {
      calculatedMaxValue = naturalMaxValue;
    } else if (customMaxValue !== null && customMaxValue > 0) {
      calculatedMaxValue = customMaxValue;
    } else {
      calculatedMaxValue = naturalMaxValue;
    }
    calculatedMaxValue = Math.ceil(calculatedMaxValue * 1.05);

    let sortedItems = [...filteredItems];
    if (enableSorting && !isNaturalOrder) {
      sortedItems = sortedItems.sort((a, b) => {
        const valueA = getItemValue(a) || 0;
        const valueB = getItemValue(b) || 0;
        return sortDirection === "desc" ? valueB - valueA : valueA - valueB;
      });
    }

    return { sortedItems, maxValue: calculatedMaxValue, totalSum };
  }, [
    activeItems,
    activeDataForCalculations,
    getItemValue,
    sortDirection,
    enableSorting,
    customMaxValue,
    isNaturalOrder,
    selectedMetricObj,
    filterZeroValues,
  ]);

  const itemsToShow = useMemo(() => {
    if (expandedView) {
      return sortedItems;
    }

    if (hasMultiYearData) {
      return sortedItems;
    }

    const limit = isMobile
      ? Math.min(initialItemsToShow, 8)
      : initialItemsToShow;
    return sortedItems.slice(0, limit);
  }, [
    expandedView,
    sortedItems,
    hasMultiYearData,
    isMobile,
    initialItemsToShow,
  ]);

  const chartData = useMemo(() => {
    const hasMonths =
      itemsToShow.length > 0 && parseMonthString(itemsToShow[0]?.name);
    const finalItems = hasMonths ? sortItemsByMonth(itemsToShow) : itemsToShow;

    if (compareMode && metrics.length > 1) {
      return finalItems.map((item, index) => {
        const dataPoint = {
          name: item.name || `Item ${index + 1}`,
          rank: index + 1,
        };
        let totalValue = 0;
        metrics.forEach((metric) => {
          const value = metric.getItemValue(item) || 0;
          dataPoint[metric.key] = value;
          totalValue += value;
        });
        dataPoint.totalValue = totalValue;
        dataPoint.totalPercentage =
          totalSum > 0 ? (totalValue / totalSum) * 100 : 0;
        return dataPoint;
      });
    } else {
      return finalItems.map((item, index) => {
        const value = getItemValue(item);
        return {
          name: item.name || `Item ${index + 1}`,
          value,
          percentage: maxValue > 0 ? Math.round((value / maxValue) * 100) : 0,
          totalPercentage:
            totalSum > 0 ? Math.round((value / totalSum) * 100) : 0,
          rank: index + 1,
        };
      });
    }
  }, [itemsToShow, getItemValue, maxValue, totalSum, compareMode, metrics]);

  const statsData = useMemo(() => {
    if (compareMode && metrics.length > 1) {
      const allMetricsStats = {};
      metrics.forEach((metric) => {
        const itemValues = activeDataForCalculations.map(
          (item) => metric.getItemValue(item) || 0
        );
        const sum = itemValues.reduce((total, value) => total + value, 0);
        const mean = itemValues.length > 0 ? sum / itemValues.length : 0;
        const max = itemValues.length > 0 ? Math.max(...itemValues) : 0;
        allMetricsStats[metric.key] = { sum, mean, max };
      });
      return allMetricsStats;
    } else {
      const itemValues = activeDataForCalculations.map(
        (item) => getItemValue(item) || 0
      );
      const sum = itemValues.reduce((total, value) => total + value, 0);
      const mean = itemValues.length > 0 ? sum / itemValues.length : 0;
      const max = itemValues.length > 0 ? Math.max(...itemValues) : 0;
      return { sum, mean, max };
    }
  }, [activeDataForCalculations, getItemValue, compareMode, metrics]);

  const defaultStats = useMemo(() => {
    const stats = [
      { icon: BarChart3, label: "Sum", value: "sum" },
      { icon: TrendingUp, label: "Average", value: "mean" },
      { icon: Hash, label: "Highest", value: "max" },
    ];
    return showPercentage
      ? stats.filter((stat) => stat.value !== "sum")
      : stats;
  }, [showPercentage]);

  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
    setExpandedView(false);
    setHiddenSlices([]);
    onYearChange(newYear);
  };

  const navigateYear = (direction) => {
    const currentIndex = availableYears.indexOf(selectedYear);
    if (direction === "prev" && currentIndex < availableYears.length - 1) {
      handleYearChange(availableYears[currentIndex + 1]);
    } else if (direction === "next" && currentIndex > 0) {
      handleYearChange(availableYears[currentIndex - 1]);
    }
  };

  const canNavigatePrev =
    availableYears.indexOf(selectedYear) < availableYears.length - 1;
  const canNavigateNext = availableYears.indexOf(selectedYear) > 0;

  const toggleSlice = (index) => {
    setHiddenSlices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const showLoadingState = isLoading || itemsToShow.length === 0;

  const renderContent = () => {
    if (showLoadingState) {
      return <LoadingState viewMode={viewMode} isMobile={isMobile} />;
    }

    if (viewMode === "horizontal") {
      return (
        <div className="custom-scrollbar-minimal">
          {itemsToShow.map((item, index) => {
            const itemWithPercentage = {
              ...item,
              totalPercentage: chartData[index]?.totalPercentage,
            };
            return renderItemContent ? (
              renderItemContent(itemWithPercentage, index, maxValue, viewMode)
            ) : (
              <HorizontalBarView
                key={`${selectedYear}-${index}`}
                item={itemWithPercentage}
                index={index}
                getItemValue={getItemValue}
                maxValue={maxValue}
                barColor={barColor}
                numbered_ranking={numbered_ranking}
                decimal={decimal}
                allItems={itemsToShow}
              />
            );
          })}
        </div>
      );
    } else if (viewMode === "vertical") {
      return (
        <VerticalBarView
          key={`vertical-${selectedYear}`}
          chartData={chartData}
          barColor={barColor}
          maxValue={maxValue}
          isInverse={verticalInverse}
          stacked={compareMode}
          metrics={metrics}
          colorPalette={MULTI_COLORS}
          compareColors={compareColors}
          decimal={decimal}
          relative_percentage={relative_percentage}
          external_sums={external_sums}
          total={total}
          isMobile={isMobile}
          showPercentage={showPercentage}
          showDollar={showDollar}
          yearTogglePortal={chartYearTogglePortal}
        />
      );
    } else if (viewMode === "pie") {
      return (
        <PieChartView
          key={`pie-${selectedYear}`}
          itemsToShow={itemsToShow}
          getItemValue={getItemValue}
          hiddenSlices={hiddenSlices}
          toggleSlice={toggleSlice}
          pie_legend={pie_legend}
          decimal={decimal}
          isMobile={isMobile}
          showPercentage={showPercentage}
          showDollar={showDollar}
          yearTogglePortal={chartYearTogglePortal}
        />
      );
    } else if (viewMode === "area") {
      return (
        <AreaChartView
          key={`area-${selectedYear}`}
          chartData={chartData}
          barColor={barColor}
          maxValue={maxValue}
          relative_percentage={relative_percentage}
          external_sums={external_sums}
          decimal={decimal}
          isMobile={isMobile}
          showPercentage={showPercentage}
          compareMode={compareMode}
          showDollar={showDollar}
          yearTogglePortal={chartYearTogglePortal}
        />
      );
    } else if (viewMode === "line") {
      return (
        <LineChartView
          key={`line-${selectedYear}`}
          chartData={chartData}
          compareMode={compareMode}
          metrics={metrics}
          colorPalette={colorPalette}
          decimal={decimal}
          barColor={barColor}
          isMobile={isMobile}
          showPercentage={showPercentage}
          showDollar={showDollar}
          yearTogglePortal={chartYearTogglePortal}
        />
      );
    }
    return null;
  };

  const containerHeight = isMobile ? "h-[75vh]" : height;

  return (
    <div
      className={`${containerHeight} flex flex-col bg-white overflow-hidden border-2 border-gray-300 ${className}`}
    >
      <WidgetHeader
        HeaderIcon={HeaderIcon}
        title={title}
        enableYearNavigation={enableYearNavigation}
        availableYears={availableYears}
        selectedYear={selectedYear}
        navigateYear={navigateYear}
        canNavigatePrev={canNavigatePrev}
        canNavigateNext={canNavigateNext}
        metrics={metrics}
        selectedMetric={selectedMetric}
        setSelectedMetric={setSelectedMetric}
        isMobile={isMobile}
        isLoading={showLoadingState}
        chartYearToggleRef={setChartYearTogglePortal}
      />

      <div className="flex-1 overflow-hidden relative bg-white">
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-5 lg:px-6 py-1.5 sm:py-2 custom-scrollbar-minimal">
            {renderContent()}
          </div>
        </div>
      </div>

      {showFooter && (
        <WidgetFooter
          showPercentage={showPercentage}
          defaultStats={defaultStats}
          statsData={statsData}
          enableYearNavigation={enableYearNavigation}
          selectedYear={selectedYear}
          filteredViewModes={filteredViewModes}
          viewMode={viewMode}
          setViewMode={setViewMode}
          enableSorting={enableSorting}
          isNaturalOrder={isNaturalOrder}
          setIsNaturalOrder={setIsNaturalOrder}
          sortDirection={sortDirection}
          setSortDirection={setSortDirection}
          metrics={metrics}
          showComparable={showComparable}
          stacked={compareMode}
          setStacked={setCompareMode}
          compareMode={compareMode}
          showCompareFooter={showCompareFooter}
          isMobile={isMobile}
          isLoading={showLoadingState}
          defaultMetricsCollapsed={defaultMetricsCollapsed}
        />
      )}
    </div>
  );
};

export default React.memo(RankedDataWidget);
