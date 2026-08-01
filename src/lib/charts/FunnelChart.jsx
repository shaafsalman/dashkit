import React, { useMemo, memo, useState, useId } from "react";
import { resolveTheme, lighten, darken } from "./theme";
import { ChartCard, ChartTooltip } from "./chrome";
import { useMeasuredBox } from "./useMeasuredBox";

/**
 * FunnelChart — the classic solid tapering funnel: one trapezoid per stage,
 * each stage's bottom edge is the next stage's top edge, labels and values
 * centered inside the band.
 *
 * Two things make it fit where the previous version could not:
 *
 *  1. COMPRESSED WIDTH SCALE. A revenue funnel's last stage is routinely a
 *     few percent of the first (7% here). Mapping ratio linearly to width
 *     makes that stage a sliver too narrow to label, which is what broke the
 *     old one. Width is instead mapped into [MIN_W_RATIO, 1] of the box, so
 *     the silhouette still tapers monotonically but every band stays wide
 *     enough to hold its own text. Exact magnitude is carried by the printed
 *     value and %, which is what a reader actually reads it from — this is
 *     the same trade every funnel implementation makes (ECharts exposes it
 *     as minSize/maxSize).
 *
 *  2. NO FIXED viewBox. A hardcoded portrait viewBox letterboxes or clips
 *     against any container whose ratio differs. The viewBox is the measured
 *     box every render, so a mismatch cannot exist.
 */

const DEFAULT_COLORS = ["#7C3AED", "#2563EB", "#0891B2", "#0D9488"];
const LOSS = "#F43F5E";
const LOSS_TEXT = "#E11D48"; // rose-600 — clears 4.5:1 on a tinted ground
const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const MIN_W_RATIO = 0.52; // narrowest band, as a fraction of the widest — wide
                           // enough that even a long label ("Operating Income")
                           // fits the narrowest stage without truncating
const BAND_GAP = 3; // vertical seam between stages
const TAIL = 0.86; // last band's bottom edge, as a fraction of its top

// Cheap width estimate — SVG text can't be measured before paint, and a
// getComputedTextLength pass would need a second render. Truncating on an
// approximation is better than letting a long label collide with the value.
const fitText = (s, maxPx, px, em = 0.58) => {
  if (!s) return "";
  const per = px * em;
  if (s.length * per <= maxPx) return s;
  const k = Math.max(1, Math.floor(maxPx / per) - 1);
  return s.slice(0, k) + "…";
};

