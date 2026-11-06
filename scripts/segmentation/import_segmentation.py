#!/usr/bin/env python3
"""
Turns the output of medical segmentation tools into the organ library's model format, so that a scan can be shown with
<Organ name="case1" baseUrl="/cases" />: every structure a clickable part, with its measured volume in the panel.

  python scripts/segmentation/import_segmentation.py <input> --name case1 [options]

<input> is any of:
  a folder of per-class .nii.gz masks      TotalSegmentator's default output (statistics.json beside them is read too)
  one multilabel .nii.gz                   TotalSegmentator's --ml output, which carries its own label table; else --task names the class map
  one label map .nii.gz with --labels      nnU-Net's dataset.json, a MONAI bundle's metadata.json or label_dict.json, or a plain JSON
  a .seg.nrrd                              3D Slicer's segmentation file

Writes <out>/<name>/model.glb and manifest.json. See README.md here for the details and for what this is not: nothing here is a medical device.
"""
import argparse, ast, json, os, re, struct, subprocess, sys, time
from dataclasses import dataclass, field

import fast_simplification
import nibabel as nib
import numpy as np
from scipy import ndimage, sparse
from skimage import measure

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classes import GROUPS, LAYER_OF_GROUP, LAYERS, ORDER, TASKS, describe, normalise

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

# Patient axes to model axes. World space here is always RAS+ (x to the patient's right, y to the front, z to the top), whatever order the
# voxels are stored in. The patient faces +Z, the viewer's Front camera, and stands along +Y. Facing the viewer, the patient's right is on
# the viewer's left, which is -X. The determinant is +1, so this turns the patient and never mirrors them.
RAS_TO_MODEL = np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0]], dtype=np.float64)

FACE_NAMES = {"R": "right side", "L": "left side", "A": "front", "P": "back", "S": "top", "I": "bottom"}
OPPOSITE = {"R": "L", "L": "R", "A": "P", "P": "A", "S": "I", "I": "S"}
LPS_TO_RAS = np.diag([-1.0, -1.0, 1.0])
BACKGROUND = {"background", "bg", "clear label", "unlabeled", "unlabelled", "none"}


