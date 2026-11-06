import { apply4, labelVoxels } from "./measure.js";

// Surfaces for the 3D view. NiiVue's ray caster draws segmentation overlays with no lighting at all, which reads as flat colour
// blobs, so each class is turned into a real mesh instead: surface nets over its voxels, then Taubin smoothing to take out the
// voxel staircase without shrinking thin parts like ribs and vessels.

const CUBE_EDGES = new Int32Array(24);
const EDGE_TABLE = new Int32Array(256);
(() => {
  let k = 0;
  for (let i = 0; i < 8; i++)
    for (let j = 1; j <= 4; j <<= 1) {
      const p = i ^ j;
      if (i <= p) {
        CUBE_EDGES[k++] = i;
        CUBE_EDGES[k++] = p;
      }
    }
  for (let i = 0; i < 256; i++) {
    let em = 0;
    for (let j = 0; j < 24; j += 2) {
      const a = !!(i & (1 << CUBE_EDGES[j]));
      const b = !!(i & (1 << CUBE_EDGES[j + 1]));
      em |= a !== b ? 1 << (j >> 1) : 0;
    }
    EDGE_TABLE[i] = em;
  }
})();

// mask: Uint8Array of nx*ny*nz, non-zero inside. Vertices come back in grid coordinates (voxel centres on the integers).
export function surfaceNets(mask, nx, ny, nz) {
  const positions = [];
  const quads = [];
  const R = [1, nx + 1, (nx + 1) * (ny + 1)];
  const buffer = new Int32Array(R[2] * 2);
  const x = [0, 0, 0];
  let n = 0;
  let bufNo = 1;
  for (x[2] = 0; x[2] < nz - 1; x[2]++, n += nx, bufNo ^= 1, R[2] = -R[2]) {
    let m = 1 + (nx + 1) * (1 + bufNo * (ny + 1));
    for (x[1] = 0; x[1] < ny - 1; x[1]++, n++, m += 2)
      for (x[0] = 0; x[0] < nx - 1; x[0]++, n++, m++) {
        let cube = 0;
        let g = 0;
        let idx = n;
        for (let k = 0; k < 2; k++, idx += nx * (ny - 2))
          for (let j = 0; j < 2; j++, idx += nx - 2)
            for (let i = 0; i < 2; i++, g++, idx++) if (mask[idx]) cube |= 1 << g;
        if (cube === 0 || cube === 0xff) continue;
        const edges = EDGE_TABLE[cube];
        let vx = 0;
        let vy = 0;
        let vz = 0;
        let count = 0;
        for (let i = 0; i < 12; i++) {
          if (!(edges & (1 << i))) continue;
          count++;
          const e0 = CUBE_EDGES[i << 1];
          const e1 = CUBE_EDGES[(i << 1) + 1];
          // The field is binary, so every crossing sits halfway along its edge.
          vx += ((e0 & 1) + (e1 & 1)) * 0.5;
          vy += ((e0 & 2 ? 1 : 0) + (e1 & 2 ? 1 : 0)) * 0.5;
          vz += ((e0 & 4 ? 1 : 0) + (e1 & 4 ? 1 : 0)) * 0.5;
        }
        const s = 1 / count;
        buffer[m] = positions.length / 3;
        positions.push(x[0] + s * vx, x[1] + s * vy, x[2] + s * vz);
        for (let i = 0; i < 3; i++) {
          if (!(edges & (1 << i))) continue;
          const iu = (i + 1) % 3;
          const iv = (i + 2) % 3;
          if (x[iu] === 0 || x[iv] === 0) continue;
          const du = R[iu];
          const dv = R[iv];
          if (cube & 1) quads.push(buffer[m], buffer[m - du], buffer[m - du - dv], buffer[m - dv]);
          else quads.push(buffer[m], buffer[m - dv], buffer[m - du - dv], buffer[m - du]);
        }
      }
  }
  const tris = new Uint32Array((quads.length / 4) * 6);
  for (let i = 0, t = 0; i < quads.length; i += 4) {
    tris[t++] = quads[i];
    tris[t++] = quads[i + 1];
    tris[t++] = quads[i + 2];
    tris[t++] = quads[i];
    tris[t++] = quads[i + 2];
    tris[t++] = quads[i + 3];
  }
  return { positions: new Float32Array(positions), tris };
}

