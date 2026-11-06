"""Reads the BodyParts3D 4.0 anatomy (CC BY 4.0, adult male) out of the Human Atlas data files, in metres, Y up, +X the body's left,
+Z its front, which is the space the whole heart build works in. Data only: nothing inside that folder is run."""
import json, os
import numpy as np


class Atlas:
    def __init__(self, folder):
        self.folder = folder
        meta = json.load(open(os.path.join(folder, "atlas.json")))
        self.parts = meta["parts"]
        self.by_id = {p["id"]: p for p in self.parts}
        self.chunks = {}

    def chunk(self, i):
        if i not in self.chunks:
            self.chunks[i] = open(os.path.join(self.folder, f"body-{i}.bin"), "rb").read()
        return self.chunks[i]

    def mesh(self, pid):
        """Vertices and triangles of one atlas mesh, with coincident vertices welded."""
        p = self.by_id[pid]
        b = self.chunk(p["chunk"])
        v = np.frombuffer(b, np.float32, p["vertexCount"] * 3, p["positions"]).reshape(-1, 3).astype(np.float64)
        f = np.frombuffer(b, np.uint32, p["indexCount"], p["indices"]).reshape(-1, 3).astype(np.int64)
        u, inv = np.unique(np.round(v * 1e6).astype(np.int64), axis=0, return_inverse=True)
        f = inv.ravel()[f]
        f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 2] != f[:, 0])]
        return u / 1e6, f

    def meshes(self, ids):
        vs, fs, n = [], [], 0
        for pid in ids:
            v, f = self.mesh(pid)
            vs.append(v)
            fs.append(f + n)
            n += len(v)
        return np.concatenate(vs), np.concatenate(fs)