def materials():
    """The tones of the organ library, read from its builder so that the two never drift apart. That file imports Blender, so it is parsed and not imported."""
    tree = ast.parse(open(os.path.join(ROOT, "scripts", "organs", "build.py")).read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") == "MATERIALS":
            return eval(compile(ast.Expression(node.value), "MATERIALS", "eval"), {"__builtins__": {}, "dict": dict})
    raise SystemExit("MATERIALS not found in scripts/organs/build.py")


@dataclass
class Structure:
    name: str  # as the source tool spells it
    voxels: int
    start: np.ndarray  # where the crop sits in the image
    mask: np.ndarray  # cropped to its bounding box
    overrides: dict = field(default_factory=dict)
    cut: list = field(default_factory=list)  # the faces of the image that it reaches


@dataclass
class Scan:
    affine: np.ndarray  # voxel index to RAS+ millimetres
    shape: tuple
    structures: list
    format: str
    tool: str
    orientation_known: bool = True
    stats: dict = field(default_factory=dict)
    empty: list = field(default_factory=list)


# ------------------------------------------------------------------ reading


def crop_box(mask):
    box = ndimage.find_objects(mask.astype(np.uint8))
    return box[0] if box else None


def from_mask(name, mask, overrides=None):
    box = crop_box(mask)
    if box is None:
        return None
    cropped = mask[box]
    return Structure(name, int(cropped.sum()), np.array([s.start for s in box]), cropped, overrides or {})


def caret_labels(img):
    """TotalSegmentator's --ml files carry a label table in a header extension, in the Caret XML form. It is the most trustworthy map, because the file itself says what its numbers mean."""
    found = {}
    for ext in img.header.extensions:
        content = ext.get_content()
        text = content.decode("utf-8", "ignore") if isinstance(content, (bytes, bytearray)) else str(content)
        for key, name in re.findall(r'<Label\s+Key="(\d+)"[^>]*>\s*<!\[CDATA\[(.*?)\]\]>', text):
            found[int(key)] = name
    return {k: v for k, v in found.items() if k != 0 and v.lower() not in BACKGROUND}


def parse_labels(blob):
    """Reads the label JSONs that tools write into [(name, [values], overrides)]. Returns the entries and the tool's name when the file gives it away."""
    tool = None
    if isinstance(blob, dict):
        if "network_data_format" in blob or "channel_def" in blob:
            tool = f"MONAI bundle {blob.get('name')}".strip() if blob.get("name") else "a MONAI bundle"
            if "channel_def" in blob:
                blob = blob["channel_def"]
            else:
                outputs = blob["network_data_format"].get("outputs", {})
                defs = [o["channel_def"] for o in outputs.values() if isinstance(o, dict) and o.get("channel_def")]
                if not defs:
                    raise SystemExit("this metadata.json has no output channel_def, so it does not say what the labels mean")
                blob = defs[0]
        elif "labels" in blob:
            if any(k in blob for k in ("channel_names", "modality", "file_ending", "numTraining")):
                tool = "nnU-Net"
            blob = blob["labels"]
        elif "label_dict" in blob:
            blob = blob["label_dict"]
    entries = []

    def add(name, values, overrides=None):
        values = [int(v) for v in values]
        if str(name).lower() not in BACKGROUND and values and values != [0]:
            entries.append((str(name), values, overrides or {}))

    if isinstance(blob, list):
        for item in blob:
            value = next(item[k] for k in ("value", "id", "label_value", "labelValue", "index", "label") if isinstance(item.get(k), int))
            name = next(item[k] for k in ("name", "label", "class", "term") if isinstance(item.get(k), str))
            add(name, [value], {k: item[k] for k in ("about", "kind", "group", "glass", "vessel") if k in item})
    elif isinstance(blob, dict):
        for key, val in blob.items():
            if isinstance(val, dict):  # "3": {"name": "tumour", "kind": "coral", "about": "..."}
                overrides = {k: val[k] for k in ("about", "kind", "group", "glass", "vessel") if k in val}
                if "label" in val and "name" in val:
                    overrides["label"] = val["label"]
                add(val.get("name") or val.get("label") or key, [int(key)] if str(key).lstrip("-").isdigit() else val.get("values", val.get("value")), overrides)
            elif str(key).lstrip("-").isdigit():  # nnU-Net v1, MONAI's channel_def: {"1": "liver"}
                add(val, [int(key)])
            elif isinstance(val, (list, tuple)):  # nnU-Net v2 regions: {"whole_tumor": [1, 2, 3]}
                add(key, val)
            else:  # nnU-Net v2, VISTA3D's label_dict: {"liver": 1}
                add(key, [val])
    else:
        raise SystemExit("the labels JSON is neither a list nor an object")
    return entries, tool


def from_label_map(data, entries):
    """Pulls each class out of an integer label map. A label with no entry still becomes a part, so that nothing in the file silently vanishes."""
    if data.dtype.kind == "f":
        rounded = np.rint(data)
        if np.abs(rounded - data).max() > 1e-3:
            raise SystemExit("this image holds fractions, not whole labels, so it is not a label map")
        data = rounded
    data = np.clip(data, 0, None).astype(np.int32)
    boxes = ndimage.find_objects(data)
    present = {i + 1 for i, b in enumerate(boxes) if b is not None}
    named = {v for _, values, _ in entries for v in values}
    entries = list(entries) + [(f"label_{v}", [v], {}) for v in sorted(present - named)]
    out, empty = [], []
    for name, values, overrides in entries:
        mine = [boxes[v - 1] for v in values if v in present]
        if not mine:
            empty.append(name)
            continue
        box = tuple(slice(min(b[a].start for b in mine), max(b[a].stop for b in mine)) for a in range(3))
        cropped = np.isin(data[box], values)
        out.append(Structure(name, int(cropped.sum()), np.array([s.start for s in box]), cropped, overrides))
    return out, empty


def spatial(img):
    """A NIfTI's affine goes to RAS+. With neither form code set the file does not actually say which way the patient lies, and the viewer must not imply that it does."""
    known = int(img.header["sform_code"]) > 0 or int(img.header["qform_code"]) > 0
    return np.asarray(img.affine, dtype=np.float64), known


def read_folder(folder, args):
    if os.path.isdir(os.path.join(folder, "segmentations")):  # The TotalSegmentator dataset's layout.
        folder = os.path.join(folder, "segmentations")
    files = sorted(f for f in os.listdir(folder) if f.endswith((".nii.gz", ".nii")))
    if not files:
        raise SystemExit(f"{folder}: no .nii.gz files")
    structures, empty, affine, shape, known = [], [], None, None, True
    for f in files:
        name = re.sub(r"\.nii(\.gz)?$", "", f)
        img = nib.load(os.path.join(folder, f))
        if affine is None:
            affine, known = spatial(img)
            shape = img.shape[:3]
        elif img.shape[:3] != shape or not np.allclose(img.affine, affine, atol=1e-3):
            raise SystemExit(f"{f}: its grid differs from {files[0]}, so these do not come from one image")
        data = np.asanyarray(img.dataobj)
        if data.ndim != 3 or data.max() > 255:
            print(f"  skipping {f}: it does not look like a mask")
            continue
        s = from_mask(name, data > 0)
        if s:
            structures.append(s)
        else:
            empty.append(name)
    return Scan(affine, shape, structures, "per-class NIfTI folder", args.tool or "TotalSegmentator", known, read_stats(args.stats or os.path.join(folder, "statistics.json")), empty)


def read_nifti(path, args):
    img = nib.load(path)
    affine, known = spatial(img)
    data = np.squeeze(np.asanyarray(img.dataobj))
    tool, fmt = args.tool, "label map NIfTI"
    if args.labels:
        entries, found_tool = parse_labels(json.load(open(args.labels)))
        tool = tool or found_tool or "a segmentation tool"
    else:
        table = caret_labels(img)
        if table:
            fmt = "multilabel NIfTI with its own label table"
        elif args.task in TASKS:
            table = TASKS[args.task]
            fmt = f"multilabel NIfTI, class map {args.task}"
        else:
            table = {}
            print(f"  this file has no label table and no --labels or --task was given, so its parts are named by number")
        entries = [(name, [value], {}) for value, name in sorted(table.items())]
        tool = tool or ("TotalSegmentator" if table else "a segmentation tool")
    if data.ndim == 4:  # One channel per class, as some MONAI writers do: channel 0 is the background unless the labels say otherwise.
        channels = {v: n for n, vs, _ in entries for v in vs}
        structures = [s for c in range(data.shape[3]) if (c > 0 or c in channels) for s in [from_mask(channels.get(c, f"label_{c}"), data[..., c] > 0.5)] if s]
        empty = []
    elif data.ndim == 3:
        structures, empty = from_label_map(data, entries)
    else:
        raise SystemExit(f"{path}: expected a 3D label map, found shape {data.shape}")
    return Scan(affine, data.shape[:3], structures, fmt, tool, known, read_stats(args.stats or os.path.join(os.path.dirname(path), "statistics.json")), empty)


def read_seg_nrrd(path, args):
    """3D Slicer's format. Segments hold a label value in a layer, so that overlapping segments can share a file; older files give each its own layer.
    The header's origin already allows for Slicer's cropped extent, so Segmentation_ReferenceImageExtentOffset is not applied again."""
    import nrrd

    data, h = nrrd.read(path)
    space = str(h.get("space", "")).lower().replace(" ", "")
    spaces = {
        "left-posterior-superior": LPS_TO_RAS, "lps": LPS_TO_RAS, "right-anterior-superior": np.eye(3), "ras": np.eye(3),
        "left-anterior-superior": np.diag([-1.0, 1.0, 1.0]), "las": np.diag([-1.0, 1.0, 1.0]),
    }
    known = space in spaces
    if not known:
        print(f"  this file does not say which way the patient lies (space: {space or 'none'}), so left and right cannot be trusted")
    to_ras = spaces.get(space, np.eye(3))
    directions = np.asarray(h.get("space directions", np.eye(3)), dtype=np.float64)
    if directions.shape[0] == 4:  # The list axis of a layered file has no direction.
        directions = directions[~np.isnan(directions).any(axis=1)]
    affine = np.eye(4)
    affine[:3, :3] = to_ras @ directions.T
    affine[:3, 3] = to_ras @ np.asarray(h.get("space origin", np.zeros(3)), dtype=np.float64)
    layered = data.ndim == 4
    shape = data.shape[1:] if layered else data.shape
    names = sorted((int(m.group(1)) for k in h for m in [re.fullmatch(r"Segment(\d+)_Name", k)] if m))
    tool = args.tool or "3D Slicer"
    if not names:  # A plain .nrrd label map.
        if layered:
            raise SystemExit(f"{path}: layers but no Segment fields, so the file does not say what they mean")
        entries = parse_labels(json.load(open(args.labels)))[0] if args.labels else []
        structures, empty = from_label_map(data, entries)
        return Scan(affine, shape, structures, "label map NRRD", args.tool or "a segmentation tool", known, {}, empty)
    structures, empty = [], []
    for i in names:
        name = h[f"Segment{i}_Name"]
        label = int(h.get(f"Segment{i}_LabelValue", 1 if layered else i + 1))
        layer = int(h.get(f"Segment{i}_Layer", i if layered else 0))
        s = from_mask(name, (data[layer] if layered else data) == label)
        if s:
            structures.append(s)
        else:
            empty.append(name)
    return Scan(affine, shape, structures, "3D Slicer .seg.nrrd", tool, known, {}, empty)


def read_stats(path):
    if path and os.path.exists(path):
        return json.load(open(path))
    return {}


def read_source(args):
    p = args.input
    if os.path.isdir(p):
        return read_folder(p, args)
    if p.endswith((".nii", ".nii.gz")):
        return read_nifti(p, args)
    if p.endswith(".nrrd"):
        return read_seg_nrrd(p, args)
    raise SystemExit(f"{p}: expected a folder, a .nii or .nii.gz, or a .seg.nrrd")


# ------------------------------------------------------------------ meshing


def to_world(affine, ijk):
    return ijk @ affine[:3, :3].T + affine[:3, 3]


def signed_volume(v, f):
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    return float((a * np.cross(b, c)).sum() / 6)


def surface_area(v, f):
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    return float(np.linalg.norm(np.cross(b - a, c - a), axis=1).sum() / 2)


def taubin(v, f, passes, lam=0.5, mu=-0.53):
    """Laplacian smoothing shrinks a shape. Taubin's alternating pass and counter-pass removes the voxel stairs, a high frequency, and leaves the overall size alone,
    which is what lets the measured volume and the shape on screen agree."""
    n = len(v)
    i = np.concatenate([f[:, 0], f[:, 1], f[:, 2], f[:, 1], f[:, 2], f[:, 0]])
    j = np.concatenate([f[:, 1], f[:, 2], f[:, 0], f[:, 0], f[:, 1], f[:, 2]])
    a = sparse.csr_matrix((np.ones_like(i, dtype=np.float64), (i, j)), shape=(n, n))
    a.data[:] = 1
    degree = np.asarray(a.sum(axis=1)).ravel()
    degree[degree == 0] = 1
    walk = sparse.diags(1 / degree) @ a
    v = v.copy()
    for _ in range(passes):
        v = v + lam * (walk @ v - v)
        v = v + mu * (walk @ v - v)
    return v


def vertex_normals(v, f):
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    face = np.cross(b - a, c - a)
    n = np.zeros_like(v)
    for k in range(3):
        np.add.at(n, f[:, k], face)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    return n


def build_surface(s, spacing, affine, args):
    """A smooth closed surface for one structure, in world millimetres, enclosing about the volume of its voxels."""
    pad = 3
    m = np.pad(s.mask, pad)
    # Enclosed cavities add triangles that no one can see. The volume figure was already counted from the original voxels.
    m = ndimage.binary_fill_holes(m)
    # A tool's stray specks would each become a little floating blob.
    labels, count = ndimage.label(m, structure=np.ones((3, 3, 3), dtype=int))
    if count > 1:
        sizes = ndimage.sum_labels(m, labels, index=np.arange(1, count + 1))
        keep = np.flatnonzero(sizes >= max(args.min_piece, sizes.max() * 0.01)) + 1
        m = np.isin(labels, keep)
    field = ndimage.gaussian_filter(m.astype(np.float32), sigma=args.blur, mode="constant")
    # A plain 0.5 isosurface of a blurred mask loses thin vessels. Taking the level that keeps exactly as many voxels inside keeps them at their real thickness.
    n = int(m.sum())
    if n >= field.size:
        raise SystemExit(f"{s.name}: fills its whole crop, which should not happen after padding")
    part = np.partition(field.ravel(), (field.size - n - 1, field.size - n))
    level = float((part[field.size - n - 1] + part[field.size - n]) / 2)
    level = min(max(level, 0.05), 0.95)
    # Coarse voxels, as in the 3 mm --fast output, are sampled finer so that silhouettes are not blocky. Finer scans have more detail than the face budget can use.
    factors = np.array([max(1, int(np.ceil(sp / args.fine))) for sp in spacing])
    if factors.max() > 1:
        out_shape = (np.array(field.shape) - 1) * factors + 1
        field = ndimage.zoom(field, out_shape / np.array(field.shape), order=3, mode="nearest", grid_mode=False)
    v, f, _, _ = measure.marching_cubes(field, level=level, allow_degenerate=False, method="lewiner")
    ijk = v / factors + s.start - pad
    world = to_world(affine, ijk)
    world = taubin(world, f.astype(np.int64), args.smooth)
    if signed_volume(world, f) < 0:  # An image whose affine mirrors, such as the common LAS, turns the triangles inside out.
        f = f[:, ::-1]
    return world, f.astype(np.int64)


def allot_faces(areas, budget, floor, ceilings):
    """Shares the budget by surface area, a little in favour of the small parts so that a thin vessel still looks round."""
    w = np.power(np.asarray(areas, dtype=np.float64), 0.8)
    ceilings = np.maximum(np.asarray(ceilings, dtype=np.float64), floor)
    want = w / w.sum() * budget
    for _ in range(6):
        fixed = (want <= floor) | (want >= ceilings)
        want = np.clip(want, floor, ceilings)
        left = budget - want[fixed].sum()
        if (~fixed).any() and left > 0:
            want[~fixed] = w[~fixed] / w[~fixed].sum() * left
    return np.clip(want, floor, ceilings).astype(int)


def slim(v, f, target):
    if len(f) <= target:
        return v, f
    v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_count=int(target), agg=5.0)
    return np.asarray(v2, dtype=np.float64), np.asarray(f2, dtype=np.int64)


