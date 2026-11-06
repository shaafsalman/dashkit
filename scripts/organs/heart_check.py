"""Checks a built heart for holes: a lumen may meet the open air only at a vessel's cut end. Anywhere else, a chamber or vessel wall is
open. Prints where, so a hole can be found and fixed rather than hidden.

  python3 -I scripts/organs/heart_check.py <work folder>"""
import os, pickle, sys
import numpy as np
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from heart_volume import ID


def holes(work):
    f = np.load(os.path.join(work, "fields.npz"))
    geo = pickle.load(open(os.path.join(work, "geometry.pkl"), "rb"))
    tissue, left, right, beyond, label = f["tissue"], f["left"], f["right"], f["beyond"], f["label"]
    lumen = (left | right) & ~tissue & ~beyond
    mass = tissue | lumen
    air = ~mass
    touch = lumen & ndi.binary_dilation(air) & ~f["cutzone"]
    idx = np.argwhere(touch)
    near_cut = np.zeros(len(idx), bool)
    bad = idx[~near_cut]
    if not len(bad):
        print("holes: none")
        return 0
    m = np.zeros(lumen.shape, bool)
    m[bad[:, 0], bad[:, 1], bad[:, 2]] = True
    lab, n = ndi.label(ndi.binary_dilation(m, iterations=2))
    names = {v: k for k, v in ID.items()}
    sizes = np.bincount(lab[m])
    print(f"holes: {len(bad)} voxels of lumen open to the air, in {n} places")
    for i in np.argsort(-sizes)[:12]:
        if i == 0 or sizes[i] == 0:
            continue
        pts = np.argwhere((lab == i) & m)
        c = geo["lo"] + pts.mean(0) * geo["h"]
        around = label[tuple(np.clip(pts + 2, 0, np.array(label.shape) - 1).T)]
        near = [names.get(int(x), "-") for x in np.unique(around) if x]
        print(f"  {sizes[i]:5d} voxels at {np.round(c, 3)} near {near[:4]}")
    return len(bad)


if __name__ == "__main__":
    holes(sys.argv[1])