// Taubin's lambda and mu passes: a shrink followed by an inflate, so the surface loses its noise but keeps its size.
export function taubin(positions, tris, iterations = 10, lambda = 0.5, mu = -0.53) {
  const n = positions.length / 3;
  if (!n) return positions;
  const sum = new Float32Array(n * 3);
  const count = new Uint16Array(n);
  const pass = (k) => {
    sum.fill(0);
    count.fill(0);
    for (let t = 0; t < tris.length; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = tris[t + e];
        const b = tris[t + ((e + 1) % 3)];
        sum[a * 3] += positions[b * 3];
        sum[a * 3 + 1] += positions[b * 3 + 1];
        sum[a * 3 + 2] += positions[b * 3 + 2];
        count[a]++;
        sum[b * 3] += positions[a * 3];
        sum[b * 3 + 1] += positions[a * 3 + 1];
        sum[b * 3 + 2] += positions[a * 3 + 2];
        count[b]++;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!count[i]) continue;
      for (let c = 0; c < 3; c++) positions[i * 3 + c] += k * (sum[i * 3 + c] / count[i] - positions[i * 3 + c]);
    }
  };
  for (let i = 0; i < iterations; i++) {
    pass(lambda);
    pass(mu);
  }
  return positions;
}

// World coordinates, and winding fixed so that faces point outward. An affine with a negative determinant (any LPS file) would
// otherwise turn the mesh inside out, and back-face culling would show its far side.
function finish(positions, tris, toWorld) {
  const n = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const p = apply4(toWorld, [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]);
    positions[i * 3] = p[0];
    positions[i * 3 + 1] = p[1];
    positions[i * 3 + 2] = p[2];
  }
  // Measured from the mesh's own middle, because the body shell is open and a sum taken from the world origin would mislead.
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    cx += positions[i * 3] / n;
    cy += positions[i * 3 + 1] / n;
    cz += positions[i * 3 + 2] / n;
  }
  let signed = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t] * 3, tris[t + 1] * 3, tris[t + 2] * 3];
    const [ax, ay, az] = [positions[a] - cx, positions[a + 1] - cy, positions[a + 2] - cz];
    const [bx, by, bz] = [positions[b] - cx, positions[b + 1] - cy, positions[b + 2] - cz];
    const [dx, dy, dz] = [positions[c] - cx, positions[c + 1] - cy, positions[c + 2] - cz];
    signed += ax * (by * dz - bz * dy) - ay * (bx * dz - bz * dx) + az * (bx * dy - by * dx);
  }
  if (signed < 0)
    for (let t = 0; t < tris.length; t += 3) {
      const s = tris[t + 1];
      tris[t + 1] = tris[t + 2];
      tris[t + 2] = s;
    }
  return { positions, tris };
}

// At full resolution a real scan would take many seconds and draw millions of triangles for a view a few hundred pixels across, so
// it is thinned first. The first labelled voxel in each block wins, which keeps thin structures alive where plain sampling would
// break them up. Volumes and readouts are not affected: they always use the full-resolution labels.
export function thinLabels(vol, maxVoxels = 6e6) {
  const { nx, ny, nz, at } = labelVoxels(vol);
  const total = nx * ny * nz;
  const step = Math.max(1, Math.ceil(Math.cbrt(total / maxVoxels)));
  if (step === 1) return { nx, ny, nz, step, at };
  const mx = Math.ceil(nx / step);
  const my = Math.ceil(ny / step);
  const mz = Math.ceil(nz / step);
  const out = new Uint16Array(mx * my * mz);
  for (let z = 0, n = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++, n++) {
        const v = Math.round(at(n));
        if (!v) continue;
        const i = Math.floor(x / step) + Math.floor(y / step) * mx + Math.floor(z / step) * mx * my;
        if (!out[i]) out[i] = v;
      }
  return { nx: mx, ny: my, nz: mz, step, at: (i) => out[i] };
}

