"""The heart as one labelled solid. Every BodyParts3D wall, vessel and cavity is filled into a shared voxel grid, so tissue is whatever is
neither a lumen nor the outside. There can be no hole in a chamber or a gap at a junction, because no part is a shell any more: parts are
slices of one solid, they share their walls, and each is closed. Lumens run unbroken from every cut vessel end through the chambers."""
import time
import numpy as np
from scipy import ndimage as ndi

from heart_field import Grid, bbox, extract, largest_components, simplify, solid, taubin
from heart_vessels import measure_tube

H = 0.4e-3  # metres per voxel
BOX = ((-0.05, 1.232, -0.066), (0.098, 1.44, 0.09))

CAVITY = {"lv": "FJ2422", "rv": "FJ2423", "ra": "FJ2424", "la": "FJ2425"}
PAPILLARY = {"papillary_left": ["FJ2418", "FJ2429"], "papillary_right": ["FJ2419", "FJ2430", "FJ2437"]}
VALVES = {"mitral": ["FJ2420", "FJ2432"], "tricuspid": ["FJ2421", "FJ2433", "FJ2436"], "aortic": ["FJ2435", "FJ2426", "FJ2431"], "pulmonary": ["FJ2417", "FJ2427", "FJ2434"]}
# id: atlas meshes, wall thickness in metres, circulation. Families flow into each other, so their lumens are taken from their union.
VESSELS = {
    "ascending_aorta": (["FJ3413"], 1.9e-3, "left"),
    "aortic_arch": (["FJ3411"], 1.9e-3, "left"),
    "descending_aorta": (["FJ3427"], 1.8e-3, "left"),
    "brachiocephalic_trunk": (["FJ3417"], 1.1e-3, "left"),
    "left_common_carotid": (["FJ3483"], 1.0e-3, "left"),
    "left_subclavian": (["FJ3479"], 1.0e-3, "left"),
    "pulmonary_trunk": (["FJ2966"], 1.4e-3, "right"),
    "left_pulmonary_artery": (["FJ2924"], 1.2e-3, "right"),
    "right_pulmonary_artery": (["FJ3019"], 1.2e-3, "right"),
    "superior_vena_cava": (["FJ3645"], 0.9e-3, "right"),
    "inferior_vena_cava": (["FJ3441"], 0.9e-3, "right"),
    "right_superior_pulmonary_vein": (["FJ3020"], 0.8e-3, "left"),
    "right_inferior_pulmonary_vein": (["FJ3040"], 0.8e-3, "left"),
    "left_superior_pulmonary_vein": (["FJ2933", "FJ2925"], 0.8e-3, "left"),
    "left_inferior_pulmonary_vein": (["FJ2955"], 0.8e-3, "left"),
}
FAMILIES = [
    ["ascending_aorta", "aortic_arch", "descending_aorta", "brachiocephalic_trunk", "left_common_carotid", "left_subclavian"],
    ["pulmonary_trunk", "left_pulmonary_artery", "right_pulmonary_artery"],
    ["superior_vena_cava"],
    ["inferior_vena_cava"],
    ["right_superior_pulmonary_vein"],
    ["right_inferior_pulmonary_vein"],
    ["left_superior_pulmonary_vein"],
    ["left_inferior_pulmonary_vein"],
]
ENTER = {"ascending_aorta", "pulmonary_trunk", "superior_vena_cava", "inferior_vena_cava", "right_superior_pulmonary_vein", "right_inferior_pulmonary_vein", "left_superior_pulmonary_vein", "left_inferior_pulmonary_vein"}
LABELS = ["left_ventricle", "right_ventricle", "septum", "left_atrium", "right_atrium", "papillary_left", "papillary_right"] + list(VESSELS)
ID = {k: i + 1 for i, k in enumerate(LABELS)}
# Where each vessel is cut, as a plane across its axis: an atlas point the plane passes through and the way that is removed.
PLANE_CUTS = {
    "superior_vena_cava": ((-0.015, 1.3835, 0.016), (0, 1, 0)),
    "inferior_vena_cava": ((-0.015, 1.2445, 0.016), (0, -1, 0)),
    "brachiocephalic_trunk": ((0.0, 1.4145, 0.012), (-0.12, 1, 0.04)),
    "left_common_carotid": ((0.017, 1.4275, 0.004), (0, 1, 0)),
    "descending_aorta": ((0.018, 1.334, -0.04), (0.0, -1, -0.12)),
}
# Cuts placed by measuring a vessel's centreline: how far along it, from which end (the end nearest this point).
AXIS_CUTS = {
    "left_subclavian": ("FJ3479", (0.018, 1.385, 0.0), 36e-3),
    "left_pulmonary_artery": ("FJ2924", (0.03, 1.355, 0.02), 44e-3),
    "right_pulmonary_artery": ("FJ3019", (0.03, 1.355, 0.02), 62e-3),
    "right_superior_pulmonary_vein": ("FJ3020", (-0.013, 1.325, 0.0), 19e-3),
    "right_inferior_pulmonary_vein": ("FJ3040", (-0.006, 1.298, -0.017), 23e-3),
    "left_superior_pulmonary_vein": ("FJ2933", (0.034, 1.32, -0.003), 26e-3),
    "left_inferior_pulmonary_vein": ("FJ2955", (0.033, 1.3, -0.015), 26e-3),
}


