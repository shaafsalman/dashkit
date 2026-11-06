import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BLOOD, XRAY, paintFor, paletteOf, roleOf } from "./palettes.js";
import { segmentColors } from "./segments.js";

// The 3D stage behind <Organ>: one model of separate named parts, which it pulls apart, fades, recolours and frames as the page
// asks. Nothing here knows which organ it is showing: every behaviour is read from the manifest and from the geometry's bounds.
//
// Every part's live state (where it has moved to, how glassy, what colour) sits in one small float texture read by the vertex
// shader, an idea taken from Human Atlas (MIT, ashemag/human-atlas). So parts share a single material and a look changes without
// a uniform upload per part. Hover and tap read back a one-pixel ID render instead of testing triangles, which stays fast on a
// brain or a whole body and sees exactly what is drawn, beat and slice included.

// Roughness, clearcoat, fine relief. Wet tissue is smooth under a film: relief stays very low, detail belongs to the baked maps.
const KINDS = {
  muscle: { rough: 0.44, coat: 1, relief: 0.003, grain: 20, sheen: 0.14, sheenColor: 0xff5a4a },
  artery: { rough: 0.36, coat: 1, relief: 0.0016, grain: 16, sheen: 0.1, sheenColor: 0xff6a55 },
  pulmonary: { rough: 0.36, coat: 1, relief: 0.0016, grain: 16, sheen: 0.1, sheenColor: 0x7a8aff },
  coronary: { rough: 0.38, coat: 0.9, relief: 0.001, grain: 28, sheen: 0.1, sheenColor: 0xffc27a },
  vein: { rough: 0.38, coat: 0.9, relief: 0.001, grain: 28, sheen: 0.1, sheenColor: 0x7a8aff },
  valve: { rough: 0.5, coat: 0.5, relief: 0.0014, grain: 20, sheen: 0.15, sheenColor: 0xffe2d0 },
  lung: { rough: 0.42, coat: 0.85, relief: 0.002, grain: 26, sheen: 0.18, sheenColor: 0x9ad0ff },
  airway: { rough: 0.4, coat: 0.8, relief: 0.0014, grain: 20, sheen: 0.1, sheenColor: 0xffc0a8 },
  cartilage: { rough: 0.44, coat: 0.6, relief: 0.001, grain: 18, sheen: 0.12, sheenColor: 0xfff0e0 },
  liver: { rough: 0.36, coat: 1, relief: 0.0016, grain: 22, sheen: 0.1, sheenColor: 0xff8a6a },
  capsule: { rough: 0.22, coat: 1, relief: 0.001, grain: 18, sheen: 0, sheenColor: 0xffffff },
  kidney: { rough: 0.38, coat: 1, relief: 0.0016, grain: 22, sheen: 0.1, sheenColor: 0xff8a6a },
  pyramid: { rough: 0.44, coat: 0.7, relief: 0.0026, grain: 34, sheen: 0.1, sheenColor: 0xff8a6a },
  brain: { rough: 0.5, coat: 0.65, relief: 0.002, grain: 24, sheen: 0.12, sheenColor: 0xffc8b8 },
  deep: { rough: 0.5, coat: 0.6, relief: 0.0014, grain: 20, sheen: 0.1, sheenColor: 0xd8c8ff },
  fluid: { rough: 0.2, coat: 1, relief: 0.0005, grain: 12, sheen: 0, sheenColor: 0xffffff },
  coral: { rough: 0.38, coat: 0.9, relief: 0.001, grain: 28, sheen: 0.1, sheenColor: 0xffb09a },
  skin: { rough: 0.3, coat: 0.9, relief: 0.0006, grain: 14, sheen: 0.1, sheenColor: 0xffffff },
  bone: { rough: 0.56, coat: 0.25, relief: 0.0014, grain: 26, sheen: 0.05, sheenColor: 0xfff4e0 },
  nerve: { rough: 0.46, coat: 0.5, relief: 0.0008, grain: 22, sheen: 0.1, sheenColor: 0xfff0c0 },
  gut: { rough: 0.4, coat: 0.9, relief: 0.0016, grain: 20, sheen: 0.12, sheenColor: 0xffd8c0 },
  gland: { rough: 0.42, coat: 0.8, relief: 0.0016, grain: 22, sheen: 0.1, sheenColor: 0xffc0a0 },
  fat: { rough: 0.46, coat: 0.7, relief: 0.0014, grain: 18, sheen: 0.14, sheenColor: 0xfff0c0 },
};

const FOV = 23.9;
const ROWS = 8;
const R_OFFSET = 0, R_LOOK = 1, R_PAINT = 2, R_PUMP = 3, R_MAT = 4, R_SHEEN = 5, R_SEG = 6, R_RIM = 7;
// Indices into a part's eased look.
const VIS = 0, GHOST = 1, GLASS = 2, HILITE = 3, ALPHA = 4, PR = 5, PG = 6, PB = 7, PA = 8, RR = 9, RG = 10, RB = 11, RA = 12, EMIT = 13, HALO = 14;
const LOOK = 15;
const PATH_W = 64;
const BPM = 72;
const BREATHS = 14;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const damp = (now, to, dt, rate) => now + (to - now) * (1 - Math.exp(-dt * rate));
const srgb = (hex) => {
  const c = new THREE.Color();
  c.setStyle(hex, THREE.SRGBColorSpace);
  return c;
};
const toDisplay = (c) => {
  const out = c.clone();
  out.convertLinearToSRGB();
  return out;
};
// A lub and a dub: the second sound is softer. Shared by the shader and the CPU so that everything surges together.
const lubDub = (t) => {
  const f = t - Math.floor(t);
  const a = (f - 0.08) / 0.05;
  const b = (f - 0.3) / 0.055;
  return Math.exp(-a * a) + 0.62 * Math.exp(-b * b);
};

const VERT_PARS = `
  attribute float aPart;
  uniform highp sampler2D uState;
  uniform vec4 uPulse;       // beat phase, breath 0..1, seconds, on
  uniform vec3 uPumpC, uPumpAxis, uBreathC;
  uniform float uPumpReach, uBreathReach;
  float organBeat(float t) {
    float f = fract(t);
    float a = (f - 0.08) / 0.05;
    float b = (f - 0.3) / 0.055;
    return exp(-a * a) + 0.62 * exp(-b * b);
  }
  // The living motion, in the model's own space. Muscle squeezes toward the pump's axis with a wave running from base to apex
  // and a slight wring; vessels swell as the pressure wave reaches them; lungs fill, the lower part moving most, as a diaphragm would.
  vec3 organLive(vec3 p, vec3 n, vec4 pump) {
    vec3 q = p;
    if (pump.x > 0.0) {
      vec3 r = p - uPumpC;
      float along = dot(r, uPumpAxis);
      float w = organBeat(uPulse.x - along * 0.09 / max(uPumpReach, 0.05)) * pump.x * uPulse.w;
      vec3 radial = r - uPumpAxis * along;
      float ang = w * 0.9 * along / max(uPumpReach, 0.05);
      vec3 turned = radial * cos(ang) + cross(uPumpAxis, radial) * sin(ang);
      q = uPumpC + uPumpAxis * along * (1.0 - w * 0.55) + turned * (1.0 - w);
    }
    if (pump.y > 0.0) {
      float dist = length(p - uPumpC);
      q += n * pump.y * uPulse.w * organBeat(uPulse.x - 0.04 - dist * 0.08);
    }
    if (pump.z > 0.0) {
      vec3 r = p - uBreathC;
      float top = smoothstep(0.1, 0.85, r.y / max(uBreathReach, 0.05));
      float k = pump.z * uPulse.y * uPulse.w * (1.0 - top * 0.8);
      q = uBreathC + r * (1.0 + k * vec3(1.0, 0.55, 0.85));
      q.y -= k * 0.4 * uBreathReach * (1.0 - top);
    }
    return q;
  }
`;

const VERT_HEAD = `
  ${VERT_PARS}
  varying vec3 vOrganPos;
  varying vec3 vCutPos;
  flat varying vec4 vOff, vLook, vPaint, vPump, vMat, vSheen, vSeg, vRim;
`;
const VERT_PROJECT = `
  int organRow = int(aPart + 0.5);
  vOff = texelFetch(uState, ivec2(${R_OFFSET}, organRow), 0);
  vLook = texelFetch(uState, ivec2(${R_LOOK}, organRow), 0);
  vPaint = texelFetch(uState, ivec2(${R_PAINT}, organRow), 0);
  vPump = texelFetch(uState, ivec2(${R_PUMP}, organRow), 0);
  vMat = texelFetch(uState, ivec2(${R_MAT}, organRow), 0);
  vSheen = texelFetch(uState, ivec2(${R_SHEEN}, organRow), 0);
  vSeg = texelFetch(uState, ivec2(${R_SEG}, organRow), 0);
  vRim = texelFetch(uState, ivec2(${R_RIM}, organRow), 0);
  vec3 organRest = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vec3 organNormal = normalize(mat3(modelMatrix) * objectNormal);
  vOrganPos = organRest;
  vec3 organMoved = organLive(organRest, organNormal, vPump) + vOff.xyz;
  vCutPos = organMoved;
  vec4 mvPosition = viewMatrix * vec4(organMoved, 1.0);
  gl_Position = projectionMatrix * mvPosition;
`;

