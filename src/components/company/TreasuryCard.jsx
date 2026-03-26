import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Coins, 
  Wallet, 
  TrendingUp, 
  Package,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

function getTokenExplorerUrl(address, chain) {
  const isMainnet = chain === 'avalanche' || chain === 'mainnet';
  const base = isMainnet ? 'https://snowtrace.io/address' : 'https://testnet.snowtrace.io/address';
  return `${base}/${address}`;
}

export default function TreasuryCard({ companyToken, company }) {
  const queryClient = useQueryClient();

  const syncBalanceMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('syncTreasuryBalance', {
        companyId: company?.id
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companyToken'] });
      toast.success(`Treasury synced: ${data.data.onchain_balance.toLocaleString()} MLT`);
    },
    onError: (error) => {
      toast.error('Failed to sync balance: ' + error.message);
    }
  });

  if (!companyToken) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-white mb-2">No Token Treasury</h3>
            <p className="text-slate-400 text-sm mb-4">
              Setup your company token to enable Web3 rewards
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const supplyPercentage = ((companyToken.distributed_tokens / companyToken.total_supply) * 100).toFixed(2);

  return (
    <Card className="border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Coins className="w-5 h-5 text-yellow-400" />
            Token Treasury
          </CardTitle>
          <Button
            onClick={() => syncBalanceMutation.mutate()}
            disabled={syncBalanceMutation.isPending}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {syncBalanceMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Balance
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Token Info */}
        <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Token</span>
            <span className="font-bold text-white">
              {companyToken.token_name} ({companyToken.token_symbol})
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Network</span>
            <span className="text-sm text-indigo-400">
              ⛓️ {companyToken.chain === 'avalanche_fuji' ? 'Avalanche Fuji' : companyToken.chain}
            </span>
          </div>
        </div>

        {/* Supply Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-blue-300">Total Supply</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {(companyToken.total_supply || 0).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">MLT Tokens</p>
          </div>

          <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-emerald-300">Treasury</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {(companyToken.treasury_balance || 0).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">In Wallet</p>
          </div>

          <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <p className="text-xs text-purple-300">Distributed</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {(companyToken.distributed_tokens || 0).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">To Clients</p>
          </div>
        </div>

        {/* Distribution Progress */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Distribution Progress</p>
            <span className="text-sm font-semibold text-purple-400">{supplyPercentage}%</span>
          </div>
          <div className="bg-slate-900 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all flex items-center justify-end pr-2"
              style={{ width: `${Math.min(parseFloat(supplyPercentage), 100)}%` }}
            >
              {parseFloat(supplyPercentage) > 10 && (
                <span className="text-[10px] font-bold text-white drop-shadow">
                  {(companyToken.distributed_tokens || 0).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>0</span>
            <span>{(companyToken.total_supply || 0).toLocaleString()} MLT</span>
          </div>
        </div>

        {/* Contract Address */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-2">Token Contract Address</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-indigo-300 flex-1 truncate" dir="ltr">
              {companyToken.contract_address}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(companyToken.contract_address)}
              className="text-slate-400 hover:text-white"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(getTokenExplorerUrl(companyToken.contract_address, companyToken.chain), '_blank')}
              className="text-slate-400 hover:text-white"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Treasury Wallet */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-2">Treasury Wallet Address</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-indigo-300 flex-1 truncate" dir="ltr">
              {companyToken.treasury_wallet}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(companyToken.treasury_wallet)}
              className="text-slate-400 hover:text-white"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(getTokenExplorerUrl(companyToken.treasury_wallet, companyToken.chain), '_blank')}
              className="text-slate-400 hover:text-white"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Warning if low balance */}
        {companyToken.treasury_balance < (companyToken.total_supply * 0.1) && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            <p className="text-xs text-red-300">
              ⚠️ Treasury balance is low ({supplyPercentage}% distributed)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}