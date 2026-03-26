import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  RefreshCw,
  Filter,
  Download
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

export default function SquareReconciliation({ company_id }) {
  const [days, setDays] = useState('7');
  const [syncing, setSyncing] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['squareReconcile', company_id, days],
    queryFn: async () => {
      const response = await base44.functions.invoke('squareReconcile', {
        company_id,
        days: parseInt(days)
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000
  });

  const handleSyncMissing = async (paymentId) => {
    try {
      setSyncing(paymentId);
      // TODO: Call squareSync or similar to sync individual payment
      console.log(`Syncing payment ${paymentId}`);
      await refetch();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10b981] mx-auto"></div>
            <p className="text-sm text-slate-400">Loading reconciliation...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-900/30 bg-red-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Reconciliation Error</p>
              <p className="text-sm text-red-200 mt-1">{error.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = data?.summary || {};
  const matched = data?.matched || [];
  const missing = data?.missing || [];
  const orphaned = data?.orphaned || [];

  const healthColor = {
    healthy: 'text-green-500 bg-green-950/20',
    warning: 'text-orange-500 bg-orange-950/20',
    info: 'text-blue-500 bg-blue-950/20'
  }[summary.health] || 'text-slate-500';

  return (
    <div className="space-y-6">
      {/* Header + Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Square Reconciliation</h2>
          <p className="text-sm text-slate-400 mt-1">
            Compare Square payments vs. Mooadon transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          label="Match Rate"
          value={`${summary.match_rate_pct || 0}%`}
          color={summary.match_rate_pct >= 95 ? 'text-green-500' : 'text-orange-500'}
          icon={CheckCircle2}
        />
        <StatCard
          label="Revenue"
          value={`$${summary.total_square_revenue?.toFixed(2) || '0.00'}`}
          subtext={`${summary.square_payments || 0} payments`}
        />
        <StatCard
          label="Missing"
          value={summary.missing_count || 0}
          color={summary.missing_count > 0 ? 'text-red-500' : 'text-green-500'}
          subtext={`$${summary.missing_revenue?.toFixed(2) || '0.00'}`}
          icon={AlertCircle}
        />
        <StatCard
          label="Health"
          value={summary.health?.toUpperCase()}
          color={healthColor}
          icon={summary.health === 'healthy' ? CheckCircle2 : AlertCircle}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="missing" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800">
          <TabsTrigger value="missing">
            Missing <Badge variant="outline" className="ml-2">{missing.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="matched">
            Matched <Badge variant="outline" className="ml-2">{matched.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="orphaned">
            Orphaned <Badge variant="outline" className="ml-2">{orphaned.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Missing Payments */}
        <TabsContent value="missing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Unsynced Square Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {missing.length === 0 ? (
                <p className="text-center text-slate-400 py-6">All Square payments matched ✓</p>
              ) : (
                <div className="space-y-2">
                  {missing.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-red-900/20"
                    >
                      <div className="flex-1">
                        <p className="font-mono text-sm text-slate-300">
                          {item.square_payment_id.slice(0, 12)}...
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          ${item.square_amount.toFixed(2)} • {item.payment_method} •{' '}
                          {new Date(item.square_created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleSyncMissing(item.square_payment_id)}
                        disabled={syncing === item.square_payment_id}
                        size="sm"
                        className="gap-2"
                      >
                        {syncing === item.square_payment_id ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            Sync
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                  {missing.length > 0 && (
                    <Button
                      onClick={() => console.log('Sync all')}
                      variant="secondary"
                      className="w-full mt-4"
                    >
                      Sync All {missing.length} Missing
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Matched Payments */}
        <TabsContent value="matched">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Matched Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {matched.length === 0 ? (
                <p className="text-center text-slate-400 py-6">No matched payments yet</p>
              ) : (
                <div className="space-y-2">
                  {matched.slice(0, 10).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-mono text-sm text-slate-300">
                          {item.square_payment_id.slice(0, 12)}...
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          ${item.square_amount.toFixed(2)} → {item.mooadon_tokens} tokens
                        </p>
                      </div>
                      <Badge
                        variant={item.amount_match ? 'default' : 'outline'}
                        className={item.amount_match ? 'bg-green-900/30' : ''}
                      >
                        {item.amount_match ? '✓ Match' : '⚠ Delta'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orphaned */}
        <TabsContent value="orphaned">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Orphaned Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orphaned.length === 0 ? (
                <p className="text-center text-slate-400 py-6">No orphaned transactions</p>
              ) : (
                <div className="space-y-2">
                  {orphaned.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-800/50 rounded-lg border border-orange-900/20"
                    >
                      <p className="font-mono text-sm text-slate-300">
                        TX: {item.mooadon_tx_id.slice(0, 12)}...
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        ${item.mooadon_amount.toFixed(2)} • {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon, subtext }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">{label}</p>
            {Icon && <Icon className={`w-4 h-4 ${color}`} />}
          </div>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
        </div>
      </CardContent>
    </Card>
  );
}