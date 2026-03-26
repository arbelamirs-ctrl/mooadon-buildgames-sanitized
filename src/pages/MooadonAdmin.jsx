import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Building2, Wallet, Send, ArrowRight, Package, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import TreasuryReconciliation from '../components/mooadon/TreasuryReconciliation';

const MOOADON_TREASURY = '0xFA9b000dF91BfAC4925151070018aE8A13C52a38';

export default function MooadonAdmin() {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [amount, setAmount] = useState('');
  const queryClient = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ['all-companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: companyTokens = [] } = useQuery({
    queryKey: ['all-company-tokens'],
    queryFn: () => base44.entities.CompanyToken.list(),
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['all-clients'],
    queryFn: () => base44.entities.Client.list(),
  });

  const distributeMutation = useMutation({
    mutationFn: async ({ companyId, amount }) => {
      const response = await base44.functions.invoke('distributeTokensToCompany', {
        companyId,
        amount: parseFloat(amount)
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tokens distributed successfully');
      queryClient.invalidateQueries({ queryKey: ['all-company-tokens'] });
      setSelectedCompany(null);
      setAmount('');
    },
    onError: (error) => {
      toast.error(error.message || 'Error distributing tokens');
    },
  });

  const handleDistribute = () => {
    if (!selectedCompany || !amount || parseFloat(amount) <= 0) {
      toast.error('Please enter all fields');
      return;
    }
    distributeMutation.mutate({ companyId: selectedCompany.id, amount });
  };

  const getTotalDistributed = () => {
    return companyTokens.reduce((sum, token) => sum + (token.distributed_tokens || 0), 0);
  };

  const getTotalTreasury = () => {
    return companyTokens.reduce((sum, token) => sum + (token.treasury_balance || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Mooadon Management</h1>
        <p className="text-sm text-[#9ca3af] mt-1">Distribution of tokens to companies</p>
      </div>

      <Tabs defaultValue="distribution" className="w-full">
        <TabsList className="bg-[#1f2128] border-[#2d2d3a]">
          <TabsTrigger value="distribution" className="data-[state=active]:bg-[#10b981] data-[state=active]:text-white">
            <Coins className="w-4 h-4 mr-2" />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="data-[state=active]:bg-[#10b981] data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Treasury Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="distribution" className="space-y-6 mt-6">
          {/* Mooadon Treasury Info */}
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="p-4 border-b border-[#2d2d3a]">
          <CardTitle className="flex items-center gap-2 text-white text-sm font-semibold">
            <Wallet className="w-4 h-4 text-[#10b981]" />
            Main Mooadon Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="bg-[#17171f] rounded-lg p-3">
            <p className="text-xs text-[#9ca3af] mb-2">Wallet Address</p>
            <code className="text-xs text-[#10b981] break-all">{MOOADON_TREASURY}</code>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-3.5 h-3.5 text-[#10b981]" />
                <p className="text-xs text-[#9ca3af]">Total Supply</p>
              </div>
              <p className="text-xl font-semibold text-white">1,000,000</p>
              <p className="text-xs text-[#9ca3af] mt-1">MLT Tokens</p>
            </div>

            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-3.5 h-3.5 text-[#10b981]" />
                <p className="text-xs text-[#9ca3af]">To Companies</p>
              </div>
              <p className="text-xl font-semibold text-white">{(getTotalTreasury() || 0).toLocaleString()}</p>
              <p className="text-xs text-[#9ca3af] mt-1">Treasury Balance</p>
            </div>

            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-3.5 h-3.5 text-[#10b981]" />
                <p className="text-xs text-[#9ca3af]">To Customers</p>
              </div>
              <p className="text-xl font-semibold text-white">{(getTotalDistributed() || 0).toLocaleString()}</p>
              <p className="text-xs text-[#9ca3af] mt-1">To End Users</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companies Grid */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#10b981]" />
          Companies in System
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => {
            const token = companyTokens.find(t => t.company_id === company.id);
            return (
              <Card key={company.id} className="bg-[#1f2128] border-[#2d2d3a] hover:border-[#10b981] transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    {company.logo_url ? (
                      <img src={company.logo_url} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-white text-sm">{company.name}</h3>
                      <p className="text-xs text-[#9ca3af]">{token ? token.token_symbol : 'Not set'}</p>
                    </div>
                  </div>

                  {token ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Treasury:</span>
                        <span className="text-white font-medium">{(token.treasury_balance || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Distributed:</span>
                        <span className="text-purple-400 font-medium">{(token.distributed_tokens || 0).toLocaleString()}</span>
                      </div>
                      <Button
                        onClick={() => setSelectedCompany(company)}
                        className="w-full bg-[#10b981] hover:bg-[#059669] text-white mt-2"
                        size="sm"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Distribute Tokens
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-[#9ca3af]">No Token</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-6">
          {companyTokens.length > 0 ? (
            <TreasuryReconciliation 
              companyToken={companyTokens[0]} 
              clients={allClients}
            />
          ) : (
            <Card className="bg-[#1f2128] border-[#2d2d3a]">
              <CardContent className="py-12 text-center">
                <p className="text-[#9ca3af]">No company tokens found for reconciliation</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Distribution Dialog */}
      <Dialog open={!!selectedCompany} onOpenChange={(open) => !open && setSelectedCompany(null)}>
        <DialogContent className="bg-[#1f2128] border-[#2d2d3a]">
          <DialogHeader>
            <DialogTitle className="text-white">Token Distribution to {selectedCompany?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-[#9ca3af] mb-2 block">Token Amount</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount..."
                className="bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>

            <div className="bg-[#17171f] rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <ArrowRight className="w-4 h-4 text-[#10b981]" />
                <p className="text-sm text-white">Distribution Summary</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">Mooadon Wallet:</span>
                  <code className="text-xs text-[#10b981]">{MOOADON_TREASURY.slice(0, 10)}...</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">To Company:</span>
                  <span className="text-white">{selectedCompany?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">Amount:</span>
                  <span className="text-[#10b981] font-bold">{amount || '0'} MLT</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleDistribute}
              disabled={distributeMutation.isPending}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white"
            >
              {distributeMutation.isPending ? 'Distributing...' : 'Confirm Distribution'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}