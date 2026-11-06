"""The heart's own vessels. BodyParts3D models each named coronary artery and cardiac vein as a closed low-poly tube, in its true groove.
Here their centrelines and radii are measured out of those tubes (by filling and thinning them), joined into trees that start at the aorta
or end at the coronary sinus, and later rebuilt as smooth tapered tubes that sit on the finished surface. Finer branches can then be grown
from the measured trees; those are illustration."""
import numpy as np
from scipy import ndimage as ndi
from scipy.interpolate import splev, splprep
from skimage.morphology import skeletonize

from heart_field import Grid, solid

# id, label, kind, atlas meshes, the part it joins (None for a root), about.
CORONARIES = [
    ("left_main", "Left main coronary artery", "artery", ["FJ2737"], "aorta"),
    ("lad", "Left anterior descending artery", "artery", ["FJ2631"], "left_main"),
    ("diagonals", "Diagonal branches", "artery", ["FJ2633", "FJ2634", "FJ2635", "FJ2636", "FJ2637", "FJ2638", "FJ2639", "FJ2640", "FJ2642", "FJ2648"], "lad"),
    ("lad_right_branches", "Right anterior branches of the LAD", "artery", ["FJ2632", "FJ2645", "FJ2646", "FJ2641", "FJ2647", "FJ2643", "FJ2644"], "lad"),
    ("septal_perforators", "Septal perforators", "artery", ["FJ2732", "FJ2733", "FJ2734", "FJ2735", "FJ2736"], "lad"),
    ("circumflex", "Circumflex artery", "artery", ["FJ2649"], "left_main"),
    ("obtuse_marginals", "Obtuse marginal branches", "artery", ["FJ2650", "FJ2651", "FJ2652", "FJ2653", "FJ2654"], "circumflex"),
    ("rca", "Right coronary artery", "artery", ["FJ2723"], "aorta"),
    ("conus_artery", "Conus artery", "artery", ["FJ2670", "FJ2676"], "rca"),
    ("rca_anterior_branches", "Anterior ventricular branches", "artery", ["FJ2671", "FJ2673", "FJ2677"], "rca"),
    ("acute_marginal", "Acute marginal branch", "artery", ["FJ2667", "FJ2668", "FJ2672", "FJ2674", "FJ2675"], "rca"),
    ("pda", "Posterior descending artery", "artery", ["FJ2692", "FJ2693", "FJ2694", "FJ2695", "FJ2696", "FJ2697", "FJ2698", "FJ2699", "FJ2700"], "rca"),
    ("posterolateral_branches", "Posterior ventricular branches", "artery", ["FJ2714", "FJ2715", "FJ2716", "FJ2717", "FJ2718", "FJ2719", "FJ2720", "FJ2721", "FJ2722"], "rca"),
    ("coronary_sinus", "Coronary sinus", "vein", ["FJ2655"], "right_atrium"),
    ("great_cardiac_vein", "Great cardiac vein", "vein", ["FJ2656"], "coronary_sinus"),
    ("anterior_interventricular_vein", "Anterior interventricular vein", "vein", ["FJ2657", "FJ2658", "FJ2659", "FJ2660", "FJ2661", "FJ2662", "FJ2663", "FJ2664", "FJ2665"], "great_cardiac_vein"),
    ("left_marginal_vein", "Left marginal vein", "vein", ["FJ2703", "FJ2704", "FJ2705"], "great_cardiac_vein"),
    ("posterior_vein_lv", "Posterior vein of the left ventricle", "vein", ["FJ2701", "FJ2702", "FJ2706", "FJ2707", "FJ2708", "FJ2709", "FJ2710", "FJ2711", "FJ2712", "FJ2713"], "coronary_sinus"),
    ("middle_cardiac_vein", "Middle cardiac vein", "vein", ["FJ2678", "FJ2679", "FJ2680", "FJ2681", "FJ2682", "FJ2683", "FJ2684", "FJ2685", "FJ2686", "FJ2687", "FJ2688", "FJ2689", "FJ2690", "FJ2691"], "coronary_sinus"),
    ("small_cardiac_vein", "Small cardiac vein", "vein", ["FJ2724", "FJ2731"], "coronary_sinus"),
    ("anterior_cardiac_veins", "Anterior cardiac veins", "vein", ["FJ2725", "FJ2730", "FJ2727", "FJ2728", "FJ2729"], "right_atrium"),
]


