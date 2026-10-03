import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { AudioControls } from './components/AudioControls';
import { Oscilloscope } from './components/Oscilloscope';
import { SpectrumAnalyzer } from './components/SpectrumAnalyzer';
import { Spectrogram } from './components/Spectrogram';
import { FilterControls } from './components/FilterControls';
import { ABCompare } from './components/ABCompare';
import { MathLab } from './components/MathLab';
import { ReportViewer } from './components/ReportViewer';
import { AudioSourceType, FilterParams, PresetType } from './dsp/types';
import { informeContent, defensaContent } from './docsData';

export const App: React.FC = () => {
  const getInitialTab = (): 'lab' | 'math' | 'report' => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'math' || tabParam === 'report') return tabParam;
    if (window.location.hash === '#math') return 'math';
    if (window.location.hash === '#report') return 'report';
    return 'lab';
  };

  const [activeTab, setActiveTab] = useState<'lab' | 'math' | 'report'>(getInitialTab);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [sourceType, setSourceType] = useState<AudioSourceType>('synthetic');
  const [currentPreset, setCurrentPreset] = useState<PresetType>('hum60');
  const [outputMode, setOutputMode] = useState<'raw' | 'clean' | 'mute'>('clean');

  const [filterParams, setFilterParamsState] = useState<FilterParams>({
    type: 'notch',
    frequency: 60,
    q: 12,
    gain: 0,
    enabled: true,
  });

  const handleFilterParamsChange = (params: Partial<FilterParams>) => {
    setFilterParamsState(prev => ({ ...prev, ...params }));
  };

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e2e8f0] flex flex-col selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        outputMode={outputMode}
      />

      {/* Main Console Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5">
        {activeTab === 'lab' && (
          <div className="space-y-4">
            
            {/* 1. Audio Source Controls Strip */}
            <AudioControls
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              sourceType={sourceType}
              setSourceType={setSourceType}
              currentPreset={currentPreset}
              setCurrentPreset={setCurrentPreset}
            />

            {/* 2. Visualizers Grid: Dual-Trace Oscilloscope & Fourier Spectrum Analyzer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Oscilloscope isPlaying={isPlaying} />
              <SpectrumAnalyzer
                filterParams={filterParams}
                setFilterParams={handleFilterParamsChange}
              />
            </div>

            {/* 3. 2D Spectrogram Waterfall Sonogram */}
            <Spectrogram isPlaying={isPlaying} />

            {/* 4. Controls & Metrics: Parametric Notch Filter and Hardware A/B Monitor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FilterControls
                filterParams={filterParams}
                setFilterParams={handleFilterParamsChange}
              />
              <ABCompare
                outputMode={outputMode}
                setOutputMode={setOutputMode}
              />
            </div>

          </div>
        )}

        {activeTab === 'math' && <MathLab />}

        {activeTab === 'report' && (
          <ReportViewer
            informeMarkdown={informeContent}
            defensaMarkdown={defensaContent}
          />
        )}
      </main>

      {/* Engineering Status Footer */}
      <footer className="border-t border-[#14171f] bg-[#07080a] py-4 text-xs text-[#64748b]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <p className="font-mono text-[11px] tracking-tight text-[#94a3b8]">
              Cálculo II • Transformada de Fourier Continua en DSP & Cancelación Quirúrgica
            </p>
          </div>
          <p className="font-mono text-[11px] text-[#64748b]">
            44.1 kHz / 32-bit float • Web Audio API Core
          </p>
        </div>
      </footer>
    </div>
  );
};
