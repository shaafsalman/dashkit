"""
Builds the lungs of the organ library: closed lobes with true fissures around a real airway and a dense vascular tree.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/organs/build_lungs.py -- \
      --src <folder of .glb sources> --atlas <human-atlas/public/models> --out assets/organs --cache <folder for slow steps>

What is measured and what is drawn:
- Lobes and segments: Human Reference Atlas shells (open patches), closed here into volumes. Segment borders inside a lobe are inferred
  from each segment's surface patch and its own bronchus.
- Airway: Human Reference Atlas, as it comes, with its real C-shaped tracheal rings and bronchial cartilage plates.
- Large and segmental vessels: BodyParts3D, registered onto the atlas airway with a thin-plate warp between the same named bronchi.
- Vessels finer than the data: grown by space colonisation from the real vessels' tips and sides, so they fill the lobes and taper by
  Murray's law. These are illustration, and the manifest says so.
"""
import argparse, heapq, json, math, os, sys, time
import bmesh, bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import voxel as V
from build import stage, to_web

SEGMENTS = {
    # lobe: [(part id, label, shell mesh, HRA bronchus, BP3D bronchial tree)]
    "right_upper": [
        ("right_apical", "Right apical segment", "right_apical_bronchopulmonary", "right_apical_bronchus", "Right apical segmental"),
        ("right_posterior", "Right posterior segment", "right_posterior_bronchopulmonary", "right_posterior_bronchus", "Right posterior segmental"),
        ("right_anterior", "Right anterior segment", "right_anterior_bronchopulmonary", "right_anterior_bronchus", "Right anterior segmental"),
    ],
    "right_middle": [
        ("right_lateral", "Right lateral segment", "right_lateral_bronchopulmonary", "right_lateral_bronchus", "Lateral segmental"),
        ("right_medial", "Right medial segment", "right_medial_bronchopulmonary", "right_medial_bronchus", "Medial segmental"),
    ],
    "right_lower": [
        ("right_superior", "Right superior segment", "right_superior_bronchopulmonary", "right_superior_bronchus", "Right superior segmental"),
        ("right_anterior_basal", "Right anterior basal segment", "right_anterior_basal_bronchopulmonary", "right_anterior_basal_bronchus", "Right anterior basal"),
        ("right_lateral_basal", "Right lateral basal segment", "right_lateral_basal_bronchopulmonary", "right_lateral_basal_bronchus", "Right lateral basal"),
        ("right_medial_basal", "Right medial basal segment", "right_medial_basal_bronchopulmonary", "right_medial_basal_bronchus", "Right medial basal"),
        ("right_posterior_basal", "Right posterior basal segment", "right_posterior_basal_bronchopulmonary", "right_posterior_basal", "Right posterior basal"),
    ],
    "left_upper": [
        ("left_apical", "Left apical segment", "left_apical_bronchopulmonary", "left_apical_bronchus", "Left apical segmental"),
        ("left_posterior", "Left posterior segment", "left_posterior_bronchopulmonary", None, "Left posterior segmental"),
        ("left_anterior", "Left anterior segment", "left_anterior_bronchopulmonary", "left_anterior_bronchus", "Left anterior segmental"),
        ("left_lingula_superior", "Left superior lingular segment", "left_lingula_superior_bronchopulmonary", "left_lingula_superior_bronchus", "Superior lingular"),
        ("left_lingula_inferior", "Left inferior lingular segment", "left_lingula_inferior_bronchopulmonary", "left_lingula_inferior_bronchus", "Inferior lingular"),
    ],
    "left_lower": [
        ("left_superior", "Left superior segment", "left_superior_bronchopulmonary", "left_superior_bronchus", "Left superior segmental"),
        ("left_anterior_basal", "Left anterior basal segment", "left_anterior_basal_bronchopulmonary", "left_anterior_basal_bronchus", "Left anterior basal"),
        ("left_lateral_basal", "Left lateral basal segment", "left_lateral_basal_bronchopulmonary", "left_lateral_basal_bronchus", "Left lateral basal"),
        ("left_medial_basal", "Left medial basal segment", "left_medial_basal_bronchopulmonary", "left_medial_basal_bronchus", "Left medial basal"),
        ("left_posterior_basal", "Left posterior basal segment", "left_posetrior_basal_bronchopulmonary", "left_posterior_basal_bronchus", "Left posterior basal"),
    ],
}
HILUM = {"right_upper": "hilum_upper_R", "right_middle": "hilum_middle_R", "right_lower": "hilum_lower_R", "left_upper": "hilum_upper_L", "left_lower": "hilum_lower_L"}
LOBE_LABEL = {"right_upper": "Right upper lobe", "right_middle": "Right middle lobe", "right_lower": "Right lower lobe", "left_upper": "Left upper lobe", "left_lower": "Left lower lobe"}
LOBE_ABOUT = {
    "right_upper": "Three segments at the top of the right lung, above the horizontal and oblique fissures.",
    "right_middle": "Two segments, found only on the right, between the horizontal and oblique fissures.",
    "right_lower": "Five segments at the base of the right lung, behind and below the oblique fissure.",
    "left_upper": "The upper left lobe, including the lingula, which wraps around the heart's notch.",
    "left_lower": "Five segments at the base of the left lung, behind and below the oblique fissure.",
}
SEG_ABOUT = "A bronchopulmonary segment: a wedge of lung with its own bronchus and artery, which is why surgeons and radiologists describe disease by segment."
AIRWAY = [
    # part id, label, about, kind, meshes
    ("larynx", "Larynx cartilages", "The thyroid, cricoid, epiglottic and arytenoid cartilages, which frame the voice box above the trachea.", "cartilage", ["cricoid_cartilage", "thyroid_cartilage", "epiglottic_cartilage", "arytenoid_cartilage", "corniculate_cartilage"]),
    ("tracheal_rings", "Tracheal rings", "C-shaped hoops of cartilage that hold the windpipe open. They are open at the back, against the oesophagus.", "cartilage", ["tracheal_cartilage"]),
    ("trachea", "Trachea wall", "The soft wall between the rings, with the flat membrane at the back that closes each C.", "airway", ["VH_M_trachea"]),
    ("main_bronchi", "Main bronchi", "The first division of the airway at the carina, one to each lung.", "airway", ["carina", "left_main_bronchus", "right_main_bronchus"]),
    ("lobar_bronchi", "Lobar bronchi", "One to each lobe: three on the right, two on the left.", "airway", ["lobar_bronchus", "right_intermediate_bronchus"]),
    ("segmental_bronchi", "Segmental bronchi", "One to each segment, branching on toward the air sacs.", "airway", ["bronchus", "right_posterior_basal"]),
    ("bronchial_cartilage", "Bronchial cartilage", "Rings in the main bronchi that break into irregular plates further in.", "cartilage", ["bronchial_cartilage"]),
]
TRUNK_ART = ["FJ2966", "FJ3019", "FJ2924"]
TRUNK_VEIN = ["FJ3020", "FJ3040", "FJ2925", "FJ2933", "FJ2944", "FJ2950", "FJ2955", "FJ3031"]
CREDIT = (
    "Lobes and airway: HRA 3D Reference Object Library, HuBMAP, from NLM Visible Human data (CC BY 4.0). "
    "Large and segmental vessels: BodyParts3D, © The Database Center for Life Science, CC BY 4.0, adapted (registered to this airway). "
    "Vessels finer than the data, surface colour and texture: illustration."
)
# Linear colours, thick to fine: arteries coral to bright, veins wine to rose, so the two trees read apart inside blue lobes.
TONE = {
    "artery": ((0.82, 0.105, 0.028), (0.97, 0.2, 0.055), (1.0, 0.33, 0.12)),
    "vein": ((0.15, 0.007, 0.05), (0.28, 0.018, 0.09), (0.44, 0.045, 0.165)),
}