// One class's surface, in world millimetres. box is its bounding box in file voxels.
export function classSurface(grid, id, box, affine, smoothing = 10) {
  const { nx, ny, nz, step, at } = grid;
  const pad = 1;
  const x0 = Math.floor(box[0] / step);
  const y0 = Math.floor(box[1] / step);
  const z0 = Math.floor(box[2] / step);
  const x1 = Math.min(Math.floor(box[3] / step), nx - 1);
  const y1 = Math.min(Math.floor(box[4] / step), ny - 1);
  const z1 = Math.min(Math.floor(box[5] / step), nz - 1);
  const mx = x1 - x0 + 1 + pad * 2;
  const my = y1 - y0 + 1 + pad * 2;
  const mz = z1 - z0 + 1 + pad * 2;
  const mask = new Uint8Array(mx * my * mz);
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (Math.round(at(x + y * nx + z * nx * ny)) === id) mask[x - x0 + pad + (y - y0 + pad) * mx + (z - z0 + pad) * mx * my] = 1;
  const { positions, tris } = surfaceNets(mask, mx, my, mz);
  taubin(positions, tris, smoothing);
  // Grid coordinates back to file voxels, then the affine to world millimetres.
  const half = (step - 1) / 2;
  const toWorld = affine.map((row) => [
    row[0] * step,
    row[1] * step,
    row[2] * step,
    row[3] + row[0] * ((x0 - pad) * step + half) + row[1] * ((y0 - pad) * step + half) + row[2] * ((z0 - pad) * step + half),
  ]);
  return finish(positions, tris, toWorld);
}

