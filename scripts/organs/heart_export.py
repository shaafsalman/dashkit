"""The heart's web files: blood routes along the real lumens, the GLB with its WebP maps, and the manifest."""
import json, os, struct, subprocess
import numpy as np
from scipy import ndimage as ndi


def _snap(grid, dist, p, reach=4e-3):
    """The deepest lumen point near p: routes run down the middle of a vessel, not along its wall."""
    i = np.round(grid.index(p)).astype(int)
    r = int(reach / grid.h)
    lo = np.maximum(i - r, 0)
    hi = np.minimum(i + r + 1, np.array(dist.shape))
    box = dist[lo[0] : hi[0], lo[1] : hi[1], lo[2] : hi[2]]
    j = np.unravel_index(np.argmax(box), box.shape)
    return grid.lo + (lo + np.array(j)) * grid.h


def _path(grid, dist, a, b):
    from skimage.graph import MCP_Geometric

    ia, ib = [np.round(grid.index(p)).astype(int) for p in (a, b)]
    lo = np.maximum(np.minimum(ia, ib) - 40, 0)
    hi = np.minimum(np.maximum(ia, ib) + 41, np.array(dist.shape))
    d = dist[lo[0] : hi[0], lo[1] : hi[1], lo[2] : hi[2]]
    # Cheap where the lumen is wide, so the path keeps to the centre line.
    cost = 1.0 / (d + 0.3) ** 2
    cost[d <= 0] = 1e6
    m = MCP_Geometric(cost)
    m.find_costs([tuple(ia - lo)], [tuple(ib - lo)])
    tr = np.array(m.traceback(tuple(ib - lo)))
    return grid.lo + (tr + lo) * grid.h


def _smooth(points, spacing=1.6e-3, sigma=3.0):
    p = ndi.gaussian_filter1d(np.asarray(points, float), sigma, axis=0, mode="nearest")
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
    n = max(4, int(s[-1] / spacing) + 1)
    t = np.linspace(0, s[-1], n)
    return np.stack([np.interp(t, s, p[:, k]) for k in range(3)], 1)


