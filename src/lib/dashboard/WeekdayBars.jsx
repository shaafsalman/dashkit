import { useState, useMemo } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { DOW, MONO, compact, Empty } from "./_shared.jsx";

/* ── WEEKDAY BARS ────────────────────────────────────────────────────────────
 * Flights by day of week, each bar sitting in a full-height track so the busy
 * and quiet days read against the same ceiling.
 * ────────────────────────────────────────────────────────────────────────── */
export function WeekdayBars({ theme, title = "Weekly Flight Volume", icon, iconColor, days = [], unitLabel = "Flights" }) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || "#F59E0B";
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    // Monday-first buckets, matching the calendar widget.
    const buckets = Array.from({ length: 7 }, () => ({ total: 0, days: 0 }));
    (days || []).forEach((d) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d.date || ""));
      if (!m) return;
      const dow = (new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() + 6) % 7;
      buckets[dow].total += Number(d.value) || 0;
      buckets[dow].days += 1;
    });
    const total = buckets.reduce((s, b) => s + b.total, 0);
    return { buckets, total, max: Math.max(1, ...buckets.map((b) => b.total)) };
  }, [days]);

  if (!data.total) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No daily flight data in range" />}
      </ChartCard>
    );
  }

  const busiest = data.buckets.reduce((b, c, i) => (c.total > data.buckets[b].total ? i : b), 0);

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
        value: compact(data.total),
        legend: (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...MONO, fontSize: 11, color: t.text.muted, letterSpacing: "0.06em" }}>{unitLabel}</span>
            <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: accent }}>{DOW[busiest]} peak</span>
          </span>
        ),
      }}
    >
      {() => (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", paddingTop: 40 }}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", gap: 6 }}>
            {data.buckets.map((b, i) => {
              const frac = b.total / data.max;
              const lit = hover === i;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}
                >
                  {/* full-height track with the bar filling from the bottom */}
                  <div style={{ flex: 1, minHeight: 0, width: "100%", background: t.grid, display: "flex", alignItems: "flex-end", position: "relative" }}>
                    <div
                      style={{
                        width: "100%",
                        height: `${Math.max(3, frac * 100)}%`,
                        background: accent,
                        opacity: lit ? 1 : i === busiest ? 0.95 : 0.72,
                        transition: "opacity .15s",
                      }}
                    />
                    <span
                      style={{
                        ...MONO, position: "absolute", top: 2, left: 0, right: 0, textAlign: "center",
                        fontSize: 12, fontWeight: lit ? 700 : 600, color: "#fff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.55), 0 0 4px rgba(0,0,0,0.35)",
                      }}
                    >
                      {compact(b.total)}
                    </span>
                  </div>
                  <span style={{ ...MONO, fontSize: 12, marginTop: 5, color: lit || i === busiest ? t.text.primary : t.text.muted, fontWeight: lit || i === busiest ? 700 : 400 }}>
                    {DOW[i][0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

/* ── DESTINATION BOARD ───────────────────────────────────────────────────────
 * Where the passengers actually go. Routes are split on the arrival code and
 * summed, so this is destination traffic rather than departure traffic, with the
 * country resolved through the same airport map the world map uses.
 * ────────────────────────────────────────────────────────────────────────── */

export default WeekdayBars;
