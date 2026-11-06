import { hexToRgb, embeddedLabels } from "./labels.js";
import { apply4, invert4, labelVoxels, measureLabels, nearestVoxelOf } from "./measure.js";
import { bodySurface, classSurface, thinLabels } from "./surface.js";

// The imperative half of the viewer: one NiiVue instance on one canvas, every tile drawn into it. React owns the controls and
// tells this what to show; this tells React where the crosshair is and what is under the pointer.
//
// NiiVue is pinned to an exact version because this leans on a few of its internals, each marked where it happens.

let lib;
export const loadNiivue = () => (lib ||= import("@niivue/niivue"));

const PLANES = {
  axial: { type: 0, axis: 2, label: "Axial" },
  coronal: { type: 1, axis: 1, label: "Coronal" },
  sagittal: { type: 2, axis: 0, label: "Sagittal" },
  render: { type: 4, axis: -1, label: "3D" },
};

const LAYOUTS = {
  all: { cols: 2, rows: 2, tiles: ["axial", "coronal", "sagittal", "render"] },
  axial: { cols: 1, rows: 1, tiles: ["axial"] },
  coronal: { cols: 1, rows: 1, tiles: ["coronal"] },
  sagittal: { cols: 1, rows: 1, tiles: ["sagittal"] },
  render: { cols: 1, rows: 1, tiles: ["render"] },
};

// Height kept clear under each slice for its name and slider, so the controls never sit on the image.
const STRIP_PX = 30;
const GAP_PX = 2;
// Pixels of trackpad travel for one slice. A mouse wheel notch is treated as exactly one slice whatever it reports.
const WHEEL_PX = 28;

const WET = `#version 300 es
precision highp int;
precision highp float;
uniform float opacity;
in vec4 vClr;
in vec3 vN;
out vec4 color;
void main() {
  vec3 n = normalize(vN);
  vec3 v = vec3(0.0, 0.0, -1.0);
  vec3 key = normalize(vec3(-0.35, 0.55, -0.75));
  vec3 fill = normalize(vec3(0.6, -0.15, -0.5));
  float facing = max(dot(n, v), 0.0);
  // Wrapped diffuse keeps the far side of an organ in soft shadow rather than black.
  float diffuse = pow(max(dot(n, key) * 0.6 + 0.4, 0.0), 1.4) + 0.32 * max(dot(n, fill), 0.0);
  vec3 base = pow(vClr.rgb, vec3(1.15));
  vec3 lit = base * (0.2 + 0.9 * diffuse);
  // Darker toward the edges, the way a rounded wet surface reads, with a thin cool rim of light past that.
  lit *= mix(0.55, 1.0, smoothstep(0.0, 0.55, facing));
  float rim = pow(1.0 - facing, 3.5);
  lit += mix(base, vec3(0.8, 0.86, 1.0), 0.65) * rim * 0.42;
  // A tight highlight over a broad sheen: this is what makes the surface look wet instead of plastic.
  vec3 h = normalize(key + v);
  float nh = max(dot(n, h), 0.0);
  lit += vec3(1.0, 0.98, 0.95) * (0.62 * pow(nh, 90.0) + 0.16 * pow(nh, 14.0));
  color = vec4(lit, opacity);
}`;

const GLASS = `#version 300 es
precision highp int;
precision highp float;
uniform float opacity;
in vec4 vClr;
in vec3 vN;
out vec4 color;
void main() {
  vec3 n = normalize(vN);
  float facing = abs(dot(n, vec3(0.0, 0.0, -1.0)));
  // Clear where the surface faces the viewer, milky at the silhouette: glass, so the organs inside stay readable.
  float fresnel = pow(1.0 - facing, 1.9);
  vec3 key = normalize(vec3(-0.35, 0.55, -0.75));
  float spec = pow(max(dot(n, normalize(key + vec3(0.0, 0.0, -1.0))), 0.0), 40.0);
  color = vec4(vec3(0.88, 0.92, 0.98), (0.055 + 0.85 * fresnel + 0.25 * spec) * opacity);
}`;

const isStill = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// A turn for the browser between jobs. Not setTimeout: a chain of those is clamped to one a second in a background tab, which would
// stretch a short build into a minute.
const yieldNow = () =>
  new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      port1.close();
      resolve();
    };
    port2.postMessage(0);
  });

export class ScanStage {
  constructor(host, on = {}) {
    this.host = host;
    this.on = on;
    this.layout = "all";
    this.renderMode = "surface";
    this.showBody = true;
    this.hidden = new Set();
    this.focus = null;
    this.opacity = 0.55;
    this.outline = false;
    this.classes = [];
    this.byId = new Map();
    this.meshes = new Map();
    this.bodyMesh = null;
    this.alive = true;
    this.loadToken = 0;
    this.pointer = null;
    this.activeTile = "axial";
    this.wheelAcc = 0;
    this.spin = false;
    this.spinFrame = 0;
    this.onScreen = true;
  }

