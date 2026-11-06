"""
Numpy-only volume tools for the organ builders, usable inside Blender's own Python, which has no scipy.

Atlas meshes are often open shells, which Blender's voxel remesher shreds because they enclose nothing. Here a shell is drawn into a
grid, the outside is flooded from the grid's edge past the shell's small holes, and what the flood cannot reach is the solid. A closed
smooth surface is then drawn back out of it with surface nets, and fields can be combined first (fissures, walls, cuts).
"""
import numpy as np


class Grid:
    """A regular box of voxels. Index (i, j, k) is the voxel centred at lo + (i, j, k) * h."""

    def __init__(self, lo, hi, h, pad=6):
        self.h = float(h)
        self.lo = np.asarray(lo, np.float64) - pad * self.h
        hi = np.asarray(hi, np.float64) + pad * self.h
        self.shape = tuple(int(n) for n in np.ceil((hi - self.lo) / self.h).astype(int) + 1)

    def coords(self):
        """The world position of every voxel along each axis."""
        return [self.lo[a] + np.arange(self.shape[a]) * self.h for a in range(3)]

    def mesh_coords(self):
        x, y, z = self.coords()
        return np.meshgrid(x.astype(np.float32), y.astype(np.float32), z.astype(np.float32), indexing="ij", sparse=True)

    def sample(self, field, points):
        """Reads a field at world points with trilinear interpolation."""
        p = (np.asarray(points) - self.lo) / self.h
        i = np.clip(np.floor(p).astype(int), 0, np.array(self.shape) - 2)
        f = np.clip(p - i, 0, 1)
        out = 0.0
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                    out = out + w * field[i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz]
        return out


def rasterize(grid, verts, tris, into=None, value=True):
    """Marks every voxel a triangle passes through, by sampling each triangle finer than the grid."""
    mask = np.zeros(grid.shape, bool) if into is None else into
    verts = np.asarray(verts, np.float64)
    tris = np.asarray(tris, np.int64)
    a, b, c = verts[tris[:, 0]], verts[tris[:, 1]], verts[tris[:, 2]]
    longest = np.maximum.reduce([np.linalg.norm(b - a, axis=1), np.linalg.norm(c - a, axis=1), np.linalg.norm(c - b, axis=1)])
    steps = np.ceil(longest / (grid.h * 0.6)).astype(int) + 1
    limit = np.array(grid.shape) - 1
    for n in np.unique(steps):
        sel = steps == n
        u, v = np.meshgrid(np.arange(n + 1), np.arange(n + 1), indexing="ij")
        keep = u + v <= n
        u, v = (u[keep] / n)[None, :, None], (v[keep] / n)[None, :, None]
        for start in range(0, int(sel.sum()), 4000):
            ids = np.nonzero(sel)[0][start : start + 4000]
            pts = a[ids][:, None, :] + (b[ids] - a[ids])[:, None, :] * u + (c[ids] - a[ids])[:, None, :] * v
            idx = np.rint((pts.reshape(-1, 3) - grid.lo) / grid.h).astype(np.int64)
            idx = idx[((idx >= 0) & (idx <= limit)).all(1)]
            mask[idx[:, 0], idx[:, 1], idx[:, 2]] = value
    return mask


def dilate(mask, r=1):
    """Grows a mask by r voxels (face neighbours, which makes a rounded diamond rather than a cube)."""
    out = mask.copy()
    for _ in range(int(r)):
        grown = out.copy()
        grown[1:, :, :] |= out[:-1, :, :]
        grown[:-1, :, :] |= out[1:, :, :]
        grown[:, 1:, :] |= out[:, :-1, :]
        grown[:, :-1, :] |= out[:, 1:, :]
        grown[:, :, 1:] |= out[:, :, :-1]
        grown[:, :, :-1] |= out[:, :, 1:]
        out = grown
    return out


def erode(mask, r=1):
    return ~dilate(~mask, r)


def flood_outside(wall):
    """Everything reachable from the grid's edge without crossing a wall. Sweeps whole rows at a time, so it converges in a few passes."""
    out = np.zeros(wall.shape, bool)
    out[0, :, :] = out[-1, :, :] = True
    out[:, 0, :] = out[:, -1, :] = True
    out[:, :, 0] = out[:, :, -1] = True
    out &= ~wall
    free = ~wall
    nx, ny, nz = wall.shape
    last = -1
    while True:
        for i in range(1, nx):
            out[i] |= out[i - 1] & free[i]
        for i in range(nx - 2, -1, -1):
            out[i] |= out[i + 1] & free[i]
        for j in range(1, ny):
            out[:, j] |= out[:, j - 1] & free[:, j]
        for j in range(ny - 2, -1, -1):
            out[:, j] |= out[:, j + 1] & free[:, j]
        for k in range(1, nz):
            out[:, :, k] |= out[:, :, k - 1] & free[:, :, k]
        for k in range(nz - 2, -1, -1):
            out[:, :, k] |= out[:, :, k + 1] & free[:, :, k]
        count = int(out.sum())
        if count == last:
            return out
        last = count


def fill(wall, close=2):
    """The solid enclosed by a leaky shell: the wall is thickened to plug holes up to about 2 * close voxels, the outside is flooded,
    and the thickening is taken back off."""
    thick = dilate(wall, close) if close else wall
    return erode(~flood_outside(thick), close) if close else ~flood_outside(thick)


