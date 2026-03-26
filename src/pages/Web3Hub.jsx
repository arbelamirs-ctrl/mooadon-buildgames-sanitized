import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Coins, Vote, ShoppingBag, Loader2, RefreshCw, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Staking from '@/components/web3/Staking';
import DAO from '@/components/web3/DAO';
import NFTMarketplace from '@/components/web3/NFTMarketplace';
import TokenBurning from '@/components/web3/TokenBurning';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import TreasuryCard from '@/components/company/TreasuryCard';
import CompanySelector from '@/components/company/CompanySelector';
import AvaxPriceTicker from '@/components/AvaxPriceTicker';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Web3Hub() {
  const { user, primaryCompanyId, loading: permissionsLoading } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('staking');
  const [onChainBalance, setOnChainBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', primaryCompanyId],
    queryFn: () => base44.entities.Client.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId,
  });

  const { data: company, refetch: refetchCompany } = useQuery({
    queryKey: ['company', primaryCompanyId],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: primaryCompanyId });
      return companies[0];
    },
    enabled: !!primaryCompanyId,
  });

  const { data: companyToken, isLoading: tokenLoading } = useQuery({
    queryKey: ['companyToken', primaryCompanyId],
    queryFn: async () => {
      const tokens = await base44.entities.CompanyToken.filter({ company_id: primaryCompanyId });
      console.log('🔍 CompanyToken query result:', tokens);
      return tokens?.[0];
    },
    enabled: !!primaryCompanyId
  });

  // For demo, use first client or create mock
  const client = clients[0] || {
    id: 'demo',
    current_balance: 10000,
    total_earned: 15000,
    wallet_address: '0x1234...5678'
  };

  // Fetch on-chain balance via backend function
  const getOnChainBalance = async (walletAddress) => {
    try {
      const response = await base44.functions.invoke('getOnChainBalance', {
        wallet_address: walletAddress,
        company_id: primaryCompanyId
      });
      return response.data.balance;
    } catch (error) {
      console.error('Error fetching on-chain balance:', error);
      return null;
    }
  };

  // Load on-chain balance
  useEffect(() => {
    if (client?.wallet_address && companyToken?.contract_address) {
      setLoadingBalance(true);
      getOnChainBalance(client.wallet_address).then(balance => {
        setOnChainBalance(balance);
        setLoadingBalance(false);
      });
    }
  }, [client?.wallet_address, companyToken?.contract_address]);

  // Sync balance mutation
  const syncBalanceMutation = useMutation({
    mutationFn: async () => {
      const balance = await getOnChainBalance(client.wallet_address);
      if (balance !== null && client.id !== 'demo') {
        await base44.entities.Client.update(client.id, {
          onchain_balance: parseFloat(balance),
          last_sync: new Date().toISOString()
        });
      }
      return balance;
    },
    onSuccess: (balance) => {
      setOnChainBalance(balance);
      queryClient.invalidateQueries(['clients']);
      toast.success('Balance synced successfully');
    },
    onError: (error) => {
      toast.error('Failed to sync balance: ' + error.message);
    }
  });

  const balanceMismatch = onChainBalance !== null && 
    Math.abs(parseFloat(onChainBalance) - (client?.onchain_balance || 0)) > 0.01;

  const { data: priceHistory = [] } = useQuery({
    queryKey: ['priceHistory', primaryCompanyId],
    queryFn: async () => {
      const data = await base44.entities.PriceHistory.filter({ company_id: primaryCompanyId }, '-timestamp', 10);
      return data;
    },
    enabled: !!primaryCompanyId,
    refetchInterval: 300000,
  });

  if (permissionsLoading || tokenLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!user || !primaryCompanyId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-slate-400">No company access</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Web3 Hub</h1>
          <p className="text-sm text-[#9ca3af] mt-1">Token Treasury & Blockchain</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'super_admin') && <CompanySelector />}
      </div>

      {/* Live AVAX Price Card */}
      {primaryCompanyId && (
        <Card className="bg-gradient-to-br from-teal-500/10 to-cyan-500/5 border-teal-500/30">
          <div className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Live AVAX Price</h2>
                <p className="text-slate-400 text-sm">Real-time Chainlink price feed</p>
              </div>
              <AvaxPriceTicker companyId={primaryCompanyId} showDetail={true} />
            </div>
          </div>
        </Card>
      )}

      {/* Treasury Card */}
      <TreasuryCard companyToken={companyToken} company={company} />

      {/* Wallet Balance Card with AVAX Conversion */}
      {client && client.id !== 'demo' && (
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Client Balance</h2>
                <p className="text-slate-400">Database vs Blockchain</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm mb-2">Database Balance</p>
                <p className="text-2xl font-bold text-white">
                  {client.current_balance?.toLocaleString() || 0} {companyToken?.token_symbol || 'Tokens'}
                </p>
              </div>

              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-sm flex items-center gap-1">
                    On-Chain Balance
                    {balanceMismatch && <AlertCircle className="w-3 h-3 text-yellow-400" />}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => syncBalanceMutation.mutate()}
                    disabled={syncBalanceMutation.isPending || loadingBalance}
                    className="h-6 w-6 p-0"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncBalanceMutation.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-2xl font-bold text-teal-400">
                  {loadingBalance ? (
                    <span className="text-slate-500">Loading...</span>
                  ) : onChainBalance !== null ? (
                    <>
                      {parseFloat(onChainBalance).toLocaleString()} {companyToken?.token_symbol || 'Tokens'}
                    </>
                  ) : (
                    <span className="text-slate-500">Not available</span>
                  )}
                </p>
                {balanceMismatch && (
                  <Badge variant="outline" className="mt-2 text-yellow-400 border-yellow-400">
                    Out of sync
                  </Badge>
                )}
              </div>
            </div>

            {client.wallet_address && (
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-400">Wallet Address</p>
                <p className="text-xs font-mono text-slate-300 break-all">{client.wallet_address}</p>
              </div>
            )}
            </div>
            </Card>
            )}

            {/* Price History Table */}
            {priceHistory.length > 0 && (
            <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <div className="p-4 border-b border-[#2d2d3a]">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              Price History
            </h3>
            </div>
            <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
            {priceHistory.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-xs bg-slate-800/30 p-2 rounded border border-slate-700">
                <div className="flex-1">
                  <p className="text-slate-300">{format(new Date(entry.timestamp), 'HH:mm:ss')}</p>
                  <p className="text-slate-500 text-[10px]">{entry.source}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-mono">${entry.price_usd.toFixed(2)}</p>
                  <p className="text-teal-400 text-[10px]">₪{entry.price_ils.toFixed(2)}</p>
                </div>
              </div>
            ))}
            </div>
            </Card>
            )}

            {/* Token Burning */}
            {companyToken && client && (
            <TokenBurning client={client} companyToken={companyToken} />
            )}

      {/* Simple Wallet Info */}
      <Card className="bg-[#1f2128] border-[#2d2d3a] p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Coins className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Wallet Status</h2>
              <p className="text-slate-400">Blockchain connection</p>
            </div>
          </div>

          {company?.wallet_chain && company.wallet_chain !== 'none' ? (
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400">Network</span>
                <span className="text-white font-medium">{company.wallet_chain}</span>
              </div>
              {company.wallet_address && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Address</span>
                  <code className="text-slate-300 text-sm bg-slate-900 px-2 py-1 rounded">
                    {company.wallet_address.substring(0, 8)}...{company.wallet_address.slice(-6)}
                  </code>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-6 text-center">
                <p className="text-amber-400 mb-4">
                  Not connected to blockchain
                </p>
                <Button
                  onClick={async () => {
                    try {
                      await base44.entities.Company.update(primaryCompanyId, {
                        wallet_chain: 'avalanche_fuji'
                      });
                      await refetchCompany();
                    } catch (error) {
                      console.error('Error updating company:', error);
                    }
                  }}
                  className="bg-yellow-400 hover:bg-yellow-500 text-slate-900"
                >
                  Connect to Avalanche Fuji
                </Button>
                <p className="text-slate-400 text-sm mt-3">
                  Click to connect to the Avalanche test network
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}