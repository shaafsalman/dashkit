import { Children, createContext, useCallback, useContext, useEffect, useId, useInsertionEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import {
  Activity, ArrowLeft, ArrowUpRight, Blocks, Boxes, ChevronRight, Compass, Droplets, Eye, EyeOff, Focus, Layers, Minus, MoreHorizontal, Palette, Plus,
  RotateCcw, ScanLine, Scissors, Search, Shapes, Shrink,
} from "lucide-react";
import { capabilitiesOf, layerPlan, layersOf } from "./model.js";
import { BLOOD, PALETTES, paletteOf } from "./palettes.js";
import { segmentColors } from "./segments.js";

// One model from the library: real 3D, each anatomical part its own piece. Click a part and its group breaks apart, the rest turns
// to frosted glass, and the panel gives that part's detail. It can be seen as anatomy, as an X-ray of its vessels, as a coloured
// segmentation, or with blood and air moving through it, peeled layer by layer, and cut like a scan. It takes its colours from the
// text colour around it, so it sits in any app, in any theme, and fills whatever box it is given.
//
//   <Organ name="heart" baseUrl="/organs" />
//   <Organ name="heart" annotations={[{ part: "left_ventricle", label: "Heart rate", value: "72 bpm", tone: "ok" }]} />
//   <Organ name="lungs" decorative palette="ocean" />
//
// Nothing here knows which model it is showing: every control reads only the manifest, and one with nothing to act on stays out of
// the way without moving its neighbours. For custom layouts, compose the same pieces, or use useOrgan() and draw your own:
//
//   <Organ.Provider name="kidney">
//     <Organ.Stage />
//     <Organ.Bar><Organ.Views /></Organ.Bar>
//     <Organ.Layers />
//     <Organ.Panel />
//   </Organ.Provider>
//
// baseUrl is where assets/organs is served from. three loads only when the stage comes near the screen.

const CSS = `
.dk-organ{position:relative;width:100%;height:100%;min-height:22rem;color:inherit;font:inherit;container:dk-organ/inline-size}
.dk-organ-scope{display:contents}
.dk-organ *,.dk-organ-scope *{box-sizing:border-box}
.dk-organ-scope button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.dk-organ-scope button:focus-visible{outline:2px solid var(--dk-ink,currentColor);outline-offset:1px}
.dk-organ-wrap{display:grid;grid-template-columns:minmax(0,1fr) clamp(15rem,27%,20rem);grid-template-rows:minmax(0,1fr);gap:.75rem;width:100%;height:100%;min-height:0}
.dk-organ-wrap[data-panel=false]{grid-template-columns:minmax(0,1fr)}
.dk-organ-stage{position:relative;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:.5rem;min-width:0;min-height:0;container:dk-stage/size}
.dk-organ[data-decorative=true] .dk-organ-stage{display:block}
.dk-organ-view{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;touch-action:pan-y;transition:color 1ms}
.dk-organ-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;opacity:0;transition:opacity .35s}
.dk-organ-view canvas:active{cursor:grabbing}
.dk-organ-view[data-ready=true] canvas{opacity:1}
.dk-organ-view[data-decorative=true] canvas{pointer-events:none;cursor:default}
.dk-organ-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;transition:opacity .35s}
.dk-organ-view[data-ready=true] .dk-organ-poster{opacity:0}
.dk-organ-marks{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.dk-organ-pin{position:absolute;left:0;top:0;width:32px;height:32px;margin:-16px 0 0 -16px;padding:0;display:grid;place-items:center;border-radius:50%;pointer-events:auto;opacity:0;transition:opacity .2s;will-change:transform}
.dk-organ-pin i{position:absolute;inset:4px;border-radius:50%;background:rgb(255 255 255/.22);border:1px solid rgb(255 255 255/.75);transition:transform .18s}
.dk-organ-pin i::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1px solid rgb(255 255 255/.7);animation:dk-organ-ping 2.6s ease-out infinite;animation-delay:var(--d,0s)}
.dk-organ-pin b{position:relative;width:8px;height:8px;border-radius:50%;background:#fff}
.dk-organ-pin:hover i{transform:scale(1.25)}
@keyframes dk-organ-ping{0%{transform:scale(.7);opacity:.75}70%,100%{transform:scale(1.55);opacity:0}}
.dk-organ-mark{position:absolute;inset:0;transition:opacity .25s;opacity:0}
.dk-organ-mark>*{position:absolute;left:0;top:0;will-change:transform}
.dk-organ-lead{height:1px;width:1px;transform-origin:0 50%;background:var(--c,currentColor);opacity:.65}
.dk-organ-dot{width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;border:1.5px solid var(--c,currentColor);background:color-mix(in srgb,var(--c,currentColor) 30%,transparent)}
.dk-organ-gate{display:inline-flex;align-items:center;gap:.375rem;padding:.25rem .5rem;border-radius:.5rem;font-size:.75rem;font-weight:600;white-space:nowrap;background:var(--dk-surf);border:1px solid color-mix(in srgb,var(--c) 55%,transparent)}
.dk-organ-gate b{font-weight:700;color:var(--c)}
.dk-organ-arrows{display:grid;place-items:center;width:44px;height:14px;margin:-7px 0 0 -22px;color:var(--c)}
.dk-organ-arrows svg{grid-area:1/1;animation:dk-organ-run 1.15s linear infinite;animation-delay:calc(var(--i)*-.38s);opacity:0}
@keyframes dk-organ-run{0%{transform:translateX(-18px);opacity:0}25%{opacity:1}75%{opacity:1}100%{transform:translateX(18px);opacity:0}}
.dk-organ-card{display:grid;gap:.0625rem;min-width:7.5rem;padding:.5rem .75rem;border-radius:.625rem;background:color-mix(in srgb,var(--dk-surf) 76%,transparent);backdrop-filter:blur(14px) saturate(150%);border:1px solid color-mix(in srgb,var(--dk-ink) 16%,transparent);pointer-events:auto}
.dk-organ-card small{display:flex;align-items:center;gap:.375rem;font-size:.6875rem;font-weight:550;opacity:.75;white-space:nowrap}
.dk-organ-card small i{width:.4375rem;height:.4375rem;border-radius:50%;background:var(--c)}
.dk-organ-card strong{font-size:1.375rem;line-height:1.1;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
.dk-organ-card em{font-style:normal;font-size:.6875rem;opacity:.65;white-space:nowrap}
.dk-organ-tag{position:absolute;left:0;top:0;padding:.25rem .5rem;border-radius:.375rem;font-size:.75rem;font-weight:550;white-space:nowrap;pointer-events:none;background:var(--dk-surf);border:1px solid color-mix(in srgb,var(--dk-ink) 20%,transparent)}
.dk-organ-bar{position:relative;justify-self:center;display:flex;flex-wrap:nowrap;align-items:center;gap:.125rem;max-width:100%;padding:.25rem;border-radius:.625rem;white-space:nowrap;background:var(--dk-surf);border:1px solid color-mix(in srgb,var(--dk-ink) 14%,transparent)}
.dk-organ-group{display:flex;flex:none;align-items:center;gap:.125rem}
.dk-organ-btn{position:relative;display:inline-flex;flex:none;align-items:center;justify-content:center;gap:.375rem;height:2rem;min-width:2rem;padding:0 .5rem;border-radius:.4375rem;font-size:.8125rem;font-weight:550;white-space:nowrap;transition:background .15s,color .15s}
.dk-organ-btn:hover{background:color-mix(in srgb,var(--dk-ink) 10%,transparent)}
.dk-organ-btn[data-on=true]{color:var(--dk-surf)}
.dk-organ-btn[data-on=true]:hover{background:none}
.dk-organ-btn[data-gone=true]{visibility:hidden}
.dk-organ-btn>svg,.dk-organ-btn>span{position:relative;z-index:1}
.dk-organ-press{position:absolute;inset:0;border-radius:inherit;background:var(--dk-ink)}
.dk-organ-sep{flex:none;width:1px;height:1.125rem;margin:0 .25rem;background:color-mix(in srgb,var(--dk-ink) 18%,transparent)}
.dk-organ-more{display:none}
.dk-organ-pop{position:absolute;left:50%;bottom:calc(100% + .375rem);z-index:5;width:min(21rem,calc(100cqw - .75rem));max-height:calc(100cqh - 3.75rem);overflow:auto;padding:.625rem;border-radius:.625rem;background:var(--dk-surf);border:1px solid color-mix(in srgb,var(--dk-ink) 16%,transparent);transform:translateX(-50%);animation:dk-organ-pop .18s ease-out;white-space:normal}
@keyframes dk-organ-pop{from{opacity:0;transform:translateX(-50%) translateY(6px)}}
.dk-organ-pop h4{margin:0 0 .5rem;font-size:.75rem;font-weight:650;letter-spacing:.01em;opacity:.7}
.dk-organ-row{display:flex;width:100%;align-items:center;gap:.5rem;min-height:2rem;padding:.25rem .375rem;border-radius:.4375rem;font-size:.8125rem;text-align:left;white-space:nowrap}
button.dk-organ-row:hover{background:color-mix(in srgb,var(--dk-ink) 8%,transparent)}
.dk-organ-row[aria-current=true],.dk-organ-row[aria-pressed=true]{background:color-mix(in srgb,var(--dk-ink) 12%,transparent);font-weight:600}
.dk-organ-row small{margin-left:auto;font-size:.75rem;opacity:.6}
.dk-organ-swatch{display:inline-flex;flex:none;width:2.25rem;height:.875rem;border-radius:.25rem;overflow:hidden;border:1px solid color-mix(in srgb,var(--dk-ink) 18%,transparent)}
.dk-organ-swatch i{flex:1}
.dk-organ-seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:.125rem;padding:.125rem;border-radius:.4375rem;background:color-mix(in srgb,var(--dk-ink) 7%,transparent)}
.dk-organ-seg button{height:1.75rem;border-radius:.3125rem;font-size:.75rem;font-weight:550;white-space:nowrap}
.dk-organ-seg button[aria-pressed=true]{background:var(--dk-ink);color:var(--dk-surf)}
.dk-organ-slider{width:100%;accent-color:var(--dk-ink);margin:.5rem 0 .25rem}
.dk-organ-slice{display:grid;grid-template-columns:auto minmax(4rem,1fr) auto;align-items:center;gap:.5rem}
.dk-organ-slice .dk-organ-slider{margin:0}
.dk-organ-pop[data-wide=true]{width:min(32rem,calc(100cqw - .75rem));padding:.375rem}
.dk-organ-peel{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:.375rem;margin-bottom:.5rem}
.dk-organ-peel .dk-organ-slider{margin:0}
.dk-organ-peel output{font-size:.75rem;font-variant-numeric:tabular-nums;opacity:.75;min-width:2rem;text-align:center}
.dk-organ-eye{flex:none;display:grid;place-items:center;width:1.625rem;height:1.625rem;border-radius:.3125rem}
.dk-organ-eye:hover{background:color-mix(in srgb,var(--dk-ink) 10%,transparent)}
.dk-organ-layer{display:flex;align-items:center;gap:.375rem;padding:.1875rem .25rem;border-radius:.4375rem;font-size:.8125rem}
.dk-organ-layer[data-off=true]{opacity:.5}
.dk-organ-layer span{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dk-organ-layer small{font-size:.75rem;opacity:.6}
.dk-organ-panel{display:flex;flex-direction:column;gap:.875rem;min-height:0;min-width:0;overflow-y:auto;padding:1rem;border-radius:.75rem;background:var(--dk-surf);border:1px solid color-mix(in srgb,var(--dk-ink) 10%,transparent)}
.dk-organ-crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:.125rem;font-size:.75rem;opacity:.75}
.dk-organ-crumbs button{padding:.125rem .25rem;border-radius:.375rem}
.dk-organ-crumbs button:hover{background:color-mix(in srgb,var(--dk-ink) 10%,transparent)}
.dk-organ-title{margin:0;font-size:1.5rem;line-height:1.1;font-weight:680;letter-spacing:-.02em}
.dk-organ-about{margin:0;font-size:.875rem;line-height:1.5;opacity:.82}
.dk-organ-measure{display:grid;gap:.0625rem}
.dk-organ-measure small{font-size:.75rem;opacity:.7}
.dk-organ-measure strong{font-size:1.75rem;line-height:1.1;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.dk-organ-actions{display:flex;flex-wrap:wrap;gap:.375rem}
.dk-organ-action{display:inline-flex;align-items:center;gap:.375rem;height:2rem;padding:0 .625rem;border-radius:.4375rem;font-size:.8125rem;font-weight:600;white-space:nowrap;border:1px solid color-mix(in srgb,var(--dk-ink) 20%,transparent)!important}
.dk-organ-action:hover{background:color-mix(in srgb,var(--dk-ink) 8%,transparent)!important}
.dk-organ-action[data-loud=true]{background:var(--dk-ink)!important;color:var(--dk-surf)!important;border-color:transparent!important}
.dk-organ-search{display:flex;align-items:center;gap:.375rem;height:2rem;padding:0 .5rem;border-radius:.4375rem;border:1px solid color-mix(in srgb,var(--dk-ink) 16%,transparent);font-size:.8125rem}
.dk-organ-search input{flex:1;min-width:0;font:inherit;color:inherit;background:none;border:0;outline:0}
.dk-organ-list{display:grid;gap:.0625rem;margin:0;padding:0;list-style:none}
.dk-organ-list>li{animation:dk-organ-rise .22s ease-out both;animation-delay:calc(var(--i,0)*16ms)}
@keyframes dk-organ-rise{from{opacity:0;transform:translateY(5px)}}
.dk-organ-list .dk-organ-row{white-space:normal}
.dk-organ-list span.dk-organ-name{min-width:0}
.dk-organ-chip{flex:none;width:.75rem;height:.75rem;border-radius:.1875rem;border:1px solid rgb(127 127 127/.35)}
.dk-organ-chips{display:inline-flex;flex:none}
.dk-organ-chips .dk-organ-chip{margin-left:-.25rem}
.dk-organ-chips .dk-organ-chip:first-child{margin-left:0}
.dk-organ-legend{display:grid;gap:.375rem;font-size:.8125rem}
.dk-organ-legend>span{display:flex;align-items:center;gap:.5rem}
.dk-organ-field{display:grid;gap:.125rem;font-size:.75rem}
.dk-organ-field label{display:flex;justify-content:space-between;opacity:.8}
.dk-organ-credit{margin:auto 0 0;padding-top:.5rem;font-size:.6875rem;line-height:1.4;opacity:.6}
.dk-organ-failed{position:absolute;left:1rem;top:1rem;font-size:.75rem;opacity:.7}
.dk-organ-detail{position:absolute;inset:0;z-index:6;background:var(--dk-page,transparent)}
.dk-organ-wrap{transition:opacity .3s}
.dk-organ[data-covered=true]>.dk-organ-wrap{opacity:0;pointer-events:none}
@container dk-organ (max-width:48rem){
  .dk-organ-wrap,.dk-organ-wrap[data-panel=true]{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1.3fr) minmax(0,1fr)}
  .dk-organ-wrap[data-panel=false]{grid-template-rows:minmax(0,1fr)}
}
@container dk-stage (max-width:60rem){.dk-organ-tool span{display:none}.dk-organ-tool{padding:0}}
@container dk-stage (max-width:42rem){.dk-organ-view-btn span{display:none}.dk-organ-view-btn{padding:0}}
@container dk-stage (max-width:30rem){
  .dk-organ-slice{grid-template-columns:minmax(0,1fr) auto}
  .dk-organ-slice .dk-organ-seg{grid-column:1/-1}
  .dk-organ-spill{display:none}
  .dk-organ-more{display:inline-flex}
  .dk-organ-btn{min-width:1.875rem}
  .dk-organ-sep{margin:0 .125rem}
}
@media (prefers-reduced-motion:reduce){
  .dk-organ-pin i::after,.dk-organ-arrows svg{animation:none}
  .dk-organ-arrows svg:first-child{opacity:1}
  .dk-organ-pop,.dk-organ-list>li{animation:none}
}
`;

const manifests = new Map();
const manifestOf = (base, name) => {
  const url = `${base}/${name}/manifest.json`;
  if (!manifests.has(url)) {
    const load = fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${url}: ${r.status}`))));
    // A failed fetch must not stick: the model may simply not have been built yet.
    load.catch(() => manifests.delete(url));
    manifests.set(url, load);
  }
  return manifests.get(url);
};
const isStill = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const VIEWS = [
  { id: "anatomy", label: "Anatomy", icon: Shapes },
  { id: "xray", label: "X-ray", icon: ScanLine },
  { id: "segments", label: "Segments", icon: Blocks },
  { id: "flow", label: "Flow", icon: Droplets, needs: "flows" },
];
const SIDES = [["front", "Front"], ["back", "Back"], ["left", "Left"], ["right", "Right"], ["top", "Top"]];
const CARRIED = { artery: [BLOOD.artery, "Oxygen-rich blood"], vein: [BLOOD.vein, "Oxygen-poor blood"], air: [BLOOD.air, "Air"] };
const TONES = { ok: "#16a34a", good: "#16a34a", info: "#2563eb", warn: "#d97706", alert: "#dc2626", bad: "#dc2626" };
const EMPTY = new Set();

const Ctx = createContext(null);

/** Everything the model's controls can read or do. Use it to build your own controls, or to run the stage headless. */
export function useOrgan() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOrgan must be used inside <Organ> or <Organ.Provider>");
  return c;
}

function useControlled(value, initial, onChange) {
  const [inner, setInner] = useState(initial);
  const controlled = value !== undefined;
  const now = controlled ? value : inner;
  const latest = useRef(now);
  latest.current = now;
  const set = useCallback(
    (next) => {
      const v = typeof next === "function" ? next(latest.current) : next;
      if (v === latest.current) return;
      if (!controlled) setInner(v);
      onChange?.(v);
    },
    [controlled, onChange],
  );
  return [now, set];
}

export function OrganProvider({
  name,
  baseUrl = "/organs",
  view,
  defaultView = "anatomy",
  onViewChange,
  palette,
  defaultPalette = "natural",
  onPaletteChange,
  peel,
  defaultPeel = 0,
  onPeelChange,
  autoRotate = false,
  defaultPulse = false,
  defaultExploded = false,
  annotations,
  decorative = false,
  onSelect,
  children,
}) {
  useInsertionEffect(() => {
    if (typeof document === "undefined") return;
    let el = document.getElementById("dk-organ-css");
    if (!el) {
      el = document.createElement("style");
      el.id = "dk-organ-css";
      document.head.appendChild(el);
    }
    el.textContent = CSS;
  }, []);

  const scope = useRef(null);
  const stage = useRef(null);
  const trackRef = useRef(null);
  const [canvasEl, attachCanvas] = useState(null);
  const [stageOn, setStageOn] = useState(0);
  const [near, setNear] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [loadedName, setLoadedName] = useState(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selection, setSelection] = useState({ group: null, part: null });
  const [exploded, setExplodedState] = useState(defaultExploded);
  const [mode, setMode] = useControlled(view, defaultView, onViewChange);
  const [paletteId, setPaletteId] = useControlled(palette, defaultPalette, onPaletteChange);
  const [peelCount, setPeelCount] = useControlled(peel, defaultPeel, onPeelChange);
  const [flipped, setFlipped] = useState(EMPTY);
  const [hiddenParts, setHiddenParts] = useState(EMPTY);
  const [isolated, setIsolated] = useState(null);
  const [slice, setSliceState] = useState(null);
  const [segOpacity, setSegOpacity] = useState(1);
  // Still by default (owner, 2026-11-06): the beat and the breath start only when asked for.
  const [pulseOn, setPulseOn] = useState(defaultPulse);
  const [hover, setHover] = useState(null);
  const [menu, setMenu] = useState(null);
  const [zoomed, setZoomed] = useState(1);
  const [detail, setDetail] = useState(null);
  const touched = useRef(false);

  const caps = useMemo(() => capabilitiesOf(manifest), [manifest]);
  const layers = useMemo(() => layersOf(manifest), [manifest]);
  const plan = useMemo(() => layerPlan(layers, peelCount, flipped), [layers, peelCount, flipped]);
  const hiddenNow = useMemo(() => {
    const out = new Set(plan.hidden);
    hiddenParts.forEach((id) => out.add(id));
    if (isolated) (manifest?.parts ?? []).forEach((p) => !isolated.has(p.id) && out.add(p.id));
    return out;
  }, [plan, hiddenParts, isolated, manifest]);

  const touch = useCallback(() => {
    touched.current = true;
    stage.current?.setAutoRotate(false);
  }, []);
  const select = useCallback(
    (next) => {
      touch();
      setSelection((v) => ({ ...v, ...next }));
      if ("group" in next || "part" in next) setExplodedState(false);
    },
    [touch],
  );
  const up = useCallback(() => setSelection((v) => (v.part ? { ...v, part: null } : v.group ? { group: null, part: null } : v)), []);
  const latest = useRef({});
  latest.current = { select, up, autoRotate, hiddenNow, plan, pulseOn };

  useEffect(() => {
    if (!canvasEl) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "300px" });
    io.observe(canvasEl);
    return () => io.disconnect();
  }, [canvasEl]);

  // A new model starts from a clean slate; the controls stay exactly where they are.
  useEffect(() => {
    let live = true;
    setReady(false);
    setFailed(false);
    setSelection({ group: null, part: null });
    setExplodedState(defaultExploded);
    setFlipped(EMPTY);
    setHiddenParts(EMPTY);
    setIsolated(null);
    setSliceState(null);
    setDetail(null);
    setMenu(null);
    setHover(null);
    setPeelCount(defaultPeel);
    setZoomed(1);
    stage.current?.setSlice(null);
    stage.current?.setZoom(1);
    manifestOf(baseUrl, name)
      .then((m) => {
        if (!live) return;
        setManifest(m);
        setLoadedName(name);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, name]);

  useEffect(() => {
    if (!near || !canvasEl) return undefined;
    let live = true;
    let made = null;
    import("./scene.js")
      .then(({ OrganStage: Stage }) => {
        if (!live) return;
        made = new Stage(canvasEl, {
          still: isStill(),
          decorative,
          pulse: latest.current.pulseOn,
          onHover: setHover,
          onPick: (part, group) => latest.current.select({ group, part }),
          onMiss: () => latest.current.up(),
          onReady: () => live && setReady(true),
          onTrack: (list) => trackRef.current?.(list),
        });
        stage.current = made;
        setStageOn((n) => n + 1);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      made?.dispose();
      stage.current = null;
    };
  }, [near, canvasEl, decorative]);

  useEffect(() => {
    const s = stage.current;
    if (!s || !manifest || loadedName !== name) return;
    setReady(false);
    s.setAutoRotate(latest.current.autoRotate && !touched.current);
    s.load(`${baseUrl}/${name}/model.glb`, manifest, { hidden: latest.current.hiddenNow, restGlass: latest.current.plan.restGlass }).catch(() => setFailed(true));
    // The stage takes a model once per name; the other effects keep it in step afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageOn, manifest, loadedName]);

  useEffect(() => {
    if (caps.flows || mode !== "flow" || !manifest) return;
    setMode("anatomy");
  }, [caps.flows, mode, manifest, setMode]);

  useEffect(() => {
    stage.current?.setView({ group: selection.group, part: selection.part, exploded: exploded ? 1 : 0, mode });
    if (manifest) onSelect?.(selection.part ?? selection.group ?? null, { ...selection, exploded, mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, exploded, mode, stageOn, manifest]);
  useEffect(() => stage.current?.setPalette(paletteId), [paletteId, stageOn]);
  useEffect(() => stage.current?.setVisibility(hiddenNow, plan.restGlass), [hiddenNow, plan, stageOn]);
  useEffect(() => stage.current?.setSlice(slice), [slice, stageOn, ready]);
  useEffect(() => stage.current?.setSegOpacity(segOpacity), [segOpacity, stageOn]);
  useEffect(() => stage.current?.setPulse(pulseOn), [pulseOn, stageOn]);
  useEffect(() => stage.current?.setAnnotations(annotations ?? []), [annotations, stageOn, ready]);

  // Colours come from the page's text colour. The stage reports a change through a 1ms colour transition, which also catches a theme
  // set on any ancestor, not only on <html>.
  const readInk = useCallback(() => {
    const el = canvasEl ?? scope.current;
    const host = scope.current;
    if (!el || !host) return;
    const css = getComputedStyle(el).color;
    stage.current?.setInk(css);
    const m = css.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    const lum = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
    host.style.setProperty("--dk-ink", css);
    host.style.setProperty("--dk-surf", lum > 0.5 ? "#14171b" : "#ffffff");
  }, [canvasEl]);
  useEffect(() => readInk(), [readInk, stageOn]);

  useEffect(() => {
    const key = (e) => {
      if (e.key !== "Escape") return;
      if (menu) setMenu(null);
      else if (scope.current?.contains(document.activeElement)) up();
    };
    const outside = (e) => {
      if (menu && !e.target.closest?.(".dk-organ-bar")) setMenu(null);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
    };
  }, [up, menu]);

  const api = useMemo(() => {
    const parts = manifest?.parts ?? [];
    const group = manifest?.groups?.find((g) => g.id === selection.group) ?? null;
    const part = parts.find((p) => p.id === selection.part) ?? null;
    const setPeel = (n) => {
      setFlipped(EMPTY);
      setPeelCount(Math.max(0, Math.min(plan.maxPeel, typeof n === "function" ? n(peelCount) : n)));
    };
    return {
      // What it is showing
      name, baseUrl, manifest, ready, failed, decorative, caps, annotations,
      // Views and colour
      mode, setMode: (m) => { touch(); setMode(m); if (m === "flow") { setSelection({ group: null, part: null }); setExplodedState(false); } },
      views: VIEWS.map((v) => ({ ...v, available: !v.needs || !!caps[v.needs] })),
      palette: paletteId, setPalette: setPaletteId, palettes: PALETTES,
      // Selection
      group, part, select, up, parts,
      exploded, setExploded: (on) => { touch(); setSelection({ group: null, part: null }); setExplodedState(on); },
      // Layers
      layers: plan.states, peel: peelCount, maxPeel: plan.maxPeel, setPeel,
      toggleLayer: (id) => setFlipped((f) => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); return n; }),
      hiddenParts, hiddenNow,
      togglePart: (id) => setHiddenParts((h) => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n; }),
      toggleGroup: (id) => setHiddenParts((h) => {
        const ids = parts.filter((p) => p.group === id).map((p) => p.id);
        const n = new Set(h);
        const showing = ids.some((x) => !n.has(x));
        ids.forEach((x) => (showing ? n.add(x) : n.delete(x)));
        return n;
      }),
      isolated, isolate: (ids) => setIsolated(ids ? new Set(ids) : null),
      // Slice and segments
      slice, setSlice: (s) => { setSliceState(s); },
      segOpacity, setSegOpacity,
      // Camera
      zoomBy: (f) => { touch(); setZoomed(stage.current?.zoomBy(f) ?? 1); },
      lookFrom: (side) => { touch(); stage.current?.lookFrom(side); },
      pulseOn, setPulseOn,
      zoomed,
      reset: () => {
        setZoomed(1);
        stage.current?.setZoom(1);
        setSliceState(null);
        setMenu(null);
        setSelection({ group: null, part: null });
        setExplodedState(false);
        setFlipped(EMPTY);
        setPeelCount(0);
        setHiddenParts(EMPTY);
        setIsolated(null);
      },
      // Whole-body linking
      detail,
      openOrgan: async (p) => {
        await stage.current?.flyInto(p.id);
        setDetail({ name: p.organ, from: p.id });
        stage.current?.setPaused(true);
      },
      closeOrgan: () => {
        setDetail(null);
        stage.current?.flyBack();
      },
      // Bits the ready-made pieces share
      menu, setMenu, hover, attachCanvas, trackRef, readInk, stage,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, baseUrl, manifest, ready, failed, decorative, caps, annotations, mode, paletteId, selection, exploded, plan, peelCount, hiddenParts, hiddenNow, isolated, slice, segOpacity, pulseOn, zoomed, detail, menu, hover]);

  return (
    <Ctx.Provider value={api}>
      <MotionConfig reducedMotion="user">
        <div ref={scope} className="dk-organ-scope">
          {children}
        </div>
      </MotionConfig>
    </Ctx.Provider>
  );
}

// ---- The stage -----------------------------------------------------------------------------------------------------------

/** The canvas and everything tracked to it: pins, gates, annotation cards. Give it a sized box. */
export function OrganStageView({ pins = true, className, style, children }) {
  const o = useOrgan();
  const { manifest, name, baseUrl } = o;
  return (
    <div className={`dk-organ-view${className ? ` ${className}` : ""}`} style={style} data-ready={o.ready} data-decorative={o.decorative} onTransitionEnd={(e) => e.propertyName === "color" && e.target === e.currentTarget && o.readInk()}>
      {!o.decorative && <img key={name} className="dk-organ-poster" src={`${baseUrl}/${name}/poster.webp`} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = "none")} />}
      <canvas ref={o.attachCanvas} role="img" aria-label={manifest ? `${manifest.title}, drag to turn, click a part to break it down` : "3D model"} />
      <Marks pins={pins} />
      {o.hover && !o.decorative && <span className="dk-organ-tag" style={{ transform: `translate(calc(${o.hover.x}px - 50%), ${o.hover.y - 36}px)` }}>{o.hover.label}</span>}
      {o.failed && <span className="dk-organ-failed">The 3D view could not load.</span>}
      {children}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="9" height="12" viewBox="0 0 9 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 1.5 7 6l-5 4.5" />
    </svg>
  );
}

function Marks({ pins }) {
  const o = useOrgan();
  const { manifest, ready, mode, slice, annotations, decorative, caps, group, exploded, trackRef, select } = o;
  const els = useRef(new Map());
  const memo = useRef(new Map());
  const overview = !group && !exploded;
  const showPins = pins && !decorative && ready && overview && mode === "anatomy" && !slice && caps.pins;
  // Gates belong to the flow view, where they say what is going in and out; elsewhere they would only cover the organ.
  const showGates = !decorative && ready && overview && !slice && caps.gates && mode === "flow";
  const showNotes = ready && overview && (annotations?.length ?? 0) > 0;
  const anything = showPins || showGates || showNotes;
  useEffect(() => o.stage.current?.setTracking(anything), [o.stage, anything, ready]);

  useEffect(() => {
    trackRef.current = (list) => {
      const labels = [];
      for (const t of list) {
        const el = els.current.get(t.key);
        if (!el) continue;
        const inside = t.x >= 6 && t.y >= 6 && t.x <= t.w - 6 && t.y <= t.h - 6;
        if (el.dataset.kind === "pin") {
          el.style.transform = `translate(${t.x}px, ${t.y}px)`;
          el.style.opacity = t.seen && inside ? 1 : 0;
          el.style.pointerEvents = t.seen && inside ? "auto" : "none";
          continue;
        }
        labels.push({ t, el });
      }
      // Cards and gate labels sit outside the figure on its nearer side, stacked so they never cover each other.
      const sides = { "-1": [], 1: [] };
      for (const item of labels) {
        const { t, el } = item;
        const m = memo.current.get(t.key) ?? { side: t.x < t.w / 2 ? -1 : 1, y: t.y, cw: 0, ch: 0, age: 0 };
        memo.current.set(t.key, m);
        if (t.x < t.w * 0.42) m.side = -1;
        else if (t.x > t.w * 0.58) m.side = 1;
        const card = el.querySelector("[data-card]");
        if (!m.cw || m.age++ % 45 === 0) {
          m.cw = card.offsetWidth;
          m.ch = card.offsetHeight;
        }
        item.m = m;
        item.card = card;
        sides[m.side].push(item);
      }
      for (const key of Object.keys(sides)) {
        const col = sides[key].sort((a, b) => a.t.y - b.t.y);
        let bottom = 6;
        for (const item of col) {
          item.top = Math.max(bottom, item.t.y - item.m.ch / 2);
          bottom = item.top + item.m.ch + 6;
        }
        const h = col[0]?.t.h ?? 0;
        let limit = h - 6;
        for (let i = col.length - 1; i >= 0; i--) {
          col[i].top = Math.min(col[i].top, limit - col[i].m.ch);
          limit = col[i].top - 6;
        }
      }
      for (const { t, el, m, card, top } of labels) {
        const gap = el.dataset.kind === "note" ? 56 : 34;
        // Beside the figure when there is room, not on top of it.
        const out = m.side < 0 ? Math.min(t.x - gap - m.cw, t.figL - 10 - m.cw) : Math.max(t.x + gap, t.figR + 10);
        const left = Math.max(6, Math.min(t.w - m.cw - 6, out));
        m.y += (top - m.y) * 0.22;
        card.style.transform = `translate(${left}px, ${m.y}px)`;
        const ax = m.side < 0 ? left + m.cw : left;
        const ay = m.y + m.ch / 2;
        const dx = ax - t.x;
        const dy = ay - t.y;
        const lead = el.querySelector("[data-lead]");
        lead.style.transform = m.cw ? `translate(${t.x}px, ${t.y}px) rotate(${Math.atan2(dy, dx)}rad) scaleX(${Math.hypot(dx, dy)})` : "scaleX(0)";
        el.querySelector("[data-dot]").style.transform = `translate(${t.x}px, ${t.y}px)`;
        const arrows = el.querySelector("[data-arrows]");
        if (arrows) arrows.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${Math.atan2(t.dy, t.dx)}rad)`;
        el.style.opacity = t.seen && inside01(t) ? 1 : 0;
      }
    };
    return () => {
      trackRef.current = null;
    };
  }, [trackRef]);

  const set = (key) => (el) => (el ? els.current.set(key, el) : els.current.delete(key));
  return (
    <div className="dk-organ-marks">
      {showPins &&
        manifest.pins.map((p, i) => {
          const info = manifest.parts.find((x) => x.id === p.part);
          if (!info) return null;
          return (
            <button key={p.part} type="button" data-kind="pin" className="dk-organ-pin" aria-label={info.label} title={info.label} style={{ "--d": `${i * 0.4}s` }} ref={set(p.part)} onClick={() => select({ group: info.group, part: p.part })}>
              <i />
              <b />
            </button>
          );
        })}
      {showGates &&
        manifest.gates.map((g, i) => {
          const c = BLOOD[g.kind] ?? BLOOD.artery;
          const label = String(g.label ?? "").replace(/^(in|out)\s*[·:-]\s*/i, "");
          const repeat = manifest.gates.findIndex((x) => x.label === g.label && x.io === g.io) !== i;
          return (
            <div key={i} data-kind="gate" className="dk-organ-mark" style={{ "--c": c }} ref={set(`gate-${i}`)}>
              <i data-lead className="dk-organ-lead" />
              <i data-dot className="dk-organ-dot" />
              <div data-arrows className="dk-organ-arrows">
                {[0, 1, 2].map((n) => (
                  <span key={n} style={{ display: "contents", "--i": n }}>
                    <Chevron />
                  </span>
                ))}
              </div>
              <div data-card className="dk-organ-gate" style={repeat ? { display: "none" } : undefined}>
                <b>{g.io === "out" ? "Out" : "In"}</b>
                {label}
              </div>
            </div>
          );
        })}
      {showNotes &&
        annotations.map((n, i) => {
          const c = TONES[n.tone] ?? n.tone ?? "currentColor";
          return (
            <div key={n.key ?? i} data-kind="note" className="dk-organ-mark" style={{ "--c": c }} ref={set(n.key ?? `note-${i}`)}>
              <i data-lead className="dk-organ-lead" />
              <i data-dot className="dk-organ-dot" />
              <div data-card className="dk-organ-card">
                <small>
                  <i />
                  {n.label}
                </small>
                <strong>{n.value}</strong>
                {n.sub && <em>{n.sub}</em>}
              </div>
            </div>
          );
        })}
    </div>
  );
}
const inside01 = (t) => t.x >= 0 && t.y >= 0 && t.x <= t.w && t.y <= t.h;

