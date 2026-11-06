"""What makes the solid more than a smoothed-over atlas shape: trabeculae and pectinate muscles inside the chambers, the crista terminalis,
the moderator band, the fossa ovalis, crinkled atrial appendages, grooves under the coronaries, and lobulated fat in those grooves. All of
it is drawn into the volume, so the surfaces stay closed. The atlas gives the shapes; this relief is illustration, built on general anatomy."""
import numpy as np
from scipy import ndimage as ndi
from scipy.spatial import cKDTree

from heart_field import Grid, bbox, sample, tile, worley
from heart_volume import H, ID


def _world(grid, sl):
    x, y, z = [grid.lo[i] + (np.arange(s.start, s.stop)) * grid.h for i, s in enumerate(sl)]
    return x, y, z


def _points(grid, idx, sl):
    return grid.lo + (idx + np.array([s.start for s in sl])) * grid.h


def _noise(seed, cell=3.2, n=96):
    t = tile(n, cell, seed)
    return t / t.std()


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _claim(grid, label, tissue, sl, new, sources):
    """New tissue joins whichever of the given parts is nearest."""
    ls = label[sl]
    keep = np.isin(ls, sources)
    ind = ndi.distance_transform_edt(~keep, return_distances=False, return_indices=True)
    ls[new] = ls[ind[0][new], ind[1][new], ind[2][new]]
    label[sl] = ls
    t = tissue[sl]
    t[new] = True
    tissue[sl] = t


def trabeculae(grid, V, axis, base, log=print):
    """Ridges and bridges of muscle standing off the ventricles' inner walls, running with the long axis and crossing into a net toward
    the apex. The upper septum and the outflow tracts stay smooth, as they do in life."""
    label, tissue = V["label"], V["tissue"]
    a = np.asarray(axis)
    t1, t2 = _noise(21), _noise(22)
    # A second family of ridges slants across the first, which is what closes them into a net.
    slant = a + np.array([0.75, 0.1, -0.45])
    slant /= np.linalg.norm(slant)
    for name, cavity, sources, reach, height, across in (
        ("lv", V["cav"]["lv"], [ID["left_ventricle"], ID["septum"]], (0.30, 0.62), 4.6e-3, 2.9e-3),
        ("rv", V["cav"]["rv"], [ID["right_ventricle"], ID["septum"]], (0.12, 0.45), 6.2e-3, 3.6e-3),
    ):
        sl = bbox(cavity, 4)
        cav = cavity[sl] & ~tissue[sl]
        d = ndi.distance_transform_edt(~tissue[sl]).astype(np.float32) * H
        idx = np.argwhere(cav & (d < height))
        p = _points(grid, idx, sl)
        s = (p - base) @ a
        L = s.max()
        hmap = height * smoothstep(reach[0] * L, reach[1] * L, s)
        c = t1.shape[0] / (across * 4)  # tile features span about four tile cells of the tile's smoothing
        q1 = (p - (s[:, None] * a) * 0.76) * c
        s2 = p @ slant
        q2 = (p - (s2[:, None] * slant) * 0.72) * c * 1.15
        v = np.maximum(sample(t1, q1.astype(np.float64)), 0.85 * sample(t2, q2.astype(np.float64)))
        dd = d[idx[:, 0], idx[:, 1], idx[:, 2]]
        depth = dd / np.maximum(hmap, 1e-5)
        solid = (v > -0.45 + 1.75 * depth) & (hmap > 0.5e-3)
        new = np.zeros(cav.shape, bool)
        new[idx[solid, 0], idx[solid, 1], idx[solid, 2]] = True
        _claim(grid, label, tissue, sl, new, sources)
        log(f"trabeculae {name}: {new.sum() * H ** 3 * 1e6:.1f} mL")


def capsules(grid, tissue_like, pts, radii):
    """Voxels within a chain of capsules, as a mask limited to the chain's box."""
    pts, radii = np.asarray(pts), np.asarray(radii)
    lo, hi = pts.min(0) - radii.max(), pts.max(0) + radii.max()
    sl, g = grid.crop(lo, hi, 2)
    x, y, z = [g.lo[i] + np.arange(g.shape[i]) * g.h for i in range(3)]
    q = np.stack(np.meshgrid(x, y, z, indexing="ij"), -1).reshape(-1, 3)
    d, i = cKDTree(pts).query(q)
    return sl, (d < radii[i]).reshape(g.shape)


