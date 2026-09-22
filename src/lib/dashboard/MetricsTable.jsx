import { useMemo } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { MONO, NEG, compact, Empty } from "./_shared.jsx";

/* ── METRICS TABLE ───────────────────────────────────────────────────────────
 * Flights, revenue and on-time performance per departure station — the three
 * per-station series the API returns, finally on the same row.
 * ────────────────────────────────────────────────────────────────────────── */
export function MetricsTable({
  theme, title = "Metrics", icon, iconColor, stations = [], formatMoney,
  nameLabel = "Item", primaryLabel = "Volume", secondaryLabel = "Value", scoreLabel = "Score",
}) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || t.accent;
  const onBrand = String(t.text.primary).toLowerCase() === "#ffffff";
  const money = formatMoney || ((n) => `$${compact(n)}`);

  const rows = useMemo(
    () =>
      (stations || [])
        .map((s) => ({
          name: String(s.name || "").trim(),
          flights: Number(s.flights) || 0,
          revenue: Number(s.revenue) || 0,
          otp: Number(s.otp) || 0,
        }))
        .filter((s) => s.name && s.name.toLowerCase() !== "unknown" && s.flights > 0)
        .sort((a, b) => b.flights - a.flights)
        .slice(0, 7),
    [stations]
  );

  if (!rows.length) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No station data in range" />}
      </ChartCard>
    );
  }

  const th = { padding: "9px 10px", fontWeight: 700, fontSize: 11, color: t.text.secondary, textAlign: "right", whiteSpace: "nowrap" };
  const td = { padding: "10px", fontSize: 12.5, textAlign: "right", color: t.text.primary, whiteSpace: "nowrap" };

  return (
    <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} icon={icon} iconColor={iconColor}>
      {() => (
        <div style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, border: `1px solid ${t.control.border}`, borderRadius: 10, overflow: "hidden" }}>
            <thead>
              <tr style={{ background: onBrand ? "rgba(15,23,42,.16)" : t.mode === "light" ? "#f8fafc" : "rgba(255,255,255,0.05)" }}>
                <th style={{ ...th, textAlign: "left" }}>{nameLabel}</th>
                <th style={th}>{primaryLabel}</th>
                <th style={th}>{secondaryLabel}</th>
                <th style={th}>{scoreLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.name} style={{ borderTop: `1px solid ${t.control.border}` }}>
                  <td style={{ ...td, textAlign: "left" }}>
                    <span style={{ ...MONO, fontSize: 12.5, fontWeight: 700 }}>{s.name}</span>
                  </td>
                  <td style={{ ...td, ...MONO, fontWeight: 600 }}>{compact(s.flights)}</td>
                  <td style={{ ...td, ...MONO, fontWeight: 600 }}>{money(s.revenue)}</td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                      <span style={{ width: 40, height: 4, background: onBrand ? "rgba(15,23,42,.22)" : t.grid, flexShrink: 0, borderRadius: 99, overflow: "hidden" }}>
                        <span style={{ display: "block", width: `${Math.min(100, s.otp)}%`, height: "100%", background: onBrand ? (s.otp >= 75 ? "#E2E8F0" : "#94A3B8") : s.otp >= 75 ? accent : NEG }} />
                      </span>
                      <span style={{ ...MONO, fontSize: 12, fontWeight: 700, minWidth: 30 }}>{Math.round(s.otp)}%</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

/* ── WEEKDAY BARS ────────────────────────────────────────────────────────────
 * Flights by day of week, each bar sitting in a full-height track so the busy
 * and quiet days read against the same ceiling.
 * ────────────────────────────────────────────────────────────────────────── */

export default MetricsTable;
