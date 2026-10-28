import { useMemo, useState } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { MONO, NEG, Empty, useMeasuredBox } from "./_shared.jsx";
import { Instrument } from "./Instrument";
import {
  WARN, STATUS_LABEL, StatusPill, StatsRow, TrendPlot, WindowSwitch,
  decimalsOf, isOff, makeFormat, referenceCell, statusColor, statusOf, summarize, usefulWindows, windowed,
} from "./_readings.jsx";

/* ── VITALS MONITOR ──────────────────────────────────────────────────────────
 * A set of signals read side by side, each judged against its own normal band
 * or limit. The left side is a grid of cells (latest value, a small instrument,
 * a dot when it's out of range); the right side is the selected signal in
 * full: its trend against the reference lines, the change since the reading
 * before, and its average, lowest and highest over the window shown. Opens on
 * the first signal that needs attention. Below ~760px the detail drops under
 * the grid.
 * ────────────────────────────────────────────────────────────────────────── */

const DEFAULT_WINDOWS = [
  { label: "3 days", count: 3 },
  { label: "5 days", count: 5 },
  { label: "All", count: Infinity },
];

export function VitalsMonitor({
  theme,
  title = "Vitals",
  subtitle,
  icon,
  iconColor,
  signals = [],
  windows = DEFAULT_WINDOWS,
  selectedId,
  onSelect,
}) {
  const t = resolveTheme(theme, "light");
  const [ownPick, setOwnPick] = useState(null);

  const rows = useMemo(
    () =>
      signals.map((s) => {
        const readings = (s.readings || []).filter((r) => Number.isFinite(r.value));
        const vals = readings.map((r) => r.value);
        const limits = { normal: s.normal, limit: s.limit, limitSide: s.limitSide, critLow: s.critLow, critHigh: s.critHigh };
        const last = vals[vals.length - 1];
        return { ...s, readings, vals, limits, last, status: statusOf(last, limits), fmt: makeFormat(s.decimals ?? decimalsOf(vals)) };
      }),
    [signals]
  );

  if (!rows.length) {
    return (
      <ChartCard theme={t} size="fill" width="100%" expandable controls={[]} title={title} subtitle={subtitle} icon={icon} iconColor={iconColor}>
        {() => <Empty t={t} label="No signals recorded" />}
      </ChartCard>
    );
  }

  const firstFlag = rows.find((r) => r.status === "critical") || rows.find((r) => isOff(r.status));
  const pickedId = selectedId ?? ownPick ?? (firstFlag || rows[0]).id;
  const picked = rows.find((r) => r.id === pickedId) || rows[0];
  const pick = (id) => {
    setOwnPick(id);
    onSelect?.(id);
  };

  const critical = rows.filter((r) => r.status === "critical").length;
  const off = rows.filter((r) => isOff(r.status)).length;
  const summary = [critical && `${critical} critical`, off && `${off} out of range`].filter(Boolean).join(", ") || "All in range";
  const summaryColor = critical ? NEG : off ? WARN : t.text.secondary;

  return (
    <ChartCard
      theme={t}
      size="fill"
      width="100%"
      expandable
      controls={[]}
      title={title}
      subtitle={subtitle}
      icon={icon}
      iconColor={iconColor}
      headerRight={
        <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: summaryColor, whiteSpace: "nowrap" }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: critical ? NEG : off ? WARN : t.accent }} />
          {summary}
        </span>
      }
    >
      {() => <MonitorBody t={t} theme={theme} rows={rows} picked={picked} onPick={pick} windows={windows} />}
    </ChartCard>
  );
}

/* Its own component so the inline card and ChartCard's expanded view each
 * measure their own width. */
