import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, ExternalLink, RefreshCw, Zap,
  TrendingUp, Fuel, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { format, subHours, subDays } from 'date-fns';
import GasWalletMonitor from '@/components/admin/GasWalletMonitor';

function explorerTxUrl(hash, network) {
  if (!hash) return null;
  return network === 'mainnet'
    ? `https://snowtrace.io/tx/${hash}`
    : `https://testnet.snowtrace.io/tx/${hash}`;
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-[#10b981]' }) {
  return (
    <Card className="bg-[#1a1f2e] border-[#2a2f3e]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-gray-400 text-xs">{label}</span>
        </div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }) {
  const map = {
    confirmed: 'bg-emerald-500',
    pending:   'bg-yellow-500 animate-pulse',
    failed:    'bg-red-500',
    skipped:   'bg-gray-500',
    none:      'bg-gray-600',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] || 'bg-gray-600'}`} />;
}

export default function OnchainActivityDashboard() {
  const { data: txData = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['onchainTransactions'],
    queryFn: async () => {
      const all = await base44.entities.Transaction.filter({});
      return all.filter(t => t.onchain_status && t.onchain_status !== 'none')
                .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    refetchInterval: 30_000,
  });

  const now = new Date();
  const cutoff24h = subHours(now, 24);
  const cutoff7d  = subDays(now, 7);

  const tx24h     = txData.filter(t => new Date(t.created_date) > cutoff24h);
  const tx7d      = txData.filter(t => new Date(t.created_date) > cutoff7d);
  const confirmed = txData.filter(t => t.onchain_status === 'confirmed');
  const failed    = txData.filter(t => t.onchain_status === 'failed');
  const last10    = txData.slice(0, 10);

  const uniqueWallets24h = new Set(
    tx24h.filter(t => t.onchain_status === 'confirmed').map(t => t.client_phone)
  ).size;

  const totalGas = confirmed.reduce((sum, t) => {
    const g = t.metadata?.gas_used;
    return sum + (g ? Number(g) : 0);
  }, 0);

  const activeMerchants = new Set(
    tx7d.filter(t => t.onchain_status === 'confirmed').map(t => t.company_id)
  ).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-[#10b981]" />
          <h2 className="text-white text-xl font-bold">Onchain Activity</h2>
          <Badge variant="outline" className="border-[#3a3f4e] text-gray-400 text-xs">Live</Badge>
        </div>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white gap-2"
          onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <GasWalletMonitor compact />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Zap} label="Transactions (24h)"
          value={isLoading ? '…' : tx24h.length}
          sub={`${tx24h.filter(t => t.onchain_status === 'confirmed').length} confirmed`}
        />
        <StatCard
          icon={TrendingUp} label="Transactions (7d)"
          value={isLoading ? '…' : tx7d.length}
          sub={`${uniqueWallets24h} unique wallets (24h)`}
          color="text-blue-400"
        />
        <StatCard
          icon={Activity} label="Active Merchants (7d)"
          value={isLoading ? '…' : activeMerchants}
          sub={`${confirmed.length} confirmed all-time`}
          color="text-purple-400"
        />
        <StatCard
          icon={Fuel} label="Total Gas Used"
          value={isLoading ? '…' : totalGas > 0 ? totalGas.toLocaleString() : '—'}
          sub="gas units (confirmed txs)"
          color="text-yellow-400"
        />
      </div>

      {txData.length > 0 && (
        <Card className="bg-[#1a1f2e] border-[#2a2f3e]">
          <CardContent className="p-4">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-gray-300">
                  {confirmed.length} confirmed
                  <span className="text-gray-500 ml-1">
                    ({txData.length > 0 ? Math.round(confirmed.length / txData.length * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-gray-300">{failed.length} failed</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span className="text-gray-300">
                  {txData.filter(t => t.onchain_status === 'pending').length} pending
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <GasWalletMonitor />

      <Card className="bg-[#1a1f2e] border-[#2a2f3e]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Last 10 Onchain Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : last10.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No onchain transactions yet.</p>
              <p className="text-xs mt-1">Transactions will appear here once tokens are minted on-chain.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {last10.map((tx) => {
                const hash = tx.tx_hash || tx.blockchain_tx_hash;
                const net  = tx.network || 'fuji';
                const url  = explorerTxUrl(hash, net);
                return (
                  <div key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#0f1420] border border-[#2a2f3e] hover:border-[#3a3f4e] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusDot status={tx.onchain_status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-mono truncate max-w-[120px]">
                            {hash ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : tx.id.slice(0, 12) + '…'}
                          </span>
                          <Badge variant="outline" className="text-xs border-[#3a3f4e] text-gray-400 shrink-0">
                            {net}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {tx.tokens_actual || tx.tokens_expected || '?'} tokens
                          {tx.metadata?.gas_used && ` · ${Number(tx.metadata.gas_used).toLocaleString()} gas`}
                          {' · '}
                          {tx.created_date ? format(new Date(tx.created_date), 'MMM d, HH:mm') : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${
                        tx.onchain_status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-300' :
                        tx.onchain_status === 'failed'    ? 'bg-red-500/20 text-red-300' :
                        tx.onchain_status === 'pending'   ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {tx.onchain_status}
                      </Badge>
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="text-[#10b981] hover:text-emerald-300 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}