def moderator_band(grid, V, atlas, log=print):
    """The septomarginal band: a cord of muscle crossing the right ventricle from the septum to the anterior papillary muscle."""
    label, tissue, right = V["label"], V["tissue"], V["right"]
    v, _ = atlas.mesh("FJ2419")
    c = v.mean(0)
    near = v[np.argmin(v[:, 1])]  # the muscle's foot, where the band reaches it
    target = c * 0.5 + near * 0.5
    idx = np.argwhere(label == ID["septum"])
    p = grid.lo + idx[:: 11] * grid.h
    # The nearest septum across the cavity.
    i = np.argmin(np.linalg.norm(p - target, axis=1))
    start = p[i]
    t = np.linspace(0, 1, 40)[:, None]
    mid = (start + target) / 2 + np.array([0, -0.004, 0])
    pts = (1 - t) ** 2 * start + 2 * t * (1 - t) * mid + t ** 2 * target
    sl, m = capsules(grid, tissue, pts, np.full(len(pts), 1.9e-3))
    m &= ~tissue[sl]
    _claim(grid, label, tissue, sl, m, [ID["septum"], ID["papillary_right"]])
    log(f"moderator band {np.linalg.norm(target - start) * 1e3:.0f} mm long")


def pectinate(grid, V, log=print):
    """Parallel ridges on the right atrium's front wall and in both appendages, and the crista terminalis where they begin."""
    label, tissue = V["label"], V["tissue"]
    t1 = _noise(31)
    cav = V["cav"]["ra"]
    sl = bbox(cav, 4)
    x, y, z = _world(grid, sl)
    c = np.array([np.average(x, weights=cav[sl].sum((1, 2))), np.average(y, weights=cav[sl].sum((0, 2))), np.average(z, weights=cav[sl].sum((0, 1)))])
    inside = cav[sl] & ~tissue[sl]
    d = ndi.distance_transform_edt(~tissue[sl]).astype(np.float32) * H
    idx = np.argwhere(inside & (d < 2.4e-3))
    p = _points(grid, idx, sl)
    e = np.array([0.15, -0.55, 0.82])
    e /= np.linalg.norm(e)
    s = p @ e
    k = t1.shape[0] / (3.6e-3 * 4)
    q = (p - s[:, None] * e * 0.82) * k
    v = sample(t1, q.astype(np.float64))
    # Only the wall facing front and to the side carries them: the back is the smooth sinus venarum.
    face = (p - c) @ (np.array([-0.45, 0.0, 0.89]))
    w = smoothstep(-0.002, 0.012, face)
    depth = d[idx[:, 0], idx[:, 1], idx[:, 2]] / 2.4e-3
    solid = (v > -0.3 + 1.6 * depth) & (w > 0.5)
    new = np.zeros(inside.shape, bool)
    new[idx[solid, 0], idx[solid, 1], idx[solid, 2]] = True
    # The crista terminalis: a ridge down the front-side wall between the two venae cavae, found by walking out from the centre.
    pts = []
    for yy in np.linspace(c[1] + 0.032, c[1] - 0.028, 30):
        o = np.array([c[0], yy, c[2]])
        dirn = np.array([-0.62, 0, 0.78])
        last = None
        for r in np.arange(0, 0.05, 0.0006):
            q0 = o + dirn * r
            i = np.round(grid.index(q0)).astype(int)
            if np.any(i < 0) or np.any(i >= np.array(grid.shape)):
                break
            if cav[tuple(i)] and not tissue[tuple(i)]:
                last = q0
            elif last is not None:
                break
        if last is not None:
            pts.append(last)
    if len(pts) > 6:
        pts = ndi.gaussian_filter1d(np.array(pts), 2, axis=0, mode="nearest")
        t = np.linspace(0, 1, 160)
        tt = np.linspace(0, 1, len(pts))
        pts = np.stack([np.interp(t, tt, pts[:, a]) for a in range(3)], 1)
        sl2, m = capsules(grid, tissue, pts, np.full(len(pts), 2.1e-3))
        m &= ~tissue[sl2]
        sub = tuple(slice(s2.start - s0.start, s2.stop - s0.start) for s2, s0 in zip(sl2, sl))
        lo_ok = all(s.start >= 0 for s in sub)
        if lo_ok:
            new[sub] |= m[tuple(slice(0, n[1] - n[0]) for n in [(ss.start, ss.stop) for ss in sub])][: new[sub].shape[0], : new[sub].shape[1], : new[sub].shape[2]]
    _claim(grid, label, tissue, sl, new, [ID["right_atrium"]])
    log(f"pectinate muscles and crista: {new.sum() * H ** 3 * 1e6:.1f} mL")


