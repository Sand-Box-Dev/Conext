import React, { useState } from 'react';
import { Clock3, FolderKanban, Trash2, PanelLeftClose, PanelLeftOpen, Settings2, LogOut, User } from 'lucide-react';
import type { DocumentItem, UserProfile } from '../types';

interface SidebarProps {
  activeView: 'dashboard' | 'library' | 'workspace' | 'trash' | 'settings';
  onShowDashboard: () => void;
  onShowLibrary: () => void;
  onShowTrash: () => void;
  onShowSettings: () => void;
  trashedDocuments: DocumentItem[];
  trashShortcutLabel: string;
  user?: UserProfile | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onShowDashboard,
  onShowLibrary,
  onShowTrash,
  onShowSettings,
  trashedDocuments,
  trashShortcutLabel,
  user,
  onLogout,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navClass = (view: SidebarProps['activeView']) =>
    `flex w-full items-center rounded-xl py-2.5 text-sm transition ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3 text-left'} ${activeView === view ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`;

  return (
    <aside className={`flex h-full shrink-0 select-none flex-col justify-between border-r border-slate-800 bg-slate-900/90 backdrop-blur-xl transition-[width] duration-200 ${isCollapsed ? 'w-[4.5rem]' : 'w-80'}`}>
      <div className={`${isCollapsed ? 'p-3' : 'px-5 py-4'} border-b border-slate-800/80`}>
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'justify-between gap-2.5'}`}>
          <h1 className={`font-bold tracking-tight text-white ${isCollapsed ? 'text-[10px]' : 'text-lg'}`}>Conext</h1>
          <button onClick={() => setIsCollapsed((collapsed) => !collapsed)} className="btn btn-ghost btn-sm btn-square shrink-0 text-slate-400 hover:text-white" title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav aria-label="Main navigation" className={`space-y-1 border-b border-slate-800/80 py-3 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <button type="button" onClick={onShowDashboard} title="Recent" className={navClass('dashboard')}><Clock3 className="h-4 w-4 shrink-0" /> {!isCollapsed && 'Recent'}</button>
        <button type="button" onClick={onShowLibrary} title="Library" className={navClass('library')}><FolderKanban className="h-4 w-4 shrink-0" /> {!isCollapsed && 'Library'}</button>
        <button type="button" onClick={onShowTrash} title={`Trash (${trashShortcutLabel})`} aria-current={activeView === 'trash' ? 'page' : undefined} className={navClass('trash')}>
          <Trash2 className="h-4 w-4 shrink-0" /> {!isCollapsed && <><span className="flex-1 text-left">Trash</span><span className="trash-count rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{trashedDocuments.length}</span></>}
        </button>
        <button type="button" onClick={onShowSettings} title="Settings" className={navClass('settings')}><Settings2 className="h-4 w-4 shrink-0" /> {!isCollapsed && 'Settings'}</button>
      </nav>

      <div className="flex-1" />
      <div className={`${isCollapsed ? 'p-2' : 'p-4'} bg-slate-950/50`}>
        {user && <div className={`flex items-center border-t border-slate-800/80 px-3 py-2.5 text-xs ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-500/30 bg-slate-500/20 text-slate-500"><User className="h-3.5 w-3.5" /></span>
            {!isCollapsed && <span className="truncate text-[11px] font-medium text-slate-300" title={user.email}>{user.display_name || user.email || 'Signed in'}</span>}
          </div>
          {!isCollapsed && onLogout && <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out" className="rounded p-1 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"><LogOut className="h-3.5 w-3.5" /></button>}
        </div>}
      </div>
    </aside>
  );
};
