import { createElement, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { contrastingText } from "../charts/theme";
import { MORD, MONO, Empty } from "./_shared.jsx";

/* ── EVENT STRIP ─────────────────────────────────────────────────────────────
 * A record as a strip of days, oldest on the left. Every day with an event gets
 * a column of labelled cards, so nothing hides behind a hover; quiet stretches
 * collapse into a marker that says how long they lasted. Today is marked on the
 * spine, and days after it (bookings, plans) sit dashed. Opens scrolled to the
 * newest day.
 * ────────────────────────────────────────────────────────────────────────── */

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Dates are read from the string, never through `new Date(string)`, so a
// UTC-vs-local offset can't move an event onto the previous day.
const parseDay = (key) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
};
const dayNumber = (key) => {
  const p = parseDay(key);
  return p ? Date.UTC(p.y, p.mo - 1, p.d) / 86400000 : 0;
};
const clock = (at) => {
  const m = /T(\d{2}):(\d{2})/.exec(String(at));
  if (!m) return "";
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
};
const localToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const renderIcon = (icon, props) => (!icon ? null : isValidElement(icon) ? icon : createElement(icon, props));

export function EventStrip({
  theme,
  title = "Timeline",
  subtitle,
  icon,
  iconColor,
  events = [],
  categories = {},
  today,
  selectedId,
  onPick,
  aheadLabel = "Booked",
  emptyDayLabel = "Nothing recorded",
  minGapDays = 3,
}) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || t.accent;
  const todayKey = String(today || localToday()).slice(0, 10);
  const scroller = useRef(null);
  const [hoverId, setHoverId] = useState(null);

  const days = useMemo(() => {
    const byDay = new Map();
    [...(events || [])]
      .filter((e) => parseDay(String(e.at || "")))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .forEach((e) => {
        const k = String(e.at).slice(0, 10);
        byDay.set(k, [...(byDay.get(k) || []), e]);
      });
    if (byDay.size && !byDay.has(todayKey)) byDay.set(todayKey, []);
    return [...byDay.keys()].sort().map((k) => ({ key: k, list: byDay.get(k) }));
  }, [events, todayKey]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [days.length]);

  if (!days.length) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} subtitle={subtitle} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No events in range" />}
      </ChartCard>
    );
  }

  const dashed = `1px dashed ${t.text.muted}`;

  return (
    <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} subtitle={subtitle} icon={icon} iconColor={iconColor}>
      {() => (
        // ChartCard turns its only child into a clipped column, so the strip's
        // own row and scroll live one level down.
        <div>
        <div ref={scroller} aria-label="Events by day" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "row", alignItems: "stretch", overflow: "auto", paddingBottom: 4 }}>
          {days.map(({ key, list }, i) => {
            const gap = i ? dayNumber(key) - dayNumber(days[i - 1].key) - 1 : 0;
            const isToday = key === todayKey;
            const ahead = key > todayKey;
            const p = parseDay(key);
            const weekday = WEEKDAY[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()];
            const dateLabel = `${MORD[p.mo - 1]} ${p.d}`;
            return (
              <div key={key} style={{ display: "contents" }}>
                {gap >= minGapDays && (
                  <div aria-label={`${gap} days without events`} style={{ width: 44, flex: "none", display: "flex", flexDirection: "column" }}>
                    <div style={{ height: 40, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4 }}>
                      <span style={{ ...MONO, fontSize: 11, color: t.text.muted }}>{gap} days</span>
                    </div>
                    <div aria-hidden style={{ position: "relative", height: 16 }}>
                      <span style={{ position: "absolute", left: 0, right: 0, top: "50%", borderTop: dashed, opacity: 0.6 }} />
                    </div>
                  </div>
                )}
                <section aria-label={`${weekday} ${dateLabel}`} style={{ flex: "1 0 136px", minWidth: 136, display: "flex", flexDirection: "column" }}>
                  <div style={{ height: 40, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 6px 4px" }}>
                    {isToday ? (
                      <span style={{ alignSelf: "flex-start", background: accent, color: contrastingText(accent), fontSize: 12, fontWeight: 600, lineHeight: "20px", padding: "0 6px", borderRadius: 6 }}>
                        Today
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: t.text.muted }}>{ahead ? aheadLabel : weekday}</span>
                    )}
                    <span style={{ ...MONO, fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? t.text.primary : t.text.secondary }}>{dateLabel}</span>
                  </div>

                  {/* the spine: solid up to today, dashed after it, a dot on each day */}
                  <div aria-hidden style={{ position: "relative", height: 16 }}>
                    <span
                      style={ahead
                        ? { position: "absolute", left: 0, right: 0, top: "50%", borderTop: dashed, opacity: 0.6 }
                        : { position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: t.grid }}
                    />
                    <span
                      style={{
                        position: "absolute", left: 6, top: "50%", width: 10, height: 10, borderRadius: "50%", transform: "translateY(-50%)", boxSizing: "border-box",
                        ...(isToday
                          ? { background: accent, outline: `4px solid color-mix(in srgb, ${accent} 22%, transparent)` }
                          : ahead
                            ? { border: `2px solid ${t.text.muted}`, background: "transparent" }
                            : { background: t.text.secondary }),
                      }}
                    />
                  </div>

                  <ul style={{ listStyle: "none", margin: "8px 0 0", padding: "0 8px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
                    {list.map((e) => {
                      const meta = categories[e.category] || {};
                      const color = meta.color || accent;
                      const on = e.id === selectedId;
                      const lit = on || e.id === hoverId;
                      return (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={onPick ? () => onPick(e.id, e) : undefined}
                            onMouseEnter={() => setHoverId(e.id)}
                            onMouseLeave={() => setHoverId(null)}
                            aria-current={on ? "true" : undefined}
                            style={{
                              position: "relative", width: "100%", overflow: "hidden", textAlign: "left", font: "inherit",
                              cursor: onPick ? "pointer" : "default",
                              padding: "6px 8px 6px 12px", borderRadius: 6,
                              border: `1px ${ahead ? "dashed" : "solid"} ${on ? t.text.muted : t.control.border}`,
                              background: lit ? t.control.hover : t.control.bg,
                              color: t.text.primary,
                              transition: "background .15s, border-color .15s",
                            }}
                          >
                            <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: color }} />
                            <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: 11, color: t.text.muted }}>
                              {meta.icon && (
                                <span role="img" aria-label={meta.label || e.category} style={{ display: "flex", color, flex: "none" }}>
                                  {renderIcon(meta.icon, { size: 13, strokeWidth: 2 })}
                                </span>
                              )}
                              <span style={MONO}>{clock(e.at)}</span>
                            </span>
                            <span
                              style={{
                                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                                marginTop: 2, fontSize: 13, lineHeight: "17px", color: t.text.primary, overflowWrap: "anywhere",
                              }}
                            >
                              {e.title}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {list.length === 0 && <li style={{ padding: "0 6px", fontSize: 12, color: t.text.muted }}>{emptyDayLabel}</li>}
                  </ul>
                </section>
              </div>
            );
          })}
        </div>
        </div>
      )}
    </ChartCard>
  );
}

export default EventStrip;
