#!/usr/bin/env python3
"""
Checks the importer against shapes whose answers are known: ellipsoids of known volume, placed on the patient's left, right, front and top, stored in each of the voxel
orders and file formats that tools write.

  python scripts/segmentation/test_import.py

Everything is written to a temporary folder. Nothing here needs npx or Blender.
"""
import json, os, struct, subprocess, sys, tempfile

import nibabel as nib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from classes import CLASSES, GROUPS, KINDS, LAYER_OF_GROUP, TOTAL, TOTAL_MR, describe, normalise

FAILED = []


def check(ok, what):
    print(("  ok    " if ok else "  FAIL  ") + what)
    if not ok:
        FAILED.append(what)


# Each structure: label value, name, centre in RAS+ mm (x to the patient's right, y to the front, z to the top), semi-axes in mm.
SPHERES = [
    (1, "liver", (55, 0, 10), (40, 35, 30)),
    (2, "spleen", (-70, -10, 30), (20, 18, 25)),
    (3, "heart", (-15, 45, 70), (30, 28, 26)),
    (4, "vertebrae_L1", (0, -55, -40), (16, 16, 12)),
    (7, "mystery_blob", (0, 10, -70), (11, 11, 11)),
]
LABELS = {name: value for value, name, _, _ in SPHERES}


def volume_ml(axes):
    return 4 / 3 * np.pi * np.prod(axes) / 1000


def ras_grid(affine, shape):
    i, j, k = np.meshgrid(*[np.arange(n, dtype=np.float32) for n in shape], indexing="ij")
    a = affine.astype(np.float32)
    return a[0, 0] * i + a[0, 1] * j + a[0, 2] * k + a[0, 3], a[1, 0] * i + a[1, 1] * j + a[1, 2] * k + a[1, 3], a[2, 0] * i + a[2, 1] * j + a[2, 2] * k + a[2, 3]


def phantom(affine, shape, spheres=SPHERES):
    x, y, z = ras_grid(affine, shape)
    out = np.zeros(shape, dtype=np.uint8)
    for value, _, c, axes in spheres:
        out[((x - c[0]) / axes[0]) ** 2 + ((y - c[1]) / axes[1]) ** 2 + ((z - c[2]) / axes[2]) ** 2 <= 1] = value
    return out


def grid(order, spacing=(2.0, 2.0, 2.0), size=(110, 110, 110)):
    """An affine that stores the voxels in the given order, with the same world box every time, so every order must give the same result."""
    axes = {"R": (0, 1), "L": (0, -1), "A": (1, 1), "P": (1, -1), "S": (2, 1), "I": (2, -1)}
    a = np.zeros((4, 4))
    a[3, 3] = 1
    for column, letter in enumerate(order):
        row, sign = axes[letter]
        a[row, column] = sign * spacing[column]
        a[row, 3] = -sign * spacing[column] * (size[column] - 1) / 2
    return a


def read_glb(path):
    with open(path, "rb") as f:
        f.read(12)
        n, _ = struct.unpack("<II", f.read(8))
        doc = json.loads(f.read(n))
        m, _ = struct.unpack("<II", f.read(8))
        blob = f.read(m)
    shapes = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}
    kinds = {5126: np.float32, 5125: np.uint32}

    def accessor(i):
        a = doc["accessors"][i]
        v = doc["bufferViews"][a["bufferView"]]
        return np.frombuffer(blob, kinds[a["componentType"]], a["count"] * shapes[a["type"]], v["byteOffset"]).reshape(a["count"], -1)

    out = {}
    for node in doc["nodes"]:
        prim = doc["meshes"][node["mesh"]]["primitives"][0]
        out[node["name"]] = dict(v=accessor(prim["attributes"]["POSITION"]), n=accessor(prim["attributes"]["NORMAL"]), c=accessor(prim["attributes"]["COLOR_0"]), f=accessor(prim["indices"]).reshape(-1, 3))
    return out


