import React, { useState } from 'react';
import { Copy, Check, Printer, BookOpen } from 'lucide-react';

interface ReportViewerProps {
  informeMarkdown: string;
  defensaMarkdown: string;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  informeMarkdown,
  defensaMarkdown,
}) => {
  const [subTab, setSubTab] = useState<'informe' | 'defensa'>('informe');
  const [copied, setCopied] = useState(false);

  const activeContent = subTab === 'informe' ? informeMarkdown : defensaMarkdown;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="dsp-chassis rounded-lg p-5 space-y-4">
      
      {/* Top Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#171a22] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Documentación Académica del Proyecto
            </h2>
          </div>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            Marco formal para entrega universitaria y banco de preguntas de defensa oral en Cálculo II
          </p>
        </div>

        {/* Tab switch and Action buttons */}
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Documento" className="flex items-center dsp-meter-card p-0.5 rounded-md text-xs font-mono">
            <button
              onClick={() => setSubTab('informe')}
              role="tab"
              aria-selected={subTab === 'informe'}
              className={`px-3 py-1 rounded transition-colors ${
                subTab === 'informe'
                  ? 'bg-[#181c25] text-white border border-[#262c3a] font-semibold'
                  : 'text-[#94a3b8] hover:text-[#d1d5db]'
              }`}
            >
              Informe Formal
            </button>
            <button
              onClick={() => setSubTab('defensa')}
              role="tab"
              aria-selected={subTab === 'defensa'}
              className={`px-3 py-1 rounded transition-colors ${
                subTab === 'defensa'
                  ? 'bg-[#181c25] text-white border border-[#262c3a] font-semibold'
                  : 'text-[#94a3b8] hover:text-[#d1d5db]'
              }`}
            >
              Guía de Defensa Oral
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 dsp-meter-card hover:bg-[#141822] px-2.5 py-1 rounded-md text-xs font-mono text-[#94a3b8] hover:text-white transition-colors"
            title="Copiar texto en Markdown al portapapeles"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 dsp-meter-card hover:bg-[#141822] px-2.5 py-1 rounded-md text-xs font-mono text-[#94a3b8] hover:text-white transition-colors"
            title="Imprimir o exportar PDF"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Report Document Well */}
      <div className="dsp-well p-5 sm:p-7 rounded-md text-[#d1d5db] font-sans leading-relaxed text-sm max-w-none overflow-x-auto selection:bg-cyan-500/20">
        <pre className="whitespace-pre-wrap font-sans text-sm text-[#cbd5e1] leading-relaxed">
          {activeContent}
        </pre>
      </div>

    </div>
  );
};