def _skeleton_chains(mask, dist):
    """Walks a thinned mask into chains between its end and branch voxels, as index arrays."""
    pts = np.argwhere(mask)
    index = {tuple(p): i for i, p in enumerate(pts.tolist())}
    nbr = [[] for _ in pts]
    offs = [(a, b, c) for a in (-1, 0, 1) for b in (-1, 0, 1) for c in (-1, 0, 1) if (a, b, c) != (0, 0, 0)]
    for i, p in enumerate(pts.tolist()):
        for o in offs:
            j = index.get((p[0] + o[0], p[1] + o[1], p[2] + o[2]))
            if j is not None:
                nbr[i].append(j)
    degree = np.array([len(n) for n in nbr])
    # Two touching branch voxels would otherwise split a junction into stubs, so junction voxels act as one node region.
    special = set(np.nonzero(degree != 2)[0].tolist())
    chains, seen = [], set()
    for s in special:
        for n in nbr[s]:
            if (s, n) in seen:
                continue
            chain, prev, cur = [s], s, n
            while True:
                seen.add((prev, cur))
                chain.append(cur)
                if cur in special:
                    seen.add((cur, prev))
                    break
                nx = [q for q in nbr[cur] if q != prev]
                if not nx:
                    break
                prev, cur = cur, nx[0]
            chains.append(chain)
    if not chains and len(pts):
        chains = [list(range(len(pts)))]
    return pts, chains, degree


def measure_tube(v, f, h_target=0.14e-3, max_vox=24e6, spur=2.2):
    """The centreline chains of one closed tube mesh, as [(points, radii)] in metres, with stubby spurs from thinning removed."""
    lo, hi = v.min(0) - 2e-3, v.max(0) + 2e-3
    size = hi - lo
    h = max(h_target, (size.prod() / max_vox) ** (1 / 3))
    g = Grid(lo, hi, h)
    m = solid(g, v, f)
    d = ndi.distance_transform_edt(m).astype(np.float32) * h
    sk = skeletonize(m)
    if sk.sum() < 2:
        idx = np.argwhere(m)
        return [(g.world(idx[np.argsort(idx[:, 0])]), np.full(len(idx), d.max()))] if len(idx) else []
    pts, chains, degree = _skeleton_chains(sk > 0, d)
    out = []
    world = g.world(pts)
    rad = d[pts[:, 0], pts[:, 1], pts[:, 2]]
    lengths = []
    for c in chains:
        c = np.array(c)
        seg = np.linalg.norm(np.diff(world[c], axis=0), axis=1).sum()
        end_free = degree[c[0]] == 1 or degree[c[-1]] == 1
        junction = degree[c[0]] > 2 or degree[c[-1]] > 2
        lengths.append((seg, rad[c].max(), end_free, junction))
    longest = max(l[0] for l in lengths)
    for c, (seg, r, free, junction) in zip(chains, lengths):
        # A chain with a loose end that is no longer than the tube is wide is a thinning artefact.
        if free and junction and seg < spur * r:
            continue
        if seg < 0.25e-3 and seg < longest:
            continue
        c = np.array(c)
        out.append((world[c], rad[c] + h * 0.5))
    return out


def smooth_chain(p, r, spacing=0.5e-3, s_factor=0.6):
    """A chain of voxels into an evenly spaced smooth curve, with its radius smoothed and floored."""
    if len(p) < 4:
        t = np.linspace(0, 1, max(2, int(np.linalg.norm(p[-1] - p[0]) / spacing) + 2))
        return p[0] + (p[-1] - p[0]) * t[:, None], np.interp(t, np.linspace(0, 1, len(r)), r)
    seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
    keep = np.r_[True, np.diff(seg) > 0]
    p, r, seg = p[keep], r[keep], seg[keep]
    L = seg[-1]
    k = min(3, len(p) - 1)
    tck, _ = splprep(p.T, u=seg / max(L, 1e-9), s=len(p) * (s_factor * 0.14e-3) ** 2, k=k)
    n = max(4, int(L / spacing) + 1)
    t = np.linspace(0, 1, n)
    q = np.array(splev(t, tck)).T
    rr = np.interp(t, seg / max(L, 1e-9), ndi.gaussian_filter1d(r, max(1.0, len(r) / 12), mode="nearest"))
    return q, rr


