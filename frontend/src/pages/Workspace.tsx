import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Sparkles,
  Layers,
  AlertCircle,
  FileSearch,
  MessageCircle,
  PanelRight,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ConceptMap } from '../components/ConceptMap';
import { ConceptDetails } from '../components/ConceptDetails';
import { ReviewerChat } from '../components/ReviewerChat';
import { CommandPalette } from '../components/CommandPalette';
import { Dashboard } from './Dashboard';
import { Projects } from './Projects';
import { Settings } from './Settings';
import { Trash as TrashPage } from './Trash';
import { OriginalFilePreview } from '../components/OriginalFilePreview';
import { api } from '../services/api';
import { removeReviewerCover } from '../services/coverStorage';
import type {
  DocumentItem,
  ConceptMapData,
  ConceptDetail,
  ProjectFolder,
  UserProfile,
} from '../types';

interface WorkspaceProps {
  user?: UserProfile | null;
  onLogout?: () => void;
  onUserUpdated?: (user: UserProfile) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ user, onLogout, onUserUpdated }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('conext.theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [isWarmFilterOn, setIsWarmFilterOn] = useState(() => localStorage.getItem('conext.warm-filter') === 'true');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [recentDocumentIds, setRecentDocumentIds] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('conext.recent-reviewers') || '[]');
      return Array.isArray(saved) ? saved.filter((id): id is number => Number.isInteger(id)) : [];
    } catch {
      return [];
    }
  });
  const legacyTrashIdsRef = useRef<number[] | null>(null);
  if (legacyTrashIdsRef.current === null) {
    try {
      const saved = JSON.parse(localStorage.getItem('conext.trashed-reviewers') || '[]');
      legacyTrashIdsRef.current = Array.isArray(saved) ? saved.filter((id): id is number => Number.isInteger(id)) : [];
    } catch { legacyTrashIdsRef.current = []; }
  }
  const [trashedDocuments, setTrashedDocuments] = useState<DocumentItem[]>([]);
  const [trashAction, setTrashAction] = useState<{ documentId: number; action: 'trash' | 'restore' | 'delete' } | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectFolder[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isOriginalPreviewOpen, setIsOriginalPreviewOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<'commands' | 'reviewers'>('commands');
  const [modifierLabel] = useState(() => /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? '⌘' : 'Ctrl');
  const [activeView, setActiveView] = useState<'dashboard' | 'library' | 'workspace' | 'trash' | 'settings'>('dashboard');

  // Concept Map state
  const [conceptMap, setConceptMap] = useState<ConceptMapData | null>(null);
  const [generatingMapDocId, setGeneratingMapDocId] = useState<number | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Concept Detail state
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(true);
  const [conceptDetail, setConceptDetail] = useState<ConceptDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [conceptDetailError, setConceptDetailError] = useState<string | null>(null);
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState<boolean>(false);
  const [explanationGenerationError, setExplanationGenerationError] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<number | null>(null);
  selectedNodeIdRef.current = selectedNodeId;
  const selectedDocIdRef = useRef<number | null>(null);
  selectedDocIdRef.current = selectedDocId;

  useEffect(() => {
    localStorage.setItem('conext.recent-reviewers', JSON.stringify(recentDocumentIds));
  }, [recentDocumentIds]);

  useEffect(() => {
    localStorage.setItem('conext.theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('conext.warm-filter', String(isWarmFilterOn));
  }, [isWarmFilterOn]);

  // Load initial documents
  const loadInitialData = useCallback(async () => {
    try {
      const [initialDocs, initialFolders] = await Promise.all([
        api.getDocuments().catch(() => []),
        api.getProjects().catch(() => []),
      ]);
      const legacyIds = legacyTrashIdsRef.current ?? [];
      const docsToMigrate = initialDocs.filter((document) => legacyIds.includes(document.id));
      const migrationResults = await Promise.allSettled(
        docsToMigrate.map((document) => api.moveDocumentToTrash(document.id)),
      );
      const failedLegacyIds = docsToMigrate
        .filter((_, index) => migrationResults[index].status === 'rejected')
        .map((document) => document.id);
      legacyTrashIdsRef.current = failedLegacyIds;
      if (failedLegacyIds.length) {
        localStorage.setItem('conext.trashed-reviewers', JSON.stringify(failedLegacyIds));
      } else {
        localStorage.removeItem('conext.trashed-reviewers');
      }

      const documentsRequest = docsToMigrate.length ? api.getDocuments().catch(() => []) : Promise.resolve(initialDocs);
      const foldersRequest = docsToMigrate.length ? api.getProjects().catch(() => initialFolders) : Promise.resolve(initialFolders);
      const [docs, trashed, folders] = await Promise.all([
        documentsRequest,
        api.getTrashedDocuments().catch(() => []),
        foldersRequest,
      ]);
      setDocuments(docs);
      setTrashedDocuments(trashed);
      setProjects(folders);

      // Auto-select first document if available and none selected
      if (docs.length > 0 && selectedDocIdRef.current === null) {
        setSelectedDocId(docs[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const selectedDocProcessingStatus = documents.find((document) => document.id === selectedDocId)?.processing_status;

  // When selectedDocId changes, load existing map if available
  useEffect(() => {
    if (!selectedDocId) {
      setConceptMap(null);
      setSelectedNodeId(null);
      setConceptDetail(null);
      return;
    }

    setMapError(null);
    setSelectedNodeId(null);
    setConceptDetail(null);

    if (selectedDocProcessingStatus === 'processing') {
      setConceptMap(null);
      return;
    }

    // Try fetching existing map
    api
      .getConceptMap(selectedDocId)
      .then((map) => {
        setConceptMap(map);
      })
      .catch(() => {
        // No map yet for this doc, normal state
        setConceptMap(null);
      });
  }, [selectedDocId, selectedDocProcessingStatus]);

  const improveExplanation = useCallback(async (nodeId: number, isCurrent: () => boolean = () => true) => {
    setIsGeneratingExplanation(true);
    setExplanationGenerationError(null);
    try {
      const result = await api.improveConceptExplanation(nodeId);
      if (isCurrent() && selectedNodeIdRef.current === nodeId) {
        setConceptDetail((current) => current?.id === nodeId
          ? { ...current, explanation: result.explanation, has_generated_explanation: true }
          : current);
      }
    } catch (err) {
      if (isCurrent() && selectedNodeIdRef.current === nodeId) {
        setExplanationGenerationError(err instanceof Error ? err.message : 'Could not improve this explanation.');
      }
    } finally {
      if (isCurrent() && selectedNodeIdRef.current === nodeId) setIsGeneratingExplanation(false);
    }
  }, []);

  // Fetch node detail when a node is clicked
  useEffect(() => {
    if (!selectedNodeId) {
      setConceptDetail(null);
      setConceptDetailError(null);
      setIsGeneratingExplanation(false);
      setExplanationGenerationError(null);
      return;
    }

    let active = true;
    setIsLoadingDetail(true);
    setConceptDetailError(null);
    setExplanationGenerationError(null);
    api
      .getConceptDetails(selectedNodeId)
      .then((detail) => {
        if (!active) return;
        setConceptDetail(detail);
        if (detail.has_generated_explanation) {
          setIsGeneratingExplanation(false);
        } else {
          void improveExplanation(selectedNodeId, () => active);
        }
      })
      .catch((err) => {
        console.error('Failed to load details', err);
        if (active) setConceptDetailError(err instanceof Error ? err.message : 'Could not load this concept.');
      })
      .finally(() => {
        if (active) setIsLoadingDetail(false);
      });

    return () => { active = false; };
  }, [selectedNodeId, improveExplanation]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const newDoc = await api.uploadDocument(file);
      setDocuments((prev) => [newDoc, ...prev]);
      setConceptMap(null);
      setSelectedDocId(newDoc.id);
      setRecentDocumentIds((current) => [newDoc.id, ...current.filter((id) => id !== newDoc.id)]);
      setActiveView('workspace');
      setIsChatOpen(true);
      setIsDetailsOpen(true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateProject = async (name: string) => {
    const project = await api.createProject(name);
    setProjects((current) => [project, ...current]);
  };

  const handleRenameProject = async (projectId: number, name: string) => {
    const project = await api.renameProject(projectId, name);
    setProjects((current) => current.map((item) => item.id === projectId ? project : item));
  };

  const handleDeleteProject = async (projectId: number) => {
    await api.deleteProject(projectId);
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setDocuments((current) => current.map((document) => document.project_id === projectId
      ? { ...document, project_id: null }
      : document));
    setTrashedDocuments((current) => current.map((document) => document.project_id === projectId
      ? { ...document, project_id: null }
      : document));
  };

  const handleMoveReviewer = async (documentId: number, projectId: number | null) => {
    const document = documents.find((item) => item.id === documentId);
    if (!document || document.project_id === projectId) return;
    setDocuments((current) => current.map((document) => (
      document.id === documentId ? { ...document, project_id: projectId } : document
    )));
    setProjects((current) => current.map((project) => ({
      ...project,
      document_count: Math.max(0, project.document_count
        - (document.project_id === project.id ? 1 : 0)
        + (projectId === project.id ? 1 : 0)),
    })));
    try {
      await api.assignProject(documentId, projectId);
    } catch (error) {
      setDocuments((current) => current.map((item) => (
        item.id === documentId ? { ...item, project_id: document.project_id ?? null } : item
      )));
      setProjects((current) => current.map((project) => ({
        ...project,
        document_count: Math.max(0, project.document_count
          + (document.project_id === project.id ? 1 : 0)
          - (projectId === project.id ? 1 : 0)),
      })));
      throw error;
    }
  };

  const handleGenerateConceptMap = async (documentId: number | null = selectedDocId) => {
    if (!documentId) return;

    setGeneratingMapDocId(documentId);
    setMapError(null);
    try {
      const generated = await api.generateConceptMap(documentId);
      const isCurrentDocument = selectedDocIdRef.current === documentId;
      if (isCurrentDocument) setConceptMap(generated);
      // Update has_map in local document list
      setDocuments((prev) =>
        prev.map((d) => (d.id === documentId ? { ...d, has_map: true } : d))
      );
      // Auto-select root node if present
      const rootNode = generated.nodes.find((n) => n.node_type === 'root') || generated.nodes[0];
      if (rootNode && isCurrentDocument) {
        setSelectedNodeId(rootNode.id);
        setIsDetailsOpen(true);
      }
    } catch (err: any) {
      if (selectedDocIdRef.current === documentId) {
        setMapError(err.message || 'Could not build the concept map.');
      }
    } finally {
      setGeneratingMapDocId((current) => current === documentId ? null : current);
    }
  };

  const currentDoc = documents.find((d) => d.id === selectedDocId);
  const isGeneratingMap = generatingMapDocId === selectedDocId;
  const processingDocumentIds = documents
    .filter((document) => document.processing_status === 'processing')
    .map((document) => document.id)
    .join(',');

  useEffect(() => {
    const documentIds = processingDocumentIds.split(',').filter(Boolean).map(Number);
    if (!documentIds.length) return;
    let active = true;
    let timeoutId: number | undefined;
    const refreshStatus = async () => {
      const refreshed = await Promise.allSettled(documentIds.map((id) => api.getDocument(id)));
      if (!active) return;
      const updates = refreshed.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      if (updates.length) {
        setDocuments((current) => current.map((document) => updates.find((updated) => updated.id === document.id) ?? document));
      }
      const stillProcessing = refreshed.some((result) => result.status === 'rejected'
        || (result.status === 'fulfilled' && result.value.processing_status === 'processing'));
      if (stillProcessing) timeoutId = window.setTimeout(refreshStatus, 1400);
    };
    timeoutId = window.setTimeout(refreshStatus, 900);
    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [processingDocumentIds]);

  const openReviewer = (documentId: number) => {
    if (trashedDocuments.some((document) => document.id === documentId)) return;
    setRecentDocumentIds((current) => [documentId, ...current.filter((id) => id !== documentId)]);
    setSelectedDocId(documentId);
    setIsOriginalPreviewOpen(false);
    setActiveView('workspace');
    setIsChatOpen(true);
  };

  const runTrashAction = async (
    documentId: number,
    action: 'trash' | 'restore' | 'delete',
  ): Promise<boolean> => {
    if (trashAction) return false;
    setTrashAction({ documentId, action });
    setTrashError(null);
    try {
      if (action === 'trash') {
        const document = documents.find((item) => item.id === documentId);
        if (!document) throw new Error('Reviewer was not found in your library.');
        await api.moveDocumentToTrash(documentId);
        setDocuments((current) => current.filter((item) => item.id !== documentId));
        setTrashedDocuments((current) => [document, ...current.filter((item) => item.id !== documentId)]);
        setRecentDocumentIds((current) => current.filter((id) => id !== documentId));
        if (document.project_id !== null && document.project_id !== undefined) {
          setProjects((current) => current.map((project) => project.id === document.project_id
            ? { ...project, document_count: Math.max(0, project.document_count - 1) }
            : project));
        }
        setActiveView('trash');
        if (selectedDocId === documentId) {
          setSelectedDocId(documents.find((item) => item.id !== documentId)?.id ?? null);
          setActiveView('dashboard');
          setIsChatOpen(false);
        }
      } else if (action === 'restore') {
        const document = trashedDocuments.find((item) => item.id === documentId);
        if (!document) throw new Error('Reviewer was not found in Trash.');
        await api.restoreDocument(documentId);
        setTrashedDocuments((current) => current.filter((item) => item.id !== documentId));
        setDocuments((current) => [document, ...current.filter((item) => item.id !== documentId)]
          .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()));
        if (document.project_id !== null && document.project_id !== undefined) {
          setProjects((current) => current.map((project) => project.id === document.project_id
            ? { ...project, document_count: project.document_count + 1 }
            : project));
        }
      } else {
        await api.deleteDocumentForever(documentId);
        setTrashedDocuments((current) => current.filter((item) => item.id !== documentId));
        setRecentDocumentIds((current) => current.filter((id) => id !== documentId));
        void removeReviewerCover(documentId).catch(() => undefined);
      }

      return true;
    } catch (error) {
      setTrashError(error instanceof Error ? error.message : 'The Trash action could not be completed.');
      return false;
    } finally {
      setTrashAction(null);
    }
  };

  const onTrashReviewer = (documentId: number) => runTrashAction(documentId, 'trash');
  const onRestoreReviewer = (documentId: number) => runTrashAction(documentId, 'restore');
  const onDeleteForever = (documentId: number) => runTrashAction(documentId, 'delete');
  const activeDocuments = documents;

  const askAboutReviewer = (documentId: number) => {
    setRecentDocumentIds((current) => [documentId, ...current.filter((id) => id !== documentId)]);
    setSelectedDocId(documentId);
    setIsOriginalPreviewOpen(false);
    setActiveView('workspace');
    setIsChatOpen(true);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = Boolean(target && (
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      ));
      const hasModifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (event.key === 'Escape' && isCommandPaletteOpen) {
        event.preventDefault();
        setIsCommandPaletteOpen(false);
        return;
      }
      if (hasModifier && key === 'k') {
        event.preventDefault();
        setPaletteMode('commands');
        setIsCommandPaletteOpen(true);
        return;
      }
      if (event.key === '/' && !hasModifier && !event.altKey && !isTyping) {
        event.preventDefault();
        setPaletteMode('reviewers');
        setIsCommandPaletteOpen(true);
        return;
      }
      if (hasModifier && event.shiftKey && key === 'd' && !isTyping) {
        event.preventDefault();
        setIsWarmFilterOn((enabled) => !enabled);
        return;
      }
      if (hasModifier && !event.shiftKey && key === 'd' && !isTyping) {
        event.preventDefault();
        setTheme((current) => current === 'light' ? 'dark' : 'light');
        return;
      }
      if (!hasModifier) return;
      if (key === '1') {
        event.preventDefault();
        setActiveView('dashboard');
        setIsChatOpen(false);
      } else if (key === '2') {
        event.preventDefault();
        setActiveView('library');
        setIsChatOpen(false);
      } else if (key === '3') {
        event.preventDefault();
        setActiveView('trash');
        setIsChatOpen(false);
      } else if (key === 'enter' && selectedDocId !== null) {
        event.preventDefault();
        askAboutReviewer(selectedDocId);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isCommandPaletteOpen, selectedDocId]);

  return (
    <div data-theme={theme} className="conext-app flex h-screen w-screen overflow-hidden bg-[#0b0f17] text-slate-100 font-sans">
      {/* Left Sidebar */}
      <Sidebar
        activeView={activeView}
        onShowDashboard={() => { setActiveView('dashboard'); setIsChatOpen(false); setIsOriginalPreviewOpen(false); }}
        onShowLibrary={() => { setActiveView('library'); setIsChatOpen(false); setIsOriginalPreviewOpen(false); }}
        onShowTrash={() => { setActiveView('trash'); setIsChatOpen(false); setIsOriginalPreviewOpen(false); }}
        onShowSettings={() => { setActiveView('settings'); setIsChatOpen(false); setIsOriginalPreviewOpen(false); }}
        trashedDocuments={trashedDocuments}
        trashShortcutLabel={`${modifierLabel}+3`}
        user={user}
        onLogout={onLogout}
      />

      {/* Center Main Workspace */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Workspace Top Toolbar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            {activeView === 'dashboard' ? (
              <div>
                <h1 className="text-sm font-semibold text-white">Recent</h1>
              </div>
            ) : activeView === 'library' ? (
              <div>
                <h1 className="text-sm font-bold text-white">Library</h1>
                <p className="text-[11px] text-slate-400">Reviewers organized in project folders</p>
              </div>
            ) : activeView === 'trash' ? (
              <div><h1 className="text-sm font-bold text-white">Trash</h1><p className="text-[11px] text-slate-400">Restore or remove reviewers</p></div>
            ) : activeView === 'settings' ? (
              <div><h1 className="text-sm font-bold text-white">Settings</h1><p className="text-[11px] text-slate-400">Account and keyboard shortcuts</p></div>
            ) : currentDoc ? (
              <div>
                <h1 className="text-sm font-bold text-white truncate max-w-md">
                  {currentDoc.filename}
                </h1>
                <p className="text-[11px] text-slate-400">
                  {currentDoc.chunk_count} passages extracted • Grounded Offline Knowledge
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-sm font-semibold text-slate-300">
                  Select or upload a document
                </h1>
                <p className="text-[11px] text-slate-400">
                  Offline interactive learning canvas
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          {currentDoc && activeView === 'workspace' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsChatOpen((open) => !open)}
                className={`btn btn-sm gap-2 border-slate-700 ${isChatOpen ? 'bg-slate-800 text-white' : 'bg-slate-900 text-slate-300'}`}
                aria-label={isChatOpen ? 'Switch to mind map' : 'Switch to chat'}
              >
                {isChatOpen ? <Layers className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                <span className="hidden sm:inline">{isChatOpen ? 'Mind map' : 'Chat'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOriginalPreviewOpen(true)}
                className="btn btn-sm gap-2 border-slate-700 bg-slate-900 text-slate-300"
                title="Preview original file"
                aria-label="Preview original file"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Original file</span>
              </button>
              {!isChatOpen && conceptMap && (
                <button
                  onClick={() => setIsDetailsOpen((open) => !open)}
                  className="btn btn-sm gap-2 border-slate-700 bg-slate-900 text-slate-300"
                  aria-pressed={isDetailsOpen}
                  title={isDetailsOpen ? 'Hide concept details' : 'Show concept details'}
                >
                  <PanelRight className="h-4 w-4" />
                  <span className="hidden lg:inline">{isDetailsOpen ? 'Hide details' : 'Show details'}</span>
                </button>
              )}
              {!isChatOpen && <button
                onClick={() => void handleGenerateConceptMap()}
                disabled={isGeneratingMap}
                className={`mindmap-action btn btn-sm gap-2 rounded-xl px-4 font-medium shadow-sm transition-colors ${isGeneratingMap ? 'cursor-wait opacity-60' : ''}`}
              >
                {isGeneratingMap ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Building map…</span>
                  </>
                ) : (
                  <>
                    {conceptMap ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    <span>
                      {conceptMap ? 'Regenerate map' : 'Generate mind map'}
                    </span>
                  </>
                )}
              </button>}
            </div>
          )}
        </header>

        {/* Workspace Canvas / States */}
        <div className="flex-1 relative overflow-hidden flex">
          {mapError && (
            <div className="absolute top-4 left-6 right-6 z-30 p-4 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-start gap-3 backdrop-blur-md shadow-lg">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Concept Generation Error</span>
                <span>{mapError}</span>
              </div>
              <button
                onClick={() => setMapError(null)}
                className="text-xs text-rose-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeView === 'workspace' && !isChatOpen && isGeneratingMap && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-base-100/75 p-5 backdrop-blur-sm" role="status" aria-live="polite">
              <div className="mindmap-refresh-spinner" aria-hidden="true" />
              <p className="text-sm font-medium text-base-content/75">{conceptMap ? 'Refreshing your mind map…' : 'Creating your mind map…'}</p>
            </div>
          )}

          {activeView === 'dashboard' ? (
            <Dashboard
              documents={activeDocuments}
              onTrashReviewer={onTrashReviewer}
              trashActionDocumentId={trashAction?.action === 'trash' ? trashAction.documentId : null}
              trashError={trashError}
              onOpenReviewer={openReviewer}
              onUploadSuccess={handleUpload}
              isUploading={isUploading}
            />
          ) : activeView === 'library' ? (
            <Projects
              documents={activeDocuments}
              projects={projects}
              onOpenReviewer={openReviewer}
              onCreateFolder={handleCreateProject}
              onRenameFolder={handleRenameProject}
              onDeleteFolder={handleDeleteProject}
              onMoveReviewer={handleMoveReviewer}
              onTrashReviewer={onTrashReviewer}
              trashActionDocumentId={trashAction?.action === 'trash' ? trashAction.documentId : null}
              trashError={trashError}
            />
          ) : activeView === 'trash' ? (
            <TrashPage
              documents={trashedDocuments}
              action={trashAction}
              error={trashError}
              onRestore={onRestoreReviewer}
              onDeleteForever={onDeleteForever}
            />
          ) : activeView === 'settings' ? (
            <Settings user={user} modifierLabel={modifierLabel} onUserUpdated={onUserUpdated} />
          ) : isChatOpen && currentDoc ? (
            <ReviewerChat
              key={currentDoc.id}
              documentId={currentDoc.id}
              filename={currentDoc.filename}
              isProcessing={currentDoc.processing_status === 'processing'}
              hasProcessingError={currentDoc.processing_status === 'error'}
            />
          ) : !currentDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <FileSearch className="w-16 h-16 stroke-[1.2] text-slate-700 mb-4" />
              <h2 className="text-base font-semibold text-slate-300 mb-2">
                No Document Selected
              </h2>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                Upload educational lecture notes, textbook chapters, or articles in PDF/TXT format on the left sidebar to generate an interactive offline concept map.
              </p>
            </div>
          ) : !conceptMap && !isGeneratingMap ? (
            <div className="relative flex-1">
              <ConceptMap
                nodesData={[]}
                edgesData={[]}
                selectedNodeId={null}
                onSelectNode={() => undefined}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/90 px-6 py-5 text-center shadow-xl">
                  <Layers className="mx-auto mb-3 h-7 w-7 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-200">Your mind map will appear here</h2>
                  <p className="mt-1 text-xs text-slate-400">Generate a map from the toolbar when you’re ready.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 h-full relative">
              <ConceptMap
                nodesData={conceptMap?.nodes || []}
                edgesData={conceptMap?.edges || []}
                selectedNodeId={selectedNodeId}
                onSelectNode={(nodeId) => {
                  setSelectedNodeId(nodeId);
                  setIsDetailsOpen(true);
                }}
              />
            </div>
          )}

          {/* Right Detail Panel */}
          {activeView === 'workspace' && !isChatOpen && conceptMap && isDetailsOpen && (
            <ConceptDetails
              detail={conceptDetail}
              isLoading={isLoadingDetail}
              loadError={conceptDetailError}
              isGeneratingExplanation={isGeneratingExplanation}
              explanationGenerationError={explanationGenerationError}
              onImproveExplanation={() => conceptDetail && void improveExplanation(conceptDetail.id)}
              onClose={() => {
                setIsDetailsOpen(false);
                setSelectedNodeId(null);
                setConceptDetail(null);
              }}
            />
          )}
        </div>
      </main>
      {isOriginalPreviewOpen && currentDoc && activeView === 'workspace' && <OriginalFilePreview
        documentId={currentDoc.id}
        filename={currentDoc.filename}
        onClose={() => setIsOriginalPreviewOpen(false)}
      />}
      {isWarmFilterOn && <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80] bg-amber-200/20 mix-blend-multiply" />}
      <CommandPalette
        open={isCommandPaletteOpen}
        mode={paletteMode}
        documents={activeDocuments}
        selectedDocumentId={selectedDocId}
        selectedFilename={documents.find((document) => document.id === selectedDocId)?.filename}
        modifierLabel={modifierLabel}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenReviewer={openReviewer}
        onGoRecent={() => { setActiveView('dashboard'); setIsChatOpen(false); }}
        onGoLibrary={() => { setActiveView('library'); setIsChatOpen(false); }}
        onOpenTrash={() => { setActiveView('trash'); setIsChatOpen(false); }}
        onAskSelected={() => selectedDocId !== null && askAboutReviewer(selectedDocId)}
      />
    </div>
  );
};