def _fill(atlas, grid, ids):
    v, f = atlas.meshes(ids)
    lo, hi = np.maximum(v.min(0), grid.lo), np.minimum(v.max(0), grid.lo + np.array(grid.shape) * grid.h)
    sl, g = grid.crop(lo, hi)
    out = np.zeros(grid.shape, bool)
    out[sl] = solid(g, v, f)
    return out


def _dist(mask, pad=2):
    """Depth inside a mask, in voxels, only worked out inside its own box."""
    out = np.zeros(mask.shape, np.float32)
    if mask.any():
        sl = bbox(mask, pad)
        out[sl] = ndi.distance_transform_edt(mask[sl])
    return out


def _outdist(mask, region):
    """Distance outward from a mask inside a region's box, in voxels; far away everywhere else."""
    out = np.full(mask.shape, 1e6, np.float32)
    out[region] = ndi.distance_transform_edt(~mask[region])
    return out


def axis_cut(atlas, mesh, near, along):
    """A plane across a vessel, `along` metres down its measured centreline from the end nearest `near`."""
    v, f = atlas.mesh(mesh)
    p, _ = max(measure_tube(v, f, h_target=0.3e-3), key=lambda c: len(c[0]))
    if np.linalg.norm(p[0] - near) > np.linalg.norm(p[-1] - near):
        p = p[::-1]
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
    i = min(np.searchsorted(s, along), len(p) - 2)
    j, k = max(0, i - 12), min(len(p) - 1, i + 12)
    t = p[k] - p[j]
    return p[i], t / np.linalg.norm(t)


def valve_centre(atlas, ids):
    v, _ = atlas.meshes(ids)
    c = v.mean(0)
    u, s, w = np.linalg.svd(v - c, full_matrices=False)
    # The leaflets ring the orifice, so in the plane of the ring they sit at about the orifice's radius.
    radial = (v - c) - ((v - c) @ w[2])[:, None] * w[2]
    return c, w[2], float(np.percentile(np.linalg.norm(radial, axis=1), 80))


