import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../dsp/audioEngine';
import { Maximize2 } from 'lucide-react';

interface OscilloscopeProps {
  isPlaying: boolean;
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode] = useState<'both' | 'raw' | 'clean'>('both');
  const [zoom, setZoom] = useState<number>(1);

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

      // Draw precision oscilloscope reticle grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#12161f';
      const xSteps = 8;
      const ySteps = 6;

      for (let i = 1; i < xSteps; i++) {
        const x = (width / xSteps) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let i = 1; i < ySteps; i++) {
        const y = (height / ySteps) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center zero-voltage reference axis
      ctx.strokeStyle = '#1e2535';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const rawData = audioEngine.getRawTimeDomain();
      const cleanData = audioEngine.getCleanTimeDomain();
      const bufferLength = Math.floor(rawData.length / zoom);

      // Helper to draw crisp surgical phosphor trace
      const drawTrace = (
        data: Uint8Array<ArrayBuffer>,
        strokeColor: string,
        fillColor?: string
      ) => {
        ctx.lineWidth = 1.75;
        ctx.strokeStyle = strokeColor;
        ctx.shadowBlur = 0; // Eliminating AI neon bloom for crisp laboratory vector precision

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = data[i] / 128.0; // 128 is center level
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();

        if (fillColor) {
          ctx.lineTo(width, height / 2);
          ctx.lineTo(0, height / 2);
          ctx.closePath();
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
      };

      if (isPlaying) {
        if (viewMode === 'both' || viewMode === 'raw') {
          drawTrace(rawData, '#d97706', 'rgba(217, 119, 6, 0.05)');
        }
        if (viewMode === 'both' || viewMode === 'clean') {
          drawTrace(cleanData, '#06b6d4', 'rgba(6, 182, 212, 0.06)');
        }
      } else {
        // Idle beam (clean line at center)
        ctx.strokeStyle = '#273142';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, viewMode, zoom]);

  return (
    <div className="bg-[#0c0e14] border border-[#1a1e27] rounded-xl p-3.5 shadow-xl flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#f1f5f9] tracking-wider uppercase">
            Osciloscopio
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#12151d] text-[#94a3b8] border border-[#1e2432]">
            f(t) [VOLTAJE]
          </span>
        </div>

        {/* View toggles & zoom */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#090b0f] p-0.5 rounded-lg border border-[#1a1e27] text-xs font-mono">
            <button
              onClick={() => setViewMode('both')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'both'
                  ? 'bg-[#181c25] text-white border border-[#2b3342]'
                  : 'text-[#858e9f] hover:text-[#d1d5db]'
              }`}
            >
              Ambas
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'raw'
                  ? 'bg-[#21160d] text-amber-300 border border-[#4d3215]'
                  : 'text-[#858e9f] hover:text-[#d1d5db]'
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setViewMode('clean')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'clean'
                  ? 'bg-[#0f1d24] text-cyan-300 border border-[#184357]'
                  : 'text-[#858e9f] hover:text-[#d1d5db]'
              }`}
            >
              Filtrada
            </button>
          </div>

          <button
            onClick={() => setZoom(prev => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
            className="flex items-center gap-1 bg-[#090b0f] px-2 py-1 rounded-lg border border-[#1a1e27] text-xs font-mono text-[#94a3b8] hover:text-white"
            title="Escala temporal"
          >
            <Maximize2 className="w-3 h-3 text-cyan-400" />
            <span>{zoom}x</span>
          </button>
        </div>
      </div>

      {/* Recessed CRT Screen Well */}
      <div className="relative w-full h-52 sm:h-56 rounded-lg overflow-hidden border border-[#171a22] bg-[#050608]">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Legend Overlay */}
        <div className="absolute top-2 left-2.5 flex items-center gap-2.5 text-[10px] font-mono bg-[#090b0f]/90 px-2 py-0.5 rounded border border-[#1a1e27]">
          {(viewMode === 'both' || viewMode === 'raw') && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="text-amber-300">Original f(t) [Ruido]</span>
            </div>
          )}
          {(viewMode === 'both' || viewMode === 'clean') && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span className="text-cyan-300">Filtrada s(t) [Limpia]</span>
            </div>
          )}
        </div>

        {/* Time division label */}
        <div className="absolute bottom-2 right-2.5 text-[10px] font-mono text-[#475569]">
          5 ms / div
        </div>
      </div>
    </div>
  );
};
