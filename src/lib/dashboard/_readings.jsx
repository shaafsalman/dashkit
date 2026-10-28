/**
 * Internal helpers shared by Instrument, VitalsMonitor and LabTrendCard: how a
 * reading is judged against its limits, how its numbers are formatted, and the
 * trend plot the two cards draw their detail with. Not part of the public API.
 */
import { useState } from "react";
import { MONO, NEG, useMeasuredBox } from "./_shared.jsx";

export const WARN = "#D97706";

/* Critical at or past a critical limit. Otherwise high or low when the reading
 * crosses `limit` on `limitSide`, or leaves the normal band. */
export function statusOf(v, { normal, limit, limitSide = "high", critLow, critHigh } = {}) {
  if (v == null || !Number.isFinite(v)) return "none";
  if ((critLow != null && v <= critLow) || (critHigh != null && v >= critHigh)) return "critical";
  if (limit != null && (limitSide === "low" ? v < limit : v > limit)) return limitSide === "low" ? "low" : "high";
  if (normal && v > normal[1]) return "high";
  if (normal && v < normal[0]) return "low";
  return "normal";
}

export const STATUS_LABEL = { critical: "Critical", high: "High", low: "Low", normal: "In range", none: "No data" };
export const isOff = (s) => s === "high" || s === "low";
export const statusColor = (s, base) => (s === "critical" ? NEG : isOff(s) ? WARN : base);

export const decimalsOf = (vals) => Math.min(3, Math.max(0, ...vals.map((v) => (String(v).split(".")[1] || "").length)));
export const makeFormat = (dec) => (v) => Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/* A range that holds the readings and the reference lines near them, with some
 * air above and below. A critical limit far from the data is left out, so one
 * distant limit can't flatten the whole line. */
export function fitDomain(vals, { normal, limit, critLow, critHigh } = {}, air = 0.12) {
  const pts = [...vals, ...(normal || []), ...(limit != null ? [limit] : [])];
  if (!pts.length) return [0, 1];
  let lo = Math.min(...pts);
  let hi = Math.max(...pts);
  const near = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.25;
  [critLow, critHigh].forEach((c) => {
    if (c != null && c >= lo - near && c <= hi + near) {
      lo = Math.min(lo, c);
      hi = Math.max(hi, c);
    }
  });
  const span = hi - lo || Math.abs(hi) * 0.1 || 1;
  return [lo - span * air, hi + span * air];
}