def signed_volume(v, f):
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    return float((a.astype(np.float64) * np.cross(b, c)).sum() / 6)


def run(tmp, name, source, *more):
    r = subprocess.run([sys.executable, os.path.join(HERE, "import_segmentation.py"), source, "--name", name, "--out", tmp, "--no-compress", "--budget", "40000", *more], capture_output=True, text=True)
    if r.returncode:
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit(f"importer failed on {name}")
    folder = os.path.join(tmp, name)
    return json.load(open(os.path.join(folder, "manifest.json"))), read_glb(os.path.join(folder, "model.raw.glb")), r.stdout


def centroid(mesh):
    return mesh["v"].mean(axis=0)


def check_contract(manifest, meshes, title):
    ids = [p["id"] for p in manifest["parts"]]
    check(set(ids) == set(meshes), f"{title}: every part has its own node of the same name")
    check(all(p["kind"] in KINDS for p in manifest["parts"]), f"{title}: every kind is in the contract")
    in_layers = [pid for layer in manifest["layers"] for pid in layer["parts"]]
    check(sorted(in_layers) == sorted(ids), f"{title}: every part is in exactly one layer")
    check({p["group"] for p in manifest["parts"]} <= {g["id"] for g in manifest["groups"]}, f"{title}: every part's group is listed")
    check(all(pin["part"] in meshes for pin in manifest["pins"]) and manifest["pins"], f"{title}: pins sit on real parts")
    check(manifest["pulse"] is None and manifest["flows"] == [] and manifest["gates"] == [], f"{title}: no pulse, flows or gates")
    check("not for diagnosis" in manifest["credit"].lower(), f"{title}: the credit says it is not for diagnosis")
    check(all(signed_volume(m["v"], m["f"]) > 0 for m in meshes.values()), f"{title}: every surface faces outward, so the Slice view is right")
    check(all(np.isfinite(m["v"]).all() and np.isfinite(m["n"]).all() and np.isfinite(m["c"]).all() for m in meshes.values()), f"{title}: no NaNs")
    corners = np.array([[m["v"].min(axis=0), m["v"].max(axis=0)] for m in meshes.values()])
    low, high = corners[:, 0].min(axis=0), corners[:, 1].max(axis=0)
    check(abs(float((high - low).max()) - 2) < 0.01 and np.abs(low + high).max() < 0.01, f"{title}: fitted to 2 units and centred")
    check(all(0 <= m["c"].min() and m["c"].max() <= 1 for m in meshes.values()), f"{title}: colours are in range")


def test_table():
    print("class table")
    names = set(TOTAL.values())
    check(len(TOTAL) == 117, "the total task has 117 classes")
    check(not [n for n in names if normalise(n) not in CLASSES], "every class of total has a table entry")
    check(not [n for n in TOTAL_MR.values() if normalise(n) not in CLASSES], "every class of total_mr has a table entry")
    check(all(c["kind"] in KINDS for c in CLASSES.values()), "every kind in the table is in the contract")
    check(all(c["group"] in LAYER_OF_GROUP and c["group"] in {g[0] for g in GROUPS} for c in CLASSES.values()), "every group in the table belongs to one layer")
    check(all(c["about"].endswith(".") and len(c["about"]) > 20 for c in CLASSES.values()), "every class has a line of description")
    check(describe("Left Kidney")["label"] == "Left kidney", "a differently spelled name still finds its entry")
    check(describe("vertebrae_T12")["label"] == "T12 vertebra", "the case of a name does not matter")
    check(describe("some_unknown_thing")["kind"] == "deep", "an unknown class gets the generic kind")
    check(describe("portal_vessels_2")["vessel"] is True, "an unknown vessel is recognised from its words")


