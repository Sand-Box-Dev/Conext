import React from 'react';
import {
  FileText,
  Network,
  Cpu,
  WifiOff,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { DocumentUpload } from './DocumentUpload';
import type { DocumentItem, HealthStatus } from '../types';

interface SidebarProps {
  documents: DocumentItem[];
  selectedDocId: number | null;
  onSelectDocument: (docId: number) => void;
  onUploadSuccess: (file: File) => Promise<void>;
  isUploading: boolean;
  health: HealthStatus | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  selectedDocId,
  onSelectDocument,
  onUploadSuccess,
  isUploading,
  health,
}) => {
  return (
    <aside className="w-80 h-full border-r border-slate-800 bg-slate-900/90 backdrop-blur-xl flex flex-col justify-between shrink-0 select-none">
      {/* Brand & Tagline */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">
              Conext
            </h1>
            <span className="text-[10px] text-blue-400 font-medium tracking-wider uppercase">
              Offline Knowledge Maps
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Grounded, visual concept learning powered by local AI.
        </p>
      </div>

      {/* Upload & Document Library */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div>
          <h2 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2.5">
            Add Document
          </h2>
          <DocumentUpload
            onUploadSuccess={onUploadSuccess}
            isUploading={isUploading}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              Library ({documents.length})
            </h2>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-6 px-3 border border-slate-800/60 rounded-xl bg-slate-950/30 text-slate-400 text-xs">
              No documents yet. Upload a PDF or TXT to get started.
            </div>
          ) : (
            <div className="space-y-1.5">
              {documents.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                return (
                  <button
                    key={doc.id}
                    onClick={() => onSelectDocument(doc.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-start gap-3 ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/60 text-white shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate leading-tight mb-1">
                        {doc.filename}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{doc.chunk_count} passages</span>
                        {doc.has_map && (
                          <span className="flex items-center gap-0.5 text-blue-400 font-medium">
                            • Map ready
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Local System Status (Offline badge & Ollama) */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/50 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <WifiOff className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-[11px]">100% Offline Mode</span>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
            Local Only
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/40">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Ollama: {health?.ollama_model || 'gemma4:31b-cloud'}</span>
          </div>
          {health?.ollama_connected && health?.ollama_model_available ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <CheckCircle className="w-3 h-3" /> Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <AlertTriangle className="w-3 h-3" /> Check Ollama
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};
