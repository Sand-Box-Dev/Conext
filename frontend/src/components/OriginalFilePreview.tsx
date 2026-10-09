import React, { useEffect, useState } from 'react';
import { AlertCircle, Download, FileText, LoaderCircle, X } from 'lucide-react';
import { api } from '../services/api';

interface OriginalFilePreviewProps {
  documentId: number;
  filename: string;
  onClose: () => void;
}

export const OriginalFilePreview: React.FC<OriginalFilePreviewProps> = ({ documentId, filename, onClose }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isPdf = filename.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    let active = true;
    let previewUrl: string | null = null;
    setIsLoading(true);
    setError(null);
    setObjectUrl(null);
    setTextContent(null);

    api.getOriginalDocumentFile(documentId)
      .then(async (file) => {
        previewUrl = URL.createObjectURL(file);
        const text = isPdf ? null : await file.text();
        if (!active) return;
        setObjectUrl(previewUrl);
        setTextContent(text);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load the original file.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [documentId, isPdf]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <section className="fixed inset-0 z-[85] flex flex-col bg-base-100" role="dialog" aria-modal="true" aria-label={`Original file: ${filename}`}>
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-base-300 px-4 sm:px-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70"><FileText className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-base-content" title={filename}>{filename}</h2><p className="text-xs text-base-content/55">Original file preview</p></div>
      {objectUrl && <a href={objectUrl} download={filename} className="btn btn-ghost btn-sm gap-2" aria-label="Download original file"><Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span></a>}
      <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onClose} aria-label="Close original file preview" title="Close preview"><X className="h-4 w-4" /></button>
    </header>

    <div className="min-h-0 flex-1 bg-base-200">
      {isLoading ? <div className="flex h-full items-center justify-center gap-3 text-sm text-base-content/60"><LoaderCircle className="h-5 w-5 animate-spin" />Loading original file…</div>
        : error ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><AlertCircle className="h-6 w-6 text-base-content/50" /><p className="max-w-lg text-sm text-base-content/70">{error}</p></div>
          : isPdf && objectUrl ? <iframe className="h-full w-full border-0 bg-white" src={objectUrl} title={`PDF preview: ${filename}`} />
            : <div className="h-full overflow-auto px-5 py-8 sm:px-10"><pre className="mx-auto max-w-4xl whitespace-pre-wrap break-words font-mono text-sm leading-7 text-base-content">{textContent}</pre></div>}
    </div>
  </section>;
};
