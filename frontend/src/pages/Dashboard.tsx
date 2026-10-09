import React from 'react';
import {
  ArrowUpRight,
  BookOpenText,
  CircleHelp,
  FileText,
  Layers3,
  MessageCircle,
  Network,
  PanelRight,
  Sparkles,
} from 'lucide-react';
import type { DocumentItem, HealthStatus } from '../types';

interface DashboardProps {
  documents: DocumentItem[];
  health: HealthStatus | null;
  onOpenReviewer: (documentId: number) => void;
  onAskReviewer: (documentId: number) => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}

const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(date));

export const Dashboard: React.FC<DashboardProps> = ({
  documents,
  health,
  onOpenReviewer,
  onAskReviewer,
  isRightPanelOpen,
  onToggleRightPanel,
}) => {
  const latest = documents[0];
  const mappedCount = documents.filter((document) => document.has_map).length;
  const passageCount = documents.reduce((total, document) => total + document.chunk_count, 0);

  return (
    <section className="flex-1 overflow-y-auto bg-[#0b0f17]">
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Conext workspace</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">Your learning dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Your reviewers, concept maps, and source-grounded study tools in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`badge gap-2 border px-3 py-3 ${health?.ollama_connected ? 'badge-success badge-soft' : 'badge-warning badge-soft'}`}>
              <span className={`h-2 w-2 rounded-full ${health?.ollama_connected ? 'bg-success' : 'bg-warning'}`} />
              {health?.ollama_connected ? 'Ollama connected' : 'Ollama unavailable'}
            </span>
            <button className="btn btn-sm gap-2 border-slate-700 bg-slate-900 text-slate-300" onClick={onToggleRightPanel} aria-pressed={isRightPanelOpen}>
              <PanelRight className="h-4 w-4" />
              {isRightPanelOpen ? 'Hide panel' : 'Show panel'}
            </button>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="stats w-full border border-slate-800 bg-slate-900/70 shadow-sm">
            <div className="stat">
              <div className="stat-figure text-primary"><BookOpenText className="h-5 w-5" /></div>
              <div className="stat-title text-slate-400">Reviewers</div>
              <div className="stat-value text-3xl text-slate-100">{documents.length}</div>
              <div className="stat-desc text-slate-500">PDF and text documents</div>
            </div>
          </div>
          <div className="stats w-full border border-slate-800 bg-slate-900/70 shadow-sm">
            <div className="stat">
              <div className="stat-figure text-indigo-300"><Network className="h-5 w-5" /></div>
              <div className="stat-title text-slate-400">Concept maps</div>
              <div className="stat-value text-3xl text-slate-100">{mappedCount}</div>
              <div className="stat-desc text-slate-500">Built from your sources</div>
            </div>
          </div>
          <div className="stats w-full border border-slate-800 bg-slate-900/70 shadow-sm">
            <div className="stat">
              <div className="stat-figure text-emerald-300"><Layers3 className="h-5 w-5" /></div>
              <div className="stat-title text-slate-400">Passages indexed</div>
              <div className="stat-value text-3xl text-slate-100">{passageCount}</div>
              <div className="stat-desc text-slate-500">Ready to search and cite</div>
            </div>
          </div>
        </div>

        {latest ? (
          <div className="card overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 shadow-xl">
            <div className="card-body gap-5 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-primary badge-soft">Continue studying</span>
                {latest.has_map && <span className="badge badge-success badge-soft">Map ready</span>}
              </div>
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div className="min-w-0">
                  <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Most recent reviewer</p>
                  <h2 className="max-w-2xl truncate text-xl font-semibold text-white sm:text-2xl">{latest.filename}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {latest.chunk_count} passages · Added {formatDate(latest.uploaded_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button className="btn btn-primary gap-2" onClick={() => onOpenReviewer(latest.id)}>
                    <Network className="h-4 w-4" /> Open workspace <ArrowUpRight className="h-4 w-4" />
                  </button>
                  <button className="btn btn-outline border-slate-700 text-slate-200 hover:bg-slate-800" onClick={() => onAskReviewer(latest.id)}>
                    <MessageCircle className="h-4 w-4" /> Ask reviewer
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card border border-dashed border-slate-700 bg-slate-900/60">
            <div className="card-body items-center py-12 text-center">
              <div className="mb-1 rounded-2xl border border-slate-700 bg-slate-800 p-3 text-primary"><FileText className="h-6 w-6" /></div>
              <h2 className="card-title text-slate-100">Start with a reviewer</h2>
              <p className="max-w-md text-sm leading-relaxed text-slate-400">Upload a PDF, TXT, or Markdown reviewer from the left sidebar. Conext will index its passages so you can explore and ask grounded questions.</p>
            </div>
          </div>
        )}

        <div className={`grid gap-6 ${isRightPanelOpen ? 'lg:grid-cols-[minmax(0,1.55fr)_minmax(16rem,0.85fr)]' : 'lg:grid-cols-1'}`}>
          {isRightPanelOpen && <section className="card border border-slate-800 bg-slate-900/60">
            <div className="card-body p-0">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <div>
                  <h2 className="card-title text-base text-slate-100">Recent reviewers</h2>
                  <p className="mt-1 text-xs text-slate-500">Open a document to continue studying</p>
                </div>
                <span className="badge badge-ghost text-slate-400">{documents.length} total</span>
              </div>
              {documents.length ? (
                <div className="divide-y divide-slate-800/80">
                  {documents.slice(0, 5).map((document) => (
                    <button key={document.id} onClick={() => onOpenReviewer(document.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-800/50">
                      <div className="rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300"><FileText className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">{document.filename}</p>
                        <p className="mt-1 text-xs text-slate-500">{document.chunk_count} passages · {formatDate(document.uploaded_at)}</p>
                      </div>
                      <span className={`badge badge-sm ${document.has_map ? 'badge-success badge-soft' : 'badge-ghost text-slate-500'}`}>
                        {document.has_map ? 'Map ready' : 'No map yet'}
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-8 text-sm text-slate-500">Your uploaded reviewers will appear here.</p>
              )}
            </div>
          </section>}

          <section className="card border border-slate-800 bg-slate-900/60">
            <div className="card-body gap-5 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary"><Sparkles className="h-4 w-4" /></div>
                <div>
                  <h2 className="card-title text-base text-slate-100">Study with Conext</h2>
                  <p className="text-xs text-slate-500">A simple reviewer workflow</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <span className="badge badge-primary badge-sm mt-0.5">1</span>
                  <p className="text-sm leading-relaxed text-slate-300">Upload course notes or a study reviewer.</p>
                </div>
                <div className="flex gap-3">
                  <span className="badge badge-primary badge-sm mt-0.5">2</span>
                  <p className="text-sm leading-relaxed text-slate-300">Build a concept map and inspect cited explanations.</p>
                </div>
                <div className="flex gap-3">
                  <span className="badge badge-primary badge-sm mt-0.5">3</span>
                  <p className="text-sm leading-relaxed text-slate-300">Ask follow-up questions grounded in the source.</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs leading-relaxed text-slate-400">
                <CircleHelp className="mr-1.5 inline h-3.5 w-3.5 text-primary" /> Your chats and concept explanations are saved with their reviewer.
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
};