def fossa_ovalis(grid, V, log=print):
    """A shallow oval hollow on the right side of the wall between the atria, with its raised rim, where the foramen ovale once was."""
    label, tissue, left, right = V["label"], V["tissue"], V["left"], V["right"]
    ra, la = V["cav"]["ra"], V["cav"]["la"]
    sl = bbox(ra, 2)
    dl = ndi.distance_transform_edt(~la[sl]).astype(np.float32) * H
    dr = ndi.distance_transform_edt(~ra[sl]).astype(np.float32) * H
    ls = label[sl]
    wall = (ls == ID["right_atrium"]) | (ls == ID["left_atrium"])
    thin = wall & (dr + dl < 7e-3)
    idx = np.argwhere(thin)
    if not len(idx):
        log("fossa ovalis: no thin septum found")
        return
    p = _points(grid, idx, sl)
    c = np.median(p, axis=0)
    i = np.argmin(np.linalg.norm(p - c, axis=1))
    c = p[i]
    x, y, z = _world(grid, sl)
    q = np.stack(np.meshgrid(x, y, z, indexing="ij"), -1) - c
    # An oval, longer up and down.
    rr = np.sqrt((q[..., 1] / 11e-3) ** 2 + (q[..., 0] / 8e-3) ** 2 + (q[..., 2] / 8e-3) ** 2)
    dig = (rr < 1.0) & (dr < 1.6e-3 * np.clip((1.05 - rr) / 0.25, 0, 1)) & (dl > 0.9e-3) & tissue[sl]
    rim = (rr > 1.0) & (rr < 1.28) & (dr < 1.3e-3) & ra[sl] & ~tissue[sl]
    t = tissue[sl]
    t[dig] = False
    tissue[sl] = t
    ls = label[sl]
    ls[dig] = 0
    label[sl] = ls
    r = right[sl]
    r[dig] = True
    right[sl] = r
    _claim(grid, label, tissue, sl, rim, [ID["right_atrium"], ID["left_atrium"]])
    r = right[sl]
    r[rim] = False
    right[sl] = r
    log(f"fossa ovalis at {np.round(c, 3)}: dug {dig.sum() * H ** 3 * 1e6:.2f} mL, rim {rim.sum() * H ** 3 * 1e6:.2f} mL")


def crinkle(grid, V, name, region, seed, amp=0.85e-3, log=print):
    """Folds an atrial appendage: the space around it is bent by a smooth twist a few millimetres across, so wall and cavity fold together
    and the wall stays whole. `region` gives the appendage as (lower corner, upper corner) in metres, with soft edges."""
    label, tissue, left, right = V["label"], V["tissue"], V["left"], V["right"]
    lo, hi = np.asarray(region[0]), np.asarray(region[1])
    sl, g = grid.crop(lo - 4e-3, hi + 4e-3, 0)
    x, y, z = [g.lo[i] + np.arange(g.shape[i]) * g.h for i in range(3)]
    q = np.stack(np.meshgrid(x, y, z, indexing="ij"), -1)
    w = np.ones(g.shape, np.float32)
    for a in range(3):
        w *= smoothstep(lo[a] - 3e-3, lo[a] + 2e-3, q[..., a]) * smoothstep(hi[a] + 3e-3, hi[a] - 2e-3, q[..., a])
    w *= ndi.gaussian_filter((label[sl] == ID[name]).astype(np.float32), 6) > 0.02
    w = ndi.gaussian_filter(w.astype(np.float32), 3)
    qf = q.reshape(-1, 3)
    coords = np.indices(g.shape, dtype=np.float32)
    tiles = [_noise(seed + k) for k in range(6)]
    for k in range(3):
        # Folds several millimetres across: anything finer would push through a wall this thin and leave holes. The fine
        # crinkle is in the normal map instead.
        coarse = sample(tiles[k], (qf * (96 / 4 / 10e-3)).astype(np.float64)).reshape(g.shape)
        mid = sample(tiles[k + 3], (qf * (96 / 4 / 6.5e-3)).astype(np.float64)).reshape(g.shape)
        coords[k] += w * (amp / grid.h) * (0.75 * coarse + 0.35 * mid) / 1.1
    for arr in (tissue, left, right):
        arr[sl] = ndi.map_coordinates(arr[sl].astype(np.float32), coords, order=1, mode="nearest") > 0.5
    label[sl] = ndi.map_coordinates(label[sl], coords, order=0, mode="nearest")
    t = tissue[sl]
    ls = label[sl]
    # A voxel the warp made tissue but that came from a lumen takes the label of the wall beside it.
    ls[~t] = 0
    label[sl] = ls
    missing = t & (ls == 0)
    if missing.any():
        _claim(grid, label, tissue, sl, missing, [ID[name]])
    log(f"crinkle {name}: {float((w > 0.5).sum() * H ** 3 * 1e6):.1f} mL folded")


