import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Sparkles,
  Layers,
  AlertCircle,
  FileSearch,
  MessageCircle,
  PanelRight,
  Sun,
  Moon,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ConceptMap } from '../components/ConceptMap';
import { ConceptDetails } from '../components/ConceptDetails';
import { ReviewerChat } from '../components/ReviewerChat';
import { Dashboard } from './Dashboard';
import { Projects } from './Projects';
import { api } from '../services/api';
import type {
  DocumentItem,
  ConceptMapData,
  ConceptDetail,
  HealthStatus,
  ProjectFolder,
  UserProfile,
} from '../types';

interface WorkspaceProps {
  user?: UserProfile | null;
  onLogout?: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ user, onLogout }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('conext.theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [recentDocumentIds, setRecentDocumentIds] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('conext.recent-reviewers') || '[]');
      return Array.isArray(saved) ? saved.filter((id): id is number => Number.isInteger(id)) : [];
    } catch {
      return [];
    }
  });
  const [projects, setProjects] = useState<ProjectFolder[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatSideView, setChatSideView] = useState<'details' | 'mindmap'>('details');
  const [activeView, setActiveView] = useState<'dashboard' | 'library' | 'workspace'>('dashboard');
  const [isDashboardPanelOpen, setIsDashboardPanelOpen] = useState<boolean>(true);

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

  // Load initial health and documents
  const loadInitialData = useCallback(async () => {
    try {
      const [h, docs, folders] = await Promise.all([
        api.getHealth().catch(() => ({
          status: 'error',
          ollama_connected: false,
          ollama_model: 'gemma4:31b-cloud',
          ollama_model_available: false,
        })),
        api.getDocuments().catch(() => []),
        api.getProjects().catch(() => []),
      ]);
      setHealth(h);
      setDocuments(docs);
      setProjects(folders);

      // Auto-select first document if available and none selected
      if (docs.length > 0 && selectedDocId === null) {
        setSelectedDocId(docs[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedDocId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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
  }, [selectedDocId]);

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
      setSelectedDocId(newDoc.id);
      setRecentDocumentIds((current) => [newDoc.id, ...current.filter((id) => id !== newDoc.id)]);
      setActiveView('workspace');
      setIsChatOpen(false);
      setIsDetailsOpen(true);
      void handleGenerateConceptMap(newDoc.id);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateProject = async (name: string) => {
    const project = await api.createProject(name);
    setProjects((current) => [project, ...current]);
  };

  const handleMoveReviewer = async (documentId: number, projectId: number | null) => {
    await api.assignProject(documentId, projectId);
    setDocuments((current) => current.map((document) => (
      document.id === documentId ? { ...document, project_id: projectId } : document
    )));
    const updatedProjects = await api.getProjects();
    setProjects(updatedProjects);
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
        setMapError(err.message || 'Failed to extract concepts with local Ollama.');
      }
    } finally {
      setGeneratingMapDocId((current) => current === documentId ? null : current);
    }
  };

  const currentDoc = documents.find((d) => d.id === selectedDocId);
  const isGeneratingMap = generatingMapDocId === selectedDocId;

  const openReviewer = (documentId: number) => {
    setRecentDocumentIds((current) => [documentId, ...current.filter((id) => id !== documentId)]);
    setSelectedDocId(documentId);
    setActiveView('workspace');
    setIsChatOpen(false);
  };

  const askAboutReviewer = (documentId: number) => {
    setRecentDocumentIds((current) => [documentId, ...current.filter((id) => id !== documentId)]);
    setSelectedDocId(documentId);
    setActiveView('workspace');
    setIsChatOpen(true);
    setChatSideView('details');
  };

  return (
    <div data-theme={theme} className="conext-app flex h-screen w-screen overflow-hidden bg-[#0b0f17] text-slate-100 font-sans">
      {/* Left Sidebar */}
      <Sidebar
        activeView={activeView}
        onShowDashboard={() => {
          setActiveView('dashboard');
          setIsChatOpen(false);
        }}
        onShowLibrary={() => {
          setActiveView('library');
          setIsChatOpen(false);
        }}
        onUploadSuccess={handleUpload}
        isUploading={isUploading}
        health={health}
        recentDocuments={recentDocumentIds
          .map((id) => documents.find((document) => document.id === id))
          .filter((document): document is DocumentItem => Boolean(document))}
        onOpenRecent={openReviewer}
        onRemoveRecent={(documentId) => setRecentDocumentIds((current) => current.filter((id) => id !== documentId))}
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
                <h1 className="text-sm font-bold text-white">Dashboard</h1>
                <p className="text-[11px] text-slate-400">Your reviewer workspace at a glance</p>
              </div>
            ) : activeView === 'library' ? (
              <div>
                <h1 className="text-sm font-bold text-white">Library</h1>
                <p className="text-[11px] text-slate-400">Reviewers organized in project folders</p>
              </div>
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
                onClick={() => setIsChatOpen((open) => {
                  if (!open) setChatSideView('details');
                  return !open;
                })}
                className={`btn btn-sm gap-2 border-slate-700 ${isChatOpen ? 'bg-slate-800 text-white' : 'bg-slate-900 text-slate-300'}`}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">{isChatOpen ? 'Close chat' : 'Ask reviewer'}</span>
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
              <button
                onClick={() => void handleGenerateConceptMap()}
                disabled={isGeneratingMap}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all duration-200 ${
                  isGeneratingMap
                    ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-95'
                }`}
              >
                {isGeneratingMap ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing with Local Ollama...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-300" />
                    <span>
                      {conceptMap ? 'Regenerate Concept Map' : 'Generate Concept Map'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
            className="btn btn-sm btn-square border-slate-700 bg-slate-900 text-slate-300"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" strokeWidth={1.8} /> : <Sun className="h-4 w-4" strokeWidth={1.8} />}
          </button>
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

          {isGeneratingMap && (
            <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
              <div className="relative mb-5">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8 text-blue-400" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 opacity-20 blur-lg animate-pulse" />
              </div>
              <h2 className="text-base font-bold text-white mb-1.5">
                Reading passages & extracting concepts...
              </h2>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Local model <span className="text-blue-400 font-mono">{health?.ollama_model || 'gemma4:31b-cloud'}</span> is verifying source evidence and building relationships completely offline.
              </p>
            </div>
          )}

          {activeView === 'dashboard' ? (
            <Dashboard
              documents={documents}
              health={health}
              onOpenReviewer={openReviewer}
              onAskReviewer={askAboutReviewer}
              isRightPanelOpen={isDashboardPanelOpen}
              onToggleRightPanel={() => setIsDashboardPanelOpen((open) => !open)}
            />
          ) : activeView === 'library' ? (
            <Projects
              documents={documents}
              projects={projects}
              onOpenReviewer={openReviewer}
              onCreateFolder={handleCreateProject}
              onMoveReviewer={handleMoveReviewer}
            />
          ) : isChatOpen && currentDoc ? (
            <>
              <ReviewerChat
                key={currentDoc.id}
                documentId={currentDoc.id}
                filename={currentDoc.filename}
              />
              <aside className="flex w-96 shrink-0 flex-col border-l border-slate-800 bg-slate-900/70">
                <div className="grid grid-cols-2 gap-1 border-b border-slate-800 p-2" role="tablist" aria-label="Reviewer side panel">
                  <button
                    role="tab"
                    aria-selected={chatSideView === 'details'}
                    onClick={() => setChatSideView('details')}
                    className={`btn btn-sm gap-2 ${chatSideView === 'details' ? 'btn-active bg-slate-800 text-white' : 'btn-ghost text-slate-400'}`}
                  >
                    <PanelRight className="h-4 w-4" /> Details
                  </button>
                  <button
                    role="tab"
                    aria-selected={chatSideView === 'mindmap'}
                    onClick={() => setChatSideView('mindmap')}
                    className={`btn btn-sm gap-2 ${chatSideView === 'mindmap' ? 'btn-active bg-slate-800 text-white' : 'btn-ghost text-slate-400'}`}
                  >
                    <Layers className="h-4 w-4" /> Mind map
                  </button>
                </div>
                {chatSideView === 'details' ? (
                  <ConceptDetails
                    detail={conceptDetail}
                    isLoading={isLoadingDetail}
                    loadError={conceptDetailError}
                    isGeneratingExplanation={isGeneratingExplanation}
                    explanationGenerationError={explanationGenerationError}
                    onImproveExplanation={() => conceptDetail && void improveExplanation(conceptDetail.id)}
                    onClose={() => {
                      setSelectedNodeId(null);
                      setConceptDetail(null);
                    }}
                    emptyHint="Open the Mind map tab and select a concept to see its explanation and source passages."
                  />
                ) : conceptMap ? (
                  <div className="min-h-0 flex-1">
                    <ConceptMap
                      nodesData={conceptMap.nodes}
                      edgesData={conceptMap.edges}
                      selectedNodeId={selectedNodeId}
                      onSelectNode={(nodeId) => {
                        setSelectedNodeId(nodeId);
                        setIsDetailsOpen(true);
                        setChatSideView('details');
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                    <Layers className="mb-3 h-8 w-8 text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">No mind map yet</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">Generate a mind map to browse this reviewer’s concepts here.</p>
                    <button
                      onClick={() => void handleGenerateConceptMap(currentDoc.id)}
                      disabled={isGeneratingMap}
                      className="btn btn-sm btn-primary mt-4"
                    >
                      {isGeneratingMap ? 'Generating…' : 'Generate mind map'}
                    </button>
                  </div>
                )}
              </aside>
            </>
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
                  <Layers className="mx-auto mb-3 h-7 w-7 text-blue-400" />
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
    </div>
  );
};
