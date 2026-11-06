import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, ChevronRight, Contrast, Eye, EyeOff, Grid2x2, Info, Loader2, Maximize2, Minimize2, Pause, Play, RotateCcw, Search, Square, TriangleAlert, X } from "lucide-react";
import { SYSTEMS, buildClasses } from "./labels.js";

// A real CT or MR scan with its segmentation over it: axial, coronal and sagittal slices and a 3D view. It reads the volumes in the
// browser, so every number in it (the HU under the pointer, a structure's volume) is worked out from the files themselves. Like the
// organ viewer it takes its colours from the text colour around it and fills whatever box it is given; the film area stays black in
// either theme, because that is what a scan is read against. NiiVue loads only when the viewer comes near the screen.
//
//   <ScanViewer image="/scans/example/ct.nii.gz" segmentation="/scans/example/seg.nii.gz" />
//
// image, segmentation: a URL, or a File for something opened locally. labels: optional, see normalizeLabels in labels.js. Left out,
// the names come from the table TotalSegmentator stores inside its multilabel file, then from its "total" class map.

const CSS = `
.dk-scan{position:relative;display:flex;width:100%;height:100%;min-height:24rem;gap:.625rem;color:inherit;font:inherit;container-type:inline-size;font-size:.8125rem}
.dk-scan *{box-sizing:border-box}
.dk-scan button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.dk-scan button:focus-visible,.dk-scan input:focus-visible{outline:2px solid currentColor;outline-offset:1px}
.dk-scan-main{flex:1 1 0;min-width:0;min-height:0;display:flex;flex-direction:column;gap:.5rem}
.dk-scan-bar{display:flex;align-items:center;flex-wrap:wrap;gap:.375rem .625rem;min-height:2rem}
.dk-scan-seg{display:inline-flex;align-items:center;gap:.125rem;padding:.125rem;border-radius:.625rem;background:color-mix(in srgb,currentColor 7%,transparent)}
.dk-scan-seg button{display:inline-flex;align-items:center;gap:.3125rem;height:1.625rem;padding:0 .5rem;border-radius:.5rem;font-weight:550;white-space:nowrap;opacity:.72;transition:background .15s,opacity .15s}
.dk-scan-seg button:hover{opacity:1}
.dk-scan-seg button[aria-pressed=true]{opacity:1;background:color-mix(in srgb,currentColor 15%,transparent)}
.dk-scan-note{display:inline-flex;align-items:center;gap:.3125rem;font-size:.75rem;opacity:.68;white-space:nowrap}
.dk-scan-push{margin-left:auto}
.dk-scan-num{font-variant-numeric:tabular-nums}
.dk-scan-stage{position:relative;flex:1 1 0;min-height:0;overflow:hidden;border-radius:.75rem;background:#000;color:#e6e9ee;transition:box-shadow .15s}
.dk-scan-stage:focus-within{box-shadow:0 0 0 2px color-mix(in srgb,#7fb2ff 70%,transparent)}
.dk-scan-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair}
.dk-scan-stage[data-tile=render] canvas{cursor:grab}
.dk-scan-stage[data-tile=render] canvas:active{cursor:grabbing}
.dk-scan-tile{position:absolute;pointer-events:none}
.dk-scan-strip{position:absolute;left:0;right:0;bottom:0;height:30px;display:flex;align-items:center;gap:.5rem;padding:0 .5rem;pointer-events:auto;font-size:.75rem;background:#0b0c0e;color:#d7dbe2}
.dk-scan-strip button{display:inline-flex;align-items:center;gap:.25rem;font-weight:600;white-space:nowrap;border-radius:.25rem}
.dk-scan-strip button svg{opacity:.55}
.dk-scan-strip button:hover svg{opacity:1}
.dk-scan-strip input[type=range]{flex:1 1 0;min-width:0;height:1rem;accent-color:#d7dbe2;cursor:ew-resize}
.dk-scan-strip output{flex:none;min-width:3.25rem;text-align:right;font-variant-numeric:tabular-nums;opacity:.72}
.dk-scan-strip small{font-size:.6875rem;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dk-scan-render{position:absolute;left:.5rem;top:.375rem;display:flex;gap:.125rem;pointer-events:auto}
.dk-scan-tag{position:absolute;left:0;top:0;max-width:16rem;padding:.25rem .5rem;border-radius:.375rem;font-size:.75rem;line-height:1.3;pointer-events:none;background:rgb(12 13 16/.86);box-shadow:0 0 0 1px rgb(255 255 255/.14);white-space:nowrap;z-index:3}
.dk-scan-tag b{display:inline-flex;align-items:center;gap:.3125rem;font-weight:600}
.dk-scan-tag span{display:block;opacity:.72;font-variant-numeric:tabular-nums}
.dk-scan-hint{position:absolute;left:50%;bottom:2.75rem;transform:translateX(-50%);padding:.25rem .625rem;border-radius:999px;font-size:.75rem;background:rgb(12 13 16/.86);box-shadow:0 0 0 1px rgb(255 255 255/.14);pointer-events:none;opacity:0;transition:opacity .2s;z-index:3;white-space:nowrap}
.dk-scan-hint[data-on=true]{opacity:1}
.dk-scan-state{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:1.5rem;font-size:.8125rem;line-height:1.5;z-index:2;pointer-events:none}
.dk-scan-state span{display:inline-flex;align-items:center;gap:.5rem}
.dk-scan-spin{animation:dk-scan-spin 1s linear infinite}
@keyframes dk-scan-spin{to{transform:rotate(360deg)}}
.dk-scan-warn{display:flex;gap:.5rem;align-items:flex-start;padding:.375rem .625rem;border-radius:.5rem;font-size:.75rem;line-height:1.4;background:color-mix(in srgb,#e8a33d 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,#e8a33d 45%,transparent)}
.dk-scan-warn svg{flex:none;margin-top:.0625rem}
.dk-scan-panel{flex:0 0 clamp(15.5rem,25%,20rem);display:flex;flex-direction:column;gap:.5rem;min-height:0}
.dk-scan-card{padding:.625rem .75rem;border-radius:.75rem;background:color-mix(in srgb,currentColor 5%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 9%,transparent)}
.dk-scan-where{display:flex;justify-content:space-between;font-size:.6875rem;opacity:.6;margin-bottom:.25rem}
.dk-scan-name{display:flex;align-items:center;gap:.4375rem;font-size:1.0625rem;line-height:1.2;font-weight:640;letter-spacing:-.01em;min-height:1.3rem}
.dk-scan-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dk-scan-name[data-none=true]{font-weight:500;opacity:.55}
.dk-scan-stats{display:grid;grid-template-columns:1fr 1fr;gap:.375rem .75rem;margin:.5rem 0 0}
.dk-scan-stats dt{font-size:.6875rem;opacity:.6}
.dk-scan-stats dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.dk-scan-stats dd small{font-size:.6875rem;font-weight:500;opacity:.72}
.dk-scan-stats .dk-scan-wide{grid-column:1/-1}
.dk-scan-stats .dk-scan-wide dd{font-weight:500;font-size:.75rem;opacity:.85}
.dk-scan-tools{display:grid;gap:.375rem}
.dk-scan-tools input[type=range]{flex:1 1 0;min-width:0;height:1rem;accent-color:currentColor}
.dk-scan-tools label{min-width:0;display:flex;align-items:center;gap:.5rem;font-size:.75rem}
.dk-scan-toolrow{display:flex;justify-content:space-between;gap:.375rem}
.dk-scan-tools output{min-width:2.25rem;text-align:right;font-size:.75rem;font-variant-numeric:tabular-nums;opacity:.72}
.dk-scan-legend{flex:1 1 0;min-height:0;display:flex;flex-direction:column;padding:.5rem}
.dk-scan-find{display:flex;align-items:center;gap:.25rem;padding:0 .25rem .375rem}
.dk-scan-search{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:.375rem;height:1.625rem;padding:0 .5rem;border-radius:.5rem;background:color-mix(in srgb,currentColor 6%,transparent)}
.dk-scan-search input{flex:1 1 0;min-width:0;width:100%;font:inherit;font-size:.75rem;color:inherit;background:none;border:0;outline:0}
.dk-scan-search input::placeholder{color:inherit;opacity:.55}
.dk-scan-find>button{height:1.625rem;padding:0 .4375rem;border-radius:.5rem;font-size:.6875rem;font-weight:550;opacity:.72;white-space:nowrap}
.dk-scan-find>button:hover{opacity:1;background:color-mix(in srgb,currentColor 8%,transparent)}
.dk-scan-list{flex:1 1 0;min-height:0;overflow:auto;margin:0;padding:0;list-style:none;scrollbar-width:thin;overscroll-behavior:contain}
.dk-scan-group{display:flex;align-items:center;gap:.25rem;height:1.625rem;position:sticky;top:0;z-index:1;font-size:.6875rem;font-weight:620;background:var(--dk-scan-sticky,transparent);backdrop-filter:blur(14px)}
.dk-scan-group>button:first-child{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:.25rem;height:100%;padding:0 .125rem;text-align:left}
.dk-scan-group>button:first-child svg{flex:none;opacity:.55;transition:transform .15s}
.dk-scan-group[data-open=true]>button:first-child svg{transform:rotate(90deg)}
.dk-scan-group small{margin-left:auto;font-weight:500;opacity:.6;font-variant-numeric:tabular-nums}
.dk-scan-eye{flex:none;width:1.5rem;height:1.5rem;display:grid;place-items:center;border-radius:.375rem;opacity:.5}
.dk-scan-eye:hover{opacity:1;background:color-mix(in srgb,currentColor 10%,transparent)}
.dk-scan-eye[aria-pressed=false]{opacity:.9}
.dk-scan-row{display:flex;align-items:center;gap:.125rem;border-radius:.4375rem}
.dk-scan-row:hover{background:color-mix(in srgb,currentColor 6%,transparent)}
.dk-scan-row[data-focus=true]{background:color-mix(in srgb,currentColor 13%,transparent)}
.dk-scan-row[data-at=true] .dk-scan-rowname{font-weight:650}
.dk-scan-row>button:first-child{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:.4375rem;height:1.5rem;padding:0 .25rem 0 .375rem;text-align:left;font-size:.75rem}
.dk-scan-rowname{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dk-scan-row small{flex:none;font-size:.6875rem;opacity:.66;font-variant-numeric:tabular-nums}
.dk-scan-row[data-off=true] .dk-scan-rowname,.dk-scan-row[data-off=true] small{opacity:.38}
.dk-scan-chip{flex:none;width:.6875rem;height:.6875rem;border-radius:.1875rem;box-shadow:inset 0 0 0 1px rgb(255 255 255/.2)}
.dk-scan-row[data-off=true] .dk-scan-chip{background:none!important;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,currentColor 40%,transparent)}
.dk-scan-credit{margin:0;font-size:.6875rem;line-height:1.35;opacity:.55}
@container (max-width:60rem){.dk-scan-seg button span{display:none}.dk-scan-seg[data-keep] button span{display:inline}}
@container (max-width:44rem){.dk-scan{flex-direction:column}.dk-scan-panel{flex:0 0 42%}.dk-scan-main{flex:1 1 58%}}
@media (prefers-reduced-motion:reduce){.dk-scan *{transition:none!important;animation:none!important}}
`;

