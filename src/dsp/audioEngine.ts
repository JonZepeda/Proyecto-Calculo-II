import { AudioMetrics, AudioSourceType, FilterParams, PresetType } from './types';
import { SpectralDenoiser } from './spectralDenoiser';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Nodes
  private masterGain: GainNode | null = null;
  private rawGainNode: GainNode | null = null;
  private cleanGainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  // Clean-branch chain: cleanIn -> filter -> hum harmonics (2f,3f) -> voice-band HP/LP -> spectral denoiser
  private cleanIn: GainNode | null = null;
  private harmNotch2: BiquadFilterNode | null = null;
  private harmNotch3: BiquadFilterNode | null = null;
  private voiceHP: BiquadFilterNode | null = null;
  private voiceLP: BiquadFilterNode | null = null;
  private denoiseNode: ScriptProcessorNode | null = null;
  private denoiser = new SpectralDenoiser();
  private voiceBandEnabled = true;
  private spectrumMean: Float32Array | null = null;
  private spectrumVar: Float32Array | null = null;
  private spectrumFloat: Float32Array<ArrayBuffer> | null = null;
  private rawAnalyser: AnalyserNode | null = null;
  private cleanAnalyser: AnalyserNode | null = null;

  // Active Sources
  private currentSourceType: AudioSourceType = 'synthetic';
  private currentPreset: PresetType = 'hum60';
  private syntheticNodes: {
    oscillators: OscillatorNode[];
    gains: GainNode[];
    noiseNode?: AudioBufferSourceNode;
  } = { oscillators: [], gains: [] };
  
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  
  private fileBuffer: AudioBuffer | null = null;
  private fileSourceNode: AudioBufferSourceNode | null = null;

  // Output control ('raw' | 'clean' | 'mute')
  private outputMode: 'raw' | 'clean' | 'mute' = 'clean';
  private isPlaying = false;

  // Filter settings cache
  private filterParams: FilterParams = {
    type: 'notch',
    frequency: 60,
    q: 12,
    gain: 0,
    enabled: true,
  };

  // Pre-allocated typed arrays for analyzers
  private fftSize = 2048;
  private rawTimeData: Uint8Array<ArrayBuffer>;
  private cleanTimeData: Uint8Array<ArrayBuffer>;
  private rawFreqData: Uint8Array<ArrayBuffer>;
  private cleanFreqData: Uint8Array<ArrayBuffer>;

  constructor() {
    this.rawTimeData = new Uint8Array(this.fftSize / 2) as Uint8Array<ArrayBuffer>;
    this.cleanTimeData = new Uint8Array(this.fftSize / 2) as Uint8Array<ArrayBuffer>;
    this.rawFreqData = new Uint8Array(this.fftSize / 2) as Uint8Array<ArrayBuffer>;
    this.cleanFreqData = new Uint8Array(this.fftSize / 2) as Uint8Array<ArrayBuffer>;
  }

  public async init(): Promise<void> {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.rawAnalyser = this.ctx.createAnalyser();
    this.rawAnalyser.fftSize = this.fftSize;
    this.rawAnalyser.smoothingTimeConstant = 0.8;

    this.cleanAnalyser = this.ctx.createAnalyser();
    this.cleanAnalyser.fftSize = this.fftSize;
    this.cleanAnalyser.smoothingTimeConstant = 0.8;

    // Clean branch chain
    this.cleanIn = this.ctx.createGain();
    this.filterNode = this.ctx.createBiquadFilter();
    this.harmNotch2 = this.ctx.createBiquadFilter();
    this.harmNotch3 = this.ctx.createBiquadFilter();
    this.voiceHP = this.ctx.createBiquadFilter();
    this.voiceLP = this.ctx.createBiquadFilter();
    this.voiceHP.type = 'highpass';
    this.voiceHP.frequency.value = 80;
    this.voiceHP.Q.value = 0;
    this.voiceLP.type = 'lowpass';
    this.voiceLP.frequency.value = 3800;
    this.voiceLP.Q.value = 0;

    // ScriptProcessor keeps the STFT denoiser dependency-free (no separate worklet bundle)
    this.denoiseNode = this.ctx.createScriptProcessor(1024, 1, 1);
    this.denoiseNode.onaudioprocess = ev => {
      this.denoiser.process(ev.inputBuffer.getChannelData(0), ev.outputBuffer.getChannelData(0));
    };

    this.cleanIn.connect(this.filterNode);
    this.filterNode.connect(this.harmNotch2);
    this.harmNotch2.connect(this.harmNotch3);
    this.harmNotch3.connect(this.voiceHP);
    this.voiceHP.connect(this.voiceLP);
    this.voiceLP.connect(this.denoiseNode);
    this.denoiseNode.connect(this.cleanAnalyser);
    this.applyFilterParams();

    // Gains for A/B switching and master volume
    this.rawGainNode = this.ctx.createGain();
    this.cleanGainNode = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

    // Initial state: listen to clean output
    this.updateGainRouting();

    // Connect gains to master then to destination
    this.rawGainNode.connect(this.masterGain);
    this.cleanGainNode.connect(this.masterGain);
    this.denoiseNode.connect(this.cleanGainNode);
    this.masterGain.connect(this.ctx.destination);

    this.isInitialized = true;
  }

  public async setSource(type: AudioSourceType, preset?: PresetType, file?: File): Promise<void> {
    await this.init();
    this.stopCurrentSource();

    this.currentSourceType = type;
    if (preset) {
      this.currentPreset = preset;
    }

    if (type === 'synthetic') {
      this.setupSyntheticSource(this.currentPreset);
    } else if (type === 'mic') {
      await this.setupMicSource();
    } else if (type === 'file' && file) {
      await this.setupFileSource(file);
    }

    this.isPlaying = true;
  }

  public setPreset(preset: PresetType): void {
    this.currentPreset = preset;
    if (this.currentSourceType === 'synthetic') {
      this.stopCurrentSource();
      this.setupSyntheticSource(preset);
      this.isPlaying = true;
    }

    // Auto-align default filter frequency to match preset for instant satisfying demo
    if (preset === 'hum60') {
      this.setFilterParams({ frequency: 60, q: 10, type: 'notch' });
    } else if (preset === 'whistle2500') {
      this.setFilterParams({ frequency: 2500, q: 15, type: 'notch' });
    } else if (preset === 'test1000') {
      this.setFilterParams({ frequency: 1000, q: 12, type: 'notch' });
    } else if (preset === 'voicePinkNoise') {
      this.setFilterParams({ frequency: 3200, q: 2, type: 'lowpass' });
    }
  }

  private setupSyntheticSource(preset: PresetType): void {
    if (!this.ctx || !this.rawAnalyser || !this.filterNode) return;

    const t = this.ctx.currentTime;
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    // Combiner node for the raw synthetic stream
    const synthMix = this.ctx.createGain();
    synthMix.gain.setValueAtTime(0.8, t);

    // 1. Simulated Voice (Formant carrier: Fundamental ~140Hz + vocal resonances ~700Hz, 1220Hz, 2400Hz)
    const baseFreq = 140;
    const voiceHarmonics = [
      { f: baseFreq * 1, gain: 0.35 },
      { f: baseFreq * 2, gain: 0.28 },
      { f: baseFreq * 3, gain: 0.22 },
      { f: baseFreq * 5, gain: 0.30 }, // ~700Hz F1
      { f: baseFreq * 8, gain: 0.18 },
      { f: baseFreq * 9, gain: 0.25 }, // ~1260Hz F2
    ];

    // Subtle pitch modulation (LFO vibrato) to simulate natural human speech phonemes
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(4.5, t); // 4.5 Hz speech syllable cadence
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(3.5, t); // 3.5 Hz pitch variance
    lfo.connect(lfoGain);

    voiceHarmonics.forEach(h => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(h.f, t);
      lfoGain.connect(osc.frequency);

      g.gain.setValueAtTime(h.gain * 0.4, t);
      osc.connect(g);
      g.connect(synthMix);

      osc.start();
      oscs.push(osc);
      gains.push(g);
    });
    lfo.start();
    oscs.push(lfo);

    // 2. Add specific interference based on the preset
    if (preset === 'hum60') {
      // 60 Hz mains hum with 120Hz & 180Hz odd/even induction harmonics
      const humFreqs = [
        { f: 60, gain: 0.55 },
        { f: 120, gain: 0.25 },
        { f: 180, gain: 0.15 },
      ];
      humFreqs.forEach(h => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(h.f, t);
        g.gain.setValueAtTime(h.gain, t);
        osc.connect(g);
        g.connect(synthMix);
        osc.start();
        oscs.push(osc);
        gains.push(g);
      });
    } else if (preset === 'whistle2500') {
      // 2500 Hz sharp whistle / turbine bearing whine
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2500, t);
      g.gain.setValueAtTime(0.5, t);
      osc.connect(g);
      g.connect(synthMix);
      osc.start();
      oscs.push(osc);
      gains.push(g);
    } else if (preset === 'test1000') {
      // 1000 Hz reference calibration tone
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, t);
      g.gain.setValueAtTime(0.5, t);
      osc.connect(g);
      g.connect(synthMix);
      osc.start();
      oscs.push(osc);
      gains.push(g);
    } else if (preset === 'voicePinkNoise') {
      // Generate 2 seconds of pink/white noise buffer in a loop
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, t);
      noiseSource.connect(noiseGain);
      noiseGain.connect(synthMix);
      noiseSource.start();
      this.syntheticNodes.noiseNode = noiseSource;
    }

    // Connect synth mix into audio pipeline
    this.connectSourceToPipeline(synthMix);
    this.syntheticNodes.oscillators = oscs;
    this.syntheticNodes.gains = gains;
  }

  private async setupMicSource(): Promise<void> {
    if (!this.ctx) return;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this.micSourceNode = this.ctx.createMediaStreamSource(this.micStream);
      this.connectSourceToPipeline(this.micSourceNode);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      throw err;
    }
  }

  private async setupFileSource(file: File): Promise<void> {
    if (!this.ctx) return;
    const arrayBuffer = await file.arrayBuffer();
    this.fileBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.playLoadedBuffer();
  }

  private playLoadedBuffer(): void {
    if (!this.ctx || !this.fileBuffer) return;
    this.fileSourceNode = this.ctx.createBufferSource();
    this.fileSourceNode.buffer = this.fileBuffer;
    this.fileSourceNode.loop = true;
    this.connectSourceToPipeline(this.fileSourceNode);
    this.fileSourceNode.start();
  }

  private connectSourceToPipeline(sourceNode: AudioNode): void {
    if (!this.rawAnalyser || !this.cleanIn || !this.rawGainNode) return;

    // 1. Raw branch (to raw analyzer & raw output gain)
    sourceNode.connect(this.rawAnalyser);
    sourceNode.connect(this.rawGainNode);

    // 2. Filtered branch (cleanIn -> filter chain -> denoiser -> clean analyzer & clean output gain)
    sourceNode.connect(this.cleanIn);
  }

  private stopCurrentSource(): void {
    // Stop synthetic
    this.syntheticNodes.oscillators.forEach(osc => {
      try { osc.stop(); osc.disconnect(); } catch { /* ignore */ }
    });
    this.syntheticNodes.oscillators = [];
    this.syntheticNodes.gains.forEach(g => {
      try { g.disconnect(); } catch { /* ignore */ }
    });
    this.syntheticNodes.gains = [];
    if (this.syntheticNodes.noiseNode) {
      try {
        this.syntheticNodes.noiseNode.stop();
        this.syntheticNodes.noiseNode.disconnect();
      } catch { /* ignore */ }
      this.syntheticNodes.noiseNode = undefined;
    }

    // Stop mic
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }

    // Stop file
    if (this.fileSourceNode) {
      try { this.fileSourceNode.stop(); this.fileSourceNode.disconnect(); } catch { /* ignore */ }
      this.fileSourceNode = null;
    }

    this.denoiser.reset();
    this.isPlaying = false;
  }

  public setFilterParams(params: Partial<FilterParams>): void {
    this.filterParams = { ...this.filterParams, ...params };
    this.applyFilterParams();
  }

  public getFilterParams(): FilterParams {
    return { ...this.filterParams };
  }

  private applyFilterParams(): void {
    if (!this.filterNode || !this.ctx) return;
    const t = this.ctx.currentTime;
    const { enabled, type, frequency, q, gain } = this.filterParams;
    const f = Math.max(10, Math.min(22000, frequency));
    const qc = Math.max(0.1, Math.min(50, q));

    // "enabled = false" is a true bypass: an allpass has unit magnitude at every frequency
    this.filterNode.type = enabled ? type : 'allpass';
    this.filterNode.frequency.setTargetAtTime(f, t, 0.02);
    this.filterNode.Q.setTargetAtTime(qc, t, 0.02);
    this.filterNode.gain.setTargetAtTime(gain, t, 0.02);

    // Mains hum is a harmonic series: cascade notches on 2f and 3f so 120/180 Hz are removed as well
    const hum = enabled && type === 'notch' && f <= 100;
    [this.harmNotch2, this.harmNotch3].forEach((node, i) => {
      if (!node) return;
      node.type = hum ? 'notch' : 'allpass';
      node.frequency.setTargetAtTime(Math.min(22000, f * (i + 2)), t, 0.02);
      node.Q.setTargetAtTime(qc, t, 0.02);
    });

    // Voice band: remove rumble (<80 Hz) and hiss (>3.8 kHz) outside the speech spectrum
    if (this.voiceHP && this.voiceLP) {
      this.voiceHP.type = this.voiceBandEnabled && enabled ? 'highpass' : 'allpass';
      this.voiceLP.type = this.voiceBandEnabled && enabled ? 'lowpass' : 'allpass';
    }
    this.denoiser.enabled = this.denoiseEnabled && enabled;
  }

  private denoiseEnabled = true;

  public setDenoiseEnabled(on: boolean): void {
    this.denoiseEnabled = on;
    this.applyFilterParams();
  }

  public getDenoiseEnabled(): boolean {
    return this.denoiseEnabled;
  }

  public setVoiceBandEnabled(on: boolean): void {
    this.voiceBandEnabled = on;
    this.applyFilterParams();
  }

  public getVoiceBandEnabled(): boolean {
    return this.voiceBandEnabled;
  }

  public setOutputMode(mode: 'raw' | 'clean' | 'mute'): void {
    this.outputMode = mode;
    this.updateGainRouting();
  }

  public getOutputMode(): 'raw' | 'clean' | 'mute' {
    return this.outputMode;
  }

  public toggleOutputMode(): 'raw' | 'clean' {
    const nextMode = this.outputMode === 'clean' ? 'raw' : 'clean';
    this.setOutputMode(nextMode);
    return nextMode;
  }

  private updateGainRouting(): void {
    if (!this.ctx || !this.rawGainNode || !this.cleanGainNode) return;
    const t = this.ctx.currentTime;
    const rampTime = 0.02; // Smooth 20ms crossfade to avoid audible clicks

    if (this.outputMode === 'raw') {
      this.rawGainNode.gain.setTargetAtTime(1.0, t, rampTime);
      this.cleanGainNode.gain.setTargetAtTime(0.0, t, rampTime);
    } else if (this.outputMode === 'clean') {
      this.rawGainNode.gain.setTargetAtTime(0.0, t, rampTime);
      this.cleanGainNode.gain.setTargetAtTime(1.0, t, rampTime);
    } else {
      this.rawGainNode.gain.setTargetAtTime(0.0, t, rampTime);
      this.cleanGainNode.gain.setTargetAtTime(0.0, t, rampTime);
    }
  }

  public setMasterVolume(vol: number): void {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime, 0.02);
  }

  public pause(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
      this.isPlaying = false;
    }
  }

  public async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
      this.isPlaying = true;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getSampleRate(): number {
    return this.ctx?.sampleRate || 44100;
  }

  // Visualizer data accessors
  public getRawTimeDomain(): Uint8Array<ArrayBuffer> {
    if (this.rawAnalyser) {
      this.rawAnalyser.getByteTimeDomainData(this.rawTimeData);
    }
    return this.rawTimeData;
  }

  public getCleanTimeDomain(): Uint8Array<ArrayBuffer> {
    if (this.cleanAnalyser) {
      this.cleanAnalyser.getByteTimeDomainData(this.cleanTimeData);
    }
    return this.cleanTimeData;
  }

  public getRawFrequency(): Uint8Array<ArrayBuffer> {
    if (this.rawAnalyser) {
      this.rawAnalyser.getByteFrequencyData(this.rawFreqData);
      this.trackSpectrum();
    }
    return this.rawFreqData;
  }

  // Running mean / variance (dB) per bin: lets auto-detect tell steady tones from speech
  private trackSpectrum(): void {
    if (!this.rawAnalyser) return;
    const n = this.rawAnalyser.frequencyBinCount;
    if (!this.spectrumFloat || this.spectrumFloat.length !== n) {
      this.spectrumFloat = new Float32Array(n) as Float32Array<ArrayBuffer>;
      this.spectrumMean = new Float32Array(n).fill(-100);
      this.spectrumVar = new Float32Array(n);
    }
    this.rawAnalyser.getFloatFrequencyData(this.spectrumFloat);
    const mean = this.spectrumMean!, variance = this.spectrumVar!;
    const a = 0.05;
    for (let i = 0; i < n; i++) {
      const v = Math.max(-120, this.spectrumFloat[i]);
      const d = v - mean[i];
      mean[i] += a * d;
      variance[i] = (1 - a) * (variance[i] + a * d * d);
    }
  }

  public getCleanFrequency(): Uint8Array<ArrayBuffer> {
    if (this.cleanAnalyser) {
      this.cleanAnalyser.getByteFrequencyData(this.cleanFreqData);
    }
    return this.cleanFreqData;
  }

  // Metrics computation (attenuation at target frequency)
  public getMetrics(): AudioMetrics {
    const rawFreq = this.getRawFrequency();
    const cleanFreq = this.getCleanFrequency();
    const sampleRate = this.getSampleRate();
    const binCount = rawFreq.length;
    const nyquist = sampleRate / 2;
    const hzPerBin = nyquist / binCount;

    // Find peak in raw spectrum
    let maxRawVal = 0;
    let maxRawIndex = 0;
    for (let i = 1; i < binCount; i++) {
      if (rawFreq[i] > maxRawVal) {
        maxRawVal = rawFreq[i];
        maxRawIndex = i;
      }
    }

    // Measure value at the notch frequency
    const targetBin = Math.round(this.filterParams.frequency / hzPerBin);
    const clampedTargetBin = Math.max(0, Math.min(binCount - 1, targetBin));

    const rawValAtFilter = rawFreq[clampedTargetBin];
    const cleanValAtFilter = cleanFreq[clampedTargetBin];

    // Convert 0-255 byte data to approximate dB (minDecibels = -100, maxDecibels = -30)
    const toDb = (val: number) => -100 + (val / 255) * 70;

    const rawDb = toDb(rawValAtFilter);
    const cleanDb = toDb(cleanValAtFilter);
    const attenuation = Math.max(0, rawDb - cleanDb);

    // Real peak of the filtered spectrum (previously copied from the raw one)
    let maxCleanVal = 0;
    let maxCleanIndex = 0;
    for (let i = 1; i < binCount; i++) {
      if (cleanFreq[i] > maxCleanVal) {
        maxCleanVal = cleanFreq[i];
        maxCleanIndex = i;
      }
    }

    // Local floor around the raw peak (mean of bins 10..30 away) for a meaningful peak-to-floor estimate
    let floorSum = 0;
    let floorCount = 0;
    for (let d = 10; d <= 30; d++) {
      for (const idx of [maxRawIndex - d, maxRawIndex + d]) {
        if (idx >= 0 && idx < binCount) { floorSum += rawFreq[idx]; floorCount++; }
      }
    }
    const floorVal = floorCount ? floorSum / floorCount : 0;

    return {
      rawPeakFreq: Math.round(maxRawIndex * hzPerBin),
      rawPeakMagDb: Math.round(toDb(maxRawVal)),
      cleanPeakFreq: Math.round(maxCleanIndex * hzPerBin),
      cleanPeakMagDb: Math.round(toDb(maxCleanVal)),
      attenuationDb: Math.round(attenuation * 10) / 10,
      snrEstimateDb: Math.round((toDb(maxRawVal) - toDb(floorVal)) * 10) / 10,
    };
  }

  /**
   * Finds a steady, narrow interference tone (hum, whistle, bearing whine).
   * A candidate must be (a) a local peak that stands >= 15 dB over its surroundings,
   * (b) stationary (low dB variance over time, unlike speech) and
   * (c) outside the voice fundamental region (85-300 Hz).
   * Returns the current filter frequency, untouched, when nothing qualifies, so the
   * notch is never parked on the speaker's voice.
   */
  public autoDetectNoisePeak(): number {
    this.getRawFrequency();
    const mean = this.spectrumMean;
    const variance = this.spectrumVar;
    if (!mean || !variance) return this.filterParams.frequency;

    const n = mean.length;
    const hzPerBin = (this.getSampleRate() / 2) / n;
    const minBin = Math.max(11, Math.floor(40 / hzPerBin));
    const maxBin = Math.min(n - 12, Math.floor(12000 / hzPerBin));

    let bestScore = 0;
    let bestBin = -1;
    for (let k = minBin; k <= maxBin; k++) {
      const hz = k * hzPerBin;
      if (hz >= 85 && hz <= 300) continue; // voice F0 region
      if (!(mean[k] > mean[k - 1] && mean[k] >= mean[k + 1])) continue;
      if (mean[k] < -85) continue;

      let ring = 0;
      for (let d = 6; d <= 10; d++) ring += mean[k - d] + mean[k + d];
      const prominence = mean[k] - ring / 10;
      const std = Math.sqrt(variance[k]);
      if (prominence < 15 || std > 4) continue;

      const score = prominence - std;
      if (score > bestScore) { bestScore = score; bestBin = k; }
    }
    if (bestBin < 0) return this.filterParams.frequency;

    // Parabolic interpolation for sub-bin accuracy
    const a = mean[bestBin - 1], b = mean[bestBin], c = mean[bestBin + 1];
    const denom = a - 2 * b + c;
    const shift = denom !== 0 ? 0.5 * (a - c) / denom : 0;
    const detectedHz = Math.round((bestBin + Math.max(-0.5, Math.min(0.5, shift))) * hzPerBin);
    this.setFilterParams({ frequency: detectedHz, type: 'notch', enabled: true });
    return detectedHz;
  }
}

// Global engine singleton
export const audioEngine = new AudioEngine();
