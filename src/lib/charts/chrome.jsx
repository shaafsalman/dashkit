import React, { memo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Filter, ArrowUpDown, MoreHorizontal, MoreVertical, ChevronDown,
  ArrowUp, ArrowDown, Info, Users, Maximize2, X, Check, Download,
} from "lucide-react";
import { useMeasuredBox } from "./useMeasuredBox";

/**
 * Shared, theme-driven chrome for the chart library:
 *  - glassmorphism ChartCard (size s/m/l/xl, no shadow, frosted)
 *  - working header controls (sort / filter / period dropdown / more) via popover menus
 *  - a consistent ChartTooltip primitive
 *  - normal vs detailed render (detailed shown in the expand modal)
 *  - enter / hover / transition animations (injected CSS)
 */

export const ICON_SIZE = 16;
export const SIZES = { xs: 124, s: 168, m: 216, l: 290, xl: 372 };

export const Icons = {
  filter: Filter, sort: ArrowUpDown, more: MoreHorizontal, moreV: MoreVertical,
  chevron: ChevronDown, up: ArrowUp, down: ArrowDown, info: Info, users: Users,
  expand: Maximize2, close: X, check: Check, download: Download,
};

/**
 * FitText — single-line label that NEVER truncates. When the available width
 * is smaller than the text needs at `maxSize`, the font scales down (never
 * below `minSize`) instead of clipping to an ellipsis. Text width comes from
 * the element's own scrollWidth, which already reflects the current font, so
 * the scale formula is self-stabilizing:
 *
 *     target = currentSize * availableWidth / textWidth
 *
 * and it recovers back up to `maxSize` when space frees up. `style` is spread
 * onto the span (fontWeight, letterSpacing, color, ...).
 */
const FitText = memo(({ text, maxSize, minSize = 9, style = {} }) => {
  const ref = useRef(null);
  const [size, setSize] = useState(maxSize);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      const wrap = el.parentElement;
      if (!wrap) return;
      const avail = wrap.clientWidth;
      const textW = el.scrollWidth;
      if (!avail || !textW) return;
      const clamped = Math.max(minSize, Math.min(maxSize, (size * avail) / textW));
      if (Math.abs(size - clamped) > 0.1) setSize(clamped);
    };
    fit();
    let ro;
    if (typeof ResizeObserver !== "undefined" && el.parentElement) {
      ro = new ResizeObserver(fit);
      ro.observe(el.parentElement);
    }
    return () => ro && ro.disconnect();
  }, [text, maxSize, minSize, size]);

  return (
    <span
      ref={ref}
      style={{
        display: "inline-block",
        whiteSpace: "nowrap",
        fontSize: size,
        lineHeight: 1.25,
        ...style,
      }}
    >
      {text}
    </span>
  );
});
FitText.displayName = "FitText";

/* inject shared CSS once */
if (typeof document !== "undefined" && !document.getElementById("cc-css")) {
  const s = document.createElement("style");
  s.id = "cc-css";
  s.textContent = `
    .cc-body{display:flex;flex-direction:column;justify-content:center;min-height:0}
    .cc-body svg{max-height:var(--cc-h,200px)!important;width:100%;display:block}
    .cc-body.cc-fluid{justify-content:stretch}
    /* Non-svg fluid bodies get forced to whatever pixel height the flex/grid
       ancestors squeeze them to, with no way to measure that height in JS.
       Without clipping here, content taller than that box doesn't clip — it
       paints over/under the next sibling card with no scrollbar, which reads
       as a hard, unexplained cut. Plain overflow:hidden (not auto) — auto
       made the element a scroll container even when content only overflows
       by a sub-pixel rounding error, which was enough for the browser to
       capture every wheel tick over the chart instead of letting it scroll
       the page. Components that need genuine internal scrolling (e.g.
       BarRankingChart's row list) opt in with their own overflowY:"auto" on
       their own body div instead of relying on this shared rule. A no-op for
       svg-based fill charts: their <svg> is separately forced to height:100%
       below and exactly fills this box, so nothing ever overflows. */
    .cc-body.cc-fluid > div{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
    .cc-body.cc-fluid svg{max-height:none!important;height:100%!important;width:100%;flex:1;min-height:0}
    .cc-body svg path,.cc-body svg rect,.cc-body svg circle,.cc-body svg line,.cc-body svg polygon{transition:opacity .2s ease,transform .2s ease}
    .cc-modal-body svg{max-height:38vh!important;width:100%!important}
    .cc-menu{animation:ccMenu .14s ease both}
    @keyframes ccMenu{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    .cc-fade{animation:ccFade .5s ease both}
    @keyframes ccFade{from{opacity:0}to{opacity:1}}`;
  document.head.appendChild(s);
}

