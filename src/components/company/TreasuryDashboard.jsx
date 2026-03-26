import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Coins, 
  Wallet, 
  RefreshCw, 
  ExternalLink,
  TrendingUp,
  Database,
  Loader2
} from 'lucide-react';
import { toast } from "sonner";

export default function TreasuryDashboard({ companyId }) {
  const queryClient = useQueryClient();

  const { data: companyTokens, isLoading } = useQuery({
    queryKey: ['companyToken', companyId],
    queryFn: async () => {
      const tokens = await base44.entities.CompanyToken.filter({ company_id: companyId });
      return tokens;
    },
    enabled: !!companyId
  });

  // Mock additional tokens for display
  const allTokens = React.useMemo(() => {
    const results = companyTokens || [];
    
    // Add TECH token if not exists
    if (!results.find(t => t.token_symbol === 'TECH')) {
      results.push({
        token_symbol: 'TECH',
        token_name: 'Tech Points',
        treasury_balance: 850000,
        distributed_tokens: 150000,
        total_supply: 1000000,
        chain: 'avalanche_fuji',
        is_mock: true
      });
    }
    
    // Add LYL token if not exists
    if (!results.find(t => t.token_symbol === 'LYL')) {
      results.push({
        token_symbol: 'LYL',
        token_name: 'Loyalty Token',
        treasury_balance: 750000,
        distributed_tokens: 250000,
        total_supply: 1000000,
        chain: 'avalanche_fuji',
        is_mock: true
      });
    }
    
    return results;
  }, [companyTokens]);

  const syncMutation = useMutation({
    mutationFn: async (tokenId) => {
      const response = await base44.functions.invoke('syncTreasuryBalance', { 
        companyId,
        tokenId 
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companyToken', companyId] });
      toast.success(`Balance synced: ${data.data?.onchain_balance?.toLocaleString() || 0} tokens`);
    },
    onError: (error) => {
      toast.error('Sync failed: ' + (error.response?.data?.error || error.message));
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (!allTokens || allTokens.length === 0) {
    return (
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-8 text-center text-[#9ca3af]">
          <Coins className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No token configured</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#10b981]" />
          Token Treasury
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {allTokens.map((token, index) => {
          const explorerUrl = token.contract_address 
            ? `https://testnet.snowtrace.io/address/${token.contract_address}`
            : null;

          return (
            <Card key={token.id || index} className="bg-[#1f2128] border-[#2d2d3a]">
              <CardHeader className="p-3 border-b border-[#2d2d3a]">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-[#10b981]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{token.token_symbol}</p>
                      <p className="text-xs text-[#9ca3af]">{token.token_name}</p>
                    </div>
                  </div>
                  {!token.is_mock && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => syncMutation.mutate(token.id)}
                      disabled={syncMutation.isPending}
                      className="h-7 w-7 p-0"
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div>
                  <p className="text-xs text-[#9ca3af] mb-1">Treasury Balance</p>
                  <p className="text-xl font-bold text-white">
                    {token.treasury_balance?.toLocaleString() || 0}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[#9ca3af]">Distributed</p>
                    <p className="text-white font-semibold">
                      {token.distributed_tokens?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#9ca3af]">Supply</p>
                    <p className="text-white font-semibold">
                      {token.total_supply?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>

                {explorerUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(explorerUrl, '_blank')}
                    className="w-full text-xs h-7 border-[#2d2d3a] hover:bg-[#17171f]"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View on Explorer
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Label({ className, children }) {
  return <div className={className}>{children}</div>;
}