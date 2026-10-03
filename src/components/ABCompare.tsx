import React, { useEffect, useState } from 'react';
import { audioEngine } from '../dsp/audioEngine';
import { AudioMetrics } from '../dsp/types';

interface ABCompareProps {
  outputMode: 'raw' | 'clean' | 'mute';
  setOutputMode: (mode: 'raw' | 'clean' | 'mute') => void;
}

export const ABCompare: React.FC<ABCompareProps> = ({ outputMode, setOutputMode }) => {
  const [metrics, setMetrics] = useState<AudioMetrics>({
    rawPeakFreq: 60,
    rawPeakMagDb: -18,
    cleanPeakFreq: 60,
    cleanPeakMagDb: -52,
    attenuationDb: 34.0,
    snrEstimateDb: 22.5,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const m = audioEngine.getMetrics();
      setMetrics(m);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = (targetMode: 'raw' | 'clean') => {
    if (outputMode !== targetMode) {
      const next = audioEngine.toggleOutputMode();
      setOutputMode(next);
    }
  };

  // Convert dB attenuation to approximate power percentage: 1 - 10^(-attenuation/10)
  const powerReductionPercent = Math.min(
    99.9,
    Math.max(0, (1 - Math.pow(10, -metrics.attenuationDb / 10)) * 100)
  ).toFixed(1);

  return (
    <div className="dsp-chassis rounded-lg p-3.5 flex flex-col gap-3">
      {/* Header and Industrial Rocker Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#f1f5f9] tracking-wider uppercase">
              Conmutador Monitor A / B
            </span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#12151d] text-[#94a3b8] border border-[#1e2432]">
              LATENCIA ZERO
            </span>
          </div>
          <p className="text-xs font-mono text-[#94a3b8] mt-0.5">
            Alternancia instantánea entre canal de entrada crudo y salida filtrada
          </p>
        </div>

        {/* Industrial Rocker Segment Control */}
        <div className="flex items-center dsp-well p-1 rounded-md font-mono text-xs">
          <button
            onClick={() => handleToggle('raw')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
              outputMode === 'raw'
                ? 'bg-[#1f150d] text-amber-300 border border-[#4a2e12] font-semibold'
                : 'text-[#94a3b8] hover:text-[#94a3b8]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                outputMode === 'raw' ? 'bg-amber-400' : 'bg-[#29303d]'
              }`}
            />
            <span>CANAL A (CRUDO)</span>
          </button>

          <button
            onClick={() => handleToggle('clean')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
              outputMode === 'clean'
                ? 'bg-[#0e1d24] text-cyan-300 border border-[#1b4457] font-semibold'
                : 'text-[#94a3b8] hover:text-[#94a3b8]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                outputMode === 'clean' ? 'bg-cyan-400' : 'bg-[#29303d]'
              }`}
            />
            <span>CANAL B (DSP ON)</span>
          </button>
        </div>
      </div>

      {/* Engineering Precision Meters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
        
        {/* Metric 1: dB Attenuation */}
        <div className="dsp-meter-card p-2.5 rounded-md flex flex-col gap-0.5">
          <span className="text-xs uppercase text-[#94a3b8] tracking-wider">Atenuación Muesca</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-emerald-400">
              -{metrics.attenuationDb}
            </span>
            <span className="text-xs text-[#94a3b8]">dB</span>
          </div>
          <span className="text-xs text-[#94a3b8]">
            En coordenada f₀
          </span>
        </div>

        {/* Metric 2: Power reduction percentage */}
        <div className="dsp-meter-card p-2.5 rounded-md flex flex-col gap-0.5">
          <span className="text-xs uppercase text-[#94a3b8] tracking-wider">Supresión Potencia</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-cyan-400">
              {powerReductionPercent}%
            </span>
          </div>
          <span className="text-xs text-[#94a3b8]">
            Energía armónica eliminada
          </span>
        </div>

        {/* Metric 3: Input Peak dB */}
        <div className="dsp-meter-card p-2.5 rounded-md flex flex-col gap-0.5">
          <span className="text-xs uppercase text-[#94a3b8] tracking-wider">Pico Canal A (In)</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-amber-400">
              {metrics.rawPeakMagDb}
            </span>
            <span className="text-xs text-[#94a3b8]">dBFS</span>
          </div>
          <span className="text-xs text-[#94a3b8]">
            f = {metrics.rawPeakFreq} Hz
          </span>
        </div>

        {/* Metric 4: Estimated SNR */}
        <div className="dsp-meter-card p-2.5 rounded-md flex flex-col gap-0.5">
          <span className="text-xs uppercase text-[#94a3b8] tracking-wider">SNR Estimado</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold text-violet-400">
              +{metrics.snrEstimateDb}
            </span>
            <span className="text-xs text-[#94a3b8]">dB</span>
          </div>
          <span className="text-xs text-[#94a3b8]">
            Margen dinámico útil
          </span>
        </div>

      </div>
    </div>
  );
};
