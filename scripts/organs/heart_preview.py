"""A fast software renderer for checking the heart while building it, independent of the GPU that other jobs share. It z-buffers triangles,
then shades per pixel with the part's real maps: base colour, tangent-space normal and roughness, under a few area-like lights plus a
soft wet highlight. It is a checking tool: the Cycles renders and the live viewer are the judges."""
import numpy as np
from numba import njit, prange
from PIL import Image


@njit(cache=True)
def _raster(sx, sy, sz, f, W, H, zb, tri, b0, b1, base):
    for t in range(f.shape[0]):
        a, b, c = f[t, 0], f[t, 1], f[t, 2]
        ax, ay, bx, by, cx, cy = sx[a], sy[a], sx[b], sy[b], sx[c], sy[c]
        area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        if area == 0:
            continue
        x0 = max(0, int(np.floor(min(ax, bx, cx))))
        x1 = min(W - 1, int(np.ceil(max(ax, bx, cx))))
        y0 = max(0, int(np.floor(min(ay, by, cy))))
        y1 = min(H - 1, int(np.ceil(max(ay, by, cy))))
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                px, py = x + 0.5, y + 0.5
                w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area
                w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area
                w2 = 1 - w0 - w1
                if w0 < 0 or w1 < 0 or w2 < 0:
                    continue
                z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c]
                if z < zb[y, x]:
                    zb[y, x] = z
                    tri[y, x] = base + t
                    b0[y, x] = w0
                    b1[y, x] = w1


def look_at(direction, up=(0, 1, 0)):
    d = np.asarray(direction, np.float64)
    d = d / np.linalg.norm(d)
    r = np.cross(np.asarray(up, np.float64), d)
    if np.linalg.norm(r) < 1e-6:
        r = np.cross((0, 0, 1), d)
    r /= np.linalg.norm(r)
    u = np.cross(d, r)
    return np.stack([r, u, d])


VIEWS = {"front": (0, 0.05, 1), "back": (0, 0.05, -1), "left": (-1, 0.05, 0), "right": (1, 0.05, 0), "top": (0, 1, 0.02), "bottom": (0, -1, 0.02), "three": (0.55, 0.2, 0.8), "three_back": (-0.6, 0.2, -0.8)}


