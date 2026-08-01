import { useState } from "react";
import {
  Fuel,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  UtensilsCrossed,
  Luggage,
  Navigation,
  Wrench,
  Users,
  Truck,
  Building2,
  Shield,
  Receipt,
  MapPin,
  Calendar,
  Package,
} from "lucide-react";
import { formatValue } from "./dataUtils.js";

const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/**
 * Keyword → icon for list rows.
 *
 * Matched on the row label. Returns null when nothing matches, so rows without
 * a meaningful icon simply omit it rather than showing a generic glyph.
 *
 * Callers with their own mapping can pass `itemIcon(name, item)` instead — this
 * is only the default for the airline cost/route data the widget usually shows.
 */
const ICON_RULES = [
  [["fuel", "petrol", "gas"], Fuel],
  [["acmi", "lease", "charter", "aircraft"], Plane],
  [["landing", "arrival"], PlaneLanding],
  [["takeoff", "departure"], PlaneTakeoff],
  [["catering", "meal", "food", "beverage"], UtensilsCrossed],
  [["handling", "baggage", "luggage", "cargo"], Luggage],
  [["navigation", "overflight", "route", "enroute"], Navigation],
  [["maintenance", "repair", "engineering", "spare"], Wrench],
  [["crew", "staff", "salary", "payroll", "passenger", "pax"], Users],
  [["ground", "transport", "fleet"], Truck],
  [["airport", "terminal", "station", "facility", "rent"], Building2],
  [["insurance", "security", "safety"], Shield],
  [["tax", "fee", "charge", "levy", "duty"], Receipt],
  [["other", "misc", "general"], Package],
];

const MONTHS_RE =
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

