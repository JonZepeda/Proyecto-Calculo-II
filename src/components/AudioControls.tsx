import React, { useRef, useState } from 'react';
import { Play, Pause, Mic, Upload, Zap, Wind, Bell, Waves, Download, CircleDot, Square, Sparkles } from 'lucide-react';
import { audioEngine } from '../dsp/audioEngine';
import { AudioSourceType, InjectedNoiseType, PresetType } from '../dsp/types';

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
  const [exporting, setExporting] = useState(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [injectedNoise, setInjectedNoiseState] = useState<InjectedNoiseType>('none');

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

  const handleToggleRecord = () => {
    if (!isRecording) {
      audioEngine.startWavRecording();
      setIsRecording(true);
    } else {
      const saved = audioEngine.stopAndDownloadWav('clean');
      setIsRecording(false);
      if (!saved) setMicError('No se grabó audio: inicia el motor con "Iniciar" y vuelve a grabar.');
    }
  };

  const handleCleanAndDownload = async () => {
    setExporting(true);
    try {
      if (!(await audioEngine.exportCleanedFile())) setMicError('Primero carga un archivo WAV o MP3.');
    } catch {
      setMicError('No se pudo procesar el archivo.');
    } finally {
      setExporting(false);
    }
  };

  const handleInjectedNoiseChange = (noise: InjectedNoiseType) => {
    setInjectedNoiseState(noise);
    audioEngine.setInjectedNoise(noise);
  };

  return (
    <div className="dsp-chassis rounded-lg p-3 space-y-2.5">
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
                isPlaying ? 'bg-emerald-500' : 'bg-[#475569]'
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
            <p className="font-mono text-xs text-[#94a3b8]">
              {isPlaying ? 'Motor DSP activo • Procesamiento continuo' : 'Motor en pausa • Listo para capturar'}
            </p>
          </div>
        </div>

        {/* Center: Hardware Channel Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono uppercase text-[#94a3b8] tracking-wider mr-1">
            CANAL:
          </span>

          <button
            onClick={() => handleSelectPreset('hum60')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border ${
              sourceType === 'synthetic' && currentPreset === 'hum60'
                ? 'bg-[#161a22] border-[#2c3445] text-amber-300'
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
                ? 'bg-[#161a22] border-[#2c3445] text-cyan-300'
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
                ? 'bg-[#161a22] border-[#2c3445] text-violet-300'
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
                ? 'bg-[#161a22] border-[#2c3445] text-emerald-300'
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

        {/* Right: Mic, File Capture & WAV Export */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleSelectMic}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border ${
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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border ${
              sourceType === 'file'
                ? 'bg-[#141926] border-[#243352] text-cyan-300'
                : 'bg-[#0e1016] border-[#181c25] text-[#858e9f] hover:text-[#d1d5db] hover:border-[#222734]'
            }`}
          >
            <Upload className="w-3 h-3 text-cyan-400" />
            <span>Cargar WAV/MP3</span>
          </button>

          <button
            onClick={handleToggleRecord}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border ${
              isRecording
                ? 'bg-rose-950/80 border-rose-500 text-rose-200 animate-pulse'
                : 'bg-[#0e1016] border-[#181c25] text-[#94a3b8] hover:text-white hover:border-[#222734]'
            }`}
            title="Graba lo que escuchas ya procesado y lo descarga al detener"
          >
            {isRecording ? (
              <>
                <Square className="w-3 h-3 text-rose-400 fill-current" />
                <span>Detener y descargar WAV</span>
              </>
            ) : (
              <>
                <CircleDot className="w-3 h-3 text-rose-400" />
                <span>Grabar WAV</span>
              </>
            )}
          </button>

          {sourceType === 'file' && (
            <button
              onClick={handleCleanAndDownload}
              disabled={exporting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors border bg-[#0e1d24] border-[#1b4457] text-cyan-300 hover:bg-[#132832] disabled:opacity-50"
              title="Procesa el archivo cargado completo con el filtro actual y descarga un WAV limpio"
            >
              <Download className="w-3 h-3 text-cyan-400" />
              <span>{exporting ? 'Procesando…' : 'Limpiar y descargar'}</span>
            </button>
          )}
        </div>

      </div>

      {/* Live Interference Injector Strip for Microphone / Uploaded Audio Defense Demo */}
      {(sourceType === 'mic' || sourceType === 'file') && (
        <div className="pt-2 border-t border-[#161a24] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 text-[#94a3b8]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Inyector de Interferencia en Vivo (para probar limpieza sobre tu voz/archivo):</span>
          </div>
          <div className="flex items-center gap-1.5">
            {([
              { id: 'none', label: 'Sin Inyección (Puro)' },
              { id: 'hum60', label: '+ Hum 60Hz (Red)' },
              { id: 'whistle2500', label: '+ Silbido 2.5kHz' },
              { id: 'pink', label: '+ Ruido Ambiente' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => handleInjectedNoiseChange(opt.id)}
                className={`px-2.5 py-1 rounded border transition-colors ${
                  injectedNoise === opt.id
                    ? 'bg-[#21160d] border-[#4d3215] text-amber-300 font-semibold'
                    : 'bg-[#0e1016] border-[#181c25] text-[#858e9f] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {micError && (
        <div className="mt-2 text-xs font-mono bg-[#1c0d10] border border-[#4d161d] text-rose-300 px-3 py-2 rounded-lg">
          {micError}
        </div>
      )}
    </div>
  );
};
