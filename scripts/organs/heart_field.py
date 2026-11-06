"""Volume tools for the heart build: closed meshes into solid grids, signed distances, noise and smooth surfaces. Everything here runs on
the build's own Python (numpy, scipy, scikit-image, numba), not Blender's."""
import numpy as np
from numba import njit, prange
from scipy import ndimage as ndi
from skimage import measure


class Grid:
    """A box of voxels in metres. Index (i, j, k) is the voxel centred at lo + (i, j, k) * h. The origin is nudged off round numbers so
    a ray never lands exactly on a mesh edge when filling."""

    def __init__(self, lo, hi, h):
        self.h = float(h)
        self.lo = np.asarray(lo, np.float64) + np.array([1.37e-6, 2.11e-6, 0.73e-6])
        self.shape = tuple(int(n) for n in np.ceil((np.asarray(hi) - self.lo) / self.h).astype(int) + 1)

    def crop(self, lo, hi, pad=4):
        """The slice of this grid around a box, and the grid of that slice."""
        a = np.maximum(np.floor((np.asarray(lo) - self.lo) / self.h).astype(int) - pad, 0)
        b = np.minimum(np.ceil((np.asarray(hi) - self.lo) / self.h).astype(int) + pad + 1, np.array(self.shape))
        g = Grid.__new__(Grid)
        g.h, g.lo, g.shape = self.h, self.lo + a * self.h, tuple((b - a).tolist())
        return (slice(a[0], b[0]), slice(a[1], b[1]), slice(a[2], b[2])), g

    def world(self, idx):
        return self.lo + np.asarray(idx) * self.h

    def index(self, p):
        return (np.asarray(p) - self.lo) / self.h


@njit(cache=True)
def _crossings(v, f, lo, h, nx, ny, nz):
    w = np.zeros((nx, ny, nz + 1), np.int16)
    for t in range(f.shape[0]):
        a, b, c = v[f[t, 0]], v[f[t, 1]], v[f[t, 2]]
        area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        if area == 0.0:
            continue
        s = 1.0 if area > 0 else -1.0
        i0 = max(0, int(np.ceil((min(a[0], b[0], c[0]) - lo[0]) / h)))
        i1 = min(nx - 1, int(np.floor((max(a[0], b[0], c[0]) - lo[0]) / h)))
        j0 = max(0, int(np.ceil((min(a[1], b[1], c[1]) - lo[1]) / h)))
        j1 = min(ny - 1, int(np.floor((max(a[1], b[1], c[1]) - lo[1]) / h)))
        for i in range(i0, i1 + 1):
            x = lo[0] + i * h
            for j in range(j0, j1 + 1):
                y = lo[1] + j * h
                e0 = ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) * s
                e1 = ((c[0] - b[0]) * (y - b[1]) - (c[1] - b[1]) * (x - b[0])) * s
                e2 = ((a[0] - c[0]) * (y - c[1]) - (a[1] - c[1]) * (x - c[0])) * s
                if e0 <= 0 or e1 <= 0 or e2 <= 0:
                    continue
                sa = abs(area)
                z = (e1 * a[2] + e2 * b[2] + e0 * c[2]) / sa
                k = int(np.ceil((z - lo[2]) / h))
                k = max(k, 0)
                if k <= nz:
                    # A ray going +z enters a closed, outward-facing surface through a face looking toward -z.
                    w[i, j, k] += -1 if area > 0 else 1
    return w


def solid(grid, v, f):
    """Which voxels a closed mesh encloses, by winding number, so overlapping pieces and cavities oriented inward both come out right."""
    w = _crossings(np.asarray(v, np.float64), np.asarray(f, np.int64), grid.lo, grid.h, grid.shape[0], grid.shape[1], grid.shape[2])
    return np.cumsum(w, axis=2, dtype=np.int16)[:, :, : grid.shape[2]] > 0


def mesh_solid(grid, v, f, pad=4):
    """As solid(), but returns a full-grid mask while only filling the mesh's own box."""
    sl, g = grid.crop(v.min(0), v.max(0), pad)
    out = np.zeros(grid.shape, bool)
    out[sl] = solid(g, v, f)
    return out


def sdf(mask, h=1.0):
    """Signed distance in h units: negative inside. Half a voxel is taken off each side so the zero lies on the mask's edge."""
    return ((ndi.distance_transform_edt(~mask).astype(np.float32) - ndi.distance_transform_edt(mask).astype(np.float32)) + 0) * h


def bbox(mask, pad=0):
    idx = np.nonzero(mask.any(axis=(1, 2)))[0], np.nonzero(mask.any(axis=(0, 2)))[0], np.nonzero(mask.any(axis=(0, 1)))[0]
    return tuple(slice(max(0, a[0] - pad), min(mask.shape[n], a[-1] + pad + 1)) for n, a in enumerate(idx))


def extract(field, grid, level=0.5, step=1):
    """A closed surface out of a smooth field held in [0, 1], where inside is above the level, with outward-facing triangles."""
    v, f, _, _ = measure.marching_cubes(field, level, spacing=(grid.h,) * 3, step_size=step, gradient_direction="ascent", allow_degenerate=False)
    return v + grid.lo, f[:, ::-1].astype(np.int64) if _signed_volume(v, f) < 0 else f.astype(np.int64)