def test_label_map(tmp):
    print("format (c): label map with nnU-Net's dataset.json")
    affine = grid("RAS")
    data = phantom(affine, (110, 110, 110))
    path = os.path.join(tmp, "labels.nii.gz")
    nib.save(nib.Nifti1Image(data, affine), path)
    dataset = {"channel_names": {"0": "CT"}, "labels": {"background": 0, **LABELS}, "numTraining": 1, "file_ending": ".nii.gz"}
    labels = os.path.join(tmp, "dataset.json")
    json.dump(dataset, open(labels, "w"))
    manifest, meshes, _ = run(tmp, "nnunet", path, "--labels", labels)
    check_contract(manifest, meshes, "nnU-Net")
    check("nnU-Net" in manifest["credit"], "the credit names nnU-Net, from dataset.json")
    parts = {p["id"]: p for p in manifest["parts"]}
    for value, name, _, axes in SPHERES:
        pid = normalise(name)
        ml, want = parts[pid]["stats"]["ml"], volume_ml(axes)
        # Counting voxels of a small shape has a real discretisation error, which is not the importer's.
        check(abs(ml - want) / want < (0.015 if want > 30 else 0.05), f"{name}: measured {ml:.1f} mL, true {want:.1f} mL")
        mesh_ml = signed_volume(meshes[pid]["v"], meshes[pid]["f"]) * (manifest["source"]["mmPerUnit"] ** 3) / 1000
        check(abs(mesh_ml - ml) / ml < 0.04, f"{name}: the smoothed surface encloses {mesh_ml:.1f} mL, so smoothing did not shrink it")
        check(parts[pid]["measure"]["value"].endswith("mL") and "cutAt" not in parts[pid]["stats"], f"{name}: is whole, and its measure says so")
    check(parts["mystery_blob"]["kind"] == "deep" and parts["mystery_blob"]["label"] == "Mystery blob", "an unknown class still becomes a part, with a generic kind")
    # The model's axes: the patient's right is -X, their front is +Z, the top is +Y.
    liver, spleen, heart, spine = (centroid(meshes[k]) for k in ("liver", "spleen", "heart", "vertebrae_l1"))
    check(liver[0] < 0 < spleen[0], "the liver, on the patient's right, is at -X, the viewer's left from the Front button; the spleen is at +X")
    check(heart[2] > 0 > spine[2], "the heart, at the front, is at +Z; the spine, at the back, is at -Z")
    check(heart[1] > liver[1] > spine[1], "the heart is above the liver and the liver above the lumbar spine, on +Y")
    return manifest, meshes


def test_orientations(tmp, reference):
    print("orientation: the same patient stored in other voxel orders must come out the same")
    for order in ("LPS", "LAS", "PIR", "ASL", "RSP"):
        affine = grid(order)
        data = phantom(affine, (110, 110, 110))
        path = os.path.join(tmp, f"{order}.nii.gz")
        nib.save(nib.Nifti1Image(data, affine), path)
        labels = os.path.join(tmp, "dataset.json")
        manifest, meshes, _ = run(tmp, f"o{order}", path, "--labels", labels)
        worst = max(np.abs(centroid(meshes[k]) - centroid(reference[k])).max() for k in reference)
        check(worst < 0.02, f"{order} (determinant {np.linalg.det(affine[:3, :3]):+.0f}): parts sit where they did in RAS, worst difference {worst:.4f} units")
        check(all(signed_volume(m["v"], m["f"]) > 0 for m in meshes.values()), f"{order}: surfaces still face outward")
    # An oblique scan: the voxel grid is turned 25 degrees about the patient's long axis, and the affine alone says so.
    t = np.radians(25)
    turn = np.array([[np.cos(t), -np.sin(t), 0], [np.sin(t), np.cos(t), 0], [0, 0, 1]])
    affine = grid("RAS")
    affine[:3, :3] = turn @ affine[:3, :3]
    affine[:3, 3] = turn @ affine[:3, 3]
    data = phantom(affine, (110, 110, 110))
    path = os.path.join(tmp, "oblique.nii.gz")
    nib.save(nib.Nifti1Image(data, affine), path)
    manifest, meshes, _ = run(tmp, "oblique", path, "--labels", os.path.join(tmp, "dataset.json"))
    worst = max(np.abs(centroid(meshes[k]) - centroid(reference[k])).max() for k in reference)
    check(worst < 0.03, f"oblique grid: parts sit where they did, worst difference {worst:.4f} units")
    # Anisotropic voxels: a thick-slice scan.
    affine = grid("RAS", (1.5, 1.5, 5.0), (146, 146, 44))
    data = phantom(affine, (146, 146, 44))
    path = os.path.join(tmp, "thick.nii.gz")
    nib.save(nib.Nifti1Image(data, affine), path)
    manifest, meshes, _ = run(tmp, "thick", path, "--labels", os.path.join(tmp, "dataset.json"))
    liver = next(p for p in manifest["parts"] if p["id"] == "liver")
    want = volume_ml(SPHERES[0][3])
    check(abs(liver["stats"]["ml"] - want) / want < 0.02, f"1.5 x 1.5 x 5 mm voxels: liver measures {liver['stats']['ml']:.1f} mL, true {want:.1f} mL")
    check(abs(centroid(meshes["liver"])[1] - centroid(reference["liver"])[1]) < 0.06, "1.5 x 1.5 x 5 mm voxels: real proportions kept")