class Branch:
    __slots__ = ("part", "pts", "r", "parent", "at", "kids", "grown")

    def __init__(self, part, pts, r):
        self.part, self.pts, self.r = part, pts, r
        self.parent, self.at, self.kids, self.grown = None, 0, [], False


def build_trees(atlas, log=print):
    """Measures every named vessel and joins them: each chain starts where it leaves the tree already built, so every branch knows its
    parent and its direction from the root outward."""
    roots = {"artery": {"left_main": (0.021, 1.335, 0.02), "rca": (0.009, 1.335, 0.034)}, "vein": {"coronary_sinus": (-0.006, 1.279, 0.012)}}
    direct_to_ra = {"anterior_cardiac_veins"}
    out = {"artery": [], "vein": []}
    for circ in ("artery", "vein"):
        pending = []
        for pid, label, kind, ids, parent in CORONARIES:
            if kind != circ:
                continue
            for mesh in ids:
                v, f = atlas.mesh(mesh)
                for p, r in measure_tube(v, f):
                    q, rr = smooth_chain(p, r)
                    pending.append(Branch(pid, q, rr))
        done = []
        # Roots first, oriented from the point they leave the aorta or join the right atrium.
        for b in list(pending):
            target = roots[circ].get(b.part)
            if target is not None:
                t = np.asarray(target)
                if np.linalg.norm(b.pts[0] - t) > np.linalg.norm(b.pts[-1] - t):
                    b.pts, b.r = b.pts[::-1], b.r[::-1]
                done.append(b)
                pending.remove(b)
            elif b.part in direct_to_ra:
                # These drain straight into the right atrium: each is its own small tree, starting at the end nearest it.
                t = np.array([-0.012, 1.315, 0.03])
                if np.linalg.norm(b.pts[0] - t) > np.linalg.norm(b.pts[-1] - t):
                    b.pts, b.r = b.pts[::-1], b.r[::-1]
                done.append(b)
                pending.remove(b)
        # Prim's algorithm: the waiting chain whose end is nearest the tree joins it next.
        from scipy.spatial import cKDTree

        while pending:
            pts = np.concatenate([b.pts for b in done])
            owner = np.concatenate([np.full(len(b.pts), i) for i, b in enumerate(done)])
            at = np.concatenate([np.arange(len(b.pts)) for b in done])
            tree = cKDTree(pts)
            best = None
            for b in pending:
                d, i = tree.query([b.pts[0], b.pts[-1]])
                # Prefer the parent the atlas names; another circulation branch only when it is much closer.
                for end in (0, 1):
                    if best is None or d[end] < best[0]:
                        best = (d[end], b, end, i[end])
            d, b, end, i = best
            if end == 1:
                b.pts, b.r = b.pts[::-1], b.r[::-1]
            parent = done[owner[i]]
            b.parent, b.at = parent, int(at[i])
            parent.kids.append(b)
            if d > 0.2e-3:
                # Close the small gap, so the branch truly leaves its parent.
                n = max(2, int(d / 0.5e-3))
                t = np.linspace(0, 1, n, endpoint=False)[:, None]
                b.pts = np.concatenate([pts[i] + (b.pts[0] - pts[i]) * t, b.pts])
                b.r = np.concatenate([np.full(n, b.r[0]), b.r])
            done.append(b)
            pending.remove(b)
            if d > 4e-3:
                log(f"  long joint {b.part}: {d * 1e3:.1f} mm")
        for b in done:
            # Thinning runs into the caps of the atlas tubes, where the measured radius falls to nothing. Those ends are not the vessel.
            n = len(b.r)
            k = min(n // 3, max(2, int(1.6 * np.median(b.r) / 0.5e-3)))
            r = b.r.copy()
            if k:
                r[:k] = r[k]
                r[-k:] = r[-k - 1]
            # A vessel only ever narrows on the way out.
            b.r = np.minimum.accumulate(ndi.gaussian_filter1d(r, 4, mode="nearest"))
        out[circ] = done
        log(f"{circ}: {len(done)} chains, {sum(np.linalg.norm(np.diff(b.pts, axis=0), axis=1).sum() for b in done) * 1e3:.0f} mm")
    return out


class Surface:
    """The outside of the heart as a signed distance field in metres (positive outside), for vessels to run on."""

    def __init__(self, grid, mass, downsample=2, blur=1.0):
        m = mass[::downsample, ::downsample, ::downsample]
        self.h = grid.h * downsample
        self.lo = grid.lo.copy()
        d = (ndi.distance_transform_edt(~m).astype(np.float32) - ndi.distance_transform_edt(m).astype(np.float32)) * self.h
        self.d = ndi.gaussian_filter(d, blur)
        self.shape = np.array(self.d.shape)

    def at(self, p):
        p = np.atleast_2d(p)
        q = (p - self.lo) / self.h
        i = np.clip(np.floor(q).astype(int), 0, self.shape - 2)
        f = np.clip(q - i, 0, 1)
        d = self.d
        out = 0
        for a in (0, 1):
            for b in (0, 1):
                for c in (0, 1):
                    w = (f[:, 0] if a else 1 - f[:, 0]) * (f[:, 1] if b else 1 - f[:, 1]) * (f[:, 2] if c else 1 - f[:, 2])
                    out = out + w * d[i[:, 0] + a, i[:, 1] + b, i[:, 2] + c]
        return out

    def normal(self, p, e=0.8e-3):
        p = np.atleast_2d(p)
        n = np.stack([self.at(p + np.eye(3)[k] * e) - self.at(p - np.eye(3)[k] * e) for k in range(3)], 1)
        return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)

    def project(self, p, offset=0.0, iters=3):
        p = np.atleast_2d(p).astype(np.float64)
        for _ in range(iters):
            p = p - ((self.at(p) - offset) * 0.9)[:, None] * self.normal(p)
        return p


