import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getOutbox } from '../db/indexeddb';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Poll the outbox count if offline to show how many items are pending
    if (!isOnline) {
      const interval = setInterval(async () => {
        const outbox = await getOutbox();
        setPendingCount(outbox.length);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOnline]);

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-banner">
      <div className="offline-content">
        <WifiOff size={20} />
        <span>You are currently offline.</span>
        {pendingCount > 0 && (
          <span className="pending-badge">
            {pendingCount} item{pendingCount > 1 ? 's' : ''} pending sync
          </span>
        )}
      </div>
    </div>
  );
}
