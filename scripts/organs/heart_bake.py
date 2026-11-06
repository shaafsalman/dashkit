"""The heart's maps. Each part gets its own UV atlas, and every texel of it is worked out from the 3D point it stands for: a solid
texture, so there are no seams between charts or between neighbouring parts, and fibres run on across a border unbroken. Muscle fibres
are streaks of noise drawn out along the real fibre direction (a line integral of noise along it); fat is rounded lobules from the same
cells as its geometry; shadows come from how enclosed each point is. All of it is illustration laid on measured shapes."""
import os, pickle, time
import numpy as np
from numba import njit, prange
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree

from heart_field import tile, worley
from heart_vessels import fibre_direction

MAPS = {
    # part: base map size, roughness map size, look
    "left_ventricle": (2048, 1024, "ventricle"),
    "right_ventricle": (2048, 1024, "ventricle"),
    "septum": (1024, 512, "ventricle"),
    "left_atrium": (1536, 768, "atrium"),
    "right_atrium": (2048, 1024, "atrium"),
    "papillary_muscles": (1024, 512, "ventricle"),
    "aorta": (2048, 1024, "aorta"),
    "pulmonary_arteries": (1536, 768, "pulmonary"),
    "pulmonary_veins": (1024, 512, "pv"),
    "superior_vena_cava": (1024, 512, "cava"),
    "inferior_vena_cava": (1024, 512, "cava"),
    "epicardial_fat": (2048, 1024, "fat"),
    "mitral_valve": (1024, 512, "valve"),
    "tricuspid_valve": (1024, 512, "valve"),
    "aortic_valve": (512, 256, "valve"),
    "pulmonary_valve": (512, 256, "valve"),
}


# The atrial appendages, as boxes in atlas metres (where each atrium's wall reaches forward round the great arteries).
APPENDAGES = [((0.03, 1.314, 0.02), (0.066, 1.354, 0.054)), ((-0.03, 1.326, 0.032), (0.01, 1.36, 0.066))]

# ------------------------------------------------------------------------------------------- UV atlas and rasterising

def unwrap(v, f, size, log=print):
    import xatlas

    atlas = xatlas.Atlas()
    # In millimetres: in metres xatlas's own tolerances swallow the triangles and it packs a sliver of the image.
    atlas.add_mesh((v * 1000).astype(np.float32), f.astype(np.uint32))
    co = xatlas.ChartOptions()
    co.max_iterations = 2
    co.max_cost = 6.0
    po = xatlas.PackOptions()
    po.resolution = size
    po.padding = 4
    po.bilinear = True
    atlas.generate(co, po)
    vmap, idx, uv = atlas[0]
    return vmap.astype(np.int64), idx.astype(np.int64), uv.astype(np.float64)


@njit(cache=True)
def _raster(uvpx, f, W, H, tri, bary):
    for t in range(f.shape[0]):
        a, b, c = f[t, 0], f[t, 1], f[t, 2]
        ax, ay, bx, by, cx, cy = uvpx[a, 0], uvpx[a, 1], uvpx[b, 0], uvpx[b, 1], uvpx[c, 0], uvpx[c, 1]
        area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        if abs(area) < 1e-12:
            continue
        x0 = max(0, int(np.floor(min(ax, bx, cx))) - 1)
        x1 = min(W - 1, int(np.ceil(max(ax, bx, cx))) + 1)
        y0 = max(0, int(np.floor(min(ay, by, cy))) - 1)
        y1 = min(H - 1, int(np.ceil(max(ay, by, cy))) + 1)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                px, py = x + 0.5, y + 0.5
                w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area
                w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area
                w2 = 1.0 - w0 - w1
                inside = w0 >= -1e-4 and w1 >= -1e-4 and w2 >= -1e-4
                if inside:
                    tri[y, x] = t
                    bary[y, x, 0] = w0
                    bary[y, x, 1] = w1
                elif tri[y, x] < 0:
                    # Texels just outside a triangle still get its values, extrapolated, so filtering at chart edges reads true data.
                    m = min(w0, w1, w2)
                    if m > -0.9 and (bary[y, x, 2] == 0 or m > bary[y, x, 2] - 1.0):
                        tri[y, x] = -2 - t
                        bary[y, x, 0] = w0
                        bary[y, x, 1] = w1
                        bary[y, x, 2] = m + 1.0


