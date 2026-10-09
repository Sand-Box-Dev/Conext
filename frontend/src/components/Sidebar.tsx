import React, { useState } from 'react';
import {
  Network,
  Clock3,
  FolderKanban,
  Trash2,
  RotateCcw,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Keyboard,
} from 'lucide-react';
import { DocumentUpload } from './DocumentUpload';
import type { DocumentItem } from '../types';

interface SidebarProps {
  activeView: 'dashboard' | 'library' | 'workspace';
  onShowDashboard: () => void;
  onShowLibrary: () => void;
  trashedDocuments: DocumentItem[];
  isTrashOpen: boolean;
  onToggleTrash: () => void;
  onRestoreReviewer: (documentId: number) => void;
  trashShortcutLabel: string;
  onUploadSuccess: (file: File) => Promise<void>;
  isUploading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onShowDashboard,
  onShowLibrary,
  trashedDocuments,
  isTrashOpen,
  onToggleTrash,
  onRestoreReviewer,
  trashShortcutLabel,
  onUploadSuccess,
  isUploading,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  return (
    <aside className={`flex h-full shrink-0 select-none flex-col justify-between border-r border-slate-800 bg-slate-900/90 backdrop-blur-xl transition-[width] duration-200 ${isCollapsed ? 'w-[4.5rem]' : 'w-80'}`}>
      {/* Brand & Tagline */}
      <div className={`${isCollapsed ? 'p-3' : 'p-5'} border-b border-slate-800/80`}>
        <div className={`mb-1.5 flex items-center ${isCollapsed ? 'flex-col gap-3' : 'justify-between gap-2.5'}`}>
          <div className="flex min-w-0 items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Network className="w-5 h-5" />
          </div>
          {!isCollapsed && <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">
              Conext
            </h1>
            <span className="text-[10px] text-blue-400 font-medium tracking-wider uppercase">
              Offline Knowledge Maps
            </span>
          </div>}
          </div>
          <button
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            className="btn btn-ghost btn-sm btn-square shrink-0 text-slate-400 hover:text-white"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        {!isCollapsed && <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Grounded, visual concept learning powered by local AI.
        </p>}
      </div>

      <nav className={`space-y-1 border-b border-slate-800/80 py-3 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <button
          type="button"
          onClick={onShowDashboard}
          title="Recent"
          className={`flex w-full items-center rounded-xl py-2.5 text-sm transition ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3 text-left'} ${activeView === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
        >
          <Clock3 className="h-4 w-4 shrink-0" /> {!isCollapsed && 'Recent'}
        </button>
        <button
          type="button"
          onClick={onShowLibrary}
          title="Library"
          className={`flex w-full items-center rounded-xl py-2.5 text-sm transition ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3 text-left'} ${activeView === 'library' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
        >
          <FolderKanban className="h-4 w-4 shrink-0" /> {!isCollapsed && 'Library'}
        </button>
      </nav>

      {/* Upload */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'space-y-5 p-2' : 'space-y-6 p-5'}`}>
        {!isCollapsed && <div>
          <h2 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2.5">
            Add Document
          </h2>
          <DocumentUpload
            onUploadSuccess={onUploadSuccess}
            isUploading={isUploading}
          />
        </div>}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="btn btn-ghost btn-square mx-auto flex text-slate-400 hover:text-white"
            title="Expand to add a document"
            aria-label="Expand sidebar to add a document"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}

      </div>

      {/* Trash and keyboard shortcuts */}
      <div className={`${isCollapsed ? 'p-2' : 'p-4'} bg-slate-950/50`}>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => { if (isCollapsed) setIsCollapsed(false); onToggleTrash(); }}
            title={`Trash (${trashShortcutLabel})`}
            aria-expanded={isTrashOpen}
            className={`flex w-full items-center rounded-xl py-2.5 text-sm transition ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3 text-left'} ${isTrashOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
          >
            <Trash2 className="h-4 w-4 shrink-0" /> {!isCollapsed && <><span className="flex-1 text-left">Trash</span><span className="trash-count rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{trashedDocuments.length}</span><ChevronDown className={`h-4 w-4 transition-transform ${isTrashOpen ? 'rotate-180' : ''}`} /></>}
          </button>
          {isTrashOpen && !isCollapsed && <div className="rounded-xl bg-slate-900/80 p-2">
            {trashedDocuments.length ? <ul className="space-y-1">{trashedDocuments.map((document) => <li key={document.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-300">
              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate" title={document.filename}>{document.filename}</span>
              <button type="button" onClick={() => onRestoreReviewer(document.id)} title={`Restore ${document.filename}`} aria-label={`Restore ${document.filename}`} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><RotateCcw className="h-3.5 w-3.5" /></button>
            </li>)}</ul> : <p className="px-2 py-2 text-xs text-slate-500">Trash is empty.</p>}
          </div>}
          <div className="my-1 border-t border-slate-800/80" />
          <button
            type="button"
            onClick={() => { if (isCollapsed) setIsCollapsed(false); setIsShortcutsOpen((open) => !open); }}
            title="Keyboard shortcuts"
            aria-expanded={isShortcutsOpen}
            className={`flex w-full items-center rounded-xl py-2.5 text-sm text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200 ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3 text-left'}`}
          >
            <Keyboard className="h-4 w-4 shrink-0" /> {!isCollapsed && <><span className="flex-1">Keyboard shortcuts</span><ChevronDown className={`h-4 w-4 transition-transform ${isShortcutsOpen ? 'rotate-180' : ''}`} /></>}
          </button>
          {isShortcutsOpen && !isCollapsed && <div className="space-y-2 rounded-xl bg-slate-900/80 p-3 text-[11px] text-slate-400">
            <div className="flex justify-between gap-3"><span>Open commands</span><kbd>{trashShortcutLabel.replace(/\+3$/, '+K')}</kbd></div>
            <div className="flex justify-between gap-3"><span>Search reviewers</span><kbd>/</kbd></div>
            <div className="flex justify-between gap-3"><span>Recent</span><kbd>{trashShortcutLabel.replace(/\+3$/, '+1')}</kbd></div>
            <div className="flex justify-between gap-3"><span>Library</span><kbd>{trashShortcutLabel.replace(/\+3$/, '+2')}</kbd></div>
            <div className="flex justify-between gap-3"><span>Toggle Trash</span><kbd>{trashShortcutLabel}</kbd></div>
            <div className="flex justify-between gap-3"><span>Ask AI</span><kbd>{trashShortcutLabel.replace(/\+3$/, '+↵')}</kbd></div>
            <div className="flex justify-between gap-3"><span>Close dialog</span><kbd>Esc</kbd></div>
          </div>}
        </div>
      </div>
    </aside>
  );
};
