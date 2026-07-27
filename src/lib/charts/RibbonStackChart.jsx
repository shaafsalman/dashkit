import React, { useMemo, useState, memo } from "react";
import { resolveTheme, lighten } from "./theme";
import { ChartCard, Legend, ChangePill, ChartTooltip } from "./chrome";

/**
 * RibbonStackChart — generalized stacked-segment chart with connecting ribbons.
 * One engine renders both:
 *   • "Sales Overview"      (dark, top headline, value labels, legend)
 *   • "Balance Statistics"  (light, y-axis + gridlines, bottom-left headline)
 *
 * Theming + header controls come from the shared chrome/theme layer, so the
 * card frame, filter/sort/more/dropdown controls and accent are all uniform.
 *
 * Props
 *   title, theme, controls, onControl            chrome (see ChartCard)
 *   size : "s"|"m"|"l"|"xl"                       card body height (default "l")
 *   series : [{ key, label, color }]             bottom -> top
 *   data   : [{ label, total?, values, bar? }]   bar:false => label only (ribbon passes through)
 *   total, changePct, changeValue                headline figures
 *   headlinePosition : "top" | "bottom"          default "top"
 *   headlineLabel    : string                    e.g. "Total Balance"
 *   formatValue / currency / decimals            value formatting
 *   showAxis, yTicks, yMax, axisFormat           left $-axis + dashed gridlines
 *   showLegend, showBarLabels                    toggles (sensible defaults)
 *   width
 *
 * Interactions
 *   • hover a bar → tooltip with the period total + per-series breakdown
 *   • legend swatch toggles a series off (dims + strikethrough, drops the segment)
 *   • detailed mode (expand modal) → value labels on every segment
 */

const PAD_X_DEFAULT = 70;
const COL_GAP = 200;
const BAR_W = 112;
const TOP_Y_DEFAULT = 56;
const BASELINE = 300;
const LABEL_Y = 332;
const VBH = 352;
const SEG_GAP = 5;