class Texels:
    """Every texel of a part's atlas that a triangle covers, with its 3D point, normal and the surface's UV derivatives."""

    def __init__(self, v, n, f, uv, size):
        W = H = size
        uvpx = uv * np.array([W, H])
        tri = np.full((H, W), -1, np.int64)
        bary = np.zeros((H, W, 3), np.float64)
        _raster(uvpx, f, W, H, tri, bary)
        self.inside = tri >= 0
        edge = tri <= -2
        t = np.where(edge, -2 - tri, tri)
        self.mask = t >= 0
        ys, xs = np.nonzero(self.mask)
        tt = t[ys, xs]
        w0, w1 = bary[ys, xs, 0][:, None], bary[ys, xs, 1][:, None]
        w2 = 1 - w0 - w1
        a, b, c = f[tt, 0], f[tt, 1], f[tt, 2]
        self.ys, self.xs, self.tri = ys, xs, tt
        self.p = w0 * v[a] + w1 * v[b] + w2 * v[c]
        nn = w0 * n[a] + w1 * n[b] + w2 * n[c]
        self.n = nn / np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-12)
        e1, e2 = v[b] - v[a], v[c] - v[a]
        d1, d2 = uvpx[b] - uvpx[a], uvpx[c] - uvpx[a]
        det = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
        det = np.where(np.abs(det) < 1e-12, 1e-12, det)
        # Metres per texel along +x and +y of the image.
        self.pu = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / det[:, None]
        self.pv = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / det[:, None]
        self.size = size
        self.count = len(ys)

    def image(self, values, fill=None):
        """Values per texel into an image, with the empty space filled from the nearest texel, so mipmaps never bleed in a wrong colour."""
        values = np.asarray(values, np.float32)
        ch = 1 if values.ndim == 1 else values.shape[1]
        img = np.zeros((self.size, self.size, ch), np.float32)
        img[self.ys, self.xs] = values.reshape(len(values), ch)
        _, ind = ndi.distance_transform_edt(~self.mask, return_indices=True)
        img = img[ind[0], ind[1]]
        return img[..., 0] if ch == 1 else img


# ------------------------------------------------------------------------------------------- noise drawn out along fibres

@njit(parallel=True, cache=True)
def lic(t, p, d, scale, half, steps):
    """Averages a noise tile along a short line through each point, in the direction given: streaks that follow the fibres."""
    n = t.shape[0]
    out = np.empty(p.shape[0], np.float32)
    for q in prange(p.shape[0]):
        acc = 0.0
        wsum = 0.0
        for s in range(-steps, steps + 1):
            u = s / steps * half
            w = 1.0 - abs(s) / (steps + 1.0)
            x = (p[q, 0] + d[q, 0] * u) * scale
            y = (p[q, 1] + d[q, 1] * u) * scale
            z = (p[q, 2] + d[q, 2] * u) * scale
            ix, iy, iz = int(np.floor(x)), int(np.floor(y)), int(np.floor(z))
            fx, fy, fz = x - ix, y - iy, z - iz
            ix %= n
            iy %= n
            iz %= n
            jx, jy, jz = (ix + 1) % n, (iy + 1) % n, (iz + 1) % n
            val = (1 - fz) * ((1 - fy) * ((1 - fx) * t[ix, iy, iz] + fx * t[jx, iy, iz]) + fy * ((1 - fx) * t[ix, jy, iz] + fx * t[jx, jy, iz])) + fz * (
                (1 - fy) * ((1 - fx) * t[ix, iy, jz] + fx * t[jx, iy, jz]) + fy * ((1 - fx) * t[ix, jy, jz] + fx * t[jx, jy, jz])
            )
            acc += w * val
            wsum += w
        out[q] = acc / wsum
    return out