const resolveIcon = (name) => {
  const label = String(name ?? "").toLowerCase();
  if (!label) return null;
  if (MONTHS_RE.test(label)) return Calendar;
  // Route pairs like "MGQ - NBO" / "MGQ/NBO".
  if (/[a-z]{3}\s*[-/–]\s*[a-z]{3}/i.test(label)) return MapPin;
  for (const [keywords, Icon] of ICON_RULES) {
    if (keywords.some((k) => label.includes(k))) return Icon;
  }
  // No keyword match — render nothing rather than a meaningless generic
  // glyph on every row.
  return null;
};

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
  // (name, item) => LucideIcon — lets a caller override the default keyword
  // matching with its own domain mapping.
  itemIcon,
  // Opt out of row icons entirely. The keyword matcher is a guess; where it
  // guesses wrong (route codes reading as map pins) the caller can silence it.
  showItemIcons = true,
}) => {
  // On hover, the row fills with its own accent (bar) color, so everything
  // sitting on top of it — rank, icon, label, value, bar — inverts to stay
  // legible. Same effect in light and dark mode, since it derives entirely
  // from the row's own data color, not the theme.
  const [isHovered, setIsHovered] = useState(false);

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
  const GroupIcon = showItemIcons
    ? (itemIcon && itemIcon(item.name, item)) || resolveIcon(item.name)
    : null;
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
    // Grouped variant now matches the single-row design: hairline separator
    // instead of a gray card with a colored spine.
    return (
      <div className="group px-1.5 py-2 border-b border-gray-100 last:border-b-0">
        <div className="flex justify-between items-center mb-1.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {rankBadge}
            {GroupIcon && (
              <GroupIcon
                className="w-[19px] h-[19px] flex-shrink-0"
                strokeWidth={2}
                style={{ color: barColor }}
              />
            )}
            <span
              className="text-[14px] font-semibold text-gray-700 truncate min-w-0"
              style={{ fontFamily: SANS, letterSpacing: "-0.005em" }}
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
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span
                    className="text-[12px] font-medium text-gray-500 truncate min-w-0"
                    style={{ fontFamily: SANS }}
                  >
                    {formatNameWithFullYear(monthItem.name)}
                  </span>
                  <div className="flex items-baseline gap-2 flex-shrink-0">
                    <span
                      className="text-[15px] font-bold text-gray-900 tabular-nums"
                      style={{ fontFamily: MONO, letterSpacing: "-0.02em" }}
                    >
                      {formattedVal}
                    </span>
                    <span
                      className="text-[11px] font-semibold text-gray-400 tabular-nums w-8 text-right"
                      style={{ fontFamily: MONO }}
                    >
                      {percentageDisplay}%
                    </span>
                  </div>
                </div>
                <div className="h-[7px] bg-gray-100 overflow-hidden">
                  <div
                    className="h-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${widthPercentage}%`,
                      background: `linear-gradient(90deg, ${barColor}${opacity} 0%, ${barColor}80 100%)`,
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
  const RowIcon = showItemIcons
    ? (itemIcon && itemIcon(item.name, item)) || resolveIcon(item.name)
    : null;

  // Every row used to be a card in its own right: gray fill, full border, a 4px
  // colored spine, a boxed rank badge, a tinted percentage chip and a bar on a
  // white track — six nested boxes per line, seven lines deep. The data is a
  // rank, a label, a value and a share; the only element that needs color is
  // the bar. Rows are now separated by a hairline and nothing else.
  return (
    <div
      className="group px-1.5 py-2 border-b border-gray-100 last:border-b-0 transition-colors duration-150"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ backgroundColor: isHovered ? barColor : undefined }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Rank sits in a fixed-width column so labels start on a common
              left edge instead of stepping right as the numbers widen. */}
          <span
            className={`w-3 flex-shrink-0 text-[10px] font-semibold tabular-nums text-right ${
              isHovered ? "text-white/70" : "text-gray-300"
            }`}
            style={{ fontFamily: MONO }}
          >
            {index + 1}
          </span>
          {/* Icon carries the row's identity; its tint fades with rank so the
              ordering is still readable without the numbers. Hovered, it
              inverts to white — barColor-on-barColor would vanish. */}
          {RowIcon && (
            <RowIcon
              className="w-[19px] h-[19px] flex-shrink-0 transition-opacity duration-200 group-hover:opacity-100"
              strokeWidth={2}
              style={{
                color: isHovered ? "#ffffff" : barColor,
                opacity: isHovered ? 1 : Math.max(0.45, 1 - index * 0.1),
              }}
            />
          )}
          <span
            className={`text-[14px] font-semibold truncate min-w-0 transition-colors duration-150 ${
              isHovered ? "text-white" : "text-gray-700 group-hover:text-gray-900"
            }`}
            style={{ fontFamily: SANS, letterSpacing: "-0.005em" }}
          >
            {formatNameWithFullYear(item.name) || `Item ${index + 1}`}
          </span>
        </div>

        <div className="flex items-baseline gap-2 flex-shrink-0">
          <span
            className={`text-[17px] font-bold tabular-nums ${isHovered ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: MONO, letterSpacing: "-0.02em" }}
          >
            {formattedVal}
          </span>
          <span
            className={`text-[11px] font-semibold tabular-nums w-8 text-right ${
              isHovered ? "text-white/80" : "text-gray-400"
            }`}
            style={{ fontFamily: MONO }}
          >
            {percentageDisplay}%
          </span>
        </div>
      </div>

      {/* Track is inset to align with the label, not the row edge, so the bars
          read as belonging to the text above them. 2px read as a hairline and
          lost against the value beside it — 6px gives the bar enough presence
          to carry the comparison, which is the whole point of the row. */}
      <div
        className="ml-[34px] h-[7px] bg-gray-100 overflow-hidden"
        style={{ backgroundColor: isHovered ? "rgba(255,255,255,0.25)" : undefined }}
      >
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{
            width: `${widthPercentage}%`,
            // Left-to-right ramp instead of a flat fill — gives the bar some
            // depth without introducing a second colour. Hovered, the row's
            // own fill IS barColor, so the bar inverts to white to stay
            // visible against it.
            background: isHovered
              ? "linear-gradient(90deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 100%)"
              : `linear-gradient(90deg, ${barColor} 0%, ${barColor}B3 100%)`,
          }}
        />
      </div>
    </div>
  );
};

export default HorizontalBarView;
