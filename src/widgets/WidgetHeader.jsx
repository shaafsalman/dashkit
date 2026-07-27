import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  isMobile = false,
  isLoading = false
}) => {
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

  const metricPills = metrics && metrics.length > 1 && (
    <div className={`flex ${isMobile ? 'gap-1' : 'gap-1.5'} flex-shrink-0`}>
      {metrics.map(metric => (
        <button
          key={metric.key}
          onClick={() => setSelectedMetric(metric.key)}
          className={`font-semibold whitespace-nowrap transition-colors duration-150 flex items-center justify-center ${
            isMobile ? 'px-1.5 py-1 text-[9px] min-h-[24px]' : 'px-2.5 py-1.5 text-[11px] min-h-[28px]'
          } ${
            selectedMetric === metric.key
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900'
          }`}
        >
          {metric.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`${isMobile ? 'px-2.5 py-2' : 'px-4 py-2'} bg-white`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
            {HeaderIcon && <HeaderIcon className={`${isMobile ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]'} text-gray-500 flex-shrink-0`} />}
            <h2
              className={`truncate font-extrabold text-gray-900 ${isMobile ? 'text-[14px]' : 'text-[17px]'}`}
              style={{ fontFamily: SANS, letterSpacing: '-0.01em' }}
            >
              {title}
            </h2>
          </div>
          {yearNav}
        </div>
        <div className="flex items-center gap-2">
          <div ref={chartYearToggleRef} className="flex items-center gap-1" />
          {metricPills}
        </div>
      </div>
    </div>
  );
};

export default WidgetHeader;
