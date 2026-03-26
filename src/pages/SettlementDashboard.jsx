import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronDown,
  ChevronUp,
  Calculator,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SettlementDashboard() {
  const [expandedPeriods, setExpandedPeriods] = useState({});
  const queryClient = useQueryClient();

  // Fetch settlement periods
  const { data: periods, isLoading } = useQuery({
    queryKey: ['settlementPeriods'],
    queryFn: async () => {
      const result = await base44.entities.SettlementPeriod.list('-created_date', 100);
      return result;
    },
    refetchInterval: 5000
  });

  // Fetch settlement lines for expanded periods
  const expandedPeriodIds = Object.keys(expandedPeriods).filter(k => expandedPeriods[k]);
  const { data: linesByPeriod = {} } = useQuery({
    queryKey: ['settlementLines', expandedPeriodIds],
    queryFn: async () => {
      const lines = {};
      for (const periodId of expandedPeriodIds) {
        const result = await base44.entities.SettlementLine.filter({ period_id: periodId });
        lines[periodId] = result;
      }
      return lines;
    },
    enabled: expandedPeriodIds.length > 0
  });

  // Calculate settlement mutation
  const calculateMutation = useMutation({
    mutationFn: async (periodDate) => {
      const response = await base44.functions.invoke('settlementCalculate', { period_date: periodDate });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Calculation failed');
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Calculated ${data.lines_count} settlement lines`);
      queryClient.invalidateQueries({ queryKey: ['settlementPeriods'] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Execute settlement mutation
  const executeMutation = useMutation({
    mutationFn: async (periodId) => {
      const response = await base44.functions.invoke('settlementExecute', { period_id: periodId });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Execution failed');
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Settled ${data.settled_lines} lines`);
      queryClient.invalidateQueries({ queryKey: ['settlementPeriods'] });
      queryClient.invalidateQueries({ queryKey: ['settlementLines'] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Retry settlement mutation
  const retryMutation = useMutation({
    mutationFn: async (periodId) => {
      const response = await base44.functions.invoke('settlementRetry', { period_id: periodId });
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Retry failed');
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Retried ${data.retried_lines} lines, ${data.succeeded} succeeded`);
      queryClient.invalidateQueries({ queryKey: ['settlementPeriods'] });
      queryClient.invalidateQueries({ queryKey: ['settlementLines'] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const getStatusBadge = (status) => {
    const configs = {
      open: { bg: 'bg-slate-600', icon: Clock, label: 'Open' },
      calculating: { bg: 'bg-blue-600', icon: Loader2, label: 'Calculating' },
      ready: { bg: 'bg-amber-600', icon: AlertCircle, label: 'Ready' },
      settling: { bg: 'bg-cyan-600', icon: Loader2, label: 'Settling' },
      settled: { bg: 'bg-green-600', icon: CheckCircle2, label: 'Settled' },
      failed: { bg: 'bg-red-600', icon: AlertCircle, label: 'Failed' }
    };
    const config = configs[status] || configs.open;
    const Icon = config.icon;
    return (
      <div className={`inline-flex items-center gap-2 ${config.bg} text-white text-xs px-2 py-1 rounded-full`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </div>
    );
  };

  const togglePeriod = (periodId) => {
    setExpandedPeriods(prev => ({
      ...prev,
      [periodId]: !prev[periodId]
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
      </div>
    );
  }

  // Prepare chart data (last 30 days)
  const last30Days = periods?.slice(0, 30).reverse() || [];
  const chartData = last30Days.map(p => ({
    date: p.period_date,
    transferred: p.total_net_transfers || 0,
    lines: p.total_lines || 0
  }));

  const totalSettled = periods?.filter(p => p.status === 'settled').reduce((sum, p) => sum + (p.total_net_transfers || 0), 0) || 0;
  const totalPending = periods?.filter(p => p.status === 'ready').reduce((sum, p) => sum + (p.total_net_transfers || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white">Settlement Management</h1>
          <p className="text-[#9ca3af] mt-2">End-of-day settlement between partner merchants</p>
        </div>
        <Button
          onClick={() => calculateMutation.mutate(new Date().toISOString().split('T')[0])}
          disabled={calculateMutation.isPending}
          className="bg-[#10b981] hover:bg-[#059669]"
        >
          {calculateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="w-4 h-4 mr-2" />
              Calculate Today
            </>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="text-[#9ca3af] text-sm mb-2">Total Settled</div>
            <div className="text-2xl font-bold text-[#10b981]">{totalSettled.toLocaleString()}</div>
            <div className="text-xs text-[#6b7280] mt-1">tokens</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="text-[#9ca3af] text-sm mb-2">Pending Settlement</div>
            <div className="text-2xl font-bold text-amber-500">{totalPending.toLocaleString()}</div>
            <div className="text-xs text-[#6b7280] mt-1">tokens</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="text-[#9ca3af] text-sm mb-2">Periods</div>
            <div className="text-2xl font-bold text-white">{periods?.length || 0}</div>
            <div className="text-xs text-[#6b7280] mt-1">total</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <CardTitle className="text-white">Settlement Volume (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3a" />
                <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2128', border: '1px solid #2d2d3a', borderRadius: '6px' }}
                  labelStyle={{ color: '#10b981' }}
                />
                <Legend />
                <Bar dataKey="transferred" fill="#10b981" name="Tokens Transferred" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Settlement Periods */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Settlement Periods</h2>
        {periods && periods.length > 0 ? (
          periods.map(period => (
            <Card key={period.id} className="bg-[#1f2128] border-[#2d2d3a]">
              <div
                onClick={() => togglePeriod(period.id)}
                className="p-4 cursor-pointer flex items-center justify-between hover:bg-[#17171f] transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {expandedPeriods[period.id] ? (
                    <ChevronUp className="w-5 h-5 text-[#10b981]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#9ca3af]" />
                  )}
                  <div>
                    <div className="font-semibold text-white">{period.period_date}</div>
                    <div className="text-sm text-[#9ca3af]">
                      {period.total_lines} lines • {period.total_net_transfers?.toLocaleString() || 0} tokens
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(period.status)}
                  
                  {period.status === 'ready' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#10b981] text-[#10b981] hover:bg-[#10b981] hover:text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Execute
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#1f2128] border-[#2d2d3a]">
                        <AlertDialogTitle className="text-white">Execute Settlement?</AlertDialogTitle>
                        <AlertDialogDescription className="text-[#9ca3af]">
                          This will execute {period.total_lines} settlement transfers totaling {period.total_net_transfers?.toLocaleString()} tokens. This action cannot be undone.
                        </AlertDialogDescription>
                        <div className="flex gap-3 justify-end">
                          <AlertDialogCancel className="border-[#2d2d3a]">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => executeMutation.mutate(period.id)}
                            className="bg-[#10b981] hover:bg-[#059669]"
                          >
                            Execute
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  {period.status === 'failed' && period.failed_lines_count > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        retryMutation.mutate(period.id);
                      }}
                      disabled={retryMutation.isPending}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded Lines */}
              {expandedPeriods[period.id] && (
                <div className="border-t border-[#2d2d3a] px-4 py-3 bg-[#17171f] space-y-2">
                  {linesByPeriod[period.id] && linesByPeriod[period.id].length > 0 ? (
                    <div className="space-y-2">
                      {linesByPeriod[period.id].map(line => (
                        <div key={line.id} className="p-3 bg-[#1f2128] rounded border border-[#2d2d3a] text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-white font-semibold">{line.from_company_name}</div>
                              <div className="text-xs text-teal-400 font-medium mt-0.5">Total: {line.net_amount.toLocaleString()} tokens</div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getStatusBadge(line.status)}
                              {line.tx_hash && (
                                <a href={`https://testnet.snowtrace.io/tx/${line.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-[#10b981] hover:text-[#059669]">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                          {line.metadata && (
                            <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-[#2d2d3a]">
                              {line.metadata.pos_tokens > 0 && (
                                <div className="text-xs bg-blue-500/10 text-blue-300 px-2 py-1 rounded">
                                  POS: {line.metadata.pos_tokens.toLocaleString()}
                                </div>
                              )}
                              {line.metadata.store_tokens > 0 && (
                                <div className="text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded">
                                  Store: {line.metadata.store_tokens.toLocaleString()}
                                </div>
                              )}
                              {line.metadata.reward_tokens > 0 && (
                                <div className="text-xs bg-amber-500/10 text-amber-300 px-2 py-1 rounded">
                                  Rewards: {line.metadata.reward_tokens.toLocaleString()}
                                </div>
                              )}
                              {line.metadata.spend_tokens > 0 && (
                                <div className="text-xs bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded">
                                  Spend QR: {line.metadata.spend_tokens.toLocaleString()}
                                </div>
                              )}
                              {line.metadata.activity_count > 0 && (
                                <div className="text-xs text-[#9ca3af]">{line.metadata.activity_count} transactions</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[#9ca3af] text-sm">No settlement lines</div>
                  )}
                </div>
              )}
            </Card>
          ))
        ) : (
          <Card className="bg-[#1f2128] border-[#2d2d3a] p-6">
            <div className="text-center text-[#9ca3af]">No settlement periods yet</div>
          </Card>
        )}
      </div>
    </div>
  );
}