import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ImagePlus, Trash2 } from 'lucide-react';
import type { DocumentItem } from '../types';
import { createA4Cover, getReviewerCover, saveReviewerCover } from '../services/coverStorage';
import { DocumentUpload } from '../components/DocumentUpload';
import { defaultCoverFor } from '../assets/notebookCovers';
import { TrashConfirmDialog } from '../components/TrashConfirmDialog';

interface DashboardProps {
  documents: DocumentItem[];
  onOpenReviewer: (documentId: number) => void;
  onUploadSuccess: (file: File) => Promise<void>;
  isUploading: boolean;
  onTrashReviewer: (documentId: number) => Promise<boolean>;
  trashActionDocumentId: number | null;
  trashError: string | null;
}

const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(date));

const recentHeadlines = [
  'Freshly added',
  'Latest notes',
  'Recent discoveries',
  'Your latest reads',
  'Back to learning',
];

export const Dashboard: React.FC<DashboardProps> = ({ documents, onOpenReviewer, onUploadSuccess, isUploading, onTrashReviewer, trashActionDocumentId, trashError }) => {
  const [recentHeadline] = useState(() => recentHeadlines[Math.floor(Math.random() * recentHeadlines.length)]);
  const reviewers = useMemo(() => [...documents].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
  ), [documents]);
  const filteredReviewers = reviewers;
  const reviewerIds = documents.map(({ id }) => id).join(',');
  const [customCovers, setCustomCovers] = useState<Record<number, string>>({});
  const [coverError, setCoverError] = useState<string | null>(null);
  const [pendingTrash, setPendingTrash] = useState<DocumentItem | null>(null);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    const loadCovers = async () => {
      const loaded = await Promise.all(documents.map(async ({ id }) => {
        try {
          const blob = await getReviewerCover(id);
          if (!blob) return null;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return [id, url] as const;
        } catch {
          return null;
        }
      }));
      if (active) setCustomCovers(Object.fromEntries(loaded.filter((cover): cover is readonly [number, string] => cover !== null)));
    };
    void loadCovers();
    return () => {
      active = false;
      objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [reviewerIds]);

  const handleCoverChange = async (documentId: number, file: File | undefined) => {
    if (!file) return;
    setCoverError(null);
    if (!file.type.startsWith('image/')) {
      setCoverError('Choose an image file for the cover.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setCoverError('Cover images must be 12 MB or smaller.');
      return;
    }
    try {
      const cover = await createA4Cover(file);
      await saveReviewerCover(documentId, cover);
      const url = URL.createObjectURL(cover);
      setCustomCovers((current) => {
        const previous = current[documentId];
        if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
        return { ...current, [documentId]: url };
      });
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : 'Could not save this cover.');
    }
  };

  return (
  <section className="reviewer-dashboard flex-1 overflow-y-auto bg-[#0b0f17]">
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-9 sm:py-11">
      <div className="recent-upload mb-7">
        <DocumentUpload onUploadSuccess={onUploadSuccess} isUploading={isUploading} randomizePrompt />
      </div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">{recentHeadline}</h1>
      <div className="mb-8 flex flex-wrap items-center justify-end gap-3 sm:mb-10">
          <span className="text-xs text-slate-500">{documents.length} reviewers</span>
      </div>

      {coverError && <p role="alert" className="mb-4 text-sm text-rose-600">{coverError}</p>}

      {filteredReviewers.length ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-9 sm:gap-y-14 xl:grid-cols-4">
          {filteredReviewers.map((document) => (
            <article
              key={document.id}
              className="reviewer-tile group min-w-0"
            >
              <div className="reviewer-cover-frame relative mx-auto aspect-[210/297] w-[84%] overflow-hidden rounded-xl bg-slate-900/10">
                <button
                  type="button"
                  onClick={() => onOpenReviewer(document.id)}
                  aria-label={`Open ${document.filename}`}
                  className="absolute inset-0 h-full w-full cursor-pointer overflow-hidden rounded-xl focus-visible:z-10"
                >
                  <img
                    src={customCovers[document.id] ?? defaultCoverFor(document.id)}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                  />
                  <ArrowUpRight className="reviewer-open-indicator absolute right-2.5 top-2.5 h-4 w-4 rounded-full bg-black/30 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.8} />
                </button>
                <button type="button" onClick={() => setPendingTrash(document)} aria-label={`Move ${document.filename} to Trash`} title="Move to Trash" className="reviewer-trash-action absolute left-2.5 top-2.5 z-20 rounded-lg p-2 opacity-100 shadow-sm backdrop-blur-md transition sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <input
                  id={`cover-input-${document.id}`}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label={`Choose a cover for ${document.filename}`}
                  onChange={(event) => {
                    void handleCoverChange(document.id, event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
                <label
                  htmlFor={`cover-input-${document.id}`}
                  className="reviewer-cover-edit absolute bottom-2.5 right-2.5 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium opacity-100 shadow-sm backdrop-blur-md transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100"
                  title="Choose an A4 cover image"
                >
                  <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span>Edit cover</span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => onOpenReviewer(document.id)}
                className="mt-3 block w-full truncate text-left text-sm font-medium text-slate-200 hover:text-primary focus-visible:rounded-sm"
                title={document.filename}
              >
                {document.filename}
              </button>
              <p className="mt-1 text-xs text-slate-500">Added {formatDate(document.uploaded_at)}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
          <h2 className="text-sm font-medium text-slate-200">{documents.length ? 'No notes found' : 'No reviewers yet'}</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
            {documents.length ? 'Try a different search.' : 'Add a reviewer from the sidebar, or explore the Library to organize your study materials.'}
          </p>
        </div>
      )}
    </div>
    {pendingTrash && <TrashConfirmDialog
      filename={pendingTrash.filename}
      isLoading={trashActionDocumentId === pendingTrash.id}
      error={trashError}
      onCancel={() => setPendingTrash(null)}
      onConfirm={async () => {
        const moved = await onTrashReviewer(pendingTrash.id);
        if (moved) setPendingTrash(null);
      }}
    />}
  </section>
  );
};