def routes(grid, V, trees, atlas, log=print):
    """Blood routes through the heart, each from where blood enters to where it leaves, along the middle of the real lumens."""
    from heart_volume import VALVES, valve_centre, CAVITY

    out = []
    planes = V["planes"]
    centres = {k: valve_centre(atlas, ids)[0] for k, ids in VALVES.items()}

    def cav_centre(name, toward=None, t=0.5):
        m = V["cav"][name]
        idx = np.argwhere(m)
        c = grid.lo + idx.mean(0) * grid.h
        return c if toward is None else c + (np.asarray(toward) - c) * t

    def inner(name, back=4e-3):
        p, n = planes[name]
        n = np.asarray(n, float) / np.linalg.norm(n)
        return np.asarray(p, float) - n * back

    for side in ("left", "right"):
        lumen = (V[side] & ~V["tissue"]) & ~V["beyond"]
        sl = tuple(slice(0, s) for s in lumen.shape)
        dist = ndi.distance_transform_edt(lumen).astype(np.float32)
        lv, _ = atlas.mesh(CAVITY["lv"])
        apex = lv[np.argmax(np.linalg.norm(lv - centres["mitral"], axis=1))]
        if side == "right":
            starts = [("superior_vena_cava", "From the upper body"), ("inferior_vena_cava", "From the lower body")]
            middle = [cav_centre("ra"), centres["tricuspid"], cav_centre("rv", apex, 0.25), centres["pulmonary"]]
            ends = [("left_pulmonary_artery", "To the left lung"), ("right_pulmonary_artery", "To the right lung")]
            kind, about = "vein", "Oxygen-poor blood: from the body through the right atrium, tricuspid valve, right ventricle and pulmonary valve to the lungs."
        else:
            starts = [("right_superior_pulmonary_vein", "From the right lung"), ("right_inferior_pulmonary_vein", "From the right lung"), ("left_superior_pulmonary_vein", "From the left lung"), ("left_inferior_pulmonary_vein", "From the left lung")]
            middle = [cav_centre("la"), centres["mitral"], cav_centre("lv", apex, 0.4), centres["aortic"]]
            ends = [("brachiocephalic_trunk", "To the head and right arm"), ("left_common_carotid", "To the head"), ("left_subclavian", "To the left arm"), ("descending_aorta", "To the body")]
            kind, about = "artery", "Oxygen-rich blood: from the lungs through the left atrium, mitral valve, left ventricle and aortic valve to the body."
        n = max(len(starts), len(ends))
        for i in range(n):
            s_name, s_label = starts[i % len(starts)]
            e_name, e_label = ends[i % len(ends)]
            way = [inner(s_name)] + middle + [inner(e_name)]
            way = [_snap(grid, dist, p) for p in way]
            pts = [way[0]]
            for a, b in zip(way[:-1], way[1:]):
                seg = _path(grid, dist, a, b)
                pts.extend(seg[1:])
            pts = _smooth(np.array(pts))
            r = dist[tuple(np.clip(np.round(grid.index(pts)).astype(int), 0, np.array(dist.shape) - 1).T)] * grid.h
            out.append(dict(id=f"{side}_{i}", label="Oxygen-rich blood" if side == "left" else "Oxygen-poor blood", about=about, kind=kind, points=pts, lumen=r, enter=s_label if i < len(starts) else None, leave=e_label if i < len(ends) else None, start=s_name, end=e_name))
            log(f"route {side}_{i}: {s_name} -> {e_name}, {len(pts)} points, narrowest {np.percentile(r, 3) * 1e3:.1f} mm")

    # The heart's own circulation: down each named artery from the aorta, and up each named vein to the coronary sinus.
    def lineage(b):
        chain = [b.pts]
        while b.parent is not None:
            chain.append(b.parent.pts[: b.at + 1])
            b = b.parent
        return np.concatenate(chain[::-1])

    pick = {"artery": ["lad", "diagonals", "circumflex", "obtuse_marginals", "rca", "pda", "acute_marginal", "posterolateral_branches", "conus_artery"], "vein": ["anterior_interventricular_vein", "great_cardiac_vein", "middle_cardiac_vein", "small_cardiac_vein", "posterior_vein_lv", "left_marginal_vein"]}
    for circ, names in pick.items():
        for name in names:
            cand = [b for b in trees[circ] if b.part == name]
            if not cand:
                continue
            b = max(cand, key=lambda b: len(lineage(b)))
            pts = lineage(b)
            r = None
            pts = _smooth(pts, 1.0e-3, 1.5)
            if circ == "vein":
                pts = pts[::-1]
            out.append(dict(id=f"coronary_{name}", label="Coronary blood" if circ == "artery" else "Coronary venous blood", about="The heart muscle's own supply." if circ == "artery" else "Used blood returning from the heart muscle to the coronary sinus.", kind=circ, points=pts, lumen=np.full(len(pts), float(np.median(b.r)) * 0.8), coronary=True))
    return out


# ------------------------------------------------------------------------------------------------------------- the parts

ATLAS_CREDIT = (
    "Anatomy: BodyParts3D 4.0, © The Database Center for Life Science, CC BY 4.0 (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/; "
    "Mitsuhashi et al. 2009, https://doi.org/10.1093/nar/gkn613), read from the Human Atlas data (MIT, github.com/ashemag/human-atlas). "
    "Adapted: every wall, cavity and vessel filled into one solid and resurfaced, the great vessels cut, the coronary vessels' centrelines "
    "and widths measured from the atlas tubes and rebuilt as smooth tubes, the leaflets refined. Cavity volumes are this reference model's. "
    "Illustration, not measurement: the fine coronary branches, chordae tendineae, epicardial fat, trabeculae, pectinate muscles, "
    "appendage folds, every colour and texture, and the blood routes."
)

GROUPS = [
    dict(id="chambers", label="Chambers", about="Two atria receive blood; two ventricles pump it out."),
    dict(id="inside", label="Valves and muscles", about="One-way valves keep blood moving forward; papillary muscles and their cords hold the inlet valves shut."),
    dict(id="vessels", label="Great vessels", about="The large vessels that carry blood into and out of the heart."),
    dict(id="supply", label="Heart's own supply", about="The coronary arteries feed the heart muscle; the cardiac veins drain it into the right atrium."),
    dict(id="fat", label="Epicardial fat", about="Fat that cushions the coronary vessels in the heart's grooves."),
]

