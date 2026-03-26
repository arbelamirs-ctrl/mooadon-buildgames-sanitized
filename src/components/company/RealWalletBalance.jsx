import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function RealWalletBalance({ companyId }) {
  const { data: company } = useQuery({
    queryKey: ['company-wallet', companyId],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: companyId });
      return companies[0];
    },
    enabled: !!companyId
  });

  const { data: balance, isLoading } = useQuery({
    queryKey: ['wallet-balance', company?.blockchain_wallet_address],
    queryFn: async () => {
      if (!company?.blockchain_wallet_address) return null;

      const rpcUrl = 'https://api.avax-test.network/ext/bc/C/rpc';
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [company.blockchain_wallet_address, 'latest'],
          id: 1
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      // Convert Wei to AVAX
      const balanceWei = BigInt(data.result);
      const balanceAvax = Number(balanceWei) / 1e18;
      
      return balanceAvax;
    },
    enabled: !!company?.blockchain_wallet_address,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (!company?.blockchain_wallet_address) return null;

  const walletAddress = company.blockchain_wallet_address;
  const explorerUrl = `https://testnet.snowtrace.io/address/${walletAddress}`;

  return (
    <Card className="bg-[#1f2128] border-[#2d2d3a]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                Treasury Wallet
                {balance !== null && balance < 0.1 && (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                    Low Balance
                  </Badge>
                )}
              </h3>
              <p className="text-slate-400 text-sm mb-2 font-mono break-all">
                {walletAddress}
              </p>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-slate-500">AVAX Balance (Testnet)</p>
                  {isLoading ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span className="text-slate-400 text-sm">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-white mt-1">
                      {balance !== null ? balance.toFixed(4) : '0.0000'} AVAX
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <a 
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
        
        {balance !== null && balance < 0.1 && (
          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 text-sm font-medium">Low AVAX Balance</p>
                <p className="text-yellow-400/80 text-xs mt-1">
                  You need AVAX to pay for blockchain transactions. Get free testnet AVAX from the{' '}
                  <a 
                    href="https://faucet.avax.network/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-300"
                  >
                    Avalanche Faucet
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}