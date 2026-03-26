import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2, XCircle, Fuel, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function GasWalletMonitor({ compact = false }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['gasWalletInfo'],
    queryFn: () => base44.functions.invoke('getGasWalletInfo', {}),
    refetchInterval: 60_000,
    retry: 2,
  });

  const info = data?.data || data;

  const healthConfig = {
    ok:       { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2, badge: 'bg-emerald-500/20 text-emerald-300', label: 'Healthy' },
    warning:  { color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30',  icon: AlertTriangle, badge: 'bg-yellow-500/20 text-yellow-300',  label: 'Low Balance' },
    critical: { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',        icon: XCircle,       badge: 'bg-red-500/20 text-red-300',        label: 'Critical' },
    error:    { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',        icon: XCircle,       badge: 'bg-red-500/20 text-red-300',        label: 'Error' },
  };

  const cfg = healthConfig[info?.health] || healthConfig.ok;
  const Icon = cfg.icon;

  if (isLoading) {
    return (
      <Card className="bg-[#1a1f2e] border-[#2a2f3e]">
        <CardContent className="p-4 flex items-center gap-2 text-gray-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Checking gas wallet...</span>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    if (!info || info.health === 'ok') return null;
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${cfg.bg} mb-4`}>
        <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
        <span className={`text-sm font-medium ${cfg.color}`}>{info.health_message}</span>
        {info.snowtrace_url && (
          <a href={info.snowtrace_url} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-xs text-gray-400 hover:text-white flex items-center gap-1">
            Explorer <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  return (
    <Card className="bg-[#1a1f2e] border-[#2a2f3e]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Fuel className="w-4 h-4 text-[#10b981]" />
            Gas Wallet
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${cfg.badge}`}>{cfg.label}</Badge>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-400 hover:text-white"
              onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {info?.health !== 'ok' && (
          <div className={`flex items-start gap-2 p-3 rounded-lg border ${cfg.bg}`}>
            <Icon className={`w-4 h-4 ${cfg.color} mt-0.5 flex-shrink-0`} />
            <p className={`text-sm ${cfg.color}`}>{info?.health_message}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Balance</span>
          <span className={`text-xl font-bold ${cfg.color}`}>
            {info?.balance_avax ?? '—'} AVAX
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Warning threshold</span>
            <span className="text-yellow-400">{info?.threshold_warning} AVAX</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Critical threshold</span>
            <span className="text-red-400">{info?.threshold_critical} AVAX</span>
          </div>
        </div>

        <div className="pt-2 border-t border-[#2a2f3e] space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Network</span>
            <Badge variant="outline" className="text-xs border-[#3a3f4e] text-gray-300">
              {info?.network === 'mainnet' ? '🔴 Mainnet' : '🟡 Fuji Testnet'}
            </Badge>
          </div>
          {info?.address && (
            <div className="flex justify-between text-xs items-center">
              <span className="text-gray-500">Address</span>
              <a href={info.snowtrace_url} target="_blank" rel="noopener noreferrer"
                className="text-[#10b981] hover:underline flex items-center gap-1">
                {info.address.slice(0, 6)}…{info.address.slice(-4)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {info?.checked_at && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Last checked</span>
              <span className="text-gray-400">{new Date(info.checked_at).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        <div className={`flex items-center gap-2 p-2 rounded text-xs ${
          info?.can_transact ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {info?.can_transact
            ? <><CheckCircle2 className="w-3 h-3" /> Transactions enabled</>
            : <><XCircle className="w-3 h-3" /> Transactions blocked — insufficient gas</>
          }
        </div>
      </CardContent>
    </Card>
  );
}