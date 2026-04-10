import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export function useBackendSync() {
  const isDemo = useStore((s) => s.isDemo);
  const loadServerState = useStore((s) => s.loadServerState);
  const applyServerFeed = useStore((s) => s.applyServerFeed);
  const applyServerOverlay = useStore((s) => s.applyServerOverlay);
  const applyServerConfig = useStore((s) => s.applyServerConfig);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (isDemo) return;

    // Initial full state fetch
    async function fetchState() {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        loadServerState(data);
      } catch (err) {
        console.warn('[GitArena] Failed to fetch server state:', err);
      }
    }

    fetchState();

    // SSE for live updates
    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.addEventListener('state', (e) => {
      try {
        const data = JSON.parse(e.data);
        loadServerState(data);
      } catch { /* ignore */ }
    });

    es.addEventListener('feed', (e) => {
      try {
        const feedItem = JSON.parse(e.data);
        applyServerFeed(feedItem);
      } catch { /* ignore */ }
    });

    es.addEventListener('overlay', (e) => {
      try {
        const overlay = JSON.parse(e.data);
        applyServerOverlay(overlay);
      } catch { /* ignore */ }
    });

    es.addEventListener('config', (e) => {
      try {
        const config = JSON.parse(e.data);
        applyServerConfig(config);
      } catch { /* ignore */ }
    });

    es.addEventListener('reset', () => {
      fetchState();
    });

    es.onerror = () => {
      console.warn('[GitArena] SSE connection error, will reconnect...');
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isDemo, loadServerState, applyServerFeed, applyServerOverlay, applyServerConfig]);
}