// ---- The one control bar --------------------------------------------------------------------------------------------------

function BarButton({ icon: Icon, label, on, gone, tip, onClick, kind = "tool", className, press, ...rest }) {
  return (
    <button type="button" className={`dk-organ-btn dk-organ-${kind}${className ? ` ${className}` : ""}`} title={tip ?? label} aria-label={tip ?? label} data-on={!!on} data-gone={!!gone} onClick={onClick} tabIndex={gone ? -1 : undefined} {...rest}>
      {on && (press ? <motion.i layoutId={press} className="dk-organ-press" transition={{ type: "spring", stiffness: 520, damping: 40 }} /> : <i className="dk-organ-press" />)}
      <Icon size={15} aria-hidden />
      {label && <span>{label}</span>}
    </button>
  );
}

/** Anatomy, X-ray, Segments, Flow. A view the model cannot do keeps its slot empty, so that nothing else moves. */
export function OrganViews({ className }) {
  const o = useOrgan();
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <div className={`dk-organ-group${className ? ` ${className}` : ""}`} role="tablist" aria-label="Views">
        {o.views.map((v) => (
          <BarButton key={v.id} kind="view-btn" icon={v.icon} label={v.label} role="tab" aria-selected={o.mode === v.id} on={o.mode === v.id} press={`${id}-view`} gone={!v.available} onClick={() => o.setMode(v.id)} />
        ))}
      </div>
    </LayoutGroup>
  );
}

