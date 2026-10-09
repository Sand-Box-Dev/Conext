import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Folder, FolderOpen, FolderPlus, ImagePlus, Info, LoaderCircle, MoreHorizontal, Pencil, Search, Trash2, X } from 'lucide-react';
import type { DocumentItem, ProjectFolder } from '../types';
import { createA4Cover, getReviewerCover, saveReviewerCover } from '../services/coverStorage';
import { defaultCoverFor } from '../assets/notebookCovers';
import { TrashConfirmDialog } from '../components/TrashConfirmDialog';

interface ProjectsProps {
  documents: DocumentItem[];
  projects: ProjectFolder[];
  onOpenReviewer: (documentId: number) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (projectId: number, name: string) => Promise<void>;
  onDeleteFolder: (projectId: number) => Promise<void>;
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

export const Projects: React.FC<ProjectsProps> = ({ documents, projects, onOpenReviewer, onCreateFolder, onRenameFolder, onDeleteFolder, onMoveReviewer, onTrashReviewer, trashActionDocumentId, trashError }) => {
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [folderDialogMode, setFolderDialogMode] = useState<'create' | 'rename' | null>(null);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<ProjectFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [movingDocumentId, setMovingDocumentId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | 'all' | null>(null);
  const [draggingDocumentId, setDraggingDocumentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingTrash, setPendingTrash] = useState<DocumentItem | null>(null);
  const [customCovers, setCustomCovers] = useState<Record<number, string>>({});
  const [coverError, setCoverError] = useState<string | null>(null);
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
      if (folderDialogMode === 'rename' && editingFolder) {
        await onRenameFolder(editingFolder.id, folderName.trim());
      } else {
        await onCreateFolder(folderName.trim());
      }
      setFolderName('');
      setEditingFolder(null);
      setFolderDialogMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this folder.');
    } finally {
      setIsSavingFolder(false);
    }
  };

  const confirmDeleteFolder = async () => {
    if (!pendingDeleteFolder || isDeletingFolder) return;
    setIsDeletingFolder(true);
    setError(null);
    try {
      await onDeleteFolder(pendingDeleteFolder.id);
      if (activeFolderId === pendingDeleteFolder.id) setActiveFolderId(null);
      setPendingDeleteFolder(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this folder.');
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const closeFolderMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.closest('details')?.removeAttribute('open');
  };

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
    } catch (cause) {
      setCoverError(cause instanceof Error ? cause.message : 'Could not save this cover.');
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
    const documentId = Number(event.dataTransfer.getData('text/reviewer-id') || event.dataTransfer.getData('text/plain'));
    setDropTargetId(null);
    setDraggingDocumentId(null);
    if (!Number.isInteger(documentId) || documentId <= 0) return;
    const document = documents.find((item) => item.id === documentId);
    if (!document) return;

    const targetFolder = projects.find((project) => project.id === projectId)?.name ?? 'All files';
    if (document.project_id === projectId) {
      setNotice(`${document.filename} is already in ${targetFolder}.`);
      return;
    }
    void moveDocument(documentId, projectId === null ? '' : String(projectId));
  };

  const handleFolderDragLeave = (event: React.DragEvent<HTMLElement>) => {
    const relatedTarget = event.relatedTarget;
    if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) setDropTargetId(null);
  };

