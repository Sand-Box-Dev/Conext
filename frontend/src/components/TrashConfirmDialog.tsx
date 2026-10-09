import React from 'react';

interface TrashConfirmDialogProps {
  filename: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const TrashConfirmDialog: React.FC<TrashConfirmDialogProps> = ({ filename, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="trash-reviewer-title" className="apple-dialog w-full max-w-sm rounded-[1.4rem] border p-3 shadow-2xl sm:p-4">
      <h2 id="trash-reviewer-title" className="text-2xl font-semibold tracking-tight text-slate-900">Move to Trash?</h2>
      <p className="mt-2 break-words text-sm leading-relaxed text-slate-600">
        “{filename}” will move to Trash. You can restore it later.
      </p>
      <div className="apple-dialog-actions mt-4 grid grid-cols-2 gap-2 pt-2">
        <button className="apple-dialog-cancel" type="button" onClick={onCancel}>Cancel</button>
        <button className="apple-dialog-confirm trash-dialog-confirm" type="button" onClick={onConfirm}>Move to Trash</button>
      </div>
    </section>
  </div>
);
