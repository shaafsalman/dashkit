import { formatValue } from "./dataUtils.js";

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// Plain, solid gray-100 fill + a real gray-300 border — no translucency, no
// blur. A visible step in the gray family is what actually separates a row
// from the white chart body; a soft rgba wash reads as "the same color".
const CARD_CLASS = "bg-gray-100 border border-gray-300";

const HorizontalBarView = ({
  item,
  index,
  getItemValue,
  maxValue,
  barColor,
  numbered_ranking,
  decimal = true,
  allItems = [],
}) => {
  const shouldSkip = (() => {
    const match = item.name?.match(/^([A-Za-z]+)-(\d{2})$/);
    if (!match) return false;

    const [, month, year] = match;

    const sameMonthItems = allItems.filter((otherItem) => {
      const otherMatch = otherItem.name?.match(/^([A-Za-z]+)-(\d{2})$/);
      if (!otherMatch) return false;
      const [, otherMonth] = otherMatch;
      return otherMonth.toLowerCase() === month.toLowerCase();
    });

    if (sameMonthItems.length > 1) {
      const sorted = sameMonthItems.sort((a, b) => {
        const yearA = a.name.match(/-(\d{2})$/)[1];
        const yearB = b.name.match(/-(\d{2})$/)[1];
        return yearA.localeCompare(yearB);
      });

      return sorted[0].name !== item.name;
    }

    return false;
  })();

  if (shouldSkip) return null;

  const findCoupledMonths = () => {
    const match = item.name?.match(/^([A-Za-z]+)-(\d{2})$/);
    if (!match) return null;

    const [, month, year] = match;

    const sameMonthItems = allItems.filter((otherItem) => {
      const otherMatch = otherItem.name?.match(/^([A-Za-z]+)-(\d{2})$/);
      if (!otherMatch) return false;
      const [, otherMonth] = otherMatch;
      return otherMonth.toLowerCase() === month.toLowerCase();
    });

    if (sameMonthItems.length <= 1) return null;

    const allMonths = sameMonthItems.sort((a, b) => {
      const yearA = a.name.match(/-(\d{2})$/)[1];
      const yearB = b.name.match(/-(\d{2})$/)[1];
      return yearA.localeCompare(yearB);
    });

    const firstMonth = allMonths[0];
    return firstMonth.name === item.name ? allMonths : null;
  };

  const coupledMonths = findCoupledMonths();
  const formatNameWithFullYear = (name) => {
    if (!name) return name;
    const match = name.match(/^([A-Za-z]+)-(\d{2})$/);
    if (match) {
      const month = match[1];
      const year = match[2];
      const yearNum = parseInt(year);
      const fullYear = yearNum >= 50 ? 1900 + yearNum : 2000 + yearNum;
      return `${month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()}-${fullYear}`;
    }
    return name;
  };

  const rankBadge = numbered_ranking && (
    <span
      className="flex items-center justify-center w-5 h-5 text-[10px] font-bold text-gray-500 bg-gray-100 flex-shrink-0"
      style={{ fontFamily: MONO }}
    >
      {index + 1}
    </span>
  );

  if (coupledMonths) {
    return (
      <div className={`group p-2.5 md:p-3 mb-1.5 last:mb-0 border-l-4 ${CARD_CLASS}`} style={{ borderLeftColor: barColor }}>
        <div className="flex justify-between items-start md:items-center mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {rankBadge}
            <span
              className="text-sm md:text-[15px] font-bold text-gray-900 tracking-tight truncate min-w-0"
              style={{ fontFamily: SANS, letterSpacing: "-0.01em" }}
            >
              {(() => {
                const match = item.name.match(/^([A-Za-z]+)-(\d{2})$/);
                if (match) {
                  const monthName = match[1];
                  return (
                    monthName.charAt(0).toUpperCase() +
                    monthName.slice(1).toLowerCase()
                  );
                }
                return item.name;
              })()}
            </span>
          </div>
        </div>

        <div className="space-y-2.5 pl-1">
          {coupledMonths.map((monthItem, idx) => {
            let value = getItemValue(monthItem);

            if (value === undefined || value === null) {
              value = monthItem.value;
            }
            if (value === undefined || value === null) {
              value = monthItem.totalValue;
            }
            if (value === undefined || value === null) {
              value = 0;
            }

            const widthPercentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const totalPercentage =
              monthItem.totalPercentage !== undefined
                ? Math.round(monthItem.totalPercentage)
                : Math.round(widthPercentage);

            const percentageDisplay =
              totalPercentage === 0 &&
              widthPercentage > 0 &&
              widthPercentage < 1
                ? "<1"
                : totalPercentage;

            const formattedVal = formatValue(value, decimal);
            const opacity = ["E6", "B3", "99", "80"][idx] || "66";

            return (
              <div key={idx}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-medium text-gray-500">
                    {formatNameWithFullYear(monthItem.name)}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-sm font-extrabold text-gray-900"
                      style={{ fontFamily: MONO }}
                    >
                      {formattedVal}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5" style={{ color: barColor, backgroundColor: `${barColor}18` }}>
                      {percentageDisplay}%
                    </span>
                  </div>
                </div>
                <div className="flex bg-white h-1.5 overflow-hidden">
                  <div
                    className="h-1.5"
                    style={{
                      width: `${widthPercentage}%`,
                      background: `${barColor}${opacity}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const value = getItemValue(item) || item.value || 0;
  const widthPercentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const totalPercentage =
    item.totalPercentage !== undefined
      ? Math.round(item.totalPercentage)
      : Math.round(widthPercentage);

  const percentageDisplay =
    totalPercentage === 0 && widthPercentage > 0 && widthPercentage < 1
      ? "<1"
      : totalPercentage;

  const formattedVal = formatValue(value, decimal);

  return (
    <div
      className={`group hover:bg-gray-200 transition-colors duration-150 py-2 md:py-2.5 px-2.5 md:px-3 mb-1.5 last:mb-0 border-l-4 ${CARD_CLASS}`}
      style={{ borderLeftColor: barColor }}
    >
      <div className="flex justify-between items-center gap-3 mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {rankBadge}
          <span
            className="text-sm md:text-[15px] font-bold text-gray-900 truncate min-w-0"
            style={{ fontFamily: SANS, letterSpacing: "-0.01em" }}
          >
            {formatNameWithFullYear(item.name) || `Item ${index + 1}`}
          </span>
        </div>

        <div className="flex items-baseline gap-2 flex-shrink-0">
          <span
            className="text-base md:text-lg font-extrabold text-gray-900 tabular-nums"
            style={{ fontFamily: MONO, letterSpacing: "-0.02em" }}
          >
            {formattedVal}
          </span>
          <span
            className="text-[11px] font-bold whitespace-nowrap px-1.5 py-0.5"
            style={{ color: barColor, backgroundColor: `${barColor}18`, fontFamily: MONO }}
          >
            {percentageDisplay}%
          </span>
        </div>
      </div>

      <div className="flex bg-white h-1.5 overflow-hidden">
        <div
          className="h-1.5"
          style={{
            width: `${widthPercentage}%`,
            background: barColor,
          }}
        />
      </div>
    </div>
  );
};

export default HorizontalBarView;
