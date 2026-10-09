import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Folder, FolderOpen, FolderPlus, Info, LoaderCircle, Search, Trash2, X } from 'lucide-react';
import type { DocumentItem, ProjectFolder } from '../types';
import { getReviewerCover } from '../services/coverStorage';
import { defaultCoverFor } from '../assets/notebookCovers';
import { TrashConfirmDialog } from '../components/TrashConfirmDialog';

interface ProjectsProps {
  documents: DocumentItem[];
  projects: ProjectFolder[];
  onOpenReviewer: (documentId: number) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onMoveReviewer: (documentId: number, projectId: number | null) => Promise<void>;
  onTrashReviewer: (documentId: number) => Promise<boolean>;
  trashActionDocumentId: number | null;
  trashError: string | null;
}

const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(date));

interface PendingMove {
  documentId: number;
  filename: string;
  fromFolder: string;
  toFolder: string;
  projectId: number | null;
}

export const Projects: React.FC<ProjectsProps> = ({ documents, projects, onOpenReviewer, onCreateFolder, onMoveReviewer, onTrashReviewer, trashActionDocumentId, trashError }) => {
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [movingDocumentId, setMovingDocumentId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [pendingTrash, setPendingTrash] = useState<DocumentItem | null>(null);
  const [customCovers, setCustomCovers] = useState<Record<number, string>>({});
  const documentIds = documents.map(({ id }) => id).join(',');

  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    void Promise.all(documents.map(async ({ id }) => {
      try {
        const cover = await getReviewerCover(id);
        if (!cover) return null;
        const url = URL.createObjectURL(cover);
        urls.push(url);
        return [id, url] as const;
      } catch {
        return null;
      }
    })).then((entries) => {
      if (active) setCustomCovers(Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => entry !== null)));
    });
    return () => {
      active = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [documentIds]);

  const folderDocuments = activeFolderId === null
    ? documents
    : documents.filter((document) => document.project_id === activeFolderId);
  const visibleDocuments = useMemo(() => folderDocuments.filter((document) => (
    document.filename.toLowerCase().includes(query.trim().toLowerCase())
  )), [folderDocuments, query]);

  const submitFolder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!folderName.trim() || isSavingFolder) return;
    setIsSavingFolder(true);
    setError(null);
    try {
      await onCreateFolder(folderName.trim());
      setFolderName('');
      setIsCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this folder.');
    } finally {
      setIsSavingFolder(false);
    }
  };

  const moveDocument = async (documentId: number, value: string) => {
    const projectId = value ? Number(value) : null;
    setMovingDocumentId(documentId);
    setError(null);
    try {
      await onMoveReviewer(documentId, projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move this reviewer.');
    } finally {
      setMovingDocumentId(null);
    }
  };

  const handleFolderDrop = (event: React.DragEvent, projectId: number | null) => {
    event.preventDefault();
    const documentId = Number(event.dataTransfer.getData('text/reviewer-id'));
    setDropTargetId(null);
    if (!Number.isInteger(documentId) || documentId <= 0) return;
    const document = documents.find((item) => item.id === documentId);
    if (!document) return;

    const fromFolder = projects.find((project) => project.id === document.project_id)?.name ?? 'All files';
    const toFolder = projects.find((project) => project.id === projectId)?.name ?? 'All files';
    if (document.project_id === projectId) {
      setNotice(`${document.filename} is already in ${toFolder}.`);
      return;
    }
    if (document.project_id !== null) {
      setPendingMove({ documentId, filename: document.filename, fromFolder, toFolder, projectId });
      return;
    }
    void moveDocument(documentId, projectId === null ? '' : String(projectId));
  };

  const handleFolderDragLeave = (event: React.DragEvent<HTMLButtonElement>) => {
    const relatedTarget = event.relatedTarget;
    if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) setDropTargetId(null);
  };

  const handleDocumentDragStart = (event: React.DragEvent, documentId: number) => {
    event.dataTransfer.setData('text/reviewer-id', String(documentId));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <section className="library-page flex-1 overflow-y-auto bg-[#0b0f17]">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-9 sm:py-11">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={1.8} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your library"
            aria-label="Search your library"
            className="reviewer-search-box h-12 w-full rounded-xl border border-slate-800 bg-slate-900/50 pl-11 pr-4 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-primary/50"
          />
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-slate-200">Folders</h1>
            <button
              type="button"
              onClick={() => { setIsCreating(true); setError(null); }}
              className="btn btn-sm gap-2 border-slate-700 bg-slate-900 text-slate-300"
            >
              <FolderPlus className="h-4 w-4" /> New folder
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              onDragOver={(event) => { event.preventDefault(); setDropTargetId('all'); }}
              onDragLeave={handleFolderDragLeave}
              onDrop={(event) => handleFolderDrop(event, null)}
              className={`library-folder ${activeFolderId === null ? 'is-active' : ''} ${dropTargetId === 'all' ? 'is-drop-target' : ''}`}
            >
              <FolderOpen className="h-5 w-5 shrink-0" strokeWidth={1.8} />
              <span className="min-w-0 flex-1 truncate">All files</span>
              <span className="text-xs text-slate-500">{documents.length}</span>
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setActiveFolderId(project.id)}
                onDragOver={(event) => { event.preventDefault(); setDropTargetId(project.id); }}
                onDragLeave={handleFolderDragLeave}
                onDrop={(event) => handleFolderDrop(event, project.id)}
                className={`library-folder ${activeFolderId === project.id ? 'is-active' : ''} ${dropTargetId === project.id ? 'is-drop-target' : ''}`}
              >
                <Folder className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                <span className="text-xs text-slate-500">{project.document_count}</span>
              </button>
            ))}
          </div>
          {projects.length === 0 && (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              No project folders yet. Create one to organize your reviewers, or explore All files below.
            </p>
          )}
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-200">
              {activeFolderId === null ? 'All files' : projects.find((project) => project.id === activeFolderId)?.name ?? 'Folder'}
            </h2>
            <span className="text-xs text-slate-500">{visibleDocuments.length}</span>
          </div>

          {visibleDocuments.length ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-9 sm:gap-y-12 xl:grid-cols-4">
              {visibleDocuments.map((document) => (
                <article
                  key={document.id}
                  draggable
                  onDragStart={(event) => handleDocumentDragStart(event, document.id)}
                  className="group min-w-0"
                >
                  <div className="reviewer-cover-frame relative mx-auto aspect-[210/297] w-[84%] overflow-hidden rounded-xl bg-slate-900/10">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => handleDocumentDragStart(event, document.id)}
                      onClick={() => onOpenReviewer(document.id)}
                      aria-label={`Open ${document.filename}`}
                      className="absolute inset-0 h-full w-full overflow-hidden rounded-xl"
                    >
                      <img src={customCovers[document.id] ?? defaultCoverFor(document.id)} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
                      <ArrowUpRight className="reviewer-open-indicator absolute right-2.5 top-2.5 h-4 w-4 rounded-full bg-black/30 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.8} />
                    </button>
                    <button type="button" onClick={() => setPendingTrash(document)} aria-label={`Move ${document.filename} to Trash`} title="Move to Trash" className="reviewer-trash-action absolute left-2.5 top-2.5 z-20 rounded-lg p-2 opacity-100 shadow-sm backdrop-blur-md transition sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                  <button type="button" draggable onDragStart={(event) => handleDocumentDragStart(event, document.id)} onClick={() => onOpenReviewer(document.id)} className="mt-3 block w-full truncate text-left text-sm font-medium text-slate-200 hover:text-primary" title={document.filename}>{document.filename}</button>
                  <p className="mt-1 text-xs text-slate-500">Added {formatDate(document.uploaded_at)}</p>
                  {movingDocumentId === document.id && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Moving</p>}
                </article>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">
              {query
                ? 'No files match your search.'
                : documents.length === 0
                  ? 'Add a reviewer from the sidebar or create a folder to get started.'
                  : activeFolderId !== null
                    ? 'This folder is empty. Choose All files above and drag a reviewer here.'
                    : 'No reviewers yet. Add one from the sidebar to see it here.'}
            </div>
          )}
        </section>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCreating(false); }}>
          <form onSubmit={submitFolder} role="dialog" aria-modal="true" aria-labelledby="create-folder-title" className="create-folder-dialog w-full max-w-md rounded-2xl border border-slate-800 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderPlus className="h-5 w-5" strokeWidth={1.8} /></span>
              <h2 id="create-folder-title" className="text-lg font-semibold text-slate-900">New folder</h2>
            </div>
            <input
              autoFocus
              maxLength={80}
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Folder name"
              aria-label="Folder name"
              className="input w-full border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
            {error && <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-ghost" type="button" onClick={() => { setIsCreating(false); setFolderName(''); }}>Cancel</button>
              <button className="btn btn-primary gap-2" type="submit" disabled={!folderName.trim() || isSavingFolder}>
                {isSavingFolder ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create folder
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <section role="alertdialog" aria-modal="true" aria-labelledby="move-reviewer-title" className="apple-dialog w-full max-w-sm rounded-[1.4rem] border p-3 shadow-2xl sm:p-4">
            <h2 id="move-reviewer-title" className="text-2xl font-semibold tracking-tight text-slate-900">Move file?</h2>
            <p className="mt-2 break-words text-sm leading-relaxed text-slate-600">
              Move “{pendingMove.filename}” from {pendingMove.fromFolder} to {pendingMove.toFolder}?
            </p>
            <div className="apple-dialog-actions mt-4 grid grid-cols-2 gap-2 pt-2">
              <button className="apple-dialog-cancel" type="button" onClick={() => setPendingMove(null)}>Cancel</button>
              <button
                className="apple-dialog-confirm"
                type="button"
                disabled={movingDocumentId === pendingMove.documentId}
                onClick={() => {
                  void moveDocument(pendingMove.documentId, pendingMove.projectId === null ? '' : String(pendingMove.projectId));
                  setPendingMove(null);
                }}
              >
                {movingDocumentId === pendingMove.documentId && <LoaderCircle className="h-4 w-4 animate-spin" />}
                Move reviewer
              </button>
            </div>
          </section>
        </div>
      )}

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

      {notice && (
        <div role="status" className="apple-toast fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl">
          <Info className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice" className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      )}
    </section>
  );
};