const menuProps = (o, id) => ({ "aria-haspopup": "dialog", "aria-expanded": o.menu === id, on: o.menu === id, onClick: () => o.setMenu(o.menu === id ? null : id) });

/** Layers, Break apart, Slice, colour, pulse, zoom, reset, View from. Everything that opens, opens from here. */
export function OrganTools({ className }) {
  const o = useOrgan();
  return (
    <>
      <div className={`dk-organ-group${className ? ` ${className}` : ""}`}>
        <BarButton icon={Layers} label="Layers" gone={!o.caps.layers} {...menuProps(o, "layers")} />
        <BarButton icon={o.exploded ? Shrink : Boxes} label={o.exploded ? "Assemble" : "Break apart"} aria-pressed={!!o.exploded} on={o.exploded} onClick={() => o.setExploded(!o.exploded)} />
        <BarButton icon={Scissors} label="Slice" {...menuProps(o, "slice")} on={o.menu === "slice" || !!o.slice} onClick={() => { if (!o.slice) o.setSlice({ axis: "axial", at: 0.1 }); o.setMenu(o.menu === "slice" ? null : "slice"); }} />
        <BarButton icon={Palette} label="Colour" {...menuProps(o, "palette")} />
        <BarButton icon={Activity} label="Pulse" tip={o.pulseOn ? "Stop the pulse" : "Play the pulse"} gone={!o.caps.pulse} aria-pressed={o.pulseOn} on={o.pulseOn} onClick={() => o.setPulseOn(!o.pulseOn)} />
        <BarButton className="dk-organ-spill" icon={Plus} tip="Zoom in" onClick={() => o.zoomBy(1.3)} />
        <BarButton className="dk-organ-spill" icon={Minus} tip="Zoom out" onClick={() => o.zoomBy(1 / 1.3)} />
        <BarButton className="dk-organ-spill" icon={RotateCcw} tip="Back to the whole model" onClick={o.reset} />
      </div>
      <i className="dk-organ-sep dk-organ-spill" />
      <BarButton className="dk-organ-spill" icon={Compass} label="View from" tip="View from" {...menuProps(o, "from")} />
      <BarButton className="dk-organ-more" icon={MoreHorizontal} tip="More" {...menuProps(o, "more")} />
    </>
  );
}