  async init() {
    const { Niivue, NVMesh, DRAG_MODE } = await loadNiivue();
    if (!this.alive) return false;
    this.NVMesh = NVMesh;
    // The canvas is made here rather than by React. A WebGL context cannot be taken back from a canvas once lost, and losing it
    // on unmount is how the GPU memory gets freed, so each mount needs its own element.
    const canvas = document.createElement("canvas");
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Scan slices and 3D view. Click to place the crosshair, then scroll to move through slices.");
    canvas.style.outline = "none";
    this.host.prepend(canvas);
    this.canvas = canvas;
    // A handle for the browser console, and for checking the numbers against the file.
    this.host.__scanStage = this;

    const nv = new Niivue({
      backColor: [0, 0, 0, 1],
      crosshairColor: [1, 1, 1, 0.42],
      // As a share of the field of view, so the line stays thin at any voxel size. In voxels, a 3 mm scan gets a 3 mm thick cross.
      crosshairWidthUnit: "percent",
      crosshairWidth: 0.14,
      crosshairGap: 10,
      isRadiologicalConvention: true,
      sagittalNoseLeft: true,
      dragMode: DRAG_MODE.pan,
      dragAndDropEnabled: false,
      isOrientationTextVisible: true,
      isForceMouseClickToVoxelCenters: true,
      showLegend: false,
      loadingText: "",
      logLevel: "error",
      fontMinPx: 11,
      fontSizeScaling: 0.3,
      fontColor: [0.75, 0.78, 0.82, 0.9],
      // These hotkeys would change the layout and the clip plane behind React's back.
      clipPlaneHotKey: "",
      cycleClipPlaneHotKey: "",
      viewModeHotKey: "",
      // Surfaces belong to the 3D tile only. Left at its default NiiVue also paints every mesh onto every slice.
      meshThicknessOn2D: 0,
    });
    this.nv = nv;
    await nv.attachToCanvas(canvas);
    if (!this.alive) return false;

    // NiiVue's depth picker reads back a blended colour when a translucent mesh is in the way, so the glass shell would swallow
    // every click. Picking is done here instead by walking the label volume along the view ray. (Internal: uiData.)
    Object.defineProperty(nv.uiData, "mouseDepthPicker", { get: () => false, set: () => {}, configurable: true });
    // Surfaces replace the ray caster in the 3D tile: it cannot light overlays, and a CT drawn by it hides everything under the
    // skin. "Volume" mode runs it on the CT alone, so that a bone window shows the bones as scanned; overlays would only lay flat
    // colour over that, so the render shader alone is told there are none. (Internal: drawImage3D and that uniform.)
    const drawVolume = nv.drawImage3D.bind(nv);
    nv.drawImage3D = (...args) => {
      if (this.renderMode !== "volume") return;
      nv.renderShader.use(nv.gl);
      nv.gl.uniform1f(nv.renderShader.uniforms.overlays, 0);
      drawVolume(...args);
    };
    this.wetShader = nv.setCustomMeshShader(WET, "ScanWet");
    this.glassShader = nv.setCustomMeshShader(GLASS, "ScanGlass");
    nv.setRenderAzimuthElevation(150, 12);

    nv.onLocationChange = () => {
      if (this.ready) this.on.location?.(this.readCrosshair());
    };

    this.bind();
    this.resizer = new ResizeObserver(() => this.place());
    this.resizer.observe(this.host);
    this.viewportWatch = new IntersectionObserver(([e]) => {
      this.onScreen = e.isIntersecting;
      this.syncSpin();
    });
    this.viewportWatch.observe(this.host);
    return true;
  }

