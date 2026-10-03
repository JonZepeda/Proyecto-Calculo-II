import React, { useRef, useState } from 'react';
import { Play, Pause, Mic, Upload, Zap, Wind, Bell, Waves } from 'lucide-react';
import { audioEngine } from '../dsp/audioEngine';
import { AudioSourceType, PresetType } from '../dsp/types';

interface AudioControlsProps {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  sourceType: AudioSourceType;
  setSourceType: (type: AudioSourceType) => void;
  currentPreset: PresetType;
  setCurrentPreset: (preset: PresetType) => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  setIsPlaying,
  sourceType,
  setSourceType,
  currentPreset,
  setCurrentPreset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      if (sourceType === 'synthetic') {
        await audioEngine.setSource('synthetic', currentPreset);
      } else {
        await audioEngine.resume();
      }
      setIsPlaying(true);
    }
  };

  const handleSelectPreset = async (preset: PresetType) => {
    setCurrentPreset(preset);
    setSourceType('synthetic');
    setMicError(null);
    await audioEngine.setSource('synthetic', preset);
    setIsPlaying(true);
  };

  const handleSelectMic = async () => {
    try {
      setMicError(null);
      setSourceType('mic');
      await audioEngine.setSource('mic');
      setIsPlaying(true);
    } catch {
      setMicError('Acceso denegado al micrófono. Verifique los permisos del navegador.');
      setSourceType('synthetic');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSourceType('file');
    setMicError(null);
    await audioEngine.setSource('file', undefined, file);
    setIsPlaying(true);
  };

  return (
    <div className="bg-[#0c0e14] border border-[#1a1e27] rounded-xl p-3 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Left: Master Transport Toggle & Signal State */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTogglePlay}
            className={`h-10 px-4 rounded-lg flex items-center gap-2.5 font-mono text-xs font-semibold tracking-wider transition-colors border ${
              isPlaying
                ? 'bg-[#181d27] border-[#2e3748] text-white hover:bg-[#202634]'
                : 'bg-[#12151d] border-[#1e2430] text-[#94a3b8] hover:text-white hover:bg-[#181d27]'
            }`}
            title={isPlaying ? 'Pausar motor DSP' : 'Iniciar motor DSP'}
          >
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                isPlaying ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-[#475569]'
              }`}
            />
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>DETENER</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>INICIAR</span>
              </>
            )}
          </button>

          <div className="border-l border-[#1a1e27] pl-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-[#f1f5f9]">
                {sourceType === 'synthetic' && 'Señal Sintética Modelada'}
                {sourceType === 'mic' && 'Micrófono en Tiempo Real'}
                {sourceType === 'file' && (fileName || 'Archivo de Audio')}
              </span>
            </div>
            <p className="font-mono text-[10px] text-[#64748b]">
              {isPlaying ? 'Motor DSP activo • Procesamiento continuo' : 'Motor en pausa • Listo para capturar'}
            </p>
          </div>
        </div>

        {/* Center: Hardware Channel Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-[#64748b] tracking-wider mr-1">
            CANAL:
          </span>

          <button
            onClick={() => handleSelectPreset('hum60')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border ${
              sourceType === 'synthetic' && currentPreset === 'hum60'
                ? 'bg-[#161a22] border-[#2c3445] text-amber-300 shadow-inner'
                : 'bg-[#0e1016] border-[#181c25] text-[#858e9f] hover:text-[#d1d5db] hover:border-[#222734]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sourceType === 'synthetic' && currentPreset === 'hum60' ? 'bg-amber-400' : 'bg-transparent border border-[#475569]'
              }`}
            />
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Hum 60Hz</span>
          </button>

          <button
            onClick={() => handleSelectPreset('whistle2500')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border ${
              sourceType === 'synthetic' && currentPreset === 'whistle2500'
                ? 'bg-[#161a22] border-[#2c3445] text-cyan-300 shadow-inner'
                : 'bg-[#0e1016] border-[#181c25] text-[#858e9f] hover:text-[#d1d5db] hover:border-[#222734]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sourceType === 'synthetic' && currentPreset === 'whistle2500' ? 'bg-cyan-400' : 'bg-transparent border border-[#475569]'
              }`}
            />
            <Wind className="w-3 h-3 text-cyan-400" />
            <span>Silbido 2.5kHz</span>
          </button>

          <button
            onClick={() => handleSelectPreset('test1000')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border ${
              sourceType === 'synthetic' && currentPreset === 'test1000'
                ? 'bg-[#161a22] border-[#2c3445] text-violet-300 shadow-inner'
                : 'bg-[#0e1016] border-[#181c25] text-[#858e9f] hover:text-[#d1d5db] hover:border-[#222734]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sourceType === 'synthetic' && currentPreset === 'test1000' ? 'bg-violet-400' : 'bg-transparent border border-[#475569]'
              }`}
            />
            <Bell className="w-3 h-3 text-violet-400" />
            <span>Tono 1kHz</span>
          </button>

          <button
            onClick={() => handleSelectPreset('voicePinkNoise')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border ${
              sourceType === 'synthetic' && currentPreset === 'voicePinkNoise'
                ? 'bg-[#161a22] border-[#2c3445] text-emerald-300 shadow-inner'
                : 'bg-[#0e1016] border-[#181c25] text-[#858e9f] hover:text-[#d1d5db] hover:border-[#222734]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sourceType === 'synthetic' && currentPreset === 'voicePinkNoise' ? 'bg-emerald-400' : 'bg-transparent border border-[#475569]'
              }`}
            />
            <Waves className="w-3 h-3 text-emerald-400" />
            <span>Ruido Rosa</span>
          </button>
        </div>

        {/* Right: Mic & Audio File Capture */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSelectMic}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors border ${
              sourceType === 'mic'
                ? 'bg-[#1f1315] border-[#522026] text-rose-300'
                : 'bg-[#0e1016] border-[#181c25] text-[#858e9f] hover:text-[#d1d5db] hover:border-[#222734]'
            }`}
          >
            <Mic className="w-3 h-3 text-rose-400" />
            <span>Micrófono</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors border ${
              sourceType === 'file'
                ? 'bg-[#141926] border-[#243352] text-cyan-300'
                : 'bg-[#0e1016] border-[#181c25] text-[#858e9f] hover:text-[#d1d5db] hover:border-[#222734]'
            }`}
          >
            <Upload className="w-3 h-3 text-cyan-400" />
            <span>Cargar WAV/MP3</span>
          </button>
        </div>

      </div>

      {micError && (
        <div className="mt-2 text-xs font-mono bg-[#1c0d10] border border-[#4d161d] text-rose-300 px-3 py-2 rounded-lg">
          {micError}
        </div>
      )}
    </div>
  );
};