def assemble(atlas, log=print):
    """Fills the sources into the grid and works out lumens, tissue and which part owns each voxel of tissue."""
    t0 = time.time()
    grid = Grid(*BOX, H)
    log(f"grid {grid.shape} = {np.prod(grid.shape) / 1e6:.0f}M voxels")
    cav = {k: _fill(atlas, grid, [i]) for k, i in CAVITY.items()}
    measured = {k: float(c.sum() * H ** 3 * 1e6) for k, c in cav.items()}
    log("cavity mL " + " ".join(f"{k}={c:.0f}" for k, c in measured.items()))
    wall_v = _fill(atlas, grid, ["FJ2428"])
    wall_la = _fill(atlas, grid, ["FJ2438"])
    wall_ra = _fill(atlas, grid, ["FJ2439"])
    log(f"walls mL v={wall_v.sum() * H ** 3 * 1e6:.0f} la={wall_la.sum() * H ** 3 * 1e6:.0f} ra={wall_ra.sum() * H ** 3 * 1e6:.0f}")
    pap = {k: _fill(atlas, grid, i) for k, i in PAPILLARY.items()}
    outer = {k: _fill(atlas, grid, s[0]) for k, s in VESSELS.items()}

    # Where sources of different families overlap the deeper one keeps the space, so a lumen can never break through another vessel's wall.
    deepest = np.zeros(grid.shape, np.float32)
    owner = np.full(grid.shape, -1, np.int8)
    for i, fam in enumerate(FAMILIES):
        u = np.zeros(grid.shape, bool)
        for k in fam:
            u |= outer[k]
        sl = bbox(u, 4)
        # Neighbouring atlas pieces end in caps with a sliver between them; closing joins them into one vessel.
        u[sl] = ndi.binary_closing(u[sl], iterations=3)
        d = _dist(u)
        better = d > deepest
        deepest[better] = d[better]
        owner[better] = i
        if len(fam) > 1:
            # What the closing added goes to whichever piece is nearest.
            for k in fam:
                outer[k] = outer[k]
    del deepest, d
    log(f"owners {time.time() - t0:.0f}s")
    left = cav["la"] | cav["lv"]
    right = cav["ra"] | cav["rv"]
    # Only vessels that open into a chamber may carry their lumen through its wall. The others (the arch and its branches, the descending
    # aorta, the pulmonary arteries) merely lie against the heart, and where the atlas lets them overlap a chamber, the chamber's wall wins.
    chambers = wall_v | wall_la | wall_ra | ndi.binary_dilation(cav["la"] | cav["lv"] | cav["ra"] | cav["rv"], iterations=3)
    for i, fam in enumerate(FAMILIES):
        own = owner == i
        d = _dist(own)
        for k in fam:
            sl = bbox(outer[k], 6)
            near = ndi.binary_dilation(outer[k][sl], iterations=4)
            m = near & own[sl] & (d[sl] > VESSELS[k][1] / H)
            if k not in ENTER:
                m &= ~chambers[sl]
            (left if VESSELS[k][2] == "left" else right)[sl] |= m
    del d, own
    log(f"lumens {time.time() - t0:.0f}s")

    # The atria's and the great arteries' sources are closed bags, so each valve opening still has a skin across it. Tissue this thin
    # between two lumens of one circulation, inside the ring of the valve's leaflets, is that skin.
    def open_valve(a, b, ids, tau, grow=1.0):
        c, nrm, r = valve_centre(atlas, ids)
        r *= grow
        lo, hi = c - r - 4e-3, c + r + 4e-3
        sl, g = grid.crop(lo, hi)
        da = ndi.distance_transform_edt(~a[sl]).astype(np.float32) * H
        db = ndi.distance_transform_edt(~b[sl]).astype(np.float32) * H
        x, y, z = [g.lo[i] + np.arange(g.shape[i]) * H for i in range(3)]
        rr = (x[:, None, None] - c[0]) ** 2 + (y[None, :, None] - c[1]) ** 2 + (z[None, None, :] - c[2]) ** 2
        m = (da + db < tau) & (rr < r * r)
        log(f"valve opening: centre {np.round(c, 3)} r {r * 1e3:.1f} mm, {m.sum() * H ** 3 * 1e6:.2f} mL carved")
        return sl, m

    lv_lum = cav["lv"]
    sl, m = open_valve(cav["la"], cav["lv"], VALVES["mitral"], 5e-3)
    left[sl] |= m
    sl, m = open_valve(cav["ra"], cav["rv"], VALVES["tricuspid"], 5e-3)
    right[sl] |= m
    # The pulmonary trunk stops just short of the right ventricle's outflow, so that join gets the larger reach.
    pt_lum = np.zeros(grid.shape, bool)
    sl0 = bbox(outer["pulmonary_trunk"], 4)
    pt_lum[sl0] = outer["pulmonary_trunk"][sl0] & (ndi.distance_transform_edt(outer["pulmonary_trunk"][sl0]) > VESSELS["pulmonary_trunk"][1] / H)
    sl, m = open_valve(pt_lum, cav["rv"], VALVES["pulmonary"], 6.5e-3, grow=1.05)
    right[sl] |= m
    del pt_lum

    # The two circulations must never touch: the right side gives way wherever they come closer than a thin wall.
    near = ndi.distance_transform_edt(~left).astype(np.float32) * H
    right &= near > 1.2e-3
    del near
    log(f"circulations apart {time.time() - t0:.0f}s")

    # Tissue is everything that is neither lumen nor outside. Opening the outside first seals hairline cracks between sources.
    anything = left | right | wall_v | wall_la | wall_ra
    for m in list(pap.values()) + list(outer.values()):
        anything |= m
    lab, _ = ndi.label(~anything)
    outside = lab == lab[0, 0, 0]
    del lab, anything
    outside = ndi.binary_dilation(ndi.binary_erosion(outside, iterations=2), iterations=2, mask=outside)
    tissue = ~(outside | left | right)
    for m in pap.values():
        tissue |= m
    del outside
    log(f"tissue {tissue.sum() * H ** 3 * 1e6:.0f} mL, {time.time() - t0:.0f}s")

    # Who owns each voxel: the source it lies deepest in.
    label = np.zeros(grid.shape, np.uint8)
    best = np.zeros(grid.shape, np.float32)

    def claim(name, mask):
        d = _dist(mask)
        better = (d > best) & tissue
        label[better] = ID[name]
        best[better] = d[better]

    claim("left_atrium", wall_la)
    claim("right_atrium", wall_ra)
    for k in VESSELS:
        claim(k, outer[k])

    # The ventricular wall is one source. The septum is the wall that lies between both cavities; the free walls belong to the cavity
    # they enclose, weighted by how thick each wall is so that the border comes out at the interventricular grooves.
    sl = bbox(wall_v, 4)
    dl = ndi.distance_transform_edt(~cav["lv"][sl]).astype(np.float32) * H
    dr = ndi.distance_transform_edt(~cav["rv"][sl]).astype(np.float32) * H
    wv = wall_v[sl] & tissue[sl]
    depth_v = ndi.distance_transform_edt(wall_v[sl]).astype(np.float32)
    keep = wv & (depth_v >= best[sl] * 0.9)
    vent = np.where(dl / 11.0 < dr / 4.8, ID["left_ventricle"], ID["right_ventricle"]).astype(np.uint8)
    vent[(dl + dr < 13.5e-3) & (dr < 9e-3)] = ID["septum"]
    lsl = label[sl]
    lsl[keep] = vent[keep]
    label[sl] = lsl
    del dl, dr, vent, keep, depth_v, wv
    # Papillary muscles keep what stands inside the cavity; their roots merge into the wall.
    for k, m in pap.items():
        s2 = bbox(m, 2)
        mm = m[s2] & ~wall_v[s2]
        ll = label[s2]
        ll[mm & tissue[s2]] = ID[k]
        label[s2] = ll

    # Sealed cracks belong to no source: they join whichever part is next to them.
    left_over = tissue & (label == 0)
    sl = bbox(left_over, 12) if left_over.any() else None
    for _ in range(14):
        if sl is None or not left_over[sl].any():
            break
        g = ndi.maximum_filter(label[sl], size=3)
        hit = left_over[sl] & (g > 0)
        ll = label[sl]
        ll[hit] = g[hit]
        label[sl] = ll
        left_over[sl] &= ~hit
    log(f"labelled {time.time() - t0:.0f}s, unowned {int((tissue & (label == 0)).sum())}")

    # The cuts: a plane across each vessel removes only that vessel's own tissue beyond it.
    planes = dict(PLANE_CUTS)
    for k, (mesh, nearp, along) in AXIS_CUTS.items():
        planes[k] = axis_cut(atlas, mesh, np.asarray(nearp), along)
    x, y, z = [grid.lo[i] + np.arange(grid.shape[i]) * H for i in range(3)]
    beyond = np.zeros(grid.shape, bool)
    cutzone = np.zeros(grid.shape, bool)
    lumen = left | right
    for k, (p, n) in planes.items():
        own = label == ID[k]
        if not own.any():
            continue
        n = np.asarray(n, np.float64) / np.linalg.norm(n)
        idx = np.argwhere(own)
        q = grid.lo + idx * H - np.asarray(p, np.float64)
        rem = (q @ n) > 0
        i = idx[rem]
        # Where the vessel's source overlapped a chamber wall, that tissue is the wall's: a cut never opens a chamber.
        wall_here = np.zeros(len(i), np.uint8)
        for wid, wm in ((ID["left_atrium"], wall_la), (ID["right_atrium"], wall_ra), (ID["left_ventricle"], wall_v)):
            hit = wm[i[:, 0], i[:, 1], i[:, 2]] & (wall_here == 0)
            wall_here[hit] = wid
        gone = i[wall_here == 0]
        kept = i[wall_here > 0]
        label[kept[:, 0], kept[:, 1], kept[:, 2]] = wall_here[wall_here > 0]
        label[gone[:, 0], gone[:, 1], gone[:, 2]] = 0
        tissue[gone[:, 0], gone[:, 1], gone[:, 2]] = False
        # The vessel's own lumen past the cut is no longer inside the heart, though it stays lumen so the cut ring is crisp inside.
        # The vessel's own source decides what is its lumen, however far the source runs on past the cut.
        src = outer[k] | own
        sl = bbox(src, 3)
        reach = ndi.binary_dilation(src[sl], iterations=3)
        # Around each cut the lumen is meant to open to the air: that zone is left alone by seal() and the hole check.
        cq = np.argwhere(reach)
        if len(cq):
            pc = grid.lo + (cq + np.array([s.start for s in sl])) * H - np.asarray(p, np.float64)
            z = cq[np.abs(pc @ n) < 2.2e-3]
            cz = cutzone[sl]
            cz[z[:, 0], z[:, 1], z[:, 2]] = True
            cutzone[sl] = cz
        li = np.argwhere(lumen[sl] & reach)
        if len(li):
            q = grid.lo + (li + np.array([s.start for s in sl])) * H - np.asarray(p, np.float64)
            out = li[(q @ n) > 0]
            b = beyond[sl]
            b[out[:, 0], out[:, 1], out[:, 2]] = True
            beyond[sl] = b
    del lumen
    # A lumen beyond its cut belongs to nothing now, and anything cut loose is dropped.
    log(f"cut {time.time() - t0:.0f}s")
    lab, n = ndi.label(tissue)
    sizes = np.bincount(lab.ravel())
    sizes[0] = 0
    keep = sizes >= 0.002 * sizes.max()
    tissue = keep[lab]
    del lab
    label[~tissue] = 0
    # What remains of a lumen outside the cuts must not count as lumen for routes and shading.
    for name, m in (("left", left), ("right", right)):
        pass
    log(f"tissue after cuts {tissue.sum() * H ** 3 * 1e6:.0f} mL {time.time() - t0:.0f}s")
    # A lumen beyond its cut that is not joined to the heart's own lumens is outside too.
    for m in (left, right):
        lab, n = ndi.label(m & ~beyond)
        if n > 1:
            sizes = np.bincount(lab.ravel())
            sizes[0] = 0
            beyond |= m & (lab != sizes.argmax()) & (lab > 0)
    return dict(grid=grid, label=label, tissue=tissue, left=left, right=right, beyond=beyond, cutzone=cutzone, cav=cav, planes=planes, measured=measured)