# id: label, group, kind, about, extra
PARTS = {
    "left_ventricle": ("Left ventricle", "chambers", "muscle", "The thickest chamber. Pumps oxygen-rich blood through the aortic valve to the whole body.", {"measure": "lv"}),
    "right_ventricle": ("Right ventricle", "chambers", "muscle", "Pumps oxygen-poor blood through the pulmonary valve to the lungs, at much lower pressure.", {"measure": "rv"}),
    "septum": ("Interventricular septum", "chambers", "muscle", "The muscular wall between the ventricles; it contracts with the left ventricle.", {}),
    "left_atrium": ("Left atrium", "chambers", "muscle", "Receives oxygen-rich blood from the four pulmonary veins and passes it to the left ventricle. Its appendage is where clots form in atrial fibrillation.", {"measure": "la"}),
    "right_atrium": ("Right atrium", "chambers", "muscle", "Receives oxygen-poor blood from the venae cavae and the coronary sinus. The sinoatrial node, the heart's pacemaker, sits in its wall.", {"measure": "ra"}),
    "mitral_valve": ("Mitral valve", "inside", "valve", "Two leaflets between the left atrium and left ventricle; they close as the ventricle contracts.", {}),
    "tricuspid_valve": ("Tricuspid valve", "inside", "valve", "Three leaflets between the right atrium and right ventricle.", {}),
    "aortic_valve": ("Aortic valve", "inside", "valve", "Three cusps at the root of the aorta; they open as the left ventricle ejects and close to stop backflow.", {}),
    "pulmonary_valve": ("Pulmonary valve", "inside", "valve", "Three cusps at the root of the pulmonary trunk, opening as the right ventricle ejects.", {}),
    "papillary_muscles": ("Papillary muscles", "inside", "muscle", "Columns of muscle rising from the ventricle walls; through their cords they keep the mitral and tricuspid leaflets from turning back. Includes the moderator band.", {}),
    "chordae_tendineae": ("Chordae tendineae", "inside", "valve", "Fine tendinous cords from the papillary muscles to the leaflet edges. Drawn as an illustration of their usual pattern.", {}),
    "aorta": ("Aorta", "vessels", "artery", "The body's main artery: it rises from the left ventricle, arches over the heart and gives off the brachiocephalic trunk, left common carotid and left subclavian arteries.", {"vessel": True}),
    "pulmonary_arteries": ("Pulmonary trunk and arteries", "vessels", "pulmonary", "Carry oxygen-poor blood from the right ventricle to both lungs.", {"vessel": True}),
    "pulmonary_veins": ("Pulmonary veins", "vessels", "artery", "Four veins that return oxygen-rich blood from the lungs to the left atrium.", {"vessel": True}),
    "superior_vena_cava": ("Superior vena cava", "vessels", "pulmonary", "Returns oxygen-poor blood from the head, neck and arms to the right atrium.", {"vessel": True}),
    "inferior_vena_cava": ("Inferior vena cava", "vessels", "pulmonary", "Returns oxygen-poor blood from the lower body to the right atrium.", {"vessel": True}),
    "epicardial_fat": ("Epicardial fat", "fat", "fat", "Fat lying in the grooves along the coronary vessels, under the heart's outer lining. Its spread is drawn as an illustration.", {}),
}

CORONARY_ABOUT = {
    "left_main": "Leaves the aorta's left sinus and soon divides into the anterior descending and circumflex arteries.",
    "lad": "Runs down the front groove between the ventricles to the apex, feeding the front of the left ventricle and most of the septum.",
    "diagonals": "Branches of the LAD that cross the front of the left ventricle.",
    "lad_right_branches": "Small LAD branches to the right ventricle's front wall, including the left conus branch.",
    "septal_perforators": "Plunge from the LAD and the posterior descending artery into the septum.",
    "circumflex": "Curves left in the groove between the left atrium and ventricle, around to the back.",
    "obtuse_marginals": "Circumflex branches down the left ventricle's side wall.",
    "rca": "Leaves the aorta's right sinus and runs in the right atrioventricular groove around to the back.",
    "conus_artery": "The first RCA branch, to the right ventricle's outflow tract.",
    "rca_anterior_branches": "RCA branches over the right ventricle's front wall.",
    "acute_marginal": "Runs along the heart's lower right border, over the right ventricle.",
    "pda": "Runs down the back groove between the ventricles; here it comes from the RCA, as in most people.",
    "posterolateral_branches": "RCA branches to the back of the left ventricle.",
    "coronary_sinus": "Collects most of the heart's venous blood and empties into the right atrium.",
    "great_cardiac_vein": "Runs beside the circumflex artery in the left groove into the coronary sinus.",
    "anterior_interventricular_vein": "Rises beside the LAD and becomes the great cardiac vein.",
    "left_marginal_vein": "Drains the left ventricle's side wall into the great cardiac vein.",
    "posterior_vein_lv": "Drains the back of the left ventricle into the coronary sinus.",
    "middle_cardiac_vein": "Rises in the back groove beside the posterior descending artery to the coronary sinus.",
    "small_cardiac_vein": "Runs in the right groove beside the RCA to the coronary sinus.",
    "anterior_cardiac_veins": "Small veins over the right ventricle that open straight into the right atrium.",
}

