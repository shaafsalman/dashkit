"""Valve leaflets and cusps from BodyParts3D, refined into smooth sheets, and the chordae tendineae that tie the mitral and tricuspid
leaflets to their papillary muscles. The atlas has no chordae, so those are drawn: an illustration of their usual pattern."""
import numpy as np

from heart_field import taubin, vertex_normals, weld


def subdivide(v, f):
    """Splits every triangle in four at its edge midpoints."""
    e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    e.sort(1)
    ue, inv = np.unique(e, axis=0, return_inverse=True)
    inv = inv.ravel()
    mid = len(v) + inv
    v2 = np.concatenate([v, (v[ue[:, 0]] + v[ue[:, 1]]) / 2])
    m01, m12, m20 = mid[: len(f)], mid[len(f) : 2 * len(f)], mid[2 * len(f) :]
    a, b, c = f[:, 0], f[:, 1], f[:, 2]
    f2 = np.concatenate([np.stack([a, m01, m20], 1), np.stack([b, m12, m01], 1), np.stack([c, m20, m12], 1), np.stack([m01, m12, m20], 1)])
    return v2, f2


def leaflets(atlas, ids, levels=1, smooth=14):
    v, f = atlas.meshes(ids)
    v, f = weld(v, f)
    for _ in range(levels):
        v, f = subdivide(v, f)
    v = taubin(v, f, steps=smooth)
    return v, f


def free_edge(v, base_centre, axis, count, rng):
    """Points along a leaflet's free edge: the part that hangs furthest into the ventricle, spread evenly around the valve."""
    depth = (v - base_centre) @ axis
    cand = v[depth > np.percentile(depth, 82)]
    if len(cand) <= count:
        return cand
    out = [cand[rng.integers(len(cand))]]
    d = np.linalg.norm(cand - out[0], axis=1)
    for _ in range(count - 1):
        i = int(np.argmax(d))
        out.append(cand[i])
        d = np.minimum(d, np.linalg.norm(cand - cand[i], axis=1))
    return np.array(out)


def heads(atlas, ids, axis):
    """The tip of each papillary muscle: the point nearest the valve along the ventricle's long axis."""
    out = []
    for i in ids:
        v, _ = atlas.mesh(i)
        out.append(v[np.argmin(v @ axis)])
    return out


def chordae(atlas, valve_ids, pap_ids, axis, centre, per_leaflet=11, seed=5):
    """Each chord leaves a papillary head as one cord and fans into two or three strands before it reaches the leaflet's edge."""
    from heart_vessels import tube

    rng = np.random.default_rng(seed)
    tips = heads(atlas, pap_ids, axis)
    parts = []
    for lid in valve_ids:
        v, _ = atlas.mesh(lid)
        for e in free_edge(v, centre, axis, per_leaflet, rng):
            h = min(tips, key=lambda t: np.linalg.norm(t - e))
            h = h + rng.normal(0, 0.8e-3, 3)
            split = h + (e - h) * rng.uniform(0.62, 0.78)
            t = np.linspace(0, 1, 18)[:, None]
            trunk = h + (split - h) * t
            parts.append(tube(trunk, np.linspace(0.42e-3, 0.3e-3, len(trunk)), sides=6))
            side = np.cross(e - h, axis)
            side /= max(np.linalg.norm(side), 1e-9)
            for k in range(rng.integers(2, 4)):
                end = e + side * rng.normal(0, 1.4e-3) + rng.normal(0, 0.4e-3, 3)
                strand = split + (end - split) * t
                parts.append(tube(strand, np.linspace(0.22e-3, 0.14e-3, len(strand)), sides=5))
    vs, fs, ns, n = [], [], [], 0
    for p in parts:
        if p is None:
            continue
        vs.append(p[0])
        fs.append(p[1] + n)
        ns.append(p[2])
        n += len(p[0])
    return np.concatenate(vs), np.concatenate(fs), np.concatenate(ns)
