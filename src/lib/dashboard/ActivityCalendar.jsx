import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ChartCard, resolveTheme } from "../charts";
import { darken, contrastingText } from "../charts/theme";
import { MORD, MONTH_FULL, DOW, MONO, compact, Empty } from "./_shared.jsx";

/* ── ACTIVITY CALENDAR ─────────────────────────────────────────────────────────
 * A real month grid, one cell per day, shaded by that day's flight count. Steps
 * month by month through whatever range the data covers.
 * ────────────────────────────────────────────────────────────────────────── */
export function ActivityCalendar({ theme, title = "Flight Calendar", icon, iconColor, days = [], unitLabel = "flights" }) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || t.accent;
  const onBrand = String(t.text.primary).toLowerCase() === "#ffffff";

  // Dates are parsed numerically, never through `new Date(string)`, so a
  // UTC-vs-local offset can't shift a flight onto the previous day.
  const data = useMemo(() => {
    const byKey = {};
    const monthSet = {};
    (days || []).forEach((d) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d.date || ""));
      if (!m) return;
      const y = +m[1], mo = +m[2], dd = +m[3];
      const val = Number(d.value) || 0;
      byKey[`${y}-${mo}-${dd}`] = (byKey[`${y}-${mo}-${dd}`] || 0) + val;
      monthSet[`${y}-${mo}`] = true;
    });
    const monthsAvail = Object.keys(monthSet)
      .map((k) => { const [y, mo] = k.split("-").map(Number); return { y, mo }; })
      .sort((a, b) => (a.y - b.y) || (a.mo - b.mo));
    return { byKey, monthsAvail, max: Math.max(1, ...Object.values(byKey)) };
  }, [days]);

  const [idx, setIdx] = useState(null);
  const [hoverDay, setHoverDay] = useState(null);
  const cursor = idx == null ? data.monthsAvail.length - 1 : Math.min(idx, data.monthsAvail.length - 1);

  if (!data.monthsAvail.length) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No daily flight data in range" />}
      </ChartCard>
    );
  }

  const { y, mo } = data.monthsAvail[cursor];
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const firstDow = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7; // Monday-first

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthTotal = Array.from({ length: daysInMonth }, (_, i) => data.byKey[`${y}-${mo}-${i + 1}`] || 0).reduce((a, b) => a + b, 0);
  const busiest = Array.from({ length: daysInMonth }, (_, i) => ({ d: i + 1, v: data.byKey[`${y}-${mo}-${i + 1}`] || 0 }))
    .reduce((b, c) => (c.v > b.v ? c : b), { d: 0, v: 0 });

  return (
    <ChartCard
      theme={t}
      size="fill"
      width="100%"
      expandable
      controls={[]}
      title={title}
      icon={icon}
      iconColor={iconColor}
      floatingHeader
      headline={{
        value: compact(monthTotal),
        legend: <span style={{ ...MONO, fontSize: 11, color: t.text.muted, letterSpacing: "0.06em" }}>{unitLabel}</span>,
      }}
    >
      {() => (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
          {/* month stepper — plain icon buttons, no button-box borders */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexShrink: 0 }}>
            <button
              onClick={() => setIdx(Math.max(0, cursor - 1))}
              disabled={cursor === 0}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", background: "transparent", width: 22, height: 22, padding: 0,
                cursor: cursor === 0 ? "default" : "pointer", opacity: cursor === 0 ? 0.3 : 1, color: t.text.secondary,
              }}
              aria-label="Previous month"
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text.primary, letterSpacing: "-0.01em" }}>
              {MONTH_FULL[mo - 1]} <span style={{ color: t.text.muted, fontWeight: 500 }}>{y}</span>
            </span>
            <button
              onClick={() => setIdx(Math.min(data.monthsAvail.length - 1, cursor + 1))}
              disabled={cursor === data.monthsAvail.length - 1}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", background: "transparent", width: 22, height: 22, padding: 0,
                cursor: cursor === data.monthsAvail.length - 1 ? "default" : "pointer",
                opacity: cursor === data.monthsAvail.length - 1 ? 0.3 : 1, color: t.text.secondary,
              }}
              aria-label="Next month"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* weekday header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, flexShrink: 0 }}>
            {DOW.map((d) => (
              <span key={d} style={{ ...MONO, fontSize: 8.5, letterSpacing: "0.06em", textAlign: "center", color: t.text.muted, paddingBottom: 5 }}>
                {d.toUpperCase()}
              </span>
            ))}
          </div>

          {/* day grid — no cell borders; intensity is carried purely by
              fill opacity against rounded, borderless cells, with the
              busiest day picked out by a thin ring instead of a hard edge */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "1fr", gap: 4, flex: 1, minHeight: 0 }}>
            {cells.map((d, i) => {
              if (d == null) return <span key={`pad-${i}`} />;
              const v = data.byKey[`${y}-${mo}-${d}`] || 0;
              const intensity = v / data.max;
              const isBusiest = busiest.d === d && v > 0;
              const lit = hoverDay === d;
              // A darker shade of the card's OWN accent, not a generic neutral
              // dark — so the selection ring always reads as "this accent,
              // deepened" (e.g. a darker blue on a blue card) instead of an
              // unrelated near-black that clashes with whichever accent color
              // a given card is using.
              const ringColor = onBrand ? "#334155" : darken(accent, 0.4);
              const brandIndex = Math.min(t.series.length - 1, Math.max(0, Math.round((1 - intensity) * (t.series.length - 1))));
              const cellFill = v > 0 ? (onBrand ? t.series[brandIndex] : accent) : (onBrand ? "rgba(255,255,255,.10)" : t.grid);
              const cellInk = v > 0 ? contrastingText(cellFill) : t.text.muted;
              return (
                <div
                  key={d}
                  onMouseEnter={() => setHoverDay(d)}
                  onMouseLeave={() => setHoverDay(null)}
                  style={{
                    position: "relative",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 6,
                    overflow: "hidden",
                    boxShadow: isBusiest
                      ? `inset 0 0 0 1.5px ${v > 0 ? "rgba(255,255,255,0.85)" : ringColor}, 0 1px 3px rgba(0,0,0,0.12)`
                      : lit
                        ? `inset 0 0 0 1.5px ${ringColor}, 0 3px 8px -2px ${ringColor}66`
                        : "none",
                    transform: lit ? "translateY(-1px) scale(1.07)" : "translateY(0) scale(1)",
                    transition: "transform .18s cubic-bezier(0.16,1,0.3,1), box-shadow .18s cubic-bezier(0.16,1,0.3,1)",
                    minHeight: 22,
                    cursor: "default",
                  }}
                >
                  {/* fill sits on its own layer so the intensity fade never
                      touches the number — putting `opacity` on the cell
                      itself faded the day's own text along with the
                      background, which made low-count days read as
                      disabled/greyed-out UI rather than real (if quiet)
                      data. */}
                  <div
                    style={{
                      position: "absolute", inset: 0,
                      background: cellFill,
                      opacity: onBrand ? 1 : v > 0 ? 0.28 + intensity * 0.72 : 1,
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      ...MONO, fontSize: 10.5,
                      fontWeight: isBusiest || lit ? 700 : v > 0 ? 600 : 400,
                      color: cellInk,
                    }}
                  >
                    {d}
                  </span>
                </div>
              );
            })}
          </div>

          {/* footer — the hovered day's detail replaces the month summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 9, marginTop: 8, borderTop: `1px solid ${t.control.border}`, flexShrink: 0, minHeight: 30 }}>
            {(() => {
              if (hoverDay != null) {
                const v = data.byKey[`${y}-${mo}-${hoverDay}`] || 0;
                const dayAvg = monthTotal / daysInMonth;
                const diff = v - dayAvg;
                const dow = DOW[(new Date(Date.UTC(y, mo - 1, hoverDay)).getUTCDay() + 6) % 7];
                return (
                  <>
                    <span style={{ ...MONO, fontSize: 12, fontWeight: 700, color: t.text.primary }}>
                      {dow} {hoverDay} {MORD[mo - 1]}
                    </span>
                    <span style={{ ...MONO, fontSize: 13, fontWeight: 700, color: v > 0 ? (onBrand ? t.text.primary : accent) : t.text.muted }}>
                      {compact(v)} {unitLabel}
                    </span>
                    <span style={{ fontSize: 11, color: t.text.muted }}>
                      {v === 0 ? "no movements" : `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)} vs daily avg`}
                    </span>
                    {hoverDay === busiest.d && busiest.v > 0 && (
                      <span style={{ ...MONO, fontSize: 9.5, fontWeight: 700, color: accent, border: `1px solid ${accent}`, padding: "1px 5px" }}>
                        BUSIEST
                      </span>
                    )}
                  </>
                );
              }
              return (
                <>
                  <span style={{ fontSize: 11, color: t.text.muted }}>
                    Busiest {busiest.d ? `${busiest.d} ${MORD[mo - 1]}` : "—"}
                  </span>
                  <span style={{ ...MONO, fontSize: 12, fontWeight: 700, color: t.text.primary }}>{busiest.v ? compact(busiest.v) : "—"}</span>
                  <span style={{ fontSize: 11, color: t.text.muted }}>
                    · {compact(monthTotal / daysInMonth)} / day avg
                  </span>
                </>
              );
            })()}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto", flexShrink: 0 }}>
              <span style={{ fontSize: 9.5, color: t.text.muted }}>Low</span>
              {[0.2, 0.45, 0.7, 1].map((o) => (
                <span key={o} style={{ width: 11, height: 11, background: accent, opacity: o }} />
              ))}
              <span style={{ fontSize: 9.5, color: t.text.muted }}>High</span>
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

/* ── FLEET RUNWAY STRIPS ─────────────────────────────────────────────────────
 * One runway per airframe. How far down its runway the aircraft has rolled is
 * that tail's share of the busiest tail's hours. The runway itself is HTML so it
 * can stretch to any card width; the aircraft is a fixed-size SVG pinned to the
 * progress point, so its shape never distorts with the container.
 * ────────────────────────────────────────────────────────────────────────── */

export default ActivityCalendar;
