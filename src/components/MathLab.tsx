import React, { useEffect, useRef, useState, useMemo } from 'react';
import katex from 'katex';
import {
  computeRiemannFourier,
  generateSyntheticWindow,
  sweepRiemannSpectrum,
} from '../dsp/riemannFourier';
import { Sparkles, CheckCircle2, AlertCircle, ArrowRight, HelpCircle } from 'lucide-react';

export const MathLab: React.FC = () => {
  const [probeFreq, setProbeFreq] = useState<number>(60);
  const [noiseFreq, setNoiseFreq] = useState<number>(60);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  // Generate a 40ms signal window
  const windowData = useMemo(() => {
    return generateSyntheticWindow(0.04, 44100, noiseFreq);
  }, [noiseFreq]);

  // Compute Riemann integration for current probe frequency
  const riemannResult = useMemo(() => {
    return computeRiemannFourier(windowData.samples, 44100, probeFreq, 300);
  }, [windowData, probeFreq]);

  // Compute full spectrum sweep using Riemann sums
  const sweepData = useMemo(() => {
    return sweepRiemannSpectrum(windowData.samples, 44100, 20, 1500, 75);
  }, [windowData]);

  // Render main Riemann integration canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    const steps = riemannResult.steps;
    if (steps.length === 0) return;

    // 3 subplots:
    // 1. Top: Signal f(t) and Basis cos(ωt) [height 0 -> height * 0.33]
    // 2. Middle: Integrand product g(t) = f(t)*cos(ωt) with green/red area [height * 0.35 -> height * 0.68]
    // 3. Bottom: Cumulative Area under the curve [height * 0.70 -> height]

    const h1 = height * 0.30;
    const h2Start = height * 0.35;
    const h2 = height * 0.30;
    const h3Start = height * 0.70;
    const h3 = height * 0.28;

    // Helper: grid line and axis
    const drawAxis = (yCenter: number, label: string) => {
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yCenter);
      ctx.lineTo(width, yCenter);
      ctx.stroke();

      ctx.fillStyle = '#71717a';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(label, 8, yCenter - 6);
    };

    // --- Subplot 1: Signal f(t) and Basis cos(ωt) ---
    const yCenter1 = h1 / 2 + 10;
    drawAxis(yCenter1, '1. f(t) [Ámbar] vs cos(2πξt) [Cyan]');

    const dx = width / steps.length;

    // Signal f(t)
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

    // Basis cos(ωt)
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

    // --- Subplot 2: Integrand Product g(t) = f(t) * cos(ωt) with Area ---
    const yCenter2 = h2Start + h2 / 2;
    drawAxis(yCenter2, '2. Función Integrando g(t) = f(t) • cos(2πξt) [Área bajo la curva]');

    for (let i = 0; i < steps.length; i++) {
      const x = i * dx;
      const val = steps[i].productVal;
      const rectHeight = val * (h2 * 0.4);

      if (val >= 0) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.45)'; // Green positive area
        ctx.fillRect(x, yCenter2 - rectHeight, dx + 0.5, rectHeight);
      } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)'; // Red negative area
        ctx.fillRect(x, yCenter2, dx + 0.5, -rectHeight);
      }
    }

    // Product line outline
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

    // --- Subplot 3: Cumulative Riemann Area ∫ g(t) dt ---
    const yCenter3 = h3Start + h3 / 2;
    drawAxis(yCenter3, '3. Suma de Riemann Acumulada ∫₀ᵗ f(τ)cos(2πξτ)dτ');

    const maxArea = Math.max(0.001, Math.abs(riemannResult.totalAreaCos) * 1.3);

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

    // Highlight final total area point
    const lastX = (steps.length - 1) * dx;
    const lastNormY = steps[steps.length - 1].cumulativeArea / maxArea;
    const lastY = yCenter3 - lastNormY * (h3 * 0.45);

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();

  }, [riemannResult]);

  // Render Riemann full spectrum sweep canvas
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

    // Draw spectrum curve
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

    // Highlight current probe frequency position
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

  // Render KaTeX formula safely
  const renderFormula = (tex: string) => {
    try {
      return { __html: katex.renderToString(tex, { displayMode: true, throwOnError: false }) };
    } catch {
      return { __html: tex };
    }
  };

  const isResonance = Math.abs(probeFreq - noiseFreq) < 5 || probeFreq === 140 || probeFreq === 700;

  return (
    <div className="space-y-6">
      
      {/* Introduction Card */}
      <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase font-bold text-cyan-400 tracking-wider">
                Demostración Didáctica de Cálculo Integral
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                Sumas de Riemann & Ortogonalidad
              </span>
            </div>
            <h2 className="text-xl font-bold text-neutral-100 mt-1">
              ¿Cómo calcula la Integral de Fourier el Espectro de Frecuencias?
            </h2>
            <p className="text-sm text-neutral-400 mt-1 leading-relaxed">
              La integral continua de Fourier evalúa la correlación de la señal física <code className="text-amber-300 font-mono">f(t)</code> multiplicándola por una base armónica oscilatoria <code className="text-cyan-300 font-mono">cos(2πξt)</code> y midiendo el <strong>área neta acumulada bajo la curva</strong> mediante sumas de rectángulos de Riemann.
            </p>
          </div>
        </div>

        {/* Formula Banner */}
        <div className="mt-4 bg-neutral-950 p-4 rounded-xl border border-neutral-800 overflow-x-auto text-center">
          <div
            dangerouslySetInnerHTML={renderFormula(
              `\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(t) e^{-i 2\\pi \\xi t} \\, dt = \\underbrace{\\int_{-\\infty}^{\\infty} f(t) \\cos(2\\pi \\xi t) \\, dt}_{I_{\\text{cos}}(\\xi)} - i \\underbrace{\\int_{-\\infty}^{\\infty} f(t) \\sin(2\\pi \\xi t) \\, dt}_{I_{\\text{sin}}(\\xi)}`
            )}
          />
        </div>
      </div>

      {/* Interactive Controls & Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Interactive Controls */}
        <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <h3 className="font-bold text-sm text-neutral-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Parámetros de Integración</span>
          </h3>

          {/* Probe frequency slider */}
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-300">
                Frecuencia de Prueba de la Integral (ξ)
              </label>
              <span className="font-mono text-base font-bold text-cyan-400">
                {probeFreq} <span className="text-xs text-neutral-400">Hz</span>
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

            {/* Quick Test Buttons */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
              <button
                onClick={() => setProbeFreq(60)}
                className={`px-2 py-1.5 rounded-lg border font-medium transition-all ${
                  probeFreq === 60
                    ? 'bg-rose-950 border-rose-600 text-rose-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Pico de Ruido (60 Hz)
              </button>
              <button
                onClick={() => setProbeFreq(140)}
                className={`px-2 py-1.5 rounded-lg border font-medium transition-all ${
                  probeFreq === 140
                    ? 'bg-amber-950 border-amber-600 text-amber-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Voz Fundamental (140 Hz)
              </button>
              <button
                onClick={() => setProbeFreq(350)}
                className={`px-2 py-1.5 rounded-lg border font-medium transition-all ${
                  probeFreq === 350
                    ? 'bg-cyan-950 border-cyan-600 text-cyan-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Ortogonal (350 Hz)
              </button>
              <button
                onClick={() => setProbeFreq(700)}
                className={`px-2 py-1.5 rounded-lg border font-medium transition-all ${
                  probeFreq === 700
                    ? 'bg-violet-950 border-violet-600 text-violet-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Formante F1 (700 Hz)
              </button>
            </div>
          </div>

          {/* Numerical Integration Result */}
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
            <span className="text-xs font-mono text-neutral-400 uppercase font-bold">
              Resultado Numérico de la Integral
            </span>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-neutral-900">
                <span className="text-neutral-400">Parte Real ∫ f(t)cos(ωt)dt:</span>
                <span className="font-bold text-emerald-400">
                  {riemannResult.totalAreaCos.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-900">
                <span className="text-neutral-400">Parte Imag -∫ f(t)sin(ωt)dt:</span>
                <span className="font-bold text-cyan-400">
                  {(-riemannResult.totalAreaSin).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between py-1 pt-2 font-bold text-sm">
                <span className="text-neutral-200">Magnitud |f̂(ξ)|:</span>
                <span className={isResonance ? 'text-rose-400' : 'text-neutral-400'}>
                  {riemannResult.magnitude.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Diagnostic Interpretation */}
            <div
              className={`mt-2 p-2.5 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${
                isResonance
                  ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                  : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-200'
              }`}
            >
              {isResonance ? (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>¡Sintonía / Componente Presente!</strong> Las oscilaciones están en fase, el integrando es predominantemente positivo y el área bajo la curva no se cancela.
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Ortogonalidad Cumplida:</strong> Las áreas positivas (verdes) y negativas (rojas) se anulan exactamente entre sí. Área neta ≈ 0.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Full Riemann Spectrum Sweep Preview */}
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
            <span className="text-[11px] font-mono text-neutral-400 block mb-1">
              Espectro Completo por Sumas de Riemann (20 - 1500 Hz):
            </span>
            <div className="w-full h-24 rounded-lg overflow-hidden border border-neutral-900 bg-neutral-950">
              <canvas
                ref={spectrumCanvasRef}
                width={300}
                height={96}
                className="w-full h-full block"
              />
            </div>
          </div>

        </div>

        {/* Center & Right Columns: 3-Stage Canvas Visualizer */}
        <div className="lg:col-span-2 bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-neutral-100 flex items-center gap-2">
              <span>Desglose Gráfico de la Integral de Riemann</span>
            </h3>
            <span className="text-xs font-mono text-neutral-400">
              Ventana de Análisis: 40 ms (N = 300 rectángulos)
            </span>
          </div>

          <div className="relative w-full h-[460px] rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950">
            <canvas
              ref={canvasRef}
              width={750}
              height={460}
              className="w-full h-full block"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-center pt-1 text-neutral-400">
            <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-900">
              <span className="text-amber-400 font-bold">1. Multiplicación:</span><br/>
              f(t) • cos(2πξt)
            </div>
            <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-900">
              <span className="text-purple-400 font-bold">2. Partición:</span><br/>
              Δt = 1 / 44,100 s
            </div>
            <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-900">
              <span className="text-emerald-400 font-bold">3. Área Neta:</span><br/>
              ∫ = ∑ g(tₙ) Δt
            </div>
          </div>
        </div>

      </div>

      {/* 4 Theoretical Cornerstones Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        
        <div className="bg-neutral-900/50 border border-neutral-800/80 p-4 rounded-xl flex flex-col gap-2">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
            1. Integral Impropia
          </span>
          <h4 className="font-semibold text-sm text-neutral-200">
            Convergencia en L²(ℝ)
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            La transformada existe para toda señal de energía finita, evaluando el límite cuando el horizonte temporal tiende al infinito simétricamente.
          </p>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800/80 p-4 rounded-xl flex flex-col gap-2">
          <span className="text-xs font-bold text-purple-400 uppercase tracking-wider font-mono">
            2. Ortogonalidad
          </span>
          <h4 className="font-semibold text-sm text-neutral-200">
            Base Armónica Trigonométrica
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            La integral de dos frecuencias distintas sobre un periodo es cero. Por ello, la integral de Fourier solo arroja valor no nulo en las frecuencias contenidas.
          </p>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800/80 p-4 rounded-xl flex flex-col gap-2">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
            3. Convolución
          </span>
          <h4 className="font-semibold text-sm text-neutral-200">
            De Integral a Producto
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            La integral de convolución en el tiempo (f * h)(t) se transforma en una simple multiplicación espectral F(ξ) • H(ξ), permitiendo filtros en tiempo real.
          </p>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800/80 p-4 rounded-xl flex flex-col gap-2">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
            4. Parseval
          </span>
          <h4 className="font-semibold text-sm text-neutral-200">
            Conservación de Energía
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            La integral del cuadrado de la amplitud temporal es igual a la integral de la densidad espectral. Anular una muesca no destruye la energía de la voz.
          </p>
        </div>

      </div>

    </div>
  );
};