const makeMoney =
  (currency = "$", decimals = 2) =>
  (v) =>
    `${currency}${Number(v || 0).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;

export const DEFAULT_SERIES = [
  { key: "china", label: "China", color: "#3a2a8c" },
  { key: "ue", label: "UE", color: "#6d5ae6" },
  { key: "usa", label: "USA", color: "#2f6bf5" },
  { key: "canada", label: "Canada", color: "#39a0f4" },
  { key: "other", label: "Other", color: "#56e0a6" },
];

const split = (t) => ({ china: t * 0.34, ue: t * 0.19, usa: t * 0.12, canada: t * 0.13, other: t * 0.22 });
const DEFAULT_DATA = [
  { label: "Oct", total: 2988.2, values: split(2988.2) },
  { label: "Nov", total: 1765.09, values: split(1765.09) },
  { label: "Dec", total: 4005.65, values: split(4005.65) },
];

const RibbonStackChart = memo((props) => {
  const {
    title = "Sales Overview",
    subtitle,
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    size = "l",
    series = DEFAULT_SERIES,
    data = DEFAULT_DATA,
    total = 9257.51,
    changePct = 15.8,
    changeValue = 143.5,
    headlinePosition = "top",
    headlineLabel,
    floatingHeader = false,
    formatValue,
    currency = "$",
    decimals = 2,
    showAxis = false,
    yTicks,
    yMax: yMaxProp,
    axisFormat,
    showLegend = true,
    showBarLabels,
    width = 560,
    expandable = false,
    className = "",
    topPad, // override TOP_Y — floatingHeader callers already get title/legend
            // space from the card header in normal flow, so they need much
            // less of this internal SVG headroom than the default top-of-card
            // headlineBlock layout did.
    padX, // override PAD_X — the default (70) assumes many periods; with
          // only 2 (YoY comparisons) it reads as a big dead margin on both sides.
  } = props;

  const t = resolveTheme(theme, "dark");
  const TOP_Y = topPad ?? TOP_Y_DEFAULT;
  const PAD_X = padX ?? PAD_X_DEFAULT;
  const fmt = useMemo(() => formatValue || makeMoney(currency, decimals), [formatValue, currency, decimals]);
  const axisFmt = axisFormat || fmt;
  const barLabels = showBarLabels ?? !showAxis;
  const AXIS_W = showAxis ? 60 : 0;

  // legend toggle (own state) + bar hover state
  const [hidden, setHidden] = useState(() => ({}));
  const [hover, setHover] = useState(null); // period index
  const toggle = (key) => setHidden((h) => ({ ...h, [key]: !h[key] }));

  const activeSeries = useMemo(() => series.filter((s) => !hidden[s.key]), [series, hidden]);

  const { periods, ribbons, vbw, grid, barW } = useMemo(() => {
    const n = data.length;
    const gap = n > 1 ? Math.max(60, Math.min(COL_GAP, 900 / (n - 1))) : COL_GAP;
    // Bar width must stay narrower than the gap so adjacent bars never overlap
    const barW = Math.min(BAR_W, Math.floor(gap * 0.58));
    const vbw = AXIS_W + PAD_X * 2 + Math.max(n - 1, 0) * gap;

    const totals = data.map(
      (d) => activeSeries.reduce((s, sr) => s + (d.values?.[sr.key] || 0), 0)
    );
    const maxTotal = Math.max(...totals, 1);
    const ymax = showAxis ? yMaxProp || (yTicks ? Math.max(...yTicks) : maxTotal) : maxTotal;
    const usable = BASELINE - TOP_Y;
    const scale = showAxis ? usable / ymax : (usable - (activeSeries.length - 1) * SEG_GAP) / ymax;
    const y = (v) => BASELINE - (v / ymax) * usable;

    const periods = data.map((d, i) => {
      const cx = n === 1 ? AXIS_W + vbw / 2 : AXIS_W + PAD_X + i * gap;
      const hasBar = d.bar !== false && totals[i] > 0;
      let yBottom = BASELINE;
      const segs = activeSeries.map((sr) => {
        const value = d.values?.[sr.key] || 0;
        const raw = value * scale;
        let topY, botY, drawY, drawH;
        if (showAxis) {
          topY = yBottom - raw;
          botY = yBottom;
          drawY = topY + SEG_GAP / 2;
          drawH = Math.max(raw - SEG_GAP, value > 0 ? 3 : 0);
          yBottom = topY;
        } else {
          const h = Math.max(raw, value > 0 ? 4 : 0);
          topY = yBottom - h;
          botY = yBottom;
          drawY = topY;
          drawH = h;
          yBottom = topY - SEG_GAP;
        }
        return { ...sr, value, topY, botY, drawY, drawH };
      });
      return { label: d.label, cx, segs, hasBar, total: totals[i], topY: yBottom, i };
    });

    const barPeriods = periods.filter((p) => p.hasBar);
    const ribbons = [];
    for (let i = 0; i < barPeriods.length - 1; i++) {
      const a = barPeriods[i];
      const b = barPeriods[i + 1];
      const xL = a.cx + barW / 2;
      const xR = b.cx - barW / 2;
      const xm = (xL + xR) / 2;
      a.segs.forEach((sa, idx) => {
        const sb = b.segs[idx];
        if (!sb || (sa.value <= 0 && sb.value <= 0)) return;
        const d = `M ${xL} ${sa.topY} C ${xm} ${sa.topY} ${xm} ${sb.topY} ${xR} ${sb.topY} L ${xR} ${sb.botY} C ${xm} ${sb.botY} ${xm} ${sa.botY} ${xL} ${sa.botY} Z`;
        ribbons.push({ d, seriesKey: sa.key, key: `${i}-${sa.key}` });
      });
    }

    const grid =
      showAxis && yTicks
        ? yTicks.map((v) => ({ v, y: y(v), label: axisFmt(v) }))
        : [];

    return { periods, ribbons, vbw, grid, barW };
  }, [data, activeSeries, showAxis, yTicks, yMaxProp, AXIS_W, axisFmt, PAD_X, TOP_Y]);

  const accentForLight = t.mode === "light";
  const headlineBlock = (
    <div style={{
      marginBottom: headlinePosition === "top" || headlinePosition === "top-right" ? 8 : 0,
      marginTop: headlinePosition === "bottom" ? 8 : 0,
      ...(headlinePosition === "top-right" ? { display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right" } : {}),
    }}>
      {headlineLabel && (
        <div style={{ fontSize: 13, fontWeight: 500, color: t.text.muted }}>{headlineLabel}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: t.text.primary }}>
          {fmt(total)}
        </span>
        {changePct != null &&
          (accentForLight ? (
            <span style={{ background: t.accent, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>
              {Math.abs(changePct)}%
            </span>
          ) : (
            <ChangePill theme={t} value={changePct} />
          ))}
      </div>
    </div>
  );

  const legendItems = series.map((s) => ({ ...s, active: !hidden[s.key] }));
  const tip = hover != null ? periods.find((p) => p.i === hover && p.hasBar) : null;

  // functional default controls: filter (toggle series) + reset
  const resolvedControls = controls ?? [
    { type: "filter", items: legendItems.map((s) => ({ key: s.key, label: s.label, color: s.color, active: s.active })), onToggle: toggle },
  ];

  const renderChart = ({ detailed }) => (
    <div style={{ position: "relative" }}>
      {headlinePosition === "top-right" && (
        <div style={{ position: "absolute", top: 0, right: 0, zIndex: 2, textAlign: "right", pointerEvents: "none" }}>
          {headlineLabel && (
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text.muted }}>{headlineLabel}</div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: t.text.primary }}>
              {fmt(total)}
            </span>
            {changePct != null && (t.mode === "light"
              ? <span style={{ background: t.accent, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{Math.abs(changePct)}%</span>
              : <ChangePill theme={t} value={changePct} />
            )}
          </div>
        </div>
      )}
      <svg viewBox={`0 0 ${vbw} ${VBH}`} width="100%" style={{ overflow: "visible" }} role="img" aria-label={`${title} chart`}>
        <defs>
          {series.map((sr) => (
            <linearGradient key={`bg-${sr.key}`} id={`bar-${sr.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lighten(sr.color, 0.22)} />
              <stop offset="100%" stopColor={sr.color} />
            </linearGradient>
          ))}
          {series.map((sr) => (
            <linearGradient key={`rg-${sr.key}`} id={`rib-${sr.key}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={sr.color} stopOpacity={t.mode === "light" ? 0.3 : 0.22} />
              <stop offset="50%" stopColor={sr.color} stopOpacity={t.mode === "light" ? 0.45 : 0.32} />
              <stop offset="100%" stopColor={sr.color} stopOpacity={t.mode === "light" ? 0.3 : 0.22} />
            </linearGradient>
          ))}
        </defs>

        {grid.map((g) => (
          <g key={`grid-${g.v}`}>
            <line x1={AXIS_W + 6} y1={g.y} x2={vbw} y2={g.y} stroke={t.grid} strokeDasharray="4 5" />
            <text x={AXIS_W - 6} y={g.y + 4} textAnchor="end" fontSize="13" fontWeight="600" fill={t.text.muted}>
              {g.label}
            </text>
          </g>
        ))}

        {ribbons.map((r) => (
          <path key={r.key} d={r.d} fill={`url(#rib-${r.seriesKey})`} opacity={hover == null ? 1 : 0.5} />
        ))}

        {periods.map((p) => {
          const dim = hover != null && hover !== p.i;
          return (
            <g
              key={`p-${p.label}`}
              opacity={dim ? 0.55 : 1}
              onMouseEnter={() => p.hasBar && setHover(p.i)}
              onMouseMove={() => p.hasBar && setHover(p.i)}
              onMouseLeave={() => setHover((h) => (h === p.i ? null : h))}
              style={{ cursor: p.hasBar ? "pointer" : "default" }}
            >
              {/* transparent hit area spanning the full bar column */}
              {p.hasBar && (
                <rect x={p.cx - barW / 2 - 8} y={TOP_Y - 24} width={barW + 16} height={BASELINE - TOP_Y + 24} fill="transparent" />
              )}
              {p.hasBar &&
                p.segs.map(
                  (s) =>
                    s.value > 0 && (
                      <g key={s.key}>
                        <rect
                          x={p.cx - barW / 2}
                          y={s.drawY}
                          width={barW}
                          height={s.drawH}
                          rx={Math.min(7, s.drawH / 2)}
                          fill={`url(#bar-${s.key})`}
                        />
                        {detailed && s.drawH >= 14 && (
                          <text
                            x={p.cx}
                            y={s.drawY + s.drawH / 2 + 5}
                            textAnchor="middle"
                            fontSize="13"
                            fontWeight="700"
                            fill={t.mode === "light" ? "#fff" : "#0f172a"}
                            style={{ paintOrder: "stroke", pointerEvents: "none" }}
                          >
                            {fmt(s.value)}
                          </text>
                        )}
                      </g>
                    )
                )}
              {barLabels && p.hasBar && (
                <text x={p.cx} y={p.topY - 14} textAnchor="middle" fontSize="16" fontWeight="700" fill={t.text.primary}>
                  {fmt(p.total)}
                </text>
              )}
              <text x={p.cx} y={LABEL_Y} textAnchor="middle" fontSize="14" fontWeight="500" fill={t.text.muted}>
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      <ChartTooltip
        theme={t}
        visible={!!tip}
        left={tip ? `${(tip.cx / vbw) * 100}%` : "50%"}
        top={tip ? `${(tip.topY / VBH) * 100}%` : "40%"}
        title={tip ? `${tip.label} · ${fmt(tip.total)}` : ""}
        rows={
          tip
            ? [...tip.segs]
                .reverse()
                .filter((s) => s.value > 0)
                .map((s) => ({ label: s.label, value: fmt(s.value), color: s.color }))
            : []
        }
      />

      {detailed && (
        <table style={{ width: "100%", marginTop: 18, borderCollapse: "collapse", fontSize: 13, color: t.text.secondary }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", color: t.text.muted, fontWeight: 600, borderBottom: `1px solid ${t.control.border}` }}>Series</th>
              {periods.map((p) => (
                <th key={p.label} style={{ textAlign: "right", padding: "6px 8px", color: t.text.muted, fontWeight: 600, borderBottom: `1px solid ${t.control.border}` }}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...activeSeries].reverse().map((sr) => (
              <tr key={sr.key}>
                <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: sr.color }} />
                    {sr.label}
                  </span>
                </td>
                {periods.map((p) => (
                  <td key={p.label} style={{ textAlign: "right", padding: "6px 8px", fontWeight: 600, color: t.text.primary }}>
                    {fmt(p.segs.find((s) => s.key === sr.key)?.value || 0)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={{ padding: "6px 8px", fontWeight: 700, color: t.text.primary, borderTop: `1px solid ${t.control.border}` }}>Total</td>
              {periods.map((p) => (
                <td key={p.label} style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700, color: t.text.primary, borderTop: `1px solid ${t.control.border}` }}>{fmt(p.total)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <ChartCard
      theme={t}
      title={title}
      icon={icon}
      iconColor={iconColor}
      subtitle={subtitle}
      controls={resolvedControls}
      onControl={onControl}
      size={size}
      width={width}
      expandable={expandable}
      className={className}
      floatingHeader={floatingHeader}
      headline={
        floatingHeader
          ? {
              label: headlineLabel,
              value: fmt(total),
              change: changePct,
              legend: showLegend ? <Legend theme={t} items={legendItems} swatch="square" onToggle={toggle} compact /> : null,
            }
          : undefined
      }
      footer={
        !floatingHeader && showLegend ? (
          <Legend theme={t} items={legendItems} swatch="square" onToggle={toggle} />
        ) : null
      }
    >
      {({ detailed }) => (
        <>
          {!floatingHeader && headlinePosition === "top" && headlineBlock}
          {renderChart({ detailed })}
          {!floatingHeader && headlinePosition === "bottom" && headlineBlock}
        </>
      )}
    </ChartCard>
  );
});

RibbonStackChart.displayName = "RibbonStackChart";

export default RibbonStackChart;