_TILES = {}


def noise_tile(seed, cell=3.0):
    key = (seed, cell)
    if key not in _TILES:
        t = tile(128, cell, seed)
        _TILES[key] = (t / t.std()).astype(np.float32)
    return _TILES[key]


def streaks(p, d, width, length, seed):
    """Fibre streaks about `width` across and `length` long, normalised to unit spread."""
    t = noise_tile(seed)
    scale = 3.0 / width  # the tile's features are about three cells wide
    steps = int(np.clip(length / width * 1.2, 3, 22))
    s = lic(t, p.astype(np.float64), d.astype(np.float64), scale, length / 2, steps)
    return (s - s.mean()) / max(s.std(), 1e-6)


def blobs(p, width, seed):
    t = noise_tile(seed)
    z = np.zeros_like(p)
    s = lic(t, p.astype(np.float64), z.astype(np.float64), 3.0 / width, 0.0, 1)
    return (s - s.mean()) / max(s.std(), 1e-6)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def ramp(t, stops):
    """A colour ramp over [0, 1]: stops are (position, (r, g, b)) in linear light."""
    pos = np.array([s[0] for s in stops])
    col = np.array([s[1] for s in stops])
    return np.stack([np.interp(t, pos, col[:, k]) for k in range(3)], 1)


# ------------------------------------------------------------------------------------------- what each texel knows about where it is

class Context:
    """Fields around the heart, sampled at texels: distance to the outside and to the lumens, how enclosed a point is, and the vessels."""

    def __init__(self, work, geo):
        f = np.load(os.path.join(work, "fields.npz"))
        self.lo, self.h = np.asarray(geo["lo"]), geo["h"]
        tissue, left, right, beyond = f["tissue"], f["left"], f["right"], f["beyond"]
        lumen = (left | right) & ~tissue
        mass = tissue | (lumen & ~beyond)
        ds = 2
        m = mass[::ds, ::ds, ::ds].astype(np.float32)
        self.dh = self.h * ds
        self.enclosed_near = ndi.gaussian_filter(m, 1.8)
        self.enclosed_far = ndi.gaussian_filter(m, 5.0)
        lum = lumen[::ds, ::ds, ::ds] & ~beyond[::ds, ::ds, ::ds]
        self.to_lumen = ndi.distance_transform_edt(~lum).astype(np.float32) * self.dh
        out = ~mass[::ds, ::ds, ::ds]
        self.to_outside = ndi.distance_transform_edt(~out).astype(np.float32) * self.dh
        # What lies just off each point of a surface tells which surface it is: open air means the outside, lumen means a lining,
        # other tissue means a face hidden against a neighbouring part.
        self.what = np.where(tissue, 1, np.where(left | right, 2, 0)).astype(np.uint8)
        del f
        vp, vr = [], []
        for trees in (geo["trees"], geo["fine"]):
            for branches in trees.values():
                for b in branches:
                    vp.append(b.pts)
                    vr.append(b.r)
        self.vp, self.vr = np.concatenate(vp), np.concatenate(vr)
        self.vtree = cKDTree(self.vp)
        self.axis, self.base = np.asarray(geo["axis"]), np.asarray(geo["base"])
        self.planes = geo["planes"]

    def sample(self, field, p):
        q = (p - self.lo) / self.dh
        return ndi.map_coordinates(field, q.T, order=1, mode="nearest")

    def facing(self, p, n, off=0.7e-3):
        """Per texel: weights for (outside, lining, hidden), from what lies just off the surface, averaged over two depths."""
        out = np.zeros((len(p), 3), np.float32)
        for o in (off * 0.6, off, off * 1.6):
            q = ((p + n * o) - self.lo) / self.h
            w = ndi.map_coordinates(self.what, q.T, order=0, mode="nearest")
            out[np.arange(len(p)), np.minimum(w, 2)[...]] += 1
        out = out[:, [0, 2, 1]] / 3.0
        return out

    def occlusion(self, p, n):
        """1 where open, falling toward 0 in creases and inside cavities."""
        a = self.sample(self.enclosed_near, p + n * 1.2e-3)
        b = self.sample(self.enclosed_far, p + n * 3e-3)
        return np.clip(1 - 1.25 * np.clip(a - 0.18, 0, 1) - 0.85 * np.clip(b - 0.3, 0, 1), 0.22, 1)

    def vessel_gap(self, p):
        d, i = self.vtree.query(p, distance_upper_bound=4e-3, workers=-1)
        r = np.r_[self.vr, 0][i]
        return np.where(np.isfinite(d), d - r, 4e-3), r


