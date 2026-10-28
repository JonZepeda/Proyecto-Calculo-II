import React, { useState } from 'react';
import { FilterParams, FilterType } from '../dsp/types';
import { audioEngine } from '../dsp/audioEngine';
import { Sliders } from 'lucide-react';

interface FilterControlsProps {
  filterParams: FilterParams;
  setFilterParams: (params: Partial<FilterParams>) => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  filterParams,
  setFilterParams,
}) => {
  const [denoise, setDenoise] = useState(audioEngine.getDenoiseEnabled());
  const [voiceBand, setVoiceBand] = useState(audioEngine.getVoiceBandEnabled());

  const toggleEnabled = () => {
    setFilterParams({ enabled: !filterParams.enabled });
    audioEngine.setFilterParams({ enabled: !filterParams.enabled });
  };
  const toggleDenoise = () => {
    audioEngine.setDenoiseEnabled(!denoise);
    setDenoise(!denoise);
  };
  const toggleVoiceBand = () => {
    audioEngine.setVoiceBandEnabled(!voiceBand);
    setVoiceBand(!voiceBand);
  };

  const [strength, setStrength] = useState(audioEngine.getDenoiseStrength());
  const isNotch = filterParams.type === 'notch';

  // Sensible defaults per type: a lowpass/highpass left at the notch's 60 Hz / Q=12 either
  // silences the voice (lowpass@60Hz) or adds a +12 dB resonance (Q is in dB for LP/HP).
  const TYPE_DEFAULTS: Record<FilterType, { frequency: number; q: number }> = {
    notch: { frequency: 60, q: 12 },
    lowpass: { frequency: 3400, q: 0.7 },
    highpass: { frequency: 100, q: 0.7 },
    bandpass: { frequency: 1000, q: 1 },
  };

  const handleTypeChange = (type: FilterType) => {
    const next = { type, ...TYPE_DEFAULTS[type] };
    setFilterParams(next);
    audioEngine.setFilterParams(next);
  };

  const handleStrengthChange = (v: number) => {
    audioEngine.setDenoiseStrength(v);
    setStrength(v);
  };

  const handleFreqChange = (freq: number) => {
    const clamped = Math.max(20, Math.min(20000, freq));
    setFilterParams({ frequency: clamped });
    audioEngine.setFilterParams({ frequency: clamped });
  };

  const handleQChange = (q: number) => {
    const clamped = isNotch ? Math.max(0.5, Math.min(40, q)) : Math.max(0.5, Math.min(2, q));
    setFilterParams({ q: clamped });
    audioEngine.setFilterParams({ q: clamped });
  };

  const TYPES: { type: FilterType; label: string; on: string }[] = [
    { type: 'notch', label: 'Muesca', on: 'bg-[#221013] text-rose-300 border border-[#521b22]' },
    { type: 'lowpass', label: 'Pasa-Bajo', on: 'bg-[#0f1d24] text-cyan-300 border border-[#184357]' },
    { type: 'highpass', label: 'Pasa-Alto', on: 'bg-[#21160d] text-amber-300 border border-[#4d3215]' },
  ];

  return (
    <div className="dsp-chassis rounded-lg p-3.5 flex flex-col gap-3">
      {/* Header + filter type */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-xs font-semibold text-[#f1f5f9] tracking-wider uppercase">Filtro</span>
        </div>
        <div className="flex items-center dsp-well p-0.5 rounded-md text-xs font-mono">
          {TYPES.map(t => (
            <button
              key={t.type}
              onClick={() => handleTypeChange(t.type)}
              className={`px-2.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                filterParams.type === t.type ? t.on : 'text-[#858e9f] hover:text-[#d1d5db]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* On/off toggles */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        {[
          { label: 'Filtro', on: filterParams.enabled, toggle: toggleEnabled },
          { label: 'Banda de voz', on: voiceBand, toggle: toggleVoiceBand },
          { label: 'Reducir ruido', on: denoise, toggle: toggleDenoise },
        ].map(t => (
          <button
            key={t.label}
            onClick={t.toggle}
            aria-pressed={t.on}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border whitespace-nowrap transition-colors ${
              t.on
                ? 'bg-[#101b15] text-emerald-300 border-[#1f402c]'
                : 'dsp-meter-card text-[#94a3b8] hover:text-[#e2e8f0]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${t.on ? 'bg-emerald-400' : 'bg-transparent border border-[#475569]'}`} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Sliders: one compact card each */}
      <div className="dsp-meter-card p-3 rounded-md flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="denoise-strength" className="text-xs font-mono text-[#94a3b8]">Intensidad del ruido a quitar</label>
          <span className="font-mono text-sm font-bold text-cyan-400">{Math.round(strength * 100)} %</span>
        </div>
        <input
          id="denoise-strength"
          type="range" min="0" max="1" step="0.05" value={strength} disabled={!denoise}
          title="Más alto quita más ruido, pero la voz puede sonar metálica"
          onChange={e => handleStrengthChange(parseFloat(e.target.value))}
          className="w-full h-1 bg-[#1a1e27] rounded cursor-pointer disabled:opacity-40"
        />
      </div>

      <div className="dsp-meter-card p-3 rounded-md flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="filter-freq" className="text-xs font-mono text-[#94a3b8]">
            {isNotch ? 'Frecuencia a eliminar' : 'Frecuencia de corte'}
          </label>
          <span className="font-mono text-sm font-bold text-cyan-400">
            {filterParams.frequency} <span className="text-xs text-[#94a3b8]">Hz</span>
          </span>
        </div>
        <input
          id="filter-freq"
          type="range" min="20" max="10000" step="1" value={filterParams.frequency}
          onChange={e => handleFreqChange(parseInt(e.target.value))}
          className="w-full h-1 bg-[#1a1e27] rounded cursor-pointer"
        />
      </div>

      <div className="dsp-meter-card p-3 rounded-md flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="filter-q" className="text-xs font-mono text-[#94a3b8]">
            {isNotch ? 'Selectividad (Q)' : 'Resonancia (Q)'}
          </label>
          <span className="font-mono text-sm font-bold text-cyan-400">
            {filterParams.q.toFixed(1)}
            {isNotch && (
              <span className="text-xs font-normal text-[#94a3b8]"> · ancho ≈ {(filterParams.frequency / filterParams.q).toFixed(1)} Hz</span>
            )}
          </span>
        </div>
        <input
          id="filter-q"
          type="range"
          min={isNotch ? '1' : '0.5'} max={isNotch ? '35' : '2'} step={isNotch ? '0.5' : '0.1'}
          value={filterParams.q}
          onChange={e => handleQChange(parseFloat(e.target.value))}
          className="w-full h-1 bg-[#1a1e27] rounded cursor-pointer"
        />
      </div>
    </div>
  );
};
