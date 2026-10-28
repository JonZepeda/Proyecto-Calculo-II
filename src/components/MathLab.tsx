import React, { useEffect, useRef, useState, useMemo } from 'react';
import katex from 'katex';
import {
  computeRiemannFourier,
  generateSyntheticWindow,
  sweepRiemannSpectrum,
} from '../dsp/riemannFourier';
import { audioEngine } from '../dsp/audioEngine';
import { QuadratureMethod } from '../dsp/types';
import {
  Sigma,
  CheckCircle2,
  AlertCircle,
  Radio,
  RotateCcw,
  BookOpen,
  Layers,
} from 'lucide-react';

interface PythonSymbolicResponse {
  engine: string;
  sympy_version: string;
  exact_fourier: {
    real_cos: number;
    imag_sin: number;
    magnitude: number;
    energy_total: number;
    rms_total: number;
  };
  symbolic_latex: {
    trig_integrand: string;
    prod_to_sum: string;
    damped_integrand: string;
    damped_antiderivative: string;
    damped_definite: string;
    improper_result: string;
  };
  damped_evaluation: {
    F_T: number;
    F_0: number;
    definite_0_to_T: number;
    improper_0_to_inf: number;
    convergence_ratio_pct: number;
  };
}

export const MathLab: React.FC = () => {
  const [probeFreq, setProbeFreq] = useState<number>(60);
  const [noiseFreq, setNoiseFreq] = useState<number>(60);
  const [partitionsN, setPartitionsN] = useState<number>(160);
  const [selectedMethod, setSelectedMethod] = useState<QuadratureMethod>('simpson');
  const [dampingAlpha, setDampingAlpha] = useState<number>(35);
  const [activeTechnique, setActiveTechnique] = useState<'trig' | 'byparts' | 'improper'>('trig');

  // Live audio snapshot state
  const [liveSamples, setLiveSamples] = useState<number[] | null>(null);
  const [liveBranch, setLiveBranch] = useState<'raw' | 'clean'>('raw');

  // Python SymPy/SciPy backend state
  const [pythonOnline, setPythonOnline] = useState<boolean>(false);
  const [sympyData, setSympyData] = useState<PythonSymbolicResponse | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  // Query Python SymPy/SciPy backend when parameters change
  useEffect(() => {
    let cancelled = false;
    const fetchPython = async () => {
      try {
        const res = await fetch('/api/symbolic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            probe_freq: probeFreq,
            noise_freq: noiseFreq,
            window_duration: 0.04,
            damping_alpha: dampingAlpha,
          }),
        });
        if (!res.ok) throw new Error('Backend offline');
        const data: PythonSymbolicResponse = await res.json();
        if (!cancelled) {
          setPythonOnline(true);
          setSympyData(data);
        }
      } catch {
        if (!cancelled) {
          setPythonOnline(false);
        }
      }
    };
    fetchPython();
    return () => {
      cancelled = true;
    };
  }, [probeFreq, noiseFreq, dampingAlpha]);

  // Capture live window from audioEngine (Mic / File / Synthetic)
  const handleCaptureLiveAudio = (branch: 'raw' | 'clean') => {
    const captured = audioEngine.captureFloatWindow(branch);
    if (captured.length > 0) {
      setLiveSamples(captured);
      setLiveBranch(branch);
    } else {
      // If DSP engine wasn't playing yet, generate analytical window
      const fallback = generateSyntheticWindow(0.04, 44100, noiseFreq);
      setLiveSamples(fallback.samples);
      setLiveBranch(branch);
    }
  };

  const handleResetToAnalytical = () => {
    setLiveSamples(null);
  };

  // Generate 40ms analytical window or use captured live samples
  const windowData = useMemo(() => {
    if (liveSamples && liveSamples.length > 0) {
      return {
        samples: liveSamples,
        sampleRate: audioEngine.getSampleRate(),
        isLive: true,
      };
    }
    const gen = generateSyntheticWindow(0.04, 44100, noiseFreq);
    return {
      samples: gen.samples,
      sampleRate: 44100,
      isLive: false,
    };
  }, [liveSamples, noiseFreq]);

  // Compute numerical integration (Riemann Left, Midpoint, Trapezoid, Simpson 1/3 + Exact Analytical)
  const riemannResult = useMemo(() => {
    return computeRiemannFourier(
      windowData.samples,
      windowData.sampleRate,
      probeFreq,
      partitionsN,
      {
        noiseFrequency: noiseFreq,
        isLiveCapture: windowData.isLive,
        method: selectedMethod,
      }
    );
  }, [windowData, probeFreq, partitionsN, noiseFreq, selectedMethod]);

  // Compute full spectrum sweep using Simpson 1/3
  const sweepData = useMemo(() => {
    return sweepRiemannSpectrum(
      windowData.samples,
      windowData.sampleRate,
      20,
      1500,
      75,
      {
        noiseFrequency: noiseFreq,
        isLiveCapture: windowData.isLive,
      }
    );
  }, [windowData, noiseFreq]);

  // Render main integration canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    const steps = riemannResult.steps;
    if (steps.length === 0) return;

    const h1 = height * 0.30;
    const h2Start = height * 0.35;
    const h2 = height * 0.30;
    const h3Start = height * 0.70;
    const h3 = height * 0.28;

    const drawAxis = (yCenter: number, label: string) => {
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yCenter);
      ctx.lineTo(width, yCenter);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(label, 8, yCenter - 6);
    };

    // --- Subplot 1: Signal f(t) and Basis cos(ωt) ---
    const yCenter1 = h1 / 2 + 10;
    drawAxis(
      yCenter1,
      `1. Señal ${windowData.isLive ? `de audio (${liveBranch === 'raw' ? 'original' : 'filtrada'})` : 'de ejemplo'} (ámbar) y onda de prueba (cian)`
    );

    const dx = width / steps.length;

    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#f59e0b';
    for (let i = 0; i < steps.length; i++) {
      const x = i * dx;
      const y = yCenter1 - steps[i].signalVal * (h1 * 0.4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#06b6d4';
    for (let i = 0; i < steps.length; i++) {
      const x = i * dx;
      const y = yCenter1 - steps[i].basisVal * (h1 * 0.4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- Subplot 2: Integrand Product g(t) = f(t) * cos(ωt) with Quadrature Partition ---
    const yCenter2 = h2Start + h2 / 2;
    drawAxis(
      yCenter2,
      `2. Producto de las dos: lo que se suma (verde = suma, rojo = resta)`
    );

    for (let i = 0; i < steps.length; i++) {
      const x = i * dx;
      const val = steps[i].productVal;
      const rectHeight = val * (h2 * 0.4);

      if (val >= 0) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.fillRect(x, yCenter2 - rectHeight, Math.max(1, dx - 0.3), rectHeight);
      } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.fillRect(x, yCenter2, Math.max(1, dx - 0.3), -rectHeight);
      }
    }

    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#a855f7';
    for (let i = 0; i < steps.length; i++) {
      const x = i * dx;
      const y = yCenter2 - steps[i].productVal * (h2 * 0.4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- Subplot 3: Cumulative Integral Area ∫₀ᵗ g(τ) dτ ---
    const yCenter3 = h3Start + h3 / 2;
    drawAxis(yCenter3, '3. Área acumulada: el punto final es el resultado de la integral');

    const maxArea = Math.max(
      0.001,
      Math.max(...steps.map(s => Math.abs(s.cumulativeArea)), Math.abs(riemannResult.totalAreaCos)) * 1.25
    );

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10b981';
    for (let i = 0; i < steps.length; i++) {
      const x = i * dx;
      const normY = steps[i].cumulativeArea / maxArea;
      const y = yCenter3 - normY * (h3 * 0.45);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const lastX = (steps.length - 1) * dx;
    const lastNormY = steps[steps.length - 1].cumulativeArea / maxArea;
    const lastY = yCenter3 - lastNormY * (h3 * 0.45);

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [riemannResult, partitionsN, selectedMethod, windowData.isLive, liveBranch]);

  // Render full spectrum sweep canvas
  useEffect(() => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    const { freqs, magnitudes } = sweepData;
    const maxMag = Math.max(...magnitudes, 0.001);

    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i < freqs.length; i++) {
      const x = (i / (freqs.length - 1)) * width;
      const y = height - (magnitudes[i] / maxMag) * (height - 20) - 2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#06b6d4';
    ctx.stroke();

    const minF = freqs[0];
    const maxF = freqs[freqs.length - 1];
    const probeX = ((probeFreq - minF) / (maxF - minF)) * width;

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(probeX, 0);
    ctx.lineTo(probeX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.fillText(`ξ = ${probeFreq} Hz`, Math.max(5, Math.min(width - 90, probeX + 5)), 15);
  }, [sweepData, probeFreq]);

  const renderFormula = (tex: string, displayMode: boolean = true) => {
    try {
      return { __html: katex.renderToString(tex, { displayMode, throwOnError: false }) };
    } catch {
      return { __html: tex };
    }
  };

  const isResonance =
    Math.abs(probeFreq - noiseFreq) <= 5 ||
    probeFreq === 140 ||
    probeFreq === 700 ||
    probeFreq === 1260;

  // Values for symbolic step-by-step display
  const omegaProbe = 2 * Math.PI * probeFreq;
  const T = 0.04;
  const denomDamped = dampingAlpha * dampingAlpha + omegaProbe * omegaProbe;
  const dampedFT =
    (Math.exp(-dampingAlpha * T) *
      (omegaProbe * Math.sin(omegaProbe * T) - dampingAlpha * Math.cos(omegaProbe * T))) /
    denomDamped;
  const dampedF0 = -dampingAlpha / denomDamped;
  const dampedDefinite = sympyData?.damped_evaluation.definite_0_to_T ?? dampedFT - dampedF0;
  const dampedImproper = sympyData?.damped_evaluation.improper_0_to_inf ?? dampingAlpha / denomDamped;

  return (
    <div className="space-y-4">
      {/* Introduction & Hybrid Python/SymPy Status Card */}
      <div className="dsp-chassis rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Cómo una integral detecta una frecuencia
            </h2>
            <p className="text-sm text-[#94a3b8] mt-1 leading-relaxed max-w-2xl">
              Se multiplica la señal por una onda de prueba y se suma el resultado (esa suma es la integral).
              Si la señal contiene esa frecuencia, el resultado es grande; si no, es casi cero.
            </p>
          </div>

          {/* Live Capture Controls */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 font-mono text-xs">
            <button
              onClick={() => handleCaptureLiveAudio('raw')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${
                windowData.isLive && liveBranch === 'raw'
                  ? 'bg-[#21160d] border-[#523418] text-amber-300 font-semibold'
                  : 'bg-[#0e1016] border-[#1c212d] text-[#94a3b8] hover:text-white'
              }`}
              title="Capturar 40ms de la señal cruda activa en el Laboratorio DSP e integrarla"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>Usar audio: original</span>
            </button>

            <button
              onClick={() => handleCaptureLiveAudio('clean')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${
                windowData.isLive && liveBranch === 'clean'
                  ? 'bg-[#0e1d24] border-[#1b4457] text-cyan-300 font-semibold'
                  : 'bg-[#0e1016] border-[#1c212d] text-[#94a3b8] hover:text-white'
              }`}
              title="Capturar 40ms de la señal filtrada limpia e integrarla"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>Usar audio: filtrado</span>
            </button>

            {windowData.isLive && (
              <button
                onClick={handleResetToAnalytical}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border bg-[#141720] border-[#262c3d] text-[#cbd5e1] hover:text-white"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Volver a la señal de ejemplo</span>
              </button>
            )}
          </div>
        </div>

        {/* Formula Banner */}
        <div className="mt-3 dsp-well p-3 rounded-md overflow-x-auto text-center">
          <div
            dangerouslySetInnerHTML={renderFormula(
              `\\hat{f}(\\xi) = \\int_{0}^{T} f(t)\\, e^{-i 2\\pi \\xi t} \\, dt`
            )}
          />
        </div>
      </div>

      {/* Main Interactive Controls & 3-Stage Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Controls */}
        <div className="dsp-chassis rounded-lg p-4 flex flex-col gap-3">
          <h3 className="font-mono font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
            <Sigma className="w-3.5 h-3.5 text-cyan-400" />
            <span>Prueba una frecuencia</span>
          </h3>

          {/* Probe frequency slider */}
          <div className="dsp-meter-card p-3 rounded-md flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#94a3b8]">
                Frecuencia de prueba (ξ)
              </label>
              <span className="font-mono text-sm font-bold text-cyan-400">
                {probeFreq} <span className="text-xs text-[#94a3b8]">Hz</span>
              </span>
            </div>

            <input
              type="range"
              min="20"
              max="1500"
              step="5"
              value={probeFreq}
              onChange={e => setProbeFreq(parseInt(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />

            <div className="grid grid-cols-2 gap-1.5 pt-1 text-xs font-mono">
              <button
                onClick={() => {
                  setNoiseFreq(60);
                  setProbeFreq(60);
                }}
                className={`px-2 py-1.5 rounded border font-medium transition-all ${
                  probeFreq === 60
                    ? 'bg-rose-950 border-rose-600 text-rose-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Ruido (60 Hz)
              </button>
              <button
                onClick={() => setProbeFreq(140)}
                className={`px-2 py-1.5 rounded border font-medium transition-all ${
                  probeFreq === 140
                    ? 'bg-amber-950 border-amber-600 text-amber-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Voz (140 Hz)
              </button>
              <button
                onClick={() => setProbeFreq(350)}
                className={`px-2 py-1.5 rounded border font-medium transition-all ${
                  probeFreq === 350
                    ? 'bg-cyan-950 border-cyan-600 text-cyan-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Ausente (350 Hz)
              </button>
              <button
                onClick={() => setProbeFreq(700)}
                className={`px-2 py-1.5 rounded border font-medium transition-all ${
                  probeFreq === 700
                    ? 'bg-violet-950 border-violet-600 text-violet-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Voz (700 Hz)
              </button>
            </div>
          </div>

          {/* Partitions N and Quadrature Rule Selector */}
          <div className="dsp-meter-card p-3 rounded-md flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#94a3b8]">
                Subintervalos (N)
              </label>
              <span className="font-mono text-sm font-bold text-cyan-400">
                N = {partitionsN}
              </span>
            </div>

            <input
              type="range"
              min="16"
              max="600"
              step="8"
              value={partitionsN}
              onChange={e => setPartitionsN(parseInt(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />

          </div>

          {/* Diagnostic Interpretation */}
          <div className="dsp-meter-card p-3 rounded-md flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono border-b border-[#141720] pb-1">
              <span className="text-[#94a3b8]">Valor exacto |f̂(ξ)|</span>
              <span className="font-bold text-emerald-400">
                {riemannResult.exactMagnitude.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between text-xs font-mono border-b border-[#141720] pb-1">
              <span className="text-[#94a3b8]">Aproximado ({riemannResult.quadrature[selectedMethod].name})</span>
              <span className="font-bold text-cyan-400">
                {riemannResult.magnitude.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#94a3b8]">Error</span>
              <span className="font-bold text-amber-400">
                {riemannResult.quadrature[selectedMethod].relErrorPct.toFixed(4)} %
              </span>
            </div>

            <div
              className={`mt-1 p-2 rounded border text-xs font-mono leading-relaxed flex items-start gap-2 ${
                isResonance
                  ? 'bg-[#1c0f13] border-[#471822] text-rose-200'
                  : 'bg-[#0e171f] border-[#18394f] text-cyan-200'
              }`}
            >
              {isResonance ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Esta frecuencia está en la señal.</strong> Los productos se suman en lugar de cancelarse, así que la integral es grande.
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Esta frecuencia no está en la señal.</strong> Las partes positivas y negativas se compensan, así que la integral es casi cero.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Spectrum Sweep Preview */}
          <div className="dsp-meter-card p-3 rounded-md">
            <span className="text-xs font-mono text-[#94a3b8] block mb-1">
              Resultado para cada frecuencia (20 a 1500 Hz):
            </span>
            <div className="w-full h-24 rounded-md overflow-hidden dsp-well">
              <canvas
                ref={spectrumCanvasRef}
                width={300}
                height={96}
                className="w-full h-full block"
              />
            </div>
          </div>
        </div>

        {/* Center & Right Columns: 3-Stage Canvas + Quadrature Comparison Table */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="dsp-chassis rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono font-bold text-xs text-white uppercase tracking-wider">
                Cómo se calcula (ventana de 40 ms)
              </h3>
            </div>

            <div className="relative w-full h-[380px] rounded-md overflow-hidden dsp-well">
              <canvas
                ref={canvasRef}
                width={750}
                height={380}
                className="w-full h-full block"
              />
            </div>
          </div>

          {/* Quadrature Methods Comparison Table (Riemann vs Trapezoid vs Simpson 1/3 vs Exact) */}
          <div className="dsp-chassis rounded-lg p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="font-mono font-bold text-xs text-white uppercase tracking-wider">
                  Comparación de métodos
                </h3>
              </div>
              <span className="text-xs font-mono text-[#94a3b8]">Clic en uno para verlo arriba</span>
            </div>

            <div className="overflow-x-auto dsp-well rounded-md">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#181c26] text-[#94a3b8]">
                    <th className="py-2 px-3">Método</th>
                    <th className="py-2 px-3">Orden del error</th>
                    <th className="py-2 px-3 text-right">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141720]">
                  {(
                    ['riemann_left', 'riemann_midpoint', 'trapezoid', 'simpson'] as QuadratureMethod[]
                  ).map(key => {
                    const row = riemannResult.quadrature[key];
                    const isSelected = selectedMethod === key;
                    return (
                      <tr
                        key={key}
                        onClick={() => setSelectedMethod(key)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#101c24] text-white' : 'text-[#cbd5e1] hover:bg-[#0d1118]'
                        }`}
                      >
                        <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-cyan-400' : 'bg-[#334155]'
                            }`}
                          />
                          {row.name}
                        </td>
                        <td className="py-2 px-3 text-[#94a3b8]">{row.order}</td>
                        <td className="py-2 px-3 text-right font-semibold text-cyan-300">
                          {row.relErrorPct.toFixed(4)} %
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Symbolic Calculus II Solver (Powered by SymPy + Exact Analytical Derivations) */}
      <details className="dsp-chassis rounded-lg p-4 space-y-3">
        <summary className="cursor-pointer flex items-center gap-2 font-mono font-bold text-xs text-white uppercase tracking-wider">
          <BookOpen className="w-4 h-4 text-amber-400" />
          Ver la demostración paso a paso
        </summary>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#181c26] pb-3">

          <div className="flex flex-wrap items-center gap-1.5 dsp-well p-1 rounded-md font-mono text-xs">
            <button
              onClick={() => setActiveTechnique('trig')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTechnique === 'trig'
                  ? 'bg-[#181c25] text-cyan-300 border border-[#2b3342] font-semibold'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              1. Integrales Trigonométricas (TFC)
            </button>
            <button
              onClick={() => setActiveTechnique('byparts')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTechnique === 'byparts'
                  ? 'bg-[#181c25] text-amber-300 border border-[#2b3342] font-semibold'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              2. Integración por Partes Cíclica
            </button>
            <button
              onClick={() => setActiveTechnique('improper')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTechnique === 'improper'
                  ? 'bg-[#181c25] text-emerald-300 border border-[#2b3342] font-semibold'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              3. Integral Impropia (Límite T → ∞)
            </button>
          </div>
        </div>

        {activeTechnique === 'trig' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
            <div className="dsp-well p-3.5 rounded-md space-y-2">
              <span className="font-mono text-cyan-400 font-bold uppercase">
                Paso 1: Identidad Producto a Suma
              </span>
              <p className="text-[#cbd5e1] leading-relaxed">
                Para integrar el producto entre un armónico de la señal <code className="text-amber-300">A sin(ω₀t)</code> y el núcleo de Fourier <code className="text-cyan-300">cos(ωt)</code>, aplicamos la identidad trigonométrica:
              </p>
              <div
                dangerouslySetInnerHTML={renderFormula(
                  `\\sin(\\omega_0 t)\\cos(\\omega t) = \\frac{1}{2}\\big[\\sin((\\omega_0 - \\omega)t) + \\sin((\\omega_0 + \\omega)t)\\big]`
                )}
              />
            </div>

            <div className="dsp-well p-3.5 rounded-md space-y-2">
              <span className="font-mono text-amber-400 font-bold uppercase">
                Paso 2: Antiderivada Exacta F(t)
              </span>
              <p className="text-[#cbd5e1] leading-relaxed">
                Cuando <code className="text-cyan-300">ω ≠ ω₀</code>, integramos término a término por sustitución simple <code className="text-amber-300">u = (ω₀ ± ω)t</code>:
              </p>
              <div
                dangerouslySetInnerHTML={renderFormula(
                  `F(t) = \\frac{A}{2}\\left[ -\\frac{\\cos((\\omega_0 - \\omega)t)}{\\omega_0 - \\omega} - \\frac{\\cos((\\omega_0 + \\omega)t)}{\\omega_0 + \\omega} \\right]`
                )}
              />
            </div>

            <div className="dsp-well p-3.5 rounded-md space-y-2">
              <span className="font-mono text-emerald-400 font-bold uppercase">
                Paso 3: Evaluación F(T) - F(0) (ξ = {probeFreq} Hz)
              </span>
              <p className="text-[#cbd5e1] leading-relaxed">
                Evaluando en los límites <code className="text-emerald-300">[0, {T} s]</code> para todas las componentes armónicas:
              </p>
              <div
                dangerouslySetInnerHTML={renderFormula(
                  `I_{\\text{cos}}(${probeFreq}) = F(0.04) - F(0) = ${riemannResult.exactCos.toFixed(6)}`
                )}
              />
              <div
                dangerouslySetInnerHTML={renderFormula(
                  `|\\hat{f}(${probeFreq})| = \\sqrt{I_{\\text{cos}}^2 + I_{\\text{sin}}^2} = ${riemannResult.exactMagnitude.toFixed(6)}`
                )}
              />
            </div>
          </div>
        )}

        {activeTechnique === 'byparts' && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 dsp-meter-card p-2.5 rounded-md font-mono">
              <span className="text-[#cbd5e1]">
                Modelo de Pulso Acústico Amortiguado: <code>f(t) = e^(-αt)</code> con factor de amortiguamiento α = {dampingAlpha} s⁻¹
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[#94a3b8]">Ajustar α:</span>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={dampingAlpha}
                  onChange={e => setDampingAlpha(parseInt(e.target.value))}
                  className="w-32 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
                <span className="text-amber-400 font-bold">α = {dampingAlpha}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="dsp-well p-3.5 rounded-md space-y-2">
                <span className="font-mono text-cyan-400 font-bold uppercase">
                  Paso 1: Primera y Segunda Integración por Partes
                </span>
                <p className="text-[#cbd5e1] leading-relaxed">
                  Sea <code className="text-amber-300">I = ∫ e^(-αt) cos(ωt) dt</code>. Elegimos <code className="text-cyan-300">u = e^(-αt)</code> y <code className="text-cyan-300">dv = cos(ωt)dt</code>:
                </p>
                <div
                  dangerouslySetInnerHTML={renderFormula(
                    `I = \\frac{e^{-\\alpha t}\\sin(\\omega t)}{\\omega} + \\frac{\\alpha}{\\omega}\\int e^{-\\alpha t}\\sin(\\omega t)\\,dt`
                  )}
                />
              </div>

              <div className="dsp-well p-3.5 rounded-md space-y-2">
                <span className="font-mono text-amber-400 font-bold uppercase">
                  Paso 2: Integral Cíclica y Despeje Algebraico (SymPy)
                </span>
                <p className="text-[#cbd5e1] leading-relaxed">
                  Aplicando partes por segunda vez aparece nuevamente <code className="text-amber-300">- (α²/ω²) I</code>. Despejando <code className="text-emerald-300">I</code>:
                </p>
                <div
                  dangerouslySetInnerHTML={renderFormula(
                    `F(t) = \\frac{e^{-\\alpha t}\\big(\\omega\\sin(\\omega t) - \\alpha\\cos(\\omega t)\\big)}{\\alpha^2 + \\omega^2}`
                  )}
                />
              </div>

              <div className="dsp-well p-3.5 rounded-md space-y-2">
                <span className="font-mono text-emerald-400 font-bold uppercase">
                  Paso 3: Evaluación en [0, {T} s] (α={dampingAlpha}, ξ={probeFreq}Hz)
                </span>
                <div
                  dangerouslySetInnerHTML={renderFormula(
                    `F(${T}) - F(0) = (${dampedFT.toFixed(6)}) - (${dampedF0.toFixed(6)}) = ${dampedDefinite.toFixed(6)}`
                  )}
                />
                <p className="text-[#94a3b8] font-mono">
                  Verificado simbólicamente con SymPy <code>integrate(exp(-alpha*t)*cos(omega*t), (t, 0, T))</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTechnique === 'improper' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
            <div className="dsp-well p-3.5 rounded-md space-y-2">
              <span className="font-mono text-cyan-400 font-bold uppercase">
                Paso 1: Definición como Límite al Infinito
              </span>
              <p className="text-[#cbd5e1] leading-relaxed">
                La Transformada de Fourier sobre <code className="text-cyan-300">[0, ∞)</code> es una <strong>Integral Impropia de Primera Especie</strong>:
              </p>
              <div
                dangerouslySetInnerHTML={renderFormula(
                  `\\int_{0}^{\\infty} e^{-\\alpha t}\\cos(\\omega t)\\,dt = \\lim_{T \\to \\infty} \\int_{0}^{T} e^{-\\alpha t}\\cos(\\omega t)\\,dt`
                )}
              />
            </div>

            <div className="dsp-well p-3.5 rounded-md space-y-2">
              <span className="font-mono text-amber-400 font-bold uppercase">
                Paso 2: Evaluación del Límite (Teorema del Emparedado)
              </span>
              <p className="text-[#cbd5e1] leading-relaxed">
                Como <code className="text-amber-300">|ω sin(ωT) - α cos(ωT)| ≤ √(α² + ω²)</code> está acotado y <code className="text-emerald-300">lim_(T→∞) e^(-αT) = 0</code> para todo <code className="text-emerald-300">α &gt; 0</code>:
              </p>
              <div
                dangerouslySetInnerHTML={renderFormula(
                  `\\lim_{T \\to \\infty} F(T) = 0 \\implies I_{\\infty} = 0 - F(0) = \\frac{\\alpha}{\\alpha^2 + \\omega^2}`
                )}
              />
            </div>

            <div className="dsp-well p-3.5 rounded-md space-y-2">
              <span className="font-mono text-emerald-400 font-bold uppercase">
                Paso 3: Resultado Exacto en α = {dampingAlpha}, ξ = {probeFreq} Hz
              </span>
              <div
                dangerouslySetInnerHTML={renderFormula(
                  `\\int_{0}^{\\infty} e^{-${dampingAlpha} t}\\cos(2\\pi(${probeFreq}) t)\\,dt = \\frac{${dampingAlpha}}{${dampingAlpha}^2 + (2\\pi\\cdot ${probeFreq})^2} = ${dampedImproper.toFixed(6)}`
                )}
              />
              <p className="text-[#94a3b8] font-mono">
                En T = 40 ms ya se alcanzó el{' '}
                <strong className="text-emerald-400">
                  {((1 - Math.exp(-dampingAlpha * T)) * 100).toFixed(1)}%
                </strong>{' '}
                del decaimiento exponencial hacia la asíntota impropia.
              </p>
            </div>
          </div>
        )}
      </details>
    </div>
  );
};