/* Round tick values (1, 2, 2.5 or 5 times a power of ten) across a range. */
export function niceTicks([lo, hi], count = 4) {
  const raw = (hi - lo) / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export function summarize(vals) {
  if (!vals.length) return null;
  return {
    avg: vals.reduce((s, v) => s + v, 0) / vals.length,
    min: Math.min(...vals),
    max: Math.max(...vals),
  };
}

/* The readings a window shows: the last `count`, or all of them. */
export const windowed = (list, w) => (w && Number.isFinite(w.count) ? list.slice(-w.count) : list);
/* Windows smaller than the record, plus the open-ended one. */
export const usefulWindows = (windows, n) => windows.filter((w) => !Number.isFinite(w.count) || w.count < n);

export function StatusPill({ t, status }) {
  const loud = status === "critical";
  const off = isOff(status);
  return (
    <span
      style={{
        fontSize: 11.5, fontWeight: 700, lineHeight: "20px", padding: "0 8px", borderRadius: 6, whiteSpace: "nowrap",
        color: loud ? "#fff" : off ? WARN : t.text.secondary,
        background: loud ? NEG : off ? `color-mix(in srgb, ${WARN} 12%, transparent)` : t.control.bg,
        border: `1px solid ${loud ? NEG : off ? `color-mix(in srgb, ${WARN} 45%, transparent)` : t.control.border}`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function WindowSwitch({ t, windows, active, onChange }) {
  if (windows.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Readings shown" style={{ display: "inline-flex", flex: "none", gap: 2, padding: 2, borderRadius: 8, border: `1px solid ${t.control.border}`, background: t.control.bg }}>
      {windows.map((w, i) => {
        const on = i === active;
        return (
          <button
            key={w.label}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(i)}
            style={{
              font: "inherit", fontSize: 11.5, fontWeight: on ? 700 : 500, lineHeight: "22px", padding: "0 9px",
              border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
              background: on ? `color-mix(in srgb, ${t.text.primary} 10%, transparent)` : "transparent",
              color: on ? t.text.primary : t.text.muted,
            }}
          >
            {w.label}
          </button>
        );
      })}
    </div>
  );
}

/* Average / lowest / highest / reference, as one ruled row. */
export function StatsRow({ t, stats, fmt, reference }) {
  const cells = [
    ["Average", stats ? fmt(stats.avg) : "—"],
    ["Lowest", stats ? fmt(stats.min) : "—"],
    ["Highest", stats ? fmt(stats.max) : "—"],
    reference,
  ];
  return (
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", flex: "none" }}>
      {cells.map(([k, v], i) => (
        <div key={k} style={{ minWidth: 0, padding: i ? "0 0 0 10px" : 0, borderLeft: i ? `1px solid ${t.grid}` : "none" }}>
          <dt style={{ fontSize: 11, color: t.text.muted, whiteSpace: "nowrap" }}>{k}</dt>
          <dd style={{ ...MONO, margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: t.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* The text for the reference cell: the normal band, else the limit. The band
 * keeps its own precision (12–16, not 12.0–16.0) so it fits a narrow cell. */
export const bandText = (normal) => {
  const f = makeFormat(decimalsOf(normal));
  return `${f(normal[0])}–${f(normal[1])}`;
};
export function referenceCell({ normal, limit, limitSide = "high" }, fmt) {
  if (normal) return ["Normal", bandText(normal)];
  if (limit != null) return ["Limit", `${limitSide === "low" ? "≥" : "≤"} ${fmt(limit)}`];
  return ["Normal", "—"];
}

/* ── TREND PLOT ──────────────────────────────────────────────────────────────
 * Readings over time against their normal band, limit and critical lines.
 * Readings past a line are marked in the line's colour; hovering reads out the
 * nearest one. Sizes itself to its parent.
 * ────────────────────────────────────────────────────────────────────────── */
export function TrendPlot({ t, points, limits = {}, unit = "", fmt, tone }) {
  const [ref, box] = useMeasuredBox({ width: 320, height: 160 });
  const [hover, setHover] = useState(null);
  if (!points.length) return <div ref={ref} style={{ width: "100%", height: "100%" }} />;

  const { width: W, height: H } = box;
  const ink = tone || t.text.primary;
  const vals = points.map((p) => p.value);
  const [d0, d1] = fitDomain(vals, limits);
  const ticks = niceTicks([d0, d1], H < 150 ? 3 : 4).filter((v) => v >= d0 && v <= d1);
  const tickFmt = makeFormat(decimalsOf(ticks));
  const padL = Math.max(28, ...ticks.map((v) => tickFmt(v).length * 6.4 + 10));
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const iw = Math.max(1, W - padL - padR);
  const ih = Math.max(1, H - padT - padB);
  const x = (i) => padL + (points.length < 2 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => padT + (1 - (v - d0) / (d1 - d0)) * ih;
  const inView = (v) => v != null && v >= d0 && v <= d1;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const floor = padT + ih;
  const area = points.length > 1 ? `${line}L${x(points.length - 1).toFixed(1)},${floor}L${x(0).toFixed(1)},${floor}Z` : null;
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 58))));
  const last = points.length - 1;
  const showX = (i) => i === last || (i % every === 0 && last - i >= every / 2);

  const { normal, limit, critLow, critHigh } = limits;
  const band = normal && { top: y(Math.min(normal[1], d1)), bottom: y(Math.max(normal[0], d0)) };
  const refs = [
    critHigh != null && inView(critHigh) && { v: critHigh, color: NEG, text: `Critical ${fmt(critHigh)}`, above: true },
    critLow != null && inView(critLow) && { v: critLow, color: NEG, text: `Critical ${fmt(critLow)}`, above: false },
    limit != null && inView(limit) && { v: limit, color: t.text.muted, text: `Limit ${fmt(limit)}`, above: limits.limitSide !== "low" },
  ].filter(Boolean);

  const onMove = (e) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;
  const hx = hover != null ? x(hover) : 0;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${points.length} readings from ${points[0].label} to ${points[last].label}, latest ${fmt(points[last].value)} ${unit}`.trim()}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} aria-hidden>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={padL + iw} y1={y(v)} y2={y(v)} stroke={t.grid} />
            <text x={padL - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill={t.text.muted} style={MONO}>{tickFmt(v)}</text>
          </g>
        ))}

        {band && band.bottom > band.top && (
          <g>
            <rect x={padL} y={band.top} width={iw} height={band.bottom - band.top} fill={`color-mix(in srgb, ${t.text.primary} 7%, transparent)`} />
            {band.bottom - band.top >= 18 && ih >= 120 && (
              <text x={padL + 6} y={band.top + 12} fontSize={10} fill={t.text.muted} style={MONO}>Normal {bandText(normal)}</text>
            )}
          </g>
        )}

        {refs.map((r) => (
          <g key={r.text}>
            <line x1={padL} x2={padL + iw} y1={y(r.v)} y2={y(r.v)} stroke={r.color} strokeDasharray="4 3" strokeOpacity={0.85} />
            {/* labelled on the left: the newest reading, at the right, is the one most likely to sit on the line */}
            <text x={padL + 4} y={y(r.v) + (r.above ? -4 : 11)} fontSize={10} fontWeight={600} fill={r.color} style={MONO}>{r.text}</text>
          </g>
        ))}

        {area && <path d={area} fill={`color-mix(in srgb, ${ink} 9%, transparent)`} />}
        <path d={line} fill="none" stroke={ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hover != null && <line x1={hx} x2={hx} y1={padT} y2={floor} stroke={t.text.muted} strokeOpacity={0.5} />}

        {points.map((p, i) => {
          const s = statusOf(p.value, limits);
          const c = statusColor(s, ink);
          const big = i === last || i === hover;
          return (
            <g key={i}>
              {big && <circle cx={x(i)} cy={y(p.value)} r={6} fill="none" stroke={c} strokeOpacity={0.35} strokeWidth={3} />}
              <circle cx={x(i)} cy={y(p.value)} r={big || s !== "normal" ? 3.5 : 2.5} fill={c} />
            </g>
          );
        })}

        {points.map((p, i) => showX(i) && (
          <text key={i} x={x(i)} y={H - 6} textAnchor={points.length > 1 && i === 0 ? "start" : i === last && points.length > 1 ? "end" : "middle"} fontSize={10} fill={t.text.muted} style={MONO}>
            {p.label}
          </text>
        ))}
      </svg>

      {hp && (
        <div
          style={{
            position: "absolute", left: hx, top: Math.max(0, y(hp.value) - 34), pointerEvents: "none", whiteSpace: "nowrap",
            transform: hx < padL + 50 ? "translateX(-12px)" : hx > padL + iw - 50 ? "translateX(calc(-100% + 12px))" : "translateX(-50%)",
            padding: "3px 8px", borderRadius: 6, fontSize: 12, lineHeight: "16px",
            background: t.mode === "dark" ? "#1f1f1f" : "#ffffff", border: `1px solid ${t.control.border}`, color: t.text.primary,
          }}
        >
          <span style={{ ...MONO, color: t.text.muted }}>{hp.label}</span>{" "}
          <b style={{ color: statusColor(statusOf(hp.value, limits), t.text.primary) }}>{fmt(hp.value)}</b> <span style={{ color: t.text.muted }}>{unit}</span>
        </div>
      )}
    </div>
  );
}
