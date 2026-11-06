import { segmentColors } from "../organs/segments.js";
import { TOTAL, TOTAL_MR } from "./totalsegmentator.js";

// Classes fall into body systems, which is how the legend groups them. Colours do not follow the systems; see ATLAS below.
export const SYSTEMS = [
  { id: "vessels", label: "Heart and vessels" },
  { id: "digestive", label: "Digestive" },
  { id: "lungs", label: "Lungs and airway" },
  { id: "urinary", label: "Urinary and pelvic" },
  { id: "nervous", label: "Brain and cord" },
  // Bones keep anatomical order in the legend, since L1 next to L2 reads better than the largest first.
  { id: "bones", label: "Bones", ordered: true },
  { id: "muscles", label: "Muscles" },
  { id: "glands", label: "Spleen and glands" },
  { id: "other", label: "Other classes" },
];

const SYSTEM_RULES = [
  ["bones", /vertebra|(^|_)rib(_|$)|sternum|costal|(^|_)hip(_|$)|femur|humerus|scapula|clavic|sacrum|skull|tibia|fibula|patella|(^|_)bone|intervertebral|mandible/],
  ["muscles", /gluteus|autochthon|iliopsoas|muscle|quadriceps|sartorius|thigh|calf/],
  ["vessels", /heart|atrial|ventric|myocard|aort|arter|vein|vena|trunk|carotid|subclav|vessel|coronary/],
  ["lungs", /lung|trachea|airway|bronch|pleura/],
  ["digestive", /esophag|oesophag|stomach|duoden|bowel|colon|rectum|liver|hepatic|gallbladder|pancrea|intestin/],
  ["urinary", /kidney|renal|bladder|prostate|ureter|uterus|ovary/],
  ["nervous", /brain|spinal_cord|(^|_)cord(_|$)|nerve|cerebr|cerebell/],
  ["glands", /adrenal|thyroid|spleen|lymph|thymus/],
];

const clean = (name) => String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function systemOf(name) {
  const key = clean(name);
  return SYSTEM_RULES.find(([, rule]) => rule.test(key))?.[0] ?? "other";
}

// Colours come from the organ library's own segmentColors, worked out once from the whole class list and not from what a scan
// happens to contain. segmentColors goes by position in the list, so the list is fixed and new names only ever go on the end: the
// liver is the same colour in every scan, in the slices and in 3D.
const KNOWN = [...new Set([...Object.values(TOTAL), ...Object.values(TOTAL_MR)])];
const MANIFEST = { groups: SYSTEMS, parts: KNOWN.map((id) => ({ id: clean(id), group: systemOf(id) })) };
const ATLAS = segmentColors(MANIFEST);
// The colour-blind-safe set, which the organ viewer calls High contrast.
const ATLAS_SAFE = segmentColors(MANIFEST, { safe: true });

// The colour of a named structure, or null when it is not one the atlas knows.
export function structureColor(name, { safe = false } = {}) {
  return (safe ? ATLAS_SAFE : ATLAS)[clean(name)] ?? null;
}

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// A class the atlas does not know still needs a colour that does not depend on what else is in the scan. The golden angle keeps
// neighbouring ids well apart on the wheel.
function colorFromId(id) {
  return hsl((id * 137.508) % 360, 0.72, [0.56, 0.45, 0.66][id % 3]);
}

export function hexToRgb(hex) {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const WORDS = { clavicula: "clavicle", vena: "vein" };

// "rib_left_7" to "Left rib 7", "vertebrae_L2" to "Vertebra L2". The raw TotalSegmentator name stays on the class as its key.
export function prettyName(raw) {
  const text = String(raw).trim();
  if (!/[_]/.test(text) && /[A-Z ]/.test(text)) return text;
  const vertebra = text.match(/^vertebrae_([A-Z]\d+)$/);
  if (vertebra) return `Vertebra ${vertebra[1]}`;
  if (text === "portal_vein_and_splenic_vein") return "Portal and splenic vein";
  if (text === "inferior_vena_cava" || text === "superior_vena_cava") return cap(text.replace(/_/g, " "));
  const words = text.split(/[_\s]+/).filter(Boolean).map((w) => WORDS[w] ?? w);
  const side = words.findIndex((w) => w === "left" || w === "right");
  if (side >= 0) words.unshift(words.splice(side, 1)[0]);
  return cap(words.join(" "));
}

// TotalSegmentator writes its class table into a NIfTI header extension as CARET XML. Reading it means a --ml file from any
// TotalSegmentator task names its own classes correctly, whichever class map it was made with.
export function embeddedLabels(hdr) {
  const extensions = hdr?.extensions;
  if (!extensions?.length) return null;
  for (const ext of extensions) {
    const data = ext?.edata;
    if (!data) continue;
    const xml = new TextDecoder().decode(data);
    if (!xml.includes("<LabelTable>")) continue;
    const out = {};
    for (const m of xml.matchAll(/<Label\s+Key="(\d+)"[^>]*>\s*<!\[CDATA\[([^\]]*)\]\]>/g)) out[Number(m[1])] = m[2];
    if (Object.keys(out).length) return out;
  }
  return null;
}

const NAMED = { total: TOTAL, total_mr: TOTAL_MR };

// Everything a label map can come with, reduced to id -> { key, name, color? }. Accepted:
//   "total" | "total_mr"                TotalSegmentator's own maps
//   { 1: "liver", 2: "spleen" }         id to name; also MONAI's channel_def
//   { 1: { name, color } }              id to name and an explicit colour
//   { background: 0, liver: 1 }         name to id, as in nnU-Net's dataset.json (or pass the whole dataset.json)
//   ["background", "liver"]             position is the id
export function normalizeLabels(labels) {
  let source = labels;
  if (typeof source === "string") source = NAMED[source];
  if (source && !Array.isArray(source) && typeof source === "object" && source.labels && typeof source.labels === "object") source = source.labels;
  const out = new Map();
  if (!source) return out;
  const add = (id, value) => {
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return;
    const entry = typeof value === "object" && value ? value : { name: String(value) };
    const raw = entry.name ?? `Label ${n}`;
    out.set(n, { key: clean(raw), name: prettyName(raw), color: entry.color });
  };
  if (Array.isArray(source)) source.forEach((v, i) => add(i, v));
  else
    for (const [k, v] of Object.entries(source)) {
      if (/^\d+$/.test(k)) add(k, v);
      // nnU-Net region labels map a name to several ids; they do not name a voxel, so they are skipped.
      else if (typeof v === "number") add(v, k);
    }
  return out;
}

// The classes actually present in a scan, from its measured stats. Priority for names: the labels prop, then the table inside
// the file, then TotalSegmentator's "total".
export function buildClasses(stats, labelsProp, embedded, { safe = false } = {}) {
  const table = normalizeLabels(labelsProp ?? embedded ?? TOTAL);
  const out = [];
  for (const [id, s] of stats) {
    const entry = table.get(id);
    const key = entry?.key ?? `label_${id}`;
    const color = entry?.color ?? structureColor(key, { safe }) ?? colorFromId(id);
    out.push({ id, key, name: entry?.name ?? `Label ${id}`, known: !!entry, color, system: systemOf(key), ...s });
  }
  return out;
}
