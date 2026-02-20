import { useState, useCallback, useRef } from 'react';

const MIN_SCALE = 0.15;
const MAX_SCALE = 3;
const ZOOM_SENSITIVITY = 0.001;

export function useMindMapTransform(containerRef) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Wheel zoom centered on cursor position
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const t = transformRef.current;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Scale factor from wheel delta
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * (1 + delta)));
    const scaleRatio = newScale / t.scale;

    // Zoom centered on mouse position
    const newX = mouseX - (mouseX - t.x) * scaleRatio;
    const newY = mouseY - (mouseY - t.y) * scaleRatio;

    setTransform({ x: newX, y: newY, scale: newScale });
  }, [containerRef]);

  // Pan: mousedown
  const onMouseDown = useCallback((e) => {
    // Only pan with left button, and not on interactive elements
    if (e.button !== 0) return;
    const tag = e.target.tagName?.toLowerCase();
    if (tag === 'button' || tag === 'a' || tag === 'input') return;

    setIsPanning(true);
    panStart.current = {
      x: e.clientX - transformRef.current.x,
      y: e.clientY - transformRef.current.y,
    };
  }, []);

  // Pan: mousemove
  const onMouseMove = useCallback((e) => {
    if (!isPanning) return;
    const newX = e.clientX - panStart.current.x;
    const newY = e.clientY - panStart.current.y;
    setTransform(prev => ({ ...prev, x: newX, y: newY }));
  }, [isPanning]);

  // Pan: mouseup
  const onMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Auto-fit: calculates transform to show all nodes in viewport with padding
  const autoFit = useCallback((nodes, padding = 80) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !nodes || nodes.length === 0) return;

    // Compute bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      const r = node.radius || 30;
      minX = Math.min(minX, node.x - r);
      minY = Math.min(minY, node.y - r);
      maxX = Math.max(maxX, node.x + r);
      maxY = Math.max(maxY, node.y + r);
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    if (contentWidth <= 0 || contentHeight <= 0) return;

    const viewWidth = rect.width - padding * 2;
    const viewHeight = rect.height - padding * 2;

    // Scale to fit
    const scale = Math.min(
      viewWidth / contentWidth,
      viewHeight / contentHeight,
      1.5 // Don't zoom in too much on sparse maps
    );

    // Center the content
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const x = rect.width / 2 - centerX * scale;
    const y = rect.height / 2 - centerY * scale;

    setTransform({ x, y, scale });
  }, [containerRef]);

  return {
    transform,
    isPanning,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    autoFit,
  };
}