def test_cut_off(tmp):
    print("structures cut by the edge of the scan")
    spheres = [(1, "liver", (55, 0, 100), (40, 35, 30)), (2, "spleen", (-70, -10, 30), (20, 18, 25))]  # The world box ends at z = 109.
    affine = grid("LPS")
    data = phantom(affine, (110, 110, 110), spheres)
    path = os.path.join(tmp, "cut.nii.gz")
    nib.save(nib.Nifti1Image(data, affine), path)
    labels = os.path.join(tmp, "cut.json")
    json.dump({"liver": 1, "spleen": 2}, open(labels, "w"))
    manifest, meshes, _ = run(tmp, "cut", path, "--labels", labels)
    parts = {p["id"]: p for p in manifest["parts"]}
    check(parts["liver"]["stats"].get("cutAt") == ["top"], f"the liver reaches the scan's top, in an LPS file: {parts['liver']['stats'].get('cutAt')}")
    check("cut off" in parts["liver"]["measure"]["label"] and parts["liver"]["measure"]["value"].startswith("at least"), f"its measure says so: {parts['liver']['measure']}")
    check("cut" not in json.dumps(parts["spleen"]["measure"]), "the whole spleen is not marked")


def test_label_files(tmp):
    print("other label JSONs and channels")
    affine = grid("RAS")
    data = phantom(affine, (110, 110, 110))
    path = os.path.join(tmp, "labels.nii.gz")
    forms = {
        "nnU-Net v1": {"labels": {"0": "background", **{str(v): n for n, v in LABELS.items()}}, "modality": {"0": "CT"}},
        "MONAI metadata.json": {"name": "Test bundle", "network_data_format": {"outputs": {"pred": {"type": "image", "channel_def": {"0": "background", **{str(v): n for n, v in LABELS.items()}}}}}},
        "VISTA3D label_dict": dict(LABELS),
        "a list": [{"id": v, "name": n} for n, v in LABELS.items()],
    }
    for title, blob in forms.items():
        labels = os.path.join(tmp, "form.json")
        json.dump(blob, open(labels, "w"))
        manifest, meshes, _ = run(tmp, "form", path, "--labels", labels)
        check(set(meshes) == {normalise(n) for n in LABELS}, f"{title}: all five structures found and named")
    labels = os.path.join(tmp, "form.json")
    json.dump({"1": {"name": "liver", "about": "Our own words.", "kind": "coral", "group": "other"}, "whole_thing": [2, 3, 4, 7]}, open(labels, "w"))
    manifest, meshes, _ = run(tmp, "regions", path, "--labels", labels)
    parts = {p["id"]: p for p in manifest["parts"]}
    check(parts["liver"]["about"] == "Our own words." and parts["liver"]["kind"] == "coral", "a labels file can override a part's words and kind")
    check("whole_thing" in parts and parts["whole_thing"]["stats"]["voxels"] == int(np.isin(data, [2, 3, 4, 7]).sum()), "nnU-Net regions: a name with several values takes all of them")
    bare = os.path.join(tmp, "bare.nii.gz")
    nib.save(nib.Nifti1Image(data, affine), bare)
    manifest, meshes, _ = run(tmp, "bare", bare, "--task", "none")
    check({"label_1", "label_7"} <= set(meshes), "with no map at all, labels still become parts, named by number")
    manifest, meshes, _ = run(tmp, "numbers", bare, "--task", "total")
    check({p["label"] for p in manifest["parts"]} >= {"Spleen", "Right kidney"}, "with --task total, numbers are read through TotalSegmentator's class map")
    channels = np.stack([(data == v).astype(np.uint8) for v in range(0, 5)], axis=-1)
    hot = os.path.join(tmp, "hot.nii.gz")
    nib.save(nib.Nifti1Image(channels, affine), hot)
    json.dump({"0": "background", "1": "liver", "2": "spleen", "3": "heart", "4": "vertebrae_L1"}, open(labels, "w"))
    manifest, meshes, _ = run(tmp, "hot", hot, "--labels", labels)
    check({"liver", "spleen", "heart", "vertebrae_l1"} == set(meshes), "one channel per class, as some MONAI writers do")


