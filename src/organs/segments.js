// One colour per part, for the segmentation view, its legend and the faces of a slice. A medical segmentation has to separate
// neighbours at a glance, so hues step by the golden angle: parts next to each other in the list land far apart on the wheel,
// and the lightness tiers keep a model with over a hundred parts from running out of distinct colours.
const GOLDEN = 137.508;
// The Okabe-Ito set: chosen to stay apart under every common colour-vision deficiency.
const SAFE = ["#D55E00", "#56B4E9", "#F0E442", "#009E73", "#CC79A7", "#E69F00", "#0072B2", "#FFFFFF"];
const SAFE_SHADE = [0, 0.3, -0.3];

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function shade(hex, by) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(by >= 0 ? c + (255 - c) * by : c * (1 + by)).toString(16).padStart(2, "0");
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/** Part id to CSS colour. `safe` swaps in the colour-blind-safe set the High contrast palette uses. */
export function segmentColors(manifest, { safe = false } = {}) {
  const out = {};
  const parts = manifest.parts ?? [];
  parts.forEach((p, i) => {
    if (safe) {
      const tier = Math.floor(i / SAFE.length) % SAFE_SHADE.length;
      out[p.id] = shade(SAFE[i % SAFE.length], SAFE_SHADE[tier]);
    } else {
      const light = [0.52, 0.64, 0.42][i % 3];
      const sat = [0.86, 0.74, 0.8][i % 3];
      out[p.id] = hsl((8 + i * GOLDEN) % 360, sat, light);
    }
  });
  return out;
}