def _box(a, r, axis):
    """A running mean of width 2r + 1 along one axis, its cost independent of r."""
    n = a.shape[axis]
    if r < 1 or n < 3:
        return a
    c = np.cumsum(a, axis=axis, dtype=np.float32)
    hi = np.minimum(np.arange(n) + r, n - 1)
    lo = np.arange(n) - r - 1
    upper = np.take(c, hi, axis=axis)
    lower = np.take(c, np.maximum(lo, 0), axis=axis)
    shape = [1, 1, 1]
    shape[axis] = n
    lower = lower * (lo >= 0).reshape(shape)
    width = (hi - np.maximum(lo, -1)).reshape(shape).astype(np.float32)
    return (upper - lower) / width


def blur(field, sigma):
    """A close approximation to a gaussian, from three passes of a box. Sigma is in voxels."""
    a = field.astype(np.float32)
    if sigma <= 0:
        return a
    r = max(1, int(round((np.sqrt(4 * sigma * sigma + 1) - 1) / 2)))
    for axis in range(3):
        for _ in range(3):
            a = _box(a, r, axis)
    return a


def distance(mask, limit, h=1.0):
    """Distance from a mask to each voxel out to limit voxels, by repeated chamfer passes. Rough, but smooth enough to shape with."""
    d = np.where(mask, 0.0, float(limit)).astype(np.float32)
    w = [(1, 1.0), (2, 2.0)]
    for _ in range(2):
        for axis in range(3):
            n = d.shape[axis]
            for i in range(1, n):
                s = [slice(None)] * 3
                p = [slice(None)] * 3
                s[axis], p[axis] = i, i - 1
                d[tuple(s)] = np.minimum(d[tuple(s)], d[tuple(p)] + 1.0)
            for i in range(n - 2, -1, -1):
                s = [slice(None)] * 3
                p = [slice(None)] * 3
                s[axis], p[axis] = i, i + 1
                d[tuple(s)] = np.minimum(d[tuple(s)], d[tuple(p)] + 1.0)
    del w
    return d * h


def surface_nets(field, grid, iso=0.0):
    """Draws the surface field = iso as a closed mesh of quads, facing toward the side where the field is lower."""
    f = field - iso
    pos = f > 0
    nx, ny, nz = f.shape
    corners = np.stack([pos[:-1, :-1, :-1], pos[1:, :-1, :-1], pos[:-1, 1:, :-1], pos[1:, 1:, :-1], pos[:-1, :-1, 1:], pos[1:, :-1, 1:], pos[:-1, 1:, 1:], pos[1:, 1:, 1:]], 0)
    count = corners.sum(0)
    active = (count > 0) & (count < 8)
    del corners, count
    cells = np.argwhere(active)
    if not len(cells):
        return np.zeros((0, 3)), np.zeros((0, 4), np.int64)
    ids = -np.ones(active.shape, np.int64)
    ids[active] = np.arange(len(cells))
    # The vertex in each active cell sits at the mean of where the surface crosses the cell's edges.
    offs = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]])
    edges = [(0, 1), (2, 3), (4, 5), (6, 7), (0, 2), (1, 3), (4, 6), (5, 7), (0, 4), (1, 5), (2, 6), (3, 7)]
    val = np.stack([f[cells[:, 0] + o[0], cells[:, 1] + o[1], cells[:, 2] + o[2]] for o in offs], 1)
    total = np.zeros((len(cells), 3), np.float64)
    hits = np.zeros(len(cells), np.float64)
    for a, b in edges:
        va, vb = val[:, a], val[:, b]
        cross = (va > 0) != (vb > 0)
        t = va[cross] / (va[cross] - vb[cross])
        total[cross] += offs[a] + (offs[b] - offs[a]) * t[:, None]
        hits[cross] += 1
    verts = cells + total / np.maximum(hits, 1)[:, None]
    verts = grid.lo + verts * grid.h
    quads = []
    for axis, (u, v) in ((0, (1, 2)), (1, (2, 0)), (2, (0, 1))):
        sl_a = [slice(None)] * 3
        sl_b = [slice(None)] * 3
        sl_a[axis], sl_b[axis] = slice(None, -1), slice(1, None)
        flip = pos[tuple(sl_a)] != pos[tuple(sl_b)]
        at = np.argwhere(flip)
        # Keep crossings that have all four cells around them.
        ok = (at[:, u] > 0) & (at[:, v] > 0) & (at[:, u] < pos.shape[u] - 1) & (at[:, v] < pos.shape[v] - 1)
        at = at[ok]
        rising = ~pos[tuple(at.T)]
        du, dv = np.zeros(3, int), np.zeros(3, int)
        du[u], dv[v] = 1, 1
        c00 = ids[tuple((at - du - dv).T)]
        c10 = ids[tuple((at - dv).T)]
        c11 = ids[tuple(at.T)]
        c01 = ids[tuple((at - du).T)]
        q = np.stack([c00, c10, c11, c01], 1)
        q[rising] = q[rising][:, ::-1]
        quads.append(q)
    quads = np.concatenate(quads, 0)
    quads = quads[(quads >= 0).all(1)]
    return verts, quads
