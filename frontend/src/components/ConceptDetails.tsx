import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { X, Sparkles, FileText, CheckCircle2, Quote, WandSparkles, LoaderCircle } from 'lucide-react';
import type { ConceptDetail } from '../types';

const mathPattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

const ExplanationMath: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(mathPattern).map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return (
          <div
            key={index}
            className="my-3 overflow-x-auto text-center"
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.slice(2, -2), { displayMode: true, throwOnError: false }),
            }}
          />
        );
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        return (
          <span
            key={index}
            className="whitespace-nowrap"
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.slice(1, -1), { throwOnError: false }),
            }}
          />
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    })}
  </>
);

interface ConceptDetailsProps {
  detail: ConceptDetail | null;
  isLoading: boolean;
  loadError: string | null;
  isGeneratingExplanation: boolean;
  explanationGenerationError: string | null;
  onImproveExplanation: () => void;
  onClose: () => void;
  emptyHint?: string;
}

export const ConceptDetails: React.FC<ConceptDetailsProps> = ({
  detail,
  isLoading,
  loadError,
  isGeneratingExplanation,
  explanationGenerationError,
  onImproveExplanation,
  onClose,
  emptyHint = 'Click any concept node on the canvas to inspect its concise explanation and verified verbatim source passages.',
}) => {
  if (isLoading) {
    return (
      <aside className="w-96 border-l border-slate-800 bg-slate-900/95 backdrop-blur-xl p-6 flex flex-col justify-center items-center text-center">
        <div className="w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-slate-300">Retrieving concept evidence...</p>
        <p className="text-xs text-slate-400 mt-1">Verifying source citations</p>
      </aside>
    );
  }

  if (loadError) {
    return (
      <aside className="w-96 border-l border-slate-800 bg-slate-900/95 p-6 flex flex-col justify-center items-center text-center">
        <Quote className="w-10 h-10 text-rose-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Could not load this explanation</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{loadError}</p>
      </aside>
    );
  }

  if (!detail) {
    return (
      <aside className="relative flex w-96 flex-col items-center justify-center border-l border-slate-800/80 bg-slate-900/50 p-6 text-center text-slate-500 backdrop-blur-md">
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-square absolute right-3 top-3 text-slate-400"
          title="Collapse details panel"
          aria-label="Collapse details panel"
        >
          <X className="h-4 w-4" />
        </button>
        <Quote className="mb-3 h-12 w-12 stroke-[1.2] text-slate-700" />
        <h3 className="mb-1 text-sm font-medium text-slate-400">No concept selected</h3>
        <p className="max-w-xs text-xs leading-relaxed text-slate-400">
          {emptyHint}
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
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">
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
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              <span>Explanation</span>
            </div>
            <button
              className="btn btn-ghost btn-xs gap-1.5 text-primary"
              onClick={onImproveExplanation}
              disabled={isGeneratingExplanation}
              title="Generate a clearer explanation using this concept's cited passages"
            >
              {isGeneratingExplanation ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <WandSparkles className="w-3.5 h-3.5" />}
              {isGeneratingExplanation ? 'Writing…' : detail.has_generated_explanation ? 'Improve' : 'Explain'}
            </button>
          </div>
          {isGeneratingExplanation && (
            <p className="mb-2 text-[11px] leading-relaxed text-slate-400">Writing a clearer explanation from the linked reviewer passages…</p>
          )}
          {!detail.has_generated_explanation && !isGeneratingExplanation && (
            <p className="mb-2 text-[11px] leading-relaxed text-slate-400">
              Showing the linked source text while a grounded explanation is prepared.
            </p>
          )}
          {explanationGenerationError && (
            <div role="alert" className="alert alert-warning mb-2 py-2 text-xs">{explanationGenerationError}</div>
          )}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-slate-200 text-sm leading-relaxed">
            <ExplanationMath text={detail.explanation} />
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
                    <span className="font-mono text-slate-500 font-medium">
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
