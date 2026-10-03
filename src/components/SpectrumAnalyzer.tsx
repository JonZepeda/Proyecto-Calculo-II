import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../dsp/audioEngine';
import { FilterParams } from '../dsp/types';
import { Crosshair, Activity } from 'lucide-react';

interface SpectrumAnalyzerProps {
  filterParams: FilterParams;
  setFilterParams: (params: Partial<FilterParams>) => void;
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  filterParams,
  setFilterParams,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLogScale, setIsLogScale] = useState<boolean>(true);
  const [hoverFreq, setHoverFreq] = useState<number | null>(null);

  // Helper: map frequency (Hz) to X coordinate on canvas
  const freqToX = (freq: number, width: number, minF: number = 20, maxF: number = 20000) => {
    if (isLogScale) {
      const minLog = Math.log10(minF);
      const maxLog = Math.log10(maxF);
      const fLog = Math.log10(Math.max(minF, Math.min(maxF, freq)));
      return ((fLog - minLog) / (maxLog - minLog)) * width;
    } else {
      return ((freq - minF) / (maxF - minF)) * width;
    }
  };

  // Helper: map X coordinate back to frequency (Hz)
  const xToFreq = (x: number, width: number, minF: number = 20, maxF: number = 20000) => {
    const ratio = Math.max(0, Math.min(1, x / width));
    if (isLogScale) {
      const minLog = Math.log10(minF);
      const maxLog = Math.log10(maxF);
      return Math.round(Math.pow(10, minLog + ratio * (maxLog - minLog)));
    } else {
      return Math.round(minF + ratio * (maxF - minF));
    }
  };

  // Handle click on canvas to set notch filter frequency
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const freq = xToFreq(x, rect.width);
    setFilterParams({ frequency: freq });
    audioEngine.setFilterParams({ frequency: freq });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverFreq(xToFreq(x, rect.width));
  };

  const handleMouseLeave = () => {
    setHoverFreq(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep obsidian well background
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, width, height);

      // Draw dB grid lines (-12dB, -24dB, -36dB, -48dB)
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      const dbSteps = [0.2, 0.4, 0.6, 0.8];
      dbSteps.forEach(ratio => {
        const y = height * ratio;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px JetBrains Mono, monospace';
        const dbVal = Math.round(-ratio * 60);
        ctx.fillText(`${dbVal}dB`, 5, y - 3);
      });

      // Draw vertical frequency guidelines
      const guideFreqs = [60, 120, 250, 500, 1000, 2500, 5000, 10000];
      guideFreqs.forEach(f => {
        const x = freqToX(f, width);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px JetBrains Mono, monospace';
        const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
        ctx.fillText(label, x + 3, height - 5);
      });

      // Fetch FFT data
      const rawFreqData = audioEngine.getRawFrequency();
      const cleanFreqData = audioEngine.getCleanFrequency();
      const sampleRate = audioEngine.getSampleRate();
      const binCount = rawFreqData.length;
      const nyquist = sampleRate / 2;

      // Draw Raw Frequency Curve (Amber/Red fill)
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 1; i < binCount; i++) {
        const freq = (i * nyquist) / binCount;
        if (freq < 20 || freq > 20000) continue;
        const x = freqToX(freq, width);
        const mag = rawFreqData[i] / 255.0;
        const y = height - mag * (height - 20) - 2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.fill();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.stroke();

      // Draw Clean Frequency Curve (Sharp Surgical Cyan)
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 1; i < binCount; i++) {
        const freq = (i * nyquist) / binCount;
        if (freq < 20 || freq > 20000) continue;
        const x = freqToX(freq, width);
        const mag = cleanFreqData[i] / 255.0;
        const y = height - mag * (height - 20) - 2;
        if (i === 1) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 1.75;
      ctx.strokeStyle = '#06b6d4';
      ctx.shadowBlur = 0; // Pure vector line without blurry glow
      ctx.stroke();

      // Draw Active Filter Notch Marker
      const notchX = freqToX(filterParams.frequency, width);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#f43f5e';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(notchX, 0);
      ctx.lineTo(notchX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Notch indicator marker head
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(notchX, 10, 4, 0, Math.PI * 2);
      ctx.fill();

      // Filter frequency label badge
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      const fLabel = `${Math.round(filterParams.frequency)} Hz`;
      ctx.fillText(fLabel, Math.max(5, Math.min(width - 65, notchX + 6)), 14);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [filterParams.frequency, isLogScale]);

  const handleAutoDetect = () => {
    const rawFreq = audioEngine.getRawFrequency();
    const sampleRate = audioEngine.getSampleRate();
    const nyquist = sampleRate / 2;
    const binCount = rawFreq.length;

    let peakMag = 0;
    let peakBin = -1;

    // Scan for stationary tone peak above 30 Hz
    for (let i = 2; i < binCount; i++) {
      const freq = (i * nyquist) / binCount;
      if (freq < 30 || freq > 12000) continue;

      if (rawFreq[i] > peakMag && rawFreq[i] > 100) {
        peakMag = rawFreq[i];
        peakBin = i;
      }
    }

    if (peakBin !== -1) {
      const detectedFreq = Math.round((peakBin * nyquist) / binCount);
      setFilterParams({ frequency: detectedFreq });
      audioEngine.setFilterParams({ frequency: detectedFreq });
    }
  };

  return (
    <div className="dsp-chassis rounded-lg p-3.5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#f1f5f9] tracking-wider uppercase">
            Analizador Espectral
          </span>
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#12151d] text-[#94a3b8] border border-[#1e2432]">
            |f̂(ξ)| [FOURIER FFT]
          </span>
        </div>

        {/* Auto Detect & Scale Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoDetect}
            className="flex items-center gap-1.5 bg-[#171216] border border-[#3d1e28] text-rose-300 hover:text-white hover:bg-[#251520] px-2.5 py-1 rounded text-xs font-mono transition-colors"
            title="Escanear espectro y sintonizar muesca sobre el armónico parásito"
          >
            <Activity className="w-3 h-3 text-rose-400" />
            <span>Auto-Detectar</span>
          </button>

          <div className="flex items-center dsp-well p-0.5 rounded-md text-xs font-mono">
            <button
              onClick={() => setIsLogScale(true)}
              className={`px-2 py-0.5 rounded transition-colors ${
                isLogScale ? 'bg-[#181c25] text-white border border-[#2b3342]' : 'text-[#858e9f]'
              }`}
            >
              Log
            </button>
            <button
              onClick={() => setIsLogScale(false)}
              className={`px-2 py-0.5 rounded transition-colors ${
                !isLogScale ? 'bg-[#181c25] text-white border border-[#2b3342]' : 'text-[#858e9f]'
              }`}
            >
              Lineal
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Display Well */}
      <div className="relative w-full h-52 sm:h-56 dsp-well rounded-md overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block"
        />

        {/* Hover Coordinate Readout */}
        {hoverFreq && (
          <div className="absolute top-2 right-2.5 flex items-center gap-1 text-xs font-mono dsp-meter-card px-2 py-0.5 rounded-md text-[#e2e8f0]">
            <Crosshair className="w-3 h-3 text-cyan-400" />
            <span>{hoverFreq} Hz</span>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-2 left-2.5 flex items-center gap-3 text-xs font-mono dsp-meter-card px-2 py-0.5 rounded-md">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span className="text-rose-300">Crudo (Pico)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span className="text-cyan-300">Filtrado (Muesca)</span>
          </div>
          <span className="hidden sm:inline text-[#94a3b8]">• Clic en canvas para mover f₀</span>
        </div>
      </div>
    </div>
  );
};
