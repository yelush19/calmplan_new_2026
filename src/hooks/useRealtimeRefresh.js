import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook that triggers a callback when remote data changes arrive via Supabase Realtime.
 * Use this in pages/components that need to refresh their data when changes
 * are made on another device.
 *
 * @param {Function} onRefresh - Callback to call when data changes (e.g., reload tasks)
 * @param {string[]} [collections] - Optional: only trigger for specific collections
 */
export default function useRealtimeRefresh(onRefresh, collections = null) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const handleSync = useCallback((e) => {
    const { collection } = e.detail || {};

    // If collections filter is specified, only trigger for matching collections
    if (collections && collection && !collections.includes(collection)) {
      return;
    }

    // Debounce: wait 500ms to batch rapid changes
    refreshRef.current?.();
  }, [collections]);

  useEffect(() => {
    let debounceTimer = null;

    const debouncedHandler = (e) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => handleSync(e), 500);
    };

    window.addEventListener('calmplan:data-synced', debouncedHandler);
    return () => {
      window.removeEventListener('calmplan:data-synced', debouncedHandler);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [handleSync]);
}
