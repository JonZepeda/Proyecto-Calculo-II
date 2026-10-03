export type AudioSourceType = 'synthetic' | 'mic' | 'file';

export type FilterType = 'notch' | 'lowpass' | 'highpass' | 'bandpass';

export type PresetType = 'hum60' | 'whistle2500' | 'test1000' | 'voicePinkNoise';

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
}

export interface RiemannStep {
  t: number;
  signalVal: number;
  basisVal: number;
  productVal: number;
  cumulativeArea: number;
}

export interface RiemannAnalysisResult {
  frequency: number;
  steps: RiemannStep[];
  totalAreaCos: number;
  totalAreaSin: number;
  magnitude: number;
  isHarmonicPeak: boolean;
}