def _srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def render(parts, view="front", size=1000, target=(0, 0, 0), zoom=1.0, dist=6.3, fov=23.9, clip=None, bg=(0.06, 0.06, 0.07), lights=None, spec=1.0, gloss=None, supersample=2):
    """parts: [{v, f, n?, uv?, c?, base?, normal?, rough?}]. base and normal hold textures as float arrays, c is per-vertex colour, all
    linear. clip: (point, normal) keeps only the side the normal points away from. Returns an sRGB uint8 image."""
    W = H = int(size * supersample)
    R = look_at(VIEWS.get(view, view))
    target = np.asarray(target, np.float64)
    f_px = (H / 2) / np.tan(np.radians(fov / 2)) * zoom
    zb = np.full((H, W), np.inf, np.float32)
    tri = np.full((H, W), -1, np.int64)
    b0 = np.zeros((H, W), np.float32)
    b1 = np.zeros((H, W), np.float32)
    bases = []
    base = 0
    for p in parts:
        v = p["v"]
        cam = (v - target) @ R.T
        z = dist - cam[:, 2]
        sx = W / 2 + cam[:, 0] * f_px / z
        sy = H / 2 - cam[:, 1] * f_px / z
        f = p["f"]
        if clip is not None:
            keep = (((v[f] - np.asarray(clip[0])) @ np.asarray(clip[1])) < 0).any(1)
            f = f[keep]
        _raster(sx.astype(np.float64), sy.astype(np.float64), z.astype(np.float32), f.astype(np.int64), W, H, zb, tri, b0, b1, base)
        bases.append((base, base + len(f), p, f))
        base += len(f)
    img = np.empty((H, W, 3), np.float32)
    img[:] = np.asarray(bg, np.float32)
    # Camera ray for each pixel, in world space.
    ys, xs = np.nonzero(tri >= 0)
    eye = target + R[2] * dist
    if lights is None:
        lights = [((-3, 3.6, 4.4), 2.2, (1, 0.97, 0.93)), ((4.5, 0.2, 3), 0.55, (0.88, 0.92, 1)), ((2, 2.6, -4.6), 2.4, (1, 0.96, 0.92)), ((-1.5, -4, 2.5), 0.4, (1, 0.9, 0.86))]
    for start, end, p, f in bases:
        sel = (tri[ys, xs] >= start) & (tri[ys, xs] < end)
        if not sel.any():
            continue
        y, x = ys[sel], xs[sel]
        t = tri[y, x] - start
        w0, w1 = b0[y, x][:, None], b1[y, x][:, None]
        w2 = 1 - w0 - w1
        fa, fb, fc = f[t, 0], f[t, 1], f[t, 2]
        v = p["v"]
        pos = w0 * v[fa] + w1 * v[fb] + w2 * v[fc]
        if p.get("n") is not None:
            n = w0 * p["n"][fa] + w1 * p["n"][fb] + w2 * p["n"][fc]
        else:
            n = np.cross(v[fb] - v[fa], v[fc] - v[fa])
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-20)
        V = eye - pos
        V /= np.linalg.norm(V, axis=1, keepdims=True)
        backface = (n * V).sum(1) < 0
        col = np.asarray(p.get("color", (0.5, 0.1, 0.1)), np.float32)[None].repeat(len(y), 0)
        rough = np.full(len(y), p.get("roughness", 0.35), np.float32)
        if p.get("c") is not None:
            col = (w0 * p["c"][fa] + w1 * p["c"][fb] + w2 * p["c"][fc]).astype(np.float32)
        if p.get("uv") is not None and p.get("base") is not None:
            uv = w0 * p["uv"][fa] + w1 * p["uv"][fb] + w2 * p["uv"][fc]
            col = _tex(p["base"], uv)[:, :3]
            if p.get("rough") is not None:
                rough = _tex(p["rough"], uv)[:, 0]
            if p.get("normal") is not None:
                nm = _tex(p["normal"], uv)[:, :3] * 2 - 1
                ua, ub, uc = p["uv"][fa], p["uv"][fb], p["uv"][fc]
                e1, e2 = v[fb] - v[fa], v[fc] - v[fa]
                d1, d2 = ub - ua, uc - ua
                det = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
                det = np.where(np.abs(det) < 1e-12, 1e-12, det)
                T = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / det[:, None]
                T -= (T * n).sum(1, keepdims=True) * n
                T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-20)
                # glTF image v runs downward, and the map's +Y means up in the image.
                B = np.cross(n, T) * np.sign(-det)[:, None]
                n = T * nm[:, :1] + B * nm[:, 1:2] + n * nm[:, 2:3]
                n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-20)
        n = np.where(backface[:, None], -n, n)
        out = col * (0.32 + 0.22 * n[:, 1:2])
        spec_total = np.zeros(len(y), np.float32)
        for L, power, tint in lights:
            L = np.asarray(L, np.float64)
            L /= np.linalg.norm(L)
            nl = np.maximum((n @ L), 0)
            out += col * nl[:, None] * power * np.asarray(tint, np.float32) / np.pi * 1.2
            Hv = L + V
            Hv /= np.linalg.norm(Hv, axis=1, keepdims=True)
            nh = np.maximum((n * Hv).sum(1), 0)
            a = np.maximum(rough, 0.04) ** 2
            D = a * a / (np.pi * (nh * nh * (a * a - 1) + 1) ** 2)
            spec_total += D * nl * power * 0.04 * spec
            # A wet film over the tissue, tighter than the tissue itself.
            a2 = 0.13 ** 2
            D2 = a2 * a2 / (np.pi * (nh * nh * (a2 * a2 - 1) + 1) ** 2)
            spec_total += D2 * nl * power * 0.035 * spec
        ndv = np.maximum((n * V).sum(1), 0)
        fres = 0.04 + 0.96 * (1 - ndv) ** 5
        out += (fres * 0.3)[:, None] * np.array([0.9, 0.92, 1.0], np.float32)
        out += spec_total[:, None]
        if p.get("flat_back") is not None:
            out[backface] = np.asarray(p["flat_back"], np.float32)
        img[y, x] = out
    # Neutral roll-off so highlights do not clip harshly.
    peak = 0.8
    over = img > peak
    img = np.where(over, peak + (1 - peak) * (1 - np.exp(-(img - peak) / (1 - peak))), img)
    im = (_srgb(img) * 255 + 0.5).astype(np.uint8)
    out = Image.fromarray(im)
    if supersample > 1:
        out = out.resize((size, size), Image.LANCZOS)
    return out


def _tex(t, uv):
    h, w = t.shape[:2]
    x = np.clip(uv[:, 0] % 1.0, 0, 1) * w - 0.5
    y = np.clip(uv[:, 1] % 1.0, 0, 1) * h - 0.5
    x0 = np.clip(np.floor(x).astype(int), 0, w - 1)
    y0 = np.clip(np.floor(y).astype(int), 0, h - 1)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    fx = (x - x0)[:, None]
    fy = (y - y0)[:, None]
    if t.ndim == 2:
        t = t[..., None]
    return (t[y0, x0] * (1 - fx) + t[y0, x1] * fx) * (1 - fy) + (t[y1, x0] * (1 - fx) + t[y1, x1] * fx) * fy


def sheet(images, cols=None):
    cols = cols or len(images)
    rows = int(np.ceil(len(images) / cols))
    w, h = images[0].size
    o = Image.new("RGB", (w * cols, h * rows))
    for i, im in enumerate(images):
        o.paste(im, ((i % cols) * w, (i // cols) * h))
    return o
