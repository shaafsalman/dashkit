// What the viewer knows about a segmentation it works out from the voxels themselves: nothing here comes from a sidecar file, so
// the volumes and centres in the legend hold for any label map.

export function invert4(m) {
  // Rows of an affine: a 3x3 part and a translation.
  const [a, b, c] = [m[0], m[1], m[2]];
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const i = [
    [(b[1] * c[2] - b[2] * c[1]) / det, (a[2] * c[1] - a[1] * c[2]) / det, (a[1] * b[2] - a[2] * b[1]) / det, 0],
    [(b[2] * c[0] - b[0] * c[2]) / det, (a[0] * c[2] - a[2] * c[0]) / det, (a[2] * b[0] - a[0] * b[2]) / det, 0],
    [(b[0] * c[1] - b[1] * c[0]) / det, (a[1] * c[0] - a[0] * c[1]) / det, (a[0] * b[1] - a[1] * b[0]) / det, 0],
    [0, 0, 0, 1],
  ];
  for (let r = 0; r < 3; r++) i[r][3] = -(i[r][0] * a[3] + i[r][1] * b[3] + i[r][2] * c[3]);
  return i;
}

export const apply4 = (m, p) => [
  m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2] + m[0][3],
  m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2] + m[1][3],
  m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2] + m[2][3],
];

export function voxelVolumeMl(affine) {
  const [a, b, c] = affine;
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  return Math.abs(det) / 1000;
}

const scaling = (hdr) => ({
  // A NIfTI with no scaling stores NaN or 0 here; both mean "as stored".
  slope: !hdr.scl_slope || Number.isNaN(hdr.scl_slope) ? 1 : hdr.scl_slope,
  inter: Number.isNaN(hdr.scl_inter) ? 0 : hdr.scl_inter || 0,
});

// Label image as whole numbers in file order. Some writers (MONAI among them) store labels as floats.
export function labelVoxels(vol) {
  const { hdr, img } = vol;
  const nx = hdr.dims[1];
  const ny = hdr.dims[2];
  const nz = Math.max(hdr.dims[3], 1);
  const { slope, inter } = scaling(hdr);
  return { nx, ny, nz, img, at: slope === 1 && inter === 0 ? (i) => img[i] : (i) => img[i] * slope + inter };
}

// Per-class voxel count, volume, bounding box and centre of mass, in one pass.
export function measureLabels(vol) {
  const { nx, ny, nz, at } = labelVoxels(vol);
  const ml = voxelVolumeMl(vol.hdr.affine);
  const stats = new Map();
  let notLabels = 0;
  let n = 0;
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++, n++) {
        const raw = at(n);
        if (raw === 0) continue;
        const id = Math.round(raw);
        if (Math.abs(raw - id) > 1e-3 || id < 0) {
          notLabels++;
          continue;
        }
        let s = stats.get(id);
        if (!s) {
          s = { voxels: 0, sum: [0, 0, 0], box: [x, y, z, x, y, z] };
          stats.set(id, s);
        }
        s.voxels++;
        s.sum[0] += x;
        s.sum[1] += y;
        s.sum[2] += z;
        const b = s.box;
        if (x < b[0]) b[0] = x;
        if (y < b[1]) b[1] = y;
        if (z < b[2]) b[2] = z;
        if (x > b[3]) b[3] = x;
        if (y > b[4]) b[4] = y;
        if (z > b[5]) b[5] = z;
      }
  for (const s of stats.values()) {
    s.ml = s.voxels * ml;
    s.centre = s.sum.map((v) => v / s.voxels);
    // A class that reaches the edge of the volume carries on outside it, so its volume is only a lower bound.
    const b = s.box;
    s.cutOff = b[0] === 0 || b[1] === 0 || b[2] === 0 || b[3] === nx - 1 || b[4] === ny - 1 || b[5] === nz - 1;
    delete s.sum;
  }
  return { stats, voxelMl: ml, notLabels, total: n };
}

// The centre of mass of a curved structure can fall outside it (the colon, a rib), so a jump goes to the structure's voxel
// nearest that centre. The readout then always lands on the structure it was asked for.
export function nearestVoxelOf(vol, id, klass) {
  const { nx, ny, at } = labelVoxels(vol);
  const [cx, cy, cz] = klass.centre;
  const [x0, y0, z0, x1, y1, z1] = klass.box;
  const d = vol.hdr.pixDims;
  let best = null;
  let bestD = Infinity;
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (Math.round(at(x + y * nx + z * nx * ny)) !== id) continue;
        const dist = ((x - cx) * d[1]) ** 2 + ((y - cy) * d[2]) ** 2 + ((z - cz) * d[3]) ** 2;
        if (dist < bestD) {
          bestD = dist;
          best = [x, y, z];
        }
      }
  return best;
}