  // The only place wheel and keys are decided. NiiVue's own wheel listener calls preventDefault before it looks at its
  // scrollRequiresFocus option, so with that option on the page still cannot scroll past the canvas. Capturing here, on the way
  // down, is what lets an unfocused viewer leave the wheel to the page.
  bind() {
    const { host, canvas } = this;
    const ac = new AbortController();
    this.events = ac;
    const opt = { signal: ac.signal };
    host.addEventListener("wheel", (e) => this.onWheel(e), { capture: true, passive: false, signal: ac.signal });
    // The same on a phone: NiiVue's touchstart calls preventDefault too, so a finger landing on the scan could never scroll the page.
    // Until the viewer has focus the touch goes to the page, and a tap still gets through as a click, which gives it focus.
    const passTouch = (e) => {
      if (!this.focused() && this.pageCanScroll()) e.stopPropagation();
    };
    for (const type of ["touchstart", "touchmove", "touchend"]) host.addEventListener(type, passTouch, { capture: true, passive: true, signal: ac.signal });
    host.addEventListener("keydown", (e) => this.onKey(e), { capture: true, signal: ac.signal });
    host.addEventListener("keyup", (e) => e.target === canvas && e.stopPropagation(), { capture: true, signal: ac.signal });
    canvas.addEventListener("pointermove", (e) => this.onPointerMove(e), opt);
    canvas.addEventListener("pointerleave", () => this.on.hover?.(null), opt);
    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e), { capture: true, signal: ac.signal });
    canvas.addEventListener("pointerup", (e) => this.onPointerUp(e), { capture: true, signal: ac.signal });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), opt);
  }

  focused() {
    return this.host.contains(document.activeElement);
  }

  pageCanScroll() {
    for (let el = this.host.parentElement; el; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return true;
    }
    const page = document.scrollingElement;
    return !!page && page.scrollHeight > page.clientHeight + 1;
  }

  onWheel(e) {
    if (!this.ready) return;
    // Waiting for a click only makes sense when the wheel has something else to do. On a page that cannot scroll there is nothing
    // to trap, so the slices move straight away.
    if (!this.focused() && this.pageCanScroll()) {
      // Not ours: stop it before NiiVue's listener, and do not prevent the default, so the page scrolls as if we were not here.
      e.stopPropagation();
      this.on.wheelIgnored?.();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const tile = this.tileAt(e.clientX, e.clientY) ?? this.activeTile;
    if (tile === "render" || e.ctrlKey) {
      // Zoom, the 3D camera or the 2D view. Pinch on a trackpad arrives as ctrl+wheel. (Internal: sliceScroll2D is what NiiVue's
      // own listener would have called.)
      const r = this.canvas.getBoundingClientRect();
      this.nv.sliceScroll2D(e.deltaY < 0 ? -0.01 : 0.01, e.clientX - r.left, e.clientY - r.top);
      return;
    }
    // Wheel mice report 100 or more per notch and get one slice for each; a trackpad's small deltas add up.
    const notches = Math.round(Math.abs(e.deltaY) / 100);
    this.wheelAcc += notches ? Math.sign(e.deltaY) * notches * WHEEL_PX : e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    const steps = Math.trunc(this.wheelAcc / WHEEL_PX);
    if (!steps) return;
    this.wheelAcc -= steps * WHEEL_PX;
    this.activeTile = tile;
    // Scrolling down walks toward the feet, or back, or the patient's right: lower indices in the file's RAS order.
    this.stepSlice(tile, -steps);
  }

  onKey(e) {
    if (e.target !== this.canvas) return;
    e.stopPropagation();
    if (e.key === "Escape") this.canvas.blur();
    if (!this.ready || this.activeTile === "render") return;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") this.stepSlice(this.activeTile, 1);
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") this.stepSlice(this.activeTile, -1);
    else return;
    e.preventDefault();
  }

  // ---- loading ----

  async load({ image, segmentation, imageName, segmentationName }) {
    const token = ++this.loadToken;
    this.ready = false;
    const nv = this.nv;
    this.clearSurfaces();
    this.classes = [];
    this.byId = new Map();
    const list = [{ url: image, name: imageName, colormap: "gray" }];
    if (segmentation) list.push({ url: segmentation, name: segmentationName, colormap: "gray", opacity: this.opacity });
    await nv.loadVolumes(list);
    if (token !== this.loadToken || !this.alive) return null;

    const back = nv.volumes[0];
    const seg = nv.volumes[1] ?? null;
    this.back = back;
    this.seg = seg;
    this.backInverse = invert4(back.hdr.affine);
    this.segInverse = seg ? invert4(seg.hdr.affine) : null;

    const warnings = [];
    let measured = { stats: new Map(), voxelMl: 0, notLabels: 0 };
    let shown = seg;
    if (seg) {
      markAsLabels(seg);
      measured = measureLabels(seg);
      if (measured.notLabels) warnings.push(`${measured.notLabels.toLocaleString()} voxels in the segmentation are not whole numbers, so it may not be a label map.`);
      if (!sameGrid(back, seg)) {
        warnings.push(`The segmentation's grid (${dimsOf(seg)}) differs from the image's (${dimsOf(back)}). It is drawn by world position; check that the two really belong together.`);
        // NiiVue's label shader has no bounds check, so a label map smaller than the image smears its edge voxels across the rest of
        // the volume. What gets drawn is therefore a copy resampled onto the image's grid. Volumes, centres and readouts stay on the
        // original, so its numbers are not disturbed by the resampling.
        shown = resliced(seg, back);
        nv.removeVolume(seg);
        nv.addVolume(shown);
      }
      // The accent layer: the same voxels, sharing the same memory, with only the focused class switched on. NiiVue's label shader
      // treats a colour's alpha as on or off, so a class cannot be dimmed in the colour table; instead every class fades together
      // by lowering the layer's opacity and this second layer draws the focused one back at full strength. (Internal: a shallow
      // copy of an NVImage, sharing img and hdr.)
      const accent = Object.assign(Object.create(Object.getPrototypeOf(shown)), shown);
      accent.id = `${shown.id}-focus`;
      accent.name = `${shown.name}-focus`;
      accent.opacity = 0;
      nv.addVolume(accent);
      this.accent = accent;
      this.shown = shown;
    } else {
      this.accent = null;
      this.shown = null;
    }

    // Air at around -1000 only happens in Hounsfield units. The modality prop overrides this for a CT cropped to inside the body.
    const modality = back.global_min < -500 ? "CT" : "MR";
    this.place();
    this.ready = true;
    return {
      modality,
      dims: [back.dimsRAS[1], back.dimsRAS[2], back.dimsRAS[3]],
      spacing: [back.pixDimsRAS[1], back.pixDimsRAS[2], back.pixDimsRAS[3]],
      stats: measured.stats,
      embedded: seg ? embeddedLabels(seg.hdr) : null,
      warnings,
      range: autoWindow(back),
    };
  }

  // ---- classes, colours and the overlay ----

  setClasses(classes) {
    // Same structures with new colours or names: the surfaces stand as they are and only take the new colour.
    const sameShapes = this.classes.length === classes.length && classes.every((c, i) => c.id === this.classes[i].id);
    this.classes = classes;
    this.byId = new Map(classes.map((c) => [c.id, c]));
    this.repaint();
    if (sameShapes) {
      for (const [id, mesh] of this.meshes) {
        const [r, g, b] = hexToRgb(this.byId.get(id).color);
        mesh.rgba255 = new Uint8Array([r, g, b, 255]);
        mesh.updateMesh(this.nv.gl);
      }
      this.nv.drawScene();
      return;
    }
    this.clearSurfaces();
    this.buildSurfaces();
  }

  setOverlay({ hidden = this.hidden, focus = this.focus, opacity = this.opacity, outline = this.outline }) {
    const outlineChanged = outline !== this.outline;
    this.hidden = hidden;
    this.focus = focus;
    this.opacity = opacity;
    this.outline = outline;
    if (outlineChanged) this.nv.opts.atlasOutline = outline ? 1 : 0;
    this.repaint();
  }

  table(allow) {
    const maxId = Math.max(0, ...this.classes.map((c) => c.id));
    const size = maxId + 1;
    const R = new Array(size).fill(0);
    const G = new Array(size).fill(0);
    const B = new Array(size).fill(0);
    const A = new Array(size).fill(0);
    const labels = new Array(size).fill("");
    for (const c of this.classes) {
      const [r, g, b] = hexToRgb(c.color);
      R[c.id] = r;
      G[c.id] = g;
      B[c.id] = b;
      A[c.id] = allow(c) ? 255 : 0;
      labels[c.id] = c.name;
    }
    return { R, G, B, A, I: R.map((_, i) => i), labels };
  }

  repaint() {
    const { nv, shown, accent } = this;
    if (!shown || !this.classes.length) return;
    const { hidden, focus } = this;
    const hasFocus = focus != null && !hidden.has(focus);
    shown.setColormapLabel(this.table((c) => !hidden.has(c.id)));
    accent.setColormapLabel(this.table((c) => hasFocus && c.id === focus));
    // Outlines are drawn at full strength by the shader, so the fill under them is taken right down.
    const fill = this.outline ? this.opacity * 0.25 : this.opacity;
    shown.opacity = hasFocus ? fill * 0.28 : fill;
    accent.opacity = hasFocus ? Math.min(1, Math.max(this.opacity, 0.3) + 0.2) : 0;
    // Only the overlay layers: updateGLVolume would also rebuild the image's own texture, which makes a slider stutter on a big
    // scan even though nothing about the image changed. (Internal: refreshLayers, with the layer numbers updateGLVolume would use.)
    nv.refreshLayers(shown, 1);
    nv.refreshLayers(accent, 2);
    this.styleSurfaces();
  }

  setWindow(min, max) {
    if (!this.back) return;
    this.back.cal_min = min;
    this.back.cal_max = max;
    this.nv.updateGLVolume();
  }

  // ---- layout ----

  setLayout(layout) {
    this.layout = layout;
    this.place();
    this.syncSpin();
  }

  place() {
    const { nv, host } = this;
    if (!nv || !this.back) return;
    const W = host.clientWidth;
    const H = host.clientHeight;
    if (W < 2 || H < 2) return;
    const { cols, rows, tiles } = LAYOUTS[this.layout];
    const tw = (W - GAP_PX * (cols - 1)) / cols;
    const th = (H - GAP_PX * (rows - 1)) / rows;
    const out = [];
    const spec = tiles.map((plane, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const left = col * (tw + GAP_PX);
      const top = row * (th + GAP_PX);
      const image = plane === "render" ? th : th - STRIP_PX;
      out.push({ plane, left, top, width: tw, height: th, label: PLANES[plane].label });
      return { sliceType: PLANES[plane].type, position: [left / W, top / H, tw / W, image / H] };
    });
    this.tiles = out;
    // (Internal: customLayout, set directly so the validity check does not reject tiles that touch after rounding.)
    nv.customLayout = spec;
    nv.drawScene();
    if (!this.tiles.some((t) => t.plane === this.activeTile)) this.activeTile = tiles[0];
    this.on.layout?.(out);
    if (this.ready) this.on.location?.(this.readCrosshair());
  }

  tileAt(clientX, clientY) {
    if (!this.tiles) return null;
    const r = this.host.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    return this.tiles.find((t) => x >= t.left && x < t.left + t.width && y >= t.top && y < t.top + t.height)?.plane ?? null;
  }

  // ---- slices and the crosshair ----

  slices() {
    const { nv, back } = this;
    const v = nv.frac2vox(nv.scene.crosshairPos);
    const d = back.dimsRAS;
    return { sagittal: { i: v[0], n: d[1] }, coronal: { i: v[1], n: d[2] }, axial: { i: v[2], n: d[3] } };
  }

  setSlice(plane, index) {
    const { nv, back } = this;
    const axis = PLANES[plane]?.axis;
    if (axis == null || axis < 0) return;
    this.activeTile = plane;
    const v = Array.from(nv.frac2vox(nv.scene.crosshairPos));
    v[axis] = Math.max(0, Math.min(back.dimsRAS[axis + 1] - 1, Math.round(index)));
    this.moveCrosshair(nv.vox2frac(v));
  }

  stepSlice(plane, delta) {
    const s = this.slices()[plane];
    if (s) this.setSlice(plane, s.i + delta);
  }

  moveCrosshair(frac, glide = false) {
    const { nv } = this;
    cancelAnimationFrame(this.glide);
    if (!glide || isStill()) {
      nv.scene.crosshairPos = frac;
      nv.createOnLocationChange();
      nv.drawScene();
      return;
    }
    const from = Array.from(nv.scene.crosshairPos);
    const start = performance.now();
    const step = (now) => {
      if (!this.alive) return;
      const t = Math.min(1, (now - start) / 320);
      const e = 1 - (1 - t) ** 3;
      nv.scene.crosshairPos = from.map((f, i) => f + (frac[i] - f) * e);
      if (t < 1) {
        nv.drawScene();
        this.glide = requestAnimationFrame(step);
      } else {
        nv.scene.crosshairPos = frac;
        nv.createOnLocationChange();
        nv.drawScene();
      }
    };
    this.glide = requestAnimationFrame(step);
  }

  // Jump to the voxel of a class nearest its centre.
  jumpTo(id, glide = true) {
    const klass = this.byId.get(id);
    if (!klass) return;
    const voxel = nearestVoxelOf(this.seg, id, klass);
    if (!voxel) return;
    const mm = apply4(this.seg.hdr.affine, voxel);
    this.moveCrosshair(this.nv.mm2frac(mm, 0, true), glide);
  }

  // ---- reading the data ----

  // Reads go through the image's own voxel grid, not the screen, so the numbers are the file's numbers. A world position outside
  // a volume reads as nothing: NiiVue's getValue would clamp it to the nearest edge voxel and report that voxel's value.
  readAt(mm, source) {
    const { back, seg } = this;
    const value = sample(back, mm);
    const voxel = apply4(this.backInverse, mm).map((v) => Math.round(v));
    const rawId = seg ? sample(seg, mm) : null;
    const id = rawId == null ? 0 : Math.round(rawId);
    const klass = this.byId.get(id) ?? null;
    // The position reported is the voxel's centre, as any other tool would give it, not wherever in the voxel the pointer happened to be.
    return { source, mm: apply4(back.hdr.affine, voxel), voxel, value, id, klass, slices: this.slices() };
  }

  readCrosshair() {
    const mm = this.nv.frac2mm(this.nv.scene.crosshairPos, 0, true);
    return this.readAt(mm, "crosshair");
  }

  // The structure under a point of the 3D tile: walk the view ray through the label volume to the first class that is showing.
  // Taking the inverse of NiiVue's own camera matrix guarantees this agrees with what was drawn. (Internal: calculateMvpMatrix.)
  pick3D(clientX, clientY) {
    const { nv, seg } = this;
    if (!seg) return null;
    const tile = nv.screenSlices.find((s) => s.axCorSag === 4);
    if (!tile) return null;
    const r = this.canvas.getBoundingClientRect();
    const dpr = nv.uiData.dpr;
    const [l, t, w, h] = tile.leftTopWidthHeight;
    const nx = (2 * ((clientX - r.left) * dpr - l)) / w - 1;
    const ny = 1 - (2 * ((clientY - r.top) * dpr - t)) / h;
    if (Math.abs(nx) > 1 || Math.abs(ny) > 1) return null;
    const [mvp] = nv.calculateMvpMatrix(null, [l, t, w, h], nv.scene.renderAzimuth, nv.scene.renderElevation);
    const inv = invertColumnMajor(mvp);
    if (!inv) return null;
    const a = unproject(inv, nx, ny, -1);
    const b = unproject(inv, nx, ny, 1);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const stepMm = Math.max(0.5, Math.min(seg.hdr.pixDims[1], seg.hdr.pixDims[2], seg.hdr.pixDims[3]) / 2);
    const steps = Math.min(4000, Math.ceil(length / stepMm));
    const { nx: dx, ny: dy, nz: dz, at } = labelVoxels(seg);
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      const mm = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      const v = apply4(this.segInverse, mm).map(Math.round);
      if (v[0] < 0 || v[1] < 0 || v[2] < 0 || v[0] >= dx || v[1] >= dy || v[2] >= dz) continue;
      const id = Math.round(at(v[0] + v[1] * dx + v[2] * dx * dy));
      if (id && this.byId.has(id) && !this.hidden.has(id)) return { id, mm };
    }
    return null;
  }

  onPointerMove(e) {
    if (!this.ready) return;
    if (e.buttons) return;
    this.pointer = { x: e.clientX, y: e.clientY };
    if (this.hoverFrame) return;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      if (!this.alive || !this.pointer) return;
      this.emitHover(this.pointer.x, this.pointer.y);
    });
  }

  emitHover(clientX, clientY) {
    const { nv } = this;
    const tile = this.tileAt(clientX, clientY);
    const r = this.canvas.getBoundingClientRect();
    const place = { x: clientX - r.left, y: clientY - r.top };
    if (tile === "render") {
      const hit = this.renderMode === "surface" ? this.pick3D(clientX, clientY) : null;
      this.on.hover?.(hit ? { ...this.readAt(hit.mm, "pointer"), ...place } : null);
      return;
    }
    const dpr = nv.uiData.dpr;
    const frac = nv.canvasPos2frac([place.x * dpr, place.y * dpr]);
    if (!frac || frac[0] < 0) {
      this.on.hover?.(null);
      return;
    }
    this.on.hover?.({ ...this.readAt(nv.frac2mm(frac, 0, true), "pointer"), ...place });
  }

  onPointerDown(e) {
    const tile = this.tileAt(e.clientX, e.clientY);
    if (tile) this.activeTile = tile;
    this.down = { x: e.clientX, y: e.clientY, tile };
    if (tile === "render" && this.spin) this.setSpin(false, true);
  }

  onPointerUp(e) {
    const d = this.down;
    this.down = null;
    if (!d || d.tile !== "render" || e.button !== 0) return;
    // A click, not the end of a rotation: select what is under it.
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
    const hit = this.pick3D(e.clientX, e.clientY);
    this.on.pick?.(hit ? hit.id : null);
    if (hit) this.jumpTo(hit.id);
  }

  // ---- surfaces ----

  clearSurfaces() {
    this.surfaceToken = (this.surfaceToken ?? 0) + 1;
    const { nv } = this;
    if (!nv) return;
    for (const mesh of this.meshes.values()) mesh.unloadMesh?.(nv.gl);
    this.bodyMesh?.unloadMesh?.(nv.gl);
    this.meshes = new Map();
    this.bodyMesh = null;
    nv.meshes = [];
    this.on.surfaces?.({ done: 0, total: 0, building: false });
  }

  // One class at a time, largest first, giving the browser a turn between each so the slices stay usable while the 3D fills in.
  async buildSurfaces() {
    const { nv, seg, back, NVMesh } = this;
    const token = this.surfaceToken;
    const ordered = [...this.classes].sort((a, b) => b.voxels - a.voxels);
    const total = ordered.length + 1;
    const grid = seg ? thinLabels(seg) : null;
    const startedAt = performance.now();
    this.on.surfaces?.({ done: 0, total, building: true });
    let done = 0;
    for (const c of ordered) {
      await yieldNow();
      if (token !== this.surfaceToken || !this.alive) return;
      // Large organs show the slice staircase as ripples, so they get more smoothing than a rib or vessel could survive.
      const { positions, tris } = classSurface(grid, c.id, c.box, seg.hdr.affine, c.voxels > 1500 ? 24 : 12);
      if (tris.length) {
        const [r, g, b] = hexToRgb(c.color);
        const mesh = new NVMesh(positions, tris, c.name, new Uint8Array([r, g, b, 255]), 1, !this.hidden.has(c.id), nv.gl);
        mesh.meshShaderIndex = this.wetShader;
        this.meshes.set(c.id, mesh);
      }
      done++;
      this.styleSurfaces();
      this.on.surfaces?.({ done, total, building: true });
    }
    await yieldNow();
    if (token !== this.surfaceToken || !this.alive) return;
    const threshold = back.global_min < -500 ? -300 : back.cal_min + 0.12 * (back.cal_max - back.cal_min);
    const body = bodySurface(back, threshold);
    if (body?.tris.length) {
      const mesh = new NVMesh(body.positions, body.tris, "Body", new Uint8Array([225, 232, 240, 255]), 0.99, this.showBody, nv.gl);
      mesh.meshShaderIndex = this.glassShader;
      this.bodyMesh = mesh;
    }
    this.styleSurfaces();
    this.surfaceMs = performance.now() - startedAt;
    this.on.surfaces?.({ done: total, total, building: false });
  }

  // Visibility and fade are per mesh, no rebuild. Solid surfaces go first: a translucent mesh does not write depth, so anything
  // drawn after it would paint over it.
  styleSurfaces() {
    const { nv, hidden, focus } = this;
    if (!nv) return;
    const hasFocus = focus != null && !hidden.has(focus);
    const solid = [];
    const faded = [];
    for (const [id, mesh] of this.meshes) {
      mesh.visible = this.renderMode === "surface" && !hidden.has(id);
      mesh.opacity = hasFocus && id !== focus ? 0.1 : 1;
      (mesh.opacity < 1 ? faded : solid).push(mesh);
    }
    const list = [...solid, ...faded];
    if (this.bodyMesh) {
      this.bodyMesh.visible = this.renderMode === "surface" && this.showBody;
      list.push(this.bodyMesh);
    }
    nv.meshes = list;
    nv.drawScene();
  }

  setRenderMode(mode) {
    if (mode === this.renderMode) return;
    this.renderMode = mode;
    this.nv.setVolumeRenderIllumination(mode === "volume" ? 0.5 : 0);
    this.styleSurfaces();
    this.syncSpin();
  }

  setBody(show) {
    this.showBody = show;
    this.styleSurfaces();
  }

  // ---- gentle turn of the 3D view ----

  setSpin(on, fromUser = false) {
    this.spin = on;
    this.syncSpin();
    if (fromUser) this.on.spin?.(on);
  }

  syncSpin() {
    cancelAnimationFrame(this.spinFrame);
    const show = this.spin && this.onScreen && !isStill() && LAYOUTS[this.layout].tiles.includes("render");
    if (!show) return;
    let last = 0;
    const tick = (now) => {
      if (!this.alive) return;
      this.spinFrame = requestAnimationFrame(tick);
      // Around 30 frames a second is plenty for a slow turn, and the slices share this canvas.
      if (now - last < 33 || !this.nv || document.hidden) return;
      const dt = last ? now - last : 33;
      last = now;
      if (this.ready) this.nv.setRenderAzimuthElevation(this.nv.scene.renderAzimuth + dt * 0.012, this.nv.scene.renderElevation);
    };
    this.spinFrame = requestAnimationFrame(tick);
  }

  resetView() {
    const { nv } = this;
    nv.scene.pan2Dxyzmm = [0, 0, 0, 1];
    nv.scene.volScaleMultiplier = 1;
    nv.setRenderAzimuthElevation(150, 12);
    nv.drawScene();
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.spinFrame);
    cancelAnimationFrame(this.glide);
    cancelAnimationFrame(this.hoverFrame);
    this.events?.abort();
    this.resizer?.disconnect();
    this.viewportWatch?.disconnect();
    const { nv, canvas } = this;
    if (nv) {
      const gl = nv._gl;
      try {
        nv.cleanup();
      } catch {
        // Nothing to do: the context is going away either way.
      }
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    }
    canvas?.remove();
  }
}

