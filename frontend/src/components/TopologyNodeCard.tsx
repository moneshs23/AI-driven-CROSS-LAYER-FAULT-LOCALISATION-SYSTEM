import React from 'react';
import { Search } from 'lucide-react';
import { TopologyNode, NodeType, NodeStatus } from '../types';

// Color scheme per node type
const NODE_COLORS: Record<NodeType, { bg: string; bgMuted: string }> = {
  NOC:   { bg: '#1a1a1a', bgMuted: '#3a3a3a' },
  BLOCK: { bg: '#22d3ee', bgMuted: '#67e8f9' },
  GP:    { bg: '#a78bfa', bgMuted: '#c4b5fd' },
  OLT:   { bg: '#fb923c', bgMuted: '#fdba74' },
  ONT:   { bg: '#e5e5e5', bgMuted: '#f5f5f5' },
};

const BLOCK_TYPE_COLORS: Record<string, { bg: string; bgMuted: string }> = {
  AGGREGATE:    { bg: '#22d3ee', bgMuted: '#67e8f9' },
  DISTRIBUTION: { bg: '#facc15', bgMuted: '#fde047' },
};

// Size scale per tier
const NODE_SIZE: Record<NodeType, string> = {
  NOC:   'w-40 min-h-[6.5rem]',
  BLOCK: 'w-36 min-h-[6rem]',
  GP:    'w-32 min-h-[5.5rem]',
  OLT:   'w-28 min-h-[5rem]',
  ONT:   'w-28 min-h-[5rem]',
};

function getLedClass(status: NodeStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-500 animate-pulse';
    case 'DEGRADED':
      return 'bg-yellow-400 animate-blink';
    case 'FAILED':
      return 'bg-red-500 animate-fault-led';
    default:
      return 'bg-green-500';
  }
}

interface TopologyNodeCardProps {
  node: TopologyNode;
  nodeRef?: React.RefObject<HTMLDivElement | null>;
  onClick?: (node: TopologyNode, rect: DOMRect) => void;
  onAnalyse?: (node: TopologyNode) => void;
  faultRootIds?: Set<string>;
}

export default function TopologyNodeCard({ node, nodeRef, onClick, onAnalyse, faultRootIds }: TopologyNodeCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const isNOC = node.nodeType === 'NOC';
  const isDarkNode = isNOC;
  const isFaulted = node.status !== 'ACTIVE';
  const isRootCause = faultRootIds ? faultRootIds.has(node.id) : false;

  // Determine base color
  let colorSet = NODE_COLORS[node.nodeType];
  if (node.nodeType === 'BLOCK' && node.blockType) {
    colorSet = BLOCK_TYPE_COLORS[node.blockType] || colorSet;
  }

  // Status-based card bg
  let cardBg = colorSet.bg;
  let cardOpacity = '';
  if (node.status === 'DEGRADED') {
    cardBg = colorSet.bgMuted;
    cardOpacity = 'opacity-70';
  } else if (node.status === 'FAILED') {
    cardBg = '#4a4a4a';
    cardOpacity = 'opacity-60';
  }

  const textColor = (isDarkNode || node.status === 'FAILED') ? 'text-white' : 'text-black';

  // Tag label
  let tagLabel: string = node.nodeType;

  const handleClick = () => {
    if (onClick && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      onClick(node, rect);
    }
  };

  const handleAnalyse = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    if (onAnalyse) {
      onAnalyse(node);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div
        ref={(el) => {
          (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (nodeRef) {
            (nodeRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }
        }}
        data-node-id={node.id}
        onClick={handleClick}
        className={`
          ${NODE_SIZE[node.nodeType]}
          neo-border neo-shadow-sm p-3 flex flex-col relative
          transition-all duration-500 shrink-0 cursor-pointer
          ${cardOpacity}
          ${node.status === 'FAILED' ? 'animate-fault-node' : ''}
          hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
        `}
        style={{ backgroundColor: cardBg }}
      >
        {/* Top row: tag + LED */}
        <div className="flex justify-between items-start mb-2">
          <div className={`
            px-2 py-0.5 text-[9px] font-black uppercase tracking-widest
            ${isDarkNode || node.status === 'FAILED' ? 'bg-white text-black' : 'bg-black text-white'}
          `}>
            {tagLabel}
          </div>
          <div className={`
            w-3 h-3 rounded-full neo-border shrink-0
            ${getLedClass(node.status)}
            ${node.status === 'FAILED' ? 'shadow-[0_0_8px_rgba(239,68,68,0.8)]' : ''}
            ${node.status === 'ACTIVE' ? 'shadow-[0_0_6px_rgba(34,197,94,0.6)]' : ''}
          `} />
        </div>

        {/* Node label */}
        <p className={`text-xs font-black uppercase leading-tight ${textColor} ${node.status === 'FAILED' ? 'line-through decoration-red-500 decoration-2' : ''}`}>
          {node.label}
        </p>

        {/* Sector label for OLT/ONT */}
        {(node.nodeType === 'OLT' || node.nodeType === 'ONT') && node.sector && (
          <p className={`text-[7px] font-bold uppercase tracking-wider mt-0.5 ${textColor} opacity-60`}>
            {node.sector === 'Household' ? '🏠' : node.sector === 'Industries' ? '🏭' : '🏛'}{' '}
            {node.sector}
          </p>
        )}

        {/* Status line */}
        <div className="mt-auto pt-2">
          <div className={`border-t-2 ${isDarkNode || node.status === 'FAILED' ? 'border-white/30' : 'border-black/20'} pt-1`}>
            <p className={`text-[8px] font-black uppercase tracking-wider ${textColor} ${node.status !== 'ACTIVE' ? '' : 'opacity-50'}`}>
              {node.status}
              {node.faultType && (
                <span className="ml-1 opacity-80">• {node.faultType}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ANALYSE ERROR button — appears directly below faulted nodes */}
      {isFaulted && isRootCause && onAnalyse && (
        <button
          onClick={handleAnalyse}
          className="mt-1 w-full neo-border bg-red-500 text-white px-2 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-200 hover:bg-red-600 hover:translate-x-px hover:translate-y-px neo-shadow-sm"
          style={{ maxWidth: node.nodeType === 'NOC' ? '11rem' : node.nodeType === 'BLOCK' ? '10rem' : node.nodeType === 'GP' ? '9rem' : node.nodeType === 'OLT' ? '8rem' : '7rem' }}
        >
          <Search className="w-3 h-3" />
          ANALYSE ERROR
        </button>
      )}
    </div>
  );
}
