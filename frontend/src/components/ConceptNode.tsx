import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { BookOpen, List, Layers } from 'lucide-react';
import type { ConceptNodeData } from '../types';

interface ConceptNodeProps {
  data: ConceptNodeData;
  selected?: boolean;
}

export const ConceptNodeComponent: React.FC<ConceptNodeProps> = memo(({ data, selected }) => {
  const isRoot = data.node_type === 'root';
  const isSubconcept = data.node_type === 'subconcept';

  const getNodeStyles = () => {
    if (isRoot) {
      return {
        card: selected
          ? 'concept-node-selected bg-slate-950/80 border-slate-400'
          : 'bg-slate-900/90 border-slate-500/60 hover:border-slate-400',
        typeLabel: 'text-slate-500',
        icon: <BookOpen className="w-4 h-4 text-slate-500" />,
        label: 'text-slate-100 font-bold text-base',
      };
    }
    if (isSubconcept) {
      return {
        card: selected
          ? 'concept-node-selected bg-slate-800 border-slate-300'
          : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-500',
        typeLabel: 'text-slate-500',
        icon: <Layers className="w-3.5 h-3.5 text-slate-400" />,
        label: 'text-slate-200 font-medium text-xs',
      };
    }
    // Default concept
    return {
      card: selected
        ? 'concept-node-selected bg-slate-950/80 border-slate-300'
        : 'bg-slate-900/90 border-slate-500/40 hover:border-slate-400',
      typeLabel: 'text-slate-500',
      icon: <List className="w-3.5 h-3.5 text-slate-500" />,
      label: 'text-slate-100 font-semibold text-sm',
    };
  };

  const style = getNodeStyles();

  return (
    <div
      className={`concept-node group relative rounded-xl border p-3.5 transition-all duration-200 cursor-pointer min-w-[180px] max-w-[260px] ${style.card}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-white !w-2 !h-2 !border-2 !border-slate-400 transition-transform group-hover:scale-110"
      />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          {style.icon}
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${style.typeLabel}`}>
            {data.node_type}
          </span>
        </div>
        {data.source_chunk_ids?.length > 0 && (
          <span className="text-[10px] text-slate-500">
            {data.source_chunk_ids.length} sources
          </span>
        )}
      </div>

      <h3 className={`line-clamp-2 leading-snug tracking-tight ${style.label}`}>
        {data.label}
      </h3>

      {data.explanation && (
        <p className="mt-1 text-slate-400 text-xs line-clamp-2 leading-relaxed">
          {data.explanation}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-white !w-2 !h-2 !border-2 !border-slate-400 transition-transform group-hover:scale-110"
      />
    </div>
  );
});

ConceptNodeComponent.displayName = 'ConceptNodeComponent';