const FunnelChart = memo(
  ({
    title = "Conversion",
    subtitle,
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    stages = [
      { label: "Visits", value: 12000 },
      { label: "Signups", value: 6400 },
      { label: "Trials", value: 3100 },
      { label: "Paid", value: 1280 },
    ],
    formatValue,
    headline,
    width = 420,
    size = "m",
    expandable = false,
    className = "",
    radius,
    compact = false,
    // Both default to today's behavior so existing usages are unaffected.
    showBandValues = true,
    showHeader = true,
  }) => {
    const t = resolveTheme(theme, "light");
    const fmt = formatValue || ((v) => Number(v || 0).toLocaleString("en-US"));
    const uid = useId().replace(/:/g, "");
    const [hover, setHover] = useState(null); // {kind:'stage'|'loss', i}

    // Both measured boxes are created unconditionally — hooks may not be
    // called behind the `detailed` branch.
    const [boxRef, box] = useMeasuredBox({ width: 234, height: 234 });
    const [modalRef, modalBox] = useMeasuredBox({ width: 880, height: 380 });

    const rows = useMemo(() => {
      const list = Array.isArray(stages) ? stages.filter(Boolean) : [];
      const v0 = list[0]?.value || 0;
      return list.map((s, i) => {
        const value = Number(s.value) || 0;
        const prev = i > 0 ? Number(list[i - 1].value) || 0 : null;
        return {
          label: s.label,
          value,
          color: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
          ratio: v0 > 0 ? Math.min(Math.max(value / v0, 0), 1) : 0,
          pct: v0 > 0 ? Math.round((value / v0) * 100) : 0,
          lostAbs: prev != null ? prev - value : 0,
          dropPct: prev != null && prev > 0 ? Math.round((1 - value / prev) * 100) : null,
        };
      });
    }, [stages]);

    // Default headline is the top-of-funnel value — the largest number, and
    // the one every stage below is a share of.
    const resolvedHeadline = useMemo(() => {
      if (headline) return headline;
      if (!rows.length) return undefined;
      return { value: fmt(rows[0].value) };
    }, [headline, rows, fmt]);

    const renderFunnel = (W, H, dense) => {
      const n = rows.length;
      if (!n || W <= 0 || H <= 0) return null;

      // Cap band height so the funnel doesn't balloon absurdly tall, but the
      // cap is generous — bands should use the real available room rather
      // than leaving a dead margin above/below a small, centered stack.
      const rawBandH = (H - (n - 1) * BAND_GAP) / n;
      const bandH = Math.max(Math.min(rawBandH, 108), 14);
      const totalH = n * bandH + (n - 1) * BAND_GAP;
      const offsetY = Math.max((H - totalH) / 2, 0);
      const cx = W / 2;
      // Compressed scale — see MIN_W_RATIO note at the top of the file.
      const bw = (i) => W * (MIN_W_RATIO + (1 - MIN_W_RATIO) * rows[i].ratio);

      const labelPx = Math.min(13, Math.max(9, bandH * 0.15));
      const valuePx = Math.min(24, Math.max(11.5, bandH * 0.3));
      const pctPx = Math.min(15, Math.max(10, bandH * 0.16));

      return (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={title}
          style={{ display: "block" }}
        >
          <defs>
            {rows.map((r, i) => (
              <linearGradient key={i} id={`fn-${uid}-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={lighten(r.color, 0.1)} />
                <stop offset="100%" stopColor={darken(r.color, 0.12)} />
              </linearGradient>
            ))}
          </defs>

          {rows.map((r, i) => {
            const top = offsetY + i * (bandH + BAND_GAP);
            const bot = top + bandH;
            const wTop = bw(i);
            // Bottom edge is the NEXT stage's width, so consecutive
            // trapezoids share an edge and the stack reads as one funnel.
            const wBot = i < n - 1 ? bw(i + 1) : wTop * TAIL;
            const on = hover?.i === i;
            const dim = hover != null && !on;
            const PAD = 10;
            // Corner text sits against the TOP edge, which is the WIDER of
            // the two (values only decrease going down the funnel) — so the
            // label and % always have the most room available to them.
            // Both corner marks get extra breathing room off the slanted
            // edges — flush against the taper read as clipped.
            const LABEL_PAD = PAD * 1.6;
            const PCT_PAD = PAD * 1.6;
            const topLeftX = cx - wTop / 2 + LABEL_PAD;
            const topRightX = cx + wTop / 2 - PCT_PAD;
            const topTextY = top + labelPx + PAD * 0.6;
            // Reserve room for the "%" on the right so the label can't run
            // into it; both corners share the top edge's width.
            const pctTxt = `${r.pct}%`;
            const pctW = pctTxt.length * pctPx * 0.62 + PCT_PAD;
            const labelBudget = wTop - LABEL_PAD - PCT_PAD - pctW;

            return (
              <g
                key={`stage-${i}`}
                opacity={dim ? 0.5 : 1}
                onMouseEnter={() => setHover({ kind: "stage", i })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer", transition: "opacity .15s ease" }}
              >
                <path
                  d={`M ${cx - wTop / 2} ${top} L ${cx + wTop / 2} ${top} L ${cx + wBot / 2} ${bot} L ${cx - wBot / 2} ${bot} Z`}
                  fill={r.value < 0 ? LOSS : `url(#fn-${uid}-${i})`}
                />
                {/* label — top-left corner */}
                <text x={topLeftX} y={topTextY} textAnchor="start" fontFamily={SANS} fontSize={labelPx} fontWeight={600} letterSpacing="-0.01em" fill="rgba(255,255,255,0.92)" pointerEvents="none">
                  {fitText(r.label, labelBudget, labelPx)}
                </text>
                {/* % of top — top-right corner */}
                {!dense && (
                  <text x={topRightX} y={topTextY} textAnchor="end" fontFamily={MONO} fontSize={pctPx} fontWeight={700} fill="rgba(255,255,255,0.78)" pointerEvents="none">
                    {pctTxt}
                  </text>
                )}
                {/* value — bottom-center. Suppressed when the host already
                    shows the number elsewhere (e.g. the ranked widget's own
                    stats), where repeating it inside the band is just noise. */}
                {showBandValues && (
                  <text x={cx} y={bot - PAD * 1.1} textAnchor="middle" fontFamily={MONO} fontSize={valuePx} fontWeight={800} letterSpacing="-0.02em" fill="#fff" pointerEvents="none">
                    {fmt(r.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      );
    };

    const tip = useMemo(() => {
      if (!hover || !rows.length) return null;
      const r = rows[hover.i];
      if (!r) return null;
      return {
        title: r.label,
        rows: [
          { label: "Value", value: fmt(r.value), color: r.color },
          { label: "Retained", value: `${r.pct}% of top` },
          ...(r.dropPct != null && r.dropPct > 0
            ? [{ label: "Lost vs prior", value: `−${r.dropPct}% · −${fmt(r.lostAbs)}` }]
            : []),
        ],
      };
    }, [hover, rows, fmt]);

    const empty = !rows.length;

    const renderBody = (detailed) => {
      if (empty) {
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: t.text.muted, fontSize: 13 }}>
            No data
          </div>
        );
      }
      if (detailed) {
        return (
          <div>
            <div ref={modalRef} style={{ position: "relative", height: "min(420px, 38vh)" }}>
              {renderFunnel(modalBox.width, modalBox.height, false)}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 20, border: `1px solid ${t.control.border}` }}>
              <thead>
                <tr style={{ textAlign: "left", color: t.text.secondary, background: t.mode === "light" ? "#f1f5f9" : "rgba(255,255,255,0.05)" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Stage</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Value</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>% of top</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Lost vs prior</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.label} style={{ borderTop: i === 0 ? "none" : `1px solid ${t.control.border}`, color: t.text.primary }}>
                    <td style={{ padding: "9px 14px", fontWeight: 600 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 9, height: 9, background: r.color }} />{r.label}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: MONO, fontWeight: 600 }}>{fmt(r.value)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: MONO }}>{r.pct}%</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: MONO, color: r.dropPct ? LOSS_TEXT : t.text.muted }}>
                      {r.dropPct != null ? `−${r.dropPct}% · −${fmt(r.lostAbs)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      return (
        <div ref={boxRef} style={{ position: "relative", height: "100%", minHeight: 0, paddingTop: 8 }}>
          {renderFunnel(box.width, Math.max(box.height - 8, 0), box.width < 190)}
          <ChartTooltip
            theme={t}
            visible={!!tip}
            left="50%"
            top="46%"
            title={tip?.title || ""}
            rows={tip?.rows || []}
          />
        </div>
      );
    };

    return (
      <ChartCard
        theme={t}
        title={showHeader ? title : null}
        subtitle={showHeader ? subtitle : null}
        icon={showHeader ? icon : null}
        iconColor={iconColor}
        controls={controls ?? []}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
        radius={radius}
        compact={compact}
        floatingHeader
        headline={showHeader ? resolvedHeadline : null}
      >
        {({ detailed }) => renderBody(detailed)}
      </ChartCard>
    );
  }
);

FunnelChart.displayName = "FunnelChart";
export default FunnelChart;