const FRAG_HEAD = `
  varying vec3 vOrganPos;
  varying vec3 vCutPos;
  flat varying vec4 vOff, vLook, vPaint, vPump, vMat, vSheen, vSeg, vRim;
  uniform vec4 uScan;   // y of the band, colour share above it, colour share below it, band strength
  uniform vec4 uPlane;  // the slice: normal, constant
  uniform vec4 uPulse;
  uniform float uSliceOn, uLight;
  uniform vec3 uInk;
  float organHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float organNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(organHash(i), organHash(i + vec3(1, 0, 0)), f.x), mix(organHash(i + vec3(0, 1, 0)), organHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(organHash(i + vec3(0, 0, 1)), organHash(i + vec3(1, 0, 1)), f.x), mix(organHash(i + vec3(0, 1, 1)), organHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  // Fine striations rather than an even pebble: the fibres run along one axis.
  float organGrainAt(vec3 p) { return organNoise(p * vec3(1.0, 0.32, 1.0)) * 0.7 + organNoise(p * vec3(2.1, 0.5, 2.1) + 7.0) * 0.3; }
`;
const FRAG_CLIP = `
  float organCut = dot(vCutPos, uPlane.xyz) + uPlane.w;
  if (uSliceOn > 0.5 && organCut < 0.0) discard;
  // Parts dissolve rather than pop, and stay opaque while they do, so what is behind them keeps correct depth.
  if (vOff.w < 0.995) {
    float organD = organNoise(vOrganPos * 46.0) * 0.8 + organHash(floor(vOrganPos * 240.0)) * 0.2;
    if (organD > vOff.w * 1.02) discard;
  }
`;
const FRAG_COLOR = `
  const vec3 ORGAN_LUM = vec3(0.2126, 0.7152, 0.0722);
  vec3 organBase = diffuseColor.rgb;
  float organLum = dot(organBase, ORGAN_LUM);
  // How light or dark this spot was baked against the part's own average: the shadow and surface detail any new colour keeps.
  float organDetail = clamp(organLum / max(vSeg.a, 0.02), 0.08, 1.7);
  // Natural colour runs deeper and more saturated, as wet tissue does.
  vec3 organRich = max(mix(vec3(organLum), organBase, 1.34), 0.0);
  organRich = pow(organRich, vec3(1.16)) * 0.94;
  vec3 organPainted = vPaint.rgb * mix(1.0, organDetail, 0.92);
  diffuseColor.rgb = mix(organRich, organPainted, vPaint.a);
  // The segmentation wipe: new colour above the band, old below, a bright line where they meet.
  float organSegNow = mix(uScan.z, uScan.y, smoothstep(uScan.x - 0.006, uScan.x + 0.006, vOrganPos.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, vSeg.rgb * mix(1.0, pow(organDetail, 0.7), 0.85), organSegNow);
`;
const FRAG_ROUGH = `
  #ifdef USE_ROUGHNESSMAP
    roughnessFactor = texelRoughness.g * roughness;
  #else
    roughnessFactor = vMat.x;
  #endif
  // Wetness is not even: a film pools and thins, which breaks the highlights up the way a wet surface does.
  roughnessFactor *= 0.82 + 0.36 * organNoise(vOrganPos * 11.0);
  roughnessFactor = mix(roughnessFactor, 0.56, organSegNow);
`;
const FRAG_NORMAL = `
  if (vMat.z > 0.0) {
    vec3 sigmaX = dFdx(-vViewPosition), sigmaY = dFdy(-vViewPosition);
    vec3 r1 = cross(sigmaY, normal), r2 = cross(normal, sigmaX);
    float det = dot(sigmaX, r1) * faceDirection;
    float h = organGrainAt(vOrganPos * vMat.w);
    vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    normal = normalize(abs(det) * normal - vMat.z * grad);
  }
`;
// The clearcoat film rides slightly apart from the tissue, with a very slow drift so that light slides across it as if it were wet.
const FRAG_FILM = `
  {
    vec3 sigmaX = dFdx(-vViewPosition), sigmaY = dFdy(-vViewPosition);
    vec3 r1 = cross(sigmaY, nonPerturbedNormal), r2 = cross(nonPerturbedNormal, sigmaX);
    float det = dot(sigmaX, r1) * faceDirection;
    float h = organNoise(vOrganPos * 7.0 + vec3(0.0, uPulse.z * 0.035, uPulse.z * 0.02));
    vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    clearcoatNormal = normalize(abs(det) * nonPerturbedNormal - 0.012 * grad);
  }
`;
const FRAG_LIGHTS = `
  material.clearcoat = vMat.y * (1.0 - organSegNow * 0.7);
  material.clearcoatRoughness = 0.15 + 0.1 * (1.0 - vMat.y);
  #ifdef USE_SHEEN
    material.sheenColor = vSheen.rgb * vSheen.a * 0.4;
  #endif
`;
const FRAG_OUT = `
  float organNdv = saturate(abs(dot(normalize(normal), normalize(vViewPosition))));
  float organFres = pow(1.0 - organNdv, 2.4);
  // A tissue lets light in near its edges: without this, the shadow side of an organ goes dead.
  outgoingLight += diffuseColor.rgb * organFres * 0.16 * (1.0 - vLook.z);
  // Lit from within: the hot colour plus a stronger fresnel edge.
  outgoingLight += diffuseColor.rgb * vPump.w * (0.35 + organFres * 1.2);
  float organSpec = dot(totalSpecular, ORGAN_LUM);
  #ifdef USE_CLEARCOAT
    organSpec += dot(clearcoatSpecularDirect + clearcoatSpecularIndirect, ORGAN_LUM) * material.clearcoat;
  #endif
`;
const FRAG_END = `
  {
    float rim = pow(1.0 - organNdv, 2.2);
    // A bright band sweeping down: visible on any background because it carries its own colour.
    float bandD = (vOrganPos.y - uScan.x) / 0.05;
    float band = uScan.w * exp(-bandD * bandD);
    float ticks = uScan.w * 0.25 * smoothstep(0.6, 1.0, sin(vOrganPos.y * 220.0)) * smoothstep(0.5, 0.0, abs(vOrganPos.y - uScan.x));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uLight > 0.5 ? vec3(0.0, 0.55, 0.95) : vec3(0.62, 0.95, 1.0), clamp(band + ticks, 0.0, 1.0));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vRim.rgb, vRim.a * rim);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uInk, vLook.y * 0.72);
    gl_FragColor.rgb += vLook.w * (0.04 + rim * 0.22);
    // Frosted when chosen against; glass at rest. Both multiply whatever alpha the model's own colours carry.
    // A part's own alpha only counts as glass: a model may thin out inner walls in its maps without a solid part going see-through.
    float a = mix(1.0, gl_FragColor.a, vLook.z);
    a *= mix(1.0, mix(0.03, 0.06, uLight) + rim * 0.5, vLook.y);
    float organClear = mix(1.0, mix(0.05, 0.12, uLight) + rim * mix(0.7, 0.62, uLight), vLook.z);
    a *= organClear;
    a *= vLook.x;
    // A highlight sits on the surface of the glass, so it stays bright however clear the glass is.
    a = max(a, min(1.0, organSpec * 1.3) * vLook.x * (1.0 - vLook.y));
    a = mix(a, 1.0, clamp(band, 0.0, 1.0) * step(0.01, a));
    if (uSliceOn > 0.5) {
      // The thin edge of tissue that meets the cut reads as an outline of the section.
      float edge = smoothstep(0.012, 0.002, organCut);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vSeg.rgb, edge * 0.85);
      a = max(a, edge);
    }
    gl_FragColor.a = a;
  }
`;

function organMaterial(u, { maps, colors, clear }) {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: colors,
    map: maps?.map ?? null,
    normalMap: maps?.normalMap ?? null,
    roughnessMap: maps?.roughnessMap ?? null,
    roughness: maps?.roughnessMap ? maps.roughness ?? 1 : 0.5,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.11,
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xffffff),
    side: THREE.DoubleSide,
    transparent: clear,
    depthWrite: !clear,
    forceSinglePass: true,
  });
  if (maps?.normalScale) m.normalScale.copy(maps.normalScale);
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = VERT_HEAD + s.vertexShader.replace("#include <project_vertex>", VERT_PROJECT);
    s.fragmentShader =
      FRAG_HEAD +
      s.fragmentShader
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${FRAG_CLIP}`)
        .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAG_COLOR}`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
        .replace("#include <clearcoat_normal_fragment_begin>", `#include <clearcoat_normal_fragment_begin>\n${FRAG_FILM}`)
        .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>\n${FRAG_LIGHTS}`)
        .replace("#include <opaque_fragment>", `${FRAG_OUT}\n#include <opaque_fragment>`)
        .replace("#include <dithering_fragment>", `#include <dithering_fragment>\n${FRAG_END}`);
  };
  m.customProgramCacheKey = () => "dashkit-organ-3";
  return m;
}

// A dark room with long soft boxes: its reflections are what make a surface read as wet, and the dark between them keeps the
// shadows deep instead of washing the organ flat.
function studio() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.075, 0.072, 0.08), side: THREE.BackSide })));
  const box = (w, h, at, power, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...at);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  box(13, 7, [-3, 10, 4], 8);
  box(2.2, 13, [10, 1.5, 4], 5, 0xf2f6ff);
  box(1.8, 10, [-10, 0, 3], 3, 0xfff0e4);
  box(9, 1.4, [1, 3, 11], 1.6);
  box(11, 4, [0, 5, -11], 5, 0xe6eeff);
  box(11, 11, [0, -11, 0], 0.55, 0xffc4b0);
  return s;
}

// A red cell's dimpled disc, turned from its profile; low in polygons because thousands are drawn.
function cellGeometry() {
  const pts = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const r = i / steps;
    pts.push(new THREE.Vector2(r * 0.999 + 0.0005, 0.34 * Math.sqrt(Math.max(0, 1 - r * r)) * (0.24 + 2 * r * r - r * r * r * r)));
  }
  for (let i = steps - 1; i >= 0; i--) pts.push(new THREE.Vector2(pts[i].x, -pts[i].y));
  const g = new THREE.LatheGeometry(pts, 9);
  g.computeVertexNormals();
  return g;
}

const CELL_VERT = `
  attribute vec4 iA;   // row, start, rate, size
  attribute vec4 iB;   // lane x, lane y, spin, kind
  uniform highp sampler2D uPaths;
  uniform vec3 uClocks;
  uniform float uOn, uSeconds, uSurge;
  varying vec3 vN, vP, vCut;
  flat varying float vKind, vShade;
  void main() {
    int row = int(iA.x + 0.5);
    int kind = int(iB.w + 0.5);
    float seen = texelFetch(uPaths, ivec2(${PATH_W}, row), 0).r;
    float clock = kind == 0 ? uClocks.x : kind == 1 ? uClocks.y : uClocks.z;
    float t = fract(iA.y + clock * iA.z);
    float x = t * float(${PATH_W - 1});
    int i0 = int(floor(x));
    int i1 = min(i0 + 1, ${PATH_W - 1});
    vec4 a = texelFetch(uPaths, ivec2(i0, row), 0);
    vec4 b = texelFetch(uPaths, ivec2(i1, row), 0);
    vec3 c = mix(a.xyz, b.xyz, x - float(i0));
    float reach = mix(a.w, b.w, x - float(i0));
    vec3 along = normalize(b.xyz - a.xyz + vec3(1e-5));
    vec3 side = normalize(cross(along, abs(along.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 lift = cross(along, side);
    vec3 centre = c + (side * iB.x + lift * iB.y) * reach;
    // Each cell grows in at the start of its route and shrinks at the end, so routes never pop.
    float edge = min(1.0, min(t * 16.0, (1.0 - t) * 16.0));
    float size = iA.w * edge * uOn * seen;
    // Tumbling about its own axis, with a slight lean into the direction of travel.
    float ang = iB.z * (uSeconds + iA.y * 40.0);
    float ca = cos(ang), sa = sin(ang);
    vec3 p = vec3(position.x * ca - position.z * sa, position.y, position.x * sa + position.z * ca);
    vec3 n = vec3(normal.x * ca - normal.z * sa, normal.y, normal.x * sa + normal.z * ca);
    vec3 world = centre + (side * p.x + along * p.y + lift * p.z) * size;
    vN = normalize(normalMatrix * (side * n.x + along * n.y + lift * n.z));
    vec4 mv = viewMatrix * vec4(world, 1.0);
    vP = mv.xyz;
    vCut = world;
    vKind = float(kind);
    vShade = 0.86 + 0.28 * fract(iA.y * 91.7);
    gl_Position = projectionMatrix * mv;
    if (size < 1e-5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const CELL_FRAG = `
  uniform vec3 uColors[3];
  uniform vec4 uPlane;
  uniform float uSliceOn, uSurge;
  varying vec3 vN, vP, vCut;
  flat varying float vKind, vShade;
  void main() {
    if (uSliceOn > 0.5 && dot(vCut, uPlane.xyz) + uPlane.w < 0.0) discard;
    vec3 n = normalize(vN);
    vec3 v = normalize(-vP);
    vec3 l = normalize(vec3(-0.45, 0.7, 0.55));
    float wrap = dot(n, l) * 0.5 + 0.5;
    float spec = pow(max(dot(n, normalize(l + v)), 0.0), 48.0);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);
    vec3 base = uColors[int(vKind + 0.5)] * vShade;
    vec3 c = base * (0.42 + 0.86 * wrap) + base * rim * 0.5 + vec3(0.9) * spec * 0.7 + base * uSurge * 0.35;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

const HALO_VERT = `
  attribute vec4 iAt;  // centre, size
  attribute vec4 iTint;
  uniform float uSurge;
  varying vec2 vUv2;
  varying vec4 vTint;
  void main() {
    vUv2 = position.xy * 2.0;
    vTint = iTint;
    vec4 mv = viewMatrix * vec4(iAt.xyz, 1.0);
    mv.xy += position.xy * iAt.w * (1.0 + uSurge * 0.05);
    gl_Position = projectionMatrix * mv;
  }
`;
const HALO_FRAG = `
  uniform float uSurge;
  varying vec2 vUv2;
  varying vec4 vTint;
  void main() {
    float r = length(vUv2);
    if (r > 1.0) discard;
    float f = pow(1.0 - r, 2.2);
    gl_FragColor = vec4(vTint.rgb, f * vTint.a * (0.8 + 0.2 * uSurge));
  }
`;

const SIDES = { front: [0, 0.05, 1], back: [0, 0.05, -1], left: [-1, 0.05, 0], right: [1, 0.05, 0], top: [0, 1, 0.02], bottom: [0, -1, 0.02] };
const CUT_VIEW = { axial: [0.25, 0.82, 0.55], coronal: [0.32, 0.14, 1], sagittal: [1, 0.14, 0.32] };

