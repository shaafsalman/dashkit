import React, { useState, useEffect } from "react";
import {
  List,
  BarChart,
  PieChart,
  LineChart,
  AreaChart,
  ArrowUpDown,
  Filter,
  Calendar,
  BarChart3,
  GitCompareArrows,
  Activity,
  ChevronUp,
  ChevronDown,
  SortAsc,
  SortDesc,
  MoreHorizontal,
} from "lucide-react";

// gray-100 fill on the footer's white base — the inverse of the list rows
// (gray cards on white body), so both read as distinct surfaces without the
// footer itself needing a gray fill that would blend into the page ground.
const STAT_CARD_CLASS = "bg-white border border-gray-300";

const WidgetFooter = ({
  showPercentage,
  defaultStats,
  statsData,
  enableYearNavigation,
  selectedYear,
  filteredViewModes,
  viewMode,
  setViewMode,
  enableSorting,
  isNaturalOrder,
  setIsNaturalOrder,
  sortDirection,
  setSortDirection,
  metrics = [],
  stacked = false,
  setStacked,
  showComparable = false,
  hasMultiYearData = false,
  compareMode = false,
  showCompareFooter = true,
  defaultMetricsCollapsed = true,
  isLoading = false,
  isMobile = false,
  // "sm" | "md" | "lg" — measured from the widget's own box, not the viewport.
  density = "lg",
  // Portal target for a chart view's own legend (year colors, or metric
  // colors in compare mode) — same "host owns the slot, chart owns the
  // content" split chartYearToggleRef already uses in WidgetHeader. Moves
  // the legend out of the chart body (where it floated over the plot,
  // wasting space) into a centered slot in this row instead.
  chartLegendRef,
}) => {
  const isSm = density === "sm";
  const isMd = density === "md";
  // Anything below `lg` is a "small tile": icon-only controls, sort behind the
  // ⋯ menu, and the stats block closed so the plot keeps the height.
  const compact = isSm || isMd;
  const sortInOverflow = compact;
  const showLabels = !compact;

  const [statsVisible, setStatsVisible] = useState(
    !defaultMetricsCollapsed && !compact,
  );

  // Density is only known after the first measure, and it changes on resize —
  // re-apply the "small tiles start closed" rule whenever it crosses.
  useEffect(() => {
    setStatsVisible(!defaultMetricsCollapsed && density === "lg");
  }, [density, defaultMetricsCollapsed]);

  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [chartDropdownOpen, setChartDropdownOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const formatNumber = (value) => {
    // Coerce rather than bail out: a non-numeric string used to be returned
    // untouched, so a malformed stat rendered raw into the tile.
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
    if (Math.abs(n) >= 1) return parseFloat(n.toFixed(1));
    if (n === 0) return 0;
    // Small decimals (RASK/CASK ≈ 0.08–0.12) collapsed to "0" at 2dp when the
    // magnitude was below 0.01 — keep enough precision to stay meaningful.
    if (Math.abs(n) >= 0.01) return parseFloat(n.toFixed(2));
    return parseFloat(n.toPrecision(2));
  };
  const getViewModeConfig = (mode) => {
    const configs = {
      horizontal: { icon: List, label: "List" },
      vertical: { icon: BarChart, label: "Bar" },
      pie: { icon: PieChart, label: "Pie" },
      funnel: { icon: Filter, label: "Funnel" },
      // Area and Line shared the LineChart glyph, which was survivable while
      // both had text labels and fatal once the labels dropped for small tiles.
      area: { icon: AreaChart, label: "Area" },
      line: { icon: LineChart, label: "Line" },
      // Second line rendering (shared DualLineChart) — distinct icon so it is
      // not mistaken for the Chart.js "Line" mode beside it.
      dualline: { icon: Activity, label: "Trend" },
    };
    return configs[mode] || { icon: null, label: mode };
  };

  const renderStatCard = (
    Icon,
    label,
    displayValue,
    yearSuffix,
    isCompare = false,
    isMobileCompare = false,
  ) => {
    const baseClasses =
      `flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden ${STAT_CARD_CLASS}`;
    const mobileClasses = isMobileCompare
      ? "gap-1 py-0.5 px-1"
      : "py-0.5 px-1.5";
    const desktopClasses = "py-1 px-2";

    return (
      <div
        className={`${baseClasses} ${isMobile ? mobileClasses : desktopClasses}`}
      >
        <Icon
          className={`text-gray-400 flex-shrink-0 ${isMobileCompare ? "w-3 h-3" : isMobile ? "w-3 h-3" : "w-3.5 h-3.5"}`}
        />
        <div className="flex flex-col min-w-0 flex-1">
          <p
            className={`font-medium text-gray-500 truncate leading-tight ${isMobileCompare ? "text-[9px]" : "text-[10px]"}`}
          >
            {label}
            {yearSuffix && (
              <span
                className={`opacity-75 ${isMobileCompare ? "text-[10px]" : "text-[10px]"}`}
              >
                {" "}
                {yearSuffix}
              </span>
            )}
          </p>
          <p
            title={String(displayValue)}
            className={`truncate font-extrabold text-gray-900 tracking-tight leading-tight ${isMobileCompare ? "text-sm" : isMobile ? "text-base" : "text-lg"}`}
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "-0.02em" }}
          >
            {displayValue}
          </p>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    const yearSuffix =
      enableYearNavigation && selectedYear ? ` (${selectedYear})` : "";

    if (compareMode && metrics.length > 1) {
      if (!showCompareFooter) return null;

      if (isMobile) {
        return (
          <div className="w-full overflow-x-auto">
            <div
              className="flex gap-1 pb-2"
              style={{ width: `${metrics.length * 50}%`, minWidth: "100%" }}
            >
              {metrics.map((metric) => (
                <div
                  key={metric.key}
                  className="flex flex-col items-center px-1 bg-gray-50 border border-gray-300 flex-shrink-0"
                  style={{ minWidth: "48%" }}
                >
                  <h3 className="text-xs font-bold text-gray-800 mb-2 text-center truncate w-full">
                    {metric.label}
                    {yearSuffix && (
                      <span className="text-xs opacity-75"> {yearSuffix}</span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 gap-1 w-full">
                    {defaultStats.map(
                      ({ icon: Icon, label, value: statValue }) => {
                        let displayValue = formatNumber(
                          statsData[metric.key]?.[statValue] || 0,
                        );
                        if (showPercentage) displayValue = `${displayValue}%`;
                        return renderStatCard(
                          Icon,
                          label,
                          displayValue,
                          "",
                          true,
                          true,
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Sized off the footer's own box, not the viewport. The old
      // `100vw`-derived widths assumed the widget spanned the full page, so in
      // a half-width grid cell every group overflowed its container.
      return (
        <div className="w-full overflow-x-auto">
          <div className="flex gap-2">
            {metrics.map((metric) => (
              <div
                key={metric.key}
                className="flex flex-col items-center px-1.5 bg-gray-50 border border-gray-300 flex-shrink-0"
                style={{ minWidth: metrics.length > 2 ? "46%" : "0", flex: "1 1 0" }}
              >
                <h3 className="text-xs font-bold text-gray-800 my-0.5 text-center truncate w-full">
                  {metric.label}
                  {yearSuffix && (
                    <span className="text-[10px] opacity-75"> {yearSuffix}</span>
                  )}
                </h3>
                <div className="flex flex-row gap-1 justify-center w-full">
                  {defaultStats.map(
                    ({ icon: Icon, label, value: statValue }) => {
                      let displayValue = formatNumber(
                        statsData[metric.key]?.[statValue] || 0,
                      );
                      if (showPercentage) displayValue = `${displayValue}%`;
                      return renderStatCard(
                        Icon,
                        label,
                        displayValue,
                        "",
                        true,
                      );
                    },
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const containerClass = "grid grid-cols-3 gap-1 justify-center";
    return (
      <div className={containerClass}>
        {defaultStats.map(({ icon: Icon, label, value: statValue }) => {
          let displayValue = formatNumber(statsData[statValue] || 0);
          if (showPercentage) displayValue = `${displayValue}%`;
          return renderStatCard(Icon, label, displayValue, yearSuffix);
        })}
      </div>
    );
  };

  const renderButton = (onClick, className, children, isActive = false) => (
    <button
      onClick={onClick}
      className={`${className} ${isActive ? "scale-105" : ""}`}
    >
      {children}
    </button>
  );

  const renderDropdown = (isOpen, items, position = "left") =>
    isOpen && (
      <div
        className={`absolute bottom-full ${position === "right" ? "right-0" : "left-0"} mb-2 bg-white border border-gray-200 z-10 min-w-32`}
      >
        <div className="p-1">{items}</div>
      </div>
    );

  if (isLoading) {
    // Was a bordered slab holding three bordered stat cards, each with its own
    // icon square and two text bars — more chrome than the real footer. A
    // loading state should suggest the shape, not rebuild it.
    return (
      <div className="px-2 py-1.5 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between gap-2 animate-pulse">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[22px] w-[22px] bg-gray-100" />
            ))}
          </div>
          <div className="h-[22px] w-[22px] bg-gray-100" />
        </div>
      </div>
    );
  }


  const { icon: ViewIcon, label: viewLabel } = getViewModeConfig(viewMode);
  const iconSize = isMobile ? 10 : 12;
  const iconClass = isMobile ? "mr-1" : "mr-1.5";

  // White base with a heavy top rule. The page ground behind the widget is
  // light gray, so tinting the footer gray blended it into that ground — the
  // separation has to come from the 2px border and the gray-100 controls
  // sitting on white, not from another gray fill.
  return (
    // Was a gray-100 slab with a 2px border, insetting a margin from the widget
    // edge — a second card inside the card. Now it is part of the widget: flush
    // to the edges, white, separated by a single hairline rule.
    <div className="px-2 py-1 bg-white border-t border-gray-200">
      {/* The show/hide toggle for this block lives in the controls row below
          (next to the view-mode picker) at all times, rather than floating
          its own strip above the stats — that strip was reserved space even
          though the button itself is tiny. */}
      {statsVisible &&
        (!compareMode || !metrics.length > 1 || showCompareFooter) && (
          <div className="mb-0.5 pt-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
            {renderStats()}
          </div>
        )}

      <div className="relative flex justify-between items-center gap-1">
        {/* Centered, absolutely-positioned so it lands at the row's true
            midpoint regardless of how wide the view-mode picker (left) or
            stats toggle (right) happen to be — a flex `space-between` slot
            can't guarantee that with two differently-sized neighbors.
            `empty:hidden` keeps it from reserving space when the chart isn't
            portaling anything in (e.g. no legend needed for a single
            series). */}
        <div
          ref={chartLegendRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 empty:hidden"
        />
        {/* View-mode picker. At `sm` the labels drop and only the icons remain —
            the active state carries the meaning, and a tooltip covers the rest. */}
        <div className="flex gap-2 items-center min-w-0 flex-1">
          {/* One segmented control on a shared gray track, instead of N
              separately-bordered chips each drawing its own box. */}
          <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 min-w-0">
            {filteredViewModes.map((mode) => {
              const { icon: Icon, label } = getViewModeConfig(mode);
              const active = viewMode === mode;
              return renderButton(
                () => setViewMode(mode),
                `flex items-center justify-center text-[11px] font-bold transition-colors duration-150 ${
                  showLabels ? "py-1 px-2" : "p-1 min-h-[22px] min-w-[22px]"
                } ${
                  active
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                }`,
                <span className="flex items-center" title={label}>
                  <Icon size={12} className={showLabels ? "mr-1.5" : ""} />
                  {showLabels && label}
                </span>,
                active,
              );
            })}

          </div>

          {/* Compare is a MODE TOGGLE, not a chart type. Sitting inside the
              view-mode track as a bare icon made it indistinguishable from the
              five view buttons — it was rendering, but unfindable. It now lives
              outside the track and always keeps its label, at every density. */}
          {showComparable &&
            metrics.length > 1 &&
            renderButton(
              () => setStacked && setStacked(!stacked),
              `flex items-center justify-center p-1 min-h-[26px] min-w-[26px] transition-colors duration-150 border ${
                stacked
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "text-gray-600 bg-white border-gray-300 hover:border-gray-400 hover:text-gray-900"
              }`,
              <span className="flex items-center" title="Compare">
                <GitCompareArrows size={13} />
              </span>,
              stacked,
            )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {(!compareMode || !metrics.length > 1 || showCompareFooter) &&
            renderButton(
              () => setStatsVisible(!statsVisible),
              "flex items-center justify-center p-1 min-h-[26px] min-w-[26px] text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200 hover:text-gray-900 transition-colors duration-150",
              statsVisible ? <ChevronUp size={13} /> : <ChevronDown size={13} />,
            )}
        </div>

        {enableSorting && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {sortInOverflow ? (
              // Tight box: sort collapses behind a ⋯ so the view picker keeps
              // the room it needs.
              <div className="relative">
                {renderButton(
                  () => setOverflowOpen(!overflowOpen),
                  "flex items-center justify-center p-1 text-gray-400 bg-gray-100 hover:text-gray-700 transition-colors duration-150 min-h-[22px] min-w-[22px]",
                  <MoreHorizontal size={12} />,
                )}
                {renderDropdown(
                  overflowOpen,
                  [
                    renderButton(
                      () => {
                        setIsNaturalOrder(!isNaturalOrder);
                        setOverflowOpen(false);
                      },
                      `w-full flex items-center justify-start py-1.5 px-2 text-[11px] font-bold transition-colors duration-150 ${
                        isNaturalOrder
                          ? "bg-gray-900 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`,
                      <>
                        <Calendar size={11} className="mr-1.5" />
                        Natural
                      </>,
                      false,
                    ),
                    !isNaturalOrder &&
                      renderButton(
                        () => {
                          setSortDirection(
                            sortDirection === "desc" ? "asc" : "desc",
                          );
                          setOverflowOpen(false);
                        },
                        "w-full flex items-center justify-start py-1.5 px-2 text-[11px] font-bold text-gray-700 hover:bg-gray-100 transition-colors duration-150",
                        <>
                          {sortDirection === "desc" ? (
                            <SortDesc size={11} className="mr-1.5" />
                          ) : (
                            <SortAsc size={11} className="mr-1.5" />
                          )}
                          {sortDirection === "desc" ? "Highest" : "Lowest"}
                        </>,
                        false,
                      ),
                  ].filter(Boolean),
                  "right",
                )}
              </div>
            ) : (
              <div className="flex gap-1">
                {renderButton(
                  () => setIsNaturalOrder(!isNaturalOrder),
                  `flex items-center justify-center py-1 px-2 text-[11px] font-bold transition-colors duration-150 border ${
                    isNaturalOrder
                      ? "bg-gray-900 text-white border-gray-900"
                      : "text-gray-700 bg-gray-100 border-gray-300 hover:bg-gray-200"
                  }`,
                  <>
                    <Calendar size={12} className="mr-1.5" />
                    Natural
                  </>,
                  isNaturalOrder,
                )}

                {!isNaturalOrder &&
                  renderButton(
                    () =>
                      setSortDirection(
                        sortDirection === "desc" ? "asc" : "desc",
                      ),
                    "flex items-center justify-center py-1 px-2 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors duration-150 border border-gray-300",
                    <>
                      {sortDirection === "desc" ? (
                        <SortDesc size={12} className="mr-1.5" />
                      ) : (
                        <SortAsc size={12} className="mr-1.5" />
                      )}
                      {sortDirection === "desc" ? "Highest" : "Lowest"}
                    </>,
                  )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WidgetFooter;