def args():
    p = argparse.ArgumentParser()
    p.add_argument("--src", required=True)
    p.add_argument("--atlas", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--cache", required=True)
    p.add_argument("--poster-size", type=int, default=1024)
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--fresh", default="", help="comma list of cached steps to redo: lobes, vessels")
    p.add_argument("--map-size", type=int, default=1024)
    p.add_argument("--maps", default="", help="also bake textures and write that version of the model to this folder")
    p.add_argument("--no-vertex-export", action="store_true", help="skip the plain vertex-colour model")
    p.add_argument("--crops", default="", help="folder for close-up renders")
    p.add_argument("--no-export", action="store_true")
    return p.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def log(*a):
    print("LUNGS", *a, flush=True)


# ------------------------------------------------------------------------------------------------------------- sources
def load_glb(path):
    """Imports a glTF and returns its meshes as arrays in world space, leaving nothing behind in the scene."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    out = {}
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type != "MESH" or not len(o.data.vertices):
            continue
        M = np.array(o.matrix_world)
        co = np.zeros(len(o.data.vertices) * 3)
        o.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
        o.data.calc_loop_triangles()
        tri = np.zeros(len(o.data.loop_triangles) * 3, np.int64)
        o.data.loop_triangles.foreach_get("vertices", tri)
        out[o.name] = (co, tri.reshape(-1, 3))
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    return out


class BodyParts:
    """Reads named meshes straight from the Human Atlas binary chunks, without going through its app."""

    def __init__(self, folder):
        self.folder = folder
        with open(os.path.join(folder, "atlas.json")) as f:
            self.atlas = json.load(f)
        self.by_id = {p["id"]: p for p in self.atlas["parts"]}
        self.concepts = {c["id"]: c for c in self.atlas["concepts"]}
        self.chunks = {}

    def mesh(self, fj):
        p = self.by_id[fj]
        if p["chunk"] not in self.chunks:
            with open(os.path.join(self.folder, f"body-{p['chunk']}.bin"), "rb") as f:
                self.chunks[p["chunk"]] = f.read()
        b = self.chunks[p["chunk"]]
        pos = np.frombuffer(b, np.float32, p["vertexCount"] * 3, p["positions"]).reshape(-1, 3)
        idx = np.frombuffer(b, np.uint32, p["indexCount"], p["indices"]).reshape(-1, 3)
        # The atlas is Y-up with the front toward +Z; Blender's front is -Y.
        return np.stack([pos[:, 0], -pos[:, 2], pos[:, 1]], 1).astype(np.float64), idx.astype(np.int64)

    def named(self, start):
        return [p["id"] for p in self.atlas["parts"] if p["name"].startswith(start)]

    def elements(self, *concepts):
        """The meshes of some concepts, with the copies some concepts list twice removed."""
        seen, out = set(), []
        for c in concepts:
            for fj in self.concepts[c]["elements"]:
                p = self.by_id.get(fj)
                if p is None:
                    continue
                key = (p["name"], str(p["bounds"]))
                if key not in seen:
                    seen.add(key)
                    out.append(fj)
        return out


def merge(meshes):
    verts, tris, base = [], [], 0
    for v, t in meshes:
        verts.append(v)
        tris.append(t + base)
        base += len(v)
    return np.concatenate(verts), np.concatenate(tris)


def new_mesh(name, verts, faces):
    """A mesh object from arrays, far quicker than from_pydata at this size."""
    me = bpy.data.meshes.new(name)
    faces = np.asarray(faces, np.int32)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", np.asarray(verts, np.float32).ravel())
    n, s = faces.shape
    me.loops.add(n * s)
    me.polygons.add(n)
    me.loops.foreach_set("vertex_index", faces.ravel())
    me.polygons.foreach_set("loop_start", np.arange(n, dtype=np.int32) * s)
    me.update(calc_edges=True)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def mesh_arrays(o):
    co = np.zeros(len(o.data.vertices) * 3)
    o.data.vertices.foreach_get("co", co)
    o.data.calc_loop_triangles()
    t = np.zeros(len(o.data.loop_triangles) * 3, np.int64)
    o.data.loop_triangles.foreach_get("vertices", t)
    return co.reshape(-1, 3), t.reshape(-1, 3)


def smooth_vertices(verts, quads, passes, lam=0.5):
    """Plain Laplacian smoothing, to take the last of the voxel stair off a surface."""
    edges = np.concatenate([quads[:, [0, 1]], quads[:, [1, 2]], quads[:, [2, 3]], quads[:, [3, 0]]])
    n = len(verts)
    count = np.bincount(edges[:, 0], minlength=n).astype(np.float64)
    v = verts.copy()
    for _ in range(passes):
        s = np.zeros_like(v)
        for a in range(3):
            s[:, a] = np.bincount(edges[:, 0], v[edges[:, 1], a], minlength=n)
        v += lam * (s / np.maximum(count, 1)[:, None] - v)
    return v


def decimate_arrays(name, verts, quads, target):
    o = new_mesh(name, verts, quads)
    bpy.context.view_layer.objects.active = o
    faces = len(quads) * 2
    if faces > target:
        m = o.modifiers.new("slim", "DECIMATE")
        m.ratio = target / faces
        bpy.ops.object.modifier_apply(modifier=m.name)
    v, t = mesh_arrays(o)
    bpy.data.objects.remove(o, do_unlink=True)
    return v, t


# --------------------------------------------------------------------------------------------------------------- lobes
def build_lobes(hra, faces_per_segment):
    """Each lobe's patches together do enclose a volume, so the lobe is closed first and then divided among its segments."""
    shells = [v for k, (v, _) in hra.items() if "bronchopulmonary" in k]
    allv = np.concatenate(shells)
    h = 0.0052
    g = V.Grid(allv.min(0), allv.max(0), h, pad=8)
    log("grid", g.shape, f"{np.prod(g.shape) / 1e6:.1f}M voxels")

    def find(key):
        return next(v for k, v in hra.items() if key in k)

    solids = {}
    for lobe, segs in SEGMENTS.items():
        wall = np.zeros(g.shape, bool)
        for _, _, shell, _, _ in segs:
            v, t = find(shell)
            V.rasterize(g, v, t, into=wall)
        v, t = find(HILUM[lobe])
        V.rasterize(g, v, t, into=wall)
        solids[lobe] = V.fill(wall, close=3)
        log("lobe", lobe, f"{solids[lobe].sum() * h ** 3 / SCALE[0] ** 3 * 1e6:.0f} mL")

    fields = {lobe: V.blur(s, 2.4) - 0.5 for lobe, s in solids.items()}
    out = {}
    measures = {}
    for lobe, segs in SEGMENTS.items():
        side = lobe.split("_")[0]
        rivals = [f for other, f in fields.items() if other != lobe and other.startswith(side)]
        # Zero on the lobe's surface. Where another lobe presses against it the surface pulls back, which opens the fissure.
        press = np.maximum.reduce(rivals) if len(rivals) > 1 else rivals[0]
        F = fields[lobe] - np.maximum(press, -0.5) - 0.5 + 0.04
        at = np.argwhere(solids[lobe])
        a, b = at.min(0) - 14, at.max(0) + 15
        a, b = np.maximum(a, 0), np.minimum(b, g.shape)
        crop = tuple(slice(int(i), int(j)) for i, j in zip(a, b))
        sub = V.Grid.__new__(V.Grid)
        sub.h, sub.lo, sub.shape = h, g.lo + a * h, tuple(int(n) for n in (b - a))
        Fc = F[crop]
        solid = solids[lobe][crop]
        reach = V.dilate(solid, 10)
        label = -np.ones(sub.shape, np.int8)
        # Seed each segment from its own surface patch and its own bronchus, so a segment is a wedge running in along that bronchus.
        for i, (_, _, shell, bronchus, _) in enumerate(segs):
            v, t = find(shell)
            seed = V.rasterize(sub, v, t)
            label[seed & reach] = i
        for i, (_, _, shell, bronchus, _) in enumerate(segs):
            if bronchus:
                v, t = next(x for k, x in hra.items() if k.endswith(bronchus))
                seed = V.rasterize(sub, v, t)
                label[seed & reach] = i
        free = reach & (label < 0)
        steps = 0
        while free.any():
            steps += 1
            changed = False
            for axis in range(3):
                for sign in (1, -1):
                    shifted = np.roll(label, sign, axis)
                    take = free & (shifted >= 0)
                    if take.any():
                        label[take] = shifted[take]
                        free &= ~take
                        changed = True
            if not changed:
                break
        fields_s = [V.blur(label == i, 1.6) for i in range(len(segs))]
        for i, (pid, _, _, _, _) in enumerate(segs):
            others = np.maximum.reduce([f for j, f in enumerate(fields_s) if j != i]) if len(segs) > 1 else np.zeros_like(fields_s[i])
            P = fields_s[i] - others - 0.012
            G = np.minimum(Fc, P)
            verts, quads = V.surface_nets(G, sub)
            verts = smooth_vertices(verts, quads, 3)
            v, t = decimate_arrays(pid, verts, quads, faces_per_segment)
            # Near 1 on the lobe's own surface, near 0 on the walls it shares with its neighbours inside the lobe.
            outer = np.clip(1 - sub.sample(Fc, v) / 0.10, 0, 1)
            out[pid] = (v, t, outer)
            measures[pid] = float(((label == i) & solid).sum() * h ** 3 / SCALE[0] ** 3 * 1e6)
            log("segment", pid, len(t), "faces", f"{measures[pid]:.0f} mL")
    return out, measures, solids, g


# ------------------------------------------------------------------------------------------------------------ registration
def tps_fit(src, dst, lam=1e-3):
    """A thin-plate warp taking src landmarks onto dst, with a little give so landmarks cannot tear the space between them."""
    n = len(src)
    K = np.linalg.norm(src[:, None] - src[None], axis=2)
    P = np.hstack([np.ones((n, 1)), src])
    A = np.block([[K + lam * np.eye(n), P], [P.T, np.zeros((4, 4))]])
    B = np.vstack([dst, np.zeros((4, 3))])
    return src, np.linalg.solve(A, B)


def tps_apply(model, pts):
    src, w = model
    n = len(src)
    out = np.zeros_like(pts)
    for i in range(0, len(pts), 20000):
        p = pts[i : i + 20000]
        K = np.linalg.norm(p[:, None] - src[None], axis=2)
        out[i : i + 20000] = K @ w[:n] + np.hstack([np.ones((len(p), 1)), p]) @ w[n:]
    return out


def landmarks(mesh_v, carina):
    """A bronchus's middle and its far end, the two things that can be matched between two different people's trees."""
    d = np.linalg.norm(mesh_v - carina, axis=1)
    far = mesh_v[d >= np.percentile(d, 72)]
    return [mesh_v.mean(0), far.mean(0)]


def registration(hra_raw, bp):
    """Pairs the same named bronchi in both models and fits a warp from BodyParts3D's body to the atlas's."""
    src_t = bp.mesh(bp.named("Trachea")[0])[0]
    dst_t = next(v for k, (v, _) in hra_raw.items() if k.endswith("VH_M_trachea"))
    src_car = src_t[src_t[:, 2] <= np.percentile(src_t[:, 2], 8)].mean(0)
    dst_car = next(v for k, (v, _) in hra_raw.items() if k.endswith("carina")).mean(0)
    src, dst = [src_car], [dst_car]
    # The trachea's upper end holds the warp steady above the carina.
    src.append(src_t[src_t[:, 2] >= np.percentile(src_t[:, 2], 92)].mean(0))
    dst.append(dst_t[dst_t[:, 2] >= np.percentile(dst_t[:, 2], 92)].mean(0))
    pairs = 0
    for segs in SEGMENTS.values():
        for _, _, _, hb, bb in segs:
            if not hb:
                continue
            ids = [p["id"] for p in bp.atlas["parts"] if p["name"].startswith(bb) and "bronchial tree" in p["name"]]
            sv = np.concatenate([bp.mesh(fj)[0] for fj in ids])
            dv = next(v for k, (v, _) in hra_raw.items() if k.endswith(hb))
            for a, b in zip(landmarks(sv, src_car), landmarks(dv, dst_car)):
                src.append(a)
                dst.append(b)
            pairs += 1
    for hb, bb in (("left_main_bronchus", "Left main bronchus"), ("right_main_bronchus", "Right main bronchus proper")):
        sv = np.concatenate([bp.mesh(fj)[0] for fj in bp.named(bb)])
        dv = next(v for k, (v, _) in hra_raw.items() if k.endswith(hb))
        src.append(sv.mean(0))
        dst.append(dv.mean(0))
    src, dst = np.array(src), np.array(dst)
    model = tps_fit(src, dst)
    err = np.linalg.norm(tps_apply(model, src) - dst, axis=1)
    log("registration", pairs, "bronchi", f"mean residual {err.mean() * 1000:.1f} mm, moved {np.linalg.norm(src - dst, axis=1).mean() * 1000:.1f} mm")
    return model


# ------------------------------------------------------------------------------------------------------------- skeleton
def skeleton(verts, tris, roots, h=0.006, min_len=0.03):
    """The centre lines of a set of closed tubes: voxelise them, walk out from the roots preferring the middle of each tube, then
    repeatedly take the farthest point not yet covered and trace it home."""
    g = V.Grid(verts.min(0), verts.max(0), h, pad=4)
    wall = V.rasterize(g, verts, tris)
    solid = V.fill(wall, close=1)
    depth = V.distance(~solid, 12.0)
    mask = V.dilate(solid, 1)
    idx = np.full(g.shape, -1, np.int32)
    at = np.argwhere(mask)
    idx[mask] = np.arange(len(at))
    n = len(at)
    # Cost per step falls with depth, so paths keep to the centre.
    d = depth[mask].astype(np.float64) + 0.5
    cost = 1.0 + 6.0 / d ** 2
    dist = np.full(n, np.inf)
    back = np.full(n, -1, np.int32)
    length = np.zeros(n)
    heap = []
    for r in roots:
        i = np.linalg.norm(g.lo + at * h - r, axis=1).argmin()
        dist[i] = 0
        heap.append((0.0, int(i)))
    heapq.heapify(heap)
    nb = np.array([(x, y, z) for x in (-1, 0, 1) for y in (-1, 0, 1) for z in (-1, 0, 1) if (x, y, z) != (0, 0, 0) and abs(x) + abs(y) + abs(z) <= 2])
    nb_len = np.linalg.norm(nb, axis=1)
    shape = np.array(g.shape)
    at_list = at.tolist()
    idx_flat = idx.ravel()
    sx, sy = g.shape[1] * g.shape[2], g.shape[2]
    offs = (nb @ np.array([sx, sy, 1])).tolist()
    lens = nb_len.tolist()
    cost_l = cost.tolist()
    while heap:
        c, i = heapq.heappop(heap)
        if c > dist[i]:
            continue
        x, y, z = at_list[i]
        if x < 1 or y < 1 or z < 1 or x >= shape[0] - 1 or y >= shape[1] - 1 or z >= shape[2] - 1:
            continue
        base = x * sx + y * sy + z
        for off, ln in zip(offs, lens):
            j = idx_flat[base + off]
            if j < 0:
                continue
            nc = c + ln * cost_l[j]
            if nc < dist[j]:
                dist[j] = nc
                back[j] = i
                length[j] = length[i] + ln
                heapq.heappush(heap, (nc, int(j)))
    reach = np.isfinite(dist)
    log("skeleton", n, "voxels", f"{reach.mean() * 100:.0f}% reached from roots")
    pos = g.lo + at * h
    radius = np.maximum(d - 0.5, 0.5) * h
    covered = ~reach
    paths = []
    on_path = -np.ones(n, np.int32)
    while True:
        rest = np.where(covered, -1, length)
        tip = int(rest.argmax())
        if rest[tip] * h < min_len and paths:
            break
        if rest[tip] < 0:
            break
        trail = []
        i = tip
        while i >= 0 and on_path[i] < 0:
            trail.append(i)
            i = back[i]
        joint = int(i)
        trail = trail[::-1]
        pid = len(paths)
        if len(trail) >= 3:
            paths.append({"parent": int(on_path[joint]) if joint >= 0 else -1, "joint": pos[joint].copy() if joint >= 0 else None, "pos": pos[trail].copy(), "radius": radius[trail].copy()})
            on_path[trail] = pid
        else:
            on_path[trail] = on_path[joint] if joint >= 0 else 0
        # Everything within a tube's width of this path is part of the same vessel.
        pts = pos[trail][:: 2]
        r = (radius[trail][:: 2] + 2.5 * h)
        for chunk in range(0, len(pts), 24):
            p, q = pts[chunk : chunk + 24], r[chunk : chunk + 24]
            lo_, hi_ = p.min(0) - q.max(), p.max(0) + q.max()
            near = np.nonzero(((pos >= lo_) & (pos <= hi_)).all(1) & ~covered)[0]
            if not len(near):
                continue
            dd = np.linalg.norm(pos[near][:, None] - p[None], axis=2)
            covered[near[(dd <= q[None] * 1.6).any(1)]] = True
        covered[trail] = True
    for p, depth in zip(paths, real_depths(paths)):
        p["depth"] = depth
        p["pos"] = smooth_line(p["pos"], 3)
        p["radius"] = smooth_line(p["radius"][:, None], 3)[:, 0]
    log("skeleton", len(paths), "branches")
    return paths


def smooth_line(a, passes):
    a = a.copy()
    for _ in range(passes):
        if len(a) > 2:
            a[1:-1] = 0.25 * a[:-2] + 0.5 * a[1:-1] + 0.25 * a[2:]
    return a


# ------------------------------------------------------------------------------------------------------------ colonisation
def colonise(starts, attractors, step, kill, seed, inertia=0.35, wander=0.1, limit=2000):
    """Space colonisation (Runions 2007): each attractor pulls the node nearest to it; a pulled node grows a step that way; attractors
    that a node has reached are used up. The result fills the volume the way real vessels do, each branch feeding its own territory.
    starts: (position, direction, root id). Returns node arrays."""
    rng = np.random.default_rng(seed)
    pos = [s[0] for s in starts]
    head = [s[1] / max(np.linalg.norm(s[1]), 1e-6) for s in starts]
    parent = [-1] * len(starts)
    root = [s[2] for s in starts]
    A = attractors.copy()
    nearest = np.full(len(A), -1, np.int64)
    best = np.full(len(A), np.inf)

    def update(new_ids):
        nonlocal nearest, best
        if not len(new_ids) or not len(A):
            return
        pts = np.array([pos[i] for i in new_ids])
        for i in range(0, len(pts), 512):
            d = np.linalg.norm(A[:, None] - pts[i : i + 512][None], axis=2)
            j = d.argmin(1)
            v = d[np.arange(len(A)), j]
            better = v < best
            best[better] = v[better]
            nearest[better] = np.array(new_ids[i : i + 512])[j[better]]

    update(list(range(len(pos))))
    keep = best > kill
    A, nearest, best = A[keep], nearest[keep], best[keep]
    for it in range(limit):
        if not len(A):
            break
        order = np.argsort(nearest)
        n_sorted, A_sorted = nearest[order], A[order]
        cut = np.nonzero(np.diff(n_sorted))[0] + 1
        new = []
        for group, ids in zip(np.split(A_sorted, cut), np.split(n_sorted, cut)):
            i = int(ids[0])
            d = group - pos[i]
            d = d / np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-6)
            m = d.sum(0)
            m = m / max(np.linalg.norm(m), 1e-6)
            m = m * (1 - inertia) + head[i] * inertia + rng.normal(0, wander, 3)
            m = m / max(np.linalg.norm(m), 1e-6)
            p = pos[i] + m * step
            new.append(len(pos))
            pos.append(p)
            head.append(m)
            parent.append(i)
            root.append(root[i])
        update(new)
        keep = best > kill
        A, nearest, best = A[keep], nearest[keep], best[keep]
        if it % 40 == 0:
            log("colonise", it, len(pos), "nodes", len(A), "attractors left")
        if not new:
            break
    return np.array(pos), np.array(parent), np.array(root)