// NiiVue picks its integer label shader only for files that declare NIFTI_INTENT_LABEL, and TotalSegmentator's, nnU-Net's and MONAI's
// do not. Without it the labels go through the continuous shader, which rounds every voxel up to at least 2/256 of the colour table
// and then filters between table entries, so label 0 picks up a share of label 1 and the whole image gets a tint. The label shader
// reads whole numbers from 8 or 16 bit data only, so anything else (floats from MONAI, int32) is converted first. (Internal: hdr.)
function markAsLabels(vol) {
  const { hdr } = vol;
  const direct = hdr.datatypeCode === 2 || hdr.datatypeCode === 4 || hdr.datatypeCode === 512;
  if (!direct) {
    const { at, nx, ny, nz } = labelVoxels(vol);
    const out = new Uint16Array(nx * ny * nz);
    for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(65535, Math.round(at(i))));
    vol.img = out;
    hdr.datatypeCode = 512;
    hdr.numBitsPerVoxel = 16;
    hdr.scl_slope = 1;
    hdr.scl_inter = 0;
  }
  hdr.intent_code = 1002;
}

// A display window for an image with no standard units. NiiVue's default stops at the 98th percentile, which burns out fat on a T1 MR.
function autoWindow(vol) {
  const { img, hdr } = vol;
  const stride = Math.max(1, Math.floor(img.length / 200000));
  const slope = !hdr.scl_slope || Number.isNaN(hdr.scl_slope) ? 1 : hdr.scl_slope;
  const inter = Number.isNaN(hdr.scl_inter) ? 0 : hdr.scl_inter || 0;
  const values = new Float32Array(Math.ceil(img.length / stride));
  for (let i = 0, n = 0; i < img.length; i += stride, n++) values[n] = img[i] * slope + inter;
  values.sort();
  return [values[Math.floor(values.length * 0.02)], values[Math.floor(values.length * 0.998)]];
}