function Sides() {
  const o = useOrgan();
  return (
    <div className="dk-organ-seg">
      {SIDES.map(([id, label]) => (
        <button key={id} type="button" onClick={() => o.lookFrom(id)}>{label}</button>
      ))}
    </div>
  );
}

function Popovers() {
  const o = useOrgan();
  if (!o.menu) return null;
  return (
    <div className="dk-organ-pop" role="dialog" aria-label={o.menu} data-wide={o.menu === "slice"}>
      {o.menu === "layers" && <OrganLayers />}
      {o.menu === "palette" && <ColourMenu />}
      {o.menu === "slice" && <SliceMenu />}
      {o.menu === "from" && (
        <>
          <h4>View from</h4>
          <Sides />
        </>
      )}
      {o.menu === "more" && (
        <>
          <h4>View from</h4>
          <Sides />
          <div style={{ display: "flex", gap: ".25rem", marginTop: ".5rem" }}>
            <button type="button" className="dk-organ-action" onClick={() => o.zoomBy(1.3)}><Plus size={14} aria-hidden />Zoom in</button>
            <button type="button" className="dk-organ-action" onClick={() => o.zoomBy(1 / 1.3)}><Minus size={14} aria-hidden />Out</button>
            <button type="button" className="dk-organ-action" onClick={o.reset}><RotateCcw size={14} aria-hidden />Reset</button>
          </div>
          {o.caps.pulse && (
            <button type="button" className="dk-organ-action" style={{ marginTop: ".25rem" }} onClick={() => o.setPulseOn(!o.pulseOn)}>
              <Activity size={14} aria-hidden />
              {o.pulseOn ? "Stop the pulse" : "Play the pulse"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ColourMenu() {
  const o = useOrgan();
  return (
    <>
      <h4>Colour</h4>
      <div style={{ display: "grid", gap: ".0625rem" }}>
        {o.palettes.map((p) => (
          <button key={p.id} type="button" className="dk-organ-row" aria-pressed={o.palette === p.id} onClick={() => o.setPalette(p.id)}>
            <span className="dk-organ-swatch" aria-hidden>
              {p.swatch.map((c) => <i key={c} style={{ background: c }} />)}
            </span>
            {p.label}
          </button>
        ))}
      </div>
    </>
  );
}

function SliceMenu() {
  const o = useOrgan();
  const s = o.slice ?? { axis: "axial", at: 0.1 };
  return (
    <div className="dk-organ-slice">
      <div className="dk-organ-seg" role="group" aria-label="Slice plane">
        {[["axial", "Axial"], ["coronal", "Coronal"], ["sagittal", "Sagittal"]].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={s.axis === id} onClick={() => o.setSlice({ ...s, axis: id })}>{label}</button>
        ))}
      </div>
      <input className="dk-organ-slider" type="range" min={-1} max={1} step={0.005} value={s.at} aria-label="Slice position" onChange={(e) => o.setSlice({ ...s, at: Number(e.target.value) })} />
      <button type="button" className="dk-organ-action" onClick={() => { o.setSlice(null); o.setMenu(null); }}>Close</button>
    </div>
  );
}

/** The layers, outermost first. Peel takes the next one away; each eye hides or shows that layer alone. */
export function OrganLayers({ className }) {
  const o = useOrgan();
  if (!o.caps.layers) return null;
  const showing = o.layers.filter((l) => l.visible).length;
  return (
    <div className={className}>
      <h4>Layers · {showing} of {o.layers.length} showing</h4>
      <div className="dk-organ-peel">
        <button type="button" className="dk-organ-eye" aria-label="Put the last layer back" title="Put the last layer back" disabled={o.peel === 0} onClick={() => o.setPeel(o.peel - 1)}><Minus size={14} /></button>
        <input className="dk-organ-slider" type="range" min={0} max={o.maxPeel} step={1} value={o.peel} aria-label="Peel" onChange={(e) => o.setPeel(Number(e.target.value))} />
        <button type="button" className="dk-organ-eye" aria-label="Peel the next layer" title="Peel the next layer" disabled={o.peel >= o.maxPeel} onClick={() => o.setPeel(o.peel + 1)}><Plus size={14} /></button>
        <output>{o.peel}/{o.maxPeel}</output>
      </div>
      <div style={{ display: "grid", gap: ".0625rem" }}>
        {o.layers.map((l) => (
          <div key={l.id} className="dk-organ-layer" data-off={!l.visible} title={l.about}>
            <button type="button" className="dk-organ-eye" aria-label={`${l.visible ? "Hide" : "Show"} ${l.label}`} aria-pressed={!l.visible} onClick={() => o.toggleLayer(l.id)}>
              {l.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
            <span>{l.label}</span>
            <small>{l.parts.length}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Every control in one surface, in one fixed order, on every model. Pass children to choose your own selection of them. */
export function OrganBar({ className, children }) {
  const o = useOrgan();
  if (o.decorative) return null;
  return (
    <div className={`dk-organ-bar${className ? ` ${className}` : ""}`} role="toolbar" aria-label="Model controls">
      {children ?? (
        <>
          <OrganViews />
          <i className="dk-organ-sep" />
          <OrganTools />
        </>
      )}
      <Popovers />
    </div>
  );
}

// ---- The panel ------------------------------------------------------------------------------------------------------------

function Legend() {
  const o = useOrgan();
  const colors = useMemo(() => (o.manifest ? segmentColors(o.manifest, { safe: !!paletteOf(o.palette).safeSegments }) : {}), [o.manifest, o.palette]);
  const groups = o.manifest?.groups ?? [];
  return (
    <div style={{ display: "grid", gap: ".625rem" }}>
      <div className="dk-organ-field">
        <label htmlFor="dk-seg-op"><span>Opacity</span><span>{Math.round(o.segOpacity * 100)}%</span></label>
        <input id="dk-seg-op" className="dk-organ-slider" style={{ margin: 0 }} type="range" min={0.12} max={1} step={0.01} value={o.segOpacity} onChange={(e) => o.setSegOpacity(Number(e.target.value))} />
      </div>
      <ul className="dk-organ-list">
        {groups.map((g) => {
          const members = o.parts.filter((p) => p.group === g.id);
          if (!members.length) return null;
          const shown = members.some((p) => !o.hiddenParts.has(p.id));
          return (
            <li key={g.id} className="dk-organ-layer" data-off={!shown}>
              <button type="button" className="dk-organ-eye" aria-label={`${shown ? "Hide" : "Show"} ${g.label}`} onClick={() => o.toggleGroup(g.id)}>
                {shown ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button type="button" className="dk-organ-row" style={{ flex: 1, minWidth: 0 }} onClick={() => o.select({ group: g.id, part: null })}>
                <span className="dk-organ-chips" aria-hidden>
                  {members.slice(0, 4).map((p) => <i key={p.id} className="dk-organ-chip" style={{ background: colors[p.id] }} />)}
                </span>
                <span className="dk-organ-name" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{g.label}</span>
                <small>{members.length}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PartList({ parts, colors }) {
  const o = useOrgan();
  return (
    <ul className="dk-organ-list">
      {parts.map((p, i) => (
        <li key={p.id} className="dk-organ-layer" data-off={o.hiddenParts.has(p.id)} style={{ padding: 0, "--i": Math.min(i, 14) }}>
          {colors && (
            <button type="button" className="dk-organ-eye" aria-label={`${o.hiddenParts.has(p.id) ? "Show" : "Hide"} ${p.label}`} onClick={() => o.togglePart(p.id)}>
              {o.hiddenParts.has(p.id) ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          <button type="button" className="dk-organ-row" style={{ flex: 1, minWidth: 0 }} aria-current={o.part?.id === p.id} onClick={() => o.select({ group: p.group, part: o.part?.id === p.id ? null : p.id })}>
            {colors && <i className="dk-organ-chip" style={{ background: colors[p.id] }} />}
            <span className="dk-organ-name">{p.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Where you are, what it is, and what is inside it, with search over every part name. */
export function OrganPanel({ className, parent }) {
  const o = useOrgan();
  const [query, setQuery] = useState("");
  const { manifest, group, part } = o;
  const colors = useMemo(() => (manifest ? segmentColors(manifest, { safe: !!paletteOf(o.palette).safeSegments }) : {}), [manifest, o.palette]);
  const counts = useMemo(() => {
    const c = {};
    manifest?.parts?.forEach((p) => (c[p.group] = (c[p.group] ?? 0) + 1));
    return c;
  }, [manifest]);
  const routes = useMemo(() => (manifest?.flows ?? []).filter((f) => f.about), [manifest]);
  const flowKinds = useMemo(() => [...new Set((manifest?.flows ?? []).map((f) => f.kind))], [manifest]);
  useEffect(() => setQuery(""), [manifest, group, part]);
  if (!manifest) return <aside className={`dk-organ-panel${className ? ` ${className}` : ""}`} aria-busy />;
  const here = part ?? group ?? manifest;
  const seg = o.mode === "segments";
  const members = group ? o.parts.filter((p) => p.group === group.id) : [];
  const q = query.trim().toLowerCase();
  const found = q ? o.parts.filter((p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).slice(0, 60) : null;
  const key = part?.id ?? group?.id ?? manifest.name;
  const isolatedHere = !!o.isolated;

  return (
    <aside className={`dk-organ-panel${className ? ` ${className}` : ""}`} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} style={{ display: "grid", gap: ".625rem" }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16, ease: "easeOut" }}>
          {(group || part || parent) && (
            <nav className="dk-organ-crumbs" aria-label="Where you are">
              {parent && (
                <>
                  <button type="button" onClick={parent.onBack}><ArrowLeft size={12} aria-hidden style={{ verticalAlign: "-2px", marginRight: 2 }} />{parent.label}</button>
                  <ChevronRight size={12} aria-hidden />
                </>
              )}
              <button type="button" onClick={() => o.select({ group: null, part: null })}>{manifest.title}</button>
              {group && <ChevronRight size={12} aria-hidden />}
              {group && part && <button type="button" onClick={() => o.select({ part: null })}>{group.label}</button>}
              {group && !part && <span>{group.label}</span>}
              {part && <ChevronRight size={12} aria-hidden />}
              {part && <span>{part.label}</span>}
            </nav>
          )}
          <h3 className="dk-organ-title">{here.label ?? here.title}</h3>
          {here.about && <p className="dk-organ-about">{here.about}</p>}
          {part?.measure && (
            <div className="dk-organ-measure">
              <small>{part.measure.label}</small>
              <strong>{part.measure.value}</strong>
            </div>
          )}
          {(part || group) && (
            <div className="dk-organ-actions">
              {part?.organ && (
                <button type="button" className="dk-organ-action" data-loud="true" onClick={() => o.openOrgan(part)}>
                  Open in detail
                  <ArrowUpRight size={14} aria-hidden />
                </button>
              )}
              <button type="button" className="dk-organ-action" aria-pressed={isolatedHere} onClick={() => o.isolate(isolatedHere ? null : part ? [part.id] : members.map((p) => p.id))}>
                <Focus size={14} aria-hidden />
                {isolatedHere ? "Show all" : "Isolate"}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {o.mode === "flow" && !group && flowKinds.length > 0 && (
        <div style={{ display: "grid", gap: ".5rem" }}>
          <div className="dk-organ-legend">
            {flowKinds.map((k) => (
              <span key={k}>
                <i className="dk-organ-chip" style={{ background: CARRIED[k]?.[0], borderRadius: "50%" }} />
                {CARRIED[k]?.[1]}
              </span>
            ))}
          </div>
          {routes.slice(0, 6).map((r) => (
            <p key={r.id} className="dk-organ-about" style={{ fontSize: ".8125rem" }}>
              <strong>{r.label}.</strong> {r.about}
            </p>
          ))}
        </div>
      )}

      {o.parts.length > 8 && (
        <label className="dk-organ-search">
          <Search size={14} aria-hidden style={{ opacity: 0.6 }} />
          <input type="search" placeholder={`Search ${o.parts.length} parts`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search parts" />
        </label>
      )}

      {found ? (
        found.length ? <PartList parts={found} colors={seg ? colors : null} /> : <p className="dk-organ-about">No part by that name.</p>
      ) : group ? (
        <PartList parts={members} colors={seg ? colors : null} />
      ) : seg ? (
        <Legend />
      ) : (
        <ul className="dk-organ-list">
          {(manifest.groups ?? []).map((g, i) => (
            <li key={g.id} style={{ "--i": Math.min(i, 14) }}>
              <button type="button" className="dk-organ-row" onClick={() => o.select({ group: g.id, part: null })}>
                <span className="dk-organ-name">{g.label}</span>
                <small>{counts[g.id] ?? 0} parts</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {manifest.credit && <p className="dk-organ-credit">{manifest.credit}</p>}
    </aside>
  );
}

// ---- The ready-made assembly ----------------------------------------------------------------------------------------------

function Assembly({ panel, pins, className, style, parent, baseUrl, passDown }) {
  const o = useOrgan();
  const showPanel = panel && !o.decorative;
  const covered = !!o.detail;
  return (
    <div className={`dk-organ${className ? ` ${className}` : ""}`} style={style} data-decorative={o.decorative} data-covered={covered}>
      <div className="dk-organ-wrap" data-panel={showPanel}>
        <div className="dk-organ-stage">
          <OrganStageView pins={pins} />
          <OrganBar />
        </div>
        {showPanel && <OrganPanel parent={parent} />}
      </div>
      <AnimatePresence>
        {o.detail && (
          <motion.div key={o.detail.name} className="dk-organ-detail" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.42, ease: [0.2, 0.7, 0.2, 1] }}>
            <Organ {...passDown} name={o.detail.name} baseUrl={baseUrl} autoRotate={false} parent={{ label: o.manifest?.title ?? "Back", onBack: o.closeOrgan }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Organ({ panel = true, pins = true, className, style, parent, children, ...rest }) {
  const passDown = { panel, pins };
  return (
    <OrganProvider {...rest}>
      <Assembly panel={panel} pins={pins} className={className} style={style} parent={parent} baseUrl={rest.baseUrl ?? "/organs"} passDown={passDown} />
      {Children.toArray(children)}
    </OrganProvider>
  );
}
Organ.Provider = OrganProvider;
Organ.Stage = OrganStageView;
Organ.Bar = OrganBar;
Organ.Views = OrganViews;
Organ.Tools = OrganTools;
Organ.Layers = OrganLayers;
Organ.Panel = OrganPanel;

/** A row of models to choose between, each with its poster, or its initial if it has none yet. */
export function OrganPicker({ names, value, onChange, baseUrl = "/organs", className, style }) {
  const [missing, setMissing] = useState({});
  return (
    <div role="tablist" aria-label="Models" className={className} style={{ display: "flex", gap: ".25rem", flexWrap: "wrap", ...style }}>
      {names.map((n) => (
        <button
          key={n}
          type="button"
          role="tab"
          aria-selected={n === value}
          onClick={() => onChange(n)}
          style={{ display: "grid", justifyItems: "center", gap: ".125rem", width: "4.25rem", padding: ".25rem", borderRadius: ".5rem", border: 0, cursor: "pointer", font: "inherit", fontSize: ".75rem", textTransform: "capitalize", color: "inherit", background: n === value ? "color-mix(in srgb,currentColor 12%,transparent)" : "transparent" }}
        >
          {missing[n] ? (
            <span aria-hidden style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: ".375rem", fontWeight: 650, fontSize: "1.125rem", textTransform: "uppercase", background: "color-mix(in srgb,currentColor 10%,transparent)" }}>{n[0]}</span>
          ) : (
            <img src={`${baseUrl}/${n}/poster.webp`} alt="" width={44} height={44} loading="lazy" onError={() => setMissing((m) => ({ ...m, [n]: true }))} />
          )}
          {n}
        </button>
      ))}
    </div>
  );
}