def real_depths(paths):
    """How many forks each real branch sits below the root of its tree."""
    depth = [0] * len(paths)
    for i, p in enumerate(paths):
        depth[i] = depth[p["parent"]] + 1 if p["parent"] >= 0 else 0
    return depth


def tree_paths(pos, parent, root_count, tip_radius, gamma, max_radius, prune=3, step_len=0.0105, min_twig=0.05, root_depth=None):
    """Radii by Murray's law: each vessel's r^gamma is the sum of its children's. Returns one polyline per branch, trunk ends first."""
    n = len(pos)
    kids = [[] for _ in range(n)]
    for i in range(root_count, n):
        kids[parent[i]].append(i)
    # Drop stubs: side twigs too short to read as vessels look like thorns. Walk up from each tip to the first fork and measure.
    alive = np.ones(n, bool)
    live_kids = np.array([len(k) for k in kids])
    for _ in range(prune):
        tips = [i for i in range(root_count, n) if alive[i] and live_kids[i] == 0]
        for t in tips:
            chain, i = [], t
            while i >= root_count and live_kids[i] <= 1:
                chain.append(i)
                i = parent[i]
            if i < root_count:
                continue
            if len(chain) * step_len < min_twig and live_kids[i] > 1:
                alive[chain] = False
                live_kids[i] -= 1
                for c in chain:
                    live_kids[c] = 0
    flow = np.where(alive, tip_radius ** gamma, 0.0)
    for i in range(n - 1, root_count - 1, -1):
        if alive[i] and parent[i] >= 0:
            flow[parent[i]] += flow[i]
    r = flow ** (1 / gamma)
    # Generations, as anatomists count them: the forks passed on the way from the root of the tree to each tip.
    forks = np.zeros(n, np.int32)
    if root_depth is not None:
        forks[: root_count] = root_depth
    for i in range(root_count, n):
        if alive[i]:
            p = parent[i]
            forks[i] = forks[p] + (1 if p < root_count or live_kids[p] > 1 else 0)
    at_tips = forks[(live_kids == 0) & alive & (np.arange(n) >= root_count)]
    TREE_STATS.append(dict(tips=len(at_tips), mean=float(at_tips.mean()), p95=float(np.percentile(at_tips, 95)), most=int(at_tips.max()), real_deepest=int(np.max(root_depth)) if root_depth is not None else 0, thickest=float(r[alive].max()), finest=float(r[alive].min())))
    log("generations", TREE_STATS[-1])
    paths = []
    depth = np.zeros(n, np.int32)

    def run(i, order):
        # Follows the largest child onward; the others start branches of their own.
        line = [i]
        while True:
            live = [k for k in kids[line[-1]] if alive[k]]
            if not live:
                break
            live.sort(key=lambda k: -flow[k])
            for side in live[1:]:
                stack.append((side, line[-1], order + 1))
            line.append(live[0])
        return line

    stack = []
    for i in range(root_count):
        for k in kids[i]:
            if alive[k]:
                stack.append((k, i, 1))
    while stack:
        i, joint, order = stack.pop()
        line = run(i, order)
        idx = np.array([joint] + line)
        rr = r[idx].copy()
        rr[0] = rr[1]
        paths.append({"pos": pos[idx], "radius": np.minimum(rr, max_radius), "order": order, "root": int(joint)})
    return paths, r, alive


TREE_STATS = []


def tube_mesh(paths, min_step, tone, fine_sides=3):
    """Tapered tubes for many thin paths, in one mesh. Thick ones get rounder sections and thin ones fewer rings."""
    V_, F_, C_ = [], [], []
    base = 0
    for p in paths:
        pts, rad = p["pos"], p["radius"]
        if len(pts) < 2:
            continue
        pts = smooth_line(pts, 2)
        # Thin it out along its length: a step suited to its width.
        keep = [0]
        for i in range(1, len(pts) - 1):
            if np.linalg.norm(pts[i] - pts[keep[-1]]) >= max(min_step, rad[i] * 2.2):
                keep.append(i)
        keep.append(len(pts) - 1)
        pts, rad = pts[keep], rad[keep].copy()
        m = len(pts)
        # Every run ends at a twig tip: it narrows on the way there to almost nothing, so nothing ends blunt.
        along = np.linspace(0, 1, m)
        rad = rad * (1 - 0.72 * np.clip((along - 0.45) / 0.55, 0, 1) ** 1.4)
        sides = 8 if rad[0] > 0.012 else 6 if rad[0] > 0.006 else 4 if rad[0] > 0.0028 else fine_sides
        tan = np.gradient(pts, axis=0)
        tan /= np.maximum(np.linalg.norm(tan, axis=1, keepdims=True), 1e-9)
        n0 = np.cross(tan[0], [0.31, 0.53, 0.79])
        n0 /= max(np.linalg.norm(n0), 1e-9)
        normals = np.zeros_like(pts)
        cur = n0
        for i in range(m):
            cur = cur - tan[i] * cur.dot(tan[i])
            cur /= max(np.linalg.norm(cur), 1e-9)
            normals[i] = cur
        binorm = np.cross(tan, normals)
        ang = np.arange(sides) * 2 * np.pi / sides
        ring = (normals[:, None] * np.cos(ang)[None, :, None] + binorm[:, None] * np.sin(ang)[None, :, None]) * rad[:, None, None]
        verts = (pts[:, None] + ring).reshape(-1, 3)
        a = np.arange(m - 1)[:, None] * sides + np.arange(sides)[None]
        b = np.arange(m - 1)[:, None] * sides + (np.arange(sides)[None] + 1) % sides
        quads = np.stack([a, b, b + sides, a + sides], 2).reshape(-1, 4) + base
        cap = verts.shape[0] + base
        tip = pts[-1] + tan[-1] * rad[-1] * 1.5
        fan_a = np.arange(sides) + (m - 1) * sides + base
        fan_b = (np.arange(sides) + 1) % sides + (m - 1) * sides + base
        tris = np.stack([fan_a, fan_b, np.full(sides, cap), np.full(sides, cap)], 1)
        V_.append(verts)
        V_.append(tip[None])
        F_.append(quads)
        F_.append(tris)
        col = tone_for(rad, tone)
        C_.append(np.repeat(col, sides, axis=0))
        C_.append(col[-1:])
        base = cap + 1
    return np.concatenate(V_), np.concatenate(F_), np.concatenate(C_)