def fit_to_surface(trees, surface, embed=0.35, inner_parts=("septal_perforators",), reach=7e-3, log=print):
    """Seats every surface vessel on the heart, with about two thirds of it showing. The curve is smoothed in between so a vessel never
    picks up the small bumps of the surface it lies on. Vessels that really run inside the muscle are left where they are."""
    for circ, branches in trees.items():
        for b in branches:
            if b.part in inner_parts:
                continue
            p = b.pts.copy()
            d0 = surface.at(p)
            far = np.abs(d0) > reach
            for _ in range(3):
                q = surface.project(p, 0.0, iters=2) + surface.normal(p) * (b.r * embed)[:, None]
                # Blending keeps the proximal end, which is pinned to its parent, from jumping.
                w = np.clip(np.arange(len(p)) / 6.0, 0, 1)[:, None] if b.parent is not None else 1.0
                q = p + (q - p) * w
                q[far] = p[far]
                p = ndi.gaussian_filter1d(q, 2.0, axis=0, mode="nearest")
                if b.parent is not None:
                    p[0] = b.parent.pts[min(b.at, len(b.parent.pts) - 1)]
            b.pts = p
    return trees


def fibre_direction(p, n, axis, base):
    """The way muscle fibres run on the ventricle's outside: a left-handed helix about the long axis, steep near the apex where they
    swirl into the vortex. p is on the surface and n its normal; the result lies in the surface, and its sign means nothing."""
    a = np.asarray(axis)
    c = np.cross(a, n)
    cn = np.linalg.norm(c, axis=1, keepdims=True)
    c = np.where(cn > 1e-3, c / np.maximum(cn, 1e-9), np.cross(n, np.roll(n, 1, axis=1)))
    c /= np.maximum(np.linalg.norm(c, axis=1, keepdims=True), 1e-9)
    l = np.cross(n, c)
    # c x n flips the handedness if the axis is reversed, so the helix angle is fixed against the axis pointing base to apex.
    s = ((p - np.asarray(base)) @ a).clip(0, None)
    helix = np.radians(58.0)
    return np.cos(helix) * c + np.sin(helix) * l


