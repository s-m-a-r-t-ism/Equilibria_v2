// Box-counting dimension of a binary mask (1 = paint).
// Counts occupied boxes at sizes 2..64 px and fits log N against log(1/s).

export function boxCount(mask, w, h) {
  let filled = 0;
  for (let i = 0; i < mask.length; i++) filled += mask[i];
  const coverage = filled / mask.length;
  if (filled < 40) return { D: null, coverage };
  const sizes = [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  const xs = [], ys = [];
  for (const s of sizes) {
    const bw = Math.ceil(w / s), bh = Math.ceil(h / s);
    const occ = new Uint8Array(bw * bh);
    for (let y = 0; y < h; y++) {
      const row = y * w, by = ((y / s) | 0) * bw;
      for (let x = 0; x < w; x++) if (mask[row + x]) occ[by + ((x / s) | 0)] = 1;
    }
    let n = 0;
    for (let i = 0; i < occ.length; i++) n += occ[i];
    xs.push(Math.log(1 / s));
    ys.push(Math.log(n));
  }
  // least squares slope
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const D = Math.max(1, Math.min(2, num / den));
  return { D, coverage };
}