# ------------------------------------------------------------------------------------------- looks

def _atrial_direction(p, n, seed=3):
    """Atrial muscle runs in bundles that wander: a smooth random direction field laid into the surface."""
    out = []
    for k in range(3):
        out.append(blobs(p, 14e-3, seed + k))
    d = np.stack(out, 1) + np.array([0.0, 0.0, 1.4])
    d -= n * (d * n).sum(1, keepdims=True)
    return d / np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)


def muscle(tx, ctx, kind):
    p, n = tx.p, tx.n
    face = ctx.facing(p, n)
    epi, endo, cut = face[:, 0], face[:, 1], face[:, 2]  # outer surface, chamber lining, face hidden against a neighbour
    if kind == "atrium":
        d = _atrial_direction(p, n)
    else:
        d = fibre_direction(p, n, ctx.axis, ctx.base)
        # Inside, the fibres turn: along the long axis at the lining.
        a = ctx.axis - n * (n @ ctx.axis)[:, None]
        a /= np.maximum(np.linalg.norm(a, axis=1, keepdims=True), 1e-9)
        d = d * (1 - endo[:, None]) + a * endo[:, None]
        d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    bundle = streaks(p, d, 2.6e-3, 18e-3, 1)
    fasc = streaks(p, d, 0.75e-3, 7e-3, 2)
    fibre = streaks(p, d, 0.2e-3, 2.4e-3, 3)
    mott = blobs(p, 1.1e-3, 4)
    capill = np.clip(streaks(p, d, 0.12e-3, 0.9e-3, 5) - 1.3, 0, None)
    t = 0.52 + 0.11 * bundle + 0.09 * fasc + 0.06 * fibre + 0.035 * mott - 0.05 * capill
    if kind == "atrium":
        stops = [(0.0, (0.07, 0.004, 0.012)), (0.35, (0.2, 0.012, 0.03)), (0.6, (0.36, 0.024, 0.045)), (1.0, (0.56, 0.07, 0.08))]
    else:
        stops = [(0.0, (0.09, 0.003, 0.007)), (0.35, (0.27, 0.01, 0.016)), (0.6, (0.46, 0.022, 0.026)), (1.0, (0.68, 0.055, 0.05))]
    col = ramp(np.clip(t, 0, 1), stops)
    # The lining is pinker and paler, glistening; a cut face is the darker red of raw muscle.
    lining = ramp(np.clip(0.55 + 0.12 * fasc + 0.08 * fibre + 0.05 * mott, 0, 1), [(0.0, (0.2, 0.02, 0.025)), (0.5, (0.5, 0.075, 0.07)), (1.0, (0.72, 0.17, 0.15))])
    raw = ramp(np.clip(0.5 + 0.16 * fasc + 0.12 * fibre, 0, 1), [(0.0, (0.16, 0.006, 0.012)), (1.0, (0.42, 0.03, 0.035))])
    col = col * (1 - endo - cut)[:, None] + lining * endo[:, None] + raw * cut[:, None]
    occ = ctx.occlusion(p, n)
    occ = np.where(endo > 0.5, np.maximum(occ, 0.42), occ)
    gap, r = ctx.vessel_gap(p)
    contact = 1 - 0.5 * np.exp(-np.maximum(gap, 0) / (0.5 * r + 0.25e-3)) * (gap < 3.5e-3)
    col = col * (occ * contact)[:, None]
    # Low relief: under a wet film strong fibre bumps read as brushed metal. The fibres live mostly in the colour.
    h = 0.03e-3 * bundle + 0.011e-3 * fasc + 0.004e-3 * fibre - 0.006e-3 * capill
    if kind == "atrium":
        # The appendages are crinkled: folds a few millimetres apart, drawn here because their walls are too thin to fold in the volume.
        w = np.zeros(len(p))
        for lo, hi in APPENDAGES:
            lo, hi = np.asarray(lo), np.asarray(hi)
            inside = np.ones(len(p))
            for a in range(3):
                inside *= smoothstep(lo[a] - 3e-3, lo[a] + 3e-3, p[:, a]) * smoothstep(hi[a] + 3e-3, hi[a] - 3e-3, p[:, a])
            w = np.maximum(w, inside)
        folds = np.abs(blobs(p, 3.2e-3, 41)) * 0.7 + np.abs(blobs(p, 1.6e-3, 42)) * 0.3
        crease = np.clip(1 - folds * 1.1, 0, 1) ** 2
        h = h - w * epi * 0.32e-3 * crease
        col = col * (1 - 0.35 * (w * epi * crease))[:, None]
    h = h * (1 - cut) + 0.03e-3 * fibre * cut
    rough = np.clip(0.34 - 0.04 * fasc + 0.03 * mott - 0.08 * endo + 0.08 * cut, 0.16, 0.6)
    return col, h, rough


