import React, { useMemo, useState, memo, useCallback } from "react";
import { resolveTheme } from "./theme";
import { ChartCard, ChartTooltip } from "./chrome";
import { useMeasuredBox } from "./useMeasuredBox";

/**
 * NetworkGraphChart — directed route network for a hub-and-spoke carrier.
 *
 * Three decisions drive the layout:
 *
 *  1. HUB-CENTRIC ELLIPSE, not a uniform circle. With one dominant airport a
 *     circle mis-encodes the topology and, being inscribed in a landscape
 *     box, throws away all four corners. The hub sits at the centroid where
 *     it belongs and the spokes ride an ellipse sized to the measured box.
 *
 *  2. NO FIXED viewBox — the pane is measured and the viewBox is set to it
 *     every render, so a mismatched aspect ratio can never letterbox.
 *
 *  3. A RANKED RAIL beside the graph. A 10-node/35-edge node-link diagram is
 *     hard to read numerically no matter how well it's laid out; the rail
 *     turns what was dead right-hand margin into directly readable values,
 *     cross-linked to the graph by the same emphasis state.
 *
 * Emphasis is a single derived variable (`emph`) that hover, focus and the
 * rail all feed, so every surface reacts together instead of each tracking
 * its own selection.
 */

// Black/gray slate palette to match the Global Network & Cost section's
// "slate" identity (the card is a dark gradient; nodes/edges in neutral grays
// with white as the hub highlight). Selection/emphasis + tooltips use a bright
// aquatic blue so the active item pops off the dark surface.
const HUB = "#FFFFFF";
const NODE = "#D4D4D8";
const SEL = "#22D3EE";
const HOT = "#38BDF8";
const EDGE_PEER = "#52525B";
// Solid halo behind nodes/labels that sits on the dark slate card surface.
const HALO = "#1C1C20";
const SANS = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const RAIL_W = 186;
const TILES_H = 54;

const shift = (p, toward, dist) => {
  const dx = toward.x - p.x;
  const dy = toward.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / len) * dist, y: p.y + (dy / len) * dist };
};

