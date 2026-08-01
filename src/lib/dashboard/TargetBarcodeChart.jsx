import { useState, useMemo, useRef } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { useMeasuredBox, MORD, MONO, NEG, shortMonth, Empty } from "./_shared.jsx";

/* ── TARGET BARCODE CHART ────────────────────────────────────────────────────────
 * Rounded gradient-filled monthly bars with a hatched band above a target
 * threshold (dashed reference line) — reads as "how far past/short of target"
 * at a glance. Fills whatever box it's given (square, wide, or tall — no
 * fixed aspect ratio baked in), with an always-responsive hover tooltip.
 * ────────────────────────────────────────────────────────────────────────── */
export function TargetBarcodeChart({
  theme, title = "Capacity", icon, iconColor, months = [], target = 75, unit = "%", formatValue,
}) {
  const t = resolveTheme(theme, "light");
  const accent = iconColor || t.accent;
  const fmt = formatValue || ((v) => `${Math.round(v)}${unit}`);
  const [hover, setHover] = useState(null);
  const uid = useRef(`cb-${Math.random().toString(36).slice(2, 8)}`).current;
  // Measured box, not a stretched fixed viewBox — preserveAspectRatio="none"
  // would warp the per-bar value labels into smears.
  const [boxRef, box] = useMeasuredBox({ width: 320, height: 200 });

  const data = useMemo(() => {
    const byMonth = {};
    (months || []).forEach((m) => {
      byMonth[shortMonth(m.month || m.name)] = Number(m.value) || 0;
    });
    const series = MORD.map((label) => ({ label, value: byMonth[label] ?? null }));
    const live = series.filter((d) => d.value != null && d.value > 0);
    return {
      series,
      max: Math.max(target, 1, ...live.map((d) => d.value)),
      avg: live.length ? live.reduce((s, d) => s + d.value, 0) / live.length : 0,
      any: live.length > 0,
    };
  }, [months, target]);

  if (!data.any) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No monthly data in range" />}
      </ChartCard>
    );
  }

  const shown = hover != null ? data.series[hover] : null;
  // Real-pixel geometry.
  const W = Math.max(220, box.width);
  const H = Math.max(120, box.height);
  const bw = W / 12;
  // Value labels were a fixed 11px regardless of card width. In a narrow slot
  // (e.g. a col-span-3 cell) that's wider than the ~25px gap between bars, so
  // neighbouring months' labels overlapped. Size the font off the actual
  // per-bar width instead — ~2.7px of monospace width per character of a
  // 4-char value like "2.5M" — so it always fits inside its own slot.
  const labelSize = Math.max(7, Math.min(11, bw / 2.7));
  // Reserved space at the top for the labels scales with their own font size,
  // so a bigger label (wide card) can't clip against the plot's top edge.
  const LABEL_ROOM = labelSize + 6;
  const baseline = H - 4;
  const plotH = baseline - LABEL_ROOM;
  const targetY = baseline - (target / data.max) * plotH;

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
        value: fmt(data.avg),
        legend: (
          <span style={{ ...MONO, fontSize: 11, letterSpacing: "0.06em", color: t.text.muted }}>
            Target {fmt(target)}
          </span>
        ),
      }}
    >
      {() => (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", paddingTop: 40 }}>
          <div ref={boxRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }} role="img" aria-label={title}>
              <defs>
                <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity="1" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0.55" />
                </linearGradient>
                <pattern id={`${uid}-h`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="rgba(255,255,255,0.3)" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                </pattern>
              </defs>

              {data.series.map((d, i) => {
                const x = i * bw + bw * 0.18;
                const w = bw * 0.64;
                const has = d.value != null;
                const h = has ? Math.max(6, (d.value / data.max) * plotH) : 4;
                const y = baseline - h;
                const lit = hover === i;
                const hatchTop = Math.max(y, targetY);
                const hatchH = Math.max(0, y + h - hatchTop);
                return (
                  <g key={d.label}>
                    <rect
                      x={x} y={y} width={w} height={h} rx={Math.min(6, w / 2)}
                      fill={has ? `url(#${uid}-g)` : t.grid}
                      opacity={has ? (lit ? 1 : 0.85) : 1}
                    />
                    {has && hatchH > 0 && (
                      <rect x={x} y={hatchTop} width={w} height={hatchH} rx={Math.min(6, w / 2)} fill={`url(#${uid}-h)`} />
                    )}
                    {has && d.value > 0 && (
                      <text
                        x={x + w / 2} y={y - 4} textAnchor="middle"
                        style={{ ...MONO, fontSize: lit ? labelSize + 1 : labelSize, fontWeight: lit ? 700 : 600, fill: lit ? t.text.primary : t.text.secondary }}
                      >
                        {fmt(d.value)}
                      </text>
                    )}
                    <rect
                      x={x - 2} y="0" width={w + 4} height={H} fill="transparent"
                      onMouseEnter={() => has && setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}

              <line x1="0" y1={targetY} x2={W} y2={targetY} stroke={t.text.secondary} strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
            </svg>

            {shown && (() => {
              // The readout box is ALWAYS white, so its ink must always be
              // dark — theme text/accent can both be white when this widget
              // sits on a solid gradient card, which rendered an empty-
              // looking white rectangle.
              const isWhiteAccent = /^#f|^#e|^#fff|^rgba?\(255/i.test(accent);
              const valueInk = isWhiteAccent ? "#18181B" : accent;
              return (
                <div style={{ position: "absolute", top: 4, right: 4, background: "#fff", border: "1px solid #d4d4d8", padding: "6px 10px", pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#18181B" }}>{shown.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ ...MONO, fontSize: 15, fontWeight: 800, color: valueInk }}>{fmt(shown.value)}</span>
                    <span style={{ fontSize: 10, color: shown.value >= target ? valueInk : NEG }}>
                      {shown.value >= target ? "+" : ""}{(shown.value - target).toFixed(1)} vs target
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ display: "flex", flexShrink: 0, paddingTop: 6 }}>
            {data.series.map((d, i) => (
              <span
                key={d.label}
                style={{ ...MONO, flex: 1, textAlign: "center", fontSize: 8.5, fontWeight: hover === i ? 700 : 400, color: hover === i ? t.text.primary : t.text.muted }}
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export default TargetBarcodeChart;
