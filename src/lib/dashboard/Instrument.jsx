import { resolveTheme } from "../charts";
import { MONO, useMeasuredBox } from "./_shared.jsx";
import { fitDomain, isOff, statusColor, statusOf } from "./_readings.jsx";

/* ── INSTRUMENT ──────────────────────────────────────────────────────────────
 * A small reading with no card around it, for a cell, a table row or a card
 * header. Four forms: `line` and `bars` draw a run of values, `ring` and
 * `segments` draw one value on a scale. Anything past the normal band or a
 * limit turns amber and anything at a critical limit turns red, so a row of
 * instruments can be scanned for the one that needs attention. Sizes itself to
 * its parent.
 * ────────────────────────────────────────────────────────────────────────── */

const clamp01 = (f) => Math.max(0, Math.min(1, f));

/* Bars start below the lowest value rather than at zero, so small changes in a
 * large number (a weight, a blood pressure) still show. Counts keep zero. */
function barDomain(vals, limit) {
  const pts = limit != null ? [...vals, limit] : vals;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || Math.abs(hi) * 0.1 || 1;
  const floor = lo - span * 0.6;
  return [lo >= 0 && floor < 0 ? 0 : floor, hi + span * 0.08];
}

export function Instrument({
  theme,
  form = "line",
  values = [],
  value,
  domain,
  normal,
  limit,
  limitSide = "high",
  critLow,
  critHigh,
  steps = 20,
  marks = [],
  text,
  caption,
  color,
  label,
  style,
}) {
  const t = resolveTheme(theme, "light");
  const [ref, box] = useMeasuredBox({ width: 120, height: 32 });
  const { width: W, height: H } = box;
  const limits = { normal, limit, limitSide, critLow, critHigh };
  const series = form === "line" || form === "bars";
  const vals = series ? values.filter(Number.isFinite) : [];
  const current = series ? vals[vals.length - 1] : value;
  const base = color || (series ? t.text.primary : t.accent);
  const tone = statusColor(statusOf(current, limits), base);
  const dash = { stroke: t.text.muted, strokeDasharray: "3 3", strokeOpacity: 0.8 };

  let body = null;

  if (form === "line" && vals.length) {
    const [d0, d1] = domain || fitDomain(vals, limits, 0.14);
    const pad = 4;
    const x = (i) => pad + (vals.length < 2 ? (W - 2 * pad) / 2 : (i / (vals.length - 1)) * (W - 2 * pad));
    const y = (v) => pad + (1 - (v - d0) / (d1 - d0 || 1)) * (H - 2 * pad);
    const top = normal && Math.max(0, y(normal[1]));
    const bottom = normal && Math.min(H, y(normal[0]));
    body = (
      <>
        {normal && bottom > top && <rect x={0} y={top} width={W} height={bottom - top} rx={2} fill={`color-mix(in srgb, ${t.text.primary} 7%, transparent)`} />}
        {limit != null && <line x1={0} x2={W} y1={y(limit)} y2={y(limit)} {...dash} />}
        <path d={vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")} fill="none" stroke={base} strokeOpacity={0.9} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        {vals.map((v, i) => {
          const s = statusOf(v, limits);
          if (i === vals.length - 1) return <circle key={i} cx={x(i)} cy={y(v)} r={3.25} fill={tone} />;
          return s !== "normal" ? <circle key={i} cx={x(i)} cy={y(v)} r={2.25} fill={statusColor(s, base)} /> : null;
        })}
      </>
    );
  }

  if (form === "bars" && vals.length) {
    const [d0, d1] = domain || barDomain(vals, limit);
    const n = vals.length;
    const gap = Math.max(1, Math.min(3, (W / n) * 0.22));
    const bw = Math.max(1, (W - gap * (n - 1)) / n);
    const y = (v) => (1 - (v - d0) / (d1 - d0 || 1)) * H;
    body = (
      <>
        {vals.map((v, i) => {
          const s = statusOf(v, limits);
          const h = Math.max(2, H - y(v));
          const latest = i === n - 1;
          return (
            <rect
              key={i}
              x={i * (bw + gap)}
              y={H - h}
              width={bw}
              height={h}
              rx={Math.min(2, bw / 3)}
              fill={s === "normal" ? base : statusColor(s, base)}
              fillOpacity={s !== "normal" || latest ? 1 : 0.3}
            />
          );
        })}
        {limit != null && <line x1={0} x2={W} y1={y(limit)} y2={y(limit)} {...dash} />}
      </>
    );
  }

  if (form === "ring" && Number.isFinite(value)) {
    const [d0, d1] = domain || [0, 100];
    const size = Math.min(W, H);
    const sw = Math.max(3, size * 0.085);
    const r = size / 2 - sw / 2 - 0.5;
    const cx = W / 2;
    const cy = H / 2;
    const f = clamp01((value - d0) / (d1 - d0 || 1));
    const C = 2 * Math.PI * r;
    body = (
      <>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.track} strokeWidth={sw} />
        {f > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={tone} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${f * C} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
        )}
        <text x={cx} y={caption ? cy - size * 0.05 : cy} dy="0.35em" textAnchor="middle" fontSize={size * 0.22} fontWeight={700} fill={t.text.primary} style={{ letterSpacing: "-0.02em" }}>
          {text ?? `${Math.round(f * 100)}%`}
        </text>
        {caption && (
          <text x={cx} y={cy + size * 0.17} dy="0.35em" textAnchor="middle" fontSize={Math.max(9, size * 0.11)} fill={t.text.muted}>
            {caption}
          </text>
        )}
      </>
    );
  }

  if (form === "segments" && Number.isFinite(value)) {
    const [d0, d1] = domain || [0, 100];
    const span = d1 - d0 || 1;
    const labelH = marks.length ? 15 : 0;
    const sh = Math.max(4, H - labelH);
    const gap = Math.max(1.5, Math.min(3, (W / steps) * 0.25));
    const sw = Math.max(1, (W - gap * (steps - 1)) / steps);
    const filled = Math.round(clamp01((value - d0) / span) * steps);
    // segment i reaches d0 + (i+1)/steps of the scale; that value decides its colour
    body = (
      <>
        {Array.from({ length: steps }, (_, i) => {
          const s = statusOf(d0 + ((i + 1) / steps) * span, limits);
          const on = i < filled;
          const fill = on ? (s === "normal" ? base : statusColor(s, base)) : s === "normal" ? t.track : `color-mix(in srgb, ${statusColor(s, base)} 16%, transparent)`;
          return <rect key={i} x={i * (sw + gap)} y={0} width={sw} height={sh} rx={Math.min(1.5, sw / 3)} fill={fill} fillOpacity={on && i !== filled - 1 ? 0.8 : 1} />;
        })}
        {marks.map(([mv, text]) => {
          const mx = Math.max(0, Math.min(W, ((mv - d0) / span) * W - W / steps / 2));
          const s = statusOf(mv, limits);
          return (
            <text key={mv} x={mx} y={H - 2} textAnchor={mx < 14 ? "start" : mx > W - 14 ? "end" : "middle"} fontSize={10} fill={s === "critical" || isOff(s) ? statusColor(s, base) : t.text.muted} style={MONO}>
              {text}
            </text>
          );
        })}
      </>
    );
  }

  const fallback = series ? `${vals.length} readings, latest ${current ?? "none"}` : `${value} on a scale of ${domain ? domain.join(" to ") : "0 to 100"}`;

  return (
    <div ref={ref} role="img" aria-label={label || fallback} style={{ position: "relative", width: "100%", height: "100%", minHeight: 16, ...style }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, display: "block", overflow: "visible" }} aria-hidden>
        {body}
      </svg>
    </div>
  );
}

export default Instrument;