// A label map on another volume's grid, nearest voxel, for drawing only.
function resliced(seg, back) {
  const { hdr } = back;
  const nx = hdr.dims[1];
  const ny = hdr.dims[2];
  const nz = Math.max(hdr.dims[3], 1);
  const { nx: sx, ny: sy, nz: sz, at } = labelVoxels(seg);
  const toSeg = invert4(seg.hdr.affine);
  const out = new Uint16Array(nx * ny * nz);
  for (let k = 0, n = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++, n++) {
        const v = apply4(toSeg, apply4(hdr.affine, [i, j, k]));
        const x = Math.round(v[0]);
        const y = Math.round(v[1]);
        const z = Math.round(v[2]);
        if (x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz) out[n] = Math.max(0, at(x + y * sx + z * sx * sy));
      }
  const copy = back.clone();
  copy.id = `${seg.id}-resliced`;
  copy.name = `${seg.name}-resliced`;
  copy.img = out;
  copy.hdr.datatypeCode = 512;
  copy.hdr.numBitsPerVoxel = 16;
  copy.hdr.scl_slope = 1;
  copy.hdr.scl_inter = 0;
  copy.hdr.intent_code = 1002;
  return copy;
}

function sample(vol, mm) {
  const v = vol.mm2vox([mm[0], mm[1], mm[2]]);
  const d = vol.dimsRAS;
  if (v[0] < 0 || v[1] < 0 || v[2] < 0 || v[0] >= d[1] || v[1] >= d[2] || v[2] >= d[3]) return null;
  return vol.getValue(v[0], v[1], v[2]);
}

function sameGrid(a, b) {
  for (let i = 1; i <= 3; i++) if (a.hdr.dims[i] !== b.hdr.dims[i]) return false;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if (Math.abs(a.hdr.affine[r][c] - b.hdr.affine[r][c]) > 1e-2) return false;
  return true;
}

const dimsOf = (v) => `${v.hdr.dims[1]}×${v.hdr.dims[2]}×${v.hdr.dims[3]}`;

// gl-matrix's matrices are column-major. NiiVue depends on it but this file does not, and one small inverse is not worth an import.
function invertColumnMajor(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ];
}

function unproject(inv, x, y, z) {
  const w = inv[3] * x + inv[7] * y + inv[11] * z + inv[15];
  return [(inv[0] * x + inv[4] * y + inv[8] * z + inv[12]) / w, (inv[1] * x + inv[5] * y + inv[9] * z + inv[13]) / w, (inv[2] * x + inv[6] * y + inv[10] * z + inv[14]) / w];
}