// The patient's outer surface from the image itself, for the glass shell around the organs: everything brighter than air, holes
// filled slice by slice so lungs and bowel gas leave no inner shells, then the largest connected piece, which drops the CT table.
// Glass shows every wrinkle, so the mask is blurred and the mesh smoothed far harder than an organ's would be.
export function bodySurface(vol, threshold, spacingMm = 6) {
  const { hdr, img } = vol;
  const dims = [hdr.dims[1], hdr.dims[2], Math.max(hdr.dims[3], 1)];
  const d = hdr.pixDims;
  const step = Math.max(1, Math.round(spacingMm / Math.min(d[1], d[2], d[3])));
  // Work with the head-to-foot axis as the third, whichever way the file was acquired.
  const upAxis = [0, 1, 2].reduce((best, j) => (Math.abs(hdr.affine[2][j]) > Math.abs(hdr.affine[2][best]) ? j : best), 2);
  const order = [0, 1, 2].filter((j) => j !== upAxis).concat(upAxis);
  // One empty voxel around the sides closes the shell where the body runs past the edge of the field of view. The ends stay open,
  // like a cut sleeve, rather than growing lids that would hide what is inside.
  const pad = 1;
  const na = Math.ceil(dims[order[0]] / step) + pad * 2;
  const nb = Math.ceil(dims[order[1]] / step) + pad * 2;
  const nc = Math.ceil(dims[order[2]] / step);
  if (nc < 3) return null;
  const plane = na * nb;
  const slope = !hdr.scl_slope || Number.isNaN(hdr.scl_slope) ? 1 : hdr.scl_slope;
  const inter = Number.isNaN(hdr.scl_inter) ? 0 : hdr.scl_inter || 0;
  const stride = [1, dims[0], dims[0] * dims[1]];
  const sa = stride[order[0]] * step;
  const sb = stride[order[1]] * step;
  const sc = stride[order[2]] * step;
  let mask = new Uint8Array(plane * nc);
  for (let c = 0; c < nc; c++)
    for (let b = 0; b < nb - pad * 2; b++)
      for (let a = 0; a < na - pad * 2; a++)
        if (img[a * sa + b * sb + c * sc] * slope + inter > threshold) mask[a + pad + (b + pad) * na + c * plane] = 1;

  const stack = new Int32Array(plane * 2);
  const outside = new Uint8Array(plane);
  for (let c = 0; c < nc; c++) {
    const base = c * plane;
    outside.fill(0);
    let top = 0;
    const seed = (i) => {
      if (!outside[i] && !mask[base + i]) {
        outside[i] = 1;
        stack[top++] = i;
      }
    };
    for (let a = 0; a < na; a++) {
      seed(a);
      seed(a + (nb - 1) * na);
    }
    for (let b = 0; b < nb; b++) {
      seed(b * na);
      seed(na - 1 + b * na);
    }
    while (top) {
      const i = stack[--top];
      const a = i % na;
      if (a > 0) seed(i - 1);
      if (a < na - 1) seed(i + 1);
      if (i >= na) seed(i - na);
      if (i < na * (nb - 1)) seed(i + na);
    }
    for (let i = 0; i < plane; i++) if (!outside[i]) mask[base + i] = 1;
  }

  const labels = new Int32Array(mask.length);
  const queue = new Int32Array(mask.length);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || labels[i]) continue;
    next++;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    labels[i] = next;
    const visit = (o) => {
      if (mask[o] && !labels[o]) {
        labels[o] = next;
        queue[tail++] = o;
      }
    };
    while (head < tail) {
      const o = queue[head++];
      const a = o % na;
      const b = Math.floor(o / na) % nb;
      const c = Math.floor(o / plane);
      if (a > 0) visit(o - 1);
      if (a < na - 1) visit(o + 1);
      if (b > 0) visit(o - na);
      if (b < nb - 1) visit(o + na);
      if (c > 0) visit(o - plane);
      if (c < nc - 1) visit(o + plane);
    }
    if (tail > bestSize) {
      bestSize = tail;
      best = next;
    }
  }
  for (let i = 0; i < mask.length; i++) mask[i] = labels[i] === best ? 1 : 0;
  mask = blurMask(mask, na, nb, nc, pad);

  const { positions, tris } = surfaceNets(mask, na, nb, nc);
  taubin(positions, tris, 40);
  // Working grid back to file voxels, then the affine to world millimetres.
  const half = (step - 1) / 2;
  const toWorld = hdr.affine.slice(0, 3).map((row) => {
    const out = [0, 0, 0, row[3]];
    [0, 1, 2].forEach((w) => {
      const j = order[w];
      out[w] = row[j] * step;
      out[3] += row[j] * half - (w < 2 ? row[j] * step * pad : 0);
    });
    return out;
  });
  return finish(positions, tris, toWorld);
}

// A small blur and a threshold, which takes out speckle and the one-voxel ridges that would catch the light on glass. The pad stays
// empty so that the shell stays closed around the sides.
function blurMask(mask, na, nb, nc, pad) {
  const plane = na * nb;
  const out = new Uint8Array(mask.length);
  const r = 2;
  const reach = (2 * r + 1) ** 3;
  for (let c = 0; c < nc; c++)
    for (let b = pad; b < nb - pad; b++)
      for (let a = pad; a < na - pad; a++) {
        let sum = 0;
        let seen = 0;
        for (let k = -r; k <= r; k++) {
          const cc = c + k;
          if (cc < 0 || cc >= nc) continue;
          for (let j = -r; j <= r; j++) {
            const bb = b + j;
            if (bb < pad || bb >= nb - pad) continue;
            for (let i = -r; i <= r; i++) {
              const aa = a + i;
              if (aa < pad || aa >= na - pad) continue;
              sum += mask[aa + bb * na + cc * plane];
              seen++;
            }
          }
        }
        // Counted against what lies inside the volume, so the shell does not shrink away from a cut edge.
        if (sum * 2 > (seen || reach)) out[a + b * na + c * plane] = 1;
      }
  return out;
}
