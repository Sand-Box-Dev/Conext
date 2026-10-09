import React, { useState } from 'react';
import { FileText, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import { TrashConfirmDialog } from '../components/TrashConfirmDialog';
import type { DocumentItem } from '../types';

interface TrashProps {
  documents: DocumentItem[];
  action: { documentId: number; action: 'trash' | 'restore' | 'delete' } | null;
  error: string | null;
  onRestore: (documentId: number) => Promise<boolean>;
  onDeleteForever: (documentId: number) => Promise<boolean>;
}

export const Trash: React.FC<TrashProps> = ({ documents, action, error, onRestore, onDeleteForever }) => {
  const [pendingDelete, setPendingDelete] = useState<DocumentItem | null>(null);

  return <section className="library-page flex-1 overflow-y-auto bg-[#0b0f17]">
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-9 sm:py-11">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Library</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div><h2 className="text-2xl font-semibold tracking-tight text-white">Trash</h2><p className="mt-1 text-sm text-slate-400">Restore reviewers or permanently remove them.</p></div>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-400">{documents.length} {documents.length === 1 ? 'reviewer' : 'reviewers'}</span>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

      {documents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400"><Trash2 className="h-5 w-5" /></span>
        <h3 className="mt-4 font-medium text-slate-200">Trash is empty</h3>
        <p className="mt-1 text-sm text-slate-500">Reviewers you remove from your library will appear here.</p>
      </div> : <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        {documents.map((document) => {
          const activeAction = action?.documentId === document.id ? action.action : null;
          const busy = action !== null;
          return <li key={document.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400"><FileText className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200" title={document.filename}>{document.filename}</p>
              <p className="mt-1 text-xs text-slate-500">{document.chunk_count} source passages</p>
              {activeAction && <p role="status" className="mt-1 text-xs text-slate-400">{activeAction === 'restore' ? 'Restoring reviewer…' : 'Deleting reviewer…'}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" className="btn btn-sm border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700" disabled={busy} onClick={() => void onRestore(document.id)}>
                {activeAction === 'restore' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {activeAction === 'restore' ? 'Restoring…' : 'Restore'}
              </button>
              <button type="button" className="btn btn-sm border-error/30 bg-error/10 text-error hover:bg-error/20" disabled={busy} onClick={() => setPendingDelete(document)}>
                {activeAction === 'delete' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </li>;
        })}
      </ul>}
    </div>
    {pendingDelete && <TrashConfirmDialog
      filename={pendingDelete.filename}
      action="delete"
      isLoading={action?.documentId === pendingDelete.id && action.action === 'delete'}
      error={error}
      onCancel={() => setPendingDelete(null)}
      onConfirm={async () => { if (await onDeleteForever(pendingDelete.id)) setPendingDelete(null); }}
    />}
  </section>;
};
