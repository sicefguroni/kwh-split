import { getOutbox, clearOutboxItem } from '../db/indexeddb';

export const syncService = {
  isSyncing: false,

  async flush() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const outbox = await getOutbox();
      if (outbox.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`Attempting to sync ${outbox.length} items...`);

      // Bulk POST to API
      const response = await fetch('http://localhost:3000/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: outbox })
      });

      if (!response.ok) {
        throw new Error('Sync failed with status: ' + response.status);
      }

      const result = await response.json();
      
      // Clean up successfully synced items
      const successIds = result.successIds || [];
      for (const id of successIds) {
        await clearOutboxItem(id);
      }

      console.log('Sync complete');
    } catch (err) {
      console.error('Sync process error:', err);
    } finally {
      this.isSyncing = false;
    }
  }
};