def test_folder(tmp, reference):
    print("format (a): a folder of per-class masks, with statistics.json")
    affine = grid("RAS")
    data = phantom(affine, (110, 110, 110))
    folder = os.path.join(tmp, "folder")
    os.makedirs(folder, exist_ok=True)
    stats = {}
    for value, name, _, _ in SPHERES:
        nib.save(nib.Nifti1Image((data == value).astype(np.uint8), affine), os.path.join(folder, f"{name}.nii.gz"))
        stats[name] = {"volume": float((data == value).sum() * 8), "intensity": 42.0}
    nib.save(nib.Nifti1Image(np.zeros_like(data), affine), os.path.join(folder, "gallbladder.nii.gz"))
    stats["liver"]["volume"] = 0.0  # What TotalSegmentator writes for a structure at the border by default.
    json.dump(stats, open(os.path.join(folder, "statistics.json"), "w"))
    manifest, meshes, _ = run(tmp, "folder", folder)
    check_contract(manifest, meshes, "folder")
    parts = {p["id"]: p for p in manifest["parts"]}
    check("gallbladder" not in meshes and "gallbladder" in manifest["source"]["empty"], "an empty mask makes no part, and the manifest lists it")
    check(parts["spleen"]["stats"]["toolMl"] == parts["spleen"]["stats"]["ml"], "the tool's volume is kept beside ours and they agree")
    check(parts["liver"]["stats"].get("toolSaysIncomplete") is True, "the tool's zero for an incomplete structure is kept")
    worst = max(np.abs(centroid(meshes[k]) - centroid(reference[k])).max() for k in reference)
    check(worst < 0.001, f"same patient as the label map, worst difference {worst:.5f} units")