/** Which kind of blood a vessel carries, read from the flow routes running nearest to it. */
function bloodVotes(parts, flows) {
  const cell = 0.14;
  const key = (x, y, z) => `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
  const grid = new Map();
  for (const f of flows) {
    if (f.kind !== "artery" && f.kind !== "vein") continue;
    for (const pt of f.points ?? []) {
      const k = key(pt[0], pt[1], pt[2]);
      const bin = grid.get(k) ?? { artery: 0, vein: 0 };
      bin[f.kind] += 1;
      grid.set(k, bin);
    }
  }
  for (const p of parts) {
    if (!p.info.vessel) continue;
    let artery = 0;
    let vein = 0;
    const s = p.samples;
    for (let i = 0; i < s.length; i += 3) {
      const bin = grid.get(key(s[i], s[i + 1], s[i + 2]));
      if (bin) {
        artery += bin.artery;
        vein += bin.vein;
      }
    }
    if (artery + vein > 0) p.blood = artery >= vein ? "artery" : "vein";
  }
}

export class OrganStage {
  constructor(canvas, { onHover, onPick, onMiss, onTrack, onReady, still, decorative, pulse = false }) {
    this.canvas = canvas;
    this.cb = { onHover, onPick, onMiss, onTrack, onReady };
    this.still = !!still;
    this.decorative = !!decorative;
    this.list = [];
    this.parts = new Map();
    this.groups = new Map();
    this.view = { group: null, part: null, exploded: 0, mode: "anatomy" };
    this.palette = paletteOf("natural");
    this.hidden = new Set();
    this.restGlass = new Map();
    this.segOpacity = 1;
    this.slice = null;
    this.zoom = 1;
    this.maxZoom = 8;
    this.clock = 0;
    this.alive = true;
    this.dirty = true;
    this.paused = false;
    this.pulseOn = !this.still && !!pulse;
    this.light = 0;
    this.tracked = [];
    this.notes = [];
    this.flows = [];
    this.pan = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.focusTo = new THREE.Vector3();
    this.reach = { hx: 1, hy: 1 };
    this.reachTo = { hx: 1, hy: 1 };
    this.R = 1;
    this.clocks = new THREE.Vector3();
    this.pickJobs = [];
    this.pickBusy = false;
    this.pickBuf = new Uint8Array(8);
    this.ink = new THREE.Color(0xdfe6ee);
    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };

    this.U = {
      uState: { value: null },
      uPulse: { value: new THREE.Vector4(0, 0, 0, this.pulseOn ? 1 : 0) },
      uPumpC: { value: new THREE.Vector3() },
      uPumpAxis: { value: new THREE.Vector3(0, -1, 0) },
      uPumpReach: { value: 1 },
      uBreathC: { value: new THREE.Vector3() },
      uBreathReach: { value: 1 },
      uScan: { value: new THREE.Vector4(10, 0, 0, 0) },
      uPlane: { value: new THREE.Vector4(0, -1, 0, 100) },
      uSliceOn: { value: 0 },
      uLight: { value: 0 },
      uInk: { value: this.ink },
    };

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, stencil: true, powerPreference: "high-performance" }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1;
    r.setClearColor(0x000000, 0);
    this.maxAniso = r.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.env = pmrem.fromScene(studio(), 0.03).texture;
    pmrem.dispose();
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.6;
    // The lights stay put relative to the camera, as on a turntable: turning the model slides the highlights across its wet surface.
    this.rig = new THREE.Group();
    this.key = new THREE.DirectionalLight(0xfff5ea, 2.3);
    this.key.position.set(-3, 3.8, 4.4);
    this.rimLight = new THREE.DirectionalLight(0xeaf0ff, 1.9);
    this.rimLight.position.set(2.4, 2.6, -4.6);
    this.fill = new THREE.DirectionalLight(0xdce8ff, 0.55);
    this.fill.position.set(4.5, 0.2, 3);
    this.under = new THREE.DirectionalLight(0xffe0d4, 0.3);
    this.under.position.set(-1.5, -4, 2.5);
    this.rig.add(this.key, this.key.target, this.rimLight, this.rimLight.target, this.fill, this.fill.target, this.under, this.under.target);
    this.scene.add(this.rig);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 80);
    this.camera.position.set(0, 0.15, 6.3);
    this.pickCam = new THREE.PerspectiveCamera(FOV, 1, 0.02, 80);
    const c = (this.controls = new OrbitControls(this.camera, canvas));
    c.enablePan = false;
    c.enableZoom = false;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.7;
    c.autoRotateSpeed = 0.75;
    if (this.decorative) c.enabled = false;

    this.buildFloor();
    this.buildPick();

    this.down = null;
    this.hovered = null;
    this.hoverAt = 0;
    if (!this.decorative) {
      canvas.addEventListener("pointerdown", (this._down = (e) => {
        this.down = { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey };
        this.lookTo = null;
      }));
      canvas.addEventListener("pointerup", (this._up = (e) => this.release(e)));
      canvas.addEventListener("pointermove", (this._move = (e) => this.pointerMove(e)));
      canvas.addEventListener("pointerleave", (this._leave = () => this.setHover(null, null)));
      canvas.addEventListener("wheel", (this._wheel = (e) => this.wheel(e)), { passive: false });
      canvas.addEventListener("contextmenu", (this._ctx = (e) => e.preventDefault()));
      canvas.addEventListener("dblclick", (this._dbl = (e) => {
        this.zoomAt(1.8, e.clientX, e.clientY);
      }));
    } else {
      window.addEventListener("pointermove", (this._tilt = (e) => {
        const b = canvas.getBoundingClientRect();
        this.tilt.tx = ((e.clientX - b.left) / Math.max(1, b.width)) * 2 - 1;
        this.tilt.ty = ((e.clientY - b.top) / Math.max(1, b.height)) * 2 - 1;
      }));
    }

    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(canvas.parentElement);
    this.seen = true;
    this.watcher = new IntersectionObserver(([e]) => {
      this.seen = e.isIntersecting;
      if (this.seen) this.wake();
    });
    this.watcher.observe(canvas);
    this.onVisible = () => this.wake();
    document.addEventListener("visibilitychange", this.onVisible);
    this.resize();
    this.last = performance.now();
    this.wake();
  }

  // ---- Loading ---------------------------------------------------------------------------------------------------------

  async load(url, manifest, { hidden, restGlass, meshopt = MeshoptDecoder } = {}) {
    const token = (this.loading = {});
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(meshopt);
    const gltf = await loader.loadAsync(url);
    if (!this.alive || this.loading !== token) return;
    this.clearModel();
    if (hidden) this.hidden = hidden;
    if (restGlass) this.restGlass = restGlass;
    this.manifest = manifest;
    const m = manifest;
    m.groups = m.groups ?? [];
    m.parts = m.parts ?? [];
    const meta = new Map(m.parts.map((p) => [p.id, p]));
    const root = (this.modelRoot = new THREE.Group());
    this.scene.add(root);
    gltf.scene.updateMatrixWorld(true);
    const meshes = [];
    gltf.scene.traverse((o) => o.isMesh && meshes.push(o));

    const shared = new Map();
    this.materials = shared;
    const safe = this.palette.safeSegments;
    this.segCss = segmentColors(m, { safe });
    const composite = m.parts.some((p) => p.organ);

    for (const mesh of meshes) {
      let id = null;
      for (let o = mesh; o && !id; o = o.parent) if (meta.has(o.name)) id = o.name;
      if (!id) {
        mesh.geometry.dispose();
        continue;
      }
      let p = this.parts.get(id);
      if (!p) {
        p = this.newPart(id, meta.get(id), composite);
        this.parts.set(id, p);
        this.list.push(p);
      }
      root.attach(mesh);
      mesh.layers.enable(1);
      this.bindMesh(p, mesh);
    }
    this.list.forEach((p) => this.finishPart(p));
    this.measure();
    this.buildState();
    for (const g of m.groups) {
      const members = this.list.filter((p) => p.info.group === g.id);
      const centre = members.reduce((a, p) => a.add(p.centre), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, members.length));
      this.groups.set(g.id, { centre, members });
    }
    bloodVotes(this.list, m.flows ?? []);
    this.setupPulse(composite);
    this.setupTracked();
    this.buildFlows(m);
    this.buildHalos();
    this.syncMaterials();
    this.applyTargets(true);
    this.settleAll();
    this.startIntro();
    this.applyVisibilityNow();
    this.updateFit();
    this.snapCamera();
    this.precompile();
    this.dirty = true;
    this.render();
    this.cb.onReady?.();
  }

  newPart(id, info, composite) {
    const kind = KINDS[info.kind] ?? KINDS.muscle;
    const goal = new Float32Array(LOOK);
    goal[VIS] = 1;
    goal[ALPHA] = 1;
    return {
      id, info, kind, composite, index: this.list.length, meshes: [],
      box: new THREE.Box3(), centre: new THREE.Vector3(), samples: [], mean: new THREE.Color(0.5, 0.2, 0.2), meanLum: 0.2,
      offset: new THREE.Vector3(), to: new THREE.Vector3(), intro: new THREE.Vector3(), lift: 0, liftTo: 0, liftDir: new THREE.Vector3(0, 0, 1),
      now: goal.slice(), goal, wait: 0, hover: 0, blood: null, maps: null, role: "organ", seg: new THREE.Color(), haloColor: null,
    };
  }

  bindMesh(p, mesh) {
    const g = mesh.geometry;
    const n = g.attributes.position.count;
    g.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(n).fill(p.index), 1));
    const src = mesh.material;
    const maps = src && (src.map || src.normalMap || src.roughnessMap)
      ? { map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap, normalScale: src.normalScale, roughness: src.roughness }
      : null;
    if (maps) {
      for (const t of [maps.map, maps.normalMap, maps.roughnessMap]) if (t) t.anisotropy = this.maxAniso;
      p.maps = maps;
    }
    mesh.userData.colors = !!g.attributes.color;
    mesh.userData.maps = maps;
    mesh.frustumCulled = false; // the shader moves parts, so their stored bounds cannot be trusted
    p.meshes.push(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    p.box.union(box);
    // A thin sample of the real surface, in model space, for everything the stage works out from geometry.
    const pos = g.attributes.position;
    const stride = Math.max(1, Math.floor(n / 220));
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      p.samples.push(v.x, v.y, v.z);
    }
    if (g.attributes.color && !maps?.map) {
      const col = g.attributes.color;
      const cs = Math.max(1, Math.floor(col.count / 400));
      let r = 0, gg = 0, b = 0, count = 0;
      for (let i = 0; i < col.count; i += cs) {
        r += col.getX(i);
        gg += col.getY(i);
        b += col.getZ(i);
        count += 1;
      }
      p.mean.setRGB(r / count, gg / count, b / count);
    } else if (maps?.map?.image) {
      this.meanOfImage(p, maps.map.image);
    }
    p.meanLum = Math.max(0.02, p.mean.r * 0.2126 + p.mean.g * 0.7152 + p.mean.b * 0.0722);
  }

  meanOfImage(p, image) {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(image, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0;
      const to = (u) => {
        const s = u / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      for (let i = 0; i < d.length; i += 4) {
        r += to(d[i]);
        g += to(d[i + 1]);
        b += to(d[i + 2]);
      }
      const n = d.length / 4;
      p.mean.setRGB(r / n, g / n, b / n);
    } catch {
      // A tainted or unreadable image: the default mean only slightly shifts how a palette reads.
    }
  }

  finishPart(p) {
    p.box.getCenter(p.centre);
    p.size = p.box.getSize(new THREE.Vector3()).length();
    p.samples = new Float32Array(p.samples);
  }

  /** The model's real size. Framing, zoom limits, slice travel and lifts are all read from these, so no model needs its own numbers. */
  measure() {
    const box = new THREE.Box3();
    this.list.forEach((p) => box.union(p.box));
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    this.bounds = box;
    this.centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.R = Math.max(0.2, size.length() * 0.5);
    this.camera.near = this.pickCam.near = 0.01 * this.R;
    this.camera.far = this.pickCam.far = 60 * this.R;
    for (const p of this.list) {
      p.liftDir.copy(p.centre).sub(this.centre);
      if (p.liftDir.lengthSq() < 1e-4) p.liftDir.set(0, 0, 1);
      p.liftDir.normalize();
    }
  }

  buildState() {
    const n = Math.max(1, this.list.length);
    this.stateData = new Float32Array(n * ROWS * 4);
    this.stateTex?.dispose();
    this.stateTex = new THREE.DataTexture(this.stateData, ROWS, n, THREE.RGBAFormat, THREE.FloatType);
    this.stateTex.minFilter = this.stateTex.magFilter = THREE.NearestFilter;
    this.stateTex.needsUpdate = true;
    this.U.uState.value = this.stateTex;
    this.writeSegColors();
    for (const p of this.list) {
      const o = (p.index * ROWS + R_MAT) * 4;
      this.stateData[o] = p.kind.rough;
      this.stateData[o + 1] = p.kind.coat;
      this.stateData[o + 2] = p.kind.relief;
      this.stateData[o + 3] = p.kind.grain;
      const s = new THREE.Color(p.kind.sheenColor);
      const o2 = (p.index * ROWS + R_SHEEN) * 4;
      this.stateData[o2] = s.r;
      this.stateData[o2 + 1] = s.g;
      this.stateData[o2 + 2] = s.b;
      this.stateData[o2 + 3] = p.kind.sheen;
    }
  }

  writeSegColors() {
    if (!this.stateData || !this.manifest) return;
    this.segCss = segmentColors(this.manifest, { safe: !!this.palette.safeSegments });
    for (const p of this.list) {
      p.seg.set(this.segCss[p.id] ?? "#888888");
      const o = (p.index * ROWS + R_SEG) * 4;
      this.stateData[o] = p.seg.r;
      this.stateData[o + 1] = p.seg.g;
      this.stateData[o + 2] = p.seg.b;
      this.stateData[o + 3] = p.meanLum;
    }
    if (this.stateTex) this.stateTex.needsUpdate = true;
  }

  /** Who beats and who breathes: if any part names an organ, only those parts do; otherwise the kinds and the manifest's `pulse` decide. */
  setupPulse(composite) {
    const m = this.manifest;
    const beats = [];
    const fills = [];
    for (const p of this.list) {
      let squeeze = 0;
      let swell = 0;
      let fill = 0;
      if (p.info.pulse === "heart" || (composite ? p.info.organ === "heart" : m.pulse === "heart")) {
        squeeze = p.info.vessel ? 0.016 : p.info.kind === "valve" ? 0.03 : 0.052;
        if (p.info.vessel) swell = 0.012 * this.R;
        beats.push(p);
      } else if (p.info.pulse === "breath" || (composite ? p.info.organ === "lungs" : m.pulse === "breath")) {
        fill = p.info.kind === "lung" ? 0.05 : p.info.vessel ? 0.042 : 0.03;
        fills.push(p);
      } else if (p.info.vessel) {
        swell = 0.0045 * this.R;
      }
      p.pump = [squeeze, swell, fill];
      p.beats = squeeze > 0;
      const o = (p.index * ROWS + R_PUMP) * 4;
      this.stateData[o] = squeeze;
      this.stateData[o + 1] = swell;
      this.stateData[o + 2] = fill;
    }
    this.hasBeat = beats.length > 0;
    this.hasBreath = fills.length > 0;
    this.composite = composite;
    const centreOf = (list) => {
      const b = new THREE.Box3();
      list.forEach((p) => b.union(p.box));
      return b;
    };
    if (beats.length) {
      const b = centreOf(beats);
      const solid = beats.filter((p) => !p.info.vessel);
      const tube = beats.filter((p) => p.info.vessel);
      const solidB = centreOf(solid.length ? solid : beats);
      this.U.uPumpC.value.copy(solidB.getCenter(new THREE.Vector3()));
      this.U.uPumpReach.value = Math.max(0.05, b.getSize(new THREE.Vector3()).length() * 0.5);
      if (tube.length && solid.length) {
        const axis = solidB.getCenter(new THREE.Vector3()).sub(centreOf(tube).getCenter(new THREE.Vector3()));
        if (axis.lengthSq() > 1e-4) this.U.uPumpAxis.value.copy(axis.normalize());
      }
    } else {
      this.U.uPumpC.value.copy(this.centre);
      this.U.uPumpReach.value = this.R;
    }
    if (fills.length) {
      const b = centreOf(fills);
      this.U.uBreathC.value.copy(b.getCenter(new THREE.Vector3()));
      this.U.uBreathReach.value = Math.max(0.05, b.getSize(new THREE.Vector3()).y * 0.5);
    }
    this.stateTex.needsUpdate = true;
  }

  /** A point on the part's outer surface facing away from the model's centre and a little toward the viewer: where a marker can be seen. */
  outerPoint(p) {
    const dir = new THREE.Vector3().copy(p.centre).sub(this.centre);
    dir.z += 0.35 * this.R;
    dir.normalize();
    const s = p.samples;
    let best = -Infinity;
    const out = new THREE.Vector3().copy(p.centre);
    for (let i = 0; i < s.length; i += 3) {
      const d = (s[i] - this.centre.x) * dir.x + (s[i + 1] - this.centre.y) * dir.y + (s[i + 2] - this.centre.z) * dir.z;
      if (d > best) {
        best = d;
        out.set(s[i], s[i + 1], s[i + 2]);
      }
    }
    return out;
  }

  /** Markers follow the geometry: a pin that lands on a part's hidden inner face moves to its outer face instead. */
  setupTracked() {
    const m = this.manifest;
    this.pins = (m.pins ?? [])
      .filter((pin) => this.parts.has(pin.part))
      .map((pin) => {
        const p = this.parts.get(pin.part);
        let point = pin.at ? new THREE.Vector3(...pin.at) : null;
        if (point) {
          const out = new THREE.Vector3().copy(p.centre).sub(this.centre);
          const within = point.clone().sub(p.centre);
          let gap = Infinity;
          const s = p.samples;
          for (let i = 0; i < s.length; i += 3) {
            const dx = s[i] - point.x, dy = s[i + 1] - point.y, dz = s[i + 2] - point.z;
            gap = Math.min(gap, dx * dx + dy * dy + dz * dz);
          }
          const tooFar = Math.sqrt(gap) > Math.max(0.08 * this.R, p.size * 0.25);
          if (tooFar || (within.dot(out) < 0 && out.lengthSq() > 1e-4)) point = null;
        }
        return { key: pin.part, part: p, point: point ?? this.outerPoint(p), seen: true };
      });
    this.gates = (m.gates ?? []).map((g, i) => {
      const point = new THREE.Vector3(...g.at);
      return { key: `gate-${i}`, gate: g, part: this.nearestPart(point), point, seen: true, dir: this.flowDirection(point, g) };
    });
    this.applyNotes();
  }

  nearestPart(point) {
    let best = null;
    let dist = Infinity;
    for (const p of this.list) {
      const near = p.box.distanceToPoint(point);
      if (near * near > dist) continue;
      const s = p.samples;
      for (let i = 0; i < s.length; i += 3) {
        const dx = s[i] - point.x, dy = s[i + 1] - point.y, dz = s[i + 2] - point.z;
        const d = dx * dx + dy * dy + dz * dz + (p.info.vessel ? 0 : 0.01);
        if (d < dist) {
          dist = d;
          best = p;
        }
      }
    }
    return best;
  }

  /** The way blood is going at a gate: along the nearest route if one passes close, otherwise straight in or straight out. */
  flowDirection(point, gate) {
    let dir = null;
    let best = 0.05 * this.R;
    for (const f of this.manifest.flows ?? []) {
      const pts = f.points ?? [];
      for (let i = 0; i + 1 < pts.length; i++) {
        const dx = pts[i][0] - point.x, dy = pts[i][1] - point.y, dz = pts[i][2] - point.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < best) {
          best = d;
          dir = new THREE.Vector3(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
        }
      }
    }
    if (!dir || dir.lengthSq() < 1e-8) {
      dir = new THREE.Vector3().copy(point).sub(this.centre);
      if (gate.io === "in") dir.negate();
    }
    return dir.normalize();
  }

  /** Floating cards from the app: [{ part, ... }]. The stage only tracks where they point. */
  setAnnotations(list) {
    this.notesWanted = list ?? [];
    this.applyNotes();
    this.wake();
  }

  applyNotes() {
    this.notes = (this.notesWanted ?? [])
      .map((n, i) => ({ key: n.key ?? `note-${i}`, part: this.parts.get(n.part), seen: true }))
      .filter((n) => n.part)
      .map((n) => ({ ...n, point: this.pins?.find((pin) => pin.part === n.part)?.point ?? this.outerPoint(n.part) }));
    this.dirty = true;
  }

  clearModel() {
    if (!this.modelRoot) return;
    this.scene.remove(this.modelRoot);
    const textures = new Set();
    for (const p of this.list) {
      for (const mesh of p.meshes) {
        mesh.geometry.dispose();
        const maps = mesh.userData.maps;
        if (maps) for (const t of [maps.map, maps.normalMap, maps.roughnessMap]) t && textures.add(t);
      }
      p.capMats?.forEach((m) => m.dispose());
    }
    textures.forEach((t) => t.dispose());
    for (const m of this.materials?.values() ?? []) m.dispose();
    this.materials?.clear();
    this.list = [];
    this.parts = new Map();
    this.groups = new Map();
    this.capsBuilt = false;
    if (this.capRoot) {
      this.scene.remove(this.capRoot);
      this.capRoot = null;
      this.sliceFrame = null;
      this.stencilBack?.dispose();
      this.stencilFront?.dispose();
    }
    for (const f of [this.cellMesh, this.haloMesh]) {
      if (!f) continue;
      this.scene.remove(f);
      f.geometry.dispose();
      f.material.dispose();
    }
    this.cellMesh = this.haloMesh = null;
    this.pathTex?.dispose();
    this.pathTex = null;
    this.flows = [];
    this.hidden = new Set();
    this.restGlass = new Map();
    this.pan.set(0, 0, 0);
    this.hovered = null;
    this.modelRoot = null;
  }

  // ---- What the page asks for ------------------------------------------------------------------------------------------

  /** The whole model, one group broken apart, or one part in focus; and how it is drawn. */
  setView(view) {
    const was = this.view.mode;
    this.view = { ...this.view, ...view };
    if (was !== this.view.mode && (was === "segments" || this.view.mode === "segments")) this.startScan(this.view.mode === "segments" ? 1 : 0);
    if (!this.list.length) return;
    this.applyTargets();
    this.updateFit();
    this.wake();
  }

  setPalette(id) {
    const next = paletteOf(id);
    if (next === this.palette) return;
    this.palette = next;
    this.writeSegColors();
    this.applyTargets();
    this.wake();
  }

  /** Which parts are gone (eased out with a stagger) and what glass the rest drop to now that they are the outermost showing. */
  setVisibility(hidden, restGlass = new Map()) {
    const before = this.hidden;
    this.hidden = hidden;
    this.restGlass = restGlass;
    const leaving = this.list.filter((p) => hidden.has(p.id) && !before.has(p.id));
    const coming = this.list.filter((p) => !hidden.has(p.id) && before.has(p.id));
    const order = (a, b) => b.centre.distanceToSquared(this.centre) - a.centre.distanceToSquared(this.centre);
    leaving.sort(order).forEach((p, i) => (p.wait = this.still ? 0 : Math.min(0.45, i * 0.022)));
    coming.sort(order).reverse().forEach((p, i) => (p.wait = this.still ? 0 : Math.min(0.45, i * 0.022)));
    if (!this.list.length) return;
    this.applyTargets();
    this.updateFit();
    this.updateFlowVisibility();
    this.wake();
  }

  applyVisibilityNow() {
    for (const p of this.list) {
      const off = this.hidden.has(p.id);
      p.goal[VIS] = off ? 0 : 1;
      if (off) p.now[VIS] = 0;
      p.liftTo = 0;
      p.meshes.forEach((m) => (m.visible = !off));
    }
    this.updateFlowVisibility();
  }

  setSegOpacity(v) {
    this.segOpacity = v;
    this.applyTargets();
    this.wake();
  }

  /** Turns the camera to look from one side: front, back, left, right, top or bottom. */
  lookFrom(side) {
    const v = SIDES[side];
    if (!v) return;
    this.lookTo = new THREE.Vector3(...v).normalize();
    this.controls.autoRotate = false;
    this.wake();
  }

  /** Cuts the model with a plane, the way a scan slices a body: axial, coronal or sagittal, at -1..1 across its real extent. Null removes it. */
  setSlice(slice) {
    const had = this.slice?.axis;
    this.slice = slice;
    this.U.uSliceOn.value = slice ? 1 : 0;
    if (slice && this.bounds) {
      const size = this.bounds.getSize(new THREE.Vector3());
      const c = this.centre;
      const n = { axial: [0, -1, 0], coronal: [0, 0, -1], sagittal: [-1, 0, 0] }[slice.axis];
      const along = slice.axis === "axial" ? c.y + (slice.at * size.y) / 2 : slice.axis === "coronal" ? c.z + (slice.at * size.z) / 2 : c.x + (slice.at * size.x) / 2;
      this.U.uPlane.value.set(n[0], n[1], n[2], along);
      this.buildCaps();
      this.placeCaps();
      if (slice.axis !== had) {
        this.lookTo = new THREE.Vector3(...CUT_VIEW[slice.axis]).normalize();
        this.controls.autoRotate = false;
      }
    } else if (this.capRoot) {
      this.capRoot.visible = false;
      this.list.forEach((p) => p.stencils?.forEach((s) => (s.visible = false)));
      if (this.sliceFrame) this.sliceFrame.visible = false;
    }
    if (this.list.length) this.applyTargets();
    this.dirty = true;
    this.wake();
  }

  setZoom(z) {
    this.zoom = Math.min(this.maxZoom, Math.max(0.6, z));
    if (this.zoom <= 1.01) this.pan.set(0, 0, 0);
    this.wake();
  }

  zoomBy(f) {
    this.setZoom(this.zoom * f);
    return this.zoom;
  }

  /** Zooms keeping the spot under the pointer still, which is how you get close to a detail away from the centre. */
  zoomAt(f, clientX, clientY) {
    const b = this.canvas.getBoundingClientRect();
    const before = this.zoom;
    this.setZoom(before * f);
    const applied = this.zoom / before;
    if (Math.abs(applied - 1) < 1e-3 || this.zoom <= 1.01) return;
    const nx = ((clientX - b.left) / b.width) * 2 - 1;
    const ny = -(((clientY - b.top) / b.height) * 2 - 1);
    const dist = this.camera.position.distanceTo(this.controls.target);
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.pan.addScaledVector(right, nx * halfH * this.camera.aspect * (1 - 1 / applied));
    this.pan.addScaledVector(up, ny * halfH * (1 - 1 / applied));
    this.pan.clampLength(0, this.R);
  }

  wheel(e) {
    // Only take the wheel if the page around us has nowhere to scroll; a pinch always zooms.
    if (!e.ctrlKey && this.canScrollAround()) return;
    e.preventDefault();
    this.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX, e.clientY);
  }

  canScrollAround() {
    for (let el = this.canvas.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      const o = getComputedStyle(el).overflowY;
      if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1) return true;
    }
    return document.documentElement.scrollHeight > window.innerHeight + 1;
  }

  setAutoRotate(on) {
    this.controls.autoRotate = !!on && !this.still && !this.decorative;
    this.wake();
  }

  setPulse(on) {
    this.pulseOn = !!on && !this.still;
    this.wake();
  }

  setPaused(paused) {
    this.paused = !!paused;
    if (!paused) {
      this.last = performance.now();
      this.wake();
    }
  }

  /** The page's text colour: glass is tinted by it, and it says whether the page is light or dark. */
  setInk(css) {
    const c = new THREE.Color();
    try {
      c.setStyle(css, THREE.SRGBColorSpace);
    } catch {
      return;
    }
    this.ink.setRGB(c.r, c.g, c.b);
    this.ink.convertLinearToSRGB();
    const lum = 0.2126 * this.ink.r + 0.7152 * this.ink.g + 0.0722 * this.ink.b;
    const light = lum < 0.5 ? 1 : 0;
    const changed = light !== this.light;
    this.light = light;
    this.U.uLight.value = light;
    if (this.floor) this.floor.material.uniforms.uInk.value.copy(this.ink);
    if (this.haloMesh) this.haloMesh.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    if (changed && this.list.length) this.applyTargets();
    this.dirty = true;
    this.wake();
  }

  /** Moves the camera into a part, fading what is around it. Resolves when it is close, ready for a detailed model to take over. */
  flyInto(id) {
    const p = this.parts.get(id);
    if (!p) return Promise.resolve();
    this.flying = p;
    this.controls.autoRotate = false;
    this.applyTargets();
    this.updateFit();
    this.wake();
    return new Promise((res) => setTimeout(res, this.still ? 0 : 720));
  }

  flyBack() {
    this.flying = null;
    this.setPaused(false);
    if (this.list.length) {
      this.applyTargets();
      this.updateFit();
    }
    this.wake();
  }

  // ---- Targets ---------------------------------------------------------------------------------------------------------

  setPaint(p, spec) {
    const g = p.goal;
    if (spec.color) {
      const c = new THREE.Color(spec.color);
      g[PR] = c.r;
      g[PG] = c.g;
      g[PB] = c.b;
      g[PA] = spec.amt ?? 1;
    } else {
      // Keep the colour as it fades out, so that the crossfade back to baked colour does not pass through black.
      g[PA] = 0;
    }
    if (spec.rim) {
      const c = srgb(spec.rim);
      const d = toDisplay(c);
      g[RR] = d.r;
      g[RG] = d.g;
      g[RB] = d.b;
      g[RA] = spec.rimAmt ?? 0;
    } else {
      g[RA] = 0;
    }
  }

  applyTargets(first = false) {
    const { group, part, exploded, mode } = this.view;
    const light = !!this.light;
    const xray = XRAY[light ? "light" : "dark"];
    const flowOn = mode === "flow";
    const reduced = this.still || first;
    const spreadW = 1.45;
    const spreadG = 1.7;
    let rank = 0;
    const splitKey = `${group}|${exploded}`;
    const split = splitKey !== this.splitKey;
    this.splitKey = splitKey;
    for (const p of this.list) {
      const info = p.info;
      const g = this.groups.get(info.group);
      const hot = (info.glow ?? 0) >= 0.85 || (this.composite && p.beats && !info.vessel);
      const ctx = { blood: p.blood, hot, light };
      p.role = roleOf(info, ctx);
      const spec = paintFor(this.palette, info, ctx);
      const shell = p.role === "shell";
      const override = this.restGlass.has(p.id) ? this.restGlass.get(p.id) : null;
      let glass = override != null ? override : spec.glass != null ? spec.glass : info.glass ?? 0;
      let emit = Math.max(spec.emit, info.glow ?? 0);
      let halo = Math.max(spec.halo, (info.glow ?? 0) >= 0.5 ? info.glow : 0);
      let alpha = 1;
      let look = { color: spec.color, amt: spec.color ? 1 : 0, rim: spec.rim, rimAmt: spec.rimAmt };
      if (mode === "xray") {
        const dense = info.vessel || info.kind === "bone" || info.kind === "cartilage";
        look = { color: dense ? xray.dense : xray.tissue, amt: 1, rim: xray.edge, rimAmt: dense ? 0.7 : 0.9 };
        glass = dense ? 0.42 : 0.97;
        emit = dense ? 0.3 : 0.02;
        halo = 0;
      } else if (flowOn) {
        if (info.vessel && (p.role === "artery" || p.role === "vein")) {
          const col = BLOOD[p.role];
          look = { color: col, amt: 1, rim: col, rimAmt: 0.25 };
          glass = 0.62;
          emit = 0.18;
        } else if (!shell && info.vessel) {
          glass = 0.7;
        } else {
          look = { color: light ? "#8a97a6" : "#9fb0c2", amt: 0.65, rim: light ? "#4d5a68" : "#d6e2ee", rimAmt: 0.5 };
          glass = 0.965;
          emit = 0;
        }
        halo = 0;
      } else if (mode === "segments") {
        look = { color: null, amt: 0, rim: "#000000", rimAmt: 0.22 };
        glass = shell ? Math.max(glass, 0.8) : 0;
        alpha = shell ? 1 : this.segOpacity;
        emit = 0;
        halo = 0;
      }
      if (this.slice && !shell) glass = 0;
      if (exploded) glass = 0;

      if (group) {
        const mine = info.group === group;
        const chosen = !part || part === p.id;
        p.goal[GHOST] = !mine ? 1 : chosen ? 0 : 0.82;
        p.goal[GLASS] = mine && chosen ? 0 : glass;
        p.goal[HILITE] = part === p.id ? 0.5 : 0;
        if (mine) p.to.copy(p.centre).sub(g.centre).multiplyScalar(spreadG);
        else p.to.set(0, 0, 0);
      } else if (this.flying) {
        const me = p === this.flying || (this.flying.info.organ && info.organ === this.flying.info.organ);
        p.goal[GHOST] = me ? 0 : 1;
        p.goal[GLASS] = me ? 0 : glass;
        p.goal[HILITE] = me ? 0.2 : 0;
        p.to.set(0, 0, 0);
      } else {
        const toCentre = (g?.centre ?? p.centre).clone().sub(this.centre);
        const away = toCentre.lengthSq() > 0.002 ? toCentre.normalize().multiplyScalar(0.42 * this.R) : new THREE.Vector3();
        p.to.copy(p.centre).sub(g?.centre ?? p.centre).multiplyScalar(spreadW).add(away).multiplyScalar(exploded ? 1 : 0);
        p.goal[GHOST] = 0;
        p.goal[GLASS] = glass;
        p.goal[HILITE] = 0;
      }
      if (this.hovered === p && p.goal[HILITE] < 0.3) p.goal[HILITE] = 0.3;
      p.goal[ALPHA] = alpha;
      p.goal[EMIT] = emit;
      p.goal[HALO] = halo;
      p.haloColor = info.halo ?? this.palette.halo ?? "#ff6a2a";
      this.setPaint(p, look);

      const gone = this.hidden.has(p.id);
      p.goal[VIS] = gone ? 0 : 1;
      p.liftTo = gone ? 0.14 * this.R : 0;
      const settled = gone && p.now[VIS] < 0.01;
      p.meshes.forEach((m) => (m.visible = !settled));
      if (split && !first && !this.still && !gone) {
        p.wait = Math.min(0.32, rank * 0.014);
        rank += 1;
      }
      if (reduced) p.wait = 0;
    }
    this.dirty = true;
  }

  settleAll() {
    for (const p of this.list) {
      p.now.set(p.goal);
      p.offset.copy(p.to);
      p.lift = p.liftTo;
      p.wait = 0;
    }
  }

  startIntro() {
    if (this.still) {
      this.intro = null;
      this.writeAll();
      return;
    }
    const order = [...this.list].sort((a, b) => a.centre.distanceToSquared(this.centre) - b.centre.distanceToSquared(this.centre));
    const span = Math.min(0.6, order.length * 0.03);
    order.forEach((p, i) => {
      p.introAt = (i / Math.max(1, order.length - 1)) * span;
      p.introDir = p.liftDir.clone().multiplyScalar((0.55 + 0.4 * Math.random()) * this.R);
      p.intro.copy(p.introDir);
      p.introVis = 0;
    });
    this.intro = { t: 0, end: span + 0.95 };
    this.writeAll();
  }

  startScan(to) {
    const from = this.U.uScan.value.y;
    if (this.still || !this.bounds) {
      this.U.uScan.value.set(10, to, to, 0);
      return;
    }
    this.scan = { t: 0, dur: 1.15, from: this.scan ? this.scan.to : from, to };
  }

  /** Frames what can be seen, from its real bounds, whichever way it is being looked at. */
  updateFit() {
    if (!this.list.length) return;
    const { group, part, exploded } = this.view;
    let members;
    if (this.flying) {
      const organ = this.flying.info.organ;
      members = organ ? this.list.filter((p) => p.info.organ === organ) : [this.flying];
    } else if (part && this.parts.has(part)) members = [this.parts.get(part)];
    else if (group) members = this.groups.get(group)?.members ?? this.list;
    else members = this.list.filter((p) => !this.hidden.has(p.id));
    if (!members.length) members = this.list;
    const box = new THREE.Box3();
    for (const p of members) {
      const b = p.box.clone();
      b.translate(p.to);
      box.union(b);
    }
    const c = box.getCenter(new THREE.Vector3());
    // The widest reach around the vertical axis through the centre, measured from real vertices, not a box corner.
    let r2 = 0;
    for (const p of members) {
      const s = p.samples;
      for (let i = 0; i < s.length; i += 3) {
        const dx = s[i] + p.to.x - c.x;
        const dz = s[i + 2] + p.to.z - c.z;
        const d = dx * dx + dz * dz;
        if (d > r2) r2 = d;
      }
    }
    let hx = Math.max(0.02, Math.sqrt(r2));
    let hy = Math.max(0.02, box.getSize(new THREE.Vector3()).y / 2);
    const frame = this.manifest?.frame;
    if (frame && !group && !exploded && !this.flying) {
      c.set(frame.focus[0], frame.focus[1], frame.focus[2]);
      hy = frame.reach;
      hx = Math.min(hx, frame.reach);
    }
    this.focusTo.copy(c);
    this.reachTo = { hx, hy };
    this.wake();
  }

  /** How far back the camera must stand for that reach to fit this canvas, at its present tilt, with a margin for perspective. */
  fitDistance(reach) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const tilt = Math.abs(dir.y);
    const flat = Math.sqrt(Math.max(0, 1 - tilt * tilt));
    const vertical = reach.hy * flat + reach.hx * tilt;
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const tanH = tanV * this.camera.aspect;
    const d = Math.max(vertical / tanV, reach.hx / tanH);
    return d * 1.05 + reach.hx * 0.45;
  }

  snapCamera() {
    this.reach = { ...this.reachTo };
    this.focus.copy(this.focusTo);
    this.controls.target.copy(this.focus);
    const dir = new THREE.Vector3(0.0, 0.03, 1).normalize();
    const dist = this.fitDistance(this.reach);
    this.camera.position.copy(this.focus).addScaledVector(dir, dist);
    this.controls.target.copy(this.focus);
    const again = this.fitDistance(this.reach);
    this.camera.position.copy(this.focus).addScaledVector(dir, again);
    this.deco = { yaw: 0, pitch: Math.asin(dir.y) };
    this.camera.updateMatrixWorld();
    this.updateFloor();
  }

  resize() {
    const el = this.canvas.parentElement;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    this.wake();
  }

  // ---- Flow ------------------------------------------------------------------------------------------------------------

  /** Everything that travels the flow routes: one instanced draw, with every position worked out on the GPU from a texture of the routes. */
  buildFlows(manifest) {
    const flows = (manifest.flows ?? []).filter((f) => (f.points?.length ?? 0) >= 2);
    if (!flows.length) return;
    const data = new Float32Array((PATH_W + 1) * flows.length * 4);
    const budget = 16000;
    const planned = [];
    let wanted = 0;
    const speeds = { artery: 0.46, vein: 0.3, air: 0.34 };
    flows.forEach((f, row) => {
      const pts = f.points.map((p) => new THREE.Vector3(...p));
      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
      curve.arcLengthDivisions = 48;
      const length = curve.getLength();
      const sampled = curve.getSpacedPoints(PATH_W - 1);
      const radius = f.radius ?? 0.02;
      const cell = f.cell ?? 0.02;
      sampled.forEach((v, i) => {
        const o = (row * (PATH_W + 1) + i) * 4;
        data[o] = v.x;
        data[o + 1] = v.y;
        data[o + 2] = v.z;
        data[o + 3] = radius;
      });
      data[(row * (PATH_W + 1) + PATH_W) * 4] = 1;
      const lanes = Math.max(1, Math.min(6, Math.round((radius / cell) * 1.5)));
      const count = Math.max(6, Math.round((length / Math.max(cell * 1.5, 0.012)) * lanes));
      wanted += count;
      planned.push({ f, row, length, count, sampled });
    });
    const scale = Math.min(1, budget / wanted);
    let total = 0;
    planned.forEach((p) => {
      p.count = Math.max(4, Math.round(p.count * scale));
      total += p.count;
    });
    const iA = new Float32Array(total * 4);
    const iB = new Float32Array(total * 4);
    let n = 0;
    for (const p of planned) {
      const kind = p.f.kind === "vein" ? 1 : p.f.kind === "air" ? 2 : 0;
      const rate = (speeds[p.f.kind] ?? 0.4) / Math.max(0.15, p.length);
      const cell = p.f.cell ?? 0.02;
      for (let i = 0; i < p.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * 0.9;
        iA.set([p.row, (i + Math.random() * 0.6) / p.count, rate, cell * (0.82 + Math.random() * 0.36)], n * 4);
        iB.set([Math.cos(angle) * rad, Math.sin(angle) * rad, 0.6 + Math.random() * 1.6, kind], n * 4);
        n += 1;
      }
    }
    this.pathData = data;
    this.pathTex = new THREE.DataTexture(data, PATH_W + 1, flows.length, THREE.RGBAFormat, THREE.FloatType);
    this.pathTex.minFilter = this.pathTex.magFilter = THREE.NearestFilter;
    this.pathTex.needsUpdate = true;
    this.flows = planned.map((p) => {
      // Which part this route runs through, so that hiding that part takes its cells with it.
      const votes = new Map();
      for (const v of p.sampled) {
        let best = null;
        let dist = Infinity;
        for (const q of this.list) {
          if (!q.info.vessel) continue;
          const d = q.box.distanceToPoint(v);
          if (d < dist) {
            dist = d;
            best = q;
          }
        }
        if (best) votes.set(best, (votes.get(best) ?? 0) + 1);
      }
      let owner = null;
      let most = 0;
      votes.forEach((c, q) => {
        if (c > most) {
          most = c;
          owner = q;
        }
      });
      return { ...p.f, row: p.row, owner };
    });
    const geo = new THREE.InstancedBufferGeometry();
    const base = cellGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.attributes.position);
    geo.setAttribute("normal", base.attributes.normal);
    geo.setAttribute("iA", new THREE.InstancedBufferAttribute(iA, 4));
    geo.setAttribute("iB", new THREE.InstancedBufferAttribute(iB, 4));
    geo.instanceCount = total;
    this.cellU = {
      uPaths: { value: this.pathTex },
      uClocks: { value: this.clocks },
      uOn: { value: 0 },
      uSeconds: { value: 0 },
      uSurge: { value: 0 },
      uColors: { value: [new THREE.Color(0xe01a22), new THREE.Color(0x2a66ff), new THREE.Color(BLOOD.air)] },
      uPlane: this.U.uPlane,
      uSliceOn: this.U.uSliceOn,
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.cellU, vertexShader: CELL_VERT, fragmentShader: CELL_FRAG, toneMapped: false });
    this.cellMesh = new THREE.Mesh(geo, mat);
    this.cellMesh.frustumCulled = false;
    this.cellMesh.visible = false;
    this.scene.add(this.cellMesh);
    this.cellCount = total;
    this.flowOn = 0;
  }

  updateFlowVisibility() {
    if (!this.pathTex) return;
    for (const f of this.flows) {
      const off = f.owner && this.hidden.has(f.owner.id);
      this.pathData[(f.row * (PATH_W + 1) + PATH_W) * 4] = off ? 0 : 1;
    }
    this.pathTex.needsUpdate = true;
  }

  // ---- Halos -----------------------------------------------------------------------------------------------------------

  /** The composite part of a real glow: a soft colour pool around hot organs, spilling over the shell and the background. */
  buildHalos() {
    const cap = 24;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.haloAt = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.haloTint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.haloAt.setUsage(THREE.DynamicDrawUsage);
    this.haloTint.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("iAt", this.haloAt);
    geo.setAttribute("iTint", this.haloTint);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSurge: { value: 0 } },
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: this.light ? THREE.NormalBlending : THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.haloMesh = new THREE.Mesh(geo, mat);
    this.haloMesh.frustumCulled = false;
    this.haloMesh.renderOrder = 999;
    this.scene.add(this.haloMesh);
    this.haloCap = cap;
  }

  placeHalos() {
    if (!this.haloMesh) return;
    const tint = new THREE.Color();
    let n = 0;
    for (const p of this.list) {
      if (n >= this.haloCap) break;
      const a = p.now[HALO] * p.now[VIS] * (1 - p.now[GHOST]);
      if (a < 0.01 || !p.haloColor) continue;
      const size = p.size;
      this.haloAt.setXYZW(n, p.centre.x + p.offset.x, p.centre.y + p.offset.y, p.centre.z + p.offset.z, size * 2.1 + 0.08 * this.R);
      tint.set(p.haloColor);
      tint.convertLinearToSRGB();
      this.haloTint.setXYZW(n, tint.r, tint.g, tint.b, a * (this.light ? 0.5 : 0.42));
      n += 1;
    }
    this.haloMesh.geometry.instanceCount = n;
    this.haloMesh.visible = n > 0;
    this.haloAt.needsUpdate = true;
    this.haloTint.needsUpdate = true;
  }

  // ---- Floor -----------------------------------------------------------------------------------------------------------

  /** A soft pool under the model. It lives in the scene, so it stays under the organ and can never show through a panel. */
  buildFloor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uInk: { value: this.ink.clone() }, uAmt: { value: 0 } },
      vertexShader: "varying vec2 vF; void main(){ vF = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 uInk; uniform float uAmt; varying vec2 vF; void main(){ float r = length(vF); if (r > 1.0) discard; float f = pow(1.0 - r, 1.8); gl_FragColor = vec4(uInk, f * uAmt); }",
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.renderOrder = -5;
    this.floor.frustumCulled = false;
    this.floorAmt = 0;
    this.scene.add(this.floor);
  }

  updateFloor(dt = 1) {
    if (!this.bounds) return;
    const { group, exploded } = this.view;
    const hasFrame = !!this.manifest?.frame;
    const want = !group && !exploded && !this.flying && !hasFrame ? 0.22 : 0;
    // Seen from below or straight on top it would only get in the way.
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const facing = smooth(-0.1, 0.05, dir.y + 0.12) * (1 - smooth(0.7, 0.92, dir.y));
    this.floorAmt = damp(this.floorAmt, want, dt, 5);
    const size = this.bounds.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.z) * 0.72;
    this.floor.position.set(this.centre.x, this.bounds.min.y - 0.05 * this.R, this.centre.z);
    this.floor.scale.set(r, r * 0.55, 1);
    this.floor.material.uniforms.uAmt.value = this.floorAmt * facing * (this.light ? 0.9 : 1);
    this.floor.visible = this.floorAmt * facing > 0.004;
  }

  // ---- Picking ---------------------------------------------------------------------------------------------------------

  buildPick() {
    this.pickRT = new THREE.WebGLRenderTarget(2, 1, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
    this.pickRT.texture.colorSpace = THREE.NoColorSpace;
    this.pickRT.scissorTest = true;
    this.pickU = { uPickAll: { value: 0 } };
    this.pickMat = new THREE.ShaderMaterial({
      uniforms: { ...this.U, ...this.pickU, uDepthMax: { value: 1 } },
      vertexShader: `
        ${VERT_PARS}
        uniform float uPickAll;
        flat varying float vId;
        varying float vDepth;
        varying vec3 vCut;
        void main() {
          int row = int(aPart + 0.5);
          vec4 off = texelFetch(uState, ivec2(${R_OFFSET}, row), 0);
          vec4 look = texelFetch(uState, ivec2(${R_LOOK}, row), 0);
          vec4 pump = texelFetch(uState, ivec2(${R_PUMP}, row), 0);
          vec3 rest = (modelMatrix * vec4(position, 1.0)).xyz;
          vec3 moved = organLive(rest, normalize(mat3(modelMatrix) * normal), pump) + off.xyz;
          vCut = moved;
          vec4 mv = viewMatrix * vec4(moved, 1.0);
          vDepth = -mv.z;
          vId = aPart + 1.0;
          gl_Position = projectionMatrix * mv;
          // Hidden and ghosted parts cannot be picked; glass only answers on the second try, when nothing solid is under the pointer.
          if (off.w < 0.5 || look.y > 0.5 || (uPickAll < 0.5 && look.z > 0.3)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec4 uPlane;
        uniform float uSliceOn, uDepthMax;
        flat varying float vId;
        varying float vDepth;
        varying vec3 vCut;
        void main() {
          if (uSliceOn > 0.5 && dot(vCut, uPlane.xyz) + uPlane.w < 0.0) discard;
          float id = floor(vId + 0.5);
          float d = clamp(vDepth / uDepthMax, 0.0, 0.9999) * 65535.0;
          gl_FragColor = vec4(mod(id, 256.0), floor(id / 256.0), mod(floor(d), 256.0), floor(d / 256.0)) / 255.0;
        }
      `,
      side: THREE.DoubleSide,
      toneMapped: false,
      blending: THREE.NoBlending,
    });
  }

  /** Asks what is under a canvas pixel. It answers after the GPU has, usually within a frame or two. */
  ask(x, y, cb) {
    this.pickJobs = this.pickJobs.filter((j) => j.kind !== cb.kind || cb.kind === "tap");
    this.pickJobs.push({ x, y, cb, kind: cb.kind });
    this.wake();
  }

  runPick() {
    if (this.pickBusy || !this.pickJobs.length || !this.list.length) return;
    const job = this.pickJobs.shift();
    this.pickBusy = true;
    const r = this.renderer;
    const cam = this.pickCam;
    cam.copy(this.camera);
    cam.setViewOffset(this.w, this.h, job.x, job.y, 1, 1);
    cam.updateProjectionMatrix();
    cam.layers.set(1);
    const autoClear = r.autoClear;
    r.autoClear = false;
    const rt = this.pickRT;
    this.pickMat.uniforms.uDepthMax.value = this.camera.far;
    this.scene.overrideMaterial = this.pickMat;
    rt.viewport.set(0, 0, 2, 1);
    rt.scissor.set(0, 0, 2, 1);
    r.setRenderTarget(rt);
    r.clear();
    for (let i = 0; i < 2; i++) {
      rt.viewport.set(i, 0, 1, 1);
      rt.scissor.set(i, 0, 1, 1);
      r.setRenderTarget(rt);
      this.pickMat.uniforms.uPickAll.value = i;
      r.render(this.scene, cam);
    }
    this.scene.overrideMaterial = null;
    r.setRenderTarget(null);
    r.autoClear = autoClear;
    const done = () => {
      if (!this.alive) return;
      const b = this.pickBuf;
      const decode = (o) => {
        const id = b[o] + b[o + 1] * 256;
        if (!id) return null;
        const depth = ((b[o + 2] + b[o + 3] * 256) / 65535) * this.camera.far;
        return { part: this.list[id - 1], depth };
      };
      const solid = decode(0);
      this.pickBusy = false;
      job.cb(solid ?? decode(4), solid);
      if (this.pickJobs.length) this.wake();
    };
    r.readRenderTargetPixelsAsync(rt, 0, 0, 2, 1, this.pickBuf).then(done, () => (this.pickBusy = false));
  }

  pointerMove(e) {
    if (e.buttons) {
      // A right drag, or shift and drag, slides the view: the way to move along a part once zoomed in.
      if (this.down && (this.down.button === 2 || this.down.shift)) {
        const dist = this.camera.position.distanceTo(this.controls.target);
        const unit = (2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / this.h;
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
        this.pan.addScaledVector(right, -e.movementX * unit).addScaledVector(up, e.movementY * unit);
        this.pan.clampLength(0, this.R);
        this.wake();
      }
      return;
    }
    const now = performance.now();
    if (now - this.hoverAt < 40) return;
    this.hoverAt = now;
    const b = this.canvas.getBoundingClientRect();
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    const cb = (hit) => this.setHover(hit?.part ?? null, { x, y });
    cb.kind = "hover";
    this.ask(x, y, cb);
  }

  setHover(p, at) {
    if (this.hovered === p) {
      if (p && at) this.cb.onHover?.({ id: p.id, label: p.info.label, x: at.x, y: at.y });
      return;
    }
    const was = this.hovered;
    this.hovered = p;
    if (was) was.goal[HILITE] = this.view.part === was.id ? 0.5 : 0;
    if (p && p.goal[HILITE] < 0.3) p.goal[HILITE] = 0.3;
    this.canvas.style.cursor = p ? "pointer" : "grab";
    this.cb.onHover?.(p && at ? { id: p.id, label: p.info.label, x: at.x, y: at.y } : null);
    this.wake();
  }

  release(e) {
    const d = this.down;
    this.down = null;
    if (!d || d.button === 2 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const b = this.canvas.getBoundingClientRect();
    const cb = (hit) => {
      if (hit?.part) this.cb.onPick?.(hit.part.id, hit.part.info.group);
      else this.cb.onMiss?.();
    };
    cb.kind = "tap";
    this.ask(e.clientX - b.left, e.clientY - b.top, cb);
  }

  // ---- Slice caps ------------------------------------------------------------------------------------------------------

  /**
   * The classic stencil cap: for each part crossing the plane, count back faces up and front faces down, and wherever the count
   * is not zero the plane is inside that part, so paint a flat section there. That gives real filled cross-sections.
   */
  buildCaps() {
    if (this.capsBuilt || !this.list.length) return;
    this.capsBuilt = true;
    this.capRoot = new THREE.Group();
    this.scene.add(this.capRoot);
    const stencilMat = (side, op) =>
      new THREE.ShaderMaterial({
        uniforms: this.U,
        vertexShader: `
          ${VERT_PARS}
          varying vec3 vCut;
          void main() {
            int row = int(aPart + 0.5);
            vec4 off = texelFetch(uState, ivec2(${R_OFFSET}, row), 0);
            vec4 pump = texelFetch(uState, ivec2(${R_PUMP}, row), 0);
            vec3 rest = (modelMatrix * vec4(position, 1.0)).xyz;
            vec3 moved = organLive(rest, normalize(mat3(modelMatrix) * normal), pump) + off.xyz;
            vCut = moved;
            gl_Position = projectionMatrix * viewMatrix * vec4(moved, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec4 uPlane;
          varying vec3 vCut;
          void main() {
            if (dot(vCut, uPlane.xyz) + uPlane.w < 0.0) discard;
            gl_FragColor = vec4(0.0);
          }
        `,
        side,
        depthTest: false,
        depthWrite: false,
        colorWrite: false,
        stencilWrite: true,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilFail: op,
        stencilZFail: op,
        stencilZPass: op,
      });
    this.stencilBack = stencilMat(THREE.BackSide, THREE.IncrementWrapStencilOp);
    this.stencilFront = stencilMat(THREE.FrontSide, THREE.DecrementWrapStencilOp);
    const quad = new THREE.PlaneGeometry(1, 1);
    // Largest first, so a part nested inside another paints over its parent's section.
    const bySize = [...this.list].sort((a, b) => b.box.getSize(new THREE.Vector3()).lengthSq() - a.box.getSize(new THREE.Vector3()).lengthSq());
    bySize.forEach((p, i) => {
      const order = 10 + i * 2;
      p.stencils = [];
      for (const mesh of p.meshes) {
        for (const mat of [this.stencilBack, this.stencilFront]) {
          const s = new THREE.Mesh(mesh.geometry, mat);
          s.frustumCulled = false;
          s.renderOrder = order;
          s.visible = false;
          mesh.add(s);
          p.stencils.push(s);
        }
      }
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() } },
        vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
        fragmentShader: `
          uniform vec3 uColor;
          varying vec3 vW;
          float h(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          void main() {
            float g = h(floor(vW * 320.0)) * 0.05 + h(floor(vW * 90.0)) * 0.05;
            gl_FragColor = vec4(uColor * (0.95 + g), 1.0);
            #include <colorspace_fragment>
          }
        `,
        depthFunc: THREE.LessEqualDepth,
        toneMapped: false,
        side: THREE.DoubleSide,
        stencilWrite: true,
        stencilRef: 0,
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilFail: THREE.ZeroStencilOp,
        stencilZFail: THREE.ZeroStencilOp,
        stencilZPass: THREE.ZeroStencilOp,
      });
      const cap = new THREE.Mesh(quad, mat);
      cap.frustumCulled = false;
      cap.renderOrder = order + 1;
      cap.visible = false;
      cap.onAfterRender = (r) => r.clearStencil();
      this.capRoot.add(cap);
      p.cap = cap;
      p.capMats = [mat];
    });
    // The plane's outline, like the reference line on a scanner.
    const frame = new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3)),
      new THREE.LineBasicMaterial({ color: this.ink, transparent: true, opacity: 0.45, toneMapped: false }),
    );
    frame.frustumCulled = false;
    frame.renderOrder = 998;
    this.sliceFrame = frame;
    this.capRoot.add(frame);
  }

  placeCaps() {
    if (!this.capsBuilt || !this.slice) return;
    this.capRoot.visible = true;
    const pl = this.U.uPlane.value;
    const n = new THREE.Vector3(pl.x, pl.y, pl.z);
    const at = n.clone().multiplyScalar(-pl.w);
    const size = this.bounds.getSize(new THREE.Vector3());
    const big = size.length() * 2.4;
    const look = at.clone().add(n);
    for (const p of this.list) {
      const box = p.box.clone().translate(p.offset);
      // Does the plane pass through this part's box?
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < 8; i++) {
        const x = i & 1 ? box.max.x : box.min.x;
        const y = i & 2 ? box.max.y : box.min.y;
        const z = i & 4 ? box.max.z : box.min.z;
        const d = x * n.x + y * n.y + z * n.z + pl.w;
        lo = Math.min(lo, d);
        hi = Math.max(hi, d);
      }
      const on = lo < 0 && hi > 0 && p.now[VIS] > 0.5 && p.now[GLASS] < 0.7 && p.now[GHOST] < 0.5;
      p.stencils?.forEach((s) => (s.visible = on));
      if (p.cap) {
        p.cap.visible = on;
        if (on) {
          p.cap.position.copy(at);
          p.cap.lookAt(look);
          p.cap.scale.setScalar(big);
        }
      }
    }
    const f = this.sliceFrame;
    if (f) {
      f.visible = true;
      f.position.copy(this.centre).addScaledVector(n, -(n.dot(this.centre) + pl.w));
      f.lookAt(f.position.clone().add(n));
      f.scale.set(size.length() * 0.8, size.length() * 0.8, 1);
    }
  }

  /** A section shows the tissue's own flesh, leaning toward the segment colours; fully so in the Segments view. */
  tintCaps(seg) {
    const flesh = new THREE.Color();
    for (const p of this.list) {
      if (!p.cap?.visible) continue;
      const n = p.now;
      flesh.copy(p.mean);
      flesh.lerp(new THREE.Color(n[PR], n[PG], n[PB]), n[PA]);
      flesh.multiplyScalar(1.15);
      flesh.lerp(p.seg, Math.max(seg, 0.42));
      p.cap.material.uniforms.uColor.value.copy(flesh);
    }
  }

  // ---- The loop --------------------------------------------------------------------------------------------------------

  syncMaterials() {
    for (const p of this.list) p.meshes.forEach((m) => (m.material = this.materialFor(p, m, false)));
  }

  materialFor(p, mesh, clear) {
    const maps = mesh.userData.maps;
    const key = maps ? `${p.id}:${mesh.uuid}:${clear}` : `${mesh.userData.colors}:${clear}`;
    let m = this.materials.get(key);
    if (!m) {
      m = organMaterial(this.U, { maps, colors: mesh.userData.colors, clear });
      this.materials.set(key, m);
    }
    return m;
  }

  precompile() {
    // Both variants up front, so the first move to glass does not stall.
    const swap = (clear) => this.list.forEach((p) => p.meshes.forEach((m) => (m.material = this.materialFor(p, m, clear))));
    swap(true);
    this.renderer.compile(this.scene, this.camera);
    swap(false);
    this.renderer.compile(this.scene, this.camera);
    for (const p of this.list) this.refreshClear(p, true);
  }

  refreshClear(p, force = false) {
    const n = p.now;
    const clear = n[GHOST] > 0.004 || n[GLASS] > 0.004 || n[ALPHA] < 0.996;
    if (clear === p.clear && !force) return;
    p.clear = clear;
    for (const mesh of p.meshes) {
      mesh.material = this.materialFor(p, mesh, clear);
      mesh.renderOrder = clear ? 2 : 0;
    }
  }

  writeAll() {
    for (const p of this.list) this.writePart(p);
    if (this.stateTex) this.stateTex.needsUpdate = true;
  }

  writePart(p) {
    const d = this.stateData;
    const n = p.now;
    const o = p.index * ROWS * 4;
    const ix = p.intro.x, iy = p.intro.y, iz = p.intro.z;
    d[o + R_OFFSET * 4] = p.offset.x + ix + p.liftDir.x * p.lift;
    d[o + R_OFFSET * 4 + 1] = p.offset.y + iy + p.liftDir.y * p.lift;
    d[o + R_OFFSET * 4 + 2] = p.offset.z + iz + p.liftDir.z * p.lift;
    d[o + R_OFFSET * 4 + 3] = n[VIS] * (p.introVis ?? 1);
    d[o + R_LOOK * 4] = n[ALPHA];
    d[o + R_LOOK * 4 + 1] = n[GHOST];
    d[o + R_LOOK * 4 + 2] = n[GLASS];
    d[o + R_LOOK * 4 + 3] = n[HILITE];
    d[o + R_PAINT * 4] = n[PR];
    d[o + R_PAINT * 4 + 1] = n[PG];
    d[o + R_PAINT * 4 + 2] = n[PB];
    d[o + R_PAINT * 4 + 3] = n[PA];
    d[o + R_PUMP * 4 + 3] = n[EMIT];
    d[o + R_RIM * 4] = n[RR];
    d[o + R_RIM * 4 + 1] = n[RG];
    d[o + R_RIM * 4 + 2] = n[RB];
    d[o + R_RIM * 4 + 3] = n[RA];
  }

  stepParts(dt) {
    let moving = false;
    const k = 1 - Math.exp(-dt * 6);
    const kv = 1 - Math.exp(-dt * 4.2);
    const koff = 1 - Math.exp(-dt * 5.5);
    for (const p of this.list) {
      if (p.wait > 0) {
        p.wait -= dt;
        moving = true;
        continue;
      }
      const now = p.now;
      const goal = p.goal;
      let change = 0;
      for (let i = 0; i < LOOK; i++) {
        const diff = goal[i] - now[i];
        if (diff === 0) continue;
        change += Math.abs(diff);
        now[i] = Math.abs(diff) < 0.0008 ? goal[i] : now[i] + diff * (i === VIS ? kv : k);
      }
      const away = p.offset.distanceToSquared(p.to);
      if (away > 1e-7) {
        p.offset.lerp(p.to, koff);
        change += away;
      } else if (away > 0) p.offset.copy(p.to);
      if (Math.abs(p.lift - p.liftTo) > 1e-4) {
        p.lift += (p.liftTo - p.lift) * kv;
        change += 1;
      } else p.lift = p.liftTo;
      if (change > 0) {
        moving = true;
        this.refreshClear(p);
        this.writePart(p);
        if (now[VIS] < 0.01 && goal[VIS] === 0) p.meshes.forEach((m) => (m.visible = false));
      }
    }
    return moving;
  }

  stepIntro(dt) {
    const it = this.intro;
    if (!it) return false;
    it.t += dt;
    const done = it.t >= it.end;
    for (const p of this.list) {
      const t = Math.min(1, Math.max(0, (it.t - p.introAt) / 0.95));
      const e = 1 - Math.pow(1 - t, 4);
      p.intro.copy(p.introDir).multiplyScalar(done ? 0 : 1 - e);
      p.introVis = done ? 1 : smooth(0, 0.42, t);
      this.writePart(p);
    }
    if (done) this.intro = null;
    return true;
  }

  stepScan(dt) {
    const s = this.scan;
    if (!s) return false;
    s.t += dt / s.dur;
    const u = this.U.uScan.value;
    const hi = this.bounds.max.y + 0.08;
    const lo = this.bounds.min.y - 0.08;
    const e = s.t < 0.5 ? 2 * s.t * s.t : 1 - Math.pow(-2 * s.t + 2, 2) / 2;
    if (s.t >= 1) {
      u.set(lo - 10, s.to, s.to, 0);
      this.scan = null;
    } else {
      u.set(hi + (lo - hi) * e, s.to, s.from, Math.min(1, s.t * 8, (1 - s.t) * 8));
    }
    return true;
  }

  stepPulse(dt) {
    const u = this.U.uPulse.value;
    if (this.pulseOn && !this.still) {
      this.beat = (this.beat ?? 0) + (dt * BPM) / 60;
      this.breathT = (this.breathT ?? 0) + (dt * BREATHS) / 60;
    }
    const b = (this.breathT ?? 0) % 1;
    // In for two fifths of the breath, then a slower way out.
    const breath = b < 0.4 ? Math.pow(Math.sin(((b / 0.4) * Math.PI) / 2), 2) : Math.pow(Math.cos((((b - 0.4) / 0.6) * Math.PI) / 2), 2);
    u.set((this.beat ?? 0) % 1, breath, this.clock, this.pulseOn ? 1 : 0);
    const wave = this.pulseOn ? lubDub(this.beat ?? 0) : 0;
    this.surge = wave;
    return this.pulseOn && (this.hasBeat || this.hasBreath);
  }

  stepFlow(dt) {
    if (!this.cellMesh) return false;
    const want = this.view.mode === "flow" && !this.view.group ? 1 : 0;
    this.flowOn = this.still ? want : damp(this.flowOn, want, dt, 4);
    const on = this.flowOn;
    this.cellMesh.visible = on > 0.01;
    if (!this.cellMesh.visible) return false;
    const w = this.surge ?? 0;
    if (!this.still) {
      // Arteries surge with every beat. Veins run steadier. Air follows the breath.
      this.clocks.x += dt * (0.28 + 1.9 * w);
      this.clocks.y += dt * (0.7 + 0.35 * w);
      this.clocks.z += dt * (0.5 + 0.9 * this.U.uPulse.value.y);
      this.cellU.uSeconds.value = this.clock;
    }
    this.cellU.uOn.value = on;
    this.cellU.uSurge.value = w;
    return true;
  }

  stepLight() {
    if (this.still) return;
    // The key light wanders slowly, so highlights slide over the wet surface even when nothing else moves.
    const t = this.clock;
    const a = Math.sin(t * 0.21) * 0.2;
    const b = Math.cos(t * 0.17) * 0.1;
    this.key.position.set(-3 * Math.cos(a) - 4.4 * Math.sin(a), 3.8 + b * 3, 4.4 * Math.cos(a) - 3 * Math.sin(a));
  }

  stepCamera(dt) {
    let moving = false;
    const rate = this.still ? 100 : 5;
    const hx = damp(this.reach.hx, this.reachTo.hx, dt, rate);
    const hy = damp(this.reach.hy, this.reachTo.hy, dt, rate);
    this.reach = { hx, hy };
    const target = this.focusTo.clone().add(this.pan);
    if (this.focus.distanceToSquared(target) > 1e-7) {
      moving = true;
      this.focus.lerp(target, 1 - Math.exp(-dt * rate));
    }
    const from = this.camera.position.clone().sub(this.controls.target);
    const len = from.length();
    if (this.decorative) {
      if (!this.still) {
        this.tilt.x = damp(this.tilt.x, this.tilt.tx, dt, 2.2);
        this.tilt.y = damp(this.tilt.y, this.tilt.ty, dt, 2.2);
      }
      const yaw = (this.still ? 0 : Math.sin(this.clock * 0.13) * 0.52) + this.tilt.x * 0.22;
      const pitch = 0.04 - this.tilt.y * 0.1;
      from.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      this.camera.position.copy(this.controls.target).add(from);
    } else if (this.lookTo) {
      from.normalize().lerp(this.lookTo, 1 - Math.exp(-dt * rate));
      if (from.clone().normalize().distanceToSquared(this.lookTo) < 1e-4) this.lookTo = null;
      moving = true;
    }
    this.controls.target.copy(this.focus);
    const closest = 0.2 * this.R;
    const fit = this.fitDistance(this.reach);
    this.maxZoom = Math.max(2, fit / closest);
    const want = fit / this.zoom;
    const dist = damp(len, want, dt, rate);
    if (Math.abs(dist - want) > 1e-3) moving = true;
    this.camera.position.copy(this.focus).add(from.setLength(dist));
    if (this.decorative) this.camera.lookAt(this.focus);
    return moving;
  }

  wake() {
    if (this.raf || !this.alive) return;
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  tick(now) {
    this.raf = 0;
    if (!this.alive || !this.seen || document.hidden || this.paused) return;
    const dt = this.still ? 10 : Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    if (!this.still) this.clock += dt;
    let moving = false;
    if (this.list.length) {
      const pulsing = this.stepPulse(dt);
      if (pulsing) moving = true;
      const flying = this.intro && this.stepIntro(dt);
      const settling = this.stepParts(dt);
      if (flying || settling) {
        moving = true;
        this.stateTex.needsUpdate = true;
      }
      if (this.stepScan(dt)) moving = true;
      if (this.stepFlow(dt)) moving = true;
      if (this.capsBuilt && this.slice) {
        this.placeCaps();
        this.tintCaps(this.U.uScan.value.y);
      }
      this.placeHalos();
      if (this.haloMesh) this.haloMesh.material.uniforms.uSurge.value = this.surge ?? 0;
      this.updateFloor(dt);
    }
    this.stepLight();
    if (this.stepCamera(dt)) moving = true;
    const orbit = this.decorative ? false : this.controls.update(dt);
    const azimuth = Math.atan2(this.camera.position.x - this.controls.target.x, this.camera.position.z - this.controls.target.z);
    this.rig.rotation.y = azimuth;
    this.scene.environmentRotation.y = azimuth;
    if (!this.still || moving || orbit || this.controls.autoRotate) this.dirty = true;
    if (this.dirty && this.list.length) {
      this.camera.updateMatrixWorld();
      this.runPick();
      this.dirty = false;
      this.render();
      this.track();
    } else if (this.dirty) {
      this.dirty = false;
    } else if (this.pickJobs.length) {
      this.camera.updateMatrixWorld();
      this.runPick();
    }
    this.wake();
  }

  /** Whether the page is showing any markers. When it is not, the stage skips projecting them and the occlusion readbacks. */
  setTracking(on) {
    this.tracking = !!on;
    this.dirty = true;
    this.wake();
  }

  /** Projects every tracked marker to the page, and now and then asks the GPU whether something solid stands in front of one. */
  track() {
    if (!this.cb.onTrack || !this.tracking) return;
    const all = [...(this.pins ?? []), ...(this.gates ?? []), ...this.notes];
    if (!all.length) return;
    this.trackCursor = (this.trackCursor ?? 0) + 1;
    const out = [];
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const edge = (sign) => {
      const e = this.focus.clone().addScaledVector(right, sign * this.reach.hx).project(this.camera);
      return ((e.x + 1) / 2) * this.w;
    };
    const figL = edge(-1);
    const figR = edge(1);
    const v = new THREE.Vector3();
    const d = new THREE.Vector3();
    for (let i = 0; i < all.length; i++) {
      const m = all[i];
      const p = m.part;
      const moved = p ? p.offset : null;
      v.copy(m.point);
      if (moved) v.add(moved);
      const gone = p ? p.now[VIS] < 0.5 || p.now[GHOST] > 0.5 : false;
      const world = v.clone();
      v.project(this.camera);
      const x = ((v.x + 1) / 2) * this.w;
      const y = ((1 - v.y) / 2) * this.h;
      let dx = 0;
      let dy = 0;
      if (m.dir) {
        d.copy(world).addScaledVector(m.dir, 0.15 * this.R).project(this.camera);
        dx = ((d.x + 1) / 2) * this.w - x;
        dy = ((1 - d.y) / 2) * this.h - y;
      }
      out.push({ key: m.key, x, y, dx, dy, seen: !gone && m.seen, w: this.w, h: this.h, figL, figR });
      // One marker every few frames: enough for occlusion to feel immediate without a readback on every frame.
      if (this.trackCursor % 6 === 0 && (this.trackCursor / 6) % all.length === i) {
        const camSpace = world.clone().applyMatrix4(this.camera.matrixWorldInverse);
        const own = -camSpace.z;
        const cb = (_, solid) => {
          m.seen = !solid || solid.part === p || solid.depth > own - 0.12 * this.R;
        };
        cb.kind = "occlusion";
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.ask(x, y, cb);
      }
    }
    this.cb.onTrack(out);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.resizer.disconnect();
    this.watcher.disconnect();
    document.removeEventListener("visibilitychange", this.onVisible);
    const c = this.canvas;
    if (this._down) {
      c.removeEventListener("pointerdown", this._down);
      c.removeEventListener("pointerup", this._up);
      c.removeEventListener("pointermove", this._move);
      c.removeEventListener("pointerleave", this._leave);
      c.removeEventListener("wheel", this._wheel);
      c.removeEventListener("contextmenu", this._ctx);
      c.removeEventListener("dblclick", this._dbl);
    }
    if (this._tilt) window.removeEventListener("pointermove", this._tilt);
    this.controls.dispose();
    this.clearModel();
    this.stateTex?.dispose();
    this.pickRT.dispose();
    this.pickMat.dispose();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.stencilBack?.dispose();
    this.stencilFront?.dispose();
    this.env.dispose();
    this.renderer.dispose();
  }
}