def fat(tx, ctx):
    p, n = tx.p, tx.n
    w1 = worley((p / 3.1e-3).astype(np.float64), 11)
    w2 = worley((p / 1.45e-3).astype(np.float64), 12)
    w3 = worley((p / 0.62e-3).astype(np.float64), 13)
    l1 = np.clip(1 - w1[:, 0] ** 2 / 0.62, 0, 1)
    l2 = np.clip(1 - w2[:, 0] ** 2 / 0.62, 0, 1)
    l3 = np.clip(1 - w3[:, 0] ** 2 / 0.7, 0, 1)
    # Septa between lobules: where the nearest two cells are about equally near.
    sep = smoothstep(0.16, 0.0, w2[:, 1] - w2[:, 0]) * 0.7 + smoothstep(0.1, 0.0, w1[:, 1] - w1[:, 0])
    mott = blobs(p, 2.2e-3, 14)
    t = np.clip(0.45 + 0.22 * l2 + 0.18 * l1 + 0.1 * l3 + 0.06 * mott - 0.35 * np.clip(sep, 0, 1), 0, 1)
    col = ramp(t, [(0.0, (0.3, 0.05, 0.012)), (0.3, (0.62, 0.22, 0.03)), (0.6, (0.84, 0.43, 0.07)), (1.0, (0.95, 0.64, 0.2))])
    # Fine vessels on the fat: thin red threads.
    cap = np.clip(streaks(p, _atrial_direction(p, n, 17), 0.1e-3, 1.4e-3, 15) - 1.5, 0, None)
    col = col * (1 - 0.6 * np.clip(cap, 0, 1))[:, None] + np.array([0.35, 0.03, 0.02]) * (0.6 * np.clip(cap, 0, 1))[:, None]
    # Where the fat thins out at its margins it lets the muscle colour through.
    to_out = ctx.sample(ctx.to_outside, p)
    occ = ctx.occlusion(p, n)
    gap, r = ctx.vessel_gap(p)
    contact = 1 - 0.45 * np.exp(-np.maximum(gap, 0) / (0.5 * r + 0.25e-3)) * (gap < 3.5e-3)
    # Shadows in fat go warm and ruddy, never olive.
    shade = np.clip(occ * contact, 0, 1)[:, None]
    col = col * shade ** np.array([0.8, 1.05, 1.5])
    h = 0.32e-3 * l2 + 0.18e-3 * l1 + 0.06e-3 * l3 - 0.08e-3 * np.clip(sep, 0, 1)
    rough = np.clip(0.24 - 0.05 * l2 + 0.08 * np.clip(sep, 0, 1) + 0.03 * mott, 0.12, 0.5)
    return col, h, rough


