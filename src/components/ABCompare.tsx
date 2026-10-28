import React, { useEffect, useState } from 'react';
import { audioEngine } from '../dsp/audioEngine';
import { AudioMetrics } from '../dsp/types';

interface ABCompareProps {
  outputMode: 'raw' | 'clean' | 'mute';
  setOutputMode: (mode: 'raw' | 'clean' | 'mute') => void;
}

export const ABCompare: React.FC<ABCompareProps> = ({ outputMode, setOutputMode }) => {
  const [metrics, setMetrics] = useState<AudioMetrics | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setMetrics(audioEngine.getMetrics()), 150);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = (targetMode: 'raw' | 'clean') => {
    if (outputMode !== targetMode) setOutputMode(audioEngine.toggleOutputMode());
  };

  // Sin datos todavía (motor detenido): se muestra un guion, no valores inventados.
  const v = (x: number | undefined, fmt: (n: number) => string) => (x === undefined ? '—' : fmt(x));

  const meters = [
    { label: 'Atenuación en f₀', value: v(metrics?.attenuationDb, n => `-${n.toFixed(1)}`), unit: 'dB', color: 'text-cyan-400' },
    { label: 'Pico original', value: v(metrics?.rawPeakMagDb, n => `${n}`), unit: `dBFS · ${metrics?.rawPeakFreq ?? '—'} Hz`, color: 'text-amber-400' },
    { label: 'Pico filtrado', value: v(metrics?.cleanPeakMagDb, n => `${n}`), unit: `dBFS · ${metrics?.cleanPeakFreq ?? '—'} Hz`, color: 'text-cyan-400' },
  ];

  return (
    <div className="dsp-chassis rounded-lg p-3.5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-[#f1f5f9] tracking-wider uppercase">Monitor A / B</span>

        <div className="flex items-center dsp-well p-1 rounded-md font-mono text-xs">
          <button
            onClick={() => handleToggle('raw')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
              outputMode === 'raw' ? 'bg-[#1f150d] text-amber-300 border border-[#4a2e12] font-semibold' : 'text-[#94a3b8] hover:text-[#e2e8f0]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${outputMode === 'raw' ? 'bg-amber-400' : 'bg-[#29303d]'}`} />
            A · Original
          </button>
          <button
            onClick={() => handleToggle('clean')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
              outputMode === 'clean' ? 'bg-[#0e1d24] text-cyan-300 border border-[#1b4457] font-semibold' : 'text-[#94a3b8] hover:text-[#e2e8f0]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${outputMode === 'clean' ? 'bg-cyan-400' : 'bg-[#29303d]'}`} />
            B · Filtrado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
        {meters.map(m => (
          <div key={m.label} className="dsp-meter-card p-2.5 rounded-md flex flex-col gap-0.5">
            <span className="text-xs text-[#94a3b8]">{m.label}</span>
            <span className={`text-xl font-bold ${m.color}`}>{m.value}</span>
            <span className="text-xs text-[#94a3b8]">{m.unit}</span>
          </div>
        ))}
      </div>

      {/* Integral de Cálculo II calculada por Simpson sobre la ventana de audio */}
      <div className="dsp-well p-2.5 rounded-md flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-xs">
        <span className="text-[#94a3b8]">Valor RMS = √((1/T)∫f²dt), por Simpson</span>
        <span>
          <span className="text-amber-300">A {v(metrics?.rmsRaw, n => n.toFixed(3))}</span>
          <span className="text-[#475569]"> · </span>
          <span className="text-cyan-300 font-bold">B {v(metrics?.rmsClean, n => n.toFixed(3))}</span>
        </span>
      </div>
    </div>
  );
};
