// ═══════════════════════════════════════════════════════════════
// MindMap page — Stage 5.3b
// ═══════════════════════════════════════════════════════════════
//
// Thin wrapper page that mounts RadialMindMapView full-screen.
// The page is intentionally minimal: the map is the product here.
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import RadialMindMapView from '@/components/views/RadialMindMapView';

export default function MindMap() {
  return (
    <div className="w-full h-[calc(100vh-120px)] min-h-[600px] px-4 py-3">
      <div className="mb-3 flex items-baseline gap-2">
        <h1 className="text-xl font-bold text-gray-900">מפת חשיבה</h1>
        <span className="text-sm text-gray-500">
          לחצי על ענף כדי לפתוח אותו · גררי להזזה · גלגל עכבר להגדלה
        </span>
      </div>
      <div className="w-full h-[calc(100%-40px)]">
        <RadialMindMapView />
      </div>
    </div>
  );
}