def tissue_field(grid, tissue, left, right, beyond, sigma=1.1):
    """Tissue as a smooth signed field in voxels, positive inside. The outside and the lumens are each smoothed as their own surface,
    so a wall two voxels thin keeps its full thickness rather than blurring away into a hole."""
    lumen = (left | right) & ~tissue
    mass = tissue | (lumen & ~beyond)

    def signed(m):
        return ndi.distance_transform_edt(~m).astype(np.float32) - ndi.distance_transform_edt(m).astype(np.float32)

    dm = ndi.gaussian_filter(signed(mass), sigma)
    dl = ndi.gaussian_filter(signed(lumen), sigma * 0.9)
    return np.minimum(-dm + 0.5, dl - 0.5)


def spread_labels(label, tissue, reach=5):
    """Every voxel near tissue takes the label of the nearest tissue voxel, so a part's border only ever lies between parts."""
    sl = bbox(tissue, reach + 2)
    t = tissue[sl]
    d, ind = ndi.distance_transform_edt(~t, return_indices=True)
    ls = label[sl]
    out = np.zeros(label.shape, np.uint8)
    o = ls[ind[0], ind[1], ind[2]]
    o[d > reach] = 0
    out[sl] = o
    return out


def part_surface(grid, T, lab_ext, ids, target, overlap=0.35, smooth=6, log=print):
    """One part's closed surface from the shared tissue field, limited by the smoothed border of its own labels."""
    m = np.isin(lab_ext, ids)
    if not m.any():
        return None
    sl = bbox(m, 5)
    g = Grid.__new__(Grid)
    g.h, g.lo, g.shape = grid.h, grid.lo + np.array([s.start for s in sl]) * grid.h, m[sl].shape
    r = ndi.gaussian_filter(m[sl].astype(np.float32), 1.0)
    P = (r - 0.5) * 2.5 + overlap
    f = np.minimum(T[sl], P)
    from skimage import measure

    v, fc, _, _ = measure.marching_cubes(f, 0.0, spacing=(grid.h,) * 3, allow_degenerate=False)
    v = v + g.lo
    vol = np.einsum("ij,ij->i", v[fc[:, 0]], np.cross(v[fc[:, 1]], v[fc[:, 2]])).sum()
    if vol < 0:
        fc = fc[:, ::-1]
    fc = fc.astype(np.int64)
    v, fc = largest_components(v, fc, keep=1, min_faces=300)
    v = taubin(v, fc, steps=smooth)
    n0 = len(fc)
    v, fc = simplify(v, fc, target)
    return v, fc, n0


def seal(V, log=print, reach=3):
    """Gives every wall a minimum thickness: wherever a lumen comes within `reach` voxels of the open air, other than at a vessel's cut
    end, that lumen becomes wall. BodyParts3D's thinnest walls nearly coincide with their cavities, so without this a chamber can open
    straight onto the air."""
    grid, tissue, left, right, beyond, label = V["grid"], V["tissue"], V["left"], V["right"], V["beyond"], V["label"]
    lumen = (left | right) & ~tissue & ~beyond
    air = ~(tissue | lumen)
    m = lumen & (ndi.distance_transform_edt(~air) <= reach) & ~V["cutzone"]
    n = int(m.sum())
    if not n:
        log("seal: nothing to close")
        return
    sl = bbox(m, 6)
    ls = label[sl]
    known = ls > 0
    _, ind = ndi.distance_transform_edt(~known, return_indices=True)
    mm = m[sl]
    ls[mm] = ls[ind[0][mm], ind[1][mm], ind[2][mm]]
    label[sl] = ls
    tissue |= m
    left &= ~m
    right &= ~m
    log(f"seal: {n} voxels ({n * grid.h ** 3 * 1e6:.2f} mL) of lumen within {reach} voxels of the air became wall")