LAYERS = [
    ("fat", "Epicardial fat", "The fat in the grooves.", ["epicardial_fat"]),
    ("coronary", "Coronary vessels", "The heart's own arteries and veins.", None),
    ("great", "Great vessels", "Aorta, pulmonary arteries and veins, venae cavae.", ["aorta", "pulmonary_arteries", "pulmonary_veins", "superior_vena_cava", "inferior_vena_cava"]),
    ("atria", "Atria", "Both atria and their appendages.", ["left_atrium", "right_atrium"]),
    ("ventricles", "Ventricles", "The free walls of both ventricles.", ["left_ventricle", "right_ventricle"]),
    ("septum", "Septum", "The wall between the ventricles.", ["septum"]),
    ("inside", "Valves and muscles", "Valves, papillary muscles and chordae.", ["mitral_valve", "tricuspid_valve", "aortic_valve", "pulmonary_valve", "papillary_muscles", "chordae_tendineae"]),
]

# Vessel colours for parts drawn with vertex colour (linear).
TUBE_COLOURS = {"artery": ((0.86, 0.2, 0.045), (1.0, 0.42, 0.12)), "vein": ((0.045, 0.085, 0.42), (0.16, 0.26, 0.75)), "chordae": ((0.72, 0.56, 0.46), (0.95, 0.86, 0.76))}


def _glb(path, nodes, images):
    """Writes a GLB by hand: one node and mesh per part, maps as WebP through EXT_texture_webp."""
    bin_ = bytearray()
    views, accessors = [], []

    def add(data, target=None, comp=5126, typ="VEC3", minmax=False, normalized=False):
        while len(bin_) % 4:
            bin_.append(0)
        off = len(bin_)
        b = data.tobytes()
        bin_.extend(b)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(b)}
        if target:
            v["target"] = target
        views.append(v)
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": int(len(data)), "type": typ}
        if normalized:
            a["normalized"] = True
        if minmax:
            a["min"] = data.min(0).tolist()
            a["max"] = data.max(0).tolist()
        accessors.append(a)
        return len(accessors) - 1

    gl_images, textures, materials, meshes, gl_nodes = [], [], [], [], []
    for path_img in images:
        while len(bin_) % 4:
            bin_.append(0)
        b = open(path_img, "rb").read()
        off = len(bin_)
        bin_.extend(b)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(b)})
        gl_images.append({"bufferView": len(views) - 1, "mimeType": "image/webp"})
        textures.append({"sampler": 0, "extensions": {"EXT_texture_webp": {"source": len(gl_images) - 1}}})
    for nd in nodes:
        attrs = {"POSITION": add(nd["v"].astype(np.float32), 34962, minmax=True), "NORMAL": add(nd["n"].astype(np.float32), 34962)}
        if nd.get("uv") is not None:
            attrs["TEXCOORD_0"] = add(nd["uv"].astype(np.float32), 34962, typ="VEC2")
        if nd.get("c") is not None:
            attrs["COLOR_0"] = add(nd["c"].astype(np.float32), 34962)
        idx = add(nd["f"].astype(np.uint32).ravel(), 34963, comp=5125, typ="SCALAR")
        if nd.get("maps"):
            b, n, r = nd["maps"]
            mat = {"name": nd["name"], "pbrMetallicRoughness": {"baseColorTexture": {"index": b}, "metallicRoughnessTexture": {"index": r}, "metallicFactor": 0.0, "roughnessFactor": 1.0}, "normalTexture": {"index": n}}
        else:
            mat = {"name": nd["name"], "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0.0, "roughnessFactor": nd.get("roughness", 0.32)}}
        materials.append(mat)
        meshes.append({"name": nd["name"], "primitives": [{"attributes": attrs, "indices": idx, "material": len(materials) - 1}]})
        gl_nodes.append({"name": nd["name"], "mesh": len(meshes) - 1})
    doc = {
        "asset": {"version": "2.0", "generator": "dashkit build_heart.py"},
        "extensionsUsed": ["EXT_texture_webp"],
        "extensionsRequired": ["EXT_texture_webp"],
        "scene": 0,
        "scenes": [{"nodes": list(range(len(gl_nodes)))}],
        "nodes": gl_nodes,
        "meshes": meshes,
        "materials": materials,
        "textures": textures,
        "images": gl_images,
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_)}],
    }
    if not textures:
        for k in ("textures", "images", "samplers", "extensionsUsed", "extensionsRequired"):
            doc.pop(k)
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    while len(bin_) % 4:
        bin_.append(0)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A))
        fh.write(js)
        fh.write(struct.pack("<II", len(bin_), 0x004E4942))
        fh.write(bin_)