// `xs` is a step down from `small` — used when the card itself measures too
// short/narrow for even the compact pill (a "fill" chart in a half-height
// bento cell, not just a chart explicitly sized="s"). Icon-only, tighter.
const basePill = (t, iconOnly, density) => ({
  display: "inline-flex", alignItems: "center",
  gap: density === "xs" ? 4 : density === "small" ? 6 : 8,
  borderRadius: 999,
  border: `1px solid ${t.control.border}`,
  fontSize: density === "xs" ? 11 : density === "small" ? 12 : 13,
  fontWeight: 500,
  padding:
    density === "xs" ? (iconOnly ? "3px 4px" : "3px 7px")
    : density === "small" ? (iconOnly ? "4px 5px" : "5px 10px")
    : (iconOnly ? "8px 10px" : "8px 15px"),
  cursor: "pointer", lineHeight: 1,
  transition: "background .15s ease, border-color .15s ease, transform .1s ease, box-shadow .15s ease, opacity .15s ease",
  whiteSpace: "nowrap",
});

/**
 * `ghost`: renders as a translucent floating layer instead of a solid pill —
 * for controls sitting on a small/compact card where a full-opacity button
 * competes with the chart underneath. At rest it's a soft backdrop-blurred
 * hint; hover brings it to full opacity so it's still clearly usable.
 */
const Pill = memo(({ theme: t, onClick, ariaLabel, iconOnly, small, density, ghost, color, active, children, innerRef }) => {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const d = density || (small ? "small" : "normal");
  const restBg = ghost ? `${t.control.bg}00`.length === 9 ? t.control.bg : t.control.bg : t.control.bg;
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
      style={{
        ...basePill(t, iconOnly, d),
        color: color || t.control.text,
        background: active || hover ? t.control.hover : (ghost ? "transparent" : t.control.bg),
        backdropFilter: ghost && !hover && !active ? t.backdrop : undefined,
        WebkitBackdropFilter: ghost && !hover && !active ? t.backdrop : undefined,
        borderColor: active || hover ? t.accent : (ghost ? `${t.control.border}` : t.control.border),
        opacity: ghost && !hover && !active ? 0.72 : 1,
        transform: down ? "scale(0.94)" : hover ? "translateY(-1px)" : "none",
        boxShadow: hover ? `0 4px 12px -6px ${t.accent}66` : "none",
        outline: "none",
      }}
    >
      {children}
    </button>
  );
});
Pill.displayName = "Pill";

/* popover menu (single-select or multi-checkbox) — rendered via portal so it
   can't be clipped by an ancestor's overflow:hidden (e.g. the floatingHeader
   hover-reveal cluster, which needs overflow:hidden for its own slide-in
   animation but would otherwise clip any dropdown opened inside it). */