def grow_fine(trees, surface, allowed, axis, base, seed=4, log=print):
    """Grows hair-fine branches from the measured trees, over the surface and running with the muscle fibres, as real terminal branches
    do. They leave their parent at an acute angle, narrow by Murray's law and keep their distance from each other, which is what stops
    them looking like worms. These are illustration; the named trees they grow from are measured."""
    rng = np.random.default_rng(seed)
    cell = 0.8e-3
    taken = {}

    def mark(p, who, r=0.0):
        reach = int(np.ceil(r / cell))
        k = np.floor(p / cell).astype(int)
        for a in range(-reach, reach + 1):
            for b in range(-reach, reach + 1):
                for c in range(-reach, reach + 1):
                    taken.setdefault((k[0] + a, k[1] + b, k[2] + c), who)

    def clash(p, who, spread=1):
        k = np.floor(p / cell).astype(int)
        for a in range(-spread, spread + 1):
            for b in range(-spread, spread + 1):
                for c in range(-spread, spread + 1):
                    o = taken.get((k[0] + a, k[1] + b, k[2] + c))
                    if o is not None and o != who:
                        return True
        return False

    for circ, branches in trees.items():
        for b in branches:
            for p, r in zip(b.pts[::2], b.r[::2]):
                mark(p, id(b), r * 1.1)

    made = {"artery": [], "vein": []}
    step = 0.6e-3
    uid = [0]

    def walk(start, heading, r0, length, part, depth, parent_who, kind, inherited):
        uid[0] += 1
        who = uid[0]
        p = np.array(start, float)
        d = np.array(heading, float)
        pts, rad = [p.copy()], [r0]
        wander = np.zeros(3)
        n_steps = int(length / step)
        L = max(n_steps, 1)
        for i in range(1, n_steps):
            n = surface.normal(p)[0]
            d = d - n * (d @ n)
            d /= max(np.linalg.norm(d), 1e-9)
            f = fibre_direction(p[None], n[None], axis, base)[0]
            if f @ d < 0:
                f = -f
            wander = 0.92 * wander + rng.normal(0, 0.012, 3)
            d = d + 0.05 * (f - d) + wander
            d /= max(np.linalg.norm(d), 1e-9)
            r = r0 * (1 - i / L) ** 0.65 + 0.045e-3
            q = surface.project(p + d * step, r * 0.3, iters=1)[0]
            if not allowed(q) or (i > 4 and clash(q, who, 1 if r0 > 0.12e-3 else 0)):
                break
            p = q
            pts.append(p.copy())
            rad.append(r)
            if i % 2 == 0:
                mark(p, who)
            # Side branches, on alternate sides, each a little under half the parent's radius cubed.
            if depth < 3 and r > 0.1e-3 and rng.random() < step / rng.uniform(3.5e-3, 7e-3) and i > 3:
                side = np.cross(n, d) * rng.choice((-1, 1))
                turn = d * np.cos(0.8) + side * np.sin(0.8)
                walk(p, turn, r * rng.uniform(0.55, 0.72), length * rng.uniform(0.35, 0.6), part, depth + 1, who, kind, inherited)
        if len(pts) > 4:
            br = Branch(part, np.array(pts), np.array(rad))
            br.grown = True
            br.at = inherited
            made[kind].append(br)

    for circ, branches in trees.items():
        for b in branches:
            if b.part in ("septal_perforators", "left_main", "coronary_sinus"):
                continue
            s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(b.pts, axis=0), axis=1))]
            total = s[-1]
            pos = float(rng.uniform(2e-3, 5e-3))
            while pos < total:
                i = int(np.searchsorted(s, pos))
                if i >= len(b.pts) - 1:
                    break
                p, r = b.pts[i], b.r[i]
                t = b.pts[min(i + 2, len(b.pts) - 1)] - b.pts[max(i - 2, 0)]
                t = t / max(np.linalg.norm(t), 1e-9)
                n = surface.normal(p)[0]
                side = np.cross(n, t) * rng.choice((-1, 1))
                ang = rng.uniform(0.6, 1.0)
                heading = t * np.cos(ang) + side * np.sin(ang)
                r0 = float(min(r * rng.uniform(0.38, 0.55), 0.38e-3))
                L = (7e-3 + 48 * r0) * rng.uniform(0.8, 1.25)
                if allowed(p):
                    walk(p, heading, r0, L, b.part, 1, id(b), circ, id(b))
                pos += float(rng.uniform(3e-3, 7e-3) * (1.0 if circ == "artery" else 1.7))
            # The atlas ends its tubes at about a millimetre across. A real vessel carries on, narrowing to nothing.
            t = b.pts[-1] - b.pts[-4]
            t = t / max(np.linalg.norm(t), 1e-9)
            walk(b.pts[-1], t, float(b.r[-1]), (14e-3 + 34 * float(b.r[-1])) * rng.uniform(0.9, 1.3), b.part, 0, id(b), circ, id(b))
        log(f"{circ}: grew {len(made[circ])} fine branches, {sum(np.linalg.norm(np.diff(b.pts, axis=0), axis=1).sum() for b in made[circ]) * 1e3:.0f} mm")
    return made


