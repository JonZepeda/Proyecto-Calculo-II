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
    <div className="bg-[#0c0e14] border border-[#1a1e27] rounded-xl p-5 shadow-xl space-y-4">
      
      {/* Top Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#171a22] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Documentación Académica del Proyecto
            </h2>
          </div>
          <p className="text-xs text-[#858e9f] mt-0.5">
            Marco formal para entrega universitaria y banco de preguntas de defensa oral en Cálculo II
          </p>
        </div>

        {/* Tab switch and Action buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#090b0f] p-0.5 rounded-lg border border-[#1a1e27] text-xs font-mono">
            <button
              onClick={() => setSubTab('informe')}
              className={`px-3 py-1 rounded transition-colors ${
                subTab === 'informe'
                  ? 'bg-[#181c25] text-white border border-[#262c3a] shadow-sm font-semibold'
                  : 'text-[#858e9f] hover:text-[#d1d5db]'
              }`}
            >
              Informe Formal
            </button>
            <button
              onClick={() => setSubTab('defensa')}
              className={`px-3 py-1 rounded transition-colors ${
                subTab === 'defensa'
                  ? 'bg-[#181c25] text-white border border-[#262c3a] shadow-sm font-semibold'
                  : 'text-[#858e9f] hover:text-[#d1d5db]'
              }`}
            >
              Guía de Defensa Oral
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-[#090b0f] hover:bg-[#141822] border border-[#1a1e27] px-2.5 py-1 rounded-lg text-xs font-mono text-[#858e9f] hover:text-white transition-colors"
            title="Copiar texto en Markdown al portapapeles"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-[#090b0f] hover:bg-[#141822] border border-[#1a1e27] px-2.5 py-1 rounded-lg text-xs font-mono text-[#858e9f] hover:text-white transition-colors"
            title="Imprimir o exportar PDF"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Report Document Well */}
      <div className="bg-[#050608] p-5 sm:p-7 rounded-lg border border-[#171a22] text-[#d1d5db] font-sans leading-relaxed text-xs sm:text-sm max-w-none overflow-x-auto selection:bg-cyan-500/20">
        <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-[#cbd5e1] leading-relaxed">
          {activeContent}
        </pre>
      </div>

    </div>
  );
};
