import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { formatValue } from "./dataUtils.js";

const PieChartView = ({
  itemsToShow,
  getItemValue,
  hiddenSlices,
  toggleSlice,
  pie_legend,
  decimal = true,
  showPercentage = false,
  yearTogglePortal = null,
}) => {
  if (itemsToShow.length === 0) return null;

  const multiPalette = [
    "#0f766e",
    "#14b8a6",
    "#facc15",
    "#FFA500",
    "#5eead4",
    "#0ea5e9",
    "#22c55e",
    "#a8a89f",
    "#d7c8b3",
    "#e1d0c6",
    "#d1d5db",
    "#9ca3af",
    "#6b7280",
    "#0f172a",
    "#000000",
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
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
  ];

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

  const detectMultipleYears = (items) => {
    const years = new Set();
    items.forEach((item) => {
      const year = extractYearFromName(item.name);
      if (year) years.add(year);
    });
    return Array.from(years).sort();
  };

  const detectedYears = detectMultipleYears(itemsToShow);
  const hasMultipleYears = detectedYears.length > 1;

  const [selectedYear, setSelectedYear] = useState(detectedYears[0] || null);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (hasMultipleYears && !detectedYears.includes(selectedYear)) {
      setSelectedYear(detectedYears[0]);
    }
  }, [detectedYears, hasMultipleYears, selectedYear]);

  const filteredItems = hasMultipleYears
    ? itemsToShow.filter(
        (item) => extractYearFromName(item.name) === selectedYear,
      )
    : itemsToShow;

  const visibleItems = filteredItems.filter((_, index) => {
    const originalIndex = itemsToShow.findIndex(
      (orig) => orig === filteredItems[index],
    );
    return !hiddenSlices.includes(originalIndex);
  });

  const total = visibleItems.reduce(
    (sum, item) => sum + (getItemValue(item) || 0),
    0,
  );
  const isSingleSlice = visibleItems.length === 1;

  useEffect(() => {
    const checkScrollable = () => {
      if (scrollContainerRef.current) {
        const { scrollHeight, clientHeight, scrollTop } =
          scrollContainerRef.current;
        const isScrollable = scrollHeight > clientHeight;
        const isAtTop = scrollTop < 10;
        setShowScrollIndicator(isScrollable && isAtTop);
      }
    };

    checkScrollable();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScrollable);
      return () => container.removeEventListener("scroll", checkScrollable);
    }
  }, [filteredItems]);

  let accumAngle = 0;
  const slices = visibleItems.map((item, i) => {
    const originalIndex = itemsToShow.findIndex(
      (originalItem) => originalItem === item,
    );
    const value = getItemValue(item) || 0;
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const formattedPercentage = decimal
      ? percentage.toFixed(1)
      : Math.round(percentage);
    const angle = total > 0 ? (value / total) * 360 : 0;
    const color = multiPalette[originalIndex % multiPalette.length];
    const startAngle = accumAngle;
    accumAngle += angle;
    const endAngle = accumAngle;

    if (isSingleSlice) {
      return {
        item,
        index: originalIndex,
        value,
        percentage,
        formattedPercentage,
        color,
        isSingleSlice: true,
      };
    }

    const startX = 175 + 105 * Math.cos(((startAngle - 90) * Math.PI) / 180);
    const startY = 175 + 105 * Math.sin(((startAngle - 90) * Math.PI) / 180);
    const endX = 175 + 105 * Math.cos(((endAngle - 90) * Math.PI) / 180);
    const endY = 175 + 105 * Math.sin(((endAngle - 90) * Math.PI) / 180);
    const largeArcFlag = angle > 180 ? 1 : 0;

    return {
      item,
      index: originalIndex,
      value,
      percentage,
      formattedPercentage,
      color,
      path: `M 175 175 L ${startX} ${startY} A 105 105 0 ${largeArcFlag} 1 ${endX} ${endY} Z`,
      isSingleSlice: false,
    };
  });

  const allItemsForLegend = filteredItems.map((item, index) => {
    const originalIndex = itemsToShow.findIndex(
      (originalItem) => originalItem === item,
    );
    const value = getItemValue(item) || 0;
    const percentage =
      total > 0 && !hiddenSlices.includes(originalIndex)
        ? (value / total) * 100
        : 0;
    const formattedPercentage = decimal
      ? percentage.toFixed(1)
      : Math.round(percentage);

    return {
      item,
      index: originalIndex,
      value,
      percentage,
      formattedPercentage,
      color: multiPalette[originalIndex % multiPalette.length],
      hidden: hiddenSlices.includes(originalIndex),
    };
  });

  const getDisplayName = (name) => {
    if (!hasMultipleYears) return name;
    const match = name?.match(/^([A-Za-z]+)-(\d{2,4})$/);
    if (match) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
    return name;
  };

  const hoveredColor = slices.find((s) => s.index === hoveredSlice)?.color;

  const yearToggle = hasMultipleYears && (
    <div className="flex gap-1">
      {detectedYears.map((year) => (
        <button
          key={year}
          onClick={() => setSelectedYear(year)}
          className={`px-3 py-1.5 text-sm font-bold transition-colors duration-200 ${
            selectedYear === year
              ? "bg-emerald-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {year.toString()}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-full w-full relative overflow-hidden">
      {/* Rendered in the widget header (via portal) when a target is
          supplied, instead of floating inside the chart. */}
      {yearToggle && yearTogglePortal
        ? createPortal(yearToggle, yearTogglePortal)
        : yearToggle && (
            <div className="absolute top-2 right-2 z-50 bg-white p-1 border-2 border-gray-300">
              {yearToggle}
            </div>
          )}

      <div
        className={`${
          pie_legend ? "flex-1 md:w-2/3" : "w-full"
        } flex justify-center items-center ${
          pie_legend ? "h-2/3 md:h-full" : "h-full"
        } relative order-1 md:order-2 ${hasMultipleYears ? "pt-10" : ""}`}
      >
        <div className="w-full max-w-[280px] md:max-w-[320px] aspect-square relative">
          <svg width="100%" height="100%" viewBox="0 0 350 350">
            <defs>
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="3" dy="6" stdDeviation="6" floodOpacity="0.22" />
                <feDropShadow dx="1" dy="3" stdDeviation="3" floodOpacity="0.12" />
              </filter>
              <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="centerGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.99)" />
                <stop offset="30%" stopColor="rgba(248,250,252,0.98)" />
                <stop offset="70%" stopColor="rgba(241,245,249,0.96)" />
                <stop offset="100%" stopColor="rgba(226,232,240,0.94)" />
              </radialGradient>
              <linearGradient id="sliceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.04)" />
              </linearGradient>
            </defs>

            <g filter="url(#shadow)">
              {slices.map((slice) => (
                <g
                  key={slice.index}
                  onMouseEnter={() => setHoveredSlice(slice.index)}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  {slice.isSingleSlice ? (
                    <g>
                      <circle
                        cx="175"
                        cy="175"
                        r="105"
                        fill={slice.color}
                        stroke="white"
                        strokeWidth="4"
                        className={`transition-all duration-300 cursor-pointer ${
                          hoveredSlice === slice.index
                            ? "opacity-100 filter brightness-110"
                            : "opacity-92"
                        }`}
                      />
                      <circle
                        cx="175"
                        cy="175"
                        r="105"
                        fill="url(#sliceGradient)"
                        className="pointer-events-none"
                      />
                    </g>
                  ) : (
                    <g>
                      <path
                        d={slice.path}
                        fill={slice.color}
                        stroke="white"
                        strokeWidth="3"
                        className={`transition-all duration-300 cursor-pointer ${
                          hoveredSlice === slice.index
                            ? "opacity-100 filter brightness-110"
                            : "opacity-92"
                        }`}
                        style={
                          hoveredSlice === slice.index
                            ? { transform: "scale(1.03)", transformOrigin: "175px 175px" }
                            : undefined
                        }
                      />
                      <path
                        d={slice.path}
                        fill="url(#sliceGradient)"
                        className="pointer-events-none"
                      />
                      {hoveredSlice === slice.index && (
                        <path
                          d={slice.path}
                          fill="none"
                          stroke={slice.color}
                          strokeWidth="6"
                          filter="url(#glow)"
                          opacity="0.85"
                          className="animate-pulse pointer-events-none"
                        />
                      )}
                    </g>
                  )}
                </g>
              ))}

              <circle
                cx="175"
                cy="175"
                r="45"
                fill="url(#centerGradient)"
                stroke="rgba(226,232,240,0.8)"
                strokeWidth="4"
              />

              {!showPercentage && (
                <>
                  <circle cx="175" cy="175" r="40" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="1.5" />
                  <circle cx="175" cy="175" r="35" fill="none" stroke="rgba(203,213,225,0.2)" strokeWidth="1" />
                  <circle cx="175" cy="175" r="30" fill="none" stroke="rgba(226,232,240,0.1)" strokeWidth="0.5" />
                  <text
                    x="175"
                    y="165"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="900"
                    fill="#475569"
                    className="select-none tracking-tight"
                  >
                    TOTAL
                  </text>
                  <text
                    x="175"
                    y="190"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="900"
                    fill="#0f172a"
                    className="select-none tracking-tight"
                  >
                    {formatValue(total, decimal)}
                  </text>
                </>
              )}
            </g>
          </svg>
        </div>

        {hoveredSlice !== null && (
          <div className="absolute bottom-4 left-4 bg-gradient-to-br from-white/99 via-slate-50/96 to-white/99 backdrop-blur-2xl p-3 rounded-md shadow-2xl border border-white/70 min-w-[160px] z-50 transform transition-all duration-300">
            <div
              className="absolute inset-0 rounded-md"
              style={{ background: `linear-gradient(135deg, ${hoveredColor}18, transparent 70%)` }}
            />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: hoveredColor }} />
                <div className="text-sm font-black text-slate-800 truncate tracking-tight">
                  {getDisplayName(
                    slices.find((s) => s.index === hoveredSlice)?.item.name,
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  {formatValue(
                    slices.find((s) => s.index === hoveredSlice)?.value,
                    decimal,
                    showPercentage,
                  )}
                </span>
                <span
                  className="px-2.5 py-1 rounded-md text-sm font-black shadow-lg backdrop-blur-sm border"
                  style={{
                    background: `${hoveredColor}22`,
                    color: hoveredColor,
                    borderColor: `${hoveredColor}55`,
                  }}
                >
                  {
                    slices.find((s) => s.index === hoveredSlice)
                      ?.formattedPercentage
                  }
                  %
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {pie_legend && (
        <div className="w-full md:w-1/3 h-1/5 md:h-full overflow-hidden bg-white order-2 md:order-1 relative border-2 border-gray-300 m-1.5">
          <div
            ref={scrollContainerRef}
            className="h-full overflow-x-auto overflow-y-hidden md:overflow-x-hidden md:overflow-y-auto custom-scrollbar-minimal p-1.5"
          >
            <div className="flex md:flex-col gap-1.5 h-full md:h-auto">
              {allItemsForLegend.map((item) => (
                <div
                  key={item.index}
                  className={`group relative overflow-hidden transition-all duration-200 cursor-pointer border flex-shrink-0 w-28 md:w-auto
                    ${
                      item.hidden
                        ? "opacity-40 bg-gray-50 border-gray-200 hover:opacity-60"
                        : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                    }
                    ${
                      hoveredSlice === item.index ? "shadow-md" : ""
                    }`}
                  style={
                    hoveredSlice === item.index
                      ? { boxShadow: `0 0 0 2px ${item.color}50`, borderColor: `${item.color}80` }
                      : undefined
                  }
                  onClick={() => toggleSlice(item.index)}
                  onMouseEnter={() => setHoveredSlice(item.index)}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  <div className="px-1.5 py-1 md:px-2 md:py-1.5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2">
                      <div className="flex items-center gap-1.5 md:flex-shrink-0">
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-3 h-3 md:w-5 md:h-5 transition-transform duration-200 group-hover:scale-110"
                            style={{ backgroundColor: item.color }}
                          />
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center md:gap-2 min-w-0">
                          <div className="text-[10px] md:text-xs font-bold text-slate-900 group-hover:text-slate-800 leading-tight tracking-tight truncate min-w-0">
                            {getDisplayName(item.item.name)}
                          </div>
                          <div className="text-[11px] md:text-sm font-black text-slate-900 tracking-tight md:block">
                            {!item.hidden
                              ? formatValue(item.value, decimal, showPercentage)
                              : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right md:flex md:items-center md:gap-1.5 md:flex-shrink-0">
                        <span
                          className="text-[8px] md:text-xs font-black px-1 py-0.5 border"
                          style={
                            !item.hidden
                              ? { background: `${item.color}22`, color: item.color, borderColor: `${item.color}55` }
                              : { background: "#fff", color: "#000", borderColor: "rgba(203,213,225,0.7)" }
                          }
                        >
                          {!item.hidden
                            ? `${item.formattedPercentage}%`
                            : "Hidden"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-250 pointer-events-none" />
                </div>
              ))}
            </div>
          </div>

          {showScrollIndicator && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 pointer-events-none hidden md:block">
              <div className="bg-white/80 backdrop-blur-xl rounded-full p-1 shadow-md border border-gray-300">
                <ChevronDown size={16} className="text-gray-500" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PieChartView;
