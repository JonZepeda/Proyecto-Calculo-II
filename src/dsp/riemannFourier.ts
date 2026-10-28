import type { QuadratureMethod, QuadratureMethodMetrics, RiemannAnalysisResult, RiemannStep } from './types';

/**
 * Evalúa la función analítica continua f(t) = s(t) + η(t) en cualquier instante real t ∈ [0, T]
 */
export function evaluateAnalyticalSignal(t: number, noiseFrequency: number = 60): number {
  const voice =
    0.35 * Math.sin(2 * Math.PI * 140 * t) +
    0.25 * Math.sin(2 * Math.PI * 700 * t) +
    0.20 * Math.sin(2 * Math.PI * 1260 * t);
  const noise = 0.50 * Math.sin(2 * Math.PI * noiseFrequency * t);
  return voice + noise;
}

/**
 * Calcula la Integral Analítica Exacta mediante el Segundo Teorema Fundamental del Cálculo:
 * ∫_0^T A_k sin(ω_k t) cos(ω_p t) dt = F(T) - F(0)
 * usando identidades trigonométricas de producto a suma.
 */
export function computeExactAnalyticalFourier(
  durationSeconds: number,
  probeFrequency: number,
  noiseFrequency: number
): { exactCos: number; exactSin: number; exactMagnitude: number } {
  const T = durationSeconds;
  const wp = 2 * Math.PI * probeFrequency;
  const components: Array<[number, number]> = [
    [0.35, 140],
    [0.25, 700],
    [0.20, 1260],
    [0.50, noiseFrequency],
  ];

  let exactCos = 0;
  let exactSin = 0;

  for (const [amp, fc] of components) {
    const wc = 2 * Math.PI * fc;
    if (Math.abs(wc - wp) < 1e-9) {
      // Caso resonancia exacta ω_c == ω_p
      exactCos += (amp * Math.pow(Math.sin(wc * T), 2)) / (2 * wc);
      exactSin += amp * (0.5 * T - Math.sin(2 * wc * T) / (4 * wc));
    } else {
      const diff = wc - wp;
      const sum = wc + wp;
      exactCos +=
        0.5 *
        amp *
        ((1 - Math.cos(diff * T)) / diff + (1 - Math.cos(sum * T)) / sum);
      exactSin +=
        0.5 *
        amp *
        (Math.sin(diff * T) / diff - Math.sin(sum * T) / sum);
    }
  }

  return {
    exactCos,
    exactSin: -exactSin,
    exactMagnitude: Math.hypot(exactCos, exactSin),
  };
}

/**
 * Calcula y compara los 4 métodos de cuadratura numérica de Cálculo II:
 * 1. Suma de Riemann (Izquierda)  — Orden O(Δt)
 * 2. Suma de Riemann (Punto Medio)— Orden O(Δt²)
 * 3. Regla del Trapecio Compuesta — Orden O(Δt²)
 * 4. Regla de Simpson 1/3         — Orden O(Δt⁴)
 */
