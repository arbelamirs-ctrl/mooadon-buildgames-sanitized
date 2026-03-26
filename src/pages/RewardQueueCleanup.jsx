import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Trash2, Search, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function RewardQueueCleanup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scanResult, setScanResult] = useState(null);

  const { data: allFailed = [], isLoading, refetch } = useQuery({
    queryKey: ['reward-queue-failed'],
    queryFn: () => base44.entities.RewardQueue.filter({ status: 'failed' }),
  });

  const stuck = allFailed.filter(r => (r.retry_count || 0) >= (r.max_retries || 3));

  const scanMutation = useMutation({
    mutationFn: () => base44.functions.invoke('cleanupStuckRewardQueue', { dry_run: true }),
    onSuccess: (res) => setScanResult(res.data),
    onError: (err) => toast({ title: 'Scan failed', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.functions.invoke('cleanupStuckRewardQueue', { dry_run: false }),
    onSuccess: (res) => {
      setScanResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['reward-queue-failed'] });
      toast({ title: `✅ Deleted ${res.data.deleted_count} stuck records` });
    },
    onError: (err) => toast({ title: 'Cleanup failed', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">RewardQueue Cleanup</h1>
          <p className="text-slate-400 text-sm mt-1">Identify and remove stuck queue entries where the referenced transaction no longer exists.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{allFailed.length}</div>
            <div className="text-slate-400 text-sm">Total Failed</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{stuck.length}</div>
            <div className="text-slate-400 text-sm">Permanently Stuck</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{allFailed.length - stuck.length}</div>
            <div className="text-slate-400 text-sm">May Recover</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          variant="outline"
          className="gap-2"
        >
          <Search className="w-4 h-4" />
          {scanMutation.isPending ? 'Scanning...' : 'Scan (Dry Run)'}
        </Button>
        <Button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending || stuck.length === 0}
          variant="destructive"
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          {deleteMutation.isPending ? 'Deleting...' : `Delete ${stuck.length} Stuck Records`}
        </Button>
      </div>

      {/* Scan Result */}
      {scanResult && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {scanResult.deleted_count > 0
                ? <><CheckCircle className="w-5 h-5 text-green-400" /> Cleanup Complete</>
                : <><AlertTriangle className="w-5 h-5 text-amber-400" /> Scan Results</>
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-slate-300 text-sm">{scanResult.message}</p>
            <div className="flex gap-4 text-sm text-slate-400">
              <span>Checked: <strong className="text-white">{scanResult.total_checked}</strong></span>
              <span>Stuck found: <strong className="text-red-400">{scanResult.stuck_found}</strong></span>
              {!scanResult.dry_run && <span>Deleted: <strong className="text-green-400">{scanResult.deleted_count}</strong></span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stuck Records List */}
      {stuck.length > 0 && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Stuck Records ({stuck.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stuck.map(r => (
                <div key={r.id} className="flex items-start justify-between p-3 bg-[#17171f] rounded-lg border border-[#2d2d3a]">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 font-mono">{r.id}</div>
                    <div className="text-sm text-white">
                      {r.amount} tokens → customer <span className="font-mono text-xs text-slate-400">{r.customer_id?.slice(-8)}</span>
                    </div>
                    <div className="text-xs text-red-400 truncate max-w-md">{r.error_message}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="destructive" className="text-xs">failed</Badge>
                    <span className="text-xs text-slate-500">retries: {r.retry_count}/{r.max_retries}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stuck.length === 0 && !isLoading && (
        <div className="text-center py-12 text-slate-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p>No stuck records found. Queue is healthy!</p>
        </div>
      )}
    </div>
  );
}