def carve_grooves(grid, V, trees, surface_cls, log=print):
    """Presses the larger coronaries into the surface: the outer wall dips under each, so they lie in a groove and not on top."""
    label, tissue, left, right = V["label"], V["tissue"], V["left"], V["right"]
    pts, rad = [], []
    for branches in trees.values():
        for b in branches:
            if b.part == "septal_perforators":
                continue
            pts.append(b.pts[::2])
            rad.append(b.r[::2])
    pts, rad = np.concatenate(pts), np.concatenate(rad)
    mass = tissue | ((left | right) & ~V["beyond"])
    dist = (ndi.distance_transform_edt(mass).astype(np.float32)) * H
    idx = np.argwhere(mass & (dist < 3.5e-3))
    p = grid.lo + idx * H
    tree = cKDTree(pts)
    d, i = tree.query(p, distance_upper_bound=6e-3, workers=-1)
    ok = np.isfinite(d)
    r = rad[np.minimum(i, len(rad) - 1)]
    depth = np.where(ok, np.minimum(r * 0.85, 1.6e-3) * np.exp(-((d / (1.7 * r + 0.55e-3)) ** 2)), 0)
    cut = dist[idx[:, 0], idx[:, 1], idx[:, 2]] < depth
    # A groove never thins a wall to less than about a millimetre over a chamber or vessel: atrial walls are that thin.
    lumen = (left | right) & ~tissue
    to_lumen = ndi.distance_transform_edt(~lumen).astype(np.float32) * H
    cut &= to_lumen[idx[:, 0], idx[:, 1], idx[:, 2]] > depth + 1.2e-3
    del to_lumen
    c = idx[cut]
    # Only outer tissue may be pressed in: nothing is opened into a lumen.
    keep = tissue[c[:, 0], c[:, 1], c[:, 2]]
    c = c[keep]
    tissue[c[:, 0], c[:, 1], c[:, 2]] = False
    label[c[:, 0], c[:, 1], c[:, 2]] = 0
    log(f"grooves: {len(c) * H ** 3 * 1e6:.2f} mL pressed in")


# How much fat each vessel carries: thickness (m) and half-width (m) at its start and its far end. The atrioventricular and interventricular
# grooves carry the most; it thins toward the apex and only follows branches near their origin.
FAT_GUIDES = {
    "rca": (3.0e-3, 2.6e-3, 11e-3, 9e-3),
    "circumflex": (3.0e-3, 2.4e-3, 11e-3, 8e-3),
    "great_cardiac_vein": (2.8e-3, 2.4e-3, 10e-3, 8e-3),
    "coronary_sinus": (2.6e-3, 2.2e-3, 10e-3, 8e-3),
    "small_cardiac_vein": (2.0e-3, 1.5e-3, 7e-3, 5e-3),
    "left_main": (3.0e-3, 2.8e-3, 9e-3, 9e-3),
    "lad": (2.8e-3, 0.6e-3, 7.5e-3, 3e-3),
    "anterior_interventricular_vein": (2.2e-3, 0.5e-3, 6e-3, 2.5e-3),
    "pda": (2.2e-3, 0.5e-3, 6.5e-3, 3e-3),
    "middle_cardiac_vein": (2.2e-3, 0.5e-3, 6e-3, 2.5e-3),
    "acute_marginal": (2.0e-3, 0.2e-3, 6e-3, 2.0e-3),
    "diagonals": (1.2e-3, 0.0, 3.4e-3, 1.2e-3),
    "obtuse_marginals": (1.2e-3, 0.0, 3.4e-3, 1.2e-3),
    "rca_anterior_branches": (1.3e-3, 0.0, 3.6e-3, 1.2e-3),
    "conus_artery": (1.8e-3, 0.3e-3, 5e-3, 2.5e-3),
    "lad_right_branches": (1.0e-3, 0.0, 3e-3, 1.2e-3),
    "posterolateral_branches": (1.1e-3, 0.0, 3.2e-3, 1.2e-3),
}


