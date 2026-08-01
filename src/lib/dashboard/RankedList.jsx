import { useState } from "react";
import { ChartCard, resolveTheme } from "../charts";

/**
 * RankedList — a ranked {label, value}[] list: rank badge, name, a share
 * rail (with an optional ghost rail underneath for a prior-period value),
 * and the value on the right. Same row shape the ranked-widget's own List
 * view (HorizontalBarView) uses, generalized to any label/value data instead
 * of one app's dataset shape.
 *
 * Pass `prev` on an item to get a 2-period comparison per row: a dimmer
 * ghost rail at the prior value's share of the same scale, a ▲/▼ delta%
 * under the label, and the prior value stacked under the current one.
 *
 * `solid`/`invertColor`: when this card sits on a solid gradient theme (see
 * `sectionTheme.js`'s `solidTheme()`), the theme's own accent is white, so a
 * "row fills with the accent, everything on it inverts to stay legible"
 * hover would invert to white-on-white. Pass `solid` and an `invertColor`
 * (the section's real hue) so hover instead flips the row to white with
 * that hue as ink — legible either way the card is themed.
 */
export function RankedList({ theme, title, icon, iconColor, items = [], formatValue, subtitle, solid = false, invertColor, prevLabel }) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || t.accent;
  const [hover, setHover] = useState(null);
  const rows = [...items].filter((d) => (d.value || 0) > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  const max = Math.max(...rows.map((d) => Math.max(d.value || 0, d.prev || 0)), 1);
  const total = rows.reduce((s, d) => s + (d.value || 0), 0);
  const fmt = formatValue || ((v) => v);
  const hasPrev = rows.some((d) => d.prev != null);

  const ink = invertColor || accent;
  const hoverBg = solid ? "#ffffff" : accent;
  const hoverText = solid ? ink : "#ffffff";
  const hoverBar = solid ? ink : "#ffffff";

  if (!rows.length) {
    return (
      <ChartCard theme={t} size="fill" width="100%" title={title} icon={icon} iconColor={iconColor}>
        {() => (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: t.text.muted, fontSize: 12 }}>
            No data
          </div>
        )}
      </ChartCard>
    );
  }

  return (
    <ChartCard
      theme={t} size="fill" width="100%" expandable controls={[]}
      title={title} icon={icon} iconColor={iconColor} subtitle={subtitle}
      headline={{ value: fmt(total) }}
      floatingHeader
    >
      {() => (
        <div style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
          {rows.map((d, i) => {
            const lit = hover === i;
            const inkNow = lit ? hoverText : t.text.primary;
            const inkDim = lit ? hoverText : t.text.muted;
            const deltaPct = hasPrev && d.prev ? Math.round(((d.value - d.prev) / d.prev) * 100) : null;
            return (
              <div
                key={d.label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 11, padding: hasPrev ? "7px 8px" : "10px 8px",
                  borderTop: i === 0 ? "none" : `1px solid ${lit ? "transparent" : t.control.border}`,
                  background: lit ? hoverBg : "transparent",
                  transition: "background 0.15s",
                  cursor: "default",
                }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: inkDim, width: 16, flexShrink: 0, opacity: lit ? 0.8 : 1 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block", fontSize: 12.5, fontWeight: 600, color: inkNow,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                    title={d.label}
                  >
                    {d.label}
                  </span>
                  {deltaPct != null && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: inkDim }}>
                      {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct)}% vs {prevLabel || "prev"}
                    </span>
                  )}
                </span>
                {/* current period over prior period, same scale — the ghost
                    bar underneath IS the comparison, not decoration */}
                <span style={{ display: "flex", flexDirection: "column", gap: 2, width: 70, flexShrink: 0 }}>
                  <span style={{ height: 5, background: lit ? `${hoverText}26` : t.grid }}>
                    <span style={{ display: "block", width: `${(d.value / max) * 100}%`, height: "100%", background: lit ? hoverBar : (i === 0 ? accent : `${accent}bb`) }} />
                  </span>
                  {hasPrev && (
                    <span style={{ height: 3, background: lit ? `${hoverText}1a` : t.grid }}>
                      <span style={{ display: "block", width: `${((d.prev || 0) / max) * 100}%`, height: "100%", background: lit ? `${hoverBar}88` : `${accent}55` }} />
                    </span>
                  )}
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 60, flexShrink: 0 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: inkNow }}>
                    {fmt(d.value)}
                  </span>
                  {hasPrev && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: inkDim }}>
                      {d.prev ? fmt(d.prev) : "—"}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

export default RankedList;
