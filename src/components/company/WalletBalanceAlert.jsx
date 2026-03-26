import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from 'lucide-react';

export default function WalletBalanceAlert({ companyId }) {
  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => base44.entities.Company.get(companyId),
    enabled: !!companyId
  });

  const { data: balance } = useQuery({
    queryKey: ['wallet-balance', company?.blockchain_wallet_address],
    queryFn: async () => {
      if (!company?.blockchain_wallet_address) return null;
      
      try {
        const response = await fetch(`https://api.avax-test.network/ext/bc/C/rpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [company.blockchain_wallet_address, 'latest']
          })
        });
        
        const data = await response.json();
        if (data.result) {
          // Convert hex to decimal and divide by 10^18 to get AVAX
          const balanceInWei = parseInt(data.result, 16);
          const balanceInAVAX = balanceInWei / 1e18;
          return balanceInAVAX;
        }
        return 0;
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        return 0;
      }
    },
    enabled: !!company?.blockchain_wallet_address,
    refetchInterval: 60000 // Refresh every minute
  });

  if (!company?.blockchain_wallet_address || balance === null || balance === undefined) {
    return null;
  }

  // Show alert if balance is below 0.1 AVAX
  if (balance < 0.1) {
    return (
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-400">Low AVAX Balance Warning</h3>
              <p className="text-sm text-red-300 mt-1">
                Your company wallet has {balance.toFixed(4)} AVAX. You need AVAX to pay for blockchain transaction fees (gas).
                Transactions may fail without sufficient AVAX.
              </p>
              <div className="mt-3 space-y-2">
                <p className="text-sm text-red-200">
                  <strong>Wallet Address:</strong>
                  <span className="font-mono text-xs ml-2 break-all">{company.blockchain_wallet_address}</span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-400 text-red-400 hover:bg-red-500/20"
                  onClick={() => window.open('https://faucet.avax.network/', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Get Free AVAX from Testnet Faucet
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}