import React from "react";

/**
 * KpiCard — the app-wide KPI tile.
 *
 * Solid dark surface, white text, white icons. Use this everywhere a KPI is
 * shown so the metric language stays identical across pages; don't hand-roll
 * local variants.
 *
 * `tone` selects the fill. All tones are deep enough for white text to clear
 * AA contrast — they differ in hue only, so a row of mixed tones still reads
 * as one family.
 */

// Matches the vibrant gradient set already used for KPI tiles on
// MainDashboard/ExecutiveOverview.jsx — same family, same direction, so the
// two pages read as one design language rather than two different KPI styles.
const TONES = {
  forest: "linear-gradient(135deg, #10B981 0%, #047857 100%)", // emerald
  slate: "linear-gradient(135deg, #06B6D4 0%, #0E7490 100%)", // cyan
  ocean: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)", // blue
  violet: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)", // violet
  ember: "linear-gradient(135deg, #FBBF24 0%, #F97316 100%)", // amber → orange
  crimson: "linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)", // rose
};

export const KPI_TONES = Object.keys(TONES);

export default function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  delta,
  tone = "forest",
  loading = false,
  onClick,
  className = "",
  style = {},
}) {
  const interactive = typeof onClick === "function";
  const up = (delta ?? 0) >= 0;

  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`kpi-card group relative flex min-w-0 items-center gap-3 overflow-hidden
                  px-3.5 py-3 text-white
                  ${interactive ? "cursor-pointer" : ""} ${className}`}
      style={{ backgroundImage: TONES[tone] || TONES.forest, ...style }}
    >
      {/* soft corner bloom — gives the flat fill some depth */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full
                   bg-white/10 blur-2xl transition-opacity duration-300 group-hover:opacity-80"
      />
      {/* top edge highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20"
      />

      {Icon && (
        <span
          className="relative flex shrink-0 items-center justify-center text-white
                     transition-transform duration-300 group-hover:scale-110"
        >
          <Icon className="h-6 w-6" />
        </span>
      )}

      <div className="relative min-w-0">
        <p className="truncate text-[24px] font-bold leading-tight tracking-tighter tabular-nums text-white">
          {loading ? "—" : value}
        </p>
        <p className="truncate text-[12px] font-medium leading-tight tracking-tight text-white/70">{label}</p>
        {(sub || delta != null) && (
          <p className="truncate text-[10px] leading-tight text-white/50">
            {delta != null && (
              <span className={up ? "text-emerald-300" : "text-rose-300"}>
                {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            {delta != null && sub ? " · " : ""}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
