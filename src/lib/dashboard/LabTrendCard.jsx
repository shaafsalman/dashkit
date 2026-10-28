import { useState } from "react";
import { ChartCard, resolveTheme } from "../charts";
import { MONO, Empty } from "./_shared.jsx";
import {
  StatusPill, StatsRow, TrendPlot, WindowSwitch,
  decimalsOf, makeFormat, referenceCell, statusColor, statusOf, summarize, usefulWindows, windowed,
} from "./_readings.jsx";

/* ── LAB TREND CARD ──────────────────────────────────────────────────────────
 * One test's results over time: the latest value with its status and the
 * change since the result before, the trend against the normal band and the
 * critical lines, and the average, lowest and highest over the results shown.
 * Where ReferenceRangeBar answers "where does this result sit", this answers
 * "which way has it been going".
 * ────────────────────────────────────────────────────────────────────────── */

const DEFAULT_WINDOWS = [
  { label: "Last 3", count: 3 },
  { label: "Last 5", count: 5 },
  { label: "All", count: Infinity },
];

export function LabTrendCard({
  theme,
  title,
  subtitle,
  icon,
  iconColor,
  label,
  unit = "",
  results = [],
  normal,
  critLow,
  critHigh,
  windows = DEFAULT_WINDOWS,
  formatValue,
}) {
  const t = resolveTheme(theme, "light");
  const readings = results.filter((r) => Number.isFinite(r.value));
  const options = usefulWindows(windows, readings.length);
  const [win, setWin] = useState(options.length - 1);
  const card = {
    theme: t, size: "fill", width: "100%", expandable: true, controls: [], title: title ?? label, subtitle, icon, iconColor,
    headerRight: <WindowSwitch t={t} windows={options} active={Math.min(win, options.length - 1)} onChange={setWin} />,
  };

  if (!readings.length) {
    return <ChartCard {...card}>{() => <Empty t={t} label="No results recorded" />}</ChartCard>;
  }

  const fmt = formatValue || makeFormat(decimalsOf(readings.map((r) => r.value)));
  const limits = { normal, critLow, critHigh };
  const last = readings[readings.length - 1];
  const prev = readings.length > 1 ? readings[readings.length - 2] : null;
  const status = statusOf(last.value, limits);
  const delta = prev ? last.value - prev.value : null;
  const shown = windowed(readings, options[Math.min(win, options.length - 1)]);

  return (
    <ChartCard {...card}>
      {() => (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 10px", flex: "none" }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: statusColor(status, t.text.primary) }}>{fmt(last.value)}</span>
            {unit && <span style={{ ...MONO, fontSize: 12, color: t.text.muted }}>{unit}</span>}
            <span style={{ alignSelf: "center" }}><StatusPill t={t} status={status} /></span>
            {delta != null && (
              <span style={{ ...MONO, fontSize: 12, color: t.text.secondary }}>
                {delta > 0 ? "+" : delta < 0 ? "−" : "±"}{fmt(Math.abs(delta))} since {prev.label}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 80 }}>
            <TrendPlot t={t} points={shown} limits={limits} unit={unit} fmt={fmt} />
          </div>

          <StatsRow t={t} stats={summarize(shown.map((p) => p.value))} fmt={fmt} reference={referenceCell(limits, fmt)} />
        </div>
      )}
    </ChartCard>
  );
}

export default LabTrendCard;