# ------------------------------------------------------------------ colour


class Shading:
    """Shadow that makes the shapes read, baked from the voxels themselves. Blurred occupancy, read a little way out along each normal, says how much is crowding that point:
    open surfaces see almost nothing, the gaps between organs see a lot. It needs no rays, has no noise, and does not care how the mesh was decimated."""

    RINGS = ((3.0, 2.2, 0.25), (8.0, 6.0, 0.3), (20.0, 15.0, 0.27), (45.0, 34.0, 0.18))  # out along the normal, blur, weight; in millimetres

    def __init__(self, structures, solid, shape, affine, spacing):
        self.block = np.array([max(1, int(round(2.0 / sp))) for sp in spacing])
        self.inv = np.linalg.inv(affine)
        self.spacing = np.asarray(spacing) * self.block
        all_of, solid_of = np.zeros(shape, dtype=bool), np.zeros(shape, dtype=bool)
        for s in structures:
            box = tuple(slice(a, a + n) for a, n in zip(s.start, s.mask.shape))
            all_of[box] |= s.mask
            if s.name in solid:
                solid_of[box] |= s.mask
        self.rings = [(r, w, self.blur(self.reduce(solid_of), b)) for r, b, w in self.RINGS]
        self.fold = self.blur(self.reduce(all_of), 2.6)

    def reduce(self, a):
        b = self.block
        cut = [(n // k) * k for n, k in zip(a.shape, b)]
        a = a[: cut[0], : cut[1], : cut[2]]
        return a.reshape(cut[0] // b[0], b[0], cut[1] // b[1], b[1], cut[2] // b[2], b[2]).mean(axis=(1, 3, 5), dtype=np.float32)

    def blur(self, a, sigma_mm):
        return ndimage.gaussian_filter(a, sigma=sigma_mm / self.spacing, mode="constant")

    def sample(self, volume, p):
        ijk = p @ self.inv[:3, :3].T + self.inv[:3, 3]
        at = (ijk - (self.block - 1) / 2) / self.block
        return ndimage.map_coordinates(volume, at.T, order=1, mode="constant", cval=0.0)

    def occlusion(self, p, n):
        """1 in the open, down toward 0 where the surroundings close in."""
        shade = np.zeros(len(p), dtype=np.float32)
        for r, weight, volume in self.rings:
            shade += weight * np.clip((self.sample(volume, p + n * r) - 0.09) / 0.91, 0, 1)
        return np.clip(1 - 1.9 * shade, 0, 1)

    def folding(self, p):
        """Above zero in a crease, below it on a ridge. A flat surface sits at exactly half occupancy."""
        return np.clip((self.sample(self.fold, p) - 0.5) * 3.2, -1, 1)


class Mottle:
    """The soft mottling of the organ library's noise ramp, without Blender. A random field wraps around, so any coordinate can be read from it."""

    def __init__(self):
        rng = np.random.default_rng(20261106)
        self.field = ndimage.gaussian_filter(rng.standard_normal((48, 48, 48)).astype(np.float32), sigma=1.4, mode="wrap")
        self.field /= self.field.std()

    def __call__(self, p, offset):
        total = np.zeros(len(p), dtype=np.float32)
        for scale, weight in ((6.0, 1.0), (15.0, 0.45), (36.0, 0.2)):
            total += weight * ndimage.map_coordinates(self.field, (p * scale + offset).T, order=1, mode="grid-wrap")
        return np.clip(0.5 + total * 0.21, 0, 1)


def ramp(t, tones):
    tones = np.asarray(tones, dtype=np.float32)
    low = np.clip((t - 0.2) / 0.3, 0, 1)[:, None]
    high = np.clip((t - 0.5) / 0.3, 0, 1)[:, None]
    return tones[0] * (1 - low) + tones[1] * low * (1 - high) + tones[2] * high


def colour(part, material, world, normal, model, shading, mottle):
    seed = sum(ord(c) * (i + 1) for i, c in enumerate(part["id"]))
    tones = part.get("tones") or material["tones"]
    base = ramp(mottle(model, seed % 97), tones)
    # Neighbours of one kind, such as a row of ribs, stay apart with a small difference in depth.
    base *= 0.92 + 0.16 * ((seed * 2654435761 % 2**32) / 2**32)
    folding = shading.folding(world)
    base *= (1 - material["crevice"] * np.clip(folding, 0, 1) * 0.8)[:, None]
    base *= (1 + 0.14 * np.clip(-folding, 0, 1))[:, None]
    shade = 0.2 + 0.8 * shading.occlusion(world, normal)  # The same mix as the organ library's bake.
    rgb = np.clip(base * shade[:, None], 0, 1)
    return np.concatenate([rgb, np.ones((len(rgb), 1), dtype=np.float32)], axis=1).astype(np.float32)


# ------------------------------------------------------------------ output


def write_glb(path, parts):
    """One named node per part, positions, normals and COLOR_0, and no materials, as the model contract asks. glTF is simple enough to write by hand, and that keeps a big dependency out."""
    views, accessors, meshes, nodes, chunks = [], [], [], [], []
    offset = 0

    def add(data, component, kind, target, extra=None):
        nonlocal offset
        raw = data.tobytes()
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(raw), "target": target})
        accessor = {"bufferView": len(views) - 1, "componentType": component, "count": len(data), "type": kind}
        if extra:
            accessor.update(extra)
        accessors.append(accessor)
        chunks.append(raw + b"\0" * (-len(raw) % 4))
        offset += len(raw) + (-len(raw) % 4)
        return len(accessors) - 1

    for p in parts:
        v, n, c, f = p["v"].astype(np.float32), p["n"].astype(np.float32), p["c"].astype(np.float32), p["f"]
        indices = add(f.ravel().astype(np.uint32), 5125, "SCALAR", 34963)
        position = add(v, 5126, "VEC3", 34962, {"min": v.min(axis=0).tolist(), "max": v.max(axis=0).tolist()})
        normal = add(n, 5126, "VEC3", 34962)
        col = add(c, 5126, "VEC4", 34962)
        meshes.append({"name": p["id"], "primitives": [{"attributes": {"POSITION": position, "NORMAL": normal, "COLOR_0": col}, "indices": indices, "mode": 4}]})
        nodes.append({"name": p["id"], "mesh": len(meshes) - 1})
    doc = {
        "asset": {"version": "2.0", "generator": "dashkit import_segmentation.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": offset}],
    }
    text = json.dumps(doc, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    with open(path, "wb") as out:
        out.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(text) + 8 + offset))
        out.write(struct.pack("<II", len(text), 0x4E4F534A))
        out.write(text)
        out.write(struct.pack("<II", offset, 0x004E4942))
        for c in chunks:
            out.write(c)


