import { useState } from "react";
import { Plane } from "lucide-react";
import { ChartCard, resolveTheme } from "../charts";
import { useMeasuredBox, MONO, GRADIENTS } from "./_shared.jsx";

/* ── FLEET SNAPSHOT ─────────────────────────────────────────────────────────
 * Purpose-built fleet overview tile: aircraft count floating top-right, a
 * real monthly-utilisation bar chart in the middle (rounded gradient bars +
 * month labels), and lucide-iconed stat tiles at the bottom. Every number
 * maps to real data. */
export function FleetSnapshotCard({
  gradient = "violet",
  aircraft = 0,
  utilisation = [],          // [{ label, value }]
  stats = [],                // [{ icon, label, value }]
}) {
  const [cardRef, card] = useMeasuredBox({ width: 320, height: 240 });
  const [hover, setHover] = useState(null);
  const short = card.height < 250;
  const max = utilisation.reduce((m, b) => Math.max(m, Number(b.value) || 0), 1);
  const pad = short ? 12 : 14;
  return (
    <div
      ref={cardRef}
      style={{
        position: "relative",
        height: "100%",
        background: GRADIENTS[gradient] || gradient,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        color: "#fff",
        overflow: "hidden",
      }}
    >
      {/* floating aircraft count */}
      <div style={{ position: "absolute", top: pad - 2, right: pad, textAlign: "right" }}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{aircraft}</div>
        <div style={{ fontSize: 9, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 2 }}>aircraft</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 72 }}>
        <span style={{ display: "flex", opacity: 0.85 }}><Plane size={15} /></span>
        <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.02em", opacity: 0.95 }}>Monthly utilisation</span>
      </div>

      {/* monthly utilisation bar chart — real data, pretty bars with hover */}
      {utilisation.length > 0 && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 64 }}>
            {utilisation.map((m, i) => {
              const v = Number(m.value) || 0;
              const h = 10 + (v / max) * 44;
              const lit = hover === i;
              return (
                <div
                  key={m.label}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}
                >
                  {/* value — always visible above the bar */}
                  <span
                    style={{
                      ...MONO,
                      height: 13,
                      fontSize: 10,
                      fontWeight: lit ? 700 : 600,
                      color: "#fff",
                      opacity: lit ? 1 : 0.95,
                      textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                      transition: "font-weight .15s ease, opacity .15s ease",
                    }}
                  >
                    {Math.round(v)}
                  </span>
                  <div
                    style={{
                      width: "100%",
                      height: lit ? Math.min(56, h + 6) : h,
                      borderRadius: 2,
                      background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.45))",
                      opacity: lit ? 1 : 0.72,
                      boxShadow: lit ? "0 0 12px rgba(255,255,255,0.55)" : "0 2px 6px rgba(0,0,0,0.15)",
                      transition: "height .15s ease, opacity .15s ease, box-shadow .15s ease",
                    }}
                  />
                  <span style={{ fontSize: 8, color: "#fff", opacity: lit ? 1 : 0.72, letterSpacing: "0.04em" }}>
                    {String(m.label).slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* lucide-iconed stat tiles */}
      {stats.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 10 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)", padding: "6px 7px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden" }}>
                <span style={{ display: "flex", flexShrink: 0 }}>{s.icon}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
              </div>
              <div style={{ ...MONO, fontSize: 14, fontWeight: 700, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── TREND BARCODE ───────────────────────────────────────────────────────────
 * A smooth monthly curve over vertical strips, split into three states: earlier
 * months faded, the latest quarter solid, months with no data yet greyed out.
 * ────────────────────────────────────────────────────────────────────────── */

export default FleetSnapshotCard;
