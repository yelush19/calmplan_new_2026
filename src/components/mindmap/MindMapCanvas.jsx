import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useMindMapTransform } from '@/hooks/useMindMapTransform';
import { useMindMapLayout } from '@/hooks/useMindMapLayout';
import { MindMapNode } from './MindMapNode';
import { MindMapEdge } from './MindMapEdge';

export default function MindMapCanvas({ clients, tasks, reconciliations, onNodeClick }) {
  const containerRef = useRef(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const hasAutoFitted = useRef(false);

  const { transform, isPanning, onWheel, onMouseDown, onMouseMove, onMouseUp, autoFit } =
    useMindMapTransform(containerRef);

  const { nodes, edges } = useMindMapLayout({ clients, tasks, reconciliations });

  // Auto-fit when nodes are first available
  useEffect(() => {
    if (nodes.length > 0 && !hasAutoFitted.current) {
      // Small delay to ensure container is measured
      const timer = setTimeout(() => {
        autoFit(nodes);
        hasAutoFitted.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, autoFit]);

  // Re-autofit if nodes count changes significantly (client added/removed)
  const prevNodeCount = useRef(nodes.length);
  useEffect(() => {
    if (Math.abs(nodes.length - prevNodeCount.current) > 2) {
      autoFit(nodes);
      prevNodeCount.current = nodes.length;
    }
  }, [nodes.length, autoFit, nodes]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNodeId(prev => prev === node.id ? null : node.id);
    onNodeClick?.(node);
  }, [onNodeClick]);

  // Build a node lookup map for edges
  const nodeMap = {};
  for (const node of nodes) {
    nodeMap[node.id] = node;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)',
        cursor: isPanning ? 'grabbing' : 'grab',
      }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Subtle grid pattern for infinite canvas feel */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', opacity: 0.03 }}
      >
        <defs>
          <pattern id="mindmap-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mindmap-grid)" />
      </svg>

      {/* Main SVG canvas */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'relative' }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges rendered behind nodes */}
          {edges.map(edge => (
            <MindMapEdge
              key={edge.id}
              fromNode={nodeMap[edge.from]}
              toNode={nodeMap[edge.to]}
              color={edge.color}
              isSecondary={edge.isSecondary}
            />
          ))}

          {/* Nodes */}
          <AnimatePresence>
            {nodes.map(node => (
              <MindMapNode
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                onClick={handleNodeClick}
              />
            ))}
          </AnimatePresence>
        </g>
      </svg>

      {/* Zoom indicator */}
      <div
        className="absolute bottom-4 left-4 px-3 py-1 rounded-full text-xs font-mono"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        {Math.round(transform.scale * 100)}%
      </div>
    </div>
  );
}