export function computeRiemannFourier(
  signalSamples: number[],
  sampleRate: number,
  probeFrequency: number,
  maxSteps: number = 200,
  options?: {
    noiseFrequency?: number;
    isLiveCapture?: boolean;
    method?: QuadratureMethod;
  }
): RiemannAnalysisResult {
  // Asegurar N par para la Regla de Simpson 1/3
  let N = Math.max(10, Math.min(1000, Math.floor(maxSteps)));
  if (N % 2 !== 0) N += 1;

  const isLive = options?.isLiveCapture ?? false;
  const noiseFreq = options?.noiseFrequency ?? 60;
  const selectedMethod: QuadratureMethod = options?.method ?? 'simpson';

  const totalDuration = isLive
    ? (signalSamples.length - 1) / sampleRate
    : signalSamples.length / sampleRate;
  const T = totalDuration > 0 ? totalDuration : 0.04;
  const dt = T / N;
  const omega = 2 * Math.PI * probeFrequency;

  // Interpolación lineal sobre muestras capturadas o evaluación analítica exacta en t
  const sampleAt = (t: number): number => {
    if (!isLive) {
      return evaluateAnalyticalSignal(t, noiseFreq);
    }
    const idxFloat = t * sampleRate;
    const i0 = Math.max(0, Math.min(signalSamples.length - 1, Math.floor(idxFloat)));
    const i1 = Math.min(signalSamples.length - 1, i0 + 1);
    const frac = idxFloat - i0;
    return signalSamples[i0] * (1 - frac) + signalSamples[i1] * frac;
  };

  // Nodos t_0, t_1, ..., t_N
  const gCosNodes = new Float64Array(N + 1);
  const gSinNodes = new Float64Array(N + 1);
  const fNodes = new Float64Array(N + 1);
  const bNodes = new Float64Array(N + 1);

  for (let n = 0; n <= N; n++) {
    const t = n * dt;
    const fVal = sampleAt(t);
    const cosVal = Math.cos(omega * t);
    const sinVal = Math.sin(omega * t);
    fNodes[n] = fVal;
    bNodes[n] = cosVal;
    gCosNodes[n] = fVal * cosVal;
    gSinNodes[n] = fVal * sinVal;
  }

  // 1. Suma de Riemann Izquierda + pasos gráficos acumulados según el método elegido
  let riemannLeftCos = 0;
  let riemannLeftSin = 0;
  let riemannMidCos = 0;
  let riemannMidSin = 0;
  let trapzCos = 0;
  let trapzSin = 0;

  const steps: RiemannStep[] = [];
  let runningSelectedCos = 0;

  for (let n = 0; n < N; n++) {
    const t = n * dt;
    const tMid = (n + 0.5) * dt;
    const fMid = sampleAt(tMid);
    const gMidCos = fMid * Math.cos(omega * tMid);
    const gMidSin = fMid * Math.sin(omega * tMid);

    const dLeftCos = gCosNodes[n] * dt;
    const dLeftSin = gSinNodes[n] * dt;
    riemannLeftCos += dLeftCos;
    riemannLeftSin += dLeftSin;

    const dMidCos = gMidCos * dt;
    const dMidSin = gMidSin * dt;
    riemannMidCos += dMidCos;
    riemannMidSin += dMidSin;

    const dTrapCos = 0.5 * (gCosNodes[n] + gCosNodes[n + 1]) * dt;
    const dTrapSin = 0.5 * (gSinNodes[n] + gSinNodes[n + 1]) * dt;
    trapzCos += dTrapCos;
    trapzSin += dTrapSin;

    // Aporte del paso actual según el método seleccionado para la curva acumulada
    if (selectedMethod === 'riemann_left') {
      runningSelectedCos += dLeftCos;
    } else if (selectedMethod === 'riemann_midpoint') {
      runningSelectedCos += dMidCos;
    } else if (selectedMethod === 'trapezoid') {
      runningSelectedCos += dTrapCos;
    } else {
      // Parábola local de Simpson en el subintervalo [t_n, t_{n+1}] usando su punto medio
      runningSelectedCos += ((gCosNodes[n] + 4 * gMidCos + gCosNodes[n + 1]) * dt) / 6;
    }

    steps.push({
      t,
      signalVal: fNodes[n],
      basisVal: bNodes[n],
      productVal: selectedMethod === 'riemann_midpoint' ? gMidCos : gCosNodes[n],
      cumulativeArea: runningSelectedCos,
    });
  }

  // 4. Regla de Simpson 1/3 Compuesta estándar sobre los N subintervalos (N par):
  // (Δt / 3) * [g(t_0) + 4 Σ_{impar} g(t_n) + 2 Σ_{par} g(t_n) + g(t_N)]
  let simpsonCos = gCosNodes[0] + gCosNodes[N];
  let simpsonSin = gSinNodes[0] + gSinNodes[N];
  for (let n = 1; n < N; n++) {
    const weight = n % 2 === 1 ? 4 : 2;
    simpsonCos += weight * gCosNodes[n];
    simpsonSin += weight * gSinNodes[n];
  }
  simpsonCos *= dt / 3;
  simpsonSin *= dt / 3;

  // Valor Exacto de Referencia (Analítico exacto o Simpson fino sobre todas las muestras)
  let exactCos = 0;
  let exactSin = 0;
  let exactMagnitude = 0;

  if (!isLive) {
    const exact = computeExactAnalyticalFourier(T, probeFrequency, noiseFreq);
    exactCos = exact.exactCos;
    exactSin = exact.exactSin;
    exactMagnitude = exact.exactMagnitude;
  } else {
    // Integración de Simpson de máxima resolución sobre el buffer completo
    const M = signalSamples.length - 1;
    const dtFine = 1 / sampleRate;
    let sc = 0;
    let ss = 0;
    for (let i = 0; i < M; i++) {
      const t0 = i * dtFine;
      const t1 = (i + 1) * dtFine;
      sc += 0.5 * (signalSamples[i] * Math.cos(omega * t0) + signalSamples[i + 1] * Math.cos(omega * t1)) * dtFine;
      ss += 0.5 * (signalSamples[i] * Math.sin(omega * t0) + signalSamples[i + 1] * Math.sin(omega * t1)) * dtFine;
    }
    exactCos = sc;
    exactSin = -ss;
    exactMagnitude = Math.hypot(exactCos, exactSin);
  }

  const buildMethodMetric = (
    name: string,
    order: string,
    rc: number,
    rs: number
  ): QuadratureMethodMetrics => {
    const imag = -rs;
    const mag = Math.hypot(rc, imag);
    const absError = Math.hypot(rc - exactCos, imag - exactSin);
    const relErrorPct = exactMagnitude > 1e-7 ? (absError / exactMagnitude) * 100 : 0;
    return {
      name,
      order,
      realCos: rc,
      imagSin: imag,
      magnitude: mag,
      absError,
      relErrorPct,
    };
  };

  const quadrature: Record<QuadratureMethod, QuadratureMethodMetrics> = {
    riemann_left: buildMethodMetric(
      'Suma de Riemann (Izquierda)',
      'O(Δt) = O(1/N)',
      riemannLeftCos,
      riemannLeftSin
    ),
    riemann_midpoint: buildMethodMetric(
      'Suma de Riemann (Punto Medio)',
      'O(Δt²) = O(1/N²)',
      riemannMidCos,
      riemannMidSin
    ),
    trapezoid: buildMethodMetric(
      'Regla del Trapecio Compuesta',
      'O(Δt²) = O(1/N²)',
      trapzCos,
      trapzSin
    ),
    simpson: buildMethodMetric(
      'Regla de Simpson 1/3 Compuesta',
      'O(Δt⁴) = O(1/N⁴)',
      simpsonCos,
      simpsonSin
    ),
  };

  const chosen = quadrature[selectedMethod];

  return {
    frequency: probeFrequency,
    steps,
    totalAreaCos: chosen.realCos,
    totalAreaSin: -chosen.imagSin,
    magnitude: chosen.magnitude,
    isHarmonicPeak: chosen.magnitude > 0.004,
    exactCos,
    exactSin,
    exactMagnitude,
    quadrature,
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
    samples[n] = evaluateAnalyticalSignal(t, noiseFrequency);
  }

  return { samples, times };
}

/**
 * Computes a full spectrum sweep using Simpson 1/3 numerical integration across M frequencies
 * to empirically prove convergence of definite integrals to the spectral density.
 */
export function sweepRiemannSpectrum(
  signalSamples: number[],
  sampleRate: number,
  freqMin: number = 20,
  freqMax: number = 1500,
  stepsCount: number = 75,
  options?: { noiseFrequency?: number; isLiveCapture?: boolean }
): { freqs: number[]; magnitudes: number[] } {
  const freqs: number[] = [];
  const magnitudes: number[] = [];

  const df = (freqMax - freqMin) / stepsCount;

  for (let k = 0; k <= stepsCount; k++) {
    const f = freqMin + k * df;
    const res = computeRiemannFourier(signalSamples, sampleRate, f, 240, {
      ...options,
      method: 'simpson',
    });
    freqs.push(f);
    magnitudes.push(res.magnitude);
  }

  return { freqs, magnitudes };
}
