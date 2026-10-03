import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../dsp/audioEngine';

interface SpectrogramProps {
  isPlaying: boolean;
}

export const Spectrogram: React.FC<SpectrogramProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sourceMode, setSourceMode] = useState<'clean' | 'raw'>('clean');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animId: number;

    // Thermal acoustic palette (Obsidian -> Slate -> Cyan -> Amber -> White)
    const getColor = (v: number) => {
      if (v < 8) return [5, 6, 8]; // Deep chassis black
      if (v < 45) return [14, 27, 41]; // Deep navy
      if (v < 90) return [20, 68, 92]; // Teal slate
      if (v < 150) return [29, 145, 168]; // Acoustic cyan
      if (v < 215) return [226, 155, 20]; // Amber resonance
      return [255, 255, 255]; // Pure core saturation
    };

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Scroll canvas content 1 pixel to the left
      const imageData = ctx.getImageData(1, 0, width - 1, height);
      ctx.putImageData(imageData, 0, 0);

      // Fetch fresh frequency column
      const freqData =
        sourceMode === 'clean'
          ? audioEngine.getCleanFrequency()
          : audioEngine.getRawFrequency();

      // Only display up to ~10 kHz (first 1/2 of frequency bins)
      const visibleBins = Math.floor(freqData.length / 2);
      const colData = ctx.createImageData(1, height);

      for (let y = 0; y < height; y++) {
        // High frequencies at top, low frequencies at bottom
        const binIndex = Math.floor(((height - 1 - y) / height) * visibleBins);
        const val = isPlaying ? (freqData[binIndex] || 0) : 0;
        const [r, g, b] = getColor(val);

        const pixelIndex = y * 4;
        colData.data[pixelIndex] = r;
        colData.data[pixelIndex + 1] = g;
        colData.data[pixelIndex + 2] = b;
        colData.data[pixelIndex + 3] = 255;
      }

      // Draw the new column on the rightmost edge
      ctx.putImageData(colData, width - 1, 0);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [sourceMode, isPlaying]);

  return (
    <div className="bg-[#0c0e14] border border-[#1a1e27] rounded-xl p-3.5 shadow-xl flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#f1f5f9] tracking-wider uppercase">
            Espectrograma en Cascada
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#12151d] text-[#94a3b8] border border-[#1e2432]">
            SONOGRAMA [TIEMPO vs FRECUENCIA]
          </span>
        </div>

        {/* Source switch */}
        <div className="flex items-center bg-[#090b0f] p-0.5 rounded-lg border border-[#1a1e27] text-xs font-mono">
          <button
            onClick={() => setSourceMode('clean')}
            className={`px-2 py-0.5 rounded transition-colors ${
              sourceMode === 'clean'
                ? 'bg-[#0f1d24] text-cyan-300 border border-[#184357]'
                : 'text-[#858e9f] hover:text-[#d1d5db]'
            }`}
          >
            Filtrada
          </button>
          <button
            onClick={() => setSourceMode('raw')}
            className={`px-2 py-0.5 rounded transition-colors ${
              sourceMode === 'raw'
                ? 'bg-[#21160d] text-amber-300 border border-[#4d3215]'
                : 'text-[#858e9f] hover:text-[#d1d5db]'
            }`}
          >
            Original
          </button>
        </div>
      </div>

      {/* Recessed Sonogram Viewport */}
      <div className="relative w-full h-36 sm:h-40 rounded-lg overflow-hidden border border-[#171a22] bg-[#050608]">
        <canvas
          ref={canvasRef}
          width={640}
          height={160}
          className="w-full h-full block"
        />

        {/* Frequency Y-Axis Labels */}
        <div className="absolute right-2 top-1 bottom-1 flex flex-col justify-between items-end text-[9px] font-mono text-[#64748b] pointer-events-none">
          <span>~10 kHz</span>
          <span>5 kHz</span>
          <span>2.5 kHz</span>
          <span>1 kHz</span>
          <span>100 Hz</span>
        </div>

        {/* Time Scroll Indicator */}
        <div className="absolute bottom-1.5 left-2 text-[9px] font-mono text-[#475569]">
          ← Tiempo transcurrido (Scroll continuo)
        </div>
      </div>
    </div>
  );
};
