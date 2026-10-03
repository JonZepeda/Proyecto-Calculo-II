import React, { useState } from 'react';
import { Copy, Check, Printer, BookOpen, ShieldCheck, Download } from 'lucide-react';

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
    <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Top Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-neutral-100">
              Documentación Académica del Proyecto
            </h2>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Documentos formales listos para entrega y preparación de la defensa oral en Cálculo II
          </p>
        </div>

        {/* Tab switch and Action buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              onClick={() => setSubTab('informe')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                subTab === 'informe'
                  ? 'bg-cyan-500 text-neutral-950 font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Informe Formal
            </button>
            <button
              onClick={() => setSubTab('defensa')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                subTab === 'defensa'
                  ? 'bg-cyan-500 text-neutral-950 font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Guía de Defensa Oral
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-300 transition-all"
            title="Copiar texto en Markdown al portapapeles"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-300 transition-all"
            title="Imprimir o guardar como PDF"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Report Content Container */}
      <div className="bg-neutral-950 p-6 sm:p-8 rounded-xl border border-neutral-800/80 text-neutral-200 font-sans leading-relaxed text-sm max-w-none overflow-x-auto selection:bg-cyan-500/20">
        <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-300 leading-relaxed">
          {activeContent}
        </pre>
      </div>

    </div>
  );
};
