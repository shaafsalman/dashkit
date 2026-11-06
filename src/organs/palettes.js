// The colour options. A palette says, per kind of tissue, what colour to remap it to and how it behaves: how glassy, how much
// it glows from within, and what colour its grazing edge turns. The baked shadow always survives the remap, because the shader
// multiplies the new colour by how light or dark the original was against that part's own average.
//
// Ember, Hologram and Ocean share one idea: a pale shell, nearly clear face on and bright at grazing angles, around saturated
// contents that seem lit from within. Nothing here names an organ; it reads only a part's kind, vessel flag, blood and glow.

const hotOf = (ctx) => !!ctx.hot;

// Sorts a part into the handful of roles a palette needs to tell apart.
export function roleOf(part, ctx = {}) {
  const k = part.kind;
  if (k === "skin" || k === "capsule" || ((part.glass ?? 0) >= 0.8 && k !== "lung")) return "shell";
  if (hotOf(ctx)) return "hot";
  if (part.vessel && (k !== "airway" && k !== "cartilage")) return ctx.blood === "vein" ? "vein" : ctx.blood === "artery" ? "artery" : k === "vein" || k === "pulmonary" ? "vein" : "artery";
  if (k === "artery" || k === "coronary" || k === "coral") return "artery";
  if (k === "vein" || k === "pulmonary") return "vein";
  if (k === "lung") return "lung";
  if (k === "airway" || k === "cartilage") return k;
  if (k === "valve") return "valve";
  if (k === "bone") return "bone";
  if (k === "nerve") return "nerve";
  if (k === "gut") return "gut";
  if (k === "brain" || k === "deep") return k;
  if (k === "fluid") return "fluid";
  if (k === "muscle") return "muscle";
  return "organ"; // liver, kidney, pyramid, gland and anything new
}

// Each entry: c colour, g glass, e glow from within, r edge colour by theme [dark, light], ra how far the edge turns that colour.
const pale = { r: ["#ffffff", "#8796a8"], ra: 0.75 };

