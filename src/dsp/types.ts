export type AudioSourceType = 'synthetic' | 'mic' | 'file';

export type FilterType = 'notch' | 'lowpass' | 'highpass' | 'bandpass';

export type PresetType = 'hum60' | 'whistle2500' | 'test1000' | 'voicePinkNoise';

export type QuadratureMethod = 'riemann_left' | 'riemann_midpoint' | 'trapezoid' | 'simpson';

export type InjectedNoiseType = 'none' | 'hum60' | 'whistle2500' | 'pink';

export interface FilterParams {
  type: FilterType;
  frequency: number; // Hz (e.g. 60 or 2500)
  q: number;         // Quality factor (sharpness)
  gain: number;      // dB (for peaking/shelf)
  enabled: boolean;
}

export interface AudioMetrics {
  rawPeakFreq: number;
  rawPeakMagDb: number;
  cleanPeakFreq: number;
  cleanPeakMagDb: number;
  attenuationDb: number;
  snrEstimateDb: number;
  // Integrales físicas en tiempo real (Cálculo II)
  rmsRaw: number;             // V_rms = sqrt((1/T) ∫_0^T [f(t)]² dt)
  rmsClean: number;           // V_rms = sqrt((1/T) ∫_0^T [s(t)]² dt)
  energyTimeRaw: number;      // E_t = ∫_0^T [f(t)]² dt (Simpson 1/3)
  energyTimeClean: number;    // E_t = ∫_0^T [s(t)]² dt (Simpson 1/3)
  energyFreqParseval: number; // E_ξ = ∫ |f̂(ξ)|² dξ (Identidad de Parseval)
  parsevalMatchPct: number;   // Exactitud empírica de Parseval (%)
}

export interface RiemannStep {
  t: number;
  signalVal: number;
  basisVal: number;
  productVal: number;
  cumulativeArea: number;
}

export interface QuadratureMethodMetrics {
  name: string;
  order: string;
  realCos: number;
  imagSin: number;
  magnitude: number;
  absError: number;
  relErrorPct: number;
}

export interface RiemannAnalysisResult {
  frequency: number;
  steps: RiemannStep[];
  totalAreaCos: number;
  totalAreaSin: number;
  magnitude: number;
  isHarmonicPeak: boolean;
  // Exact analytical integral (Segundo Teorema Fundamental del Cálculo F(T) - F(0))
  exactCos: number;
  exactSin: number;
  exactMagnitude: number;
  // Comparison of the 4 Calculus II numerical integration methods
  quadrature: Record<QuadratureMethod, QuadratureMethodMetrics>;
}
