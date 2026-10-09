import React, { useState } from 'react';
import {
  Network,
  Cpu,
  WifiOff,
  CheckCircle,
  AlertTriangle,
  House,
  FolderKanban,
  Clock3,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  LogOut,
  User,
} from 'lucide-react';
import { DocumentUpload } from './DocumentUpload';
import type { DocumentItem, HealthStatus, UserProfile } from '../types';

interface SidebarProps {
  activeView: 'dashboard' | 'library' | 'workspace';
  onShowDashboard: () => void;
  onShowLibrary: () => void;
  onUploadSuccess: (file: File) => Promise<void>;
  isUploading: boolean;
  health: HealthStatus | null;
  recentDocuments: DocumentItem[];
  onOpenRecent: (documentId: number) => void;
  onRemoveRecent: (documentId: number) => void;
  user?: UserProfile | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onShowDashboard,
  onShowLibrary,
  onUploadSuccess,
  isUploading,
  health,
  recentDocuments,
  onOpenRecent,
  onRemoveRecent,
  user,
  onLogout,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          onClick={onShowDashboard}
          title="Dashboard"
          className={`flex w-full items-center rounded-xl py-2.5 text-sm transition ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3 text-left'} ${activeView === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
        >
          <House className="h-4 w-4 shrink-0" /> {!isCollapsed && 'Dashboard'}
        </button>
        <button
          onClick={onShowLibrary}
          title="Library"
          className={`flex w-full items-center rounded-xl py-2.5 text-sm transition ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3 text-left'} ${activeView === 'library' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
        >
          <FolderKanban className="h-4 w-4 shrink-0" /> {!isCollapsed && 'Library'}
        </button>
      </nav>

      {/* Recent reviewers and upload */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'space-y-5 p-2' : 'space-y-6 p-5'}`}>
        <section aria-label="Recently opened reviewers">
          {isCollapsed ? (
            <div className="mb-2 flex justify-center" title="Recent reviewers"><Clock3 className="h-4 w-4 text-slate-500" /></div>
          ) : (
            <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Clock3 className="h-3.5 w-3.5" /> Recent
            </div>
          )}
          {recentDocuments.length ? (
            <ul className="space-y-1">
              {recentDocuments.slice(0, 3).map((document) => (
                <li key={document.id}>
                  <div className={`group flex items-center rounded-lg text-slate-300 transition hover:bg-slate-800/70 hover:text-white ${isCollapsed ? 'justify-center' : ''}`}>
                    <button
                      onClick={() => onOpenRecent(document.id)}
                      title={document.filename}
                      aria-label={`Open ${document.filename}`}
                      className={`flex min-w-0 items-center py-2 text-left text-xs ${isCollapsed ? 'justify-center px-2' : 'flex-1 gap-2.5 px-2.5'}`}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      {!isCollapsed && <span className="truncate">{document.filename}</span>}
                    </button>
                    {!isCollapsed && <button
                      onClick={() => onRemoveRecent(document.id)}
                      title={`Remove ${document.filename} from recent`}
                      aria-label={`Remove ${document.filename} from recent`}
                      className="btn btn-ghost btn-xs btn-square mr-1 shrink-0 text-slate-500 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            !isCollapsed && <p className="px-2.5 py-1 text-xs text-slate-500">Opened reviewers will appear here.</p>
          )}
        </section>

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

      {/* User Session Bar */}
      {user && (
        <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="truncate text-slate-300 font-medium text-[11px]" title={user.email}>
              {user.email || 'Supabase User'}
            </span>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* User Session Bar */}
      {user && (
        <div className={`px-4 py-2.5 border-t border-slate-800/80 bg-slate-900/60 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} text-xs`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            {!isCollapsed && (
              <span className="truncate text-slate-300 font-medium text-[11px]" title={user.email}>
                {user.email || 'Supabase User'}
              </span>
            )}
          </div>
          {!isCollapsed && onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Local System Status (Offline badge & Ollama) */}
      <div className={`${isCollapsed ? 'p-3' : 'p-4'} border-t border-slate-800/80 bg-slate-950/50 space-y-2`}>
        <div className={`flex items-center text-xs ${isCollapsed ? 'justify-center' : 'justify-between'}`} title="Local only · offline mode">
          <div className="flex items-center gap-1.5 text-slate-300">
            <WifiOff className="w-3.5 h-3.5 text-emerald-400" />
            {!isCollapsed && <span className="font-medium text-[11px]">100% Offline Mode</span>}
          </div>
          {!isCollapsed && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
            Local Only
          </span>}
        </div>

        <div className={`flex items-center pt-1 text-xs ${isCollapsed ? 'justify-center' : 'justify-between border-t border-slate-800/40'}`} title={`Ollama: ${health?.ollama_model || 'gemma4:31b-cloud'}`}>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            {!isCollapsed && <span>Ollama: {health?.ollama_model || 'gemma4:31b-cloud'}</span>}
          </div>
          {!isCollapsed && (health?.ollama_connected && health?.ollama_model_available ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <CheckCircle className="w-3 h-3" /> Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <AlertTriangle className="w-3 h-3" /> Check Ollama
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
};
