import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { syncStatus, onDataChange } from '@/api/base44Client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * SyncStatusIndicator - Shows cloud sync status in the header.
 * Green cloud = connected to Supabase (data syncs between devices)
 * Red cloud-off = local-only mode (data stays on this device only)
 * Spinning refresh icon when a remote change is received.
 */
export default function SyncStatusIndicator() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const isCloud = syncStatus.isCloud;

  // Flash the sync animation when a remote change arrives
  const handleDataChange = useCallback((payload) => {
    setSyncing(true);
    setLastSync(new Date());
    // Flash for 1.5 seconds
    setTimeout(() => setSyncing(false), 1500);

    // Dispatch a custom event so pages can refresh their data
    window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
      detail: payload
    }));
  }, []);

  useEffect(() => {
    if (!isCloud) return;
    const unsub = onDataChange(handleDataChange);
    return unsub;
  }, [isCloud, handleDataChange]);

  if (isCloud) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="relative p-2 rounded-lg hover:bg-green-50 transition-colors">
            {syncing ? (
              <RefreshCw className="w-4 h-4 text-green-600 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4 text-green-600" />
            )}
            <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-center" dir="rtl">
            <p className="font-medium text-green-700">מסונכרן בענן</p>
            <p className="text-xs text-gray-500">
              השינויים מופיעים בכל המכשירים
            </p>
            {lastSync && (
              <p className="text-xs text-gray-400 mt-1">
                סנכרון אחרון: {lastSync.toLocaleTimeString('he-IL')}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Local-only mode warning
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-orange-50 transition-colors">
          <CloudOff className="w-4 h-4 text-orange-500" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-center max-w-[200px]" dir="rtl">
          <p className="font-medium text-orange-600">מצב מקומי בלבד</p>
          <p className="text-xs text-gray-500">
            הנתונים נשמרים רק במכשיר זה.
            הגדר חיבור Supabase כדי לסנכרן בין מכשירים.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