def millilitres(value):
    if value >= 100:
        return f"{value:,.0f} mL"
    if value >= 10:
        return f"{value:.1f} mL"
    if value >= 1:
        return f"{value:.2f} mL"
    return f"{value:.3f} mL"


def choose_pins(parts, count):
    """The largest structures that can be seen from the front, each marked at a point on the part of it that shows. Glass parts do not hide what is behind them."""
    cell = 0.012
    size = int(2.6 / cell)

    def depth_map(chosen):
        depth = np.full((size, size), -np.inf)
        for p in chosen:
            ij = np.clip(((p["v"][:, :2] + 1.3) / cell).astype(int), 0, size - 1)
            np.maximum.at(depth, (ij[:, 0], ij[:, 1]), p["v"][:, 2])
        return depth

    solid = depth_map([p for p in parts if not p.get("glass")])
    every = depth_map(parts)
    pins, placed = [], []
    for p in sorted(parts, key=lambda q: -q["ml"]):
        depth = every if p.get("glass") else solid
        ij = np.clip(((p["v"][:, :2] + 1.3) / cell).astype(int), 0, size - 1)
        seen = p["v"][:, 2] >= depth[ij[:, 0], ij[:, 1]] - 0.02
        if seen.sum() < 12:
            continue
        points = p["v"][seen]
        centre = points.mean(axis=0)
        at = points[np.argmin(np.linalg.norm((points - centre)[:, :2], axis=1))]
        if any(np.linalg.norm(at - q) < 0.28 for q in placed):
            continue
        pins.append({"part": p["id"], "at": [round(float(x), 4) for x in at]})
        placed.append(at)
        if len(pins) == count:
            break
    return pins


