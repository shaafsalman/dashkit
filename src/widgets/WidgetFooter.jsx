import React, { useState } from "react";
import {
  List,
  BarChart,
  PieChart,
  LineChart,
  ArrowUpDown,
  Calendar,
  BarChart3,
  ChevronUp,
  ChevronDown,
  SortAsc,
  SortDesc,
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
  compareMode = false,
  showCompareFooter = true,
  defaultMetricsCollapsed = false,
  isLoading = false,
  isMobile = false,
}) => {
  const [statsVisible, setStatsVisible] = useState(!defaultMetricsCollapsed);

  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [chartDropdownOpen, setChartDropdownOpen] = useState(false);

  const formatNumber = (value) => {
    if (typeof value !== "number") return value;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    if (value >= 1) return parseFloat(value.toFixed(1));
    if (value > 0) return parseFloat(value.toFixed(2));
    return value;
  };
  const getViewModeConfig = (mode) => {
    const configs = {
      horizontal: { icon: List, label: "List" },
      vertical: { icon: BarChart, label: "Bar" },
      pie: { icon: PieChart, label: "Pie" },
      area: { icon: LineChart, label: "Area" },
      line: { icon: LineChart, label: "Line" },
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
      `flex items-center gap-2 flex-1 min-w-0 ${STAT_CARD_CLASS}`;
    const mobileClasses = isMobileCompare
      ? "gap-1 py-1 px-1.5"
      : "py-1 px-2";
    const desktopClasses = "py-1.5 px-2.5";

    return (
      <div
        className={`${baseClasses} ${isMobile ? mobileClasses : desktopClasses}`}
      >
        <Icon
          className={`text-gray-400 flex-shrink-0 ${isMobileCompare ? "w-3 h-3" : isMobile ? "w-3.5 h-3.5" : "w-4 h-4"}`}
        />
        <div className="flex flex-col min-w-0 flex-1">
          <p
            className={`font-medium text-gray-500 truncate ${isMobileCompare ? "text-[10px]" : "text-[11px]"}`}
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
            className={`font-extrabold text-gray-900 tracking-tight ${isMobileCompare ? "text-base" : isMobile ? "text-lg" : isCompare ? "text-xl" : "text-xl"}`}
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

      return (
        <div className="w-full overflow-x-auto">
          <div
            className="flex gap-4 px-4"
            style={{ width: `${metrics.length * 50}vw` }}
          >
            {metrics.map((metric) => (
              <div
                key={metric.key}
                className="flex flex-col items-center px-2 bg-gray-50 border border-gray-300 flex-shrink-0"
                style={{ width: "calc((100vw - 21rem) / 2)" }}
              >
                <h3 className="text-sm font-bold text-gray-800 my-0.5 text-center">
                  {metric.label}
                  {yearSuffix && (
                    <span className="text-xs opacity-75"> {yearSuffix}</span>
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
    return (
      <div className="m-1.5 bg-gray-100 px-2 sm:px-3 py-2 border-2 border-gray-300">
        <div className="flex justify-end items-center">
          <div className="mb-1 p-1 w-6 h-6 bg-gray-300"></div>
        </div>
        <div className="animate-pulse">
          <div
            className={`${isMobile ? "grid grid-cols-3 gap-1 mb-3" : "flex gap-2 mb-4"}`}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`${isMobile ? "p-2" : "p-3"} bg-gray-200 flex items-center gap-2`}
              >
                <div
                  className={`${isMobile ? "w-6 h-6" : "w-8 h-8"} bg-gray-300 `}
                ></div>
                <div className="flex-1">
                  <div
                    className={`${isMobile ? "h-2 w-12" : "h-3 w-16"} bg-gray-300 mb-1`}
                  ></div>
                  <div
                    className={`${isMobile ? "h-3 w-8" : "h-4 w-12"} bg-gray-300 rounded`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center">
            <div className="flex gap-1 sm:gap-2">
              <div
                className={`${isMobile ? "w-16 h-7" : "w-20 h-8"} bg-gray-300 `}
              ></div>
              {showComparable && metrics.length > 1 && (
                <div
                  className={`${isMobile ? "w-16 h-7" : "w-20 h-8"} bg-gray-300 `}
                ></div>
              )}
            </div>
            {enableSorting && (
              <div
                className={`${isMobile ? "w-8 h-7" : "w-24 h-8"} bg-gray-300 `}
              ></div>
            )}
          </div>
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
    <div className="m-1.5 px-2 sm:px-3 py-1 bg-gray-100 border-2 border-gray-300">
      <div className="flex justify-end items-center -mt-0.5">
        {renderButton(
          () => setStatsVisible(!statsVisible),
          "flex items-center justify-center p-0.5 hover:bg-gray-100 transition-colors duration-150 touch-manipulation min-h-[18px] min-w-[18px]",
          statsVisible ? (
            <ChevronUp size={14} className="text-gray-500" />
          ) : (
            <ChevronDown size={14} className="text-gray-500" />
          ),
        )}
      </div>

      {statsVisible &&
        (!compareMode || !metrics.length > 1 || showCompareFooter) && (
          <div className="mb-1">{renderStats()}</div>
        )}

      <div className="flex justify-between items-start sm:items-center">
        <div className="flex gap-1 sm:gap-2 items-center flex-1">
          <div className="sm:hidden relative">
            {renderButton(
              () => setChartDropdownOpen(!chartDropdownOpen),
              "flex items-center justify-center py-1.5 px-2 text-xs font-bold transition-all duration-200 bg-gray-800 text-white touch-manipulation min-h-[28px]",
              <>
                <ViewIcon size={iconSize} className={iconClass} />
                {viewLabel}
                <ChevronDown size={10} className="ml-1" />
              </>,
            )}
            {renderDropdown(
              chartDropdownOpen,
              filteredViewModes.map((mode) => {
                const { icon: Icon, label } = getViewModeConfig(mode);
                return renderButton(
                  () => {
                    setViewMode(mode);
                    setChartDropdownOpen(false);
                  },
                  `w-full flex items-center justify-start py-1.5 px-2 text-xs font-bold transition-all duration-200 ${viewMode === mode ? "bg-gray-800 text-white" : "text-gray-700 hover:bg-gray-100"}`,
                  <>
                    <Icon size={iconSize} className={iconClass} />
                    {label}
                  </>,
                  false,
                );
              }),
            )}
          </div>

          {showComparable && metrics.length > 1 && (
            <div className="sm:hidden">
              {renderButton(
                () => setStacked && setStacked(!stacked),
                `flex items-center justify-center py-1 px-1 text-xs font-bold transition-all duration-200 border mx-2 touch-manipulation min-h-[28px] ${stacked ? "bg-emerald-600 text-white" : "text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200"}`,
                <>
                  <BarChart3 size={10} className="mr-1" />
                  Compare
                </>,
                stacked,
              )}
            </div>
          )}

          <div className="hidden sm:flex gap-2 flex-wrap">
            {filteredViewModes.map((mode) => {
              const { icon: Icon, label } = getViewModeConfig(mode);
              return renderButton(
                () => setViewMode(mode),
                `flex items-center justify-center py-1.5 px-2.5 text-xs font-bold transition-all duration-200  ${viewMode === mode ? "bg-gray-800 text-white" : "text-gray-700 border border-gray-300 hover:bg-gray-100"}`,
                <>
                  <Icon size={12} className="mr-1.5" />
                  {label}
                </>,
                viewMode === mode,
              );
            })}

            {showComparable &&
              metrics.length > 1 &&
              renderButton(
                () => setStacked && setStacked(!stacked),
                `flex items-center justify-center py-1 px-2 text-xs font-bold transition-all duration-200  border ${stacked ? "bg-emerald-600 text-white" : "text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200"}`,
                <>
                  <BarChart3 size={12} className="mr-1.5" />
                  Compare
                </>,
                stacked,
              )}
          </div>
        </div>

        {enableSorting && (
          <div className="flex items-center gap-2">
            <div className="sm:hidden relative">
              {renderButton(
                () => setMobileDropdownOpen(!mobileDropdownOpen),
                "flex items-center justify-center p-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200 border border-gray-300 touch-manipulation min-h-[28px] min-w-[28px]",
                <>
                  <ArrowUpDown size={12} />
                  <ChevronDown size={10} className="ml-0.5" />
                </>,
              )}
              {renderDropdown(
                mobileDropdownOpen,
                [
                  renderButton(
                    () => {
                      setIsNaturalOrder(!isNaturalOrder);
                      setMobileDropdownOpen(false);
                    },
                    `w-full flex items-center justify-start py-1.5 px-2 text-xs font-bold transition-all duration-200 ${isNaturalOrder ? "bg-gray-800 text-white" : "text-gray-700 hover:bg-gray-100"}`,
                    <>
                      <Calendar size={10} className="mr-1.5" />
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
                        setMobileDropdownOpen(false);
                      },
                      "w-full flex items-center justify-start py-1.5 px-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all duration-200",
                      <>
                        {sortDirection === "desc" ? (
                          <SortDesc size={10} className="mr-1.5" />
                        ) : (
                          <SortAsc size={10} className="mr-1.5" />
                        )}
                        {sortDirection === "desc" ? "Highest" : "Lowest"}
                      </>,
                      false,
                    ),
                ].filter(Boolean),
                "right",
              )}
            </div>

            <div className="hidden sm:flex gap-2 mt-4">
              {renderButton(
                () => setIsNaturalOrder(!isNaturalOrder),
                `flex items-center justify-center py-1.5 px-2.5 text-xs font-bold transition-all duration-200  border ${isNaturalOrder ? "bg-gray-800 text-white" : "text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200"}`,
                <>
                  <Calendar size={12} className="mr-1.5" />
                  Natural
                </>,
                isNaturalOrder,
              )}

              {!isNaturalOrder &&
                renderButton(
                  () =>
                    setSortDirection(sortDirection === "desc" ? "asc" : "desc"),
                  "flex items-center justify-center py-1.5 px-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200 border border-gray-300",
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
          </div>
        )}
      </div>
    </div>
  );
};

export default WidgetFooter;