def tone_for(radius, tone):
    """Colour by calibre. Thick trunks take the deep tone and hair-fine twigs the bright one."""
    t = np.clip((np.log(np.maximum(radius, 1e-5)) - math.log(0.0009)) / (math.log(0.03) - math.log(0.0009)), 0, 1)[:, None]
    deep, mid, fine = (np.array(c) for c in tone)
    low = fine + (mid - fine) * np.clip(t * 2, 0, 1)
    return low + (deep - low) * np.clip(t * 2 - 1, 0, 1)


def inside_points(solid, g, count, seed, margin=2):
    """Random points evenly through a solid, kept a little back from its surface."""
    rng = np.random.default_rng(seed)
    at = np.argwhere(V.erode(solid, margin))
    pick = rng.integers(0, len(at), count)
    return g.lo + (at[pick] + rng.random((count, 3))) * g.h


def faces_of(faces):
    """Splits a quad array where degenerate quads stand in for triangles."""
    tri = faces[:, 2] == faces[:, 3]
    return faces[~tri], faces[tri][:, :3]


# ------------------------------------------------------------------------------------------------------------ main
SCALE = [1.0]


def fit_of(hra):
    pts = np.concatenate([v for k, (v, _) in hra.items()])
    lo, hi = pts.min(0), pts.max(0)
    s = 2 / (hi - lo).max()
    SCALE[0] = s
    c = (lo + hi) / 2
    return lambda p: (p - c) * s


def cached(path, fresh, make):
    if os.path.exists(path) and not fresh:
        return dict(np.load(path, allow_pickle=True))
    data = make()
    np.savez(path, **data)
    return data


def build_vessels(hra_raw, hra, fit, solids, g, bp):
    """Registers the real pulmonary vessels and grows the fine ones from them."""
    warp = registration(hra_raw, bp)
    art_ids = bp.elements("FMA45842", "FMA66326")
    vein_ids = bp.elements("FMA66643", "FMA49911", "FMA49913", "FMA49914", "FMA49916", "FMA49908", "FMA49910")
    art_ids = [i for i in dict.fromkeys(art_ids + TRUNK_ART)]
    vein_ids = [i for i in dict.fromkeys(vein_ids + TRUNK_VEIN) if i not in art_ids]
    log("real meshes", len(art_ids), "arteries", len(vein_ids), "veins")

    def warped(ids):
        out = {}
        for fj in ids:
            v, t = bp.mesh(fj)
            out[fj] = (fit(tps_apply(warp, v)), t)
        return out

    arteries = warped(art_ids)
    veins = warped(vein_ids)
    # Some concepts in the source list meshes from elsewhere in the body (a renal branch under "right pulmonary artery"), so keep only what is in the chest.
    box_lo, box_hi = g.lo, g.lo + np.array(g.shape) * g.h
    in_chest = lambda m: bool(((m[0].mean(0) > box_lo) & (m[0].mean(0) < box_hi)).all())
    dropped = [k for k, m in {**arteries, **veins}.items() if not in_chest(m)]
    arteries = {k: m for k, m in arteries.items() if in_chest(m)}
    veins = {k: m for k, m in veins.items() if in_chest(m)}
    log("dropped from outside the chest:", [bp.by_id[k]["name"] for k in dropped])
    lung = {side: [solids[k] for k in solids if k.startswith(side)] for side in ("right", "left")}
    result = {}
    # The arterial tree is rooted at the pulmonary trunk's base; each lung's tree is grown separately so they fill their own side.
    trunk = arteries["FJ2966"][0]
    trunk_base = trunk[trunk[:, 2] <= np.percentile(trunk[:, 2], 6)].mean(0)
    art_all = merge(list(arteries.values()))
    art_paths = skeleton(art_all[0], art_all[1], [trunk_base])
    result["art_parts"] = arteries
    log("arterial skeleton", len(art_paths), "branches")
    fine_all = {"artery": {}, "vein": {}}
    skeletons = {"artery": art_paths, "vein": []}
    grown = {}
    for side, sign in (("right", -1), ("left", 1)):
        # Arteries.
        paths = [p for p in art_paths if p["pos"][-1, 0] * sign > 0.1]
        starts, depths = starts_from(paths)
        A = attractors_for(lung[side], g, ART_DENSITY, 100 + (sign > 0) * 10)
        log(side, "arteries from", len(starts), "starts toward", len(A), "points")
        pos, parent, root = colonise(starts, A, GROW_STEP, 0.024, 5 + sign)
        fine, r, alive = tree_paths(pos, parent, len(starts), TIP_RADIUS, 2.5, 0.022, root_depth=depths)
        log(side, "arteries", len(fine), "grown branches,", int(alive.sum()) - len(starts), "nodes, deepest order", max(p["order"] for p in fine))
        grown[f"artery_{side}"] = fine
        # Veins: their own trunks and their own territory, offset from the arteries because the seeds differ.
        side_ids = [fj for fj in veins if veins[fj][0][:, 0].mean() * sign > 0]
        vs = merge([veins[fj] for fj in side_ids])
        roots = []
        for fj in TRUNK_VEIN:
            if fj in veins and veins[fj][0][:, 0].mean() * sign > 0:
                v = veins[fj][0]
                d = np.abs(v[:, 0])
                roots.append(v[d <= np.percentile(d, 5)].mean(0))
        vpaths = skeleton(vs[0], vs[1], roots)
        result[f"vein_real_{side}"] = vs
        skeletons["vein"] += vpaths
        starts, depths = starts_from(vpaths)
        A = attractors_for(lung[side], g, VEIN_DENSITY, 300 + (sign > 0) * 10)
        log(side, "veins from", len(starts), "starts toward", len(A), "points")
        pos, parent, root = colonise(starts, A, GROW_STEP, 0.026, 9 + sign)
        fine, r, alive = tree_paths(pos, parent, len(starts), TIP_RADIUS, 2.5, 0.02, root_depth=depths)
        log(side, "veins", len(fine), "grown branches,", int(alive.sum()) - len(starts), "nodes, deepest order", max(p["order"] for p in fine))
        grown[f"vein_{side}"] = fine
    result["skeletons"] = skeletons
    result["grown"] = grown
    result["stats"] = list(TREE_STATS)
    return result


ART_DENSITY, VEIN_DENSITY = 62000, 48000  # growth targets per cubic unit of lung
GROW_STEP, TIP_RADIUS = 0.0105, 0.00075


def attractors_for(solids, g, density, seed):
    """Growth targets evenly through a lung's lobes, more where there is more lung."""
    return np.concatenate([inside_points(s, g, int(s.sum() * g.h ** 3 * density), seed + i) for i, s in enumerate(solids)])