def part_id(name, used):
    base = re.sub(r"[^a-zA-Z0-9_]+", "_", normalise(name)).strip("_") or "part"
    pid, i = base, 2
    while pid in used:
        pid, i = f"{base}_{i}", i + 1
    used.add(pid)
    return pid


def cut_faces(s, shape, axcodes):
    """Which faces of the image a structure reaches. There the scan ends and the structure may go on, so its volume can only be a lower bound."""
    faces = []
    for axis in range(3):
        if s.start[axis] == 0:
            faces.append(FACE_NAMES[OPPOSITE[axcodes[axis]]])
        if s.start[axis] + s.mask.shape[axis] == shape[axis]:
            faces.append(FACE_NAMES[axcodes[axis]])
    return faces


def render_poster(folder, size):
    """Optional. The page shows it while three loads; a case without one just opens empty for that moment."""
    blender = os.environ.get("BLENDER", "/Applications/Blender.app/Contents/MacOS/Blender")
    if not os.path.exists(blender):
        print(f"  no poster: Blender not found at {blender}; set BLENDER to its path")
        return
    r = subprocess.run([blender, "-b", "-P", os.path.join(ROOT, "scripts", "segmentation", "poster.py"), "--", os.path.join(folder, "model.raw.glb"), os.path.join(folder, "manifest.json"), os.path.join(folder, "poster.webp"), str(size), "48"], cwd=ROOT, capture_output=True, text=True)
    if "POSTER " not in r.stdout:
        print(f"  no poster: Blender failed\n{r.stdout[-500:]}\n{r.stderr[-500:]}")


