import React, { useEffect, useState } from 'react';
import { Activity, Sigma, Volume2, VolumeX } from 'lucide-react';
import { audioEngine } from '../dsp/audioEngine';

interface NavbarProps {
  activeTab: 'lab' | 'math';
  setActiveTab: (tab: 'lab' | 'math') => void;
  outputMode: 'raw' | 'clean' | 'mute';
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, outputMode }) => {
  const [volume, setVolume] = useState(0.7);
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioEngine.setMasterVolume(val);
  };

  return (
    <header className="border-b border-[#171b24] bg-[#090b0f] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Left: Tactical Brand and Course Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#12151d] border border-[#232938] flex items-center justify-center">
            <span className="font-mono font-bold text-[#f59e0b] text-base leading-none">∫</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-sm tracking-tight">FOURIER•DSP</span>
              <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-[#12151d] text-[#94a3b8] border border-[#1e2330]">
                CÁLCULO II
              </span>
            </div>
            <p className="text-xs font-mono text-[#94a3b8] hidden xl:block whitespace-nowrap">
              Recuperación Espectral Quirúrgica en Tiempo Real
            </p>
          </div>
        </div>

        {/* Center: Tactile Hardware Console Tabs */}
        <nav role="tablist" aria-label="Secciones" className="flex items-center gap-1 dsp-well p-1 rounded-md">
          <button
            role="tab" aria-selected={activeTab === 'lab'} onClick={() => setActiveTab('lab')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'lab'
                ? 'bg-[#181c25] text-white border border-[#262c3a]'
                : 'text-[#858e9f] hover:text-[#e2e8f0] hover:bg-[#12151d]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Laboratorio DSP</span>
          </button>

          <button
            role="tab" aria-selected={activeTab === 'math'} onClick={() => setActiveTab('math')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'math'
                ? 'bg-[#181c25] text-white border border-[#262c3a]'
                : 'text-[#858e9f] hover:text-[#e2e8f0] hover:bg-[#12151d]'
            }`}
          >
            <Sigma className="w-3.5 h-3.5 text-amber-400" />
            <span>Fundamento Matemático</span>
          </button>
        </nav>

        {/* Right: Master Clock & Hardware Level Fader */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 text-xs font-mono text-[#94a3b8] whitespace-nowrap">
            <span className="flex items-center gap-1.5 text-[#94a3b8]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {fps} FPS
            </span>
            <span className="text-[#2c3344]">|</span>
            <span>44.1 kHz</span>
          </div>

          <div className="flex items-center gap-2 dsp-meter-card px-2.5 py-1 rounded-md">
            {volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-[#94a3b8]" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-14 sm:w-18 h-1 bg-[#1a1e27] rounded cursor-pointer"
              title="Volumen Maestro" aria-label="Volumen maestro"
            />
            <span className="font-mono text-xs text-[#94a3b8] w-7 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

      </div>
    </header>
  );
};