def starts_from(paths):
    """Where growth may begin on the real tree, and how deep in the tree each of those places is."""
    # Paths arrive filtered to one lung, so their parents are looked up by the original path list's own depth where it was stored.
    starts, depths = [], []
    for pid, p in enumerate(paths):
        pts, rad = p["pos"], p["radius"]
        n = len(pts)
        for i in range(max(2, n // 8), n - 1, 5):
            if rad[i] < 0.03:
                starts.append((pts[i], pts[min(n - 1, i + 2)] - pts[max(0, i - 2)], pid))
                depths.append(p["depth"])
        starts.append((pts[-1], pts[-1] - pts[max(0, n - 6)], pid))
        depths.append(p["depth"])
    return starts, np.array(depths, np.int32)


def flat_color(o, colors):
    """Writes per-vertex linear colours straight onto a mesh."""
    a = o.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    data = np.ones((len(colors), 4), np.float32)
    data[:, :3] = colors
    a.data.foreach_set("color", data.ravel())
    o.data.color_attributes.active_color = a
    o.data.polygons.foreach_set("use_smooth", np.ones(len(o.data.polygons), bool))


def split_mesh(verts, faces):
    """A mesh object from mixed quads and triangles (tube sides and tips), which the array path cannot take directly."""
    quads, tris = faces_of(faces)
    me = bpy.data.meshes.new("t")
    sizes = np.concatenate([np.full(len(quads), 4), np.full(len(tris), 3)])
    loops = np.concatenate([quads.ravel(), tris.ravel()]).astype(np.int32)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", np.asarray(verts, np.float32).ravel())
    me.loops.add(len(loops))
    me.polygons.add(len(sizes))
    me.loops.foreach_set("vertex_index", loops)
    me.polygons.foreach_set("loop_start", np.concatenate([[0], np.cumsum(sizes[:-1])]).astype(np.int32))
    me.update(calc_edges=True)
    return me


def object_from(name, verts, faces):
    me = split_mesh(verts, faces)
    me.name = name
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o



# ------------------------------------------------------------------------------------------------------------ materials
def nodes_of(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    return mat, mat.node_tree.nodes, mat.node_tree.links, mat.node_tree.nodes["Principled BSDF"]


class Graph:
    """A little shorthand for building shader graphs: every method adds a node and returns its output socket."""

    def __init__(self, name):
        self.mat, self.n, self.l, self.b = nodes_of(name)
        self.co = self.n.new("ShaderNodeTexCoord").outputs["Object"]

    def noise(self, co, scale, detail=4.0, rough=0.5, out="Fac"):
        t = self.n.new("ShaderNodeTexNoise")
        t.inputs["Scale"].default_value, t.inputs["Detail"].default_value, t.inputs["Roughness"].default_value = scale, detail, rough
        self.l.new(co, t.inputs["Vector"])
        return t.outputs[out]

    def voronoi(self, co, scale, feature="F1", out="Distance", rand=1.0):
        t = self.n.new("ShaderNodeTexVoronoi")
        t.feature = feature
        t.inputs["Scale"].default_value = scale
        t.inputs["Randomness"].default_value = rand
        self.l.new(co, t.inputs["Vector"])
        return t.outputs[out]

    def math(self, op, a, b=None, clamp=False):
        m = self.n.new("ShaderNodeMath")
        m.operation, m.use_clamp = op, clamp
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                self.l.new(v, m.inputs[i])
        return m.outputs[0]

    def vadd(self, a, b, scale=1.0):
        s = self.n.new("ShaderNodeVectorMath")
        s.operation = "SCALE"
        self.l.new(b, s.inputs[0])
        s.inputs["Scale"].default_value = scale
        m = self.n.new("ShaderNodeVectorMath")
        m.operation = "ADD"
        self.l.new(a, m.inputs[0])
        self.l.new(s.outputs[0], m.inputs[1])
        return m.outputs[0]

    def stretch(self, co, x, y, z):
        m = self.n.new("ShaderNodeMapping")
        m.inputs["Scale"].default_value = (x, y, z)
        self.l.new(co, m.inputs["Vector"])
        return m.outputs[0]

    def smooth(self, v, a, b):
        m = self.n.new("ShaderNodeMapRange")
        m.interpolation_type = "SMOOTHSTEP"
        m.inputs["From Min"].default_value, m.inputs["From Max"].default_value = a, b
        m.inputs["To Min"].default_value, m.inputs["To Max"].default_value = 0.0, 1.0
        self.l.new(v, m.inputs["Value"])
        return m.outputs[0]

    def ramp(self, v, stops):
        r = self.n.new("ShaderNodeValToRGB")
        cr = r.color_ramp
        cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
        cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
        for pos, col in stops[1:-1]:
            cr.elements.new(pos).color = (*col, 1)
        self.l.new(v, r.inputs["Fac"])
        return r.outputs["Color"]

    def mix(self, fac, a, b, mode="MIX"):
        m = self.n.new("ShaderNodeMix")
        m.data_type = "RGBA"
        m.blend_type = mode
        for sock, v in (("Factor", fac), ("A", a), ("B", b)):
            target = m.inputs[{"Factor": 0, "A": 6, "B": 7}[sock]]
            if isinstance(v, (int, float)):
                target.default_value = v
            elif isinstance(v, tuple):
                target.default_value = (*v, 1)
            else:
                self.l.new(v, target)
        return m.outputs[2]

    def finish(self, color, rough, height, bump=0.004, strength=1.0, coat=0.5):
        self.l.new(color, self.b.inputs["Base Color"])
        self.l.new(rough, self.b.inputs["Roughness"])
        if height is not None:
            b = self.n.new("ShaderNodeBump")
            b.inputs["Distance"].default_value, b.inputs["Strength"].default_value = bump, strength
            self.l.new(height, b.inputs["Height"])
            self.l.new(b.outputs["Normal"], self.b.inputs["Normal"])
        self.b.inputs["Coat Weight"].default_value = coat
        self.b.inputs["Coat Roughness"].default_value = 0.22
        return self.mat


def pleura_material():
    """The lung's surface. The polygons are secondary lobules outlined by their septa, as on a real lung; finer cells within them are
    clusters of air sacs; the dark flecks are the dust real lungs collect along those septa. All of it is drawn, not measured."""
    g = Graph("pleura")
    warp = g.noise(g.co, 9.0, 3.0, out="Color")
    co = g.vadd(g.co, warp, 0.05)
    lob_edge = g.voronoi(co, 17.0, "DISTANCE_TO_EDGE")
    lob_tone = g.voronoi(co, 17.0, "F1", "Color")
    fine_warp = g.noise(g.co, 46.0, 2.0, out="Color")
    co2 = g.vadd(g.co, fine_warp, 0.012)
    sub_edge = g.voronoi(co2, 58.0, "DISTANCE_TO_EDGE")
    sub_tone = g.voronoi(co2, 58.0, "F1", "Color")
    mott = g.noise(g.co, 4.6, 9.0, 0.58)
    sep = g.n.new("ShaderNodeSeparateColor")
    g.l.new(lob_tone, sep.inputs[0])
    sep2 = g.n.new("ShaderNodeSeparateColor")
    g.l.new(sub_tone, sep2.inputs[0])
    tone = g.math("ADD", g.math("MULTIPLY", mott, 0.62), g.math("ADD", g.math("MULTIPLY", sep.outputs[0], 0.2), g.math("MULTIPLY", sep2.outputs[0], 0.18)))
    base = g.ramp(tone, [(0.28, (0.006, 0.05, 0.3)), (0.42, (0.018, 0.16, 0.62)), (0.56, (0.05, 0.36, 0.92)), (0.68, (0.25, 0.62, 1.0)), (0.8, (0.62, 0.85, 1.0))])
    # Septa: dark lines around each lobule, thicker in some places than others.
    width = g.math("ADD", 0.012, g.math("MULTIPLY", g.noise(g.co, 11.0, 2.0), 0.05))
    line = g.math("SUBTRACT", 1.0, g.math("DIVIDE", lob_edge, width), clamp=True)
    subline = g.math("SUBTRACT", 1.0, g.smooth(sub_edge, 0.0, 0.05))
    shade = g.math("MULTIPLY", g.math("SUBTRACT", 1.0, g.math("MULTIPLY", line, 0.72)), g.math("SUBTRACT", 1.0, g.math("MULTIPLY", subline, 0.28)))
    col = g.mix(1.0, base, (0.004, 0.028, 0.15), "MIX")
    col = g.mix(g.math("SUBTRACT", 1.0, shade), base, (0.004, 0.028, 0.15))
    # Dust: fine dark flecks, gathered in patches and along the septa.
    fleck = g.voronoi(g.co, 170.0)
    patch = g.noise(g.co, 7.0, 3.0)
    fleck_on = g.math("MULTIPLY", g.math("LESS_THAN", fleck, 0.16), g.math("ADD", g.smooth(patch, 0.5, 0.64), g.math("MULTIPLY", line, 0.8), clamp=True))
    col = g.mix(g.math("MULTIPLY", fleck_on, 0.8), col, (0.003, 0.012, 0.06))
    # The cut face a segment shows when it is taken out of its lobe: spongy, not skin.
    outer = g.n.new("ShaderNodeAttribute")
    outer.attribute_name = "Outer"
    sponge = g.voronoi(g.co, 120.0, "DISTANCE_TO_EDGE")
    cut = g.ramp(g.smooth(sponge, 0.0, 0.18), [(0.0, (0.05, 0.1, 0.34)), (0.6, (0.2, 0.34, 0.72)), (1.0, (0.44, 0.58, 0.9))])
    col = g.mix(outer.outputs["Fac"], cut, col)
    rough = g.math("ADD", 0.2, g.math("ADD", g.math("MULTIPLY", g.noise(g.co, 26.0, 3.0), 0.3), g.math("MULTIPLY", line, 0.25)))
    pebble = g.smooth(sub_edge, 0.0, 0.16)
    height = g.math("ADD", g.math("MULTIPLY", g.math("SUBTRACT", 1.0, line), 1.0), g.math("ADD", g.math("MULTIPLY", pebble, 0.45), g.math("MULTIPLY", g.noise(g.co, 260.0, 3.0), 0.12)))
    return g.finish(col, rough, height, bump=0.0035, strength=0.8)


def cartilage_material():
    g = Graph("cartilage")
    # Pearly, with the faint blue of hyaline cartilage and a grain running around the ring.
    grain = g.noise(g.stretch(g.co, 80.0, 80.0, 420.0), 1.0, 5.0, 0.55)
    blotch = g.noise(g.co, 18.0, 6.0, 0.55)
    tone = g.math("ADD", g.math("MULTIPLY", blotch, 0.7), g.math("MULTIPLY", grain, 0.3))
    col = g.ramp(tone, [(0.3, (0.62, 0.6, 0.56)), (0.5, (0.82, 0.79, 0.7)), (0.7, (0.97, 0.94, 0.86))])
    rough = g.math("ADD", 0.26, g.math("MULTIPLY", blotch, 0.2))
    height = g.math("ADD", g.math("MULTIPLY", grain, 0.55), g.math("MULTIPLY", g.noise(g.co, 300.0, 3.0), 0.3))
    return g.finish(col, rough, height, bump=0.002, strength=0.7, coat=0.6)


def mucosa_material():
    g = Graph("mucosa")
    # The soft wall between the rings: fine lengthwise folds, as the membrane at the back of the trachea has, and small vessels.
    folds = g.noise(g.stretch(g.co, 240.0, 240.0, 14.0), 1.0, 4.0, 0.5)
    blotch = g.noise(g.co, 12.0, 6.0, 0.55)
    warp = g.vadd(g.co, g.noise(g.co, 30.0, 2.0, out="Color"), 0.02)
    capillary = g.smooth(g.voronoi(warp, 42.0, "DISTANCE_TO_EDGE"), 0.0, 0.04)
    tone = g.math("ADD", g.math("MULTIPLY", blotch, 0.6), g.math("MULTIPLY", folds, 0.4))
    col = g.ramp(tone, [(0.3, (0.36, 0.06, 0.06)), (0.5, (0.6, 0.15, 0.13)), (0.72, (0.82, 0.34, 0.28))])
    col = g.mix(g.math("MULTIPLY", g.math("SUBTRACT", 1.0, capillary), 0.42), col, (0.32, 0.015, 0.03))
    rough = g.math("ADD", 0.18, g.math("MULTIPLY", g.noise(g.co, 40.0, 3.0), 0.3))
    height = g.math("ADD", g.math("MULTIPLY", folds, 1.0), g.math("MULTIPLY", g.noise(g.co, 280.0, 3.0), 0.2))
    return g.finish(col, rough, height, bump=0.0028, strength=0.8, coat=0.7)


def vessel_material():
    """Tubes carry their colour by calibre in their vertices, with a little mottling on top."""
    g = Graph("vessel")
    attr = g.n.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    blotch = g.noise(g.co, 60.0, 4.0)
    col = g.mix(g.math("MULTIPLY", g.smooth(blotch, 0.42, 0.62), 0.2), attr.outputs["Color"], (0.05, 0.0, 0.0), "MULTIPLY")
    rough = g.math("ADD", 0.22, g.math("MULTIPLY", blotch, 0.2))
    return g.finish(col, rough, None, coat=0.6)


def glass_alpha(mat, glass):
    """What the page does to glass parts: nearly clear face on, its edges catching the light."""
    if not glass:
        return
    n, l, b = mat.node_tree.nodes, mat.node_tree.links, mat.node_tree.nodes["Principled BSDF"]
    lw = n.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    p = n.new("ShaderNodeMath")
    p.operation = "POWER"
    l.new(lw.outputs["Facing"], p.inputs[0])
    p.inputs[1].default_value = 2.2
    m = n.new("ShaderNodeMapRange")
    l.new(p.outputs[0], m.inputs["Value"])
    m.inputs["To Min"].default_value, m.inputs["To Max"].default_value = (1 - glass) + glass * 0.16, (1 - glass) + glass * 0.91
    l.new(m.outputs[0], b.inputs["Alpha"])


# ------------------------------------------------------------------------------------------------------------ baking
def bake_vertices(o, samples, floor=0.25, colour=True, outer=None):
    """Colour and shadow into the vertices: the plain fallback, and the only colour thin tubes have."""
    scene = bpy.context.scene
    me = o.data
    if "AO" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["AO"])
    ao = me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
    if colour:
        if "Col" not in me.color_attributes:
            me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    if colour:
        me.color_attributes.active_color = me.color_attributes["Col"]
        scene.cycles.samples = 1
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, target="VERTEX_COLORS")
    me.color_attributes.active_color = me.color_attributes["AO"]
    scene.cycles.samples = samples
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    n = len(me.vertices)
    c = np.zeros(n * 4, np.float32)
    a = np.zeros(n * 4, np.float32)
    me.color_attributes["Col"].data.foreach_get("color", c)
    me.color_attributes["AO"].data.foreach_get("color", a)
    shade = floor + (1 - floor) * a[0::4]
    if outer is not None:
        # A wall inside a lobe is in the dark by definition. Shading it would turn it into a black sheet when the lobe is glass.
        shade = 1 + (shade - 1) * outer
    for i in range(3):
        c[i::4] *= shade
    c[3::4] = 1
    me.color_attributes["Col"].data.foreach_set("color", c)
    me.color_attributes.remove(me.color_attributes["AO"])
    me.color_attributes.active_color = me.color_attributes["Col"]


def unwrap(o, inner_scale=0.3):
    """Unwraps a part, then gives the walls hidden inside a lobe far fewer texels than the surface people actually look at."""
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(62), island_margin=0.002, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    outer = o.data.color_attributes.get("Outer")
    if outer is not None and inner_scale < 1:
        # Read the mask before entering bmesh's own copy of the mesh.
        bm = bmesh.from_edit_mesh(o.data)
        uv = bm.loops.layers.uv.active
        out_layer = bm.verts.layers.float_color.get("Outer")
        seen = set()
        for f in bm.faces:
            if f.index in seen:
                continue
            stack, island = [f], []
            seen.add(f.index)
            while stack:
                x = stack.pop()
                island.append(x)
                for loop in x.loops:
                    if loop.edge.seam:
                        continue
                    other = loop.link_loop_radial_next
                    y = other.face
                    if y.index in seen or other is loop:
                        continue
                    # Same island only where the UVs actually meet.
                    if (loop[uv].uv - other.link_loop_next[uv].uv).length < 1e-5 and (loop.link_loop_next[uv].uv - other[uv].uv).length < 1e-5:
                        seen.add(y.index)
                        stack.append(y)
            mean = sum(v[out_layer][0] for x in island for v in x.verts) / max(1, sum(len(x.verts) for x in island))
            if mean < 0.5:
                pts = [l[uv].uv.copy() for x in island for l in x.loops]
                c = sum(pts, pts[0] * 0) / len(pts)
                for x in island:
                    for l in x.loops:
                        l[uv].uv = c + (l[uv].uv - c) * inner_scale
        bmesh.update_edit_mesh(o.data)
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method="SCALED", margin=0.002)
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_pass(o, node, image, kind, samples, **kw):
    node.image = image
    o.data.materials[0].node_tree.nodes.active = node
    bpy.context.scene.cycles.samples = samples
    bpy.ops.object.bake(type=kind, target="IMAGE_TEXTURES", margin=8, margin_type="EXTEND", **kw)