def _signed_volume(v, f):
    return np.einsum("ij,ij->i", v[f[:, 0]], np.cross(v[f[:, 1]], v[f[:, 2]])).sum() / 6


def face_normals(v, f, unit=True):
    n = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    if unit:
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-30)
    return n


def vertex_normals(v, f):
    fn = face_normals(v, f, unit=False)
    n = np.zeros_like(v)
    for a in range(3):
        np.add.at(n, f[:, a], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-30)


def neighbours(n, f):
    """Each vertex's mean-of-neighbours operator as a sparse matrix."""
    from scipy.sparse import coo_matrix, diags

    e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    a = coo_matrix((np.ones(len(e) * 2), (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])), shape=(n, n)).tocsr()
    a.data[:] = 1
    return diags(1.0 / np.maximum(np.asarray(a.sum(1)).ravel(), 1)) @ a


def taubin(v, f, steps=8, lam=0.5, mu=-0.53, pinned=None):
    """Smooths a surface without shrinking it, which is what removes the last of the voxel stairs."""
    m = neighbours(len(v), f)
    v = v.copy()
    for _ in range(steps):
        for k in (lam, mu):
            d = m @ v - v
            if pinned is not None:
                d[pinned] = 0
            v += k * d
    return v


def weld(v, f, tol=1e-7):
    u, inv = np.unique(np.round(v / tol).astype(np.int64), axis=0, return_inverse=True)
    f = inv.ravel()[f]
    keep = (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 2] != f[:, 0])
    return u * tol, f[keep]


def largest_components(v, f, keep=1, min_faces=0):
    """Drops loose specks: keeps the biggest connected pieces of a surface."""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components

    e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]]])
    n, lab = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(v), len(v))), directed=False)
    fl = lab[f[:, 0]]
    size = np.bincount(fl, minlength=n)
    order = np.argsort(-size)
    good = [o for i, o in enumerate(order) if (i < keep or size[o] >= min_faces and min_faces > 0) and size[o] > 0]
    fk = f[np.isin(fl, good)]
    used, inv = np.unique(fk, return_inverse=True)
    return v[used], inv.reshape(-1, 3)


def simplify(v, f, faces, agg=4):
    import fast_simplification

    if len(f) <= faces:
        return v, f
    vo, fo = fast_simplification.simplify(v.astype(np.float64), f.astype(np.int32), target_count=int(faces), agg=agg)
    return vo, fo.astype(np.int64)


# ---------------------------------------------------------------------------------------- noise

def tile(n=128, cell=4.0, seed=1):
    """A periodic cube of smooth noise in about [-1, 1], with features `cell` voxels wide."""
    r = np.random.default_rng(seed).standard_normal((n, n, n)).astype(np.float32)
    s = ndi.gaussian_filter(r, cell / 2.355, mode="wrap")
    return s / np.abs(s).max()


@njit(parallel=True, cache=True)
def sample(t, p):
    """Trilinear lookup of a periodic tile at points given in tile cells."""
    n = t.shape[0]
    out = np.empty(p.shape[0], np.float32)
    for q in prange(p.shape[0]):
        fx, fy, fz = p[q, 0], p[q, 1], p[q, 2]
        ix, iy, iz = int(np.floor(fx)), int(np.floor(fy)), int(np.floor(fz))
        fx -= ix
        fy -= iy
        fz -= iz
        ix %= n
        iy %= n
        iz %= n
        jx, jy, jz = (ix + 1) % n, (iy + 1) % n, (iz + 1) % n
        out[q] = (
            (1 - fz) * ((1 - fy) * ((1 - fx) * t[ix, iy, iz] + fx * t[jx, iy, iz]) + fy * ((1 - fx) * t[ix, jy, iz] + fx * t[jx, jy, iz]))
            + fz * ((1 - fy) * ((1 - fx) * t[ix, iy, jz] + fx * t[jx, iy, jz]) + fy * ((1 - fx) * t[ix, jy, jz] + fx * t[jx, jy, jz]))
        )
    return out


@njit(parallel=True, cache=True)
def worley(p, seed=7):
    """Cellular noise at points given in cell units: distance to the nearest and second nearest random seed point, per point.
    The seeds come from a hash of the cell, so it is seamless and repeatable."""
    out = np.empty((p.shape[0], 2), np.float32)
    for q in prange(p.shape[0]):
        x, y, z = p[q, 0], p[q, 1], p[q, 2]
        cx, cy, cz = int(np.floor(x)), int(np.floor(y)), int(np.floor(z))
        d1, d2 = 9.0, 9.0
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                for dz in range(-1, 2):
                    a, b, c = cx + dx, cy + dy, cz + dz
                    h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ seed
                    h = (h ^ (h >> 13)) * 1274126177
                    u = ((h >> 8) & 1023) / 1023.0
                    h2 = (h ^ (h >> 11)) * 2654435761
                    v = ((h2 >> 8) & 1023) / 1023.0
                    h3 = (h2 ^ (h2 >> 7)) * 40503
                    w = ((h3 >> 8) & 1023) / 1023.0
                    d = (a + u - x) ** 2 + (b + v - y) ** 2 + (c + w - z) ** 2
                    if d < d1:
                        d2 = d1
                        d1 = d
                    elif d < d2:
                        d2 = d
        out[q, 0] = np.sqrt(d1)
        out[q, 1] = np.sqrt(d2)
    return out
