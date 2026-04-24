import { useEffect } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { syncService } from '../services/syncService';

export function useSyncQueue() {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline) {
      syncService.flush();
    }
  }, [isOnline]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'SYNC_COMPLETED') {
        syncService.flush();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);
}
