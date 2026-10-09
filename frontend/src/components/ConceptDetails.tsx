import React from 'react';
import { X, Sparkles, FileText, CheckCircle2, Quote } from 'lucide-react';
import type { ConceptDetail } from '../types';

interface ConceptDetailsProps {
  detail: ConceptDetail | null;
  isLoading: boolean;
  onClose: () => void;
}

export const ConceptDetails: React.FC<ConceptDetailsProps> = ({
  detail,
  isLoading,
  onClose,
}) => {
  if (isLoading) {
    return (
      <aside className="w-96 border-l border-slate-800 bg-slate-900/95 backdrop-blur-xl p-6 flex flex-col justify-center items-center text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-slate-300">Retrieving concept evidence...</p>
        <p className="text-xs text-slate-400 mt-1">Verifying source citations</p>
      </aside>
    );
  }

  if (!detail) {
    return (
      <aside className="w-96 border-l border-slate-800/80 bg-slate-900/50 backdrop-blur-md p-6 flex flex-col justify-center items-center text-center text-slate-500">
        <Quote className="w-12 h-12 stroke-[1.2] text-slate-700 mb-3" />
        <h3 className="text-sm font-medium text-slate-400 mb-1">No concept selected</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
          Click any concept node on the canvas to inspect its concise explanation and verified verbatim source passages.
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-96 border-l border-slate-800 bg-slate-900/95 backdrop-blur-xl flex flex-col h-full overflow-hidden shadow-2xl z-20">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-900/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {detail.node_type}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Grounded</span>
            </div>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight leading-snug">
            {detail.label}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Generated Explanation */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Explanation</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-slate-200 text-sm leading-relaxed">
            {detail.explanation}
          </div>
        </div>

        {/* Source Evidence Section */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Document Evidence ({detail.sources.length})</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            Verbatim excerpts retrieved directly from your local document storage:
          </p>

          <div className="space-y-3">
            {detail.sources.length === 0 ? (
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-lg text-xs text-slate-400 italic">
                No direct passage citations found.
              </div>
            ) : (
              detail.sources.map((src, index) => (
                <div
                  key={src.id}
                  className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 transition rounded-xl p-3.5 shadow-sm"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 pb-2 border-b border-slate-800/80">
                    <span className="font-mono text-blue-400 font-medium">
                      Citation #{index + 1}
                    </span>
                    <span className="bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded font-mono text-[10px]">
                      Page {src.page_number}
                    </span>
                  </div>

                  {src.document_filename && (
                    <div className="text-[10px] text-slate-400 font-mono mb-2 truncate">
                      File: {src.document_filename}
                    </div>
                  )}

                  <blockquote className="text-xs text-slate-300 italic border-l-2 border-emerald-500/80 pl-3 leading-relaxed whitespace-pre-line">
                    &ldquo;{src.content}&rdquo;
                  </blockquote>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