def bake_value(o, name, size, wire):
    """Bakes one value per texel into a float image by emitting it from a temporary material: where each texel is, which way it faces."""
    mat, n, l, b = nodes_of("value_" + name)
    em = n.new("ShaderNodeEmission")
    wire(n, l, em.inputs["Color"])
    out = n["Material Output"]
    l.new(em.outputs[0], out.inputs["Surface"])
    node = n.new("ShaderNodeTexImage")
    im = bpy.data.images.new(f"{o.name}_{name}", size, size, alpha=True, float_buffer=True)
    im.colorspace_settings.name = "Non-Color"
    node.image = im
    n.active = node
    keep = o.data.materials[0]
    o.data.materials[0] = mat
    bpy.context.scene.cycles.samples = 1
    bpy.ops.object.bake(type="EMIT", target="IMAGE_TEXTURES", margin=8, margin_type="EXTEND")
    o.data.materials[0] = keep
    px = np.zeros(size * size * 4, np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    bpy.data.materials.remove(mat)
    return px.reshape(-1, 4)


def texel_positions(o, size):
    """Where every texel of a part's map sits in the model, and which way it faces. Positions are packed to 0..1 because emission clamps."""
    def pos(n, l, sock):
        g = n.new("ShaderNodeNewGeometry")
        a = n.new("ShaderNodeVectorMath")
        a.operation = "ADD"
        l.new(g.outputs["Position"], a.inputs[0])
        a.inputs[1].default_value = (3, 3, 3)
        m = n.new("ShaderNodeVectorMath")
        m.operation = "SCALE"
        l.new(a.outputs[0], m.inputs[0])
        m.inputs["Scale"].default_value = 1 / 6
        l.new(m.outputs[0], sock)

    def nor(n, l, sock):
        g = n.new("ShaderNodeNewGeometry")
        a = n.new("ShaderNodeVectorMath")
        a.operation = "ADD"
        l.new(g.outputs["Normal"], a.inputs[0])
        a.inputs[1].default_value = (1, 1, 1)
        m = n.new("ShaderNodeVectorMath")
        m.operation = "SCALE"
        l.new(a.outputs[0], m.inputs[0])
        m.inputs["Scale"].default_value = 0.5
        l.new(m.outputs[0], sock)

    def out(n, l, sock):
        attr = n.new("ShaderNodeAttribute")
        attr.attribute_name = "Outer"
        l.new(attr.outputs["Fac"], sock)

    p = bake_value(o, "pos", size, pos)
    q = bake_value(o, "nor", size, nor)
    covered = p[:, :3].sum(1) > 0
    points = p[:, :3] * 6 - 3
    normals = q[:, :3] * 2 - 1
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-6)
    outer = bake_value(o, "out", size, out)[:, 0] if o.data.color_attributes.get("Outer") else np.ones(len(points), np.float32)
    return points, normals, outer, covered


class Glow:
    """The vessels as blurred volumes, so a texel on the pleura can ask how much of a vessel lies just beneath it. Near vessels read
    sharp and deep ones soft, which is what light does on its way through a translucent surface."""

    def __init__(self, trees, h=0.0048):
        pts = np.concatenate([v for v, _ in trees.values()])
        self.g = V.Grid(pts.min(0), pts.max(0), h, pad=14)
        self.fields = {}
        for kind, (v, t) in trees.items():
            mask = V.rasterize(self.g, v, t)
            self.fields[kind] = [V.blur(mask, s).astype(np.float32) for s in (0.75, 1.9, 4.2)]
            log("glow", kind, f"{mask.sum() / 1e6:.2f}M voxels")

    def weight(self, kind, points, normals):
        near = self.g.sample(self.fields[kind][0], points - normals * 0.014) * 3.4
        mid = self.g.sample(self.fields[kind][1], points - normals * 0.036) * 5.0
        deep = self.g.sample(self.fields[kind][2], points - normals * 0.08) * 8.0
        return np.clip(np.maximum.reduce([near * 0.95, mid * 0.62, deep * 0.34]), 0, 1)


def bake_maps(o, size, floor=0.3, samples=32, glow=None, wall_alpha=None, normal_size=None, rough_size=None):
    """Bakes a part's dense procedural surface down to a base colour, a normal and a roughness map, with its shadow in the colour, and
    for the lobes the vessels showing through. Returns the three images."""
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    mat = o.data.materials[0]
    node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    normal_size, rough_size = normal_size or size, rough_size or size // 2
    name = o.name
    col = bpy.data.images.new(name + "_c", size, size, alpha=True)
    nor = bpy.data.images.new(name + "_n", normal_size, normal_size, alpha=False)
    rou = bpy.data.images.new(name + "_r", rough_size, rough_size, alpha=False)
    aoi = bpy.data.images.new(name + "_a", size, size, alpha=False)
    for im in (nor, rou, aoi):
        im.colorspace_settings.name = "Non-Color"
    bake_pass(o, node, col, "DIFFUSE", 8, pass_filter={"COLOR"})
    bake_pass(o, node, nor, "NORMAL", 8, normal_space="TANGENT")
    bake_pass(o, node, rou, "ROUGHNESS", 4)
    bake_pass(o, node, aoi, "AO", samples)
    mat.node_tree.nodes.remove(node)
    n = size * size
    c = np.zeros(n * 4, np.float32)
    col.pixels.foreach_get(c)
    c = c.reshape(-1, 4)
    a = np.zeros(n * 4, np.float32)
    aoi.pixels.foreach_get(a)
    bpy.data.images.remove(aoi)
    shade = floor + (1 - floor) * a[0::4]
    if glow is not None or wall_alpha is not None:
        points, normals, outer, covered = texel_positions(o, size)
        # Walls inside a lobe are in the dark by definition, so only the surface takes the shadow.
        shade = 1 + (shade - 1) * outer
    # The image is display-encoded, so the shade is applied in that encoding too.
    c[:, :3] *= (shade ** (1 / 2.2))[:, None]
    if glow is not None:
        lum = c[:, :3].mean(1, keepdims=True)
        for kind, tint, gain in (("vein", (0.52, 0.12, 0.3), 0.75), ("artery", (1.0, 0.52, 0.26), 1.0)):
            w = (glow.weight(kind, points, normals) * outer * gain)[:, None]
            # Keeps the mottling of what is above it, so the vessel sits under the pleura rather than on top.
            c[:, :3] = c[:, :3] * (1 - w) + np.array(tint) * (0.62 + 0.75 * lum) * w
    if wall_alpha is not None:
        # The walls a segment shares with its neighbours almost vanish when the lobe is glass, so glass lobes do not stack up into fog.
        c[:, 3] = wall_alpha + (1 - wall_alpha) * np.clip((outer - 0.25) / 0.5, 0, 1)
    else:
        c[:, 3] = 1
    col.pixels.foreach_set(np.clip(c, 0, 1).ravel())
    col.update()
    for im in (col, nor, rou):
        im.pack()
    return col, nor, rou


def mapped_materials(name, col, nor, rou, glass):
    """Two materials over the same maps: the clean one the file carries, and the poster's, with the page's glass on top."""
    made = []
    for poster in (False, True):
        mat, n, l, b = nodes_of(("poster_" if poster else "final_") + name)
        tc = n.new("ShaderNodeTexImage")
        tc.image = col
        l.new(tc.outputs["Color"], b.inputs["Base Color"])
        tr = n.new("ShaderNodeTexImage")
        tr.image = rou
        l.new(tr.outputs["Color"], b.inputs["Roughness"])
        tn = n.new("ShaderNodeTexImage")
        tn.image = nor
        nm = n.new("ShaderNodeNormalMap")
        l.new(tn.outputs["Color"], nm.inputs["Color"])
        l.new(nm.outputs["Normal"], b.inputs["Normal"])
        b.inputs["Metallic"].default_value = 0
        if poster:
            b.inputs["Coat Weight"].default_value = 0.5
            b.inputs["Coat Roughness"].default_value = 0.2
            glass_alpha(mat, glass)
            if glass:
                # The page lets a part's own alpha through only while it is glass; the poster always shows it at rest.
                combine = n.new("ShaderNodeMath")
                combine.operation = "MULTIPLY"
                link = b.inputs["Alpha"].links[0]
                l.new(link.from_socket, combine.inputs[0])
                l.new(tc.outputs["Alpha"], combine.inputs[1])
                l.new(combine.outputs[0], b.inputs["Alpha"])
        else:
            l.new(tc.outputs["Alpha"], b.inputs["Alpha"])
            mat.blend_method = "BLEND" if glass else "OPAQUE"
        made.append(mat)
    return made


# ------------------------------------------------------------------------------------------------------------ assembly
def airway_objects(hra):
    parts = {}
    used = set()
    for pid, label, about, kind, keys in AIRWAY:
        meshes = []
        for k, m in hra.items():
            if k in used or "bronchopulmonary" in k or "hilum" in k:
                continue
            if any(q in k for q in keys):
                meshes.append(m)
                used.add(k)
        v, t = merge(meshes)
        o = new_mesh(pid, v, t)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        # Bronchi end in small open mouths in the data. Closing them leaves no dark holes at the tips.
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        edges = [e for e in bm.edges if e.is_boundary]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges, sides=48)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        bm.to_mesh(o.data)
        bm.free()
        if len(o.data.polygons) > 50000:
            bpy.context.view_layer.objects.active = o
            m = o.modifiers.new("slim", "DECIMATE")
            m.ratio = (90000 if pid == "segmental_bronchi" else 50000) / len(o.data.polygons)
            bpy.ops.object.modifier_apply(modifier=m.name)
        elif len(o.data.polygons) < 12000:
            bpy.context.view_layer.objects.active = o
            m = o.modifiers.new("fine", "SUBSURF")
            m.levels = m.render_levels = 1 if len(o.data.polygons) > 3000 else 2
            bpy.ops.object.modifier_apply(modifier=m.name)
        o.data.polygons.foreach_set("use_smooth", np.ones(len(o.data.polygons), bool))
        o.data.update()
        parts[pid] = o
        log("airway", pid, len(o.data.polygons), "faces")
    return parts


