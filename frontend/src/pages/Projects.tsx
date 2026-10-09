import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpenText,
  Check,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Layers3,
  LoaderCircle,
} from 'lucide-react';
import type { DocumentItem, ProjectFolder } from '../types';

interface ProjectsProps {
  documents: DocumentItem[];
  projects: ProjectFolder[];
  onOpenReviewer: (documentId: number) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onMoveReviewer: (documentId: number, projectId: number | null) => Promise<void>;
}

const formatDate = (date: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(date));

export const Projects: React.FC<ProjectsProps> = ({
  documents,
  projects,
  onOpenReviewer,
  onCreateFolder,
  onMoveReviewer,
}) => {
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [movingDocumentId, setMovingDocumentId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleDocuments = useMemo(() => activeFolderId === null
    ? documents
    : documents.filter((document) => document.project_id === activeFolderId),
  [activeFolderId, documents]);

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

  const handleFolderDrop = (event: React.DragEvent, projectId: number) => {
    event.preventDefault();
    const documentId = Number(event.dataTransfer.getData('text/reviewer-id'));
    setDropTargetId(null);
    if (Number.isInteger(documentId) && documentId > 0) {
      void moveDocument(documentId, String(projectId));
    }
  };

  return (
    <section className="flex-1 overflow-y-auto bg-[#0b0f17]">
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your study materials</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">Library</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Browse every reviewer here, then group them into project folders by class or subject.</p>
          </div>
          <button className="btn btn-primary gap-2" onClick={() => { setIsCreating(true); setError(null); }}>
            <FolderPlus className="h-4 w-4" /> New folder
          </button>
        </header>

        {isCreating && (
          <form onSubmit={submitFolder} className="flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:flex-row">
            <input
              className="input min-w-0 flex-1 border-slate-700 bg-slate-950 text-slate-100"
              autoFocus
              maxLength={80}
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Folder name, e.g. Biology 101"
              aria-label="Project folder name"
            />
            <button className="btn btn-primary" type="submit" disabled={!folderName.trim() || isSavingFolder}>
              {isSavingFolder ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create folder
            </button>
            <button className="btn btn-ghost text-slate-300" type="button" onClick={() => { setIsCreating(false); setFolderName(''); }}>
              Cancel
            </button>
          </form>
        )}

        {error && <div role="alert" className="alert alert-error py-3 text-sm">{error}</div>}

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Project folders</h2>
              <p className="mt-1 text-xs text-slate-500">Choose a folder to filter, or drag a reviewer card onto a folder to move it</p>
            </div>
            <span className="text-xs text-slate-500">{projects.length} {projects.length === 1 ? 'folder' : 'folders'}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              onClick={() => setActiveFolderId(null)}
              className={`card border text-left transition hover:-translate-y-0.5 ${activeFolderId === null ? 'border-primary/50 bg-primary/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'}`}
            >
              <div className="card-body flex-row items-center gap-4 p-4">
                <div className="rounded-xl bg-slate-800 p-3 text-primary"><FolderOpen className="h-5 w-5" /></div>
                <div className="min-w-0"><h3 className="font-semibold text-slate-100">All reviewers</h3><p className="mt-1 text-xs text-slate-400">{documents.length} items</p></div>
              </div>
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveFolderId(project.id)}
                onDragOver={(event) => { event.preventDefault(); setDropTargetId(project.id); }}
                onDragLeave={() => setDropTargetId(null)}
                onDrop={(event) => handleFolderDrop(event, project.id)}
                className={`card border text-left transition hover:-translate-y-0.5 ${dropTargetId === project.id ? 'border-primary bg-primary/15 ring-2 ring-primary/40' : activeFolderId === project.id ? 'border-primary/50 bg-primary/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'}`}
              >
                <div className="card-body flex-row items-center gap-4 p-4">
                  <div className="rounded-xl bg-slate-800 p-3 text-amber-300"><Folder className="h-5 w-5" /></div>
                  <div className="min-w-0"><h3 className="truncate font-semibold text-slate-100">{project.name}</h3><p className="mt-1 text-xs text-slate-400">{project.document_count} {project.document_count === 1 ? 'reviewer' : 'reviewers'}</p></div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {activeFolderId === null ? 'Reviewers' : projects.find((project) => project.id === activeFolderId)?.name ?? 'Project reviewers'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{visibleDocuments.length} {visibleDocuments.length === 1 ? 'reviewer' : 'reviewers'} · Click a card to open its workspace</p>
            </div>
          </div>

          {visibleDocuments.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleDocuments.map((document) => (
                <article key={document.id} className="card border border-slate-800 bg-slate-900/70 transition hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-xl">
                  <button
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/reviewer-id', String(document.id));
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => onOpenReviewer(document.id)}
                    className="card-body flex-1 cursor-grab items-start p-5 text-left active:cursor-grabbing"
                    title="Click to open, or drag onto a folder to organize"
                  >
                    <div className="flex w-full items-start justify-between gap-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-primary"><BookOpenText className="h-5 w-5" /></div>
                      {document.has_map ? <span className="badge badge-success badge-soft badge-sm">Map ready</span> : <span className="badge badge-ghost badge-sm text-slate-400">No map yet</span>}
                    </div>
                    <h3 className="mt-2 line-clamp-2 w-full break-words text-base font-semibold text-slate-100">{document.filename}</h3>
                    <p className="text-xs text-slate-500">Added {formatDate(document.uploaded_at)}</p>
                    <div className="mt-2 flex w-full items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5"><Layers3 className="h-3.5 w-3.5" />{document.chunk_count} passages</span>
                      <span className="flex items-center gap-1 text-primary">Open <ArrowUpRight className="h-3.5 w-3.5" /></span>
                    </div>
                  </button>
                  <div className="px-5 pb-4">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500" htmlFor={`folder-${document.id}`}>Folder</label>
                    <select
                      id={`folder-${document.id}`}
                      className="select select-sm w-full border-slate-700 bg-slate-950 text-slate-300"
                      value={document.project_id ?? ''}
                      disabled={movingDocumentId === document.id}
                      onChange={(event) => void moveDocument(document.id, event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="">Unassigned</option>
                      {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </select>
                    {movingDocumentId === document.id && <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><LoaderCircle className="h-3 w-3 animate-spin" />Moving reviewer</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="card border border-dashed border-slate-700 bg-slate-900/50">
              <div className="card-body items-center py-12 text-center">
                <FilePlus2 className="h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-400">No reviewers in this folder yet.</p>
                <p className="text-xs text-slate-500">Choose a folder on a reviewer card to move it here.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
};