// Window width and level in Hounsfield units. Standard radiology values, nothing here is tuned to the sample.
const WINDOWS = [
  { id: "soft", label: "Soft tissue", width: 400, level: 40 },
  { id: "lung", label: "Lung", width: 1500, level: -600 },
  { id: "bone", label: "Bone", width: 1800, level: 400 },
  { id: "brain", label: "Brain", width: 80, level: 40 },
];
const LAYOUTS = [
  { id: "all", label: "All four", icon: Grid2x2 },
  { id: "axial", label: "Axial", icon: Square },
  { id: "coronal", label: "Coronal", icon: Square },
  { id: "sagittal", label: "Sagittal", icon: Square },
  { id: "render", label: "3D", icon: Box },
];
// Organs first, then what surrounds them; the colour order in SYSTEMS is a separate matter.
const LEGEND_ORDER = ["digestive", "urinary", "glands", "vessels", "lungs", "nervous", "muscles", "bones", "other"];

const fmtMl = (ml) => (ml >= 100 ? ml.toLocaleString(undefined, { maximumFractionDigits: 0 }) : ml.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
const volumeText = (c) => `${c.cutOff ? "≥ " : ""}${fmtMl(c.ml)} mL`;
const CUT_NOTE = "Reaches the edge of the scan, so more of it lies outside and this is a lower bound.";
const toSource = (x) => (typeof Blob !== "undefined" && x instanceof Blob ? { url: URL.createObjectURL(x), name: x.name, local: true } : { url: x });

export function ScanViewer({ image, segmentation, labels, modality, defaultLayout = "all", defaultWindow, defaultOpacity = 0.55, defaultPalette = "vivid", panel = true, autoRotate = true, onSelect, onReady, className, style }) {
  const root = useRef(null);
  const host = useRef(null);
  const stageRef = useRef(null);
  const [near, setNear] = useState(false);
  const [engine, setEngine] = useState(false);
  const [status, setStatus] = useState("waiting");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [classes, setClasses] = useState([]);
  const [tiles, setTiles] = useState([]);
  const [layout, setLayout] = useState(defaultLayout);
  const [windowId, setWindowId] = useState(defaultWindow ?? "soft");
  const [opacity, setOpacity] = useState(defaultOpacity);
  const [outline, setOutline] = useState(false);
  const [palette, setPalette] = useState(defaultPalette);
  const [hidden, setHidden] = useState(() => new Set());
  const [focus, setFocus] = useState(null);
  const [at, setAt] = useState(null);
  const [hover, setHover] = useState(null);
  const [surfaces, setSurfaces] = useState({ done: 0, total: 0, building: false });
  const [renderMode, setRenderMode] = useState("surface");
  const [showBody, setShowBody] = useState(true);
  const [spinning, setSpinning] = useState(autoRotate);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef(0);
  const startedOn = useRef(null);
  const focusNow = useRef(null);
  focusNow.current = focus;
  const classesNow = useRef(classes);
  classesNow.current = classes;
  const callbacks = useRef({});
  callbacks.current = { onSelect, onReady };

  const labelsKey = useMemo(() => (labels == null ? "" : JSON.stringify(labels)), [labels]);
  const isCT = (modality ?? info?.modality) === "CT";

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const report = useCallback((klass) => {
    if (!klass) {
      callbacks.current.onSelect?.(null);
      return;
    }
    const { id, key, name, ml, cutOff, color } = klass;
    callbacks.current.onSelect?.({ id, key, name, ml, cutOff, color });
  }, []);

  useEffect(() => {
    if (!near || !host.current) return undefined;
    const stage = new ScanStageHolder();
    let live = true;
    setStatus("starting");
    import("./stage.js")
      .then(({ ScanStage }) => {
        if (!live) return null;
        stage.current = new ScanStage(host.current, {
          location: setAt,
          hover: setHover,
          layout: setTiles,
          surfaces: setSurfaces,
          spin: setSpinning,
          // From the 3D view: a structure, or null for empty space.
          pick: (id) => {
            setFocus(id);
            report(id == null ? null : classesNow.current.find((c) => c.id === id));
          },
          wheelIgnored: () => {
            setHint(true);
            clearTimeout(hintTimer.current);
            hintTimer.current = setTimeout(() => setHint(false), 1400);
          },
        });
        return stage.current.init();
      })
      .then((ok) => {
        if (!live || !ok) return;
        stageRef.current = stage.current;
        setEngine(true);
      })
      .catch((e) => {
        if (!live) return;
        setError(webglHelp(e));
        setStatus("error");
      });
    return () => {
      live = false;
      clearTimeout(hintTimer.current);
      stage.current?.destroy();
      stageRef.current = null;
      setEngine(false);
    };
  }, [near, report]);

  // Load. Everything that depends on the voxels restarts when the files change.
  useEffect(() => {
    const stage = stageRef.current;
    if (!engine || !stage || !image) return undefined;
    let live = true;
    const img = toSource(image);
    const seg = segmentation ? toSource(segmentation) : null;
    setStatus("loading");
    setError(null);
    setInfo(null);
    setClasses([]);
    setAt(null);
    setHover(null);
    setFocus(null);
    setHidden(new Set());
    stage
      .load({ image: img.url, imageName: img.name, segmentation: seg?.url, segmentationName: seg?.name })
      .then((loaded) => {
        if (!live || !loaded) return;
        setInfo(loaded);
        setStatus("ready");
      })
      .catch((e) => {
        if (!live) return;
        setError(`Could not read the scan: ${e?.message ?? e}`);
        setStatus("error");
      })
      .finally(() => {
        if (img.local) URL.revokeObjectURL(img.url);
        if (seg?.local) URL.revokeObjectURL(seg.url);
      });
    return () => {
      live = false;
    };
  }, [engine, image, segmentation]);

  // Names and colours. Separate from loading, so a new labels object does not fetch the scan again.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !info) return;
    const next = buildClasses(info.stats, labelsKey ? JSON.parse(labelsKey) : undefined, info.embedded, { safe: palette === "safe" });
    setClasses(next);
    stage.setClasses(next);
    // Open on something: the middle of the volume is as likely as not to be empty space. Only for a new scan, not a new palette.
    if (startedOn.current !== info) {
      startedOn.current = info;
      const largest = [...next].sort((a, b) => b.voxels - a.voxels)[0];
      if (largest) stage.jumpTo(largest.id, false);
    }
    setAt(stage.readCrosshair());
    callbacks.current.onReady?.({ modality: modality ?? info.modality, dims: info.dims, spacing: info.spacing, classes: next });
    // modality only sets what onReady reports.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, labelsKey, palette]);

  useEffect(() => {
    if (info) stageRef.current?.setLayout(layout);
  }, [layout, info]);

  useEffect(() => {
    if (info && classes.length) stageRef.current?.setOverlay({ hidden, focus, opacity, outline });
  }, [hidden, focus, opacity, outline, info, classes]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !info) return;
    if (isCT) {
      const w = WINDOWS.find((x) => x.id === windowId) ?? WINDOWS[0];
      stage.setWindow(w.level - w.width / 2, w.level + w.width / 2);
    } else {
      stage.setWindow(info.range[0], info.range[1]);
    }
  }, [windowId, isCT, info]);

  useEffect(() => {
    if (info) stageRef.current?.setRenderMode(renderMode);
  }, [renderMode, info]);

  useEffect(() => {
    if (info) stageRef.current?.setBody(showBody);
  }, [showBody, info]);

  useEffect(() => {
    if (info) stageRef.current?.setSpin(spinning);
  }, [spinning, info]);

  const selectClass = useCallback((klass) => {
    const next = focusNow.current === klass.id ? null : klass.id;
    focusNow.current = next;
    setFocus(next);
    if (next != null) stageRef.current?.jumpTo(klass.id);
    report(next != null ? klass : null);
    // A hidden class comes back when asked for by name.
    setHidden((h) => {
      if (!h.has(klass.id)) return h;
      const n = new Set(h);
      n.delete(klass.id);
      return n;
    });
  }, [report]);

  const toggleClass = useCallback((id) => {
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const setMany = useCallback((ids, hide) => {
    setHidden((h) => {
      const n = new Set(h);
      ids.forEach((id) => (hide ? n.add(id) : n.delete(id)));
      return n;
    });
  }, []);

  const shown = hover ?? at;
  const activeWindow = WINDOWS.find((w) => w.id === windowId) ?? WINDOWS[0];

  return (
    <div ref={root} className={`dk-scan ${className ?? ""}`} style={style}>
      <style>{CSS}</style>
      <div className="dk-scan-main">
        <div className="dk-scan-bar">
          <div className="dk-scan-seg" role="group" aria-label="Layout">
            {LAYOUTS.map((l) => (
              <button key={l.id} type="button" aria-pressed={layout === l.id} aria-label={l.label} title={l.label} onClick={() => setLayout(l.id)}>
                <l.icon size={13} aria-hidden="true" />
                <span>{l.label}</span>
              </button>
            ))}
          </div>
          <div className="dk-scan-seg">
            <button type="button" aria-label="Reset zoom, pan and rotation" title="Reset zoom, pan and rotation" onClick={() => stageRef.current?.resetView()}>
              <RotateCcw size={13} aria-hidden="true" />
            </button>
          </div>
          {isCT && (
            <div className="dk-scan-seg" data-keep="" role="group" aria-label="CT window">
              <Contrast size={13} aria-hidden="true" style={{ margin: "0 .25rem", opacity: 0.6 }} />
              {WINDOWS.map((w) => (
                <button key={w.id} type="button" aria-pressed={windowId === w.id} title={`Width ${w.width}, level ${w.level} HU`} onClick={() => setWindowId(w.id)}>
                  <span>{w.label}</span>
                </button>
              ))}
            </div>
          )}
          {isCT && (
            <span className="dk-scan-note dk-scan-num" title="Window width and level, in Hounsfield units">
              W {activeWindow.width} L {activeWindow.level}
            </span>
          )}
          <span className="dk-scan-note dk-scan-push">
            <Info size={12} aria-hidden="true" /> Not for diagnosis
          </span>
        </div>
        {info?.warnings?.map((w) => (
          <div key={w} className="dk-scan-warn" role="alert">
            <TriangleAlert size={13} aria-hidden="true" />
            <span>{w}</span>
          </div>
        ))}
        <div ref={host} className="dk-scan-stage" data-tile={tiles.length === 1 ? tiles[0].plane : undefined} onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - r.left;
          const y = e.clientY - r.top;
          const t = tiles.find((tile) => x >= tile.left && x < tile.left + tile.width && y >= tile.top && y < tile.top + tile.height);
          e.currentTarget.dataset.tile = t?.plane ?? "";
        }}>
          {status !== "ready" && (
            <div className="dk-scan-state">
              {status === "error" ? (
                <span role="alert">{error}</span>
              ) : (
                <span>
                  <Loader2 size={15} className="dk-scan-spin" aria-hidden="true" /> {status === "waiting" ? "Waiting to load" : status === "starting" ? "Starting the viewer" : "Reading the scan"}
                </span>
              )}
            </div>
          )}
          {status === "ready" &&
            tiles.map((t) => (
              <Tile
                key={t.plane}
                tile={t}
                slice={at?.slices?.[t.plane]}
                single={tiles.length === 1}
                surfaces={surfaces}
                onSlice={(i) => stageRef.current?.setSlice(t.plane, i)}
                onExpand={() => setLayout(tiles.length === 1 ? "all" : t.plane)}
              >
                {t.plane === "render" && (
                  <div className="dk-scan-render">
                    <div className="dk-scan-seg" style={{ background: "rgb(255 255 255/.1)" }} data-keep="">
                      <button type="button" aria-pressed={renderMode === "surface"} onClick={() => setRenderMode("surface")} title="Each class as a smooth surface built from its voxels">
                        <span>Surfaces</span>
                      </button>
                      <button type="button" aria-pressed={renderMode === "volume"} onClick={() => setRenderMode("volume")} title="The CT itself, ray cast through the current window">
                        <span>Volume</span>
                      </button>
                    </div>
                    {renderMode === "surface" && (
                      <div className="dk-scan-seg" style={{ background: "rgb(255 255 255/.1)" }} data-keep="">
                        <button type="button" aria-pressed={showBody} onClick={() => setShowBody(!showBody)} title="The patient's outer surface, as glass">
                          <span>Body</span>
                        </button>
                      </div>
                    )}
                    <div className="dk-scan-seg" style={{ background: "rgb(255 255 255/.1)" }}>
                      <button type="button" aria-label={spinning ? "Stop turning" : "Turn slowly"} title={spinning ? "Stop turning" : "Turn slowly"} onClick={() => setSpinning(!spinning)}>
                        {spinning ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                )}
              </Tile>
            ))}
          {hover && <HoverTag hover={hover} isCT={isCT} host={host} />}
          <div className="dk-scan-hint" data-on={hint}>
            Click the scan first to scroll through its slices
          </div>
        </div>
      </div>
      {panel && (
        <div className="dk-scan-panel">
          <Readout at={shown} isCT={isCT} ready={status === "ready"} hasSeg={!!segmentation} onClear={focus != null ? () => setFocus(null) : null} />
          {segmentation && classes.length > 0 && (
            <>
              <div className="dk-scan-card dk-scan-tools">
                <label>
                  <span>Overlay</span>
                  <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={(e) => setOpacity(+e.target.value)} aria-label="Segmentation opacity" />
                  <output>{Math.round(opacity * 100)}%</output>
                </label>
                <div className="dk-scan-toolrow">
                  <div className="dk-scan-seg" data-keep="" role="group" aria-label="Overlay style">
                    <button type="button" aria-pressed={!outline} onClick={() => setOutline(false)}>
                      <span>Fill</span>
                    </button>
                    <button type="button" aria-pressed={outline} onClick={() => setOutline(true)}>
                      <span>Edge</span>
                    </button>
                  </div>
                  <div className="dk-scan-seg" data-keep="" role="group" aria-label="Colours">
                    <button type="button" aria-pressed={palette === "vivid"} onClick={() => setPalette("vivid")}>
                      <span>Vivid</span>
                    </button>
                    <button type="button" aria-pressed={palette === "safe"} onClick={() => setPalette("safe")} title="A set that stays apart under colour-vision deficiency">
                      <span>Safe</span>
                    </button>
                  </div>
                </div>
              </div>
              <Legend classes={classes} hidden={hidden} focus={focus} atId={at?.id} onSelect={selectClass} onToggle={toggleClass} onMany={setMany} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ScanStageHolder() {
  this.current = null;
}

function webglHelp(e) {
  const text = String(e?.message ?? e);
  return /webgl/i.test(text) ? "This viewer needs WebGL 2, which this browser or device has switched off." : `The viewer could not start: ${text}`;
}

function Tile({ tile, slice, single, surfaces, onSlice, onExpand, children }) {
  const Expand = single ? Minimize2 : Maximize2;
  return (
    <div className="dk-scan-tile" style={{ left: tile.left, top: tile.top, width: tile.width, height: tile.height }}>
      {children}
      <div className="dk-scan-strip">
        <button type="button" onClick={onExpand} title={single ? "Back to all four" : `Enlarge ${tile.label}`}>
          {tile.label} <Expand size={11} aria-hidden="true" />
        </button>
        {slice ? (
          <>
            <input
              type="range"
              min="0"
              max={slice.n - 1}
              step="1"
              value={slice.i}
              onChange={(e) => onSlice(+e.target.value)}
              aria-label={`${tile.label} slice`}
            />
            <output>
              {slice.i + 1} / {slice.n}
            </output>
          </>
        ) : (
          <small>{surfaces.building ? `Building surfaces ${surfaces.done} / ${surfaces.total}` : "Drag to turn. Click a structure to select it."}</small>
        )}
      </div>
    </div>
  );
}

function HoverTag({ hover, isCT, host }) {
  const w = host.current?.clientWidth ?? 0;
  const h = host.current?.clientHeight ?? 0;
  // Stay beside the pointer, and flip before running off the stage.
  const x = hover.x > w - 190 ? hover.x - 182 : hover.x + 14;
  const y = hover.y > h - 64 ? hover.y - 52 : hover.y + 14;
  const k = hover.klass;
  return (
    <div className="dk-scan-tag" style={{ transform: `translate(${x}px,${y}px)` }}>
      <b>
        {k && <i className="dk-scan-chip" style={{ background: k.color }} />}
        {k ? k.name : hover.id ? `Label ${hover.id}` : "No structure"}
      </b>
      <span>
        {hover.value == null ? "" : isCT ? `${Math.round(hover.value)} HU` : `Intensity ${fmtValue(hover.value)}`}
        {k ? ` · ${volumeText(k)}` : ""}
      </span>
    </div>
  );
}

const fmtValue = (v) => (Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));

function Readout({ at, isCT, ready, hasSeg, onClear }) {
  const k = at?.klass;
  return (
    <div className="dk-scan-card" aria-live="off">
      <div className="dk-scan-where">
        <span>{at?.source === "pointer" ? "Under the pointer" : "At the crosshair"}</span>
        {onClear && (
          <button type="button" onClick={onClear} style={{ display: "inline-flex", alignItems: "center", gap: ".1875rem" }}>
            <X size={11} aria-hidden="true" /> Clear highlight
          </button>
        )}
      </div>
      <div className="dk-scan-name" data-none={!k}>
        {k && <i className="dk-scan-chip" style={{ background: k.color, width: ".8125rem", height: ".8125rem" }} />}
        <span>{!ready ? "Loading" : k ? k.name : at?.id ? `Label ${at.id}` : hasSeg ? "No structure here" : "Image only"}</span>
      </div>
      <dl className="dk-scan-stats">
        <div>
          <dt>{isCT ? "Density" : "Intensity"}</dt>
          <dd>{at?.value == null ? "–" : isCT ? <>{fmtValue(Math.round(at.value))} <small>HU</small></> : fmtValue(at.value)}</dd>
        </div>
        <div title={k?.cutOff ? CUT_NOTE : undefined}>
          <dt>Volume{k?.cutOff ? " in scan" : ""}</dt>
          <dd>{k ? <>{k.cutOff ? "≥ " : ""}{fmtMl(k.ml)} <small>mL</small></> : "–"}</dd>
        </div>
        <div className="dk-scan-wide">
          <dt>Voxel, world position</dt>
          <dd>{at ? `${at.voxel.join(", ")} · ${at.mm.map((v) => v.toFixed(0)).join(", ")} mm` : "–"}</dd>
        </div>
      </dl>
    </div>
  );
}

const Legend = memo(function Legend({ classes, hidden, focus, atId, onSelect, onToggle, onMany }) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState({});
  const list = useRef(null);
  const q = filter.trim().toLowerCase();

  const groups = useMemo(() => {
    const out = [];
    for (const system of LEGEND_ORDER) {
      const def = SYSTEMS.find((s) => s.id === system);
      const members = classes.filter((c) => c.system === system && (!q || c.name.toLowerCase().includes(q)));
      if (!members.length) continue;
      members.sort((a, b) => (def.ordered ? a.id - b.id : b.ml - a.ml));
      out.push({ ...def, members, ml: members.reduce((sum, c) => sum + c.ml, 0) });
    }
    return out;
  }, [classes, q]);

  // Keep the structure under the crosshair in view inside the list, without moving the page around the viewer.
  useEffect(() => {
    const box = list.current;
    const row = box?.querySelector(`[data-id="${atId}"]`);
    if (!row) return;
    const r = row.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top + 30) box.scrollTop += r.top - b.top - 30;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  }, [atId]);

  const allIds = classes.map((c) => c.id);
  const isOpen = (g) => !!q || (open[g.id] ?? g.members.length <= 12);

  return (
    <div className="dk-scan-card dk-scan-legend">
      <div className="dk-scan-find">
        <label className="dk-scan-search">
          <Search size={12} aria-hidden="true" style={{ opacity: 0.55, flex: "none" }} />
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`${classes.length} classes`} aria-label="Find a class" />
        </label>
        <button type="button" onClick={() => onMany(allIds, false)}>
          All
        </button>
        <button type="button" onClick={() => onMany(allIds, true)}>
          None
        </button>
      </div>
      <ul className="dk-scan-list" ref={list}>
        {groups.map((g) => {
          const off = g.members.every((c) => hidden.has(c.id));
          const expanded = isOpen(g);
          return (
            <li key={g.id}>
              <div className="dk-scan-group" data-open={expanded}>
                <button type="button" aria-expanded={expanded} onClick={() => setOpen({ ...open, [g.id]: !expanded })}>
                  <ChevronRight size={12} aria-hidden="true" /> {g.label}
                  <small>
                    {g.members.length} · {fmtMl(g.ml)} mL
                  </small>
                </button>
                <button type="button" className="dk-scan-eye" aria-pressed={!off} aria-label={`${off ? "Show" : "Hide"} ${g.label}`} title={`${off ? "Show" : "Hide"} ${g.label}`} onClick={() => onMany(g.members.map((c) => c.id), !off)}>
                  {off ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
                </button>
              </div>
              {expanded &&
                g.members.map((c) => {
                  const isOff = hidden.has(c.id);
                  return (
                    <div key={c.id} className="dk-scan-row" data-id={c.id} data-focus={focus === c.id} data-at={atId === c.id} data-off={isOff}>
                      <button type="button" aria-pressed={focus === c.id} onClick={() => onSelect(c)} title={`${c.name}. Jump to its centre and highlight it.${c.cutOff ? ` ${CUT_NOTE}` : ""}`}>
                        <i className="dk-scan-chip" style={{ background: c.color }} />
                        <span className="dk-scan-rowname">{c.name}</span>
                        <small>{volumeText(c)}</small>
                      </button>
                      <button type="button" className="dk-scan-eye" aria-pressed={!isOff} aria-label={`${isOff ? "Show" : "Hide"} ${c.name}`} title={`${isOff ? "Show" : "Hide"} ${c.name}`} onClick={() => onToggle(c.id)}>
                        {isOff ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
                      </button>
                    </div>
                  );
                })}
            </li>
          );
        })}
      </ul>
    </div>
  );
});
