/**
 * ── UnifiedAyoaLayout: The One Wrapper ──
 *
 * EMERGENCY FIX: RAW JSON NUKE protocol.
 * Feed view now shows RAW DATA DUMP to prove the pipe is connected.
 * Children are rendered BELOW the dump so we can see both.
 */

import React, { useState, useCallback } from 'react';
import AyoaViewToggle from '@/components/canvas/AyoaViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import AyoaMapView from '@/components/canvas/AyoaMapView';
import GanttView from '@/components/views/GanttView';

const DNA_ACCENTS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

/**
 * RAW DATA DUMP — visual proof that data arrived.
 * Shows first 3 items as formatted JSON + a count banner.
 */
function RawDataDump({ items, label }) {
  if (!items || items.length === 0) {
    return (
      <div style={{
        border: '3px solid #FF0000',
        borderRadius: '12px',
        padding: '20px',
        margin: '12px 0',
        backgroundColor: '#FFF0F0',
        direction: 'ltr',
        textAlign: 'left',
      }}>
        <h2 style={{ color: '#FF0000', fontWeight: 900, fontSize: '18px', margin: '0 0 8px 0' }}>
          PIPE EMPTY — 0 items arrived to "{label}"
        </h2>
        <p style={{ color: '#990000', fontWeight: 700, fontSize: '14px' }}>
          The page component is passing an empty array to UnifiedAyoaLayout.
          Check that the page's data-fetching useEffect has completed before render.
        </p>
      </div>
    );
  }

  const sample = items.slice(0, 3);

  return (
    <div style={{
      border: '3px solid #00AA00',
      borderRadius: '12px',
      padding: '20px',
      margin: '12px 0',
      backgroundColor: '#F0FFF0',
      direction: 'ltr',
      textAlign: 'left',
    }}>
      <h2 style={{ color: '#006600', fontWeight: 900, fontSize: '18px', margin: '0 0 4px 0' }}>
        PIPE CONNECTED — {items.length} items arrived to "{label}"
      </h2>
      <p style={{ color: '#006600', fontWeight: 700, fontSize: '13px', margin: '0 0 12px 0' }}>
        Showing first {sample.length} of {items.length} items as raw JSON:
      </p>
      {sample.map((item, i) => (
        <pre key={i} style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #CCDDCC',
          borderRadius: '8px',
          padding: '10px',
          marginBottom: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          overflow: 'auto',
          maxHeight: '150px',
          color: '#1a1a1a',
          fontWeight: 600,
          lineHeight: 1.5,
        }}>
          {JSON.stringify(item, null, 2)}
        </pre>
      ))}
    </div>
  );
}

/**
 * HTML DIV MAP — proves nodes can render without SVG.
 * Simple colored boxes positioned with basic math.
 */
function HtmlDivMap({ items, centerLabel }) {
  if (!items || items.length === 0) return null;
  const maxShow = Math.min(items.length, 20);
  const displayed = items.slice(0, maxShow);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '600px',
      backgroundColor: '#FAFBFC',
      borderRadius: '16px',
      border: '2px solid #E0E0E0',
      overflow: 'hidden',
    }}>
      {/* Center node */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '120px',
        height: '60px',
        borderRadius: '30px',
        background: 'linear-gradient(135deg, #FFC107, #FF9800)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 900,
        fontSize: '14px',
        boxShadow: '0 4px 20px rgba(255,152,0,0.4)',
        zIndex: 10,
      }}>
        {centerLabel}
      </div>

      {/* Child nodes around center using sin/cos */}
      {displayed.map((item, i) => {
        const angle = (2 * Math.PI * i) / maxShow - Math.PI / 2;
        const radius = 220;
        const cx = 50 + Math.cos(angle) * (radius / 6);
        const cy = 50 + Math.sin(angle) * (radius / 6);

        const colors = ['#00A3E0', '#E91E63', '#FFC107', '#8BC34A', '#FF6B9D', '#9C27B0', '#00BCD4', '#FF9800'];
        const bg = colors[i % colors.length];

        return (
          <div key={item.id || i} style={{
            position: 'absolute',
            left: `${cx}%`,
            top: `${cy}%`,
            transform: 'translate(-50%, -50%)',
            minWidth: '100px',
            maxWidth: '160px',
            padding: '8px 12px',
            borderRadius: '20px',
            backgroundColor: bg + '18',
            border: `2px solid ${bg}`,
            fontSize: '11px',
            fontWeight: 700,
            color: '#0F172A',
            textAlign: 'center',
            zIndex: 5,
            boxShadow: `0 2px 8px ${bg}30`,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}>
            <div style={{ fontWeight: 900, fontSize: '12px' }}>
              {item.title || item.client_name || item.name || item.account_name || `#${i + 1}`}
            </div>
            <div style={{ fontSize: '10px', color: bg, fontWeight: 700 }}>
              {item.category || item.status || item.type || '—'}
            </div>
          </div>
        );
      })}

      {/* Count badge */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        background: '#0F172A',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 800,
      }}>
        {items.length} items total • showing {maxShow}
      </div>
    </div>
  );
}