def fat_field(grid, V, trees, parts_near, log=print):
    """Epicardial fat as real volume: a blanket on the heart whose thickness follows the coronary grooves, broken into rounded lobules. It
    thins at its edges until only the tops of lobules are left, so it has an irregular margin, and it dips into a channel along each
    vessel so that the vessels stay in view."""
    tissue, left, right = V["tissue"], V["left"], V["right"]
    lumen = (left | right) & ~tissue
    mass = tissue | (lumen & ~V["beyond"])
    dout = ndi.distance_transform_edt(~mass).astype(np.float32) * H
    dinn = ndi.distance_transform_edt(mass).astype(np.float32) * H
    D = dout - dinn
    del dout, dinn
    D = ndi.gaussian_filter(D, 1.0)
    idx = np.argwhere((D > -1.4e-3) & (D < 6.5e-3))
    p = grid.lo + idx * H
    gp, gt, gw = [], [], []
    for branches in trees.values():
        for b in branches:
            g = FAT_GUIDES.get(b.part)
            if g is None:
                continue
            s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(b.pts, axis=0), axis=1))]
            # Thickness falls along the vessel; side chains of a part begin where their parent leaves off, roughly.
            # Grooves keep their fat along their length; on branches it fades out within about two centimetres.
            u = np.clip(s / (max(0.075, s[-1]) if g[0] >= 2.0e-3 else 0.02), 0, 1)
            gp.append(b.pts[::2])
            gt.append((g[0] + (g[1] - g[0]) * u)[::2])
            gw.append((g[2] + (g[3] - g[2]) * u)[::2])
    gp, gt, gw = np.concatenate(gp), np.concatenate(gt), np.concatenate(gw)
    tree = cKDTree(gp)
    dd, ii = tree.query(p, k=6, distance_upper_bound=13e-3, workers=-1)
    gt2, gw2 = np.r_[gt, 0], np.r_[gw, 1]
    falloff = np.clip(1 - (dd / gw2[ii]) ** 2, 0, 1)
    falloff[~np.isfinite(dd)] = 0
    T = (gt2[ii] * falloff).max(1)
    log(f"fat: {len(p) / 1e6:.1f}M voxels in the band, guide points {len(gp)}")
    # An uneven margin, so it never reads as a soft halo.
    big = _noise(41)
    edge = sample(big, (p * (96 / 26e-3)).astype(np.float64))
    T = T * (1 + 0.42 * edge)
    # Lobules: rounded cells at two sizes.
    w1 = worley((p / 3.6e-3).astype(np.float64), 11)
    w2 = worley((p / 1.8e-3).astype(np.float64), 12)
    lob1 = np.clip(1 - w1[:, 0] ** 2 / 0.62, 0, 1)
    lob2 = np.clip(1 - w2[:, 0] ** 2 / 0.62, 0, 1)
    # Rounded lobules a few millimetres across; finer ones are drawn in the maps, where the voxels cannot reach.
    top = T * 0.64 + np.minimum(T * 1.6, 1.2e-3) * (lob1 - 0.52) * 1.3 + np.minimum(T, 0.45e-3) * (lob2 - 0.5) * 0.45
    # The channel: fat rises from each vessel's edge at about forty-five degrees.
    vp, vr = [], []
    for branches in trees.values():
        for b in branches:
            if b.part == "septal_perforators":
                continue
            vp.append(b.pts[::2])
            vr.append(b.r[::2])
    vp, vr = np.concatenate(vp), np.concatenate(vr)
    d2, i2 = cKDTree(vp).query(p, distance_upper_bound=6e-3, workers=-1)
    r2 = np.r_[vr, 0][i2]
    bank = np.where(np.isfinite(d2), np.maximum(d2 - r2, 0) * 0.9 + r2 * 0.45, 1e3)
    top = np.minimum(top, bank)
    F = np.zeros(grid.shape, np.float32)
    Dp = D[idx[:, 0], idx[:, 1], idx[:, 2]]
    # Its floor lies a little inside the muscle where the fat is thick and rises to the surface where it thins out, so there is no fat
    # where no vessel asks for it, not even a hidden skin.
    floor = np.clip(T * 0.45 - 0.15e-3, -0.2e-3, 1.0e-3)
    F[idx[:, 0], idx[:, 1], idx[:, 2]] = np.clip(0.5 + np.minimum(top - Dp, Dp + floor) / (2.4 * H), 0, 1)
    # Hold it to the band: under the band's inner edge it simply ends, hidden inside the muscle.
    F[D < -1.2e-3] = 0
    F[lumen] = 0
    F = ndi.gaussian_filter(F, 0.6)
    return F, D


def fat_mass(grid, F):
    return float((F > 0.5).sum() * H ** 3 * 1e6)