  const handleDocumentDragStart = (event: React.DragEvent, documentId: number) => {
    setDraggingDocumentId(documentId);
    event.dataTransfer.setData('text/reviewer-id', String(documentId));
    event.dataTransfer.setData('text/plain', String(documentId));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDocumentDragEnd = () => {
    setDraggingDocumentId(null);
    setDropTargetId(null);
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
              onClick={() => { setFolderName(''); setEditingFolder(null); setFolderDialogMode('create'); setError(null); }}
              className="btn btn-sm gap-2 border-slate-700 bg-slate-900 text-slate-300"
            >
              <FolderPlus className="h-4 w-4" /> New folder
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId('all'); }}
              onDragLeave={handleFolderDragLeave}
              onDrop={(event) => handleFolderDrop(event, null)}
              className={`library-folder w-full ${activeFolderId === null ? 'is-active' : ''} ${dropTargetId === 'all' ? 'is-drop-target' : ''}`}
            >
              <FolderOpen className="h-5 w-5 shrink-0" strokeWidth={1.8} />
              <span className="min-w-0 flex-1 truncate">All files</span>
              <span className="text-xs text-slate-500">{documents.length}</span>
            </button>
            {projects.map((project) => (
              <div
                key={project.id}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId(project.id); }}
                onDragLeave={handleFolderDragLeave}
                onDrop={(event) => handleFolderDrop(event, project.id)}
                className={`library-folder min-w-0 ${activeFolderId === project.id ? 'is-active' : ''} ${dropTargetId === project.id ? 'is-drop-target' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setActiveFolderId(project.id)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-[.7rem] text-left"
                >
                  <Folder className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{project.document_count}</span>
                </button>
                <details className="dropdown dropdown-end z-30 shrink-0">
                  <summary className="btn btn-ghost btn-xs btn-square list-none text-slate-400 hover:text-slate-100" aria-label={`Options for ${project.name}`} title="Folder options">
                    <MoreHorizontal className="h-4 w-4" />
                  </summary>
                  <ul className="menu dropdown-content mt-1 w-36 rounded-box border border-slate-700 bg-slate-950 p-1 text-slate-200 shadow-xl">
                    <li><button type="button" onClick={(event) => { closeFolderMenu(event); setEditingFolder(project); setFolderName(project.name); setFolderDialogMode('rename'); setError(null); }}><Pencil className="h-3.5 w-3.5" />Rename</button></li>
                    <li><button type="button" className="text-error" onClick={(event) => { closeFolderMenu(event); setPendingDeleteFolder(project); setError(null); }}><Trash2 className="h-3.5 w-3.5" />Delete folder</button></li>
                  </ul>
                </details>
              </div>
            ))}
          </div>
          {projects.length === 0 && (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              No project folders yet. Create one to organize your reviewers, or explore All files below.
            </p>
          )}
        </section>

        {coverError && <p role="alert" className="mt-5 text-sm text-rose-600">{coverError}</p>}

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
                  onDragEnd={handleDocumentDragEnd}
                  title="Drag this reviewer to a folder"
                  className={`reviewer-tile group min-w-0 cursor-grab transition-transform duration-150 active:cursor-grabbing ${draggingDocumentId === document.id ? 'reviewer-drag-source' : ''}`}
                >
                  <div className="reviewer-cover-frame relative mx-auto aspect-[210/297] w-[84%] overflow-hidden rounded-xl bg-slate-900/10">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => handleDocumentDragStart(event, document.id)}
                      onDragEnd={handleDocumentDragEnd}
                      onClick={() => onOpenReviewer(document.id)}
                      aria-label={`Open ${document.filename}`}
                      className="absolute inset-0 h-full w-full cursor-pointer overflow-hidden rounded-xl"
                    >
                      <img src={customCovers[document.id] ?? defaultCoverFor(document.id)} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
                      <ArrowUpRight className="reviewer-open-indicator absolute right-2.5 top-2.5 h-4 w-4 rounded-full bg-black/30 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.8} />
                    </button>
                    <button type="button" onClick={() => setPendingTrash(document)} aria-label={`Move ${document.filename} to Trash`} title="Move to Trash" className="reviewer-trash-action absolute left-2.5 top-2.5 z-20 rounded-lg p-2 opacity-100 shadow-sm backdrop-blur-md transition sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                    <input
                      id={`library-cover-input-${document.id}`}
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
                      htmlFor={`library-cover-input-${document.id}`}
                      className="reviewer-cover-edit absolute bottom-2.5 right-2.5 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium opacity-100 shadow-sm backdrop-blur-md transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100"
                      title="Choose an A4 cover image"
                    >
                      <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.8} />
                      <span>Edit cover</span>
                    </label>
                  </div>
                  <button type="button" draggable onDragStart={(event) => handleDocumentDragStart(event, document.id)} onDragEnd={handleDocumentDragEnd} onClick={() => onOpenReviewer(document.id)} className="mt-3 block w-full cursor-grab truncate text-left text-sm font-medium text-slate-200 hover:text-primary active:cursor-grabbing" title={`${document.filename} · Drag to move`}>{document.filename}</button>
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

      {folderDialogMode && (
        <div className="modal modal-open z-[90] bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingFolder) { setFolderDialogMode(null); setEditingFolder(null); } }}>
          <form onSubmit={submitFolder} role="dialog" aria-modal="true" aria-labelledby="create-folder-title" className="modal-box minimal-trash-dialog w-full max-w-[22rem] rounded-2xl border p-5 shadow-xl">
            <h2 id="create-folder-title" className="text-lg font-semibold tracking-tight">{folderDialogMode === 'rename' ? 'Rename folder' : 'New folder'}</h2>
            <input
              autoFocus
              maxLength={80}
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Folder name"
              aria-label="Folder name"
              className="folder-name-field mt-4 w-full rounded-lg px-3 py-2.5 text-sm placeholder:text-slate-400"
            />
            {error && <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2 border-t pt-3">
              <button className="minimal-trash-cancel" type="button" disabled={isSavingFolder} onClick={() => { setFolderDialogMode(null); setEditingFolder(null); setFolderName(''); }}>Cancel</button>
              <button className="minimal-trash-confirm inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={!folderName.trim() || isSavingFolder}>
                {isSavingFolder ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {folderDialogMode === 'rename' ? 'Save changes' : 'Create folder'}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDeleteFolder && (
        <div className="modal modal-open z-[90] bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeletingFolder) setPendingDeleteFolder(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-folder-title" className="modal-box minimal-trash-dialog w-full max-w-[22rem] rounded-2xl border p-5 shadow-xl">
            <h2 id="delete-folder-title" className="text-lg font-semibold tracking-tight">Delete “{pendingDeleteFolder.name}”?</h2>
            <p className="folder-delete-copy mt-2 text-sm leading-relaxed">Reviewers in this folder will move to All files. Their content and conversations will stay in your library.</p>
            {error && <p role="alert" className="mt-3 rounded-lg border px-3 py-2 text-xs">{error}</p>}
            <div className="mt-5 flex justify-end gap-2 border-t pt-3">
              <button type="button" className="minimal-trash-cancel" disabled={isDeletingFolder} onClick={() => setPendingDeleteFolder(null)}>Cancel</button>
              <button type="button" className="folder-delete-confirm inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60" disabled={isDeletingFolder} onClick={() => void confirmDeleteFolder()}>
                {isDeletingFolder && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {isDeletingFolder ? 'Deleting…' : 'Delete folder'}
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
