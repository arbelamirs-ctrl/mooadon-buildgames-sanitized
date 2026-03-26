import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  Activity,
  ShieldCheck,
} from 'lucide-react';

// ── Self-healing intervals ────────────────────────────────────────────────────
const WATCHDOG_INTERVAL_MS  = 3 * 60 * 1000;  // run watchdog every 3 min
const REWARDS_INTERVAL_MS   = 5 * 60 * 1000;  // RewardQueueProcessor every 5 min
const MINT_INTERVAL_MS      = 15 * 60 * 1000; // mintRewardJob every 15 min
const ANCHOR_INTERVAL_MS    = 60 * 60 * 1000; // runAnchorJob every 60 min
const AUTOMATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // runAutomationRules daily

export default function RewardQueueStatus() {
  const [processingQueue, setProcessingQueue]   = useState(false);
  const [runningWatchdog, setRunningWatchdog]   = useState(false);
  const [lastWatchdogRun, setLastWatchdogRun]   = useState(null);
  const [watchdogLog, setWatchdogLog]           = useState([]);
  const [selfHealActive, setSelfHealActive]     = useState(true);

  // Track last run times in a ref (survives re-renders, resets on page reload)
  const lastRun = useRef({
    RewardQueueProcessor: 0,
    mintRewardJob:        0,
    runAnchorJob:         0,
    runAutomationRules:   0,
  });

  // ── Queue stats query ───────────────────────────────────────────────────────
  const { data: queueStats, isLoading, refetch } = useQuery({
    queryKey: ['rewardQueueStats'],
    queryFn: async () => {
      const allJobs = await base44.entities.RewardQueue.list();
      return {
        total:      allJobs.length,
        pending:    allJobs.filter((j) => j.status === 'pending').length,
        processing: allJobs.filter((j) => j.status === 'processing').length,
        completed:  allJobs.filter((j) => j.status === 'completed').length,
        failed:     allJobs.filter((j) => j.status === 'failed').length,
        recentJobs: allJobs.slice(0, 10),
      };
    },
    refetchInterval: 8000,
  });

  // ── Core: run a single backend job (no-throw) ───────────────────────────────
  const runJob = async (jobName, label) => {
    try {
      await base44.functions.invoke(jobName, {});
      lastRun.current[jobName] = Date.now();
      addLog(`✅ ${label}`);
      return true;
    } catch (err) {
      addLog(`❌ ${label}: ${err.message}`);
      return false;
    }
  };

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setWatchdogLog(prev => [`${ts}  ${msg}`, ...prev].slice(0, 20));
  };

  // ── Self-healing watchdog ───────────────────────────────────────────────────
  const runWatchdog = async (force = false) => {
    if (runningWatchdog) return;
    setRunningWatchdog(true);
    const now = Date.now();
    let acted = false;

    try {
      // 1. RewardQueueProcessor — only if there's pending/failed work
      const shouldRunRewards = force || (now - lastRun.current.RewardQueueProcessor) >= REWARDS_INTERVAL_MS;
      if (shouldRunRewards) {
        const pending = queueStats?.pending ?? 0;
        const failed  = queueStats?.failed  ?? 0;
        if (force || pending > 0 || failed > 0) {
          await runJob('RewardQueueProcessor', `RewardQueueProcessor (${pending} pending, ${failed} failed)`);
          acted = true;
        } else {
          addLog('⏭ RewardQueueProcessor — queue empty, skipped');
          lastRun.current.RewardQueueProcessor = now; // reset timer even if skipped
        }
      }

      // 2. mintRewardJob — retry failed PendingRewards
      if (force || (now - lastRun.current.mintRewardJob) >= MINT_INTERVAL_MS) {
        await runJob('mintRewardJob', 'mintRewardJob (retry failed mints)');
        acted = true;
      }

      // 3. runAnchorJob — anchor batches to Avalanche
      if (force || (now - lastRun.current.runAnchorJob) >= ANCHOR_INTERVAL_MS) {
        await runJob('runAnchorJob', 'runAnchorJob (anchor to Avalanche)');
        acted = true;
      }

      // 4. runAutomationRules — birthday / inactivity campaigns
      if (force || (now - lastRun.current.runAutomationRules) >= AUTOMATION_INTERVAL_MS) {
        await runJob('runAutomationRules', 'runAutomationRules (birthday/inactivity)');
        acted = true;
      }

      if (!acted && !force) {
        addLog('⏭ All jobs within interval — nothing to do');
      }

      setLastWatchdogRun(new Date().toLocaleTimeString('he-IL'));
      await refetch();

    } finally {
      setRunningWatchdog(false);
    }
  };

  // ── Self-healing interval ───────────────────────────────────────────────────
  useEffect(() => {
    if (!selfHealActive) return;
    addLog('🟢 Self-healing watchdog started');

    // Run once immediately on mount
    const initTimeout = setTimeout(() => runWatchdog(), 2000);

    // Then every WATCHDOG_INTERVAL_MS
    const interval = setInterval(() => runWatchdog(), WATCHDOG_INTERVAL_MS);

    return () => {
      clearTimeout(initTimeout);
      clearInterval(interval);
      addLog('🔴 Self-healing watchdog stopped');
    };
  }, [selfHealActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual process queue (old button) ──────────────────────────────────────
  const processQueue = async () => {
    setProcessingQueue(true);
    try {
      await runJob('RewardQueueProcessor', 'RewardQueueProcessor (manual)');
      await refetch();
    } finally {
      setProcessingQueue(false);
    }
  };

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':    return <Clock     className="w-4 h-4 text-yellow-500" />;
      case 'processing': return <Loader2   className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':  return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':     return <XCircle   className="w-4 h-4 text-red-500" />;
      default:           return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completed:  'bg-green-500/20 text-green-400 border-green-500/30',
      failed:     'bg-red-500/20 text-red-400 border-red-500/30',
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

  const hasPendingWork = (queueStats?.pending ?? 0) > 0 || (queueStats?.failed ?? 0) > 0;

  return (
    <div className="space-y-4">

      {/* ── Main queue card ── */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-teal-400" />
              Reward Queue Status
            </CardTitle>
            <p className="text-xs text-[#9ca3af] mt-1">Async reward processing system</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm" className="border-[#2d2d3a] text-[#9ca3af]">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              onClick={processQueue}
              disabled={processingQueue || runningWatchdog}
              size="sm"
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {processingQueue
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Zap className="w-4 h-4 mr-1" />Process Now</>
              }
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total',      value: queueStats?.total,      color: 'text-white',       border: 'border-[#2d2d3a]' },
              { label: 'Pending',    value: queueStats?.pending,    color: 'text-yellow-400',  border: 'border-yellow-500/30' },
              { label: 'Processing', value: queueStats?.processing, color: 'text-blue-400',    border: 'border-blue-500/30' },
              { label: 'Completed',  value: queueStats?.completed,  color: 'text-green-400',   border: 'border-green-500/30' },
              { label: 'Failed',     value: queueStats?.failed,     color: 'text-red-400',     border: 'border-red-500/30' },
            ].map(({ label, value, color, border }) => (
              <div key={label} className={`bg-[#17171f] border ${border} rounded-lg p-3 text-center`}>
                <div className={`text-2xl font-bold ${color}`}>{value ?? 0}</div>
                <div className="text-xs text-[#9ca3af]">{label}</div>
              </div>
            ))}
          </div>

          {/* Alert if work stuck */}
          {hasPendingWork && !runningWatchdog && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-xs text-yellow-400">
                {queueStats?.pending} pending · {queueStats?.failed} failed — watchdog will process shortly
              </span>
            </div>
          )}

          {/* Recent Jobs */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Recent Jobs</h3>
            <div className="space-y-2">
              {queueStats?.recentJobs?.length > 0 ? (
                queueStats.recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 flex items-center justify-between hover:border-teal-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getStatusIcon(job.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white truncate">{job.reward_type}</span>
                          <Badge variant="outline" className="text-xs">{job.amount}</Badge>
                        </div>
                        <div className="text-xs text-[#9ca3af] truncate">
                          Customer: {job.customer_id?.substring(0, 8)}...
                        </div>
                        {job.error_message && (
                          <div className="text-xs text-red-400 truncate">Error: {job.error_message}</div>
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
                <div className="text-center py-8 text-[#9ca3af] text-sm">No jobs in queue</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Watchdog card ── */}
      <Card className="bg-[#1a1a24] border-[#2d2d3a]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              Self-Healing Watchdog
            </CardTitle>
            <p className="text-xs text-[#9ca3af] mt-0.5">
              Runs automatically every 3 min · keeps all background jobs alive
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Active indicator */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${selfHealActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className="text-xs text-[#9ca3af]">{selfHealActive ? 'Active' : 'Paused'}</span>
            </div>
            <Button
              variant="outline" size="sm"
              className="border-[#2d2d3a] text-[#9ca3af] text-xs"
              onClick={() => setSelfHealActive(v => !v)}
            >
              {selfHealActive ? 'Pause' : 'Resume'}
            </Button>
            <Button
              variant="outline" size="sm"
              className="border-purple-500/30 text-purple-400 text-xs"
              disabled={runningWatchdog}
              onClick={() => runWatchdog(true)}
            >
              {runningWatchdog
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <><Activity className="w-3 h-3 mr-1" />Run All Now</>
              }
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Jobs table */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { name: 'RewardQueueProcessor', interval: '5 min',  color: 'text-teal-400',   icon: '🎁' },
              { name: 'mintRewardJob',         interval: '15 min', color: 'text-blue-400',   icon: '🪙' },
              { name: 'runAnchorJob',          interval: '60 min', color: 'text-purple-400', icon: '⚓' },
              { name: 'runAutomationRules',    interval: 'daily',  color: 'text-orange-400', icon: '📣' },
            ].map(({ name, interval, color, icon }) => {
              const last = lastRun.current[name];
              const lastStr = last ? new Date(last).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—';
              return (
                <div key={name} className="bg-[#13131e] border border-[#1c1c28] rounded-lg p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <div>
                      <div className={`font-medium ${color}`}>{name}</div>
                      <div className="text-[#64748b]">every {interval}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#64748b]">last</div>
                    <div className="text-white">{lastStr}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activity log */}
          {watchdogLog.length > 0 && (
            <div className="bg-[#0d0d12] border border-[#1c1c28] rounded-lg p-3 max-h-36 overflow-y-auto">
              <div className="text-xs text-[#64748b] mb-2 font-medium">Activity log</div>
              {watchdogLog.map((entry, i) => (
                <div key={i} className="text-xs text-[#94a3b8] font-mono leading-5">{entry}</div>
              ))}
            </div>
          )}

          {lastWatchdogRun && (
            <p className="text-xs text-[#64748b]">Last watchdog run: {lastWatchdogRun}</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}