import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Link as LinkIcon, RefreshCw, AlertCircle, ExternalLink, ArrowDownUp } from 'lucide-react';
import { getChainAdapter, CHAIN_CONFIG } from '@/components/services/chainAdapter';
import { addTokenToWallet } from '@/components/blockchain/Web3Helper';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function OnchainBalanceCard({ company, totalBalance, companyToken }) {
  const [onchainBalance, setOnchainBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(true);

  const chainConfig = company?.wallet_chain ? CHAIN_CONFIG[company.wallet_chain] : null;
  const isBlockchainEnabled = company?.wallet_chain && company.wallet_chain !== 'none';

  const fetchOnchainBalance = async () => {
    if (!isBlockchainEnabled || !company.wallet_address) return;
    
    if (!company.token_contract) {
      toast.error('Token contract address not defined');
      return;
    }
    
    setLoading(true);
    try {
      const adapter = getChainAdapter(company.wallet_chain);
      const balance = await adapter.getOnchainBalance(
        company.wallet_address,
        company.token_contract
      );
      setOnchainBalance(balance);
      
      // Compare on-chain balance with treasury balance (in tokens, not stars)
      const dbTreasuryBalance = companyToken?.treasury_balance || 0;
      setSynced(Math.abs(balance - dbTreasuryBalance) < 0.01);
    } catch (error) {
      console.error('Failed to fetch onchain balance:', error);
      toast.error('Error retrieving balance blockchain');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToken = async () => {
    if (!company.token_contract) {
      toast.error('Token contract address not defined');
      return;
    }
    
    await addTokenToWallet(
      company.token_contract,
      company.points_name || 'PTS',
      18
    );
  };

  const handleSyncBalance = async () => {
    if (!company || !companyToken) {
      toast.error('Missing company or token data');
      return;
    }
    
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncTreasuryBalance', { 
        companyId: company.id 
      });
      
      if (response.data.success) {
        toast.success('Balance successfully synced!');
        await fetchOnchainBalance();
        // Refresh page data
        window.location.reload();
      } else {
        toast.error(response.data.error || 'Synchronization error');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Balance sync error');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (isBlockchainEnabled && company.auto_sync_enabled) {
      fetchOnchainBalance();
    }
  }, [company]);

  if (!isBlockchainEnabled) {
    return null;
  }

  return (
    <Card className="border-slate-800 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <LinkIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">Blockchain Balances</h3>
              {chainConfig && (
                <Badge variant="outline" className="text-xs mt-1 border-indigo-500/30 text-indigo-300">
                  {chainConfig.name}
                </Badge>
              )}
            </div>
          </div>
          <Button
            onClick={fetchOnchainBalance}
            disabled={loading}
            size="sm"
            variant="ghost"
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Treasury balance(DB)</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {(companyToken?.treasury_balance || 0).toLocaleString()} MLT
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {totalBalance.toLocaleString()} Stars
            </p>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-3 border border-indigo-800/50">
            <div className="flex items-center gap-2 mb-2">
              <LinkIcon className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-indigo-300">On-chain</span>
            </div>
            <p className="text-2xl font-bold text-indigo-300">
              {loading ? '...' : onchainBalance.toLocaleString()}
            </p>
          </div>
        </div>

        {!synced && !loading && (
          <div className="mt-3 flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-amber-300">
               There is a difference between the balances -  need to Synchronization.
              </p>
            </div>
            <Button
              onClick={handleSyncBalance}
              disabled={syncing}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-6 px-2"
            >
              {syncing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <ArrowDownUp className="w-3 h-3 mr-1" />
                  Synchronize
                </>
              )}
            </Button>
          </div>
        )}

        {company.auto_sync_enabled && (
          <div className="mt-3 text-center">
            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
             Automatic sync is enabled.
            </Badge>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            onClick={handleAddToken}
            variant="outline"
            size="sm"
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
              Add token to-MetaMask
          </Button>
          {company.token_contract && chainConfig && (
            <a
              href={`${chainConfig.explorer}/address/${company.token_contract}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}