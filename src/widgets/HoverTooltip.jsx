import React from 'react';

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/**
 * Hover readout for the chart views.
 *
 * Previously a 200px-min glassmorphism panel: backdrop blur, gradient overlay,
 * inner border, a gradient top rail, a blurred glow layer and a 20px value.
 * In a bento tile that covered a third of the plot. Now it is the same flat
 * white/gray-300 card the rest of the widget chrome uses, sized to its content.
 */
const HoverTooltip = ({
  isVisible,
  position = 'top-right',
  name,
  rows = [],
  percentage,
  subtitle = null,
  className = "",
}) => {
  if (!isVisible) return null;

  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  }[position] || 'top-2 right-2';

  // A single unlabeled row is the plain single-series case — shown as one
  // big value (with its own swatch) rather than a label:value list row.
  const isSimple = rows.length === 1 && !rows[0].label;

  return (
    <div
      className={`absolute ${positionClasses} z-50 pointer-events-none animate-tooltip-pop ${className}`}
    >
      <div
        className="border-2 px-3 py-2.5 min-w-[150px] max-w-[280px]"
        style={{
          backgroundColor: "var(--chart-tooltip-bg)",
          borderColor: "var(--chart-tooltip-border)",
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span
            className="text-sm font-bold text-gray-900 dark:text-white truncate"
            style={{ fontFamily: SANS }}
          >
            {name}
          </span>
          {percentage != null && isSimple && (
            <span
              className="text-xs font-bold text-gray-500 dark:text-gray-400 flex-shrink-0"
              style={{ fontFamily: MONO }}
            >
              {percentage}%
            </span>
          )}
        </div>

        {subtitle && (
          <div
            className="text-xs text-gray-400 dark:text-gray-500 truncate"
            style={{ fontFamily: SANS }}
          >
            {subtitle}
          </div>
        )}

        {!isSimple ? (
          <div className="mt-1 space-y-1">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  <span
                    className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate"
                    style={{ fontFamily: SANS }}
                  >
                    {row.label}
                  </span>
                </div>
                <span
                  className="text-sm font-bold text-gray-900 dark:text-white flex-shrink-0"
                  style={{ fontFamily: MONO }}
                >
                  {row.text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-0.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: rows[0].color }}
            />
            <div
              className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight"
              style={{ fontFamily: MONO, letterSpacing: '-0.02em' }}
            >
              {rows[0].text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HoverTooltip;