def tube(pts, radii, sides=None, cap=True, spacing=None):
    """A smooth tube along a curve, with its frame carried along the curve so it never twists. Rings are spaced by how fine the tube is."""
    pts, radii = np.asarray(pts, np.float64), np.asarray(radii, np.float64)
    if len(pts) < 2:
        return None
    r0 = float(radii.max())
    if sides is None:
        sides = 18 if r0 > 1.5e-3 else 14 if r0 > 0.8e-3 else 10 if r0 > 0.4e-3 else 7 if r0 > 0.17e-3 else 5 if r0 > 0.09e-3 else 4
    seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    L = seg[-1]
    if L <= 0:
        return None
    gap = spacing or max(0.42e-3, min(1.6e-3, 2.2 * r0))
    n = max(2, int(L / gap) + 1)
    t = np.linspace(0, L, n)
    p = np.stack([np.interp(t, seg, pts[:, k]) for k in range(3)], 1)
    r = np.interp(t, seg, radii)
    tang = np.gradient(p, axis=0)
    tang /= np.maximum(np.linalg.norm(tang, axis=1, keepdims=True), 1e-12)
    u = np.zeros_like(p)
    a = np.eye(3)[np.argmin(np.abs(tang[0]))]
    u[0] = a - tang[0] * (a @ tang[0])
    u[0] /= np.linalg.norm(u[0])
    for i in range(1, n):
        v = u[i - 1] - tang[i] * (u[i - 1] @ tang[i])
        u[i] = v / max(np.linalg.norm(v), 1e-12)
    w = np.cross(tang, u)
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ca, sa = np.cos(ang)[None, :, None], np.sin(ang)[None, :, None]
    normals = u[:, None, :] * ca + w[:, None, :] * sa
    verts = p[:, None, :] + normals * r[:, None, None]
    v = verts.reshape(-1, 3)
    nrm = normals.reshape(-1, 3)
    i, j = np.meshgrid(np.arange(n - 1), np.arange(sides), indexing="ij")
    a0 = i * sides + j
    a1 = i * sides + (j + 1) % sides
    b0 = (i + 1) * sides + j
    b1 = (i + 1) * sides + (j + 1) % sides
    # Wound so each face looks outward: renderers that light both sides flip a face that looks in, and the tube goes dark.
    f = np.concatenate([np.stack([a0, a1, b0], -1).reshape(-1, 3), np.stack([a1, b1, b0], -1).reshape(-1, 3)])
    if cap:
        # A rounded end: one point past the last ring, and one before the first, closes the tube.
        v = np.concatenate([v, [p[-1] + tang[-1] * r[-1] * 0.8], [p[0] - tang[0] * r[0] * 0.8]])
        nrm = np.concatenate([nrm, [tang[-1]], [-tang[0]]])
        e, s = len(v) - 2, len(v) - 1
        last = (n - 1) * sides
        cap_e = np.stack([np.full(sides, e), last + (np.arange(sides) + 1) % sides, last + np.arange(sides)], 1)
        cap_s = np.stack([np.full(sides, s), np.arange(sides), (np.arange(sides) + 1) % sides], 1)
        f = np.concatenate([f, cap_e[:, [0, 2, 1]], cap_s[:, [0, 2, 1]]])
    return v, f, nrm


def flare(r, spacing=0.5e-3):
    """A branch leaves its parent with a slight swelling, as real ones do, and it hides the sharp line where two tubes meet."""
    s = np.arange(len(r)) * spacing
    return r * (1 + 0.3 * np.exp(-s / max(1e-6, 2.0 * r[0])))
