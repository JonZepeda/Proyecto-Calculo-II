/**
 * Streaming adaptive Wiener denoiser (STFT, sqrt-Hann, 75% overlap).
 *
 * A fixed biquad removes one frequency. Here every STFT cell (time, frequency) gets its own gain,
 * so the filter follows noise that changes shape: the noise power N(ξ) of each bin is tracked
 * continuously and the gain is the Wiener solution of  min_G E|S − G·Y|²  →  G = ξ/(1+ξ),
 * with ξ = P_S/P_N (a-priori SNR, estimated "decision-directed" so it is smooth in time). The gain applied to the
 * amplitude is the square root of that power gain, which keeps voice energy at moderate SNR.
 *
 * Noise tracking uses two rules:
 *  1) Broadband / changing noise: windowed minimum statistics (Martin), the minimum of the smoothed power of
 *     each bin over ~1.5 s, capped by the local frequency average so narrow voice harmonics are never taken
 *     as noise.
 *  2) Steady tones (whistle, hum): a bin that stands >10 dB above its neighbours AND whose level barely moves
 *     (std < 2 dB over ~0.6 s) is a tone, not speech (harmonics glide and stop), so it is attenuated.
 * Limit: a voiced sound that keeps exactly one pitch for more than ~1 s looks like a tone.
 */

export const DENOISE_FRAME = 1024;
export const DENOISE_HOP = 256;
export const DENOISE_LATENCY = DENOISE_FRAME; // samples (frame fill + hop)

