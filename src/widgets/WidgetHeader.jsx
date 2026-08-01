import React from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const WidgetHeader = ({
  HeaderIcon,
  title,
  enableYearNavigation,
  availableYears,
  selectedYear,
  navigateYear,
  canNavigatePrev,
  canNavigateNext,
  metrics,
  selectedMetric,
  setSelectedMetric,
  // Portal target for a chart view's own year toggle (RASK vs CASK-style
  // per-year filter, distinct from enableYearNavigation above). The toggle's
  // state/logic stays owned by the chart view itself — this only gives it a
  // place in the header instead of floating inside the chart body, where it
  // ate into the plot area and collided with the legend.
  chartYearToggleRef,
  // Portal target for a chart view's compact 2-series legend (e.g. "● 2025
  // ● 2026"). Chart views only portal here when they have exactly 2 items —
  // any more and a header row gets crowded, so they keep floating their own
  // in-chart legend badge instead. Same "host owns the slot, chart owns the
  // content" split as chartYearToggleRef.
  chartLegendRef,
  isMobile = false,
  isLoading = false,
  // "sm" | "md" | "lg" — the widget's own measured width, not the viewport.
  density = 'lg',
  expanded = false,
  onToggleExpand
}) => {
  const isSm = density === 'sm';

  if (isLoading) {
    return (
      <div className={`${isMobile ? 'px-2 pt-1.5' : 'px-4 pt-2.5'} py-2 bg-white border-b border-gray-100`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className={`${isMobile ? 'w-3 h-3' : 'w-5 h-5'} bg-gray-200`}></div>
                <div className={`${isMobile ? 'h-3 w-20' : 'h-4 w-32'} bg-gray-200`}></div>
              </div>

              {enableYearNavigation && availableYears.length > 1 && (
                <div className={`flex items-center bg-gray-100 ${isMobile ? 'px-1.5 py-0.5' : 'px-2.5 py-1.5'}`}>
                  <div className={`${isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'} bg-gray-200`}></div>
                  <div className={`${isMobile ? 'w-8 h-3' : 'w-16 h-4'} bg-gray-200 mx-2`}></div>
                  <div className={`${isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'} bg-gray-200`}></div>
                </div>
              )}
            </div>

            {metrics && metrics.length > 1 && (
              <div className="flex gap-1">
                {metrics.slice(0, isMobile ? 2 : 3).map((_, index) => (
                  <div key={index} className={`${isMobile ? 'w-10 h-5' : 'w-16 h-7'} bg-gray-200`}></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const yearNav = enableYearNavigation && availableYears.length > 1 && (
    <div className={`flex items-center bg-gray-50 border border-gray-200 ${isMobile ? 'px-1 py-0.5 ml-1' : 'px-1.5 py-1'} flex-shrink-0`}>
      <button
        onClick={() => navigateYear('prev')}
        disabled={!canNavigatePrev}
        className={`flex items-center justify-center transition-colors duration-150 ${isMobile ? 'p-0.5 min-w-[20px] min-h-[20px]' : 'p-1 min-w-[24px] min-h-[24px]'} ${
          canNavigatePrev ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200' : 'text-gray-300 cursor-not-allowed'
        }`}
      >
        <ChevronLeft size={isMobile ? 10 : 13} />
      </button>
      <span
        className={`font-bold text-gray-900 text-center ${isMobile ? 'text-[10px] px-1 min-w-[20px]' : 'text-sm px-2.5 min-w-[48px]'}`}
        style={{ fontFamily: MONO }}
      >
        {selectedYear}
      </span>
      <button
        onClick={() => navigateYear('next')}
        disabled={!canNavigateNext}
        className={`flex items-center justify-center transition-colors duration-150 ${isMobile ? 'p-0.5 min-w-[20px] min-h-[20px]' : 'p-1 min-w-[24px] min-h-[24px]'} ${
          canNavigateNext ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200' : 'text-gray-300 cursor-not-allowed'
        }`}
      >
        <ChevronRight size={isMobile ? 10 : 13} />
      </button>
    </div>
  );

  // Text-with-underline rather than filled pills. Three solid dark chips next
  // to a solid dark year toggle made the header a wall of competing buttons and
  // buried the title; the active mark now carries the state instead of a fill.
  const metricPills = metrics && metrics.length > 1 && (
    <div className={`flex ${isSm ? 'gap-2' : 'gap-3'} flex-shrink-0`}>
      {metrics.map(metric => (
        <button
          key={metric.key}
          onClick={() => setSelectedMetric(metric.key)}
          title={metric.label}
          className={`relative whitespace-nowrap font-bold transition-colors duration-150 pb-0.5 ${
            isSm ? 'text-[10px]' : 'text-[12px]'
          } ${
            selectedMetric === metric.key
              ? "text-gray-900"
              : "text-gray-500 hover:text-gray-900"
          }`}
          style={{ fontFamily: SANS }}
        >
          {metric.label}
          <span
            className={`absolute inset-x-0 -bottom-px h-[2px] transition-colors duration-150 ${
              selectedMetric === metric.key ? 'bg-gray-900' : 'bg-transparent'
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className={`${isSm ? 'px-2 py-1.5' : isMobile ? 'px-2.5 py-2' : 'px-4 py-2'} bg-white`}>
      {/* items-start, not items-center: the title wraps instead of shrinking
          or truncating (see the h2 below), so this row can no longer assume
          every child is exactly one line tall. */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-start gap-1.5 sm:gap-2.5">
            {HeaderIcon && <HeaderIcon className={`${isSm ? 'w-3.5 h-3.5' : isMobile ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]'} text-gray-500 flex-shrink-0 mt-0.5`} />}
            {/* Wraps instead of truncating or shrinking to fit — a fixed-size
                JS measurement (tried twice: ResizeObserver, then also
                re-checking after webfont load) kept silently failing to
                catch every case a title could overflow its box. Wrapping
                can't fail that way: the browser lays out exactly however
                much space text needs, no measurement to get wrong. */}
            <h2
              className={`min-w-0 flex-1 font-extrabold text-gray-900 leading-tight ${
                isSm ? 'text-[13px]' : isMobile ? 'text-[14px]' : 'text-[17px]'
              }`}
              style={{ fontFamily: SANS, letterSpacing: '-0.01em' }}
            >
              {title}
            </h2>
          </div>
          {yearNav}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Year scope and metric selector are different kinds of control, so
              they stay visually distinct — but both are now quiet: the year
              toggle is a light segmented track (styled by the chart views that
              portal into here) and the metrics are underlined text. The rule
              between them drops out when no year toggle is mounted. */}
          <div
            ref={chartYearToggleRef}
            className="peer flex items-center gap-0.5 empty:hidden"
          />
          {metrics && metrics.length > 1 && (
            <span className="hidden peer-[:not(:empty)]:block w-px h-4 bg-gray-200" />
          )}
          {metricPills}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              title={expanded ? 'Close' : 'Expand'}
              aria-label={expanded ? 'Close expanded view' : 'Expand widget'}
              className="flex items-center justify-center p-1 -mr-1 text-gray-300 hover:text-gray-700 transition-colors duration-150"
            >
              {expanded ? <X size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WidgetHeader;
