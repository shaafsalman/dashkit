import { useState, useMemo } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { MONO, PLANE, compact, Empty } from "./_shared.jsx";

/* ── PROGRESS TRACK LIST ─────────────────────────────────────────────────────
 * One runway per airframe. How far down its runway the aircraft has rolled is
 * that tail's share of the busiest tail's hours. The runway itself is HTML so it
 * can stretch to any card width; the aircraft is a fixed-size SVG pinned to the
 * progress point, so its shape never distorts with the container.
 * ────────────────────────────────────────────────────────────────────────── */
export function ProgressTrackList({ theme, title = "Fleet Utilisation by Tail", icon, iconColor, tails = [] }) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || t.accent;
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    const clean = (tails || [])
      .map((d) => ({ name: String(d.name || "").trim(), value: Number(d.value) || 0 }))
      .filter((d) => d.name && d.value > 0)
      .sort((a, b) => b.value - a.value);
    return { clean, max: clean.length ? clean[0].value : 0, total: clean.reduce((s, d) => s + d.value, 0) };
  }, [tails]);

  if (!data.clean.length) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No aircraft utilisation in range" />}
      </ChartCard>
    );
  }

  // Whole hours below 10K — compact() collapses 1,243 and 1,190 to the same
  // "1.2K", which makes two differently-used airframes look identical.
  const hours = (n) => (n >= 1e4 ? compact(n) : Math.round(n).toLocaleString());
  const TRACK_H = 12;
  const PLANE_BOX = 22;

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
      subtitle={`${data.clean.length} tails · ${compact(data.total)} hours`}
    >
      {() => (
        // flex column with flex-1 rows: a short fleet (5 tails in a tall
        // 2-row card) stretches to fill the full height instead of bunching
        // at the top over dead space; a long fleet still scrolls.
        <div style={{ height: "100%", minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* column header — sticky so it stays put while the rows scroll */}
          <div
            style={{
              position: "sticky", top: 0, zIndex: 5,
              display: "flex", alignItems: "center", gap: 14, padding: "8px 4px",
              ...MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: t.text.muted,
              background: t.surface, borderBottom: `1px solid ${t.control.border}`,
            }}
          >
            <span style={{ minWidth: 82, flexShrink: 0, textAlign: "center" }}>Tail</span>
            <span style={{ flex: 1, minWidth: 0 }}>Utilisation</span>
            <span style={{ minWidth: 62, flexShrink: 0, textAlign: "right" }}>Hours</span>
            <span style={{ minWidth: 40, flexShrink: 0, textAlign: "right" }}>Share</span>
          </div>
          {data.clean.map((d, i) => {
            const frac = data.max ? d.value / data.max : 0;
            const share = data.total ? (d.value / data.total) * 100 : 0;
            const lead = i === 0;
            const col = lead ? accent : t.text.secondary;
            const lit = hover === i;
            // Same inverted-row hover as RankedList: the whole row fills with
            // the accent, everything on it inverts to white.
            const hoverBg = accent;
            const hoverText = "#ffffff";
            // Travel between a 10px threshold margin and PLANE_BOX from the end.
            const pos = `calc(10px + ${frac} * (100% - ${10 + PLANE_BOX}px))`;

            return (
              <div
                key={d.name}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "12px 4px",
                  flex: "1 1 0", minHeight: 48,
                  borderTop: i === 0 ? "none" : `1px solid ${lit ? hoverBg : t.control.border}`,
                  background: lit ? hoverBg : "transparent",
                  transition: "background .15s",
                  cursor: "default",
                }}
              >
                <span
                  style={{
                    ...MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                    color: lit ? hoverBg : (lead ? "#fff" : t.text.primary),
                    background: lit ? "#fff" : (lead ? accent : "transparent"),
                    border: `1px solid ${lit ? "#fff" : (lead ? accent : t.control.border)}`,
                    padding: "5px 9px", minWidth: 82, textAlign: "center", flexShrink: 0,
                  }}
                >
                  {d.name}
                </span>

                <div style={{ flex: 1, minWidth: 0, position: "relative", height: PLANE_BOX }}>
                  {/* asphalt */}
                  <div style={{ position: "absolute", left: 0, right: 0, top: (PLANE_BOX - TRACK_H) / 2, height: TRACK_H, background: lit ? "rgba(255,255,255,0.22)" : (t.mode === "light" ? "#f1f5f9" : "rgba(255,255,255,0.06)") }} />
                  {/* rolled portion */}
                  <div style={{ position: "absolute", left: 0, width: `${frac * 100}%`, top: (PLANE_BOX - TRACK_H) / 2, height: TRACK_H, background: lit ? "#fff" : col, opacity: lit ? 0.16 : (lead ? 0.18 : 0.11) }} />
                  {/* threshold bars */}
                  {[0, 1, 2, 3].map((k) => (
                    <div key={k} style={{ position: "absolute", left: 2 + k * 2.6, top: (PLANE_BOX - TRACK_H) / 2 + 2.5, width: 1.2, height: TRACK_H - 5, background: lit ? "rgba(255,255,255,0.75)" : t.text.muted, opacity: 0.55 }} />
                  ))}
                  {/* centreline: solid behind the aircraft, dashed ahead */}
                  <div style={{ position: "absolute", left: 10, width: `calc(${frac * 100}% - 10px)`, top: PLANE_BOX / 2 - 0.75, height: 1.5, background: lit ? "#fff" : col }} />
                  <div
                    style={{
                      position: "absolute", left: `${frac * 100}%`, right: 4, top: PLANE_BOX / 2 - 0.5, height: 1,
                      backgroundImage: `repeating-linear-gradient(90deg,${lit ? "rgba(255,255,255,0.7)" : t.text.muted} 0 5px,transparent 5px 11px)`,
                      opacity: 0.5,
                    }}
                  />
                  {/* the aircraft — fixed box, so the glyph keeps its shape */}
                  <svg
                    width={PLANE_BOX}
                    height={PLANE_BOX}
                    viewBox="-8 -8 16 16"
                    style={{ position: "absolute", left: pos, top: 0, transform: "translateX(-50%)", overflow: "visible" }}
                    aria-hidden="true"
                  >
                    <g transform={`scale(1.55)`}>
                      <path
                        d={PLANE}
                        fill={lit ? "#ffffff" : col}
                        stroke={lit ? "rgba(0,0,0,0.35)" : "none"}
                        strokeWidth={lit ? 1.2 : 0}
                        strokeLinejoin="round"
                      />
                    </g>
                  </svg>
                </div>

                <span style={{ ...MONO, fontSize: 15, fontWeight: 700, color: lit ? hoverText : t.text.primary, minWidth: 62, textAlign: "right", flexShrink: 0 }}>
                  {hours(d.value)}
                </span>
                <span style={{ ...MONO, fontSize: 11.5, color: lit ? hoverText : (lead ? accent : t.text.muted), minWidth: 40, textAlign: "right", flexShrink: 0 }}>
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

/* ── FUEL FAN ────────────────────────────────────────────────────────────────
 * Twelve blades, one per month, length = fuel burned per flight. Concentric
 * reference rings give the blades a scale to be read against, so the fan is
 * ordered rather than decorative.
 * ────────────────────────────────────────────────────────────────────────── */

export default ProgressTrackList;
