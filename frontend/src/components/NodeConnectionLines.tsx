import React, { useEffect, useState, useCallback } from 'react';
import { TopologyNode } from '../types';

interface ConnectionLine {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  parentStatus: string;
  sameRow: boolean;
}

interface NodeConnectionLinesProps {
  nodes: TopologyNode[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function NodeConnectionLines({ nodes, containerRef }: NodeConnectionLinesProps) {
  const [lines, setLines] = useState<ConnectionLine[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const calculateLines = useCallback(() => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    setDimensions({
      width: containerRef.current.scrollWidth,
      height: containerRef.current.scrollHeight,
    });

    const nodeMap = new Map<string, TopologyNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const newLines: ConnectionLine[] = [];

    nodes.forEach(node => {
      if (!node.parentId) return;

      const parentEl = containerRef.current!.querySelector(`[data-node-id="${node.parentId}"]`);
      const childEl = containerRef.current!.querySelector(`[data-node-id="${node.id}"]`);

      if (!parentEl || !childEl) return;

      const parentRect = parentEl.getBoundingClientRect();
      const childRect = childEl.getBoundingClientRect();

      const parentNode = nodeMap.get(node.parentId);

      // Check if parent and child are on roughly the same row (e.g., aggregate <-> distribution blocks)
      const sameRow = Math.abs(parentRect.top - childRect.top) < parentRect.height * 0.7;

      if (sameRow) {
        // Side-to-side connection: connect from parent edge to child edge
        const parentOnLeft = parentRect.left < childRect.left;
        const x1 = parentOnLeft
          ? parentRect.right - containerRect.left
          : parentRect.left - containerRect.left;
        const y1 = parentRect.top + parentRect.height / 2 - containerRect.top;
        const x2 = parentOnLeft
          ? childRect.left - containerRect.left
          : childRect.right - containerRect.left;
        const y2 = childRect.top + childRect.height / 2 - containerRect.top;

        newLines.push({
          id: `${node.parentId}-${node.id}`,
          x1, y1, x2, y2,
          parentStatus: parentNode?.status || 'ACTIVE',
          sameRow: true,
        });
      } else {
        // Standard top-to-bottom elbow connector
        newLines.push({
          id: `${node.parentId}-${node.id}`,
          x1: parentRect.left + parentRect.width / 2 - containerRect.left,
          y1: parentRect.top + parentRect.height - containerRect.top,
          x2: childRect.left + childRect.width / 2 - containerRect.left,
          y2: childRect.top - containerRect.top,
          parentStatus: parentNode?.status || 'ACTIVE',
          sameRow: false,
        });
      }
    });

    setLines(newLines);
  }, [nodes, containerRef]);

  useEffect(() => {
    // Recalculate on mount and whenever nodes change
    const timer = setTimeout(calculateLines, 100);

    const resizeObserver = new ResizeObserver(() => {
      calculateLines();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', calculateLines);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateLines);
    };
  }, [calculateLines]);

  function getLineStyle(parentStatus: string) {
    switch (parentStatus) {
      case 'FAILED':
        return {
          stroke: '#ef4444',
          strokeWidth: 3,
          strokeDasharray: '8 4',
          className: 'connection-failed',
        };
      case 'DEGRADED':
        return {
          stroke: '#eab308',
          strokeWidth: 3,
          strokeDasharray: '8 4',
          className: 'connection-degraded',
        };
      default:
        return {
          stroke: '#000000',
          strokeWidth: 3,
          strokeDasharray: 'none',
          className: 'connection-active',
        };
    }
  }

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={dimensions.width}
      height={dimensions.height}
      style={{ zIndex: 0 }}
    >
      {lines.map(line => {
        const style = getLineStyle(line.parentStatus);

        if (line.sameRow) {
          // Straight horizontal line for same-row connections (aggregate <-> distribution)
          return (
            <g key={line.id}>
              <line
                x1={line.x1} y1={line.y1}
                x2={line.x2} y2={line.y2}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                className={`transition-all duration-500 ${style.className}`}
              />
              <circle
                cx={line.x2} cy={line.y2} r={4}
                fill={style.stroke}
                className="transition-all duration-500"
              />
            </g>
          );
        }

        // Elbow connector: vertical down, horizontal, vertical to child
        const midY = (line.y1 + line.y2) / 2;

        return (
          <g key={line.id}>
            <path
              d={`M ${line.x1} ${line.y1} L ${line.x1} ${midY} L ${line.x2} ${midY} L ${line.x2} ${line.y2}`}
              fill="none"
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.strokeDasharray}
              className={`transition-all duration-500 ${style.className}`}
            />
            <circle
              cx={line.x2} cy={line.y2} r={4}
              fill={style.stroke}
              className="transition-all duration-500"
            />
          </g>
        );
      })}
    </svg>
  );
}
