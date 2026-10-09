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
  deleteMessage?: string;
  deleteLabel?: string;
}

export const TrashConfirmDialog: React.FC<TrashConfirmDialogProps> = ({ filename, onCancel, onConfirm, action = 'trash', isLoading = false, error = null, deleteMessage, deleteLabel }) => {
  const deleting = action === 'delete';
  const actionLabel = deleting ? (deleteLabel ?? 'Delete permanently') : 'Move to Trash';
  const dialog = (
  <div className="modal modal-open z-[90] bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !isLoading) onCancel(); }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="trash-reviewer-title" className="modal-box minimal-trash-dialog w-full max-w-[22rem] rounded-2xl border p-5 shadow-xl">
      <h2 id="trash-reviewer-title" className="text-lg font-semibold tracking-tight">{deleting ? 'Delete permanently?' : 'Move to Trash?'}</h2>
      <p className="mt-2 break-words text-sm leading-relaxed">
        <span className="font-medium">{filename}</span>{' '}
        {deleting
          ? (deleteMessage ?? 'and its saved reviewer data will be deleted permanently. This can’t be undone.')
          : 'will move to Trash. You can restore it later.'}
      </p>
      {error && <p role="alert" className="mt-3 rounded-lg border px-3 py-2 text-xs">{error}</p>}
      <div className="mt-5 flex justify-end gap-2 border-t pt-3">
        <button className="minimal-trash-cancel" type="button" onClick={onCancel} disabled={isLoading}>Cancel</button>
        <button className="minimal-trash-confirm inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60" type="button" onClick={onConfirm} disabled={isLoading}>
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