function MonitorBody({ t, theme, rows, picked, onPick, windows }) {
  const [ref, box] = useMeasuredBox({ width: 900, height: 420 });
  const [hoverId, setHoverId] = useState(null);
  const wide = box.width >= 760;
  return (
    // ChartCard turns its only child into a clipped column; the split lives one level down.
    <div>
      <div
        ref={ref}
        style={{
          flex: 1, minHeight: 0, gap: 16,
          ...(wide
            ? { display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)", gridTemplateRows: "minmax(0, 1fr)", overflow: "hidden" }
            : { display: "flex", flexDirection: "column", overflow: "auto" }),
        }}
      >
        <div role="group" aria-label="Signals" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 8, alignContent: "start", minHeight: 0, overflow: wide ? "auto" : "visible", flex: "none" }}>
          {rows.map((r) => {
            const on = r.id === picked.id;
            const lit = on || r.id === hoverId;
            const flagged = r.status === "critical" || isOff(r.status);
            const tone = statusColor(r.status, t.text.primary);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick(r.id)}
                onMouseEnter={() => setHoverId(r.id)}
                onMouseLeave={() => setHoverId(null)}
                aria-pressed={on}
                aria-label={`${r.label} ${r.last != null ? r.fmt(r.last) : "no reading"} ${r.unit || ""}, ${STATUS_LABEL[r.status].toLowerCase()}`}
                style={{
                  font: "inherit", textAlign: "left", cursor: "pointer", minWidth: 0,
                  display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px",
                  borderRadius: 10, border: `1px solid ${on ? t.text.secondary : t.control.border}`,
                  background: on ? `color-mix(in srgb, ${t.text.primary} 6%, transparent)` : lit ? t.control.hover : t.control.bg, color: t.text.primary,
                  transition: "background .15s, border-color .15s",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.text.secondary }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                  {flagged && <span aria-hidden style={{ marginLeft: "auto", width: 7, height: 7, flex: "none", borderRadius: "50%", background: tone }} />}
                </span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: tone }}>{r.last != null ? r.fmt(r.last) : "—"}</span>
                  <span style={{ ...MONO, fontSize: 11, color: t.text.muted }}>{r.unit}</span>
                </span>
                <span style={{ display: "block", height: 26 }}>
                  <Instrument theme={theme} form={r.form || "line"} values={r.vals} value={r.last} domain={r.domain} steps={r.steps} {...r.limits} />
                </span>
              </button>
            );
          })}
        </div>

        <SignalDetail key={picked.id} t={t} row={picked} windows={windows} wide={wide} />
      </div>
    </div>
  );
}

function SignalDetail({ t, row, windows, wide }) {
  const options = usefulWindows(windows, row.readings.length);
  const [win, setWin] = useState(options.length - 1);
  const shown = windowed(row.readings, options[win]);
  const tone = statusColor(row.status, t.text.primary);
  const prev = row.readings.length > 1 ? row.readings[row.readings.length - 2] : null;
  const delta = prev ? row.last - prev.value : null;

  return (
    <section
      aria-label={`${row.label} in detail`}
      style={{
        minWidth: 0, minHeight: wide ? 0 : 280, display: "flex", flexDirection: "column", gap: 10,
        ...(wide ? { paddingLeft: 16, borderLeft: `1px solid ${t.grid}` } : { paddingTop: 14, borderTop: `1px solid ${t.grid}` }),
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 650, color: t.text.primary }}>{row.label}</span>
            <StatusPill t={t} status={row.status} />
          </div>
          {row.note && <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: "16px", color: t.text.muted }}>{row.note}</p>}
        </div>
        <WindowSwitch t={t} windows={options} active={win} onChange={setWin} />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 10px" }}>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: tone }}>{row.last != null ? row.fmt(row.last) : "—"}</span>
        {row.unit && <span style={{ ...MONO, fontSize: 12, color: t.text.muted }}>{row.unit}</span>}
        {delta != null && (
          <span style={{ ...MONO, fontSize: 12, color: t.text.secondary }}>
            {delta > 0 ? "+" : delta < 0 ? "−" : "±"}{row.fmt(Math.abs(delta))} since {prev.label}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 120 }}>
        <TrendPlot t={t} points={shown} limits={row.limits} unit={row.unit} fmt={row.fmt} />
      </div>

      <StatsRow t={t} stats={summarize(shown.map((p) => p.value))} fmt={row.fmt} reference={referenceCell(row.limits, row.fmt)} />
    </section>
  );
}

export default VitalsMonitor;
