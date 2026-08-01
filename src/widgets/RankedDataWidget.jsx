import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  BarChart3,
  TrendingUp,
  Hash,
} from "lucide-react";
import { chartPalettes } from "./colorConfig";
import useContainerDensity from "./useContainerDensity.js";
import { FunnelChart, DualLineChart, lighten } from "../lib/charts";
import { formatLabel } from "./dataUtils.js";
import HorizontalBarView from "./HorizontalBarView.jsx";
import VerticalBarView from "./VerticalBarView.jsx";
import PieChartView from "./PieChartView";
import AreaChartView from "./AreaChartView";
import LineChartView from "./LineChartView";
import ComparisonChart from "../ComparisonChart";
import WidgetHeader from "./WidgetHeader.jsx";
import WidgetFooter from "./WidgetFooter.jsx";

// Funnel bands ramp from this hue down to a light tint of it.
const FUNNEL_BASE_COLOR = "#EA580C";

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

// `isMobile` drives the COMPACT STYLING (font sizes, item limits, stacked
// controls) and intentionally still trips on short viewports — a 780px-tall
// window needs the tighter chrome just as much as a phone does.
//
// `isNarrow` is width-only and is the sole gate for the h-[75vh] height
// override. Those two questions used to share one flag, so any laptop under
// 800px tall silently ignored the `height` prop and forced every widget to
// 75vh — which made multi-widget grid layouts impossible to build.
const useViewport = () => {
  const [vp, setVp] = useState({ isMobile: false, isNarrow: false });
  useEffect(() => {
    const check = () => {
      setVp({
        isMobile: window.innerHeight <= 800 || window.innerWidth <= 768,
        isNarrow: window.innerWidth <= 768,
      });
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  return vp;
};

/**
 * Loading placeholder.
 *
 * Was a large spinning ring with a blurred glow and a pinging dot, sized in
 * five viewport steps — it ignored the tile it sat in (overflowing short bento
 * tiles) and drew far more attention than the content it stood in for. Now it
 * previews the SHAPE of whatever view is loading, in flat grays, sized in % so
 * it fits any tile.
 */
const LoadingState = ({ viewMode = "horizontal" }) => {
  const bars = [62, 88, 74, 95, 58, 80, 68, 90];

  if (viewMode === "horizontal") {
    return (
      <div className="absolute inset-0 flex flex-col justify-around gap-1.5 p-1 animate-pulse">
        {bars.slice(0, 6).map((w, i) => (
          <div key={i} className="flex-1 min-h-0 border-l-4 border-gray-200 bg-gray-100 px-2 py-1.5">
            <div className="h-2 w-1/3 bg-gray-200" />
            <div className="mt-1.5 h-1.5 bg-gray-200" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (viewMode === "pie") {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-3 animate-pulse">
        <div className="aspect-square h-full max-h-full max-w-full rounded-full border-[12px] border-gray-200" />
      </div>
    );
  }

  // vertical / area / line — a bar silhouette reads for all three.
  //
  // 8 flex-1 bars across a full-width widget produced ~200px-wide slabs that
  // dominated the page. Real data is 12 monthly bars, so match that count, cap
  // each bar's width, and keep the block to the lower portion of the tile —
  // a placeholder should suggest the shape, not out-shout the loaded chart.
  return (
    <div className="absolute inset-0 flex items-end justify-center gap-2 px-3 pb-3 pt-10 animate-pulse">
      {Array.from({ length: 12 }, (_, i) => bars[i % bars.length]).map((h, i) => (
        <div
          key={i}
          className="w-full max-w-[34px] flex-1 bg-gray-100"
          style={{ height: `${h * 0.8}%` }}
        />
      ))}
    </div>
  );
};

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
  // `funnel` is opt-in: it only suits ranked categorical data, so a caller has
  // to ask for it explicitly rather than every widget offering it.
  availableViewModes = ["horizontal", "vertical", "pie", "area", "line", "dualline"],
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
  // (name, item) => LucideIcon — override the list view's default keyword
  // matching with a caller-supplied mapping.
  itemIcon,
  // Opt out of list row icons (see HorizontalBarView).
  showItemIcons = true,
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
  defaultMetricsCollapsed = true,
}) => {
  const { isMobile, isNarrow } = useViewport();
  const [sizeRef, density] = useContainerDensity();
  const [expanded, setExpanded] = useState(false);

  // Esc closes the expanded modal.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const MULTI_COLORS = useMemo(() => {
    try {
      return typeof chartPalettes !== "undefined" && chartPalettes.multiPalette
        ? chartPalettes.multiPalette
        : colorPalette;
    } catch (e) {
      return colorPalette;
    }
  }, [colorPalette]);

  // area / funnel each render exactly ONE series, so on a multi-metric widget
  // they silently drop everything but the selected metric — the chart looks
  // fine and quietly lies. Only the views that can actually show several
  // series at once, or make the single-series choice explicit, stay
  // available there.
  // `dualline` and `pie` are both included: dualline renders the SELECTED
  // metric as a year pair, and pie's `getItemValue` (below) is
  // `selectedMetricObj.getItemValue` — both read the header metric selector's
  // choice, so which single series is showing is explicit, not silent.
  // area/funnel stay out because they have no such affordance.
  const MULTI_SERIES_SAFE = ["horizontal", "vertical", "line", "dualline", "pie"];

  const filteredViewModes = useMemo(() => {
    const known = availableViewModes.filter((mode) =>
      ["horizontal", "vertical", "pie", "funnel", "area", "line", "dualline"].includes(
        mode
      )
    );
    return metrics.length > 1
      ? known.filter((mode) => MULTI_SERIES_SAFE.includes(mode))
      : known;
  }, [availableViewModes, metrics.length]);

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
  // Same idea, for a chart view's own legend (year colors, or metric colors
  // in compare mode) — portals into the FOOTER (centered) instead of
  // floating over the plot.
  const [chartLegendPortal, setChartLegendPortal] = useState(null);
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

  // `detectMultipleYearsFromItems` only matches the strict "Jan-25" shape, so
  // data labelled "Jan 2025" reported no years — which is why the Compare
  // button never appeared on Revenue / Operating Cost even though the chart
  // itself was clearly plotting two years. This mirrors the looser trailing-year
  // match the chart views use.
  const hasYearSuffixData = useMemo(() => {
    const years = new Set();
    activeItems.forEach((item) => {
      const m = String(item?.name ?? "").match(/(\d{2,4})$/);
      if (m) years.add(m[1].length === 2 ? `20${m[1]}` : m[1]);
    });
    return years.size > 1;
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

  // Single source of truth for the Y-axis ceiling shared by all three view
  // modes, so switching bar/area/line no longer re-derives its own domain and
  // visibly jumps. `maxValue` above already covers the default case AND
  // VerticalBarView's isYearMode: those scan the exact same per-item values,
  // just regrouped by year inside the child — same numbers, no separate
  // computation needed. Only compareMode with >1 metric needs a different
  // ceiling: the tallest per-item STACK (sum across all metrics), matching
  // the `totalValue` field the chartData memo below already builds for that
  // same condition.
  const sharedMaxValue = useMemo(() => {
    if (compareMode && metrics.length > 1) {
      const stackTotals = activeDataForCalculations.map((item) =>
        metrics.reduce((sum, m) => sum + (Number(getItemValue(item)) || 0), 0)
      );
      const naturalStackMax = stackTotals.length ? Math.max(...stackTotals) : 0;
      return Math.ceil(naturalStackMax * 1.05);
    }
    return maxValue;
  }, [activeDataForCalculations, getItemValue, metrics, compareMode, maxValue]);

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
    // getItemValue may hand back a STRING for decimal metrics (RASK/CASK come
    // through as "0.10"). `total + value` then concatenates instead of adding,
    // which is how Sum rendered as "00.100.100.100.10" and Average as 0 —
    // Math.max on strings misbehaves the same way. Coerce once, here.
    const toNumbers = (fn) =>
      activeDataForCalculations
        .map((item) => Number(fn(item)))
        .map((n) => (Number.isFinite(n) ? n : 0));

    const summarize = (values) => {
      const sum = values.reduce((total, value) => total + value, 0);
      return {
        sum,
        mean: values.length > 0 ? sum / values.length : 0,
        max: values.length > 0 ? Math.max(...values) : 0,
      };
    };

    if (compareMode && metrics.length > 1) {
      const allMetricsStats = {};
      metrics.forEach((metric) => {
        allMetricsStats[metric.key] = summarize(
          toNumbers((item) => metric.getItemValue(item))
        );
      });
      return allMetricsStats;
    }
    return summarize(toNumbers(getItemValue));
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
      // In a tall bento tile a short list would otherwise sit in the top third
      // with dead space beneath it. `min-h-full` + stretching the rows lets the
      // list distribute itself down the tile; once the rows exceed the box the
      // basis floors out and it goes back to scrolling normally.
      return (
        <div className="custom-scrollbar-minimal flex min-h-full flex-col [&>*]:flex-1 [&>*]:min-h-[46px] [&>*]:flex [&>*]:flex-col [&>*]:justify-center">
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
                itemIcon={itemIcon}
                showItemIcons={showItemIcons}
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
          maxValue={sharedMaxValue}
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
          legendPortal={chartLegendPortal}
        />
      );
    } else if (viewMode === "funnel") {
      // Reuses the standalone lib/charts FunnelChart so the funnel looks and
      // behaves identically wherever it appears. Ranked items map straight onto
      // its stage list — already sorted by the widget's own sort logic.
      return (
        <FunnelChart
          key={`funnel-${selectedYear}-${selectedMetric}`}
          theme={{ base: "light", radius: 0, backdrop: "none", surface: "#ffffff", pad: "4px" }}
          size="fill"
          width="100%"
          compact
          controls={[]}
          // Widget supplies its own header, so the funnel's built-in
          // "Conversion" heading is redundant — but the centred per-band value
          // is the funnel's main readout and stays.
          showHeader={false}
          // Single-hue orange ramp: the funnel is one measure split by
          // category, so a rainbow of unrelated default colors implied
          // categories that differ in kind. Shading from full strength down to
          // light keeps the rank order legible at a glance. (Each band still
          // gets its own left→right gradient internally.)
          stages={itemsToShow.map((item, i) => ({
            label: item.name || `Item ${i + 1}`,
            value: getItemValue(item) || item.value || 0,
            // Caps at 0.3 — past that the tail bands wash out and the white
            // value text inside them stops being readable.
            color: lighten(
              FUNNEL_BASE_COLOR,
              Math.min(0.3, (i / Math.max(itemsToShow.length - 1, 1)) * 0.3),
            ),
          }))}
          formatValue={(v) =>
            `${showDollar ? "$" : ""}${formatLabel(v, showPercentage)}`
          }
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
      // Multi-metric compare doesn't fit ComparisonChart's "N years" model
      // (each metric would need its own value axis) — keep the existing
      // AreaChartView rendering for that case only, same split "line" uses.
      if (compareMode && metrics.length > 1) {
        return (
          <AreaChartView
            key={`area-${selectedYear}-${selectedMetric}`}
            chartData={chartData}
            // Compare-mode points have no `.value`; the number lives under
            // the selected metric's key.
            valueKey={selectedMetric}
            barColor={barColor}
            maxValue={sharedMaxValue}
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
      }

      // Single metric, compared across years — same ComparisonChart adapter
      // as the "line" branch below, just opening on its Area tab instead of
      // Line. Same component either way (Bar/Area/Line all live inside
      // ComparisonChart's own switcher), so this is genuinely "the same
      // chart", not a lookalike.
      // ComparisonChart's own month sort keys off FULL month names ("January"
      // — its `MONTHS` map's own keys), not abbreviations; it abbreviates
      // for display itself. Passing "Jan" as `name` made every row miss that
      // lookup and silently fall back to sorting by value instead of
      // chronologically — the reshuffled x-axis (May landing at the end).
      const FULL_MONTHS_AREA = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
      const extractMonthYearArea = (name) => {
        const m = String(name ?? "").match(/^([A-Za-z]+)[-\s_]*(\d{2,4})$/);
        if (!m) return null;
        const abbr = m[1].slice(0, 3);
        const abbr3 = abbr.charAt(0).toUpperCase() + abbr.slice(1).toLowerCase();
        return {
          mon: FULL_MONTHS_AREA[abbr3] || m[1],
          yr: m[2].length === 2 ? `20${m[2]}` : m[2],
        };
      };
      const byYearArea = {};
      chartData.forEach((d) => {
        const my = extractMonthYearArea(d.name);
        if (!my) return;
        const v = d.value !== undefined ? d.value : d[selectedMetric];
        (byYearArea[my.yr] ||= []).push({ name: my.mon, value: Number(v) || 0 });
      });
      const areaYears = Object.keys(byYearArea)
        .map(Number)
        .filter((n) => !isNaN(n));

      return (
        <ComparisonChart
          key={`area-cc-${selectedYear}-${selectedMetric}`}
          title={title}
          data={byYearArea}
          selectedYears={areaYears}
          showPercentage={showPercentage}
          defaultType="area"
          embedded
          colors={compareColors && compareColors.length > 0 ? compareColors : undefined}
        />
      );
    } else if (viewMode === "dualline") {
      // Second line "theme": the shared lib/charts DualLineChart, which draws a
      // year-over-year pair with a cursor readout and an expandable detail
      // table. The `line` mode above stays as the Chart.js multi-series
      // rendering — the two coexist and the caller picks per widget.
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const extractMonthYear = (name) => {
        const m = String(name ?? "").match(/^([A-Za-z]+)[-\s_]*(\d{2,4})$/);
        if (!m) return null;
        const mon = m[1].slice(0, 3);
        return {
          mon: mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase(),
          yr: m[2].length === 2 ? `20${m[2]}` : m[2],
        };
      };

      // Compare mode (the same "Compare" toggle vertical/line already read)
      // means one line per METRIC, all at once — matching the contract every
      // other compare-mode chart type (bars, Chart.js line) already has,
      // instead of dualline being stuck showing only whichever single metric
      // is selected via the header pills.
      if (compareMode && metrics.length > 1) {
        const byYearPerMetric = {};
        chartData.forEach((d) => {
          const my = extractMonthYear(d.name);
          if (!my) return;
          const bucket = ((byYearPerMetric[my.yr] ||= {})[my.mon] ||= {});
          metrics.forEach((metric) => {
            bucket[metric.key] = Number(d[metric.key]) || 0;
          });
        });
        const yrs = Object.keys(byYearPerMetric).sort();
        const cur = yrs[yrs.length - 1];
        const valsFor = (metricKey) =>
          MONTHS.map((m) => byYearPerMetric[cur]?.[m]?.[metricKey] ?? 0);

        // Same compareColors a metric would get as bars — a metric's color
        // shouldn't change just because the view mode switched. Falls back
        // to colorPalette for any caller that doesn't pass compareColors at
        // all (VerticalBarView defaults it on its own side; this doesn't).
        const linePalette =
          compareColors && compareColors.length > 0 ? compareColors : colorPalette;
        const multiSeries = metrics.map((metric, i) => ({
          key: metric.key,
          label: metric.label,
          color: linePalette[i % linePalette.length] || barColor,
          values: valsFor(metric.key),
        }));

        const primaryValues = multiSeries[multiSeries.length - 1].values;
        const allValues = multiSeries.flatMap((s) => s.values);

        return (
          <DualLineChart
            key={`dualline-compare-${selectedYear}`}
            theme={{ base: "light", radius: 0, backdrop: "none", accent: barColor, surface: "#ffffff" }}
            size="fill"
            width="100%"
            floatingHeader
            expandable
            showHeader={false}
            showBorder={false}
            title={title}
            valueLabel={title}
            labels={MONTHS}
            multiSeries={multiSeries}
            total={
              showPercentage
                ? allValues.filter((v) => v > 0).reduce((s, v, _, a) => s + v / a.length, 0)
                : allValues.reduce((s, v) => s + v, 0)
            }
            cursorIndex={primaryValues.reduce((b, v, i) => (v > primaryValues[b] ? i : b), 0)}
            formatValue={(v) =>
              `${showDollar ? "$" : ""}${formatLabel(v, showPercentage)}`
            }
            legendPortal={chartLegendPortal}
          />
        );
      }

      const byYear = {};
      chartData.forEach((d) => {
        const my = extractMonthYear(d.name);
        if (!my) return;
        const v = d.value !== undefined ? d.value : d[selectedMetric];
        (byYear[my.yr] ||= {})[my.mon] = Number(v) || 0;
      });
      const yrs = Object.keys(byYear).sort();
      const prev = yrs[yrs.length - 2];
      const cur = yrs[yrs.length - 1];
      const vals = (y) => (y ? MONTHS.map((m) => byYear[y]?.[m] ?? 0) : []);
      const after = vals(cur);

      return (
        <DualLineChart
          key={`dualline-${selectedYear}-${selectedMetric}`}
          theme={{ base: "light", radius: 0, backdrop: "none", accent: barColor, surface: "#ffffff" }}
          size="fill"
          width="100%"
          floatingHeader
          expandable
          // The widget header already shows the title and the footer shows the
          // stats — without this the card renders a second, larger heading.
          showHeader={false}
          showBorder={false}
          title={title}
          valueLabel={title}
          labels={MONTHS}
          singleSeries={!prev}
          before={{ label: prev || "", color: "#94a3b8", values: vals(prev) }}
          after={{ label: cur || "", color: barColor, values: after }}
          // Summing a rate is meaningless — twelve months of load factor added
          // up gave "263%". Percentages average; absolute counts sum.
          total={
            showPercentage
              ? after.filter((v) => v > 0).reduce((s, v, _, a) => s + v / a.length, 0)
              : after.reduce((s, v) => s + v, 0)
          }
          cursorIndex={after.reduce((b, v, i) => (v > after[b] ? i : b), 0)}
          formatValue={(v) =>
            `${showDollar ? "$" : ""}${formatLabel(v, showPercentage)}`
          }
          legendPortal={chartLegendPortal}
        />
      );
    } else if (viewMode === "line") {
      // Multi-metric compare doesn't fit ComparisonChart's "N years" model
      // (each metric would need its own value axis) — keep the existing
      // Chart.js multi-series rendering for that case only.
      if (compareMode && metrics.length > 1) {
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
            maxValue={sharedMaxValue}
          />
        );
      }

      // Single metric, compared across years — the exact same Recharts line
      // renderer (ui/ComparisonChart) the standalone Operations dashboard
      // charts use, instead of the separate Chart.js/canvas implementation
      // this used to be.
      //
      // ComparisonChart's own month sort keys off FULL month names
      // ("January" — its `MONTHS` map's own keys), not abbreviations; it
      // abbreviates for display itself. Passing "Jan" as `name` made every
      // row miss that lookup and silently fall back to sorting by value
      // instead of chronologically — the reshuffled x-axis (May landing at
      // the end).
      const FULL_MONTHS_LINE = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
      const extractMonthYearLine = (name) => {
        const m = String(name ?? "").match(/^([A-Za-z]+)[-\s_]*(\d{2,4})$/);
        if (!m) return null;
        const abbr = m[1].slice(0, 3);
        const abbr3 = abbr.charAt(0).toUpperCase() + abbr.slice(1).toLowerCase();
        return {
          mon: FULL_MONTHS_LINE[abbr3] || m[1],
          yr: m[2].length === 2 ? `20${m[2]}` : m[2],
        };
      };
      const byYearLine = {};
      chartData.forEach((d) => {
        const my = extractMonthYearLine(d.name);
        if (!my) return;
        const v = d.value !== undefined ? d.value : d[selectedMetric];
        (byYearLine[my.yr] ||= []).push({ name: my.mon, value: Number(v) || 0 });
      });
      const lineYears = Object.keys(byYearLine)
        .map(Number)
        .filter((n) => !isNaN(n));

      return (
        <ComparisonChart
          key={`line-cc-${selectedYear}-${selectedMetric}`}
          title={title}
          data={byYearLine}
          selectedYears={lineYears}
          showPercentage={showPercentage}
          defaultType="line"
          embedded
          colors={compareColors && compareColors.length > 0 ? compareColors : undefined}
        />
      );
    }
    return null;
  };

  // Width-gated only: a short-but-wide desktop keeps the caller's height so
  // grid layouts hold their shape; a genuinely narrow screen still gets 75vh.
  const containerHeight = isNarrow ? "h-[75vh]" : height;

  // In the expanded modal the widget always gets the full-width treatment,
  // regardless of how cramped its tile was on the page behind it.
  const effectiveDensity = expanded ? "lg" : density;

  const shell = (
    <div
      ref={sizeRef}
      className={`${expanded ? "h-full" : containerHeight} flex flex-col bg-white overflow-hidden border-2 border-gray-300 ${expanded ? "" : className}`}
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
        density={effectiveDensity}
        expanded={expanded}
        // The funnel carries its own detail affordance, so the widget-level
        // expand is suppressed for it to avoid two competing expanders.
        onToggleExpand={
          viewMode === "funnel" ? undefined : () => setExpanded((e) => !e)
        }
      />

      <div className="flex-1 overflow-hidden relative bg-white">
        <div className="absolute inset-0 flex flex-col">
          {/* Was px-3→lg:px-6: up to 24px of dead gutter on each side, which a
              chart in a 3-column bento tile cannot afford. The plot's own axis
              margins already provide the breathing room. */}
          <div
            className={`flex-1 overflow-y-auto custom-scrollbar-minimal ${
              effectiveDensity === "sm" ? "px-1.5 py-1" : "px-2.5 py-1.5"
            }`}
          >
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
          hasMultiYearData={hasMultiYearData || hasYearSuffixData}
          stacked={compareMode}
          setStacked={setCompareMode}
          compareMode={compareMode}
          showCompareFooter={showCompareFooter}
          isMobile={isMobile}
          isLoading={showLoadingState}
          defaultMetricsCollapsed={defaultMetricsCollapsed}
          density={effectiveDensity}
          chartLegendRef={setChartLegendPortal}
        />
      )}
    </div>
  );

  if (!expanded) return shell;

  // Expanded: the tile keeps its place in the grid (so the bento layout does
  // not reflow) while a full-size copy renders in a modal on top.
  return (
    <>
      <div className={`${containerHeight} ${className}`} />
      {createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-4 sm:p-8"
          onClick={() => setExpanded(false)}
        >
          <div
            className="w-full max-w-[1100px] h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {shell}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default React.memo(RankedDataWidget);
