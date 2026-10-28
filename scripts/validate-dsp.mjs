// Regression test: voice must be preserved, ambient noise must be reduced.
// Run: pnpm test:dsp   (node --experimental-strip-types scripts/validate-dsp.mjs)
import { SpectralDenoiser, DENOISE_LATENCY } from '../src/dsp/spectralDenoiser.ts';
import { computeRiemannFourier, generateSyntheticWindow } from '../src/dsp/riemannFourier.ts';

const fs = 44100, N = fs * 6, TWO_PI = 2 * Math.PI;
const db = v => 20 * Math.log10(v);

function biquad(type, f0, Q, x) {
  const w0 = TWO_PI * f0 / fs, c = Math.cos(w0), s = Math.sin(w0);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'notch') { const al = s / (2 * Q); b0 = 1; b1 = -2 * c; b2 = 1; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else { const al = s / (2 * Math.pow(10, Q / 20)); const hp = type === 'highpass';
    b0 = hp ? (1 + c) / 2 : (1 - c) / 2; b1 = hp ? -(1 + c) : 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) { const v = (b0 * x[n] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; y[n] = v; x2 = x1; x1 = x[n]; y2 = y1; y1 = v; }
  return y;
}
let seed = 987654321; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

// Speech-like voice: harmonic stack on a gliding pitch, syllable gating (0.35s on / 0.15s off)
function voice(gated) {
  const y = new Float32Array(N); let ph = 0;
  const H = [[1, 1], [2, .8], [3, .6], [4, .5], [5, .6], [6, .4], [8, .3], [9, .35], [12, .2]];
  const ph_k = new Float64Array(H.length);
  for (let n = 0; n < N; n++) {
    const t = n / fs, f0 = 130 + 25 * Math.sin(TWO_PI * 0.7 * t) + 6 * Math.sin(TWO_PI * 4.5 * t);
    let v = 0; for (let h = 0; h < H.length; h++) { ph_k[h] += TWO_PI * f0 * H[h][0] / fs; v += H[h][1] * Math.sin(ph_k[h]); }
    const env = gated ? ((t % 0.5) < 0.35 ? 1 : 0) : 1;
    y[n] = 0.08 * v * env;
  }
  return y;
}
function pink(gain) {
  const y = new Float32Array(N); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < N; i++) { const w = rnd() * 2 - 1;
    b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
    b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
    y[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * gain; b6 = w * .115926; }
  return y;
}
const rms = (a, from, to) => { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return Math.sqrt(s / (to - from)); };
const scaleTo = (x, target, ref) => { const g = target / rms(x, 0, N); return x.map(v => v * g); };

function denoise(x, { on = true } = {}) {
  const d = new SpectralDenoiser(); d.enabled = on;
  const out = new Float32Array(x.length), B = 1024;
  for (let i = 0; i < x.length; i += B) d.process(x.subarray(i, i + B), out.subarray(i, i + B));
  return out;
}
// Split output into voice-component and residual by least squares fit against the clean voice (delay compensated)
function fit(out, V, from) {
  let best = null;
  for (let D = DENOISE_LATENCY - 8; D <= DENOISE_LATENCY + 8; D++) {
    let xy = 0, xx = 0;
    for (let i = from; i < N; i++) { xy += out[i] * V[i - D]; xx += V[i - D] ** 2; }
    const g = xy / xx; let res = 0, sig = 0;
    for (let i = from; i < N; i++) { const e = out[i] - g * V[i - D]; res += e * e; sig += (g * V[i - D]) ** 2; }
    if (!best || res < best.res) best = { D, g, res, sig };
  }
  return { gainDb: db(Math.abs(best.g)), snr: 10 * Math.log10(best.sig / best.res) };
}

const from = fs * 2; // let the noise tracker converge
const rows = []; let failed = 0;
function check(name, cond, detail) { if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + name + '  ' + detail); }

for (const snrIn of [0, 10]) {
  for (const gated of [true, false]) {
    const V = voice(gated);
    const Vp = rms(V, from, N);
    const noise = scaleTo(pink(1), Vp / Math.pow(10, snrIn / 20));
    const mix = V.map((v, i) => v + noise[i]);
    // Baseline = what the OLD pipeline did (lowpass 3200 only)
    const lp = biquad('lowpass', 3200, 2, mix), lpV = biquad('lowpass', 3200, 2, V);
    const base = (() => { const n = lp.map((v, i) => v - lpV[i]); return db(rms(lpV, from, N) / rms(n, from, N)); })();
    // New pipeline: voice-band HP/LP + denoiser
    const chain = x => biquad('lowpass', 3800, 0, biquad('highpass', 80, 0, x));
    const out = denoise(chain(mix));
    const r = fit(out, chain(V), from);
    rows.push({ escenario: `ruido rosa, SNR in ${snrIn} dB, voz ${gated ? 'con pausas' : 'continua'}`, 'SNR viejo': +base.toFixed(1), 'SNR nuevo': +r.snr.toFixed(1), 'mejora vs viejo': +(r.snr - base).toFixed(1), 'ganancia voz dB': +r.gainDb.toFixed(1) });
    check(`SNR in ${snrIn} dB ${gated ? 'gated' : 'continuous'}: noise reduced`, r.snr - snrIn >= 4, `ΔSNR=${(r.snr - snrIn).toFixed(1)} dB (need ≥ 4)`);
    check(`SNR in ${snrIn} dB ${gated ? 'gated' : 'continuous'}: voice kept`, r.gainDb > -3, `voice gain=${r.gainDb.toFixed(1)} dB (need > -3)`);
  }
}
// Voice alone must pass untouched (no denoiser damage when there is no noise)
{
  const V = voice(true); const out = denoise(V); const r = fit(out, V, from);
  check('voice alone transparent', r.gainDb > -1.5, `voice gain=${r.gainDb.toFixed(2)} dB (need > -1.5)`);
}
// Calculus II Numerical Quadrature check: Simpson 1/3 and Trapezoid must converge to Exact Analytical Integral F(T)-F(0)
{
  const win = generateSyntheticWindow(0.04, 44100, 60);
  const qRes = computeRiemannFourier(win.samples, 44100, 60, 200, { noiseFrequency: 60, isLiveCapture: false, method: 'simpson' });
  const errRiemann = qRes.quadrature.riemann_left.relErrorPct;
  const errTrapz = qRes.quadrature.trapezoid.relErrorPct;
  const errSimpson = qRes.quadrature.simpson.relErrorPct;
  check('Calculus II Simpson 1/3 high accuracy (< 0.02% rel error)', errSimpson < 0.02, `simpson relErr=${errSimpson.toFixed(6)}%`);
  check('Calculus II Simpson 1/3 beats Left Riemann', errSimpson < errRiemann, `simpson=${errSimpson.toFixed(6)}% vs riemann=${errRiemann.toFixed(4)}%`);
  check('Calculus II Trapezoid beats Left Riemann', errTrapz < errRiemann, `trapz=${errTrapz.toFixed(4)}% vs riemann=${errRiemann.toFixed(4)}%`);
}
console.table(rows);
if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log('\nAll DSP & Calculus II Quadrature checks passed');
