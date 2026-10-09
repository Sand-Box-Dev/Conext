import React, { useEffect, useState, useCallback } from 'react';
import {
  Sparkles,
  Layers,
  AlertCircle,
  FileSearch,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ConceptMap } from '../components/ConceptMap';
import { ConceptDetails } from '../components/ConceptDetails';
import { api } from '../services/api';
import type {
  DocumentItem,
  ConceptMapData,
  ConceptDetail,
  HealthStatus,
} from '../types';

export const Workspace: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Concept Map state
  const [conceptMap, setConceptMap] = useState<ConceptMapData | null>(null);
  const [isGeneratingMap, setIsGeneratingMap] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Concept Detail state
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [conceptDetail, setConceptDetail] = useState<ConceptDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Load initial health and documents
  const loadInitialData = useCallback(async () => {
    try {
      const [h, docs] = await Promise.all([
        api.getHealth().catch(() => ({
          status: 'error',
          ollama_connected: false,
          ollama_model: 'gemma4:31b-cloud',
          ollama_model_available: false,
        })),
        api.getDocuments().catch(() => []),
      ]);
      setHealth(h);
      setDocuments(docs);

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

  // Fetch node detail when a node is clicked
  useEffect(() => {
    if (!selectedNodeId) {
      setConceptDetail(null);
      return;
    }

    setIsLoadingDetail(true);
    api
      .getConceptDetails(selectedNodeId)
      .then((detail) => {
        setConceptDetail(detail);
      })
      .catch((err) => {
        console.error('Failed to load details', err);
      })
      .finally(() => {
        setIsLoadingDetail(false);
      });
  }, [selectedNodeId]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const newDoc = await api.uploadDocument(file);
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDocId(newDoc.id);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateConceptMap = async () => {
    if (!selectedDocId) return;

    setIsGeneratingMap(true);
    setMapError(null);
    try {
      const generated = await api.generateConceptMap(selectedDocId);
      setConceptMap(generated);
      // Update has_map in local document list
      setDocuments((prev) =>
        prev.map((d) => (d.id === selectedDocId ? { ...d, has_map: true } : d))
      );
      // Auto-select root node if present
      const rootNode = generated.nodes.find((n) => n.node_type === 'root') || generated.nodes[0];
      if (rootNode) {
        setSelectedNodeId(rootNode.id);
      }
    } catch (err: any) {
      setMapError(err.message || 'Failed to extract concepts with local Ollama.');
    } finally {
      setIsGeneratingMap(false);
    }
  };

  const currentDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0f17] text-slate-100 font-sans">
      {/* Left Sidebar */}
      <Sidebar
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDocument={setSelectedDocId}
        onUploadSuccess={handleUpload}
        isUploading={isUploading}
        health={health}
      />

      {/* Center Main Workspace */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Workspace Top Toolbar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            {currentDoc ? (
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
          {currentDoc && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateConceptMap}
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

          {!currentDoc ? (
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
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 mb-4 shadow-lg">
                <Layers className="w-7 h-7" />
              </div>
              <h2 className="text-base font-semibold text-slate-200 mb-2">
                Ready to map &ldquo;{currentDoc.filename}&rdquo;
              </h2>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
                Extracted {currentDoc.chunk_count} source passages. Click the button below to have local AI synthesize core concepts and trace them back to source text.
              </p>
              <button
                onClick={handleGenerateConceptMap}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-blue-200" />
                <span>Generate Concept Map</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 h-full relative">
              <ConceptMap
                nodesData={conceptMap?.nodes || []}
                edgesData={conceptMap?.edges || []}
                selectedNodeId={selectedNodeId}
                onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
              />
            </div>
          )}

          {/* Right Detail Panel */}
          {conceptMap && (
            <ConceptDetails
              detail={conceptDetail}
              isLoading={isLoadingDetail}
              onClose={() => {
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
