import React from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle } from 'lucide-react';

interface TrashConfirmDialogProps {
  filename: string;
  onCancel: () => void;
  onConfirm: () => void;
  action?: 'trash' | 'delete';
  isLoading?: boolean;
  error?: string | null;
}

export const TrashConfirmDialog: React.FC<TrashConfirmDialogProps> = ({ filename, onCancel, onConfirm, action = 'trash', isLoading = false, error = null }) => {
  const deleting = action === 'delete';
  const actionLabel = deleting ? 'Delete permanently' : 'Move to Trash';
  const dialog = (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !isLoading) onCancel(); }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="trash-reviewer-title" className="apple-dialog w-full max-w-sm rounded-[1.4rem] border p-3 shadow-2xl sm:p-4">
      <h2 id="trash-reviewer-title" className="text-2xl font-semibold tracking-tight text-slate-900">{deleting ? 'Delete permanently?' : 'Move to Trash?'}</h2>
      <p className="mt-2 break-words text-sm leading-relaxed text-slate-600">
        {deleting
          ? `“${filename}” and its saved reviewer data will be permanently deleted. This can’t be undone.`
          : `“${filename}” will move to Trash. You can restore it later.`}
      </p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}
      <div className="apple-dialog-actions mt-4 grid grid-cols-2 gap-2 pt-2">
        <button className="apple-dialog-cancel" type="button" onClick={onCancel} disabled={isLoading}>Cancel</button>
        <button className="apple-dialog-confirm trash-dialog-confirm inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60" type="button" onClick={onConfirm} disabled={isLoading}>
          {isLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {isLoading ? (deleting ? 'Deleting…' : 'Moving…') : actionLabel}
        </button>
      </div>
    </section>
  </div>
  );
  const appRoot = document.querySelector('.conext-app') ?? document.body;
  return createPortal(dialog, appRoot);
};
