import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Wifi,
  WifiOff,
  RefreshCw,
  X
} from 'lucide-react';
import { offlineQueue } from './OfflineQueueManager';
import { toast } from 'sonner';

export default function OfflineQueueStatus({ isOnline, onSync }) {
  const [stats, setStats] = useState({ total: 0, pending: 0, synced: 0, failed: 0 });
  const [queue, setQueue] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  // Update stats every second
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(offlineQueue.getStats());
      setQueue(offlineQueue.getQueue());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleRetryFailed = async () => {
    const failed = queue.filter(q => q.status === 'failed');
    if (failed.length === 0) {
      toast.info('No failed transactions');
      return;
    }

    // Reset failed items to pending
    failed.forEach(txn => {
      const updated = offlineQueue.getQueue();
      const item = updated.find(q => q.id === txn.id);
      if (item) {
        item.status = 'pending';
        item.retries = 0;
      }
      localStorage.setItem('pos_offline_queue', JSON.stringify(updated));
    });

    onSync?.();
    toast.success(`Retrying ${failed.length} failed transaction(s)...`);
  };

  const handleClearQueue = () => {
    if (window.confirm('Clear all offline transactions?')) {
      offlineQueue.clearQueue();
      setStats({ total: 0, pending: 0, synced: 0, failed: 0 });
      setQueue([]);
      toast.success('Queue cleared');
    }
  };

  if (stats.total === 0) return null;

  return (
    <Card className="bg-[#1f2128] border-[#2d2d3a] fixed bottom-4 right-4 max-w-sm">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400 font-medium">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-yellow-500 font-medium">Offline</span>
              </>
            )}
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-[#9ca3af] hover:text-white transition"
          >
            {showDetails ? <X className="w-4 h-4" /> : '⋮'}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-white">{stats.total}</div>
            <div className="text-xs text-[#9ca3af]">Total</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-xs text-[#9ca3af]">⏳ Pending</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-400">{stats.synced}</div>
            <div className="text-xs text-[#9ca3af]">✅ Synced</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-400">{stats.failed}</div>
            <div className="text-xs text-[#9ca3af]">❌ Failed</div>
          </div>
        </div>

        {/* Details */}
        {showDetails && (
          <div className="space-y-2 border-t border-[#2d2d3a] pt-3">
            {queue.map((txn) => (
              <div key={txn.id} className="text-xs bg-[#17171f] p-2 rounded border border-[#2d2d3a] flex items-start justify-between">
                <div>
                  <p className="text-white font-mono">{txn.phone}</p>
                  <p className="text-[#9ca3af]">{new Date(txn.queuedAt).toLocaleTimeString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  {txn.status === 'pending' && <Clock className="w-3 h-3 text-yellow-500" />}
                  {txn.status === 'synced' && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                  {txn.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-400" />}
                  <span className="text-[#9ca3af]">{txn.status}</span>
                </div>
              </div>
            ))}

            {/* Actions */}
            <div className="flex gap-2">
              {stats.failed > 0 && (
                <Button
                  onClick={handleRetryFailed}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-[#2d2d3a] text-xs h-7 gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry Failed
                </Button>
              )}
              <Button
                onClick={handleClearQueue}
                size="sm"
                variant="outline"
                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-7"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}