const Menu = memo(({ theme: t, options = [], value, multi, onPick, onClose, anchorRect }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const pos = anchorRect
    ? { position: "fixed", top: anchorRect.bottom + 6, left: "auto", right: Math.max(8, window.innerWidth - anchorRect.right) }
    : { position: "absolute", top: "calc(100% + 6px)", right: 0 };

  return createPortal(
    <div
      ref={ref}
      className="cc-menu"
      style={{
        ...pos, zIndex: 2000,
        minWidth: 168, padding: 6, borderRadius: 12,
        background: t.mode === "light" ? "#ffffff" : "#202020", backdropFilter: t.backdrop, WebkitBackdropFilter: t.backdrop,
        border: `1px solid ${t.control.border}`, boxShadow: "0 12px 32px -12px rgba(0,0,0,0.35)",
      }}
    >
      {options.map((o) => {
        const sel = multi ? o.active : value === o.value;
        return (
          <button
            key={o.value ?? o.label}
            type="button"
            onClick={() => onPick(o)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "transparent", color: t.text.primary, fontSize: 13, textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.control.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {o.color && <span style={{ width: 10, height: 10, borderRadius: 3, background: o.color, opacity: multi && !o.active ? 0.3 : 1 }} />}
            <span style={{ flex: 1, opacity: multi && !o.active ? 0.5 : 1 }}>{o.label}</span>
            {sel && <Check size={14} color={t.accent} />}
          </button>
        );
      })}
    </div>,
    document.body
  );
});
Menu.displayName = "Menu";

const normalizeControl = (c) => (typeof c === "string" ? { type: c } : c);
const defaultLabel = (c) => c.label ?? { filter: "Filter", sort: "Sort", dropdown: "Monthly", period: "Monthly" }[c.type] ?? "";

/* one header control: pill + (optional) popover menu, fully functional */
const ControlButton = memo(({ theme: t, control: c, onControl, small, density }) => {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const triggerRef = useRef(null);
  const hasMenu = Array.isArray(c.options) || Array.isArray(c.menu) || Array.isArray(c.items);
  const Cmp = c.type === "dropdown" || c.type === "period" ? null : Icons[c.type] || Icons.more;
  // A control can force icon-only itself (c.iconOnly) — used for e.g. Sort
  // on a compact card, where the label just adds width the pill doesn't have.
  const iconOnly = c.iconOnly ?? (c.type === "more" || c.type === "moreV");
  const label = c.type === "period" || c.type === "dropdown"
    ? (c.options?.find((o) => o.value === c.value)?.label ?? defaultLabel(c))
    : defaultLabel(c);

  const pick = (o) => {
    if (c.type === "filter" && c.onToggle) c.onToggle(o.value ?? o.key);
    else if (o.onClick) o.onClick();
    else c.onChange?.(o.value);
    if (c.type !== "filter") setOpen(false);
  };

  const toggleOpen = () => {
    if (!open && triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
    setOpen((v) => !v);
  };

  return (
    <div style={{ position: "relative" }}>
      <Pill
        theme={t}
        innerRef={triggerRef}
        iconOnly={iconOnly}
        small={small}
        density={density}
        active={open}
        ariaLabel={c.type}
        color={c.color}
        onClick={() => (hasMenu ? toggleOpen() : (c.onClick ? c.onClick() : onControl?.(c.type, c)))}
      >
        {Cmp && <Cmp size={density === "xs" ? ICON_SIZE - 3 : c.size || ICON_SIZE} />}
        {!iconOnly && label && <span>{label}</span>}
        {!iconOnly && (c.type === "dropdown" || c.type === "period") && <ChevronDown size={ICON_SIZE - 2} />}
      </Pill>
      {open && hasMenu && (
        <Menu
          theme={t}
          options={c.items || c.menu || c.options}
          value={c.value}
          multi={c.type === "filter" || c.multiSelect}
          onPick={pick}
          onClose={() => setOpen(false)}
          anchorRect={anchorRect}
        />
      )}
    </div>
  );
});
ControlButton.displayName = "ControlButton";

export const HeaderControls = memo(({ theme: t, controls = [], onControl, small, density }) => {
  if (!controls.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: density === "xs" ? 5 : 8 }}>
      {controls.map((raw, i) => (
        <ControlButton key={i} theme={t} control={normalizeControl(raw)} onControl={onControl} small={small} density={density} />
      ))}
    </div>
  );
});
HeaderControls.displayName = "HeaderControls";

