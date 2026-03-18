import React, { useRef, useMemo } from 'react';
import { TopologyNode } from '../types';
import TopologyNodeCard from './TopologyNodeCard';
import NodeConnectionLines from './NodeConnectionLines';

interface TopologyTreeProps {
  nodes: TopologyNode[];
  onNodeClick?: (node: TopologyNode, rect: DOMRect) => void;
  onAnalyse?: (node: TopologyNode) => void;
  faultRootIds?: Set<string>;
}

export default function TopologyTree({ nodes, onNodeClick, onAnalyse, faultRootIds }: TopologyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TopologyNode>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  const root = useMemo(() => nodes.find(n => n.parentId === null), [nodes]);

  if (!root) return null;

  // Render a standard subtree (GP and below) — no special layout
  function renderStandardSubtree(nodeId: string): React.ReactNode {
    const node = nodeMap.get(nodeId);
    if (!node) return null;

    const childNodes = node.children
      .map(cid => nodeMap.get(cid))
      .filter(Boolean) as TopologyNode[];

    return (
      <div key={node.id} className="flex flex-col items-center">
        <div className="relative z-10">
          <TopologyNodeCard node={node} onClick={onNodeClick} onAnalyse={onAnalyse} faultRootIds={faultRootIds} />
        </div>
        {childNodes.length > 0 && (
          <div className="flex flex-row items-start justify-center gap-1.5 mt-6">
            {childNodes.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                {renderStandardSubtree(child.id)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Find the aggregate block (direct child of NOC or descendant)
  const aggBlock = nodes.find(n => n.nodeType === 'BLOCK' && n.blockType === 'AGGREGATE');

  // Find distribution blocks (children of aggregate that are also BLOCKs)
  const distBlocks: TopologyNode[] = aggBlock
    ? aggBlock.children
        .map(cid => nodeMap.get(cid))
        .filter(n => n && n.nodeType === 'BLOCK') as TopologyNode[]
    : [];

  // Get aggregate block's own GPs (non-BLOCK children)
  const aggGPs: TopologyNode[] = aggBlock
    ? aggBlock.children
        .map(cid => nodeMap.get(cid))
        .filter(n => n && n.nodeType !== 'BLOCK') as TopologyNode[]
    : [];

  // Separate distribution blocks into left and right of aggregate
  const leftBlocks = distBlocks.filter((_, i) => i % 2 === 0);
  const rightBlocks = distBlocks.filter((_, i) => i % 2 === 1);

  // Render a block column: block card + its GP subtrees below
  function renderBlockColumn(block: TopologyNode): React.ReactNode {
    const gpChildren = block.children
      .map(cid => nodeMap.get(cid))
      .filter(Boolean) as TopologyNode[];

    return (
      <div key={block.id} className="flex flex-col items-center">
        <div className="relative z-10">
          <TopologyNodeCard node={block} onClick={onNodeClick} onAnalyse={onAnalyse} faultRootIds={faultRootIds} />
        </div>
        {gpChildren.length > 0 && (
          <div className="flex flex-row items-start justify-center gap-1.5 mt-6">
            {gpChildren.map(gp => (
              <div key={gp.id} className="flex flex-col items-center">
                {renderStandardSubtree(gp.id)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-x-auto"
    >
      <div className="flex flex-col items-center min-w-max py-6 px-4">

        {/* NOC Node */}
        <div className="relative z-10">
          <TopologyNodeCard node={root} onClick={onNodeClick} onAnalyse={onAnalyse} faultRootIds={faultRootIds} />
        </div>

        {/* Block tier — all blocks on the SAME ROW */}
        {aggBlock && (
          <div className="flex flex-row items-start justify-center gap-2 mt-8">
            {/* Left distribution blocks */}
            {leftBlocks.map(block => renderBlockColumn(block))}

            {/* Aggregate block in center with its own GPs */}
            <div className="flex flex-col items-center">
              <div className="relative z-10">
                <TopologyNodeCard node={aggBlock} onClick={onNodeClick} onAnalyse={onAnalyse} faultRootIds={faultRootIds} />
              </div>
              {aggGPs.length > 0 && (
                <div className="flex flex-row items-start justify-center gap-1.5 mt-6">
                  {aggGPs.map(gp => (
                    <div key={gp.id} className="flex flex-col items-center">
                      {renderStandardSubtree(gp.id)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right distribution blocks */}
            {rightBlocks.map(block => renderBlockColumn(block))}
          </div>
        )}
      </div>

      {/* SVG Connection Lines overlay */}
      <NodeConnectionLines nodes={nodes} containerRef={containerRef} />
    </div>
  );
}
