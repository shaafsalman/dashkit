import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { formatValue } from "./dataUtils.js";

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// The disc's own size within its 350x350 viewBox — was r=105 (60% of the
// viewBox half-width), which read as filling its box edge-to-edge with
// almost no breathing room. 80 leaves a real margin on every side.
const CENTER = 175;
const OUTER_R = 80;
const HUB_R = 32;

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
  const containerRef = useRef(null);
  // A side-by-side legend+disc layout wastes most of a TALL bento tile: the
  // disc stays pinned to a modest max-width while the legend column (and the
  // empty space beside a short one) just goes on for the rest of the height.
  // Stack pie-above/legend-below instead once the tile is meaningfully
  // taller than it is wide, so the disc actually gets to grow into the space.
  const [isTall, setIsTall] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setIsTall(height > width * 1.15);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

    const startX = CENTER + OUTER_R * Math.cos(((startAngle - 90) * Math.PI) / 180);
    const startY = CENTER + OUTER_R * Math.sin(((startAngle - 90) * Math.PI) / 180);
    const endX = CENTER + OUTER_R * Math.cos(((endAngle - 90) * Math.PI) / 180);
    const endY = CENTER + OUTER_R * Math.sin(((endAngle - 90) * Math.PI) / 180);
    const largeArcFlag = angle > 180 ? 1 : 0;

    return {
      item,
      index: originalIndex,
      value,
      percentage,
      formattedPercentage,
      color,
      path: `M ${CENTER} ${CENTER} L ${startX} ${startY} A ${OUTER_R} ${OUTER_R} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`,
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

  // Resolve the hovered row from the LEGEND list, not from `slices`: hidden
  // items are excluded from `slices`, so hovering one looked up nothing and the
  // tooltip rendered "undefined%".
  const hoveredEntry =
    hoveredSlice === null
      ? null
      : allItemsForLegend.find((e) => e.index === hoveredSlice) || null;

  // Same small white-chip-on-gray-track segment the bar/line/area views use.
  // This one was still a large emerald-filled button — the only green control
  // in any header, and roughly twice the size of its counterparts.
  const yearToggle = hasMultipleYears && (
    <div className="flex items-center gap-0.5 bg-gray-100 p-0.5">
      {detectedYears.map((year) => (
        <button
          key={year}
          onClick={() => setSelectedYear(year)}
          className={`px-2 py-0.5 text-[10px] font-bold transition-colors duration-150 ${
            selectedYear === year
              ? "bg-white text-gray-900"
              : "text-gray-400 hover:text-gray-600"
          }`}
          style={{ fontFamily: MONO }}
        >
          {year.toString()}
        </button>
      ))}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`flex ${isTall ? "flex-col" : "flex-col md:flex-row"} h-full w-full relative overflow-hidden`}
    >
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
          pie_legend ? (isTall ? "flex-1 w-full" : "flex-1 md:w-2/3") : "w-full"
        } flex justify-center items-center ${
          pie_legend ? (isTall ? "h-2/3" : "h-2/3 md:h-full") : "h-full"
        } relative ${isTall ? "order-1" : "order-1 md:order-2"} ${hasMultipleYears && !yearTogglePortal ? "pt-10" : ""}`}
      >
        <div
          className={`w-full aspect-square relative ${
            isTall ? "max-w-[420px] lg:max-w-[520px]" : "max-w-[280px] md:max-w-[340px] lg:max-w-[420px]"
          }`}
        >
          <svg width="100%" height="100%" viewBox="0 0 350 350">
            {/* Flat, sharp slices: the drop-shadow filter, gradient overlay and
                glow made the disc read as a glossy 3D pie rather than a chart. */}
            <g>
              {slices.map((slice) => (
                <g
                  key={slice.index}
                  onMouseEnter={() => setHoveredSlice(slice.index)}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  {slice.isSingleSlice ? (
                    <g>
                      <circle
                        cx={CENTER}
                        cy={CENTER}
                        r={OUTER_R}
                        fill={slice.color}
                        stroke="var(--chart-tooltip-bg)"
                        strokeWidth="4"
                        className={`transition-all duration-300 cursor-pointer ${
                          hoveredSlice === slice.index
                            ? "opacity-100 filter brightness-110"
                            : "opacity-92"
                        }`}
                      />
                    </g>
                  ) : (
                    <g>
                      <path
                        d={slice.path}
                        fill={slice.color}
                        stroke="var(--chart-tooltip-bg)"
                        strokeWidth="3"
                        className={`transition-all duration-300 cursor-pointer ${
                          hoveredSlice === slice.index
                            ? "opacity-100 filter brightness-110"
                            : "opacity-92"
                        }`}
                        style={
                          hoveredSlice === slice.index
                            ? { transform: "scale(1.03)", transformOrigin: `${CENTER}px ${CENTER}px` }
                            : undefined
                        }
                      />
                      {hoveredSlice === slice.index && (
                        <path
                          d={slice.path}
                          fill="none"
                          stroke={slice.color}
                          strokeWidth="6"
                          opacity="0.85"
                          className="animate-pulse pointer-events-none"
                        />
                      )}
                    </g>
                  )}
                </g>
              ))}

              {/* Flat hub, matching the card surface — was a radial-gradient
                  "dome" plus three faint concentric rings, a glossy/embossed
                  dial look left over from before the slices themselves were
                  flattened. One hairline border is enough to separate it from
                  the ring. */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={HUB_R}
                fill="var(--chart-tooltip-bg)"
                stroke="var(--chart-tick-dim)"
                strokeOpacity="0.3"
                strokeWidth="1.5"
              />

              {/* Centre readout always renders. It used to be gated behind
                  !showPercentage, so every percentage metric (Operating Margin
                  et al) drew an empty white disc. Percentages average — summing
                  them is meaningless — while absolute values total. */}
              {(
                <>
                  <text
                    x={CENTER}
                    y={CENTER - 7}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="900"
                    fill="var(--chart-tick)"
                    className="select-none tracking-tight"
                  >
                    {showPercentage ? "AVERAGE" : "TOTAL"}
                  </text>
                  <text
                    x={CENTER}
                    y={CENTER + 11}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="900"
                    fill="var(--chart-tick-strong)"
                    className="select-none tracking-tight"
                  >
                    {/* formatValue's 2nd arg is showPercentage, not decimal —
                        passing `decimal` made it append its own "%" on top of
                        ours, and it does no rounding below 1000, hence
                        "16.166666666666668%%". Round here, format once. */}
                    {showPercentage
                      ? `${
                          Math.round(
                            (visibleItems.length
                              ? total / visibleItems.length
                              : 0) * 10,
                          ) / 10
                        }%`
                      : formatValue(total, false)}
                  </text>
                </>
              )}
            </g>
          </svg>
        </div>

        {hoveredEntry && (
          // House tooltip: flat white, hairline border, sharp corners — was the
          // last glassmorphism panel left (blur, gradient wash, 2xl shadow).
          <div className="absolute top-2 right-2 bg-white border border-gray-300 px-2 py-1.5 max-w-[190px] z-50">
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="w-2 h-2 flex-shrink-0"
                  style={{ background: hoveredEntry.color }}
                />
                <div
                  className="text-[11px] font-bold text-gray-600 truncate"
                  style={{ fontFamily: SANS }}
                >
                  {getDisplayName(hoveredEntry.item?.name)}
                </div>
              </div>
              {/* Share lives here now that the legend no longer shows it.
                  Flat text, not a tinted shadowed badge. */}
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="text-[15px] font-extrabold text-gray-900"
                  style={{ fontFamily: MONO, letterSpacing: "-0.02em" }}
                >
                  {hoveredEntry.hidden
                    ? "—"
                    : formatValue(hoveredEntry.value, showPercentage)}
                </span>
                <span
                  className="text-[11px] font-bold text-gray-400 tabular-nums"
                  style={{ fontFamily: MONO }}
                >
                  {hoveredEntry.hidden
                    ? "hidden"
                    : `${hoveredEntry.formattedPercentage}%`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {pie_legend && (
        <div
          className={`w-full min-w-0 overflow-hidden bg-white relative border border-gray-300 m-1 ${
            isTall ? "h-1/3 order-2" : "md:w-1/3 md:max-w-[300px] h-1/5 md:h-full order-2 md:order-1"
          }`}
        >
          <div
            ref={scrollContainerRef}
            className="h-full overflow-x-auto overflow-y-hidden md:overflow-x-hidden md:overflow-y-auto custom-scrollbar-minimal p-1.5"
          >
            {/* h-full (not h-auto) on desktop so the column actually claims
                the panel's full height — each row then stretches evenly
                (md:flex-1) to fill whatever's left over, instead of stacking
                tight at the top and leaving the rest of the panel empty when
                there are only a few items. */}
            <div className="flex md:flex-col gap-1 h-full min-w-0">
              {allItemsForLegend.map((item) => (
                <div
                  key={item.index}
                  className={`group relative transition-colors duration-150 cursor-pointer border flex-shrink-0 w-32 md:w-auto md:flex-1 md:flex md:flex-col md:justify-center
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
                  {/* One tight row: swatch, truncating label, value, then a
                      plain percentage. The 5px swatch, tinted bordered badge
                      and gradient sheen made each entry tall enough that the
                      panel clipped after five items. */}
                  <div className="px-1.5 py-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      {/* Never truncated — the label wraps instead. The share
                          percentage moved to the hover tooltip so the name has
                          the room. */}
                      <span
                        className="text-[11px] font-semibold text-gray-700 min-w-0 flex-1 break-words leading-tight"
                        style={{ fontFamily: SANS }}
                      >
                        {getDisplayName(item.item.name)}
                      </span>
                      <span
                        className="text-[11px] font-bold text-gray-900 tabular-nums flex-shrink-0"
                        style={{ fontFamily: MONO }}
                      >
                        {/* formatValue takes (value, showPercentage) — the old
                            3-arg call put `decimal` in the percentage slot. */}
                        {!item.hidden
                          ? formatValue(item.value, showPercentage)
                          : "—"}
                      </span>
                    </div>
                  </div>
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