def compress(folder):
    subprocess.run(["sh", os.path.join(ROOT, "scripts", "organs", "compress.sh"), folder], check=True, cwd=ROOT, stdout=subprocess.DEVNULL)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("input")
    p.add_argument("--name", required=True, help="the case's folder name, and the name passed to <Organ>")
    p.add_argument("--out", default=os.path.join(ROOT, "assets", "cases"))
    p.add_argument("--labels", help="a labels JSON: nnU-Net dataset.json, MONAI metadata.json or label_dict.json, or plain")
    p.add_argument("--task", default="total", help="the class map for a multilabel file with no label table of its own: total or total_mr (default total)")
    p.add_argument("--stats", help="TotalSegmentator's statistics.json, when it is not beside the input")
    p.add_argument("--tool", help="what made the segmentation, for the credit")
    p.add_argument("--title")
    p.add_argument("--about")
    p.add_argument("--source-credit", default="", help="where the scan came from, with its licence")
    p.add_argument("--add", action="append", default=[], help="another mask on the same grid, for a part from another run, such as skin.nii.gz from TotalSegmentator's body task")
    p.add_argument("--skip", default="", help="comma-separated structures to leave out, such as skull when a face must not be rebuilt")
    p.add_argument("--only", default="", help="comma-separated structures to keep")
    p.add_argument("--budget", type=int, default=420000, help="triangles for the whole case")
    p.add_argument("--max-part", type=int, default=36000)
    p.add_argument("--min-part", type=int, default=500)
    p.add_argument("--min-ml", type=float, default=0.05, help="smaller structures are too small to make into a shape; they are listed in the manifest instead")
    p.add_argument("--min-piece", type=int, default=8, help="stray islands below this many voxels are not meshed, though they stay in the volume")
    p.add_argument("--blur", type=float, default=0.65, help="the blur on each mask before meshing, in voxels")
    p.add_argument("--smooth", type=int, default=16, help="Taubin passes")
    p.add_argument("--fine", type=float, default=1.5, help="voxels coarser than this many mm are sampled finer before meshing")
    p.add_argument("--pins", type=int, default=5)
    p.add_argument("--poster", type=int, default=0, metavar="SIZE", help="also render poster.webp at this size with Blender")
    p.add_argument("--no-compress", action="store_true", help="leave model.raw.glb, for tests")
    args = p.parse_args()
    t0 = time.time()

    print(f"reading {args.input}")
    scan = read_source(args)
    for extra in args.add:
        img = nib.load(extra)
        if img.shape[:3] != tuple(scan.shape) or not np.allclose(img.affine, scan.affine, atol=1e-3):
            raise SystemExit(f"{extra}: its grid differs from the input's, so it cannot be laid over it")
        s = from_mask(re.sub(r"\.nii(\.gz)?$", "", os.path.basename(extra)), np.asanyarray(img.dataobj) > 0)
        if s:
            scan.structures.append(s)
    spacing = np.linalg.norm(scan.affine[:3, :3], axis=0)
    voxel_ml = abs(np.linalg.det(scan.affine[:3, :3])) / 1000
    axcodes = nib.aff2axcodes(scan.affine)
    print(f"  {scan.format}, {scan.shape}, {np.round(spacing, 3).tolist()} mm, stored {''.join(axcodes)}, {len(scan.structures)} non-empty structures, made by {scan.tool}")
    if not scan.orientation_known:
        print("  WARNING: orientation is not recorded in this file, so left, right, front and back may be wrong")

    skip = {normalise(n) for n in args.skip.split(",") if n}
    only = {normalise(n) for n in args.only.split(",") if n}
    dropped, kept = [], []
    for s in scan.structures:
        key = normalise(s.name)
        ml = s.voxels * voxel_ml
        if key in skip or (only and key not in only):
            dropped.append({"name": s.name, "ml": round(ml, 3), "why": "left out on request"})
        elif ml < args.min_ml or s.voxels < args.min_piece:
            dropped.append({"name": s.name, "ml": round(ml, 3), "why": "too small to shape"})
        else:
            s.cut = cut_faces(s, scan.shape, axcodes)
            kept.append(s)
    if not kept:
        raise SystemExit("nothing left to import")
    scan.structures = kept

    print(f"meshing {len(kept)} structures")
    surfaces = {}
    for s in kept:
        surfaces[s.name] = build_surface(s, spacing, scan.affine, args)
    print(f"  meshed at {time.time() - t0:.1f}s, {sum(len(f) for _, f in surfaces.values()):,} raw triangles")

    used, parts = set(), []
    for s in kept:
        info = describe(s.name, s.overrides)
        pid = part_id(s.name, used)
        ml = s.voxels * voxel_ml
        parts.append({"id": pid, "s": s, "info": info, "ml": ml, "glass": info.get("glass")})
    # Sampling coarse voxels finer makes them smoother and adds no real detail, so such a scan does not get to spend the whole budget.
    finer = float(np.prod([max(1, int(np.ceil(sp / args.fine))) for sp in spacing])) ** (2 / 3)
    ceilings = [min(args.max_part, len(surfaces[q["s"].name][1]) / finer) for q in parts]
    budget = allot_faces([surface_area(*surfaces[q["s"].name]) for q in parts], args.budget, args.min_part, ceilings)

    # The fit: real proportions with one uniform scale, the longest side 2 units, centred on the box. That scale is written down, so the model can still be measured.
    lows, highs = [], []
    for q in parts:
        v = surfaces[q["s"].name][0] @ RAS_TO_MODEL.T
        lows.append(v.min(axis=0))
        highs.append(v.max(axis=0))
    low, high = np.min(lows, axis=0), np.max(highs, axis=0)
    centre = (low + high) / 2
    scale = 2 / float((high - low).max())

    tones = materials()
    solid = {q["s"].name for q in parts if not q["glass"]}
    shading = Shading(kept, solid, scan.shape, scan.affine, spacing)
    mottle = Mottle()
    print(f"  shading ready at {time.time() - t0:.1f}s")

    report = []
    for q, target in zip(parts, budget):
        s = q["s"]
        raw_v, raw_f = surfaces[s.name]
        v, f = slim(raw_v, raw_f, target)
        n = vertex_normals(v, f)
        model = (v @ RAS_TO_MODEL.T - centre) * scale
        q.update(v=model.astype(np.float32), n=(n @ RAS_TO_MODEL.T).astype(np.float32), f=f)
        q["c"] = colour({"id": q["id"], **q["info"]}, tones[q["info"]["kind"]], v, n, model, shading, mottle)
        mesh_ml = abs(signed_volume(raw_v, raw_f)) / 1000
        slim_ml = abs(signed_volume(v, f)) / 1000
        q["mesh_ratio"] = round(slim_ml / q["ml"], 3)
        report.append((q["info"]["label"], s.voxels, q["ml"], mesh_ml / q["ml"], slim_ml / q["ml"], len(f), ",".join(s.cut)))

    # Order the parts as the body goes, group by group.
    group_rank = {g[0]: i for i, g in enumerate(GROUPS)}
    parts.sort(key=lambda q: (group_rank.get(q["info"]["group"], len(GROUPS)), ORDER.get(normalise(q["s"].name), 10**6), q["id"]))

    out_dir = os.path.join(os.path.abspath(args.out), args.name)
    os.makedirs(out_dir, exist_ok=True)
    write_glb(os.path.join(out_dir, "model.raw.glb"), parts)

    manifest_parts = []
    for q in parts:
        s, info = q["s"], q["info"]
        about = info["about"]
        stat = scan.stats.get(s.name) or scan.stats.get(normalise(s.name)) or {}
        stats = {"ml": round(q["ml"], 3), "voxels": s.voxels}
        if stat:
            stats["toolMl"] = round(float(stat.get("volume", 0)) / 1000, 3)
            stats["intensity"] = stat.get("intensity")
            # TotalSegmentator reports zero for what it treats as incomplete, a judgement worth keeping beside this importer's own.
            if float(stat.get("volume", 0)) == 0:
                stats["toolSaysIncomplete"] = True
        measure_entry = {"label": "Volume", "value": millilitres(q["ml"])}
        if s.cut:
            stats["cutAt"] = s.cut
            where = " and ".join(s.cut[:2]) if len(s.cut) <= 2 else "several edges"
            about += f" Here it runs into the {where} of the scan, so part of it may be missing and the volume can only read low."
            measure_entry = {"label": "Volume in scan (cut off)", "value": "at least " + millilitres(q["ml"])}
        entry = {"id": q["id"], "label": info["label"], "about": about, "group": info["group"], "kind": info["kind"]}
        if info.get("glass"):
            entry["glass"] = info["glass"]
        if info.get("vessel"):
            entry["vessel"] = True
        entry["measure"] = measure_entry
        entry["stats"] = stats
        manifest_parts.append(entry)

    groups_seen = {q["info"]["group"] for q in parts}
    known_groups = [{"id": g, "label": label, "about": about} for g, label, about in GROUPS if g in groups_seen]
    for g in sorted(groups_seen - {g[0] for g in GROUPS}):  # A label override may name a new group.
        known_groups.append({"id": g, "label": g.replace("_", " ").capitalize(), "about": ""})
    layers = []
    for layer_id, label, about, members in LAYERS:
        ids = [q["id"] for q in parts if q["info"]["group"] in members]
        if ids:
            layers.append({"id": layer_id, "label": label, "about": about, "parts": ids})
    strays = [q["id"] for q in parts if q["info"]["group"] not in LAYER_OF_GROUP]
    if strays:
        layers.append({"id": "more", "label": "More", "about": "", "parts": strays})

    extent = (high - low).tolist()
    cut_count = sum(1 for q in parts if q["s"].cut)
    title = args.title or args.name.replace("-", " ").replace("_", " ").capitalize()
    about = args.about or (
        f"A real scan, segmented by {scan.tool} into {len(parts)} structures, shown at its true proportions ({extent[0]:.0f} by {extent[1]:.0f} by {extent[2]:.0f} mm). "
        f"The volumes are counted from the segmentation's voxels."
        + (f" {cut_count} structures run into the edge of the scan, so their volumes read low." if cut_count else "")
    )
    credit = f"Segmentation: {scan.tool}. " + (args.source_credit.rstrip(". ") + ". " if args.source_credit else "") + "Surfaces and volumes computed from its labels; colour is illustration. Not a medical device. Not for diagnosis."
    manifest = {
        "name": args.name,
        "title": title,
        "about": about,
        "credit": credit,
        "pulse": None,
        "groups": known_groups,
        "layers": layers,
        "parts": manifest_parts,
        "pins": choose_pins(parts, args.pins),
        "flows": [],
        "gates": [],
        "source": {
            "format": scan.format,
            "tool": scan.tool,
            "shape": list(map(int, scan.shape)),
            "spacingMm": [round(float(x), 4) for x in spacing],
            "storedAs": "".join(axcodes),
            "orientationRecorded": scan.orientation_known,
            "mmPerUnit": round(1 / scale, 3),
            "empty": scan.empty,
            "dropped": dropped,
        },
    }
    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f)

    print(f"  {'structure':32} {'voxels':>9} {'mL':>9} {'mesh/vox':>9} {'slim/vox':>9} {'faces':>7}  cut at")
    for label, voxels, ml, raw_ratio, slim_ratio, faces, cut in report:
        print(f"  {label:32} {voxels:>9,} {ml:>9.2f} {raw_ratio:>9.3f} {slim_ratio:>9.3f} {faces:>7,}  {cut}")
    if scan.stats:
        off = [(s.name, s.voxels * voxel_ml, float(scan.stats[s.name]["volume"]) / 1000) for s in kept if s.name in scan.stats and float(scan.stats[s.name].get("volume", 0)) > 0]
        worst = max((abs(a - b) / b for _, a, b in off), default=0)
        print(f"  statistics.json: {len(off)} volumes compared with ours, largest difference {worst * 100:.2f}%")
    if dropped:
        print(f"  not meshed: {', '.join(d['name'] + ' (' + d['why'] + ')' for d in dropped)}")
    print(f"  {sum(len(q['f']) for q in parts):,} triangles, {1 / scale:.1f} mm per unit, {time.time() - t0:.1f}s")

    if args.poster:
        render_poster(out_dir, args.poster)
    if not args.no_compress:
        compress(out_dir)
    final = os.path.join(out_dir, "model.glb" if not args.no_compress else "model.raw.glb")
    print(f"wrote {final}, {os.path.getsize(final) / 1e6:.2f} MB, in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