VESSEL_COLOURS = {
    "aorta": [(0.0, (0.12, 0.006, 0.01)), (0.45, (0.36, 0.022, 0.026)), (1.0, (0.62, 0.075, 0.07))],
    "pv": [(0.0, (0.14, 0.008, 0.012)), (0.45, (0.4, 0.03, 0.032)), (1.0, (0.66, 0.09, 0.08))],
    "pulmonary": [(0.0, (0.012, 0.02, 0.12)), (0.45, (0.04, 0.07, 0.34)), (1.0, (0.13, 0.2, 0.6))],
    "cava": [(0.0, (0.015, 0.02, 0.1)), (0.45, (0.05, 0.07, 0.3)), (1.0, (0.16, 0.2, 0.55))],
}


def vessel_wall(tx, ctx, look, axis_tree):
    p, n = tx.p, tx.n
    _, i = axis_tree[0].query(p, workers=-1)
    a = axis_tree[1][i]
    d = a - n * (a * n).sum(1, keepdims=True)
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    long = streaks(p, d, 0.35e-3, 6e-3, 21)
    fine = streaks(p, d, 0.12e-3, 2.5e-3, 22)
    patch = blobs(p, 6e-3, 23)
    mott = blobs(p, 1.0e-3, 24)
    # Vasa vasorum: a fine net of small vessels in the outer coat.
    side = np.cross(n, d)
    vv = np.clip(streaks(p, d * 0.5 + side * 0.86, 0.1e-3, 3e-3, 25) - 1.45, 0, None) + np.clip(streaks(p, d, 0.12e-3, 5e-3, 26) - 1.6, 0, None)
    vv = np.clip(vv, 0, 1)
    t = np.clip(0.55 + 0.08 * long + 0.05 * fine + 0.1 * patch + 0.04 * mott, 0, 1)
    col = ramp(t, VESSEL_COLOURS[look])
    deep = np.array([0.18, 0.005, 0.02]) if look in ("aorta", "pv") else np.array([0.02, 0.01, 0.12])
    col = col * (1 - 0.65 * vv)[:, None] + deep * (0.65 * vv)[:, None]
    face = ctx.facing(p, n)
    intima = face[:, 1]
    to_lumen = ctx.sample(ctx.to_lumen, p)
    inner = ramp(np.clip(0.5 + 0.1 * long + 0.06 * mott, 0, 1), [(0, (0.42, 0.16, 0.14)), (1, (0.8, 0.5, 0.44))] if look in ("aorta", "pv") else [(0, (0.22, 0.2, 0.36)), (1, (0.55, 0.5, 0.7))])
    # A cut end shows the wall's layers as fine rings.
    # A cut end: the flat face across the vessel at one of the cut planes.
    cutface = np.zeros(len(p), np.float32)
    for pp, nn in ctx.planes.values():
        nn = np.asarray(nn, float) / np.linalg.norm(nn)
        on = smoothstep(0.5e-3, 0.15e-3, np.abs((p - np.asarray(pp)) @ nn)) * smoothstep(0.8, 0.95, np.abs(n @ nn))
        cutface = np.maximum(cutface, on)
    cutface *= 1 - intima
    ring = 0.5 + 0.5 * np.sin(to_lumen / 0.16e-3 * np.pi)
    face = ramp(np.clip(0.45 + 0.25 * ring + 0.05 * mott, 0, 1), [(0, (0.5, 0.2, 0.18)), (1, (0.85, 0.6, 0.52))])
    col = col * (1 - intima - cutface)[:, None] + inner * intima[:, None] + face * cutface[:, None]
    occ = ctx.occlusion(p, n)
    col = col * occ[:, None]
    h = 0.012e-3 * long + 0.005e-3 * fine + 0.02e-3 * vv
    rough = np.clip(0.3 - 0.03 * long + 0.04 * mott - 0.1 * intima + 0.06 * cutface, 0.14, 0.6)
    return col, h, rough


