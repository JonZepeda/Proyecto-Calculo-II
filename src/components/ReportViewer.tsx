import React, { useState, useMemo } from 'react';
import katex from 'katex';
import { Copy, Check, Printer, BookOpen, FileCode } from 'lucide-react';

interface ReportViewerProps {
  informeMarkdown: string;
  defensaMarkdown: string;
}

/**
 * Renderiza Markdown académico junto con bloques matemáticos KaTeX ($$...$$ y $...$)
 * sin dependencias pesadas externas.
 */
function renderAcademicMarkdownToHtml(markdown: string): string {
  // 1. Extraer bloques de código ```...``` para no alterarlos
  const codeBlocks: string[] = [];
  let text = markdown.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    codeBlocks.push(
      `<div class="my-3 rounded-md bg-[#090b10] border border-[#1c2230] p-3 overflow-x-auto font-mono text-xs text-cyan-300"><div class="text-[10px] uppercase text-[#64748b] mb-1">${lang || 'diagram / code'}</div><pre class="leading-relaxed">${escaped}</pre></div>`
    );
    return `@@CODE_BLOCK_${idx}@@`;
  });

  // 2. Renderizar ecuaciones en bloque $$...$$ con KaTeX
  const mathBlocks: string[] = [];
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex) => {
    const idx = mathBlocks.length;
    try {
      const html = katex.renderToString(tex.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      mathBlocks.push(
        `<div class="my-3 py-2 px-3 rounded-md bg-[#080a0f] border border-[#181d29] overflow-x-auto text-center">${html}</div>`
      );
    } catch {
      mathBlocks.push(`<pre class="my-2 text-amber-300">${tex}</pre>`);
    }
    return `@@MATH_BLOCK_${idx}@@`;
  });

  // 3. Renderizar ecuaciones inline $...$ con KaTeX
  const inlineMath: string[] = [];
  text = text.replace(/\$([^\n$]+?)\$/g, (_m, tex) => {
    const idx = inlineMath.length;
    try {
      const html = katex.renderToString(tex.trim(), {
        displayMode: false,
        throwOnError: false,
      });
      inlineMath.push(html);
    } catch {
      inlineMath.push(`<code>${tex}</code>`);
    }
    return `@@INLINE_MATH_${idx}@@`;
  });

  // 4. Procesar línea por línea encabezados, listas, citas y párrafos
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const formatInline = (line: string): string => {
    return line
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-slate-300 italic">$1</em>')
      .replace(
        /`([^`]+)`/g,
        '<code class="px-1.5 py-0.5 rounded bg-[#121621] border border-[#22293a] text-cyan-300 font-mono text-xs">$1</code>'
      );
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith('@@CODE_BLOCK_') || trimmed.startsWith('@@MATH_BLOCK_')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(trimmed);
      continue;
    }

    if (trimmed === '---') {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push('<hr class="my-5 border-[#1a202c]" />');
      continue;
    }

    if (trimmed.startsWith('# ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(
        `<h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight mt-4 mb-2 border-b border-[#1e2536] pb-2">${formatInline(trimmed.slice(2))}</h1>`
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(
        `<h2 class="text-base sm:text-lg font-bold text-cyan-400 tracking-tight mt-6 mb-2">${formatInline(trimmed.slice(3))}</h2>`
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(
        `<h3 class="text-sm sm:text-base font-bold text-amber-300 mt-4 mb-1.5">${formatInline(trimmed.slice(4))}</h3>`
      );
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(
        `<h4 class="text-xs sm:text-sm font-bold text-emerald-300 uppercase tracking-wider mt-3 mb-1">${formatInline(trimmed.slice(5))}</h4>`
      );
      continue;
    }

    if (trimmed.startsWith('> ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(
        `<blockquote class="my-3 pl-3.5 border-l-2 border-cyan-500 bg-[#0b111a] py-2 pr-3 rounded-r text-slate-200 text-xs sm:text-sm">${formatInline(trimmed.slice(2))}</blockquote>`
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      if (!inList) {
        out.push('<ul class="my-2 space-y-1.5 pl-5 list-disc text-slate-300 text-xs sm:text-sm">');
        inList = true;
      }
      const itemContent = trimmed.replace(/^([-*]|\d+\.)\s+/, '');
      out.push(`<li class="leading-relaxed">${formatInline(itemContent)}</li>`);
      continue;
    }

    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    out.push(`<p class="my-2 text-slate-300 leading-relaxed text-xs sm:text-sm">${formatInline(trimmed)}</p>`);
  }

  if (inList) {
    out.push('</ul>');
  }

  let finalHtml = out.join('\n');
  finalHtml = finalHtml.replace(/@@INLINE_MATH_(\d+)@@/g, (_m, idx) => inlineMath[Number(idx)] || '');
  finalHtml = finalHtml.replace(/@@MATH_BLOCK_(\d+)@@/g, (_m, idx) => mathBlocks[Number(idx)] || '');
  finalHtml = finalHtml.replace(/@@CODE_BLOCK_(\d+)@@/g, (_m, idx) => codeBlocks[Number(idx)] || '');
  return finalHtml;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  informeMarkdown,
  defensaMarkdown,
}) => {
  const [subTab, setSubTab] = useState<'informe' | 'defensa'>('informe');
  const [copied, setCopied] = useState(false);

  const activeContent = subTab === 'informe' ? informeMarkdown : defensaMarkdown;

  const renderedHtml = useMemo(() => {
    return renderAcademicMarkdownToHtml(activeContent);
  }, [activeContent]);

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
              Documentación Académica & Defensa de Exoneración (Renderizado KaTeX)
            </h2>
          </div>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            Informe formal con demostraciones simbólicas (SymPy/SciPy), cuadratura numérica y guía de defensa oral
          </p>
        </div>

        {/* Tab switch and Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Documento"
            className="flex items-center dsp-meter-card p-0.5 rounded-md text-xs font-mono"
          >
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
              Informe Formal (KaTeX)
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

          <span className="hidden md:flex items-center gap-1 text-xs font-mono px-2 py-1 rounded bg-[#0d1f17] border border-[#1b4332] text-emerald-300">
            <FileCode className="w-3.5 h-3.5" />
            <span>python_engine/demostracion_calculo_ii.ipynb</span>
          </span>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 dsp-meter-card hover:bg-[#141822] px-2.5 py-1 rounded-md text-xs font-mono text-[#94a3b8] hover:text-white transition-colors"
            title="Copiar texto en Markdown al portapapeles"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? 'Copiado' : 'Copiar MD'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 dsp-meter-card hover:bg-[#141822] px-2.5 py-1 rounded-md text-xs font-mono text-[#94a3b8] hover:text-white transition-colors"
            title="Imprimir o exportar PDF con ecuaciones renderizadas"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Rendered Academic Paper Viewport */}
      <div
        className="dsp-well p-5 sm:p-8 rounded-md text-[#d1d5db] font-sans leading-relaxed max-w-none overflow-x-auto selection:bg-cyan-500/20"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
};
