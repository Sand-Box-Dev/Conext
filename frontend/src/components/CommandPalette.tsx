import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenText, Clock3, FolderKanban, MessageCircle, Search, Trash2 } from 'lucide-react';
import type { DocumentItem } from '../types';

type PaletteMode = 'commands' | 'reviewers';

interface CommandPaletteProps {
  open: boolean;
  mode: PaletteMode;
  documents: DocumentItem[];
  selectedDocumentId: number | null;
  selectedFilename?: string;
  modifierLabel: string;
  onClose: () => void;
  onOpenReviewer: (documentId: number) => void;
  onGoRecent: () => void;
  onGoLibrary: () => void;
  onOpenTrash: () => void;
  onAskSelected: () => void;
}

interface PaletteItem {
  id: string;
  title: string;
  detail: string;
  shortcut?: string;
  kind: 'command' | 'reviewer';
  icon: React.ReactNode;
  disabled?: boolean;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  mode,
  documents,
  selectedDocumentId,
  selectedFilename,
  modifierLabel,
  onClose,
  onOpenReviewer,
  onGoRecent,
  onGoLibrary,
  onOpenTrash,
  onAskSelected,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, mode]);

  const items = useMemo<PaletteItem[]>(() => {
    const term = query.trim().toLowerCase();
    const commandOptions: PaletteItem[] = [
      { id: 'recent', title: 'Open Recent', detail: 'Go to your recent reviewers', shortcut: `${modifierLabel}+1`, kind: 'command', icon: <Clock3 />, run: onGoRecent },
      { id: 'library', title: 'Open Library', detail: 'Browse folders and reviewers', shortcut: `${modifierLabel}+2`, kind: 'command', icon: <FolderKanban />, run: onGoLibrary },
      { id: 'trash', title: 'Open Trash', detail: 'Restore removed reviewers', shortcut: `${modifierLabel}+3`, kind: 'command', icon: <Trash2 />, run: onOpenTrash },
      { id: 'ask', title: 'Ask AI about selected reviewer', detail: selectedFilename ?? 'Select a reviewer first', shortcut: `${modifierLabel}+↵`, kind: 'command', icon: <MessageCircle />, disabled: selectedDocumentId === null, run: onAskSelected },
    ];
    const commands = mode === 'commands'
      ? commandOptions.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(term))
      : [];

    const reviewerItems = documents
      .filter((document) => document.filename.toLowerCase().includes(term))
      .map((document): PaletteItem => ({
        id: `reviewer-${document.id}`,
        title: document.filename,
        detail: `${document.chunk_count} passages`,
        kind: 'reviewer',
        icon: <BookOpenText />,
        run: () => onOpenReviewer(document.id),
      }));
    return [...commands, ...reviewerItems];
  }, [documents, mode, modifierLabel, onAskSelected, onGoLibrary, onGoRecent, onOpenTrash, onOpenReviewer, query, selectedDocumentId, selectedFilename]);

  if (!open) return null;

  const runItem = (item: PaletteItem | undefined) => {
    if (!item || item.disabled) return;
    item.run();
    onClose();
  };

  return (
    <div className="command-palette-scrim fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={mode === 'commands' ? 'Search reviewers or commands' : 'Search reviewers'} className="command-palette w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200/70 px-4">
          <Search className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => items.length ? (index + 1) % items.length : 0);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => items.length ? (index - 1 + items.length) % items.length : 0);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                runItem(items[activeIndex]);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder={mode === 'commands' ? 'Search reviewers or commands' : 'Search reviewers'}
            aria-label={mode === 'commands' ? 'Search reviewers or commands' : 'Search reviewers'}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded-md border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500">ESC</kbd>
        </div>

        <div className="max-h-[min(55vh,26rem)] overflow-y-auto p-2" role="listbox" aria-label="Search results">
          {items.length ? items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              disabled={item.disabled}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => runItem(item)}
              className={`command-palette-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${index === activeIndex ? 'is-active' : ''} ${item.disabled ? 'opacity-50' : ''}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{item.title}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{item.detail}</span>
              </span>
              {item.shortcut && <kbd className="shrink-0 rounded-md border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500">{item.shortcut}</kbd>}
            </button>
          )) : (
            <p className="px-3 py-8 text-center text-sm text-slate-500">No matches found.</p>
          )}
        </div>

        <div className="command-palette-footer flex items-center gap-4 border-t border-slate-200/70 px-4 py-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to open</span>
          <span>/ to search reviewers</span>
          <span className="ml-auto flex items-center gap-1"><kbd>{modifierLabel}</kbd>+K</span>
        </div>
      </section>
    </div>
  );
};