export const PALETTES = [
  {
    id: "natural",
    label: "Natural",
    swatch: ["#8e1c22", "#c9a24a", "#2b4c9b"],
    roles: {},
  },
  {
    id: "ocean",
    label: "Ocean",
    swatch: ["#1c93e6", "#7fd0ff", "#ff7a59"],
    halo: "#3aa8ff",
    roles: {
      shell: { c: "#a9dcff", g: 0.9, e: 0.04, r: ["#d9f1ff", "#2f7fbf"], ra: 0.8 },
      lung: { c: "#1693ee", g: 0.34, e: 0.14, r: ["#c8ecff", "#0f6fc0"], ra: 0.55, gloss: 1.3 },
      muscle: { c: "#1b84de", e: 0.1, r: ["#9fdcff", "#0d5fae"], ra: 0.4 },
      organ: { c: "#1f8ae4", e: 0.1, r: ["#9fdcff", "#0d5fae"], ra: 0.4 },
      hot: { c: "#ff6a44", e: 0.7, r: ["#ffd6c2", "#ff5a2a"], ra: 0.5, halo: 0.6 },
      brain: { c: "#3aa8ee", e: 0.12, r: ["#c8ecff", "#1270c0"], ra: 0.4 },
      deep: { c: "#63c3f5", e: 0.16, r: ["#e0f5ff", "#1a7fcc"], ra: 0.3 },
      artery: { c: "#ff7450", e: 0.28, r: ["#ffe0cc", "#e0502a"], ra: 0.3 },
      vein: { c: "#ff9270", e: 0.22, r: ["#ffe6d6", "#e0603a"], ra: 0.3 },
      airway: { c: "#c9785f", r: ["#f0c4b4", "#a4553e"], ra: 0.25 },
      cartilage: { c: "#e8a58c", r: ["#ffdccc", "#b9694f"], ra: 0.25 },
      valve: { c: "#bfe6ff", e: 0.1, r: ["#ffffff", "#3f8fcf"], ra: 0.3 },
      bone: { c: "#d6ecff", e: 0.05, r: ["#ffffff", "#6d9fc4"], ra: 0.3 },
      nerve: { c: "#ffd27a", e: 0.2, r: ["#fff0cc", "#c98d1e"], ra: 0.2 },
      gut: { c: "#6fb9ee", e: 0.06, r: ["#d9f1ff", "#2f7fbf"], ra: 0.35 },
      fluid: { c: "#8bd4ff", g: 0.4, e: 0.14, r: ["#ffffff", "#2f8fd0"], ra: 0.4 },
    },
  },
  {
    id: "ember",
    label: "Ember",
    swatch: ["#eef1f5", "#ff4a16", "#ffb36b"],
    halo: "#ff5a22",
    roles: {
      shell: { c: "#eef2f6", g: 0.93, e: 0.02, ...pale },
      hot: { c: "#ff2a06", e: 0.62, r: ["#ffd070", "#ff8a2a"], ra: 0.62, halo: 1, gloss: 0.8 },
      muscle: { c: "#ff2f08", e: 0.42, r: ["#ffc870", "#ff7a22"], ra: 0.55, halo: 0.75, gloss: 0.8 },
      organ: { c: "#ff340c", e: 0.38, r: ["#ffc870", "#ff7a22"], ra: 0.5, halo: 0.6, gloss: 0.8 },
      brain: { c: "#ff5a22", e: 0.3, r: ["#ffcf90", "#f06a20"], ra: 0.4 },
      deep: { c: "#ff8a3a", e: 0.32, r: ["#ffe2b8", "#f08a30"], ra: 0.35 },
      lung: { c: "#f7a08f", g: 0.55, e: 0.22, r: ["#ffe3da", "#d9806e"], ra: 0.55 },
      artery: { c: "#ff2a0c", e: 0.42, r: ["#ffc08a", "#e0401a"], ra: 0.3 },
      vein: { c: "#2f66ff", e: 0.26, r: ["#b8ceff", "#2a58d0"], ra: 0.3 },
      airway: { c: "#f2c9b8", g: 0.4, e: 0.08, ...pale, ra: 0.5 },
      cartilage: { c: "#f7e4d8", g: 0.3, e: 0.05, ...pale, ra: 0.5 },
      valve: { c: "#ffd9b0", e: 0.3, r: ["#fff0d8", "#e0985a"], ra: 0.3 },
      bone: { c: "#f4f1ea", g: 0.6, e: 0.03, ...pale },
      nerve: { c: "#ffc56e", e: 0.35, r: ["#fff0cc", "#c98d1e"], ra: 0.2 },
      gut: { c: "#e9d6c0", e: 0.05, r: ["#fff4e4", "#b9a389"], ra: 0.4 },
      fluid: { c: "#ffd8b0", g: 0.45, e: 0.2, ...pale },
    },
  },
  {
    id: "hologram",
    label: "Hologram",
    swatch: ["#7cc4ff", "#2a7fff", "#ff3b52"],
    halo: "#ff3f78",
    roles: {
      shell: { c: "#7cc4ff", g: 0.9, e: 0.1, r: ["#cfeaff", "#2a86e0"], ra: 0.9 },
      hot: { c: "#ff2e44", e: 0.95, r: ["#ffb7c4", "#ff3f78"], ra: 0.6, halo: 1 },
      muscle: { c: "#4aa3ff", g: 0.55, e: 0.22, r: ["#d6eeff", "#1f78d8"], ra: 0.85 },
      organ: { c: "#4aa3ff", g: 0.55, e: 0.22, r: ["#d6eeff", "#1f78d8"], ra: 0.85 },
      lung: { c: "#5aa9ff", g: 0.7, e: 0.2, r: ["#d6eeff", "#1f78d8"], ra: 0.85 },
      brain: { c: "#8cc8ff", g: 0.3, e: 0.32, r: ["#ecf8ff", "#2a86e0"], ra: 0.6 },
      deep: { c: "#a9d8ff", g: 0.2, e: 0.34, r: ["#ecf8ff", "#2a86e0"], ra: 0.5 },
      artery: { c: "#ff2f55", e: 0.6, r: ["#ffc2cf", "#e0244a"], ra: 0.35 },
      vein: { c: "#1f5bff", e: 0.45, r: ["#b8ceff", "#1a48d0"], ra: 0.35 },
      airway: { c: "#9fd2ff", g: 0.4, e: 0.2, r: ["#ecf8ff", "#2a86e0"], ra: 0.7 },
      cartilage: { c: "#c6e6ff", g: 0.3, e: 0.2, r: ["#ecf8ff", "#2a86e0"], ra: 0.6 },
      valve: { c: "#d6eeff", e: 0.3, r: ["#ffffff", "#2a86e0"], ra: 0.5 },
      bone: { c: "#cfe8ff", g: 0.55, e: 0.15, r: ["#ffffff", "#3f8fd8"], ra: 0.7 },
      nerve: { c: "#bfe4ff", e: 0.4, r: ["#ffffff", "#2a86e0"], ra: 0.5 },
      gut: { c: "#6fb4ff", g: 0.6, e: 0.14, r: ["#d6eeff", "#1f78d8"], ra: 0.8 },
      fluid: { c: "#bfe4ff", g: 0.4, e: 0.3, r: ["#ffffff", "#2a86e0"], ra: 0.6 },
    },
  },
  {
    id: "contrast",
    label: "High contrast",
    swatch: ["#D55E00", "#F0E442", "#0072B2"],
    safeSegments: true,
    roles: {
      shell: { c: "#9aa3ad", g: 0.86, r: ["#ffffff", "#000000"], ra: 0.9 },
      hot: { c: "#D55E00", e: 0.25, r: ["#ffffff", "#000000"], ra: 0.25 },
      muscle: { c: "#D55E00", r: ["#ffffff", "#000000"], ra: 0.25 },
      organ: { c: "#CC79A7", r: ["#ffffff", "#000000"], ra: 0.25 },
      lung: { c: "#56B4E9", r: ["#ffffff", "#000000"], ra: 0.25 },
      brain: { c: "#56B4E9", r: ["#ffffff", "#000000"], ra: 0.25 },
      deep: { c: "#009E73", r: ["#ffffff", "#000000"], ra: 0.25 },
      artery: { c: "#E69F00", e: 0.1, r: ["#ffffff", "#000000"], ra: 0.25 },
      vein: { c: "#0072B2", e: 0.1, r: ["#ffffff", "#000000"], ra: 0.25 },
      airway: { c: "#F0E442", r: ["#ffffff", "#000000"], ra: 0.25 },
      cartilage: { c: "#FFFFFF", r: ["#ffffff", "#000000"], ra: 0.25 },
      valve: { c: "#F0E442", r: ["#ffffff", "#000000"], ra: 0.25 },
      bone: { c: "#FFFFFF", r: ["#ffffff", "#000000"], ra: 0.25 },
      nerve: { c: "#F0E442", r: ["#ffffff", "#000000"], ra: 0.25 },
      gut: { c: "#009E73", r: ["#ffffff", "#000000"], ra: 0.25 },
      fluid: { c: "#56B4E9", g: 0.3, r: ["#ffffff", "#000000"], ra: 0.25 },
    },
  },
];

export const paletteOf = (id) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/** What a palette does to one part. An empty spec means the part keeps the colour it was baked with. */
export function paintFor(palette, part, ctx) {
  const spec = palette.roles[roleOf(part, ctx)];
  if (!spec) return { color: null, glass: undefined, emit: 0, rim: null, rimAmt: 0, halo: 0, gloss: 1 };
  return {
    color: spec.c ?? null,
    glass: spec.g,
    emit: spec.e ?? 0,
    rim: spec.r ? spec.r[ctx.light ? 1 : 0] : null,
    rimAmt: spec.ra ?? 0,
    halo: spec.halo ?? 0,
    gloss: spec.gloss ?? 1,
  };
}

// The X-ray and flow views keep their colours whatever the palette: red and blue must always mean the same thing.
export const BLOOD = { artery: "#e8141f", vein: "#1f5fff", air: "#bfe6ff" };
export const XRAY = {
  dark: { tissue: "#a9d0f5", dense: "#eaf6ff", edge: "#cfe8ff" },
  light: { tissue: "#34597d", dense: "#0d2d4d", edge: "#143c63" },
};