def test_seg_nrrd(tmp, reference):
    print("format (d): 3D Slicer .seg.nrrd, to Slicer's published field names")
    import nrrd

    affine = grid("RAS")
    data = phantom(affine, (110, 110, 110))
    # Slicer writes left-posterior-superior. The voxels stay put; only the header's frame differs.
    lps = np.diag([-1.0, -1.0, 1.0])
    base = {"type": "unsigned char", "encoding": "gzip", "space": "left-posterior-superior", "space origin": lps @ affine[:3, 3]}
    fields = {}
    for i, (value, name, _, _) in enumerate(SPHERES):
        fields.update({f"Segment{i}_ID": f"Segment_{i}", f"Segment{i}_Name": name, f"Segment{i}_LabelValue": str(value), f"Segment{i}_Layer": "0", f"Segment{i}_Color": "0.5 0.5 0.5"})
    path = os.path.join(tmp, "flat.seg.nrrd")
    nrrd.write(path, data, {**base, "kinds": ["domain"] * 3, "space directions": (lps @ affine[:3, :3]).T, **fields}, custom_field_map={k: "string" for k in fields})
    manifest, meshes, _ = run(tmp, "nrrdflat", path)
    check_contract(manifest, meshes, "seg.nrrd")
    worst = max(np.abs(centroid(meshes[k]) - centroid(reference[k])).max() for k in reference)
    check(worst < 0.001, f"one layer, LPS header: same patient as the NIfTI, worst difference {worst:.5f} units")
    check("3D Slicer" in manifest["credit"], "the credit names 3D Slicer")
    # Overlapping segments live in separate layers, the 4D form.
    layers = np.stack([(data == 1).astype(np.uint8), np.where(data == 1, 0, data)], axis=0)
    fields = {}
    for i, (value, name, _, _) in enumerate(SPHERES):
        fields.update({f"Segment{i}_Name": name, f"Segment{i}_LabelValue": str(value), f"Segment{i}_Layer": "0" if value == 1 else "1"})
    nan_row = np.full((1, 3), np.nan)
    path = os.path.join(tmp, "layers.seg.nrrd")
    nrrd.write(path, layers, {**base, "kinds": ["list", "domain", "domain", "domain"], "space directions": np.vstack([nan_row, (lps @ affine[:3, :3]).T]), **fields}, custom_field_map={k: "string" for k in fields})
    manifest, meshes, _ = run(tmp, "nrrdlayers", path)
    worst = max(np.abs(centroid(meshes[k]) - centroid(reference[k])).max() for k in reference)
    check(worst < 0.001, f"two layers: same patient, worst difference {worst:.5f} units")


def test_caret_table(tmp):
    print("format (b): --ml's own label table beats the class map")
    affine = grid("RAS")
    data = phantom(affine, (110, 110, 110))
    img = nib.Nifti1Image(data, affine)
    text = '<?xml version="1.0"?><CaretExtension><VolumeInformation Index="0"><LabelTable><Label Key="1" Red="0" Green="1" Blue="0" Alpha="1"><![CDATA[liver]]></Label><Label Key="2" Red="0" Green="0" Blue="1" Alpha="1"><![CDATA[spleen]]></Label><Label Key="3" Red="0" Green="0" Blue="1" Alpha="1"><![CDATA[heart]]></Label><Label Key="4" Red="1" Green="0" Blue="1" Alpha="1"><![CDATA[vertebrae_L1]]></Label><Label Key="7" Red="1" Green="0" Blue="1" Alpha="1"><![CDATA[mystery_blob]]></Label></LabelTable></VolumeInformation></CaretExtension>'
    img.header.extensions.append(nib.nifti1.Nifti1Extension(0, text.encode()))
    path = os.path.join(tmp, "ml.nii.gz")
    nib.save(img, path)
    manifest, meshes, _ = run(tmp, "ml", path)
    check(set(meshes) == {"liver", "spleen", "heart", "vertebrae_l1", "mystery_blob"}, "labels come from the file's own table")
    check("TotalSegmentator" in manifest["credit"], "and it is credited to TotalSegmentator")


def main():
    with tempfile.TemporaryDirectory() as tmp:
        test_table()
        manifest, meshes = test_label_map(tmp)
        test_orientations(tmp, meshes)
        test_cut_off(tmp)
        test_label_files(tmp)
        test_folder(tmp, meshes)
        test_seg_nrrd(tmp, meshes)
        test_caret_table(tmp)
    print(f"\n{'ALL PASSED' if not FAILED else str(len(FAILED)) + ' FAILED'}")
    for f in FAILED:
        print("  " + f)
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
