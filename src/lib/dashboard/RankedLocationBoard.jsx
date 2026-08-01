import { useState, useMemo } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { MONO, compact, Empty } from "./_shared.jsx";

/* ── RANKED LOCATION BOARD ───────────────────────────────────────────────────────
 * Where the passengers actually go. Routes are split on the arrival code and
 * summed, so this is destination traffic rather than departure traffic, with the
 * country resolved through the same airport map the world map uses.
 * ────────────────────────────────────────────────────────────────────────── */
export function RankedLocationBoard({
  theme, title = "Top Destinations", icon, iconColor, routes = [], airportCountry = {}, airportName = {},
}) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || t.accent;
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    const byDest = {};
    (routes || []).forEach((r) => {
      // "MGQ-DXB" → destination DXB. Anything without a pair is skipped.
      const parts = String(r.name || r.route || "").trim().toUpperCase().split("-");
      if (parts.length < 2) return;
      const dest = parts[1].trim();
      if (!dest) return;
      byDest[dest] = (byDest[dest] || 0) + (Number(r.value ?? r.passengers) || 0);
    });
    const rows = Object.entries(byDest)
      .map(([code, value]) => ({
        code,
        value,
        city: airportName[code] || code,
        country: airportCountry[code] || "—",
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return { rows, total: rows.reduce((s, d) => s + d.value, 0), max: Math.max(1, ...rows.map((d) => d.value)) };
  }, [routes, airportCountry, airportName]);

  if (!data.rows.length) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No destination data in range" />}
      </ChartCard>
    );
  }

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
      subtitle={`${data.rows.length} destinations · ${compact(data.total)} passengers`}
    >
      {() => (
        <div style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
          {data.rows.map((d, i) => {
            const share = data.total ? (d.value / data.total) * 100 : 0;
            const lit = hover === i;
            return (
              <div
                key={d.code}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "10px 6px",
                  borderTop: i === 0 ? "none" : `1px solid ${t.control.border}`,
                  background: lit ? (t.mode === "light" ? "#f8fafc" : "rgba(255,255,255,0.04)") : "transparent",
                  transition: "background .15s",
                }}
              >
                {/* rank */}
                <span style={{ ...MONO, fontSize: 10, color: t.text.muted, width: 14, flexShrink: 0 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {/* airport code plate */}
                <span
                  style={{
                    ...MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em",
                    color: i === 0 ? "#fff" : t.text.primary,
                    background: i === 0 ? accent : "transparent",
                    border: `1px solid ${i === 0 ? accent : t.control.border}`,
                    padding: "4px 7px", minWidth: 46, textAlign: "center", flexShrink: 0,
                  }}
                >
                  {d.code}
                </span>
                {/* city + country */}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: t.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.city}
                  </span>
                  <span style={{ display: "block", fontSize: 10.5, color: t.text.muted }}>{d.country}</span>
                </span>
                {/* share rail */}
                <span style={{ width: 74, height: 5, background: t.grid, flexShrink: 0 }}>
                  <span style={{ display: "block", width: `${(d.value / data.max) * 100}%`, height: "100%", background: accent, opacity: i === 0 ? 1 : 0.7 }} />
                </span>
                <span style={{ ...MONO, fontSize: 13, fontWeight: 700, color: t.text.primary, minWidth: 52, textAlign: "right", flexShrink: 0 }}>
                  {compact(d.value)}
                </span>
                <span style={{ ...MONO, fontSize: 10.5, color: t.text.muted, minWidth: 36, textAlign: "right", flexShrink: 0 }}>
                  {share.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

/* ── COST BUBBLES ────────────────────────────────────────────────────────────
 * The cost base as overlapping circles — area is spend, so the three biggest
 * lines dominate visually — with every line itemised as a share bar beneath.
 * ────────────────────────────────────────────────────────────────────────── */

export default RankedLocationBoard;
