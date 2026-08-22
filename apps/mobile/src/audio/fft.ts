/** Radix-2 real FFT magnitudes (Hann window). Size must be a power of two. */
export function realFftMagnitudes(samples: ArrayLike<number>, size = 2048): Float32Array {
  const n = size;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const count = Math.min(n, samples.length);
  const denom = Math.max(1, count - 1);
  for (let i = 0; i < count; i += 1) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / denom);
    re[i] = (samples[i] ?? 0) * w;
  }

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i] ?? 0;
      const ti = im[i] ?? 0;
      re[i] = re[j] ?? 0;
      im[i] = im[j] ?? 0;
      re[j] = tr;
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wr = 1;
      let wi = 0;
      for (let j = 0; j < half; j += 1) {
        const i0 = i + j;
        const i1 = i0 + half;
        const uRe = re[i0] ?? 0;
        const uIm = im[i0] ?? 0;
        const xRe = re[i1] ?? 0;
        const xIm = im[i1] ?? 0;
        const vRe = xRe * wr - xIm * wi;
        const vIm = xRe * wi + xIm * wr;
        re[i0] = uRe + vRe;
        im[i0] = uIm + vIm;
        re[i1] = uRe - vRe;
        im[i1] = uIm - vIm;
        const nwr = wr * wlenRe - wi * wlenIm;
        wi = wr * wlenIm + wi * wlenRe;
        wr = nwr;
      }
    }
  }

  const mag = new Float32Array(n / 2);
  const norm = 2 / n;
  for (let i = 0; i < n / 2; i += 1) {
    mag[i] = Math.hypot(re[i] ?? 0, im[i] ?? 0) * norm;
  }
  return mag;
}

export function logBands(
  magnitudes: Float32Array,
  sampleRate: number,
  bandCount: number,
  prev: Float32Array,
): Float32Array {
  const bands = new Float32Array(bandCount);
  const binCount = magnitudes.length;
  const nyquist = sampleRate / 2;
  const fMin = 80;
  const fMax = Math.min(8000, nyquist * 0.85);
  for (let b = 0; b < bandCount; b += 1) {
    const t0 = b / bandCount;
    const t1 = (b + 1) / bandCount;
    const hz0 = fMin * (fMax / fMin) ** t0;
    const hz1 = fMin * (fMax / fMin) ** t1;
    const i0 = Math.max(0, Math.floor((hz0 / nyquist) * binCount));
    const i1 = Math.min(binCount, Math.max(i0 + 1, Math.ceil((hz1 / nyquist) * binCount)));
    let peak = 0;
    for (let i = i0; i < i1; i += 1) {
      peak = Math.max(peak, magnitudes[i] ?? 0);
    }
    const shelf = 0.95 + 0.45 * (b / Math.max(1, bandCount - 1));
    const db = 20 * Math.log10(peak + 1e-9);
    const mapped = Math.min(1, Math.max(0, (db + 90) / 72) * shelf);
    const last = prev[b] ?? 0;
    bands[b] = mapped >= last ? mapped : last * 0.72 + mapped * 0.28;
  }
  return bands;
}
