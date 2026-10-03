import { RiemannAnalysisResult, RiemannStep } from './types';

/**
 * Computes explicit Riemann Sums for the continuous Fourier Transform:
 * I(ξ) = ∫ [a, b] f(t) * e^(-i 2π ξ t) dt
 *      = ∫ f(t) cos(2π ξ t) dt - i ∫ f(t) sin(2π ξ t) dt
 *
 * This provides the mathematical and pedagogical proof of orthogonality
 * and area accumulation for Calculus II.
 */
export function computeRiemannFourier(
  signalSamples: number[],
  sampleRate: number,
  probeFrequency: number,
  maxSteps: number = 300
): RiemannAnalysisResult {
  const N = Math.min(signalSamples.length, maxSteps);
  const dt = 1 / sampleRate;
  const steps: RiemannStep[] = [];

  let totalAreaCos = 0;
  let totalAreaSin = 0;

  for (let n = 0; n < N; n++) {
    const t = n * dt;
    const signalVal = signalSamples[n];
    const omega = 2 * Math.PI * probeFrequency;
    const cosVal = Math.cos(omega * t);
    const sinVal = Math.sin(omega * t);

    // Product of signal and harmonic basis
    const productCos = signalVal * cosVal;
    const productSin = signalVal * sinVal;

    // Riemann rectangle area = height * width (f(tn) * cos(ω tn) * Δt)
    const dAreaCos = productCos * dt;
    const dAreaSin = productSin * dt;

    totalAreaCos += dAreaCos;
    totalAreaSin += dAreaSin;

    steps.push({
      t,
      signalVal,
      basisVal: cosVal,
      productVal: productCos,
      cumulativeArea: totalAreaCos,
    });
  }

  const magnitude = Math.sqrt(totalAreaCos * totalAreaCos + totalAreaSin * totalAreaSin);

  return {
    frequency: probeFrequency,
    steps,
    totalAreaCos,
    totalAreaSin,
    magnitude,
    isHarmonicPeak: magnitude > 0.05,
  };
}

/**
 * Generates an analytical window of a test signal:
 * f(t) = s(t) + η(t)
 * where s(t) is voice-like and η(t) is a pure stationary interference
 */
export function generateSyntheticWindow(
  durationSeconds: number = 0.04, // 40ms window
  sampleRate: number = 44100,
  noiseFrequency: number = 60
): { samples: number[]; times: number[] } {
  const N = Math.floor(durationSeconds * sampleRate);
  const samples = new Array(N);
  const times = new Array(N);
  const dt = 1 / sampleRate;

  for (let n = 0; n < N; n++) {
    const t = n * dt;
    times[n] = t;

    // Vocal voice formants (140Hz fundamental + 700Hz + 1260Hz)
    const voice =
      0.35 * Math.sin(2 * Math.PI * 140 * t) +
      0.25 * Math.sin(2 * Math.PI * 700 * t) +
      0.20 * Math.sin(2 * Math.PI * 1260 * t);

    // Stationary harmonic interference (e.g. 60Hz or 2500Hz)
    const noise = 0.50 * Math.sin(2 * Math.PI * noiseFrequency * t);

    samples[n] = voice + noise;
  }

  return { samples, times };
}

/**
 * Computes a full spectrum sweep using pure Riemann sums across M frequencies
 * to empirically prove convergence of Riemann integrals to the spectral density.
 */
export function sweepRiemannSpectrum(
  signalSamples: number[],
  sampleRate: number,
  freqMin: number = 20,
  freqMax: number = 3000,
  stepsCount: number = 100
): { freqs: number[]; magnitudes: number[] } {
  const freqs: number[] = [];
  const magnitudes: number[] = [];

  const df = (freqMax - freqMin) / stepsCount;

  for (let k = 0; k <= stepsCount; k++) {
    const f = freqMin + k * df;
    const res = computeRiemannFourier(signalSamples, sampleRate, f, 500);
    freqs.push(f);
    magnitudes.push(res.magnitude);
  }

  return { freqs, magnitudes };
}