export default function UnifiedAyoaLayout({
  data,
  tasks: tasksProp,
  clients = [],
  centerLabel = 'מרכז',
  centerSub = '',
  accentColor,
  branch,
  currentMonth,
  onEditTask,
  children,
}) {
  const items = data || tasksProp || [];
  const [activeView, setActiveView] = useState('feed');
  const accent = accentColor || (branch && DNA_ACCENTS[branch]) || DNA_ACCENTS.P2;
  const resolvedSub = centerSub || `${items.length} פריטים`;

  // ── EMERGENCY DEBUG: Log everything ──
  console.log(`[UnifiedAyoaLayout] "${centerLabel}" | items: ${items.length} | activeView: ${activeView} | hasChildren: ${!!children} | childrenType: ${typeof children}`);
  if (items.length > 0) {
    console.log('[UnifiedAyoaLayout] First item sample:', JSON.stringify(items[0]).substring(0, 200));
  }

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
  }, []);

  return (
    <div className="space-y-3">
      {/* View Switcher + Debug Badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <AyoaViewToggle value={activeView} onChange={handleViewChange} accentColor={accent} />
        <span style={{
          fontSize: '11px',
          fontWeight: 800,
          padding: '3px 10px',
          borderRadius: '20px',
          backgroundColor: items.length > 0 ? '#D4EDDA' : '#F8D7DA',
          color: items.length > 0 ? '#155724' : '#721C24',
          border: `1px solid ${items.length > 0 ? '#C3E6CB' : '#F5C6CB'}`,
        }}>
          data: {items.length} | children: {children ? 'YES' : 'NO'}
        </span>
      </div>

      {/* ── FEED VIEW ── */}
      {activeView === 'feed' && (
        <div>
          {/* RAW JSON NUKE — always show data dump first */}
          <RawDataDump items={items} label={centerLabel} />

          {/* Then show children (original page table) below */}
          {children && (
            <div style={{ marginTop: '16px', borderTop: '2px dashed #CCCCCC', paddingTop: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 800, color: '#666', marginBottom: '8px' }}>
                ↓ ORIGINAL CHILDREN BELOW (your table component) ↓
              </p>
              {children}
            </div>
          )}
        </div>
      )}

      {/* ── MAP VIEW — HTML div fallback ── */}
      {activeView === 'map' && (
        <div>
          <RawDataDump items={items} label={`${centerLabel} — Map View`} />
          <HtmlDivMap items={items} centerLabel={centerLabel} />
        </div>
      )}

      {/* ── RADIAL VIEW ── */}
      {activeView === 'radial' && (
        <div>
          <RawDataDump items={items} label={`${centerLabel} — Radial View`} />
          <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '500px' }}>
            <AyoaRadialView tasks={items} centerLabel={centerLabel} centerSub={resolvedSub} />
          </div>
        </div>
      )}

      {/* ── GANTT VIEW ── */}
      {activeView === 'gantt' && (
        <div>
          <RawDataDump items={items} label={`${centerLabel} — Gantt View`} />
          <GanttView tasks={items} clients={clients} currentMonth={currentMonth || new Date()} onEditTask={onEditTask} />
        </div>
      )}
    </div>
  );
}
