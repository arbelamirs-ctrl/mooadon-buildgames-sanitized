// Local offline queue manager using localStorage
export class OfflineQueueManager {
  constructor() {
    this.storageKey = 'pos_offline_queue';
  }

  // Add transaction to local queue
  addToQueue(transaction) {
    const queue = this.getQueue();
    const id = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    queue.push({
      id,
      ...transaction,
      queuedAt: new Date().toISOString(),
      status: 'pending',
      retries: 0
    });
    localStorage.setItem(this.storageKey, JSON.stringify(queue));
    return id;
  }

  // Get all queued transactions
  getQueue() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  // Mark transaction as synced
  markAsSynced(txnId) {
    const queue = this.getQueue();
    const updated = queue.map(t => 
      t.id === txnId ? { ...t, status: 'synced', syncedAt: new Date().toISOString() } : t
    );
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
  }

  // Mark transaction as failed
  markAsFailed(txnId, error) {
    const queue = this.getQueue();
    const updated = queue.map(t => 
      t.id === txnId ? { ...t, status: 'failed', error: error.message, retries: (t.retries || 0) + 1 } : t
    );
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
  }

  // Get pending transactions
  getPendingTransactions() {
    return this.getQueue().filter(t => t.status === 'pending');
  }

  // Clear entire queue
  clearQueue() {
    localStorage.removeItem(this.storageKey);
  }

  // Get queue stats
  getStats() {
    const queue = this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter(t => t.status === 'pending').length,
      synced: queue.filter(t => t.status === 'synced').length,
      failed: queue.filter(t => t.status === 'failed').length
    };
  }
}

export const offlineQueue = new OfflineQueueManager();