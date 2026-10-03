import React, { useState } from 'react';
import { FilterParams, FilterType } from '../dsp/types';
import { audioEngine } from '../dsp/audioEngine';
import { Sliders, Cpu } from 'lucide-react';

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

  const adjustFreq = (delta: number) => {
    handleFreqChange(filterParams.frequency + delta);
  };

  return (
    <div className="dsp-chassis rounded-lg p-3.5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-xs font-semibold text-[#f1f5f9] tracking-wider uppercase">
            Filtro Convolucional
          </span>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#12151d] text-[#94a3b8] border border-[#1e2432]">
            H(ξ) • f̂(ξ)
          </span>
        </div>

        {/* Filter Type Pills */}
        <div className="flex items-center dsp-well p-0.5 rounded-md text-xs font-mono">
          <button
            onClick={() => handleTypeChange('notch')}
            className={`px-2.5 py-0.5 rounded transition-colors ${
              filterParams.type === 'notch'
                ? 'bg-[#221013] text-rose-300 border border-[#521b22]'
                : 'text-[#858e9f] hover:text-[#d1d5db]'
            }`}
          >
            Muesca
          </button>
          <button
            onClick={() => handleTypeChange('lowpass')}
            className={`px-2.5 py-0.5 rounded transition-colors ${
              filterParams.type === 'lowpass'
                ? 'bg-[#0f1d24] text-cyan-300 border border-[#184357]'
                : 'text-[#858e9f] hover:text-[#d1d5db]'
            }`}
          >
            Pasa-Bajo
          </button>
          <button
            onClick={() => handleTypeChange('highpass')}
            className={`px-2.5 py-0.5 rounded transition-colors ${
              filterParams.type === 'highpass'
                ? 'bg-[#21160d] text-amber-300 border border-[#4d3215]'
                : 'text-[#858e9f] hover:text-[#d1d5db]'
            }`}
          >
            Pasa-Alto
          </button>
        </div>
      </div>

      {/* Voice-preserving processing toggles */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        {[
          { label: 'Filtro Activo', on: filterParams.enabled, toggle: toggleEnabled },
          { label: 'Banda Vocal (80Hz–3.8kHz)', on: voiceBand, toggle: toggleVoiceBand },
          { label: 'Atenuación Ambiental', on: denoise, toggle: toggleDenoise },
        ].map(t => (
          <button
            key={t.label}
            onClick={t.toggle}
            aria-pressed={t.on}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${
              t.on
                ? 'bg-[#101b15] text-emerald-300 border-[#1f402c]'
                : 'dsp-meter-card text-[#94a3b8] hover:text-[#94a3b8]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                t.on ? 'bg-emerald-400' : 'bg-transparent border border-[#475569]'
              }`}
            />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Ambient-noise reduction strength */}
      <div className="dsp-meter-card p-3 rounded-md flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="denoise-strength" className="text-xs font-mono text-[#94a3b8]">
            Intensidad de atenuación ambiental
          </label>
          <span className="font-mono text-sm font-bold text-emerald-400">
            {Math.round(strength * 100)} %
          </span>
        </div>
        <input
          id="denoise-strength"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={strength}
          disabled={!denoise}
          onChange={e => handleStrengthChange(parseFloat(e.target.value))}
          className="w-full h-1 bg-[#1a1e27] rounded cursor-pointer disabled:opacity-40"
        />
        <div className="flex items-center justify-between text-xs font-mono text-[#94a3b8]">
          <span>Voz natural</span>
          <span>Más agresivo (puede sonar metálico)</span>
        </div>
      </div>

      {/* Main Parameters Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        
        {/* Frequency Slider */}
        <div className="dsp-meter-card p-3 rounded-md flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#94a3b8]">
              {isNotch ? 'Frecuencia Notch (f₀)' : 'Frecuencia de corte (fc)'}
            </span>
            <span className="font-mono text-sm font-bold text-cyan-400">
              {filterParams.frequency} <span className="text-xs text-[#94a3b8]">Hz</span>
            </span>
          </div>

          <input
            type="range"
            min="20"
            max="10000"
            step="1"
            value={filterParams.frequency}
            onChange={e => handleFreqChange(parseInt(e.target.value))}
            className="w-full h-1 bg-[#1a1e27] rounded cursor-pointer"
          />

          {/* Fine Tuning Buttons */}
          <div className="flex items-center justify-between pt-1 text-xs font-mono text-[#94a3b8]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => adjustFreq(-100)}
                className="px-1.5 py-0.5 rounded bg-[#12151d] border border-[#1e2330] hover:text-white"
              >
                -100
              </button>
              <button
                onClick={() => adjustFreq(-10)}
                className="px-1.5 py-0.5 rounded bg-[#12151d] border border-[#1e2330] hover:text-white"
              >
                -10
              </button>
              <button
                onClick={() => adjustFreq(-1)}
                className="px-1.5 py-0.5 rounded bg-[#12151d] border border-[#1e2330] hover:text-white"
              >
                -1
              </button>
            </div>

            <span>Paso fino</span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => adjustFreq(1)}
                className="px-1.5 py-0.5 rounded bg-[#12151d] border border-[#1e2330] hover:text-white"
              >
                +1
              </button>
              <button
                onClick={() => adjustFreq(10)}
                className="px-1.5 py-0.5 rounded bg-[#12151d] border border-[#1e2330] hover:text-white"
              >
                +10
              </button>
              <button
                onClick={() => adjustFreq(100)}
                className="px-1.5 py-0.5 rounded bg-[#12151d] border border-[#1e2330] hover:text-white"
              >
                +100
              </button>
            </div>
          </div>
        </div>

        {/* Q Factor (Quality / Bandwidth) */}
        <div className="dsp-meter-card p-3 rounded-md flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#94a3b8]">
              Factor Q (Selectividad)
            </span>
            <span className="font-mono text-sm font-bold text-violet-400">
              Q = {filterParams.q.toFixed(1)}
            </span>
          </div>

          <input
            type="range"
            min={isNotch ? '1' : '0.5'}
            max={isNotch ? '35' : '2'}
            step={isNotch ? '0.5' : '0.1'}
            value={filterParams.q}
            onChange={e => handleQChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-[#1a1e27] rounded cursor-pointer"
          />

          <div className="flex items-center justify-between pt-1 text-xs font-mono text-[#94a3b8]">
            {isNotch ? (
              <>
                <span>Ancho (Q=1)</span>
                <span className="text-[#94a3b8]">
                  Δf ≈ {(filterParams.frequency / filterParams.q).toFixed(1)} Hz
                </span>
                <span>Estrecho (Q=35)</span>
              </>
            ) : (
              <>
                <span>Suave (0.5)</span>
                <span className="text-[#94a3b8]">0.7 = sin resonancia</span>
                <span>Resonante (2)</span>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Engineering Principle Note */}
      <div className="dsp-well p-2.5 rounded-md text-xs font-mono text-[#858e9f] flex items-start gap-2">
        <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-[#e2e8f0]">Convolución en Frecuencia:</strong> La integral temporal <code className="text-cyan-300">(f * h)(t)</code> equivale al producto algebraico <code className="text-cyan-300">Y(ξ) = F(ξ) • H(ξ)</code>, anulando selectivamente <code className="text-rose-300">H(f₀) ≈ 0</code> con atenuación analítica.
        </p>
      </div>
    </div>
  );
};
