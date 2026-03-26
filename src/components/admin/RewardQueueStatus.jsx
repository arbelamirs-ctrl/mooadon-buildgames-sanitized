import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  Zap
} from 'lucide-react';

export default function RewardQueueStatus() {
  const [processingQueue, setProcessingQueue] = useState(false);

  const { data: queueStats, isLoading, refetch } = useQuery({
    queryKey: ['rewardQueueStats'],
    queryFn: async () => {
      const allJobs = await base44.entities.RewardQueue.list();
      
      return {
        total: allJobs.length,
        pending: allJobs.filter(j => j.status === 'pending').length,
        processing: allJobs.filter(j => j.status === 'processing').length,
        completed: allJobs.filter(j => j.status === 'completed').length,
        failed: allJobs.filter(j => j.status === 'failed').length,
        recentJobs: allJobs.slice(0, 10)
      };
    },
    refetchInterval: 5000
  });

  const processQueue = async () => {
    setProcessingQueue(true);
    try {
      await base44.functions.invoke('RewardQueueProcessor', {});
      await refetch();
    } catch (error) {
      console.error('Failed to process queue:', error);
    } finally {
      setProcessingQueue(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return <Badge className={variants[status] || ''}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1f2128] border-[#2d2d3a]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-teal-400" />
            Reward Queue Status
          </CardTitle>
          <p className="text-xs text-[#9ca3af] mt-1">
            Async reward processing system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="border-[#2d2d3a] text-[#9ca3af]"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={processQueue}
            disabled={processingQueue}
            size="sm"
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            {processingQueue ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4 mr-1" />
                Process Now
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{queueStats?.total || 0}</div>
            <div className="text-xs text-[#9ca3af]">Total</div>
          </div>
          <div className="bg-[#17171f] border border-yellow-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{queueStats?.pending || 0}</div>
            <div className="text-xs text-[#9ca3af]">Pending</div>
          </div>
          <div className="bg-[#17171f] border border-blue-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{queueStats?.processing || 0}</div>
            <div className="text-xs text-[#9ca3af]">Processing</div>
          </div>
          <div className="bg-[#17171f] border border-green-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{queueStats?.completed || 0}</div>
            <div className="text-xs text-[#9ca3af]">Completed</div>
          </div>
          <div className="bg-[#17171f] border border-red-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{queueStats?.failed || 0}</div>
            <div className="text-xs text-[#9ca3af]">Failed</div>
          </div>
        </div>

        {/* Recent Jobs */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Recent Jobs</h3>
          <div className="space-y-2">
            {queueStats?.recentJobs && queueStats.recentJobs.length > 0 ? (
              queueStats.recentJobs.map(job => (
                <div
                  key={job.id}
                  className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 flex items-center justify-between hover:border-teal-500/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(job.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white truncate">
                          {job.reward_type}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {job.amount}
                        </Badge>
                      </div>
                      <div className="text-xs text-[#9ca3af] truncate">
                        Customer: {job.customer_id?.substring(0, 8)}...
                      </div>
                      {job.error_message && (
                        <div className="text-xs text-red-400 truncate">
                          Error: {job.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(job.status)}
                    {job.retry_count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Retry {job.retry_count}/{job.max_retries}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[#9ca3af] text-sm">
                No jobs in queue
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-teal-400">
              <p className="font-medium mb-1">Async Processing System</p>
              <p className="text-teal-400/80">
                Rewards are processed in the background with automatic retries. 
                Checkout completes instantly (&lt;2s) while rewards process reliably.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}