def tube_colours(v, n, kind, rng_seed, surface_dist=None):
    """A vessel's colour, lighter along its crest and darker where it meets the heart, with a little variation along it."""
    lo, hi = TUBE_COLOURS[kind]
    lo, hi = np.array(lo), np.array(hi)
    up = np.clip(surface_dist if surface_dist is not None else 0.5, 0, 1)
    t = 0.35 + 0.45 * up
    c = lo + (hi - lo) * t[:, None] if np.ndim(t) else lo + (hi - lo) * t
    if np.ndim(c) == 1:
        c = np.tile(c, (len(v), 1))
    return c


def export(work, out, log=print):
    import pickle
    from heart_vessels import CORONARIES

    geo = pickle.load(open(os.path.join(work, "geometry.pkl"), "rb"))
    baked = pickle.load(open(os.path.join(work, "baked.pkl"), "rb"))
    parts = geo["parts"]
    # Fit: Y up already; the whole model about two units tall and centred.
    allv = np.concatenate([p["v"] for k, p in parts.items()])
    lo, hi = allv.min(0), allv.max(0)
    centre = (lo + hi) / 2
    scale = 2.0 / float((hi - lo).max())
    fit = lambda p: ((np.asarray(p) - centre) * scale)
    log(f"model {np.round((hi - lo) * 1e3, 1)} mm, scale {scale:.2f} units per metre")

    from heart_field import vertex_normals
    from scipy import ndimage as ndi

    # How far each tube vertex stands off the heart: for the crest-to-contact shading of the vessels.
    D = np.load(os.path.join(work, "D.npy")).astype(np.float32)
    glo, gh = np.asarray(geo["lo"]), geo["h"]

    def surface_height(p):
        return ndi.map_coordinates(D, ((p - glo) / gh).T, order=1, mode="nearest")

    nodes, images = [], []
    mapsdir = os.path.join(work, "maps")
    kinds = {}
    for pid, p in parts.items():
        nd = {"name": pid}
        if pid in baked:
            b = baked[pid]
            nd["v"], nd["f"], nd["uv"], nd["n"] = fit(b["v"]), b["f"], b["uv"], b["n"]
            base = len(images)
            for m in ("base", "normal", "rough"):
                images.append(os.path.join(mapsdir, f"{pid}_{m}.webp"))
            nd["maps"] = (base, base + 1, base + 2)
        else:
            v, f = p["v"], p["f"]
            n = p.get("n")
            if n is None:
                n = vertex_normals(v, f)
            kind = "chordae" if pid == "chordae_tendineae" else ("vein" if any(c[0] == pid and c[2] == "vein" for c in CORONARIES) else "artery")
            if p["kind"] == "tube" and kind != "chordae":
                h = surface_height(v)
                up = np.clip(h / 1.2e-3, 0, 1) * 0.6 + np.clip(n @ np.array([0.0, 0.5, 0.86]), 0, 1) * 0.4
                lo_c, hi_c = (np.array(c) for c in TUBE_COLOURS[kind])
                shade = 0.55 + 0.45 * np.clip(h / 0.8e-3, 0, 1)
                c = (lo_c + (hi_c - lo_c) * up[:, None]) * shade[:, None]
            else:
                lo_c, hi_c = (np.array(c) for c in TUBE_COLOURS["chordae"])
                c = np.tile((lo_c + hi_c) / 2, (len(v), 1))
            nd["v"], nd["f"], nd["n"], nd["c"] = fit(v), f, n, c.astype(np.float32)
            nd["roughness"] = 0.28
        nodes.append(nd)
    # The uncompressed model stays in the work folder, for Blender (which cannot read meshopt) to render the checks from.
    raw = os.path.join(work, "model.raw.glb")
    os.makedirs(out, exist_ok=True)
    _glb(raw, nodes, images)
    log(f"raw glb {os.path.getsize(raw) / 1e6:.1f} MB, {sum(len(n['f']) for n in nodes)} triangles, {len(nodes)} parts, {len(images)} maps")
    final = os.path.join(out, "model.glb")
    cmd = ["npx", "-y", "@gltf-transform/cli@4", "meshopt", raw, final, "--level", "high", "--quantize-position", "15", "--quantize-normal", "10", "--quantize-texcoord", "14", "--quantize-color", "10"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        log(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit("meshopt failed")
    log(f"model.glb {os.path.getsize(final) / 1e6:.2f} MB")
    manifest(geo, out, fit, scale, log)


def manifest(geo, out, fit, scale, log=print):
    from heart_vessels import CORONARIES

    parts = geo["parts"]
    measured = geo["measured"]
    measure_of = {"lv": measured["lv"], "rv": measured["rv"], "la": measured["la"], "ra": measured["ra"]}
    plist = []
    for pid, (label, group, kind, about, extra) in PARTS.items():
        if pid not in parts:
            continue
        e = {"id": pid, "label": label, "about": about, "group": group, "kind": kind}
        if extra.get("vessel"):
            e["vessel"] = True
        if extra.get("measure"):
            e["measure"] = {"label": "Cavity volume (this model)", "value": f"{measure_of[extra['measure']]:.0f} mL"}
        plist.append(e)
    coronary_ids = []
    for pid, label, kind, ids, parent in CORONARIES:
        if pid in parts:
            plist.append({"id": pid, "label": label, "about": CORONARY_ABOUT[pid] + " Course measured from BodyParts3D; the finest branches are illustration.", "group": "supply", "kind": "coronary" if kind == "artery" else "vein", "vessel": True})
            coronary_ids.append(pid)
    layers = []
    for lid, label, about, members in LAYERS:
        members = coronary_ids if members is None else [m for m in members if m in parts]
        layers.append({"id": lid, "label": label, "about": about, "parts": members})
    # Pins: each on the point of the part that stands furthest out from the heart's centre in the part's own direction.
    allc = np.concatenate([parts[k]["v"] for k in ("left_ventricle", "right_ventricle", "left_atrium", "right_atrium")]).mean(0)
    pins = []
    for pid in ("left_ventricle", "right_ventricle", "right_atrium", "left_atrium", "aorta", "pulmonary_arteries", "lad", "rca", "epicardial_fat"):
        if pid not in parts:
            continue
        v = parts[pid]["v"]
        c = v.mean(0)
        d = c - allc
        d = d / max(np.linalg.norm(d), 1e-9) + np.array([0, 0, 0.6])
        d /= np.linalg.norm(d)
        pins.append({"part": pid, "at": [round(float(x), 4) for x in fit(v[np.argmax((v - c) @ d)])]})
    flows, gates = [], []
    for r in geo["flows"]:
        pts = fit(r["points"])
        lumen = np.asarray(r["lumen"]) * scale
        narrow = float(np.percentile(lumen, 5))
        if r.get("coronary"):
            cell = round(max(0.005, min(0.012, narrow * 0.9)), 4)
            radius = round(max(0.0015, narrow * 0.25), 4)
        else:
            cell = 0.02
            radius = round(min(0.06, max(0.012, narrow * 0.45)), 4)
        flows.append({"id": r["id"], "label": r["label"], "about": r["about"], "kind": r["kind"], "radius": radius, "cell": cell, "points": [[round(float(x), 4) for x in p] for p in pts]})
        if r.get("enter"):
            gates.append({"label": r["enter"], "io": "in", "kind": r["kind"], "at": [round(float(x), 4) for x in pts[0]]})
        if r.get("leave"):
            gates.append({"label": r["leave"], "io": "out", "kind": r["kind"], "at": [round(float(x), 4) for x in pts[-1]]})
    seen, uniq = set(), []
    for g in gates:
        key = (g["label"], tuple(np.round(g["at"], 2)))
        if key not in seen:
            seen.add(key)
            uniq.append(g)
    m = {
        "name": "heart",
        "title": "Heart",
        "about": "A muscular pump with four chambers, four valves and its own blood supply. Built from BodyParts3D's adult male heart: every part is a closed solid you can lift away layer by layer.",
        "credit": ATLAS_CREDIT,
        "pulse": "heart",
        "groups": GROUPS,
        "parts": plist,
        "layers": layers,
        "pins": pins,
        "flows": flows,
        "gates": uniq,
    }
    with open(os.path.join(out, "manifest.json"), "w") as fh:
        json.dump(m, fh, separators=(",", ":"))
    log(f"manifest: {len(plist)} parts, {len(layers)} layers, {len(flows)} flows, {len(uniq)} gates")
