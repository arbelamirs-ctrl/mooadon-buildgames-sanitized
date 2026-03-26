import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, CheckCircle, AlertCircle, ExternalLink, Database, Link as LinkIcon } from 'lucide-react';
import { getChainAdapter, CHAIN_CONFIG } from '@/components/services/chainAdapter';
import { toast } from "sonner";

export default function SyncBalance({ client, company, onSynced }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const queryClient = useQueryClient();
  const chainConfig = CHAIN_CONFIG[company.wallet_chain];

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const adapter = getChainAdapter(company.wallet_chain);
      
      // Execute sync
      const result = await adapter.syncToBlockchain(
        client,
        client.current_balance || 0,
        company.token_contract
      );

      setSyncResult(result);

      if (result.synced) {
        // Update client record with on-chain balance
        await base44.entities.Client.update(client.id, {
          onchain_balance: result.onchainBalance || client.current_balance,
          last_sync: new Date().toISOString()
        });

        toast.success('Sync completed successfully!');
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        
        if (onSynced) onSynced(result);
      } else {
        toast.error(`Sync error: ${result.reason}`);
      }

    } catch (error) {
      console.error('Sync error:', error);
      setSyncResult({
        synced: false,
        reason: 'error',
        error: error.message
      });
      toast.error('Sync error');
    } finally {
      setSyncing(false);
    }
  };

  if (!chainConfig) {
    return null;
  }

  if (!client.wallet_address) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            <p>Client has no wallet - sync unavailable</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dbBalance = client.current_balance || 0;
  const onchainBalance = client.onchain_balance || 0;
  const lastSync = client.last_sync ? new Date(client.last_sync) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LinkIcon className="w-5 h-5" />
          Blockchain Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-600">Database</span>
            </div>
            <p className="text-xl font-bold text-slate-900">
              {dbBalance.toLocaleString()}
            </p>
          </div>

          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
            <div className="flex items-center gap-2 mb-1">
              <LinkIcon className="w-4 h-4 text-indigo-600" />
              <span className="text-xs text-indigo-600">Blockchain</span>
            </div>
            <p className="text-xl font-bold text-indigo-900">
              {onchainBalance.toLocaleString()}
            </p>
          </div>
        </div>

        {lastSync && (
          <div className="text-xs text-slate-500 text-center">
            Last sync: {lastSync.toLocaleString()}
          </div>
        )}

        {syncResult && (
          <div className={`rounded-lg p-3 border ${
            syncResult.synced 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-start gap-2">
              {syncResult.synced ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium text-sm ${
                  syncResult.synced ? 'text-emerald-800' : 'text-amber-800'
                }`}>
                  {syncResult.synced ? 'Synced successfully' : 'Requires attention'}
                </p>
                <p className={`text-xs mt-1 ${
                  syncResult.synced ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {syncResult.reason === 'already_synced' && 'Balances already in sync'}
                  {syncResult.reason === 'minted_difference' && `Minted ${syncResult.amount} tokens`}
                  {syncResult.reason === 'blockchain_disabled' && 'Blockchain not enabled'}
                  {syncResult.reason === 'no_wallet' && 'No wallet connected'}
                  {syncResult.reason === 'onchain_exceeds_db' && 'On-chain balance exceeds database'}
                  {syncResult.reason === 'error' && syncResult.error}
                </p>
                {syncResult.txHash && (
                  <a
                    href={`${chainConfig.explorer}/tx/${syncResult.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View Transaction
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="flex-1"
            variant="outline"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 ml-2" />
                Sync Now
              </>
            )}
          </Button>
          <Badge variant="outline" className="text-xs">
            {chainConfig.name}
          </Badge>
        </div>

        {company.auto_sync_enabled && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 flex items-center gap-2">
            <CheckCircle className="w-3 h-3" />
            <span>Auto-sync enabled</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}