const NetworkGraphChart = memo(
  ({
    title = "Network Connectivity",
    subtitle,
    icon,
    iconColor,
    theme,
    controls,
    onControl,
    nodes = [],
    edges = [],
    nodeTotals,
    activeAirports,
    routeDirections,
    primaryHub,
    busiestRoute,
    formatValue,
    width = "100%",
    size = "fill",
    expandable = true,
    className = "",
    radius,
    compact = false,
  }) => {
    const t = resolveTheme(theme, "light");
    const fmt = formatValue || ((v) => Number(v || 0).toLocaleString("en-US"));

    const [hoverNode, setHoverNode] = useState(null);
    const [hoverEdge, setHoverEdge] = useState(-1);
    const [focus, setFocus] = useState(null);

    const [paneRef, pane] = useMeasuredBox({ width: 460, height: 280 });

    /* ── model ─────────────────────────────────────────────────────────── */
    const model = useMemo(() => {
      const byKey = new Map();
      (edges || []).forEach((e) => {
        if (!e || !e.from || !e.to || e.from === e.to) return;
        const v = Number(e.value) || 0;
        if (v <= 0) return;
        const k = `${e.from}|${e.to}`;
        byKey.set(k, { from: e.from, to: e.to, value: (byKey.get(k)?.value || 0) + v });
      });
      const clean = [...byKey.values()].sort((a, b) => b.value - a.value);

      const totals = { ...(nodeTotals || {}) };
      if (!nodeTotals) {
        clean.forEach((e) => {
          totals[e.from] = (totals[e.from] || 0) + e.value;
          totals[e.to] = (totals[e.to] || 0) + e.value;
        });
      }
      const codes = (nodes && nodes.length ? [...nodes] : Object.keys(totals)).filter(
        (c) => totals[c] != null
      );
      const order = codes.sort((a, b) => (totals[b] || 0) - (totals[a] || 0));

      const adj = {};
      order.forEach((c) => { adj[c] = new Set(); });
      clean.forEach((e) => {
        if (adj[e.from]) adj[e.from].add(e.to);
        if (adj[e.to]) adj[e.to].add(e.from);
      });

      const maxEdge = Math.max(...clean.map((e) => e.value), 1);
      const maxNode = Math.max(...order.map((c) => totals[c] || 0), 1);
      const netSum = clean.reduce((s, e) => s + e.value, 0) || 1;

      // Only call it a hub if one node really does connect to most others —
      // otherwise a centre node would be an invented claim about the topology.
      const top = order[0];
      const hub =
        primaryHub && adj[primaryHub]
          ? primaryHub
          : order.length >= 5 && top && adj[top].size >= Math.ceil((order.length - 1) / 2)
            ? top
            : null;

      return { clean, totals, order, adj, maxEdge, maxNode, netSum, hub };
    }, [nodes, edges, nodeTotals, primaryHub]);

    const { clean, totals, order, adj, maxEdge, maxNode, netSum, hub } = model;

    /* ── geometry ──────────────────────────────────────────────────────── */
    const geo = useMemo(() => {
      const W = Math.max(pane.width, 40);
      const H = Math.max(pane.height, 40);
      const cx = W / 2;
      const cy = H / 2;
      const ring = hub ? order.filter((c) => c !== hub) : order;
      const longest = order.reduce((m, c) => Math.max(m, String(c).length), 0);
      const gutter = longest > 3 ? 56 : 48;
      // Ellipse, not circle: the box is landscape, so rx and ry come from the
      // real measurements independently instead of min(w,h).
      const rx = Math.max(28, cx - gutter);
      const ry = Math.max(22, cy - 32);

      const pos = {};
      if (hub) pos[hub] = { x: cx, y: cy, r: 20, hub: true, s: 0, c: 1 };
      ring.forEach((code, i) => {
        const th = -Math.PI / 2 + (i / Math.max(1, ring.length)) * Math.PI * 2;
        pos[code] = {
          x: cx + rx * Math.cos(th),
          y: cy + ry * Math.sin(th),
          r: 5 + 9 * Math.sqrt((totals[code] || 0) / maxNode),
          hub: false,
          s: Math.sin(th),
          c: Math.cos(th),
        };
      });

      const paths = clean.map((e) => {
        const p0 = pos[e.from];
        const p1 = pos[e.to];
        if (!p0 || !p1) return null;
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        // Bow perpendicular to the chord; handedness follows direction, so
        // A→B and B→A separate instead of overdrawing each other.
        const bow = e.from === hub || e.to === hub ? 10 : 16;
        const ctrl = { x: mx - (dy / len) * bow, y: my + (dx / len) * bow };
        const a = shift(p0, ctrl, p0.r + 3);
        const b = shift(p1, ctrl, p1.r + 3);
        return {
          d: `M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`,
          mid: { x: 0.25 * a.x + 0.5 * ctrl.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * ctrl.y + 0.25 * b.y },
          sw: 1 + 5 * Math.sqrt(e.value / maxEdge),
        };
      });

      return { W, H, pos, ring, paths };
    }, [pane.width, pane.height, order, clean, totals, maxNode, maxEdge, hub]);

    /* ── emphasis ──────────────────────────────────────────────────────── */
    const emph = hoverNode ?? (hoverEdge >= 0 ? clean[hoverEdge]?.from : null) ?? focus;
    const isolated = focus != null;
    const incident = useMemo(() => {
      if (!emph) return null;
      const s = new Set();
      clean.forEach((e, i) => { if (e.from === emph || e.to === emph) s.add(i); });
      return s;
    }, [emph, clean]);
    const neighbours = emph ? adj[emph] : null;

    const edgeOpacity = (i) => {
      const e = clean[i];
      // Steep curve, near-invisible floor — with 35 routes drawn at once,
      // giving every minor one even a faint presence recreates the hairball.
      // The handful that actually matter should be the only thing visible
      // at rest; everything else is barely-there background texture.
      const isHubEdge = e.from === hub || e.to === hub;
      const base = isHubEdge ? 0.1 : 0.03;
      const ceiling = isHubEdge ? 0.85 : 0.22;
      const rest = base + (ceiling - base) * Math.pow(e.value / maxEdge, 1.6);
      if (i === hoverEdge) return 0.95;
      if (!emph) return rest;
      if (incident?.has(i)) return 0.9;
      return isolated ? 0.03 : 0.05;
    };
    // Hub spokes in the brand blue (the "spine" of the network); the ~26
    // peer-to-peer routes that don't touch the hub in a cooler slate — so
    // the hub-and-spoke pattern reads at a glance, with cross-links as
    // legible but clearly secondary texture behind it.
    const edgeColor = (e) => (e.from === hub || e.to === hub ? NODE : EDGE_PEER);
    const nodeOpacity = (c) => {
      if (!emph) return 1;
      if (c === emph || neighbours?.has(c)) return 1;
      return isolated ? 0.16 : 0.22;
    };

    const clearFocus = useCallback(() => setFocus(null), []);
    const toggleFocus = useCallback((c) => setFocus((f) => (f === c ? null : c)), []);

    /* ── live stat tiles ───────────────────────────────────────────────── */
    const busiest = clean[0];
    const tiles = emph
      ? [
          { label: "Airport", value: emph },
          { label: "Routes", value: String(adj[emph]?.size ?? 0) },
          { label: "Passengers", value: fmt(totals[emph] || 0) },
          { label: "Share of network", value: `${Math.round(((totals[emph] || 0) / (netSum * 2)) * 100)}%` },
        ]
      : [
          { label: "Active airports", value: String(activeAirports ?? order.length) },
          { label: "Route directions", value: String(routeDirections ?? clean.length) },
          { label: "Primary hub", value: hub || "—", onClick: hub ? () => toggleFocus(hub) : undefined },
          {
            label: "Busiest route",
            value: busiestRoute || (busiest ? `${busiest.from}-${busiest.to}` : "—"),
            onClick: busiest ? () => toggleFocus(busiest.from) : undefined,
          },
        ];

    /* ── tooltip ───────────────────────────────────────────────────────── */
    const tip = useMemo(() => {
      if (hoverEdge >= 0) {
        const e = clean[hoverEdge];
        if (!e) return null;
        const ret = clean.find((x) => x.from === e.to && x.to === e.from);
        return {
          at: geo.paths[hoverEdge]?.mid,
          title: `${e.from} → ${e.to}`,
          rows: [
            { label: "Passengers", value: fmt(e.value), color: SEL },
            { label: "Rank", value: `#${hoverEdge + 1} of ${clean.length}` },
            { label: "Return leg", value: ret ? fmt(ret.value) : "none" },
          ],
        };
      }
      if (hoverNode) {
        const p = geo.pos[hoverNode];
        const best = clean.find((e) => e.from === hoverNode || e.to === hoverNode);
        return {
          at: p,
          title: hoverNode,
          rows: [
            { label: "Passengers", value: fmt(totals[hoverNode] || 0), color: hoverNode === hub ? HUB : NODE },
            { label: "Routes", value: String(adj[hoverNode]?.size ?? 0) },
            ...(best ? [{ label: "Top link", value: `${best.from === hoverNode ? best.to : best.from} · ${fmt(best.value)}` }] : []),
          ],
        };
      }
      return null;
    }, [hoverEdge, hoverNode, clean, geo, totals, adj, hub, fmt]);

    /* ── render ────────────────────────────────────────────────────────── */
    const empty = !order.length || !clean.length;

    const renderGraph = () => (
      <svg
        viewBox={`0 0 ${geo.W} ${geo.H}`}
        width={geo.W}
        height={geo.H}
        role="img"
        aria-label={`${title}: ${order.length} airports, ${clean.length} routes`}
        style={{ display: "block" }}
      >
        {/* background catcher — clicking empty space escapes focus */}
        <rect x={0} y={0} width={geo.W} height={geo.H} fill="transparent" onClick={clearFocus} />

        {/* `clean` is sorted thickest-first; painting in that order buries
            the routes that matter most under a haze of thin ones. Draw
            ascending instead — thin background texture first, the handful of
            routes that actually carry the network on top, where they read. */}
        {clean.map((e, i) => i).sort((a, b) => clean[a].value - clean[b].value).map((i) => {
          const e = clean[i];
          const p = geo.paths[i];
          if (!p) return null;
          const on = i === hoverEdge || (emph && incident?.has(i));
          const isHot = i === 0 && !emph;
          return (
            <g key={`e-${e.from}-${e.to}`}>
              <path
                d={p.d}
                fill="none"
                stroke={on ? SEL : isHot ? HOT : edgeColor(e)}
                strokeWidth={on ? p.sw * 1.25 : p.sw}
                strokeOpacity={isHot ? 0.75 : edgeOpacity(i)}
                strokeLinecap="round"
                style={{ transition: "stroke-opacity .16s ease, stroke-width .16s ease" }}
              />
              {/* fat invisible hit path — a 1px bezier is unhittable */}
              <path
                d={p.d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                pointerEvents={isolated && !incident?.has(i) ? "none" : "stroke"}
                onMouseEnter={() => setHoverEdge(i)}
                onMouseLeave={() => setHoverEdge((h) => (h === i ? -1 : h))}
                onClick={() => toggleFocus(e.from)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}

        {/* Value badges on the top 3 routes — the numbers that matter most
            shouldn't require a hover to read. Suppressed while something
            else is emphasised so they don't compete with the tooltip. */}
        {!emph && clean.slice(0, 3).map((e, rank) => {
          const p = geo.paths[clean.indexOf(e)];
          if (!p) return null;
          const label = fmt(e.value);
          const badgeW = label.length * 6.2 + 12;
          return (
            <g key={`badge-${e.from}-${e.to}`} pointerEvents="none">
              <rect x={p.mid.x - badgeW / 2} y={p.mid.y - 9} width={badgeW} height={18} rx={0} fill="rgba(255,255,255,0.12)" stroke={rank === 0 ? HOT : NODE} strokeWidth={1} />
              <text x={p.mid.x} y={p.mid.y + 4} textAnchor="middle" fontFamily={MONO} fontSize={10.5} fontWeight={700} fill={rank === 0 ? HOT : NODE}>
                {label}
              </text>
            </g>
          );
        })}

        {order.map((c) => {
          const p = geo.pos[c];
          if (!p) return null;
          const op = nodeOpacity(c);
          const isEmph = c === emph;
          const above = p.s < -0.85;
          const below = p.s > 0.85;
          const lx = above || below ? p.x : p.x + (p.c >= 0 ? p.r + 7 : -(p.r + 7));
          const ly = above ? p.y - p.r - 7 : below ? p.y + p.r + 14 : p.y + 4;
          const anchor = above || below ? "middle" : p.c >= 0 ? "start" : "end";
          return (
            <g key={`n-${c}`} opacity={op} style={{ transition: "opacity .16s ease" }}>
              {isEmph && <circle cx={p.x} cy={p.y} r={p.r + 5} fill="none" stroke={SEL} strokeWidth={2} />}
              <circle
                cx={p.x}
                cy={p.y}
                r={isEmph ? p.r + 2 : p.r}
                fill={p.hub ? HUB : NODE}
                stroke={HALO}
                strokeWidth={2.5}
                style={{ transition: "r .16s ease" }}
              />
              {/* white halo behind the label — with edges crossing behind
                  every node, plain fill text loses legibility exactly where
                  routes are busiest */}
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                fontFamily={SANS}
                fontSize={11.5}
                fontWeight={700}
                stroke={HALO}
                strokeWidth={3}
                strokeLinejoin="round"
                pointerEvents="none"
              >
                {c}
              </text>
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                fontFamily={SANS}
                fontSize={11.5}
                fontWeight={700}
                fill={t.text.primary}
                pointerEvents="none"
              >
                {c}
              </text>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r + 8}
                fill="transparent"
                pointerEvents={isolated && c !== focus && !neighbours?.has(c) ? "none" : "all"}
                onMouseEnter={() => setHoverNode(c)}
                onMouseLeave={() => setHoverNode((h) => (h === c ? null : h))}
                onClick={() => toggleFocus(c)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}
      </svg>
    );

    const renderRail = () => {
      const rows = order.map((c) => ({
        code: c,
        value: totals[c] || 0,
        deg: adj[c]?.size ?? 0,
        pct: Math.round(((totals[c] || 0) / maxNode) * 100),
      }));
      return (
        <div style={{ width: RAIL_W, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.text.muted, paddingBottom: 6, borderBottom: `1px solid ${t.control.border}` }}>
            Airports by volume
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {rows.map((r) => {
              const on = r.code === emph;
              const color = r.code === hub ? HUB : NODE;
              return (
                <button
                  key={r.code}
                  type="button"
                  onMouseEnter={() => setHoverNode(r.code)}
                  onMouseLeave={() => setHoverNode((h) => (h === r.code ? null : h))}
                  onFocus={() => setHoverNode(r.code)}
                  onBlur={() => setHoverNode((h) => (h === r.code ? null : h))}
                  onClick={() => toggleFocus(r.code)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, width: "100%",
                    padding: "5px 6px", border: "none", borderRadius: 0, cursor: "pointer",
                    borderLeft: `2px solid ${on ? SEL : "transparent"}`,
                    textAlign: "left", font: "inherit",
                    // proportion bar costs no extra height — it IS the row bg
                    background: `linear-gradient(to right, ${on ? SEL : color}${on ? "22" : "14"} ${r.pct}%, transparent ${r.pct}%)`,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 700, color: t.text.primary, flex: 1 }}>{r.code}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: t.text.muted }}>{r.deg}r</span>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: t.text.secondary }}>{fmt(r.value)}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    };

    const body = () => {
      if (empty) {
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: t.text.muted, fontSize: 13 }}>
            No route data
          </div>
        );
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, flexShrink: 0, height: TILES_H }}>
            {tiles.map((s) => (
              <div
                key={s.label}
                onClick={s.onClick}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: `1px solid ${t.control.border}`,
                  borderRadius: 0,
                  padding: "7px 10px",
                  cursor: s.onClick ? "pointer" : "default",
                  overflow: "hidden",
                }}
              >
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.text.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: t.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12 }}>
            <div ref={paneRef} style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
              {renderGraph()}
              {isolated && (
                <button
                  type="button"
                  onClick={clearFocus}
                  style={{
                    position: "absolute", top: 0, left: 0, zIndex: 4,
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "3px 8px", borderRadius: 0,
                    border: `1px solid ${SEL}`, background: "rgba(255,255,255,0.14)",
                    fontFamily: SANS, fontSize: 11, fontWeight: 700, color: SEL, cursor: "pointer",
                  }}
                >
                  {focus} · {adj[focus]?.size ?? 0} routes ✕
                </button>
              )}
              <ChartTooltip
                theme={t}
                visible={!!tip}
                left={tip?.at ? `${Math.min(Math.max((tip.at.x / geo.W) * 100, 12), 88)}%` : "50%"}
                top={tip?.at ? `${Math.min(Math.max((tip.at.y / geo.H) * 100, 8), 78)}%` : "50%"}
                title={tip?.title || ""}
                rows={tip?.rows || []}
              />
            </div>
            {renderRail()}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0, fontSize: 11, color: t.text.muted, borderTop: `1px solid ${t.control.border}`, paddingTop: 8 }}>
            {emph ? (
              <span style={{ fontFamily: MONO, color: t.text.secondary }}>
                {emph} · {adj[emph]?.size ?? 0} routes · {fmt(totals[emph] || 0)} pax
              </span>
            ) : (
              <>
                {hub && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: HUB }} />Hub</span>}
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: NODE }} />Airport</span>
                {hub && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 2, background: NODE }} />Hub route</span>}
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 2, background: EDGE_PEER }} />Direct route</span>
                <span>Thickness = passengers</span>
                <span style={{ color: HOT }}>Busiest route</span>
              </>
            )}
          </div>
        </div>
      );
    };

    return (
      <ChartCard
        theme={t}
        title={title}
        subtitle={subtitle}
        icon={icon}
        iconColor={iconColor}
        controls={controls ?? []}
        onControl={onControl}
        width={width}
        size={size}
        expandable={expandable}
        className={className}
        radius={radius}
        compact={compact}
      >
        {() => body()}
      </ChartCard>
    );
  }
);

NetworkGraphChart.displayName = "NetworkGraphChart";
export default NetworkGraphChart;