/** Minimum window = SUBWIN_FRAMES × SUBWIN_COUNT frames (43 × 6 ≈ 1.5 s at 44.1 kHz, hop 256). */
const SUBWIN_FRAMES = 43;
const SUBWIN_COUNT = 6;
/** The minimum of a smoothed random power under-estimates its mean; calibrated with white noise: E[P] / min-estimate = 2.92 (median over bins and frames). */
export const MIN_BIAS = 2.9;
/** Tone detector: level tracked with time constant ≈ 1/(1-TONE_A) frames (≈ 0.6 s). */
const TONE_A = 0.99;
const TONE_PROMINENCE_DB = 10;
const TONE_MAX_STD_DB = 2;
/** No tone detection below ~300 Hz: the voice fundamental lives there and 43 Hz bins cannot resolve a 50/60 Hz hum. */
const TONE_MIN_BIN = 7;
/** Decision-directed smoothing of the a-priori SNR. */
const DD_ALPHA = 0.98;

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
  private readonly P: Float32Array;
  private readonly smoothP: Float32Array;
  private readonly curMin: Float32Array;
  private readonly histMin: Float32Array;
  private readonly ring: Float32Array[];
  private ringIdx = 0;
  private subCount = 0;
  private readonly prevClean: Float32Array;
  private readonly gain: Float32Array;
  private readonly mu: Float32Array;     // running mean of the level in dB
  private readonly vr: Float32Array;     // running variance of the level in dB²
  private readonly mPrefix: Float64Array; // prefix sums of the minimum, for the local average cap
  private readonly muPrefix: Float64Array;
  /** Noise power per bin actually used by the gain (read by tests). */
  public readonly noise: Float32Array;
  private initialised = false;

  /** Over-subtraction factor; the Wiener gain is ξ/(alpha/3 + ξ), so 3.0 = textbook Wiener. */
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
    this.P = new Float32Array(this.bins);
    this.smoothP = new Float32Array(this.bins);
    this.curMin = new Float32Array(this.bins);
    this.histMin = new Float32Array(this.bins);
    this.ring = Array.from({ length: SUBWIN_COUNT }, () => new Float32Array(this.bins));
    this.prevClean = new Float32Array(this.bins);
    this.mu = new Float32Array(this.bins);
    this.vr = new Float32Array(this.bins);
    this.mPrefix = new Float64Array(this.bins + 1);
    this.muPrefix = new Float64Array(this.bins + 1);
    this.noise = new Float32Array(this.bins);
    this.gain = new Float32Array(this.bins).fill(1);
    this.reset();
  }

  public reset(): void {
    this.hist.fill(0); this.ola.fill(0); this.outHop.fill(0);
    this.pendingCount = 0; this.outIdx = 0; this.initialised = false;
    this.gain.fill(1); this.prevClean.fill(0); this.histMin.fill(Infinity);
    this.mu.fill(0); this.vr.fill(0);
    this.ring.forEach(r => r.fill(Infinity));
    this.ringIdx = 0; this.subCount = 0;
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
    const { bins, re, im, P, smoothP, curMin, histMin, ring, noise, prevClean, gain } = this;
    for (let k = 0; k < bins; k++) P[k] = re[k] * re[k] + im[k] * im[k];

    if (!this.initialised) {
      for (let k = 0; k < bins; k++) { smoothP[k] = P[k]; curMin[k] = P[k]; }
      this.initialised = true;
    }

    // 1) windowed minimum of the smoothed power, per bin
    for (let k = 0; k < bins; k++) {
      smoothP[k] = 0.85 * smoothP[k] + 0.15 * P[k];
      if (smoothP[k] < curMin[k]) curMin[k] = smoothP[k];
    }
    if (++this.subCount === SUBWIN_FRAMES) {
      this.subCount = 0;
      ring[this.ringIdx].set(curMin);
      this.ringIdx = (this.ringIdx + 1) % SUBWIN_COUNT;
      for (let k = 0; k < bins; k++) {
        let m = Infinity;
        for (let r = 0; r < SUBWIN_COUNT; r++) if (ring[r][k] < m) m = ring[r][k];
        histMin[k] = m;
      }
      curMin.set(smoothP);
    }

    // 2) noise power per bin: minimum statistics capped by the local average, or the tone level for steady tones
    const { mu, vr, mPrefix, muPrefix } = this;
    for (let k = 0; k < bins; k++) {
      const db = Math.max(10 * Math.log10(smoothP[k] + 1e-20), -120);
      if (mu[k] === 0 && vr[k] === 0) { mu[k] = db; vr[k] = 25; }   // start "not steady" (std 5 dB)
      mu[k] = TONE_A * mu[k] + (1 - TONE_A) * db;
      const d = db - mu[k];
      vr[k] = TONE_A * vr[k] + (1 - TONE_A) * d * d;
      mPrefix[k + 1] = mPrefix[k] + Math.min(curMin[k], histMin[k]);
      muPrefix[k + 1] = muPrefix[k] + mu[k];
    }
    const R = 8;
    const beta = this.alpha / 4;
    const gmin = Math.max(this.floorGain, 0.03);
    for (let k = 0; k < bins; k++) {
      const lo = Math.max(0, k - R), hi = Math.min(bins - 1, k + R);
      const cap = (mPrefix[hi + 1] - mPrefix[lo]) / (hi - lo + 1);
      let lam = Math.min(Math.min(curMin[k], histMin[k]), cap) * MIN_BIAS + 1e-20;
      let isTone = false;

      // neighbours 6..10 bins away on both sides (outside the tone's main lobe)
      const l0 = Math.max(0, k - 10), l1 = Math.max(0, k - 6), r0 = Math.min(bins, k + 7), r1 = Math.min(bins, k + 11);
      const nb = (l1 - l0) + (r1 - r0);
      if (nb > 0 && k >= TONE_MIN_BIN) {
        const around = (muPrefix[l1] - muPrefix[l0] + muPrefix[r1] - muPrefix[r0]) / nb;
        if (mu[k] - around > TONE_PROMINENCE_DB && Math.sqrt(vr[k]) < TONE_MAX_STD_DB) {
          lam = Math.max(lam, Math.pow(10, mu[k] / 10));   // a steady tone is noise as loud as it is
          isTone = true;
        }
      }
      noise[k] = lam;
      // 3) Wiener gain with decision-directed a-priori SNR
      const gamma = P[k] / lam;
      const xi = DD_ALPHA * prevClean[k] / lam + (1 - DD_ALPHA) * Math.max(gamma - 1, 0);
      // amplitude gain: sqrt of the Wiener power gain; a detected steady tone is cut to the floor
      const g = isTone ? gmin : Math.max(Math.sqrt(xi / (beta + xi)), gmin);
      gain[k] = g;
      prevClean[k] = g * g * P[k];
    }
  }
}