def vessel_object(name, real_meshes, skeleton_paths, grown, tone):
    """A vessel part: real meshes coloured by their calibre, joined with the fine tubes grown from them."""
    all_v, all_f, all_c = [], [], []
    base = 0
    if real_meshes:
        v, t = merge(real_meshes)
        pts = np.concatenate([p["pos"] for p in skeleton_paths])
        rad = np.concatenate([p["radius"] for p in skeleton_paths])
        from mathutils.kdtree import KDTree

        kd = KDTree(len(pts))
        for i, p in enumerate(pts):
            kd.insert(p, i)
        kd.balance()
        r = np.array([rad[kd.find(p)[1]] for p in v])
        all_v.append(v)
        all_f.append(np.concatenate([t, t[:, 2:]], 1))
        all_c.append(tone_for(r, tone))
        base = len(v)
    if grown:
        v, f, c = tube_mesh(grown, 0.012, tone)
        all_v.append(v)
        all_f.append(f + base)
        all_c.append(c)
    o = object_from(name, np.concatenate(all_v), np.concatenate(all_f))
    flat_color(o, np.concatenate(all_c))
    log("vessel", name, len(o.data.polygons), "faces")
    return o


def flows_for(tree_paths_real, grown, kind, label, about, prefix, drain, count_real, count_fine):
    """Named routes inside the vessels: long journeys along the real tree, short ones in the fine twigs."""
    def chain(i):
        p = tree_paths_real[i]
        if p["parent"] < 0 or p["joint"] is None:
            return p["pos"]
        up = chain(p["parent"])
        cut = np.linalg.norm(up - p["joint"], axis=1).argmin()
        return np.concatenate([up[: cut + 1], p["pos"]])

    routes = []
    long_ones = sorted(range(len(tree_paths_real)), key=lambda i: -len(tree_paths_real[i]["pos"]))
    picked = []
    for i in range(len(tree_paths_real)):
        picked.append((np.linalg.norm(tree_paths_real[i]["pos"][-1] - tree_paths_real[0]["pos"][0]), i))
    picked = [i for _, i in sorted(picked, reverse=True)]
    # Spread them out: pick far tips first, skipping ones close to a tip already taken.
    chosen, tips = [], []
    for i in picked:
        tip = tree_paths_real[i]["pos"][-1]
        if all(np.linalg.norm(tip - t) > 0.22 for t in tips):
            chosen.append(i)
            tips.append(tip)
        if len(chosen) >= count_real:
            break
    for n, i in enumerate(chosen):
        pts = chain(i)[::3]
        if drain:
            pts = pts[::-1]
        routes.append({"id": f"{prefix}_main_{n}", "label": label, "about": about if n == 0 else "", "kind": kind, "radius": 0.004, "cell": 0.015, "points": [to_web(Vector(p)) for p in pts]})
    fine = sorted(grown, key=lambda p: -np.linalg.norm(p["pos"][-1] - p["pos"][0]))
    step = max(1, len(fine) // max(1, count_fine))
    for n, p in enumerate(fine[:: step][: count_fine]):
        pts = p["pos"][:: 2]
        if len(pts) < 4:
            continue
        if drain:
            pts = pts[::-1]
        routes.append({"id": f"{prefix}_fine_{n}", "label": label, "about": "", "kind": kind, "radius": 0.0012, "cell": 0.0065, "points": [to_web(Vector(q)) for q in pts]})
    return routes


def main():
    a = args()
    t0 = time.time()
    os.makedirs(a.cache, exist_ok=True)
    fresh = set(filter(None, a.fresh.split(",")))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    hra_raw = load_glb(os.path.join(a.src, "VH_M_Lung.glb"))
    fit = fit_of(hra_raw)
    hra = {k: (fit(v), t) for k, (v, t) in hra_raw.items()}
    stage1 = os.path.join(a.cache, "stage1.npz")
    if os.path.exists(stage1) and "stage1" not in fresh:
        d = np.load(stage1, allow_pickle=True)
        lobes, measures, built = d["lobes"][0], d["measures"][0], d["built"][0]
        log("loaded stage 1")
    else:
        bp = BodyParts(a.atlas)
        lobes, measures, solids, g = build_lobes(hra, 12000)
        log(f"lobes done at {time.time() - t0:.0f}s")
        built = build_vessels(hra_raw, hra, fit, solids, g, bp)
        log(f"vessels done at {time.time() - t0:.0f}s")
        np.savez_compressed(stage1, lobes=np.array([lobes], dtype=object), measures=np.array([measures], dtype=object), built=np.array([built], dtype=object))
        log("stage 1 saved")

    scene = bpy.context.scene
    stage(scene, a.poster_size, a.samples)
    scene.cycles.transparent_max_bounces = 48
    scene.cycles.max_bounces = 8

    # Parts, in manifest order.
    objects, parts = {}, []
    pleura = pleura_material()
    for lobe, segs in SEGMENTS.items():
        for pid, label, _, _, _ in segs:
            v, t, outer = lobes[pid]
            o = new_mesh(pid, v, t)
            attr = o.data.color_attributes.new("Outer", "FLOAT_COLOR", "POINT")
            data = np.ones((len(v), 4), np.float32)
            data[:, 0] = data[:, 1] = data[:, 2] = outer
            attr.data.foreach_set("color", data.ravel())
            o.data.polygons.foreach_set("use_smooth", np.ones(len(o.data.polygons), bool))
            o.data.materials.append(pleura)
            objects[pid] = o
            mL = measures[pid]
            parts.append(dict(id=pid, label=label, about=SEG_ABOUT, group=lobe, kind="lung", glass=LUNG_GLASS, measure=dict(label="Volume in this model", value=f"{mL:,.0f} mL")))
    cartilage, mucosa = cartilage_material(), mucosa_material()
    for pid, o in airway_objects(hra).items():
        spec = next(x for x in AIRWAY if x[0] == pid)
        o.data.materials.append(cartilage if spec[3] == "cartilage" else mucosa)
        objects[pid] = o
        parts.append(dict(id=pid, label=spec[1], about=spec[2], group="airway", kind=spec[3], vessel=True))
    skeletons, grown = built["skeletons"], built["grown"]
    vessel_mat = vessel_material()
    art_parts = built["art_parts"]
    trunk = merge([art_parts[k] for k in TRUNK_ART])
    side_of = lambda m: m[0][:, 0].mean()
    branches = {"right": [m for k, m in art_parts.items() if k not in TRUNK_ART and side_of(m) < 0], "left": [m for k, m in art_parts.items() if k not in TRUNK_ART and side_of(m) > 0]}
    objects["pulmonary_trunk"] = vessel_object("pulmonary_trunk", [trunk], skeletons["artery"], None, TONE["artery"])
    parts.append(dict(id="pulmonary_trunk", label="Pulmonary trunk and arteries", about="The trunk leaves the right ventricle and divides under the arch of the aorta, sending one large artery into each lung's hilum, carrying oxygen-poor blood.", group="arteries", kind="coral", vessel=True))
    ABOUT_A = "Carry oxygen-poor blood in, running beside the bronchi and dividing with them. Large and segmental branches are measured anatomy; the fine twigs are illustration. Coloured coral here for visibility."
    ABOUT_V = "Bring oxygen-rich blood back toward the heart, running between the segments rather than beside the bronchi. Large and segmental branches are measured anatomy; the fine twigs are illustration. Coloured wine here for visibility."
    for side, title in (("right", "Right"), ("left", "Left")):
        pid = f"{side}_pulmonary_arteries"
        objects[pid] = vessel_object(pid, branches[side], skeletons["artery"], grown[f"artery_{side}"], TONE["artery"])
        parts.append(dict(id=pid, label=f"{title} pulmonary arteries", about=ABOUT_A, group="arteries", kind="coral", vessel=True))
    for side, title in (("right", "Right"), ("left", "Left")):
        pid = f"{side}_pulmonary_veins"
        objects[pid] = vessel_object(pid, [built[f"vein_real_{side}"]], [p for p in skeletons["vein"] if (p["pos"][-1, 0] > 0) == (side == "left")], grown[f"vein_{side}"], TONE["vein"])
        parts.append(dict(id=pid, label=f"{title} pulmonary veins", about=ABOUT_V, group="veins", kind="artery", vessel=True))
    for pid in ("pulmonary_trunk", "right_pulmonary_arteries", "left_pulmonary_arteries", "right_pulmonary_veins", "left_pulmonary_veins"):
        objects[pid].data.materials.append(vessel_mat)
    bpy.context.view_layer.update()
    log(f"assembled at {time.time() - t0:.0f}s, {sum(len(o.data.polygons) for o in objects.values())} faces")

    glass_ids = [p["id"] for p in parts if p.get("glass", 0) > 0.3]

    def only_what_shades(pid):
        # Solid parts are shaded with the glass out of the way. Lobes keep each other, because that is what darkens a fissure.
        for g_id in glass_ids:
            objects[g_id].hide_render = pid not in glass_ids

    for pid, o in objects.items():
        only_what_shades(pid)
        bake_vertices(o, 16, floor=0.3 if pid in glass_ids else 0.5, colour=(o.data.materials[0] is not vessel_mat), outer=lobes[pid][2] if pid in lobes else None)
    for g_id in glass_ids:
        objects[g_id].hide_render = False
    log(f"vertex colours baked at {time.time() - t0:.0f}s")
    for o in objects.values():
        o.data.color_attributes.active_color = o.data.color_attributes["Col"]
        o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index

    extras = dict(skeletons=skeletons, grown=grown, hra=hra, measures=measures)
    stats = built.get("stats", [])
    if not a.no_vertex_export:
        preview_materials(objects, parts)
        render_all(a, objects, parts, os.path.join(a.out, "lungs"), a.crops if not a.maps else "", t0)
        write_model(objects, os.path.join(a.out, "lungs"), mapped=False)
        write_manifest(objects, parts, os.path.join(a.out, "lungs"), extras, stats, LUNG_GLASS)
        log(f"vertex model written at {time.time() - t0:.0f}s")
    if a.maps:
        mapped = bake_every_map(a, objects, parts, lobes, glass_ids, vessel_mat, only_what_shades, t0)
        preview_materials(objects, [p for p in parts if p["id"] not in mapped])
        for pid, (final, poster) in mapped.items():
            objects[pid].data.materials[0] = poster
        render_all(a, objects, parts, a.maps, a.crops, t0)
        for pid, (final, poster) in mapped.items():
            objects[pid].data.materials[0] = final
            for name in [c.name for c in objects[pid].data.color_attributes]:
                objects[pid].data.color_attributes.remove(objects[pid].data.color_attributes[name])
        write_model(objects, a.maps, mapped=True)
        write_manifest(objects, parts, a.maps, extras, stats, LUNG_GLASS_MAPPED)
        log(f"mapped model written at {time.time() - t0:.0f}s")
    log(f"DONE in {time.time() - t0:.0f}s, {sum(len(o.data.polygons) for o in objects.values())} faces")


LUNG_GLASS = 0.88
LUNG_GLASS_MAPPED = 0.78
MAP_SIZES = {"segmental_bronchi": 2048, "lobar_bronchi": 512, "main_bronchi": 1024}


def preview_materials(objects, parts):
    """The poster shows what the page will: baked colours with the page's glass on top."""
    for p in parts:
        o = objects[p["id"]]
        mat, n, l, b = nodes_of("preview_" + p["id"])
        attr = n.new("ShaderNodeVertexColor")
        attr.layer_name = "Col"
        l.new(attr.outputs["Color"], b.inputs["Base Color"])
        b.inputs["Roughness"].default_value = 0.3
        b.inputs["Coat Weight"].default_value = 0.5
        b.inputs["Coat Roughness"].default_value = 0.2
        glass_alpha(mat, p.get("glass", 0))
        o.data.materials.clear()
        o.data.materials.append(mat)


def shoot(scene, path, target, direction, distance, lens=85, hide=()):
    """A close-up from the same stage, to judge the model at full-screen zoom."""
    cam = scene.camera
    d = Vector(direction).normalized()
    cam.location = Vector(target) + d * distance
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lens
    hidden = [o for o in scene.collection.objects if o.name in hide]
    for o in hidden:
        o.hide_render = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in hidden:
        o.hide_render = False


def bake_every_map(a, objects, parts, lobes, glass_ids, vessel_mat, only_what_shades, t0):
    """Unwraps and bakes every textured part. Vessels stay in vertex colours: they are too thin to need more."""
    trees = {
        "artery": merge([mesh_arrays(objects[k]) for k in ("pulmonary_trunk", "right_pulmonary_arteries", "left_pulmonary_arteries")]),
        "vein": merge([mesh_arrays(objects[k]) for k in ("right_pulmonary_veins", "left_pulmonary_veins")]),
    }
    glow = Glow(trees)
    mapped = {}
    for p in parts:
        pid = p["id"]
        o = objects[pid]
        if o.data.materials[0] is vessel_mat:
            continue
        only_what_shades(pid)
        is_lobe = pid in glass_ids
        unwrap(o, inner_scale=0.3 if is_lobe else 1)
        size = MAP_SIZES.get(pid, a.map_size)
        col, nor, rou = bake_maps(o, size, floor=0.34 if is_lobe else 0.45, glow=glow if is_lobe else None, wall_alpha=0.06 if is_lobe else None, normal_size=size, rough_size=size // 2)
        mapped[pid] = mapped_materials(pid, col, nor, rou, LUNG_GLASS_MAPPED if is_lobe else 0)
        log("maps", pid, size, f"at {time.time() - t0:.0f}s")
    for g_id in glass_ids:
        objects[g_id].hide_render = False
    return mapped


def render_all(a, objects, parts, folder, crops, t0):
    scene = bpy.context.scene
    os.makedirs(folder, exist_ok=True)
    bpy.context.view_layer.update()
    cam = scene.camera
    cam.location, cam.rotation_euler = (0, -6.3, 0.3), (math.radians(87.3), 0, 0)
    cam.data.lens = 85
    scene.render.image_settings.file_format = "WEBP"
    scene.render.filepath = os.path.join(os.path.abspath(folder), "poster.webp")
    bpy.ops.render.render(write_still=True)
    log(f"poster at {time.time() - t0:.0f}s")
    if not crops:
        return
    os.makedirs(crops, exist_ok=True)
    lobe_ids = [p["id"] for p in parts if p.get("glass", 0) > 0.3]
    left = [p["id"] for p in parts if p["id"].startswith("left_")]
    for name, target, direction, distance, hide in [
        ("back", (0, 0, 0), (0, 1, 0.05), 6.3, ()),
        ("side_right", (0, 0, 0), (-1, 0, 0.05), 6.3, ()),
        ("side_left", (0, 0, 0), (1, 0, 0.05), 6.3, ()),
        ("top", (0, 0, 0), (0, -0.02, 1), 6.3, ()),
        ("zoom2x", (-0.35, -0.1, 0.05), (0, -1, 0.02), 3.15, ()),
        ("surface", (-0.78, -0.12, 0.12), (-1, -0.45, 0.08), 1.3, ()),
        ("fissure", (-0.7, 0.14, -0.3), (-1, -0.1, 0.05), 1.6, ()),
        ("vessels", (0, 0, -0.15), (0, -1, 0.02), 6.0, lobe_ids),
        ("tips", (-0.62, -0.1, -0.25), (-0.2, -1, 0.05), 1.2, lobe_ids),
        ("trachea", (-0.03, -0.2, 0.42), (-0.25, -1, 0.02), 2.2, lobe_ids),
        ("trachea_back", (-0.03, -0.2, 0.42), (0.25, 1, 0.02), 2.2, lobe_ids),
        ("hilum", (-0.2, -0.05, -0.1), (1, -0.12, 0.05), 3.0, left),
    ]:
        shoot(scene, os.path.join(crops, name + ".png"), target, direction, distance, hide=hide)
    log(f"crops at {time.time() - t0:.0f}s")


def write_model(objects, folder, mapped):
    os.makedirs(folder, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects.values():
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(os.path.abspath(folder), "model.raw.glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_normals=True, export_texcoords=mapped, export_tangents=False, export_materials="EXPORT" if mapped else "NONE", export_vertex_color="ACTIVE",
        export_image_format="WEBP" if mapped else "AUTO", export_image_quality=80,
        export_cameras=False, export_lights=False, export_animations=False,
    )


def write_manifest(objects, parts, folder, extras, stats, glass):
    skeletons, grown, hra = extras["skeletons"], extras["grown"], extras["hra"]
    flows = []
    flows += flows_for(skeletons["artery"], grown["artery_right"], "vein", "Oxygen-poor blood", "Blood from the right ventricle reaches the lungs through the pulmonary arteries, dividing again and again toward the air sacs.", "art_r", False, 12, 22)
    flows += flows_for(skeletons["artery"], grown["artery_left"], "vein", "Oxygen-poor blood", "", "art_l", False, 0, 22)
    flows += vein_flows(skeletons["vein"], grown["vein_right"], grown["vein_left"])
    flows += air_routes(hra)
    parts = [dict(p, glass=glass) if p.get("glass") else p for p in parts]
    groups = [dict(id=k, label=LOBE_LABEL[k], about=LOBE_ABOUT[k]) for k in SEGMENTS] + [
        dict(id="airway", label="Airway", about="Air travels down the trachea and divides again and again through the bronchi."),
        dict(id="arteries", label="Pulmonary arteries", about="Carry oxygen-poor blood from the heart into the lungs."),
        dict(id="veins", label="Pulmonary veins", about="Carry oxygen-rich blood from the lungs back to the heart."),
    ]
    layers = [
        dict(id="lobes", label="Lobes", about="The five lobes and their twenty segments, in glass at rest so the vessels show.", parts=[p["id"] for p in parts if p["kind"] == "lung"]),
        dict(id="vessels", label="Vessels", about="The pulmonary arteries and veins, from the great trunks to hair-fine twigs.", parts=[p["id"] for p in parts if p["group"] in ("arteries", "veins")]),
        dict(id="airway", label="Airway", about="The larynx, the ringed trachea and the whole bronchial tree.", parts=[p["id"] for p in parts if p["group"] == "airway"]),
    ]
    manifest = {
        "name": "lungs",
        "title": "Lungs",
        "about": "Paired organs of gas exchange: the right lung has three lobes, the left has two, and each divides into segments.",
        "credit": CREDIT,
        "pulse": "breath",
        "groups": groups,
        "parts": parts,
        "layers": layers,
        "pins": lung_pins(objects),
        "flows": flows,
        "gates": lung_gates(skeletons, hra),
    }
    with open(os.path.join(os.path.abspath(folder), "manifest.json"), "w") as f:
        json.dump(manifest, f)


def vein_flows(paths, grown_r, grown_l):
    routes = []
    for side, gr, count in (("right", grown_r, 22), ("left", grown_l, 22)):
        sign = -1 if side == "right" else 1
        own = [p for p in paths if p["pos"][-1, 0] * sign > 0]
        remap = {id(p): i for i, p in enumerate(own)}
        # Parent numbers count across every vein tree, so rebuild them for this side's own list.
        for p in own:
            if p["parent"] >= 0 and paths[p["parent"]] is not None and id(paths[p["parent"]]) in remap:
                p["_parent"] = remap[id(paths[p["parent"]])]
            else:
                p["_parent"] = -1
        local = [dict(p, parent=p["_parent"]) for p in own]
        routes += flows_for(local, gr, "artery", f"Oxygen-rich blood, from the {side} lung", "Blood that has collected oxygen drains through the pulmonary veins to the left atrium." if side == "right" else "", f"vein_{side[0]}", True, 5, count)
    return routes


AIR = [
    ["VH_M_trachea", "carina", "right_main_bronchus", "right_superior_lobar_bronchus", "right_apical_bronchus"],
    ["VH_M_trachea", "carina", "right_main_bronchus", "right_intermediate_bronchus", "right_lower_lobar_bronchus", "right_posterior_basal"],
    ["VH_M_trachea", "carina", "right_main_bronchus", "right_intermediate_bronchus", "right_middle_lobar_bronchus", "right_lateral_bronchus"],
    ["VH_M_trachea", "carina", "left_main_bronchus", "left_superior_lobar_bronchus", "left_apical_bronchus"],
    ["VH_M_trachea", "carina", "left_main_bronchus", "left_inferior_lobar_bronchus", "left_posterior_basal_bronchus"],
]


def air_routes(hra):
    out = []
    for i, names in enumerate(AIR):
        pts = [hra[next(k for k in hra if k.endswith(n))][0].mean(0) for n in names]
        out.append({"id": f"air_{i}", "label": "Air", "about": "Air moves down the trachea, through the bronchi, toward the air sacs." if i == 0 else "", "kind": "air", "radius": 0.012, "cell": 0.018, "points": [to_web(Vector(p)) for p in pts]})
    return out


def lung_gates(skeletons, hra):
    gates = []
    root = skeletons["artery"][0]["pos"][0]
    gates.append({"label": "From the right ventricle", "io": "in", "kind": "vein", "at": to_web(Vector(root))})
    seen = []
    for p in skeletons["vein"]:
        if p["parent"] < 0:
            at = p["pos"][0]
            if all(np.linalg.norm(at - s) > 0.06 for s in seen):
                seen.append(at)
                gates.append({"label": "To the left atrium", "io": "out", "kind": "artery", "at": to_web(Vector(at))})
    v = next(m for k, m in hra.items() if k.endswith("VH_M_trachea"))[0]
    gates.append({"label": "Air in", "io": "in", "kind": "air", "at": to_web(Vector(v[v[:, 2] >= np.percentile(v[:, 2], 96)].mean(0)))})
    return gates


def lung_pins(objects):
    out = []
    for pid in ("trachea", "right_anterior", "right_lateral", "left_anterior", "left_anterior_basal"):
        v, _ = mesh_arrays(objects[pid])
        mid = v.mean(0)
        # The most forward point near the part's middle, so the pin sits on what faces the viewer.
        near = v[np.linalg.norm((v - mid)[:, [0, 2]], axis=1) < 0.12]
        p = near[near[:, 1].argmin()]
        out.append({"part": pid, "at": to_web(Vector(p))})
    return out


if __name__ == "__main__":
    main()
