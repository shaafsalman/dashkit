/**
 * Internal helpers shared by this package's dashboard-card components.
 * Not part of the public API — components re-export what callers need
 * (e.g. GRADIENTS from GradientStatCard).
 */
import { useState, useEffect, useRef } from "react";

/* Live pixel size of a container. Same idea as lib/charts/useMeasuredBox, kept
 * local so this module doesn't depend on a file that only exists on some
 * branches. A fixed viewBox stretched into a card of a different aspect ratio
 * distorts circles into ovals and glyphs into smears; measuring means the
 * viewBox always equals the real box, so nothing is ever scaled. */
export function useMeasuredBox(minSize = { width: 320, height: 180 }) {
  const ref = useRef(null);
  const [box, setBox] = useState(minSize);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setBox({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
}

export const MORD = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
export const MONO = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };
export const NEG = "#E11D48";

/* Aviation dart glyph, centred on the origin, pointing +x. Elongated (roughly
 * 2:1) so it reads as an aircraft rather than a squat arrowhead, and always
 * rendered in a fixed-size SVG so it can't be stretched by its container. */
export const PLANE = "M 8,0 L -4,-2.9 L -1.6,0 L -4,2.9 Z";

export const polarPt = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

export const shortMonth = (s) => {
  const head = String(s || "").trim().split(/[-/\s]/)[0];
  const n = parseInt(head, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return MORD[n - 1];
  return head.slice(0, 3).charAt(0).toUpperCase() + head.slice(1, 3).toLowerCase();
};

export const compact = (n) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`;

export const Empty = ({ t, label }) => (
  <div style={{ height: "100%", minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: t.text.muted }}>
    {label}
  </div>
);

/* Catmull-Rom sampled to an even polyline. Every sample doubles as one barcode
 * strip, so the curve and the strips can never disagree. */
export const spline = (pts, perSegment) => {
  if (pts.length < 2) return pts.slice();
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        seg: i,
      });
    }
  }
  out.push({ ...pts[pts.length - 1], seg: pts.length - 2 });
  return out;
};

/* ── GRADIENT STAT CARD ──────────────────────────────────────────────────────
 * Same gradient family the page's KPI tiles and header cards already use, with
 * translucent sub-pills for the supporting figures.
 * ────────────────────────────────────────────────────────────────────────── */

export const GRADIENTS = {
  blue: "linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%)",
  emerald: "linear-gradient(135deg,#047857 0%,#10B981 100%)",
  sky: "linear-gradient(135deg,#075985 0%,#0EA5E9 100%)",
  violet: "linear-gradient(135deg,#5B21B6 0%,#8B5CF6 100%)",
  amber: "linear-gradient(135deg,#B45309 0%,#F59E0B 100%)",
};
