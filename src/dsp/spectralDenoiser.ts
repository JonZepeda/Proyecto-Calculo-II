/**
 * Streaming spectral-subtraction denoiser (STFT, sqrt-Hann, 75% overlap).
 *
 * Wideband ambient noise cannot be removed with a fixed biquad because it shares the
 * voice band. Here the noise power spectrum N(ξ) is tracked per bin with a minimum
 * follower and subtracted from |F(ξ)|²:
 *     G(ξ) = max(g_min, 1 - α·N(ξ)/|F(ξ)|²),   Y(ξ) = G(ξ)·F(ξ)
 * Narrow voice harmonics are protected because N is capped by the local frequency
 * average (a tonal peak is far above its neighbours, a broadband floor is not).
 */

export const DENOISE_FRAME = 1024;
export const DENOISE_HOP = 256;
export const DENOISE_LATENCY = DENOISE_FRAME; // samples (frame fill + hop)

function fftInPlace(re: Float32Array, im: Float32Array, inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

export class SpectralDenoiser {
  private readonly N = DENOISE_FRAME;
  private readonly hop = DENOISE_HOP;
  private readonly bins = DENOISE_FRAME / 2 + 1;
  private readonly win: Float32Array;
  private readonly hist: Float32Array;
  private readonly ola: Float32Array;
  private readonly pending: Float32Array;
  private pendingCount = 0;
  private outHop: Float32Array;
  private outIdx = 0;
  private readonly re: Float32Array;
  private readonly im: Float32Array;
  private readonly smoothP: Float32Array;
  private readonly noise: Float32Array;
  private readonly noiseUse: Float32Array;
  private readonly gain: Float32Array;
  private initialised = false;

  /** Over-subtraction factor (higher = more aggressive). */
  public alpha = 3.0;
  /** Gain floor (linear amplitude). 0.1 = -20 dB residual, avoids "musical noise". */
  public floorGain = 0.06;
  public enabled = true;

  constructor() {
    this.win = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) this.win[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / this.N));
    this.hist = new Float32Array(this.N);
    this.ola = new Float32Array(this.N);
    this.pending = new Float32Array(this.hop);
    this.outHop = new Float32Array(this.hop);
    this.re = new Float32Array(this.N);
    this.im = new Float32Array(this.N);
    this.smoothP = new Float32Array(this.bins);
    this.noise = new Float32Array(this.bins);
    this.noiseUse = new Float32Array(this.bins);
    this.gain = new Float32Array(this.bins).fill(1);
  }

  public reset(): void {
    this.hist.fill(0); this.ola.fill(0); this.outHop.fill(0);
    this.pendingCount = 0; this.outIdx = 0; this.initialised = false;
    this.gain.fill(1);
  }

  /** Processes a block; output is delayed by DENOISE_LATENCY samples. */
  public process(input: Float32Array, output: Float32Array): void {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.outHop[this.outIdx++];
      this.pending[this.pendingCount++] = input[i];
      if (this.pendingCount === this.hop) {
        this.runFrame();
        this.pendingCount = 0;
        this.outIdx = 0;
      }
    }
  }

  private runFrame(): void {
    const { N, hop, bins, re, im } = this;
    this.hist.copyWithin(0, hop);
    this.hist.set(this.pending, N - hop);
    for (let i = 0; i < N; i++) { re[i] = this.hist[i] * this.win[i]; im[i] = 0; }
    fftInPlace(re, im, false);

    if (this.enabled) this.updateGains();
    else this.gain.fill(1);

    for (let k = 0; k < bins; k++) {
      re[k] *= this.gain[k]; im[k] *= this.gain[k];
      if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
    fftInPlace(re, im, true);

    // overlap-add (sqrt-Hann² at 75% overlap sums to 2)
    for (let i = 0; i < N; i++) this.ola[i] += (re[i] * this.win[i]) * 0.5;
    this.outHop.set(this.ola.subarray(0, hop));
    this.ola.copyWithin(0, hop);
    this.ola.fill(0, N - hop);
  }

  private updateGains(): void {
    const { bins, re, im, smoothP, noise, noiseUse, gain } = this;
    const P = new Float32Array(bins);
    for (let k = 0; k < bins; k++) P[k] = re[k] * re[k] + im[k] * im[k];

    if (!this.initialised) {
      for (let k = 0; k < bins; k++) { smoothP[k] = P[k]; noise[k] = P[k]; }
      this.initialised = true;
    }
    for (let k = 0; k < bins; k++) {
      smoothP[k] = 0.85 * smoothP[k] + 0.15 * P[k];
      // minimum follower: drops instantly, rises ~3 dB/s
      noise[k] = smoothP[k] < noise[k] ? smoothP[k] : Math.min(noise[k] * 1.004, smoothP[k]);
    }
    // cap by local frequency average so steady tonal peaks are never treated as noise
    const R = 8;
    for (let k = 0; k < bins; k++) {
      let s = 0, c = 0;
      for (let j = Math.max(0, k - R); j <= Math.min(bins - 1, k + R); j++) { s += noise[j]; c++; }
      noiseUse[k] = Math.min(noise[k], s / c);
    }
    for (let k = 0; k < bins; k++) {
      // minimum statistics under-estimates the mean periodogram: compensate with alpha
      const target = Math.max(this.floorGain * this.floorGain, 1 - (this.alpha * noiseUse[k]) / (P[k] + 1e-20));
      const g = Math.sqrt(target);
      // fast attack (let speech through), slower release (no flutter)
      gain[k] = g > gain[k] ? 0.5 * gain[k] + 0.5 * g : 0.85 * gain[k] + 0.15 * g;
    }
  }
}