export const ChangePill = memo(({ value = 0, color, theme: t }) => {
  const up = value >= 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  const c = color || (up ? "#10B981" : "#f43f5e");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: c, fontSize: 13, fontWeight: 700 }}>
      <Arrow size={13} strokeWidth={2.5} />{Math.abs(value)}%
    </span>
  );
});
ChangePill.displayName = "ChangePill";

/* consistent tooltip — charts render this inside a position:relative wrapper */
export const ChartTooltip = memo(({ theme: t, left, top, title, rows = [], visible, flip = false }) => {
  if (!visible) return null;
  return (
    <div
      style={{
        // `flip` renders BELOW the anchor instead of above it — for anchors
        // near the top of the plot, where translate(-100%) pushed the box
        // past the card edge and it drew clipped.
        position: "absolute", left, top, transform: flip ? "translate(-50%, 12px)" : "translate(-50%, -100%)",
        pointerEvents: "none", zIndex: 30, minWidth: 120, padding: "8px 12px",
        borderRadius: 10, background: t.tooltip?.bg || (t.mode === "light" ? "rgba(255,255,255,0.92)" : "rgba(20,24,33,0.92)"),
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        border: `1px solid ${t.tooltip?.border || t.control.border}`, boxShadow: "0 10px 28px -10px rgba(0,0,0,0.35)",
        fontSize: 12, whiteSpace: "nowrap", color: t.text.primary,
      }}
    >
      {title != null && <div style={{ fontWeight: 700, fontSize: 11, marginBottom: rows.length ? 6 : 0 }}>{title}</div>}
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, margin: "2px 0" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: t.text.secondary }}>
            {r.color && <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color }} />}
            {r.label}
          </span>
          <span style={{ fontWeight: 700 }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
});
ChartTooltip.displayName = "ChartTooltip";

export const Legend = memo(({ items = [], swatch = "square", theme: t, center = true, onToggle, compact = false }) => (
  <div
    style={
      compact
        ? { display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 12, overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }
        : { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: center ? "center" : "flex-start", gap: "8px 22px", marginTop: 14 }
    }
  >
    {items.map((it, i) => {
      const off = it.active === false;
      return (
        <span
          key={it.key ?? it.label ?? i}
          onClick={onToggle ? () => onToggle(it.key ?? it.label) : undefined}
          style={{ display: "flex", alignItems: "center", gap: compact ? 5 : 8, flexShrink: 0, cursor: onToggle ? "pointer" : "default", opacity: off ? 0.4 : 1, transition: "opacity .15s ease", userSelect: "none" }}
        >
          <span style={{ width: compact ? 8 : 12, height: compact ? 8 : 12, borderRadius: swatch === "dot" ? "50%" : 4, background: it.swatch || it.color || t.accent }} />
          <span style={{ fontSize: compact ? 11 : 13, color: t.text.secondary, textDecoration: off ? "line-through" : "none", whiteSpace: "nowrap" }}>{it.label}</span>
          {it.value != null && <span style={{ fontSize: compact ? 11 : 13, fontWeight: 600, color: t.text.secondary, marginLeft: 4 }}>{it.value}</span>}
        </span>
      );
    })}
  </div>
));
Legend.displayName = "Legend";

export const Stat = memo(({ value, label, align = "left", theme: t }) => (
  <div style={{ textAlign: align }}>
    <div style={{ fontSize: 22, fontWeight: 700, color: t.text.primary }}>{value}</div>
    <div style={{ fontSize: 12, color: t.text.muted }}>{label}</div>
  </div>
));
Stat.displayName = "Stat";

const SUBTITLE_STYLE = (t) => ({ fontSize: 12, fontWeight: 500, color: t.text.muted, letterSpacing: "0.01em" });

/**
 * ChartCard — glassmorphism wrapper.
 *   size: "s" | "m" | "l" | "xl"  → body height
 *   children: ReactNode OR ({ detailed }) => ReactNode   (detailed=true in the expand modal)
 */
