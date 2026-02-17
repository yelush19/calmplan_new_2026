import React, { useRef, useCallback, useState } from 'react';

/**
 * ResizableTable - wraps a <table> and makes column borders draggable.
 * Usage:
 *   <ResizableTable>
 *     <thead><tr><th>...</th></tr></thead>
 *     <tbody>...</tbody>
 *   </ResizableTable>
 */
export default function ResizableTable({ children, className = '' }) {
  const tableRef = useRef(null);
  const [resizing, setResizing] = useState(null); // { colIndex, startX, startWidth }

  const handleMouseDown = useCallback((e, colIndex) => {
    e.preventDefault();
    const table = tableRef.current;
    if (!table) return;

    const th = table.querySelectorAll('thead th')[colIndex];
    if (!th) return;

    const startWidth = th.offsetWidth;
    const startX = e.clientX;

    const handleMouseMove = (moveEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(40, startWidth + diff);
      th.style.width = `${newWidth}px`;
      th.style.minWidth = `${newWidth}px`;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setResizing({ colIndex });
  }, []);

  // Inject resize handles into the header row
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!child) return child;

    // Find thead
    if (child.type === 'thead' || child.props?.children?.type === 'tr') {
      return React.cloneElement(child, {
        children: React.Children.map(child.props.children, (trChild) => {
          if (!trChild || trChild.type !== 'tr') return trChild;

          const ths = React.Children.toArray(trChild.props.children);
          const enhancedThs = ths.map((th, idx) => {
            if (!th || th.type !== 'th') return th;
            return React.cloneElement(th, {
              style: { ...th.props?.style, position: 'relative' },
              children: (
                <>
                  {th.props.children}
                  <div
                    onMouseDown={(e) => handleMouseDown(e, idx)}
                    className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-blue-400/50 transition-colors z-20"
                    style={{ touchAction: 'none' }}
                  />
                </>
              ),
            });
          });

          return React.cloneElement(trChild, { children: enhancedThs });
        }),
      });
    }
    return child;
  });

  return (
    <table ref={tableRef} className={`${className}`} style={{ tableLayout: 'auto' }}>
      {enhancedChildren}
    </table>
  );
}