def valve(tx, ctx, centre):
    p, n = tx.p, tx.n
    d = p - centre
    d -= n * (d * n).sum(1, keepdims=True)
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    radial = streaks(p, d, 0.25e-3, 5e-3, 31)
    fine = streaks(p, d, 0.1e-3, 2e-3, 32)
    mott = blobs(p, 1.5e-3, 33)
    t = np.clip(0.55 + 0.12 * radial + 0.06 * fine + 0.06 * mott, 0, 1)
    col = ramp(t, [(0, (0.42, 0.2, 0.17)), (0.5, (0.72, 0.46, 0.38)), (1, (0.9, 0.72, 0.62))])
    occ = ctx.occlusion(p, n)
    col = col * np.maximum(occ, 0.5)[:, None]
    h = 0.012e-3 * radial + 0.005e-3 * fine
    rough = np.clip(0.3 - 0.04 * radial, 0.15, 0.5)
    return col, h, rough


# ------------------------------------------------------------------------------------------- height into a tangent-space normal map

def normal_map(tx, h, strength=1.0):
    """The perturbed normal in the frame three.js builds from UV derivatives for a glTF mesh without tangents: +x along +u, +y toward
    the top of the image."""
    img = tx.image(h)
    mask = tx.mask
    hp = np.pad(img, 1, mode="edge")
    mp = np.pad(mask, 1)
    c = img

    def diff(axis):
        sl_plus = [slice(1, -1), slice(1, -1)]
        sl_minus = [slice(1, -1), slice(1, -1)]
        sl_plus[axis] = slice(2, None)
        sl_minus[axis] = slice(0, -2)
        up, dn = hp[tuple(sl_plus)], hp[tuple(sl_minus)]
        mu, md = mp[tuple(sl_plus)], mp[tuple(sl_minus)]
        g = np.where(mu & md, (up - dn) / 2, np.where(mu, up - c, np.where(md, c - dn, 0)))
        return g

    hx = diff(1)[tx.ys, tx.xs]
    hy = diff(0)[tx.ys, tx.xs]
    pu, pv, n = tx.pu, tx.pv, tx.n
    g11, g12, g22 = (pu * pu).sum(1), (pu * pv).sum(1), (pv * pv).sum(1)
    det = np.maximum(g11 * g22 - g12 * g12, 1e-30)
    i11, i12, i22 = g22 / det, -g12 / det, g11 / det
    grad = (i11 * hx + i12 * hy)[:, None] * pu + (i12 * hx + i22 * hy)[:, None] * pv
    grad -= n * (grad * n).sum(1, keepdims=True)
    n2 = n - grad * strength
    n2 /= np.linalg.norm(n2, axis=1, keepdims=True)
    T = pu - n * (pu * n).sum(1, keepdims=True)
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-20)
    B = -(pv - n * (pv * n).sum(1, keepdims=True))
    B /= np.maximum(np.linalg.norm(B, axis=1, keepdims=True), 1e-20)
    x, y, z = (n2 * T).sum(1), (n2 * B).sum(1), (n2 * n).sum(1)
    out = np.stack([x, y, np.maximum(z, 0.05)], 1)
    out /= np.linalg.norm(out, axis=1, keepdims=True)
    return out


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def save_webp(img, path, q):
    a = np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8)
    if a.ndim == 2:
        a = np.stack([a] * 3, -1)
    Image.fromarray(a).save(path, "WEBP", quality=q, method=6)
    return os.path.getsize(path)


def vertex_normals(v, f):
    from heart_field import vertex_normals as vn

    return vn(v, f)