export const ChartCard = memo(
  ({
    theme: t, title, icon, iconColor, subtitle, controls, onControl, headerRight,
    headline, footer, footerDetailed, width, size = "m", className = "", style,
    expandable = false, floatingHeader = false, radius, compact = false, children,
    headerMarginBottom = 14,
  }) => {
    // `radius` is a direct prop so callers can flatten corners without
    // knowing to spread theme internals (`theme={{ ...LIGHT_THEME, radius: 0 }}`).
    // Falls back to the theme's own radius when omitted.
    const cardRadius = radius != null ? radius : t.radius;
    const [expanded, setExpanded] = useState(false);
    const [hover, setHover] = useState(false);
    useEffect(() => {
      if (!expanded) return undefined;
      const onKey = (e) => e.key === "Escape" && setExpanded(false);
      document.addEventListener("keydown", onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    }, [expanded]);

    const renderBody = (detailed) => (typeof children === "function" ? children({ detailed }) : children);
    const fluid = size === "fill";
    const bodyH = SIZES[size] || SIZES.m;
    // `compact` is an explicit override for callers who know a "fill" chart
    // sits in a visually small slot (e.g. half of a grid-rows-2 column) —
    // the `size` string alone can't tell us that, since "fill" says nothing
    // about how much room the slot actually has.
    const smallChart = compact || size === "xs" || size === "s";
    const controlDensity = compact ? "xs" : smallChart ? "small" : "normal";
    // small cards: put the headline number inline on the right of the header row
    // (instead of a big block above the chart) so the chart gets the vertical room
    const hasHeader = !!(title || subtitle || controls || headerRight || expandable);
    const compactHeadline = smallChart && headline && hasHeader;

    const CompactHeadline = compactHeadline ? (
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: t.text.primary }}>{headline.value}</span>
        {headline.change != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: headline.change >= 0 ? "#10B981" : "#f43f5e" }}>
            {headline.change >= 0 ? "+" : ""}{headline.change}%
          </span>
        )}
      </div>
    ) : null;

    const Headline = headline ? (
      <div style={{ marginBottom: 8 }}>
        {headline.label && <div style={SUBTITLE_STYLE(t)}>{headline.label}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, color: t.text.primary }}>{headline.value}</span>
          {headline.change != null && (t.mode === "light"
            ? <span style={{ background: t.accent, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{headline.change}%</span>
            : <ChangePill theme={t} value={headline.change} />)}
        </div>
      </div>
    ) : null;

    const controlsCluster = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {CompactHeadline}
        {headerRight ?? (
          <HeaderControls theme={t} controls={controls} onControl={onControl} small={smallChart} density={controlDensity} />
        )}
        {expandable && (
          <Pill theme={t} iconOnly density={controlDensity} ariaLabel="Expand chart" onClick={() => setExpanded(true)}>
            <Maximize2 size={compact ? 12 : smallChart ? 13 : ICON_SIZE} />
          </Pill>
        )}
      </div>
    );

    // The floating-header hover reveal sits right next to a large (28px)
    // headline number — forced to "small" density regardless of the chart's
    // own size, so revealed buttons stay visually secondary to the number
    // instead of competing with it at full size.
    const floatingControlsCluster = (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {headerRight ?? <HeaderControls theme={t} controls={controls} onControl={onControl} small density="small" />}
        {expandable && (
          <Pill theme={t} iconOnly density="small" ariaLabel="Expand chart" onClick={() => setExpanded(true)}>
            <Maximize2 size={13} />
          </Pill>
        )}
      </div>
    );

    const Header = (title || subtitle || (!floatingHeader && (controls || headerRight || expandable))) ? (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, paddingRight: floatingHeader ? (headline?.legend ? 150 : 84) : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          {icon && (
            <span style={{ display: "flex", alignItems: "center", flexShrink: 0, color: iconColor || t.accent }}>
              {icon}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            {title && (
              <FitText
                text={title}
                maxSize={compact ? 15 : smallChart ? 16 : 20}
                style={{ fontWeight: 700, letterSpacing: "-0.02em", color: t.text.primary }}
              />
            )}
            {subtitle && <div style={{ ...SUBTITLE_STYLE(t), marginTop: 1 }}>{subtitle}</div>}
          </div>
        </div>
        {!floatingHeader && controlsCluster}
      </div>
    ) : null;

    const glass = {
      width: "100%", maxWidth: width, boxSizing: "border-box",
      background: t.surface, backdropFilter: t.backdrop, WebkitBackdropFilter: t.backdrop,
      border: `1px solid ${t.border}`, borderRadius: cardRadius, boxShadow: "none",
      padding: t.pad, color: t.text.primary,
    };

    return (
      <div
        className={`cc-card ${className}`}
        style={{ ...glass, position: "relative", display: "flex", flexDirection: "column", minHeight: 0, height: "100%", ...style }}
        onMouseEnter={floatingHeader ? () => setHover(true) : undefined}
        onMouseLeave={floatingHeader ? () => setHover(false) : undefined}
      >
        {floatingHeader && (headline || controls || headerRight || expandable) && (
          <div style={{ position: "absolute", top: 10, right: 12, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {headline && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span
                    style={{
                      fontSize: hover ? 18 : 31, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1,
                      color: t.text.primary, transition: "font-size 0.25s cubic-bezier(.4,0,.2,1)",
                    }}
                  >
                    {headline.value}
                  </span>
                  {headline.change != null && (
                    <span
                      style={{
                        fontSize: hover ? 10 : 12, fontWeight: 700,
                        color: headline.change >= 0 ? "#10B981" : "#f43f5e",
                        transition: "font-size 0.25s ease",
                      }}
                    >
                      {headline.change >= 0 ? "+" : ""}{headline.change}%
                    </span>
                  )}
                </div>
              )}
              {(controls || headerRight || expandable) && (
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 8, overflow: "hidden",
                    opacity: hover ? 1 : 0, maxWidth: hover ? 200 : 0,
                    pointerEvents: hover ? "auto" : "none",
                    transition: "opacity 0.2s ease, max-width 0.25s cubic-bezier(.4,0,.2,1)",
                  }}
                >
                  {floatingControlsCluster}
                </div>
              )}
            </div>
            {/* optional supplementary line under the value — e.g. a legend
                for a 2-series comparison — stays put, doesn't shrink with
                the number since it's secondary to it either way. */}
            {headline?.legend && <div style={{ display: "flex", alignItems: "center", maxWidth: "min(60vw, 480px)" }}>{headline.legend}</div>}
          </div>
        )}
        {Header}
        {!compactHeadline && !floatingHeader && Headline}
        <div
          className={`cc-body ${fluid ? "cc-fluid" : ""}`}
          style={{
            flex: 1,
            minHeight: 0,
            ["--cc-h"]: `${bodyH}px`,
            borderRadius: 12,
          }}
        >
          {renderBody(false)}
        </div>
        {footer}

        {expanded && createPortal(
          <div
            onClick={() => setExpanded(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,6,23,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "min(1040px, 96vw)", maxHeight: "92vh", overflow: "auto", background: t.mode === "light" ? "#ffffff" : "#1a1f2e", color: t.text.primary, border: `1px solid ${t.border}`, borderRadius: radius != null ? radius : Math.max(t.radius, 20), boxShadow: "0 40px 90px -30px rgba(0,0,0,0.55)", padding: 28 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
                  <div style={SUBTITLE_STYLE(t)}>Detailed view</div>
                </div>
                <Pill theme={t} iconOnly ariaLabel="Close" onClick={() => setExpanded(false)}>
                  <X size={ICON_SIZE} />
                </Pill>
              </div>
              {Headline}
              <div className="cc-modal-body">{renderBody(true)}</div>
              {footerDetailed ?? footer}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
);
ChartCard.displayName = "ChartCard";
