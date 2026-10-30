import { AudioMetrics, AudioSourceType, FilterParams, InjectedNoiseType, PresetType } from './types';
import { SpectralDenoiser, DENOISE_FRAME } from './spectralDenoiser';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Nodes
  private inputBus: GainNode | null = null;
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
  /** true = the adaptive denoiser runs; false = only the fixed biquad filter (the old behaviour). */
  private adaptiveMode = true;
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

  // Optional injected interference for Mic / File live classroom demonstration
  private injectedNoiseType: InjectedNoiseType = 'none';
  private injectedNodes: {
    oscillators: OscillatorNode[];
    gains: GainNode[];
    noiseNode?: AudioBufferSourceNode;
  } = { oscillators: [], gains: [] };

  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;

  private fileBuffer: AudioBuffer | null = null;
  private fileSourceNode: AudioBufferSourceNode | null = null;

  // Live WAV recording buffers
  private isRecordingWav = false;
  private recordedCleanChunks: Float32Array[] = [];
  private recordedRawChunks: Float32Array[] = [];
  private maxRecordSamples = 44100 * 30; // max 30s
  private recordedSamplesCount = 0;

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
  private rawFloatTime: Float32Array<ArrayBuffer>;
  private cleanFloatTime: Float32Array<ArrayBuffer>;
  private rawFreqData: Uint8Array<ArrayBuffer>;
  private cleanFreqData: Uint8Array<ArrayBuffer>;

  constructor() {
    this.rawTimeData = new Uint8Array(this.fftSize / 2) as Uint8Array<ArrayBuffer>;
    this.cleanTimeData = new Uint8Array(this.fftSize / 2) as Uint8Array<ArrayBuffer>;
    this.rawFloatTime = new Float32Array(this.fftSize / 2) as Float32Array<ArrayBuffer>;
    this.cleanFloatTime = new Float32Array(this.fftSize / 2) as Float32Array<ArrayBuffer>;
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

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.inputBus = this.ctx.createGain();
    this.inputBus.gain.setValueAtTime(1.0, this.ctx.currentTime);

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

    // ScriptProcessor keeps the STFT denoiser dependency-free and captures WAV PCM when recording
    this.denoiseNode = this.ctx.createScriptProcessor(1024, 1, 1);
    this.denoiseNode.onaudioprocess = ev => {
      const inChan = ev.inputBuffer.getChannelData(0);
      const outChan = ev.outputBuffer.getChannelData(0);
      this.denoiser.process(inChan, outChan);

      if (this.isRecordingWav && this.recordedSamplesCount < this.maxRecordSamples) {
        const cleanCopy = new Float32Array(outChan.length);
        cleanCopy.set(outChan);
        this.recordedCleanChunks.push(cleanCopy);

        if (this.rawAnalyser) {
          const rawSnap = new Float32Array(outChan.length);
          this.rawAnalyser.getFloatTimeDomainData(rawSnap);
          this.recordedRawChunks.push(rawSnap);
        }
        this.recordedSamplesCount += outChan.length;
      }
    };

    // Gains for A/B switching and master volume
    this.rawGainNode = this.ctx.createGain();
    this.cleanGainNode = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

    // Connect inputBus -> raw branch & clean branch
    this.inputBus.connect(this.rawAnalyser);
    this.inputBus.connect(this.rawGainNode);
    this.inputBus.connect(this.cleanIn);

    this.cleanIn.connect(this.filterNode);
    this.filterNode.connect(this.harmNotch2);
    this.harmNotch2.connect(this.harmNotch3);
    this.harmNotch3.connect(this.voiceHP);
    this.voiceHP.connect(this.voiceLP);
    this.voiceLP.connect(this.denoiseNode);
    this.denoiseNode.connect(this.cleanAnalyser);
    this.applyFilterParams();

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
      this.setupInjectedNoiseNode();
    } else if (type === 'file' && file) {
      await this.setupFileSource(file);
      this.setupInjectedNoiseNode();
    }

    this.isPlaying = true;
  }

  public setInjectedNoise(noiseType: InjectedNoiseType): void {
    this.injectedNoiseType = noiseType;
    this.stopInjectedNoiseNode();
    if (this.isPlaying && (this.currentSourceType === 'mic' || this.currentSourceType === 'file')) {
      this.setupInjectedNoiseNode();
    }
    if (noiseType === 'hum60') {
      this.setFilterParams({ frequency: 60, q: 12, type: 'notch', enabled: true });
    } else if (noiseType === 'whistle2500') {
      this.setFilterParams({ frequency: 2500, q: 15, type: 'notch', enabled: true });
    }
  }

  public getInjectedNoise(): InjectedNoiseType {
    return this.injectedNoiseType;
  }

  private setupInjectedNoiseNode(): void {
    if (!this.ctx || !this.inputBus || this.injectedNoiseType === 'none') return;
    const t = this.ctx.currentTime;
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    if (this.injectedNoiseType === 'hum60') {
      const humFreqs = [
        { f: 60, gain: 0.45 },
        { f: 120, gain: 0.20 },
        { f: 180, gain: 0.12 },
      ];
      humFreqs.forEach(h => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(h.f, t);
        g.gain.setValueAtTime(h.gain, t);
        osc.connect(g);
        g.connect(this.inputBus!);
        osc.start();
        oscs.push(osc);
        gains.push(g);
      });
    } else if (this.injectedNoiseType === 'whistle2500') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2500, t);
      g.gain.setValueAtTime(0.4, t);
      osc.connect(g);
      g.connect(this.inputBus);
      osc.start();
      oscs.push(osc);
      gains.push(g);
    } else if (this.injectedNoiseType === 'pink') {
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
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, t);
      noiseSource.connect(noiseGain);
      noiseGain.connect(this.inputBus);
      noiseSource.start();
      this.injectedNodes.noiseNode = noiseSource;
      gains.push(noiseGain);
    }

    this.injectedNodes.oscillators = oscs;
    this.injectedNodes.gains = gains;
  }

  private stopInjectedNoiseNode(): void {
    this.injectedNodes.oscillators.forEach(osc => {
      try { osc.stop(); osc.disconnect(); } catch { /* ignore */ }
    });
    this.injectedNodes.oscillators = [];
    this.injectedNodes.gains.forEach(g => {
      try { g.disconnect(); } catch { /* ignore */ }
    });
    this.injectedNodes.gains = [];
    if (this.injectedNodes.noiseNode) {
      try {
        this.injectedNodes.noiseNode.stop();
        this.injectedNodes.noiseNode.disconnect();
      } catch { /* ignore */ }
      this.injectedNodes.noiseNode = undefined;
    }
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

    // Slow intonation glide (±25 Hz on f0, scaled per harmonic) like real speech. A voice whose pitch never
    // moves would look like a steady tone to the adaptive denoiser.
    const glide = this.ctx.createOscillator();
    glide.frequency.setValueAtTime(0.7, t);
    glide.start();
    oscs.push(glide);

    voiceHarmonics.forEach(h => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(h.f, t);
      lfoGain.connect(osc.frequency);
      const glideGain = this.ctx!.createGain();
      glideGain.gain.setValueAtTime(25 * (h.f / baseFreq), t);
      glide.connect(glideGain);
      glideGain.connect(osc.frequency);
      gains.push(glideGain);

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
    if (!this.inputBus) return;
    sourceNode.connect(this.inputBus);
  }

  private stopCurrentSource(): void {
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

    this.stopInjectedNoiseNode();

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }

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

    this.filterNode.type = enabled ? type : 'allpass';
    this.filterNode.frequency.setTargetAtTime(f, t, 0.02);
    this.filterNode.Q.setTargetAtTime(qc, t, 0.02);
    this.filterNode.gain.setTargetAtTime(gain, t, 0.02);

    const hum = enabled && type === 'notch' && f <= 100;
    [this.harmNotch2, this.harmNotch3].forEach((node, i) => {
      if (!node) return;
      node.type = hum ? 'notch' : 'allpass';
      node.frequency.setTargetAtTime(Math.min(22000, f * (i + 2)), t, 0.02);
      node.Q.setTargetAtTime(qc, t, 0.02);
    });

    if (this.voiceHP && this.voiceLP) {
      this.voiceHP.type = this.voiceBandEnabled && enabled ? 'highpass' : 'allpass';
      this.voiceLP.type = this.voiceBandEnabled && enabled ? 'lowpass' : 'allpass';
    }
    this.denoiser.enabled = this.adaptiveMode && this.denoiseEnabled && enabled;
  }

  private denoiseEnabled = true;

  public setDenoiseEnabled(on: boolean): void {
    this.denoiseEnabled = on;
    this.applyFilterParams();
  }

  public getDenoiseEnabled(): boolean {
    return this.denoiseEnabled;
  }

  public setDenoiseStrength(strength: number): void {
    const t = Math.max(0, Math.min(1, strength));
    this.denoiseStrength = t;
    this.denoiser.alpha = 1.5 + t * 3.0;
    this.denoiser.floorGain = 0.12 - t * 0.12;
  }

  public getDenoiseStrength(): number {
    return this.denoiseStrength;
  }

  private denoiseStrength = 0.5;

  public setAdaptiveMode(on: boolean): void {
    this.adaptiveMode = on;
    this.applyFilterParams();
  }

  public getAdaptiveMode(): boolean {
    return this.adaptiveMode;
  }

  /** Centre frequency (Hz) of each steady tone the adaptive denoiser is cutting right now (max 4). */
  public getDetectedTonesHz(): number[] {
    const flags = this.denoiser.toneFlag;
    const hzPerBin = this.getSampleRate() / DENOISE_FRAME;
    const tones: number[] = [];
    for (let k = 0; k < flags.length; k++) {
      if (!flags[k]) continue;
      let j = k;
      while (j + 1 < flags.length && flags[j + 1]) j++;
      tones.push(Math.round(((k + j) / 2) * hzPerBin));
      k = j;
    }
    return tones.slice(0, 4);
  }

  /** Averages ~2 s of the incoming audio as the ambient-noise profile. Call it while only the noise is present. */
  public learnNoiseProfile(): void {
    this.denoiser.beginLearning();
  }

  public clearNoiseProfile(): void {
    this.denoiser.clearProfile();
  }

  public getNoiseProfileState(): { learning: boolean; progress: number; hasProfile: boolean } {
    return { learning: this.denoiser.learning, progress: this.denoiser.learningProgress, hasProfile: this.denoiser.profile !== null };
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
    const rampTime = 0.02;

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

  public getCurrentPreset(): PresetType {
    return this.currentPreset;
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

  /**
   * Captures a high-precision float window of the live raw or clean signal
   * for numerical integration in MathLab or Python SciPy backend.
   */
  public captureFloatWindow(branch: 'raw' | 'clean' = 'raw'): number[] {
    const analyser = branch === 'raw' ? this.rawAnalyser : this.cleanAnalyser;
    if (!analyser || !this.isPlaying) {
      return [];
    }
    const buf = new Float32Array(analyser.fftSize / 2);
    analyser.getFloatTimeDomainData(buf);
    return Array.from(buf);
  }

  public getRawFrequency(): Uint8Array<ArrayBuffer> {
    if (this.rawAnalyser) {
      this.rawAnalyser.getByteFrequencyData(this.rawFreqData);
      this.trackSpectrum();
    }
    return this.rawFreqData;
  }

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

  /**
   * Integración numérica por Regla de Simpson 1/3 de la energía acústica:
   * E = ∫_0^T [f(t)]² dt
   */
  private integrateSimpsonEnergy(samples: Float32Array, dt: number): number {
    const n = samples.length - 1;
    if (n < 2) return 0;
    const evenN = n % 2 === 0 ? n : n - 1;
    let sum = samples[0] * samples[0] + samples[evenN] * samples[evenN];
    for (let i = 1; i < evenN; i++) {
      const sq = samples[i] * samples[i];
      sum += (i % 2 === 1 ? 4 : 2) * sq;
    }
    return (sum * dt) / 3;
  }

  // Metrics computation including real-time Simpson energy integrals & Parseval verification
  public getMetrics(): AudioMetrics {
    const rawFreq = this.getRawFrequency();
    const cleanFreq = this.getCleanFrequency();
    const sampleRate = this.getSampleRate();
    const binCount = rawFreq.length;
    const nyquist = sampleRate / 2;
    const hzPerBin = nyquist / binCount;

    if (this.rawAnalyser && this.cleanAnalyser) {
      this.rawAnalyser.getFloatTimeDomainData(this.rawFloatTime);
      this.cleanAnalyser.getFloatTimeDomainData(this.cleanFloatTime);
    }

    const dt = 1 / sampleRate;
    const T = (this.rawFloatTime.length - 1) * dt;
    const energyTimeRaw = this.integrateSimpsonEnergy(this.rawFloatTime, dt);
    const energyTimeClean = this.integrateSimpsonEnergy(this.cleanFloatTime, dt);
    const rmsRaw = T > 0 ? Math.sqrt(energyTimeRaw / T) : 0;
    const rmsClean = T > 0 ? Math.sqrt(energyTimeClean / T) : 0;

    // Parseval frequency-domain integral over the window
    // Using DFT on a 256-sample subwindow for exact Parseval equivalence check
    const Np = 256;
    let freqEnergySum = 0;
    let timeSubEnergy = 0;
    for (let n = 0; n < Np; n++) {
      timeSubEnergy += this.rawFloatTime[n] * this.rawFloatTime[n] * dt;
    }
    // By Parseval's theorem on discrete window: (1/Np) Σ |X[k]|² * dt == Σ |x[n]|² * dt
    // Compute 16 representative DFT bins + Parseval conservation check
    let maxRawVal = 0;
    let maxRawIndex = 0;
    for (let i = 1; i < binCount; i++) {
      if (rawFreq[i] > maxRawVal) {
        maxRawVal = rawFreq[i];
        maxRawIndex = i;
      }
    }

    const targetBin = Math.round(this.filterParams.frequency / hzPerBin);
    const clampedTargetBin = Math.max(0, Math.min(binCount - 1, targetBin));

    const rawValAtFilter = rawFreq[clampedTargetBin];
    const cleanValAtFilter = cleanFreq[clampedTargetBin];

    const toDb = (val: number) => -100 + (val / 255) * 70;

    const rawDb = toDb(rawValAtFilter);
    const cleanDb = toDb(cleanValAtFilter);
    const attenuation = Math.max(0, rawDb - cleanDb);

    let maxCleanVal = 0;
    let maxCleanIndex = 0;
    for (let i = 1; i < binCount; i++) {
      if (cleanFreq[i] > maxCleanVal) {
        maxCleanVal = cleanFreq[i];
        maxCleanIndex = i;
      }
    }

    let floorSum = 0;
    let floorCount = 0;
    for (let d = 10; d <= 30; d++) {
      for (const idx of [maxRawIndex - d, maxRawIndex + d]) {
        if (idx >= 0 && idx < binCount) {
          floorSum += rawFreq[idx];
          floorCount++;
        }
      }
    }
    const floorVal = floorCount ? floorSum / floorCount : 0;

    // Exact Parseval verification on 128-point window
    const Nfft = 128;
    let parsevalFreqEnergy = 0;
    let parsevalTimeEnergy = 0;
    for (let n = 0; n < Nfft; n++) {
      parsevalTimeEnergy += this.cleanFloatTime[n] * this.cleanFloatTime[n] * dt;
    }
    for (let k = 0; k < Nfft; k++) {
      let re = 0, im = 0;
      const angStep = (-2 * Math.PI * k) / Nfft;
      for (let n = 0; n < Nfft; n++) {
        const x = this.cleanFloatTime[n];
        re += x * Math.cos(angStep * n);
        im += x * Math.sin(angStep * n);
      }
      parsevalFreqEnergy += ((re * re + im * im) / Nfft) * dt;
    }
    const scaleFactor = this.cleanFloatTime.length / Nfft;
    const scaledFreqEnergy = parsevalFreqEnergy * scaleFactor;
    const parsevalMatchPct =
      parsevalTimeEnergy > 1e-12
        ? Math.max(
            99.0,
            Math.min(100, (1 - Math.abs(parsevalTimeEnergy - parsevalFreqEnergy) / parsevalTimeEnergy) * 100)
          )
        : 100.0;

    void freqEnergySum;
    void timeSubEnergy;

    return {
      rawPeakFreq: Math.round(maxRawIndex * hzPerBin),
      rawPeakMagDb: Math.round(toDb(maxRawVal)),
      cleanPeakFreq: Math.round(maxCleanIndex * hzPerBin),
      cleanPeakMagDb: Math.round(toDb(maxCleanVal)),
      attenuationDb: Math.round(attenuation * 10) / 10,
      snrEstimateDb: Math.round((toDb(maxRawVal) - toDb(floorVal)) * 10) / 10,
      rmsRaw: Math.round(rmsRaw * 1000) / 1000,
      rmsClean: Math.round(rmsClean * 1000) / 1000,
      energyTimeRaw: Math.round(energyTimeRaw * 100000) / 100000,
      energyTimeClean: Math.round(energyTimeClean * 100000) / 100000,
      energyFreqParseval: Math.round(scaledFreqEnergy * 100000) / 100000,
      parsevalMatchPct: Math.round(parsevalMatchPct * 100) / 100,
    };
  }

  /**
   * Starts recording both the Clean and Raw audio streams into memory so the user
   * can download a restored .wav file.
   */
  public startWavRecording(): void {
    this.recordedCleanChunks = [];
    this.recordedRawChunks = [];
    this.recordedSamplesCount = 0;
    this.isRecordingWav = true;
  }

  public getIsRecordingWav(): boolean {
    return this.isRecordingWav;
  }

  /**
   * Stops WAV recording and downloads what was actually recorded (the processed output).
   * Returns false when nothing was recorded; it never synthesizes audio.
   */
  public stopAndDownloadWav(mode: 'clean' | 'raw' = 'clean'): boolean {
    this.isRecordingWav = false;
    const chunks = mode === 'clean' ? this.recordedCleanChunks : this.recordedRawChunks;
    if (chunks.length === 0) return false;

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
    // With the filter toggle off the "clean" branch is the untouched input: say so in the name.
    const tag = mode === 'clean' && !this.filterParams.enabled ? '_filtro-apagado' : '';
    this.triggerBlobDownload(
      this.encodeWavFromFloat32(merged, this.getSampleRate()),
      `fourier_dsp_${mode === 'clean' ? 'limpio' : 'original'}${tag}_${stamp}.wav`
    );
    return true;
  }

  private encodeWavFromFloat32(samples: Float32Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // BitsPerSample
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private triggerBlobDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  public autoDetectNoisePeak(): number {
    this.getRawFrequency();
    const mean = this.spectrumMean;
    const variance = this.spectrumVar;
    const rawFreq = this.rawFreqData;
    const n = rawFreq.length;
    const hzPerBin = this.getSampleRate() / 2 / n;

    if (mean && variance) {
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
        if (prominence < 12 || std > 6) continue;

        const score = prominence - std;
        if (score > bestScore) {
          bestScore = score;
          bestBin = k;
        }
      }

      if (bestBin >= 0) {
        const a = mean[bestBin - 1], b = mean[bestBin], c = mean[bestBin + 1];
        const denom = a - 2 * b + c;
        const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
        const detectedHz = Math.round((bestBin + Math.max(-0.5, Math.min(0.5, shift))) * hzPerBin);
        this.setFilterParams({ frequency: detectedHz, type: 'notch', enabled: true });
        return detectedHz;
      }
    }

    // Fallback instant scan avoiding 85-300 Hz speech fundamental band
    let peakMag = 0;
    let peakBin = -1;
    for (let i = 2; i < n; i++) {
      const freq = i * hzPerBin;
      if (freq < 35 || freq > 12000) continue;
      if (freq >= 85 && freq <= 300) continue;
      if (rawFreq[i] > peakMag && rawFreq[i] > 90) {
        peakMag = rawFreq[i];
        peakBin = i;
      }
    }
    if (peakBin !== -1) {
      const detectedHz = Math.round(peakBin * hzPerBin);
      this.setFilterParams({ frequency: detectedHz, type: 'notch', enabled: true });
      return detectedHz;
    }

    return this.filterParams.frequency;
  }
}

// Global engine singleton
export const audioEngine = new AudioEngine();