def great_vessel_axes(atlas_dir):
    """Centrelines of the great vessels, with their directions, so the walls' fibres can run along each vessel."""
    from heart_src import Atlas
    from heart_vessels import measure_tube, smooth_chain
    from heart_volume import VESSELS

    A = Atlas(atlas_dir)
    pts, dirs = [], []
    for k, (ids, _, _) in VESSELS.items():
        v, f = A.meshes(ids)
        for p, r in measure_tube(v, f, h_target=0.35e-3):
            if len(p) < 6:
                continue
            # A thinned voxel chain steps along the grid axes; a fitted spline gives the vessel's true direction.
            p, _ = smooth_chain(p, r, spacing=0.6e-3, s_factor=4.0)
            p = ndi.gaussian_filter1d(p, 6, axis=0, mode="nearest")
            d = np.gradient(p, axis=0)
            d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-12)
            pts.append(p)
            dirs.append(d)
    return np.concatenate(pts), np.concatenate(dirs)


def bake_all(work, log=print, only=None, atlas_dir=None):
    geo = pickle.load(open(os.path.join(work, "geometry.pkl"), "rb"))
    t0 = time.time()
    ctx = Context(work, geo)
    log(f"bake context {time.time() - t0:.0f}s")
    axes_path = os.path.join(work, "vessel_axes.npz")
    if not os.path.exists(axes_path):
        atlas_dir = atlas_dir or os.environ.get("HEART_ATLAS")
        pa, da = great_vessel_axes(atlas_dir)
        np.savez(axes_path, p=pa, d=da)
    ax = np.load(axes_path)
    axis_tree = (cKDTree(ax["p"]), ax["d"])
    from heart_volume import VALVES, valve_centre
    from heart_src import Atlas

    centres = {}
    out_dir = os.path.join(work, "maps")
    os.makedirs(out_dir, exist_ok=True)
    baked = {}
    for pid, (size, rsize, look) in MAPS.items():
        if only and pid not in only:
            continue
        part = geo["parts"].get(pid)
        if part is None:
            continue
        t1 = time.time()
        v, f = part["v"], part["f"]
        vmap, idx, uv = unwrap(v, f, size)
        v2 = v[vmap]
        n2 = vertex_normals(v2, idx)
        tx = Texels(v2, n2, idx, uv, size)
        if look in ("ventricle", "atrium"):
            col, h, rough = muscle(tx, ctx, look)
        elif look == "fat":
            col, h, rough = fat(tx, ctx)
        elif look == "valve":
            col, h, rough = valve(tx, ctx, v.mean(0))
        else:
            col, h, rough = vessel_wall(tx, ctx, look, axis_tree)
        nm = normal_map(tx, h)
        base = to_srgb(tx.image(col))
        nimg = tx.image(nm * 0.5 + 0.5)
        rimg = tx.image(rough)
        if rsize != size:
            rimg = np.asarray(Image.fromarray((np.clip(rimg, 0, 1) * 255).astype(np.uint8)).resize((rsize, rsize), Image.LANCZOS), np.float32) / 255
        sizes = (
            save_webp(base, os.path.join(out_dir, f"{pid}_base.webp"), 84),
            save_webp(nimg, os.path.join(out_dir, f"{pid}_normal.webp"), 86),
            save_webp(rimg, os.path.join(out_dir, f"{pid}_rough.webp"), 70),
        )
        baked[pid] = dict(v=v2, f=idx, uv=uv, n=n2)
        log(f"  {pid}: {len(idx)} faces, {tx.count / size ** 2 * 100:.0f}% of {size}px used, maps {sum(sizes) / 1e6:.2f} MB, {time.time() - t1:.0f}s")
    path = os.path.join(work, "baked.pkl")
    prev = pickle.load(open(path, "rb")) if os.path.exists(path) and only else {}
    prev.update(baked)
    pickle.dump(prev, open(path, "wb"))
    log(f"bake done in {time.time() - t0:.0f}s")
