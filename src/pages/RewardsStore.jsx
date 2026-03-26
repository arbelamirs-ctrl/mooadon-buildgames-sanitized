import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, Coins, Award, Sparkles, CheckCircle, Loader2, ArrowLeft, Search, ArrowRight } from 'lucide-react';
import { toast } from "sonner";
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function RewardsStore() {
  const navigate = useNavigate();
  const { primaryCompanyId, loading: permissionsLoading, user } = useUserPermissions();
  const [showTemplates, setShowTemplates] = useState(true);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const queryClient = useQueryClient();
  const companyId = primaryCompanyId;

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const filteredClients = clients.filter(c => {
    if (!clientSearch) return true;
    const s = clientSearch.toLowerCase();
    return (c.full_name && c.full_name.toLowerCase().includes(s)) ||
           (c.phone && c.phone.includes(clientSearch)) ||
           (c.email && c.email.toLowerCase().includes(s));
  });

  const client = clients.find(c => c.id === selectedClientId) || clients[0];

  const { data: rewardItems = [] } = useQuery({
    queryKey: ['reward-items', companyId],
    queryFn: () => base44.entities.RewardItem.filter({ company_id: companyId, is_active: true }),
    enabled: !!companyId,
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ['redemptions', companyId],
    queryFn: () => base44.entities.Redemption.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: companyToken } = useQuery({
    queryKey: ['companyToken', companyId],
    queryFn: async () => {
      const tokens = await base44.entities.CompanyToken.filter({ company_id: companyId });
      // FIX: prefer active token with contract_address, newest first
      const active = tokens.filter(t => t.is_active !== false && t.contract_address);
      return (active.length > 0 ? active[active.length - 1] : tokens[tokens.length - 1]) || null;
    },
    enabled: !!companyId,
  });
  const tokenSymbol = companyToken?.token_symbol || 'tokens';

  const convertMutation = useMutation({
    mutationFn: async () => base44.functions.invoke('convertStarsToTokens', { clientId: client.id }),
    onSuccess: (response) => {
      if (response.data.success) {
        queryClient.invalidateQueries(['clients']);
        queryClient.invalidateQueries({ queryKey: ['companyToken', companyId] });
        toast.success('Converted ' + response.data.data.starsConverted + ' Stars to ' + response.data.data.tokensReceived + ' ' + tokenSymbol + '!');
      } else {
        toast.error(response.data.error || 'Conversion failed.');
      }
    },
    onError: () => toast.error('Error converting tokens')
  });

  const redeemMutation = useMutation({
    mutationFn: async ({ item, chosenClient }) => {
      if (!chosenClient) throw new Error('No client selected');
      if ((chosenClient.current_balance || 0) < item.points_cost) throw new Error(`Not enough points (balance: ${chosenClient.current_balance || 0}, cost: ${item.points_cost})`);

      const companyTokens = await base44.entities.CompanyToken.filter({ company_id: companyId });
      // FIX: prefer active token with contract_address
      const _ctList = companyTokens.filter(t => t.is_active !== false && t.contract_address);
      const ct = _ctList.length > 0
        ? _ctList[_ctList.length - 1]
        : companyTokens[companyTokens.length - 1];
      const tokenSym = ct?.token_symbol || 'tokens';

      const companies = await base44.entities.Company.filter({ id: companyId });
      const companyName = companies[0]?.name || 'Company';

      const redemption = await base44.entities.Redemption.create({
        company_id: companyId,
        client_id: chosenClient.id,
        item_type: item.item_type,
        item_name: item.name,
        item_description: item.description,
        points_cost: item.points_cost,
        status: 'completed',
        metadata: { rarity: item.rarity }
      });

      // FIX: branch_id null (not literal string 'store')
      await base44.entities.Transaction.create({
        company_id: companyId,
        branch_id: null,
        client_id: chosenClient.id,
        client_phone: chosenClient.phone,
        amount: 0,
        tokens_expected: item.points_cost,
        tokens_actual: item.points_cost,
        token_symbol: tokenSym,
        status: 'completed',
        claim_token: `REWARD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        claimed_at: new Date().toISOString(),
        metadata: { source: 'rewards_store', item_name: item.name }
      });

      await base44.entities.LedgerEvent.create({
        company_id: companyId,
        client_id: chosenClient.id,
        type: 'redeem',
        points: -item.points_cost,
        balance_before: chosenClient.current_balance,
        balance_after: chosenClient.current_balance - item.points_cost,
        source: 'admin',
        description: 'Reward Store: ' + item.name
      });

      await base44.entities.Client.update(chosenClient.id, {
        current_balance: chosenClient.current_balance - item.points_cost,
        total_redeemed: (chosenClient.total_redeemed || 0) + item.points_cost
      });

      await base44.entities.RewardItem.update(item.id, {
        times_redeemed: (item.times_redeemed || 0) + 1,
        stock_quantity: item.stock_quantity > 0 ? item.stock_quantity - 1 : item.stock_quantity
      });

      // Send WhatsApp (fire-and-forget — does not block success)
      if (chosenClient.phone) {
        base44.functions.invoke('sendWhatsAppMessage', {
          phone: chosenClient.phone,
          message: `🎁 Reward Redeemed!\n\n${item.name} redeemed for ${item.points_cost.toLocaleString()} ${tokenSym}.\nNew balance: ${(chosenClient.current_balance - item.points_cost).toLocaleString()} ${tokenSym}.\n\nThank you, ${companyName}!`,
          company_id: companyId
        }).then(res => {
          if (!res?.data?.success) console.warn('WhatsApp failed:', res?.data?.error);
        }).catch(e => console.warn('WhatsApp error (non-critical):', e?.message));
      }

      return redemption;
    },
    onSuccess: (data, { item }) => {
      queryClient.invalidateQueries(['clients']);
      queryClient.invalidateQueries(['redemptions']);
      queryClient.invalidateQueries(['reward-items']);
      setRedeemDialogOpen(false);
      setSelectedItem(null);
      setSelectedClientId('');
      setClientSearch('');
      toast.success('Successfully redeemed: ' + item.name + '!');
    },
    onError: (error) => {
      toast.error(error.message === 'Not enough points' ? 'Not enough points for this client' : (error.message || 'Redemption error'));
    }
  });

  const handleRedeemClick = (item) => {
    setSelectedItem(item);
    setSelectedClientId(clients[0]?.id || '');
    setClientSearch('');
    setRedeemDialogOpen(true);
  };

  const handleConfirmRedeem = () => {
    const chosenClient = clients.find(c => c.id === selectedClientId);
    if (!chosenClient) { toast.error('Please select a customer'); return; }
    redeemMutation.mutate({ item: selectedItem, chosenClient });
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'bg-slate-500/20 text-slate-300 border-slate-500/50',
      rare: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      epic: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
      legendary: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
    };
    return colors[rarity] || colors.common;
  };

  const getRarityIcon = (rarity) => {
    if (rarity === 'legendary') return 'L';
    if (rarity === 'epic') return 'E';
    if (rarity === 'rare') return 'R';
    return '*';
  };

  const filterByType = (type) => {
    if (type === 'all') return rewardItems;
    return rewardItems.filter(item => item.item_type === type);
  };

  const SAMPLE_REWARDS = [
    { id: 'sample-1', name: 'Free Dessert', description: 'Choose any dessert on the menu', item_type: 'discount_voucher', rarity: 'common', points_cost: 500, icon: 'D' },
    { id: 'sample-2', name: 'VIP Event Access', description: 'Exclusive invite to special events', item_type: 'special_access', rarity: 'rare', points_cost: 1000, icon: 'V' },
    { id: 'sample-3', name: 'Exclusive Merchandise', description: 'Limited edition branded items', item_type: 'exclusive_content', rarity: 'epic', points_cost: 2000, icon: 'M' }
  ];

  const createSampleMutation = useMutation({
    mutationFn: async (sample) => base44.entities.RewardItem.create({
      company_id: companyId, name: sample.name, description: sample.description,
      item_type: sample.item_type, rarity: sample.rarity, points_cost: sample.points_cost,
      stock_quantity: -1, is_active: true
    }),
    onSuccess: (data, sample) => { queryClient.invalidateQueries({ queryKey: ['reward-items'] }); toast.success('Added reward: ' + sample.name); },
    onError: () => toast.error('Failed to create reward')
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Rewards Store</h1>
          <p className="text-sm text-[#9ca3af] mt-1">Redeem points for NFTs and exclusive content</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 bg-[#1f2128] border-[#2d2d3a] text-white hover:bg-[#2d2d3a]">
            <ArrowLeft className="w-4 h-4" />Back
          </Button>
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Coins className="w-6 h-6 text-teal-400" />
                <div>
                  <p className="text-xs text-[#9ca3af]">Total Client Tokens</p>
                  <p className="text-xl font-semibold text-white">{clients.reduce((sum, c) => sum + (c.current_balance || 0), 0).toLocaleString()}</p>
                  <p className="text-xs text-[#9ca3af]">{clients.length} clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Step 1: Earn — Convert Stars */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm mb-0.5">Convert Stars to {tokenSymbol} Tokens</h3>
                <p className="text-xs text-[#9ca3af]">100 Stars = 1 {tokenSymbol} Token</p>
                <p className="text-xs text-teal-400 mt-1">Can convert: {Math.floor((client?.current_balance || 0) / 100)} Tokens</p>
              </div>
            </div>
            <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending || (client?.current_balance || 0) < 100} className="bg-teal-500 hover:bg-teal-600">
              {convertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convert Now'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Spend — Wallet Store */}
      <Link to={createPageUrl('WalletStore')}>
        <Card className="bg-gradient-to-r from-teal-900/30 to-teal-800/10 border-teal-500/30 hover:border-teal-400/60 transition-all cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-0.5">Shop with Tokens</h3>
                  <p className="text-xs text-[#9ca3af]">Browse the Wallet Store and spend tokens on products</p>
                </div>
              </div>
              <Button className="bg-teal-500 hover:bg-teal-600 gap-2">
                Shop Now <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Step 3: Cash Out — Cross-Chain */}
      <Link to={createPageUrl('CrossChainRedemption')}>
        <Card className="bg-gradient-to-r from-indigo-900/30 to-purple-900/10 border-indigo-500/30 hover:border-indigo-400/60 transition-all cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-0.5">Cross-Chain Redemption</h3>
                  <p className="text-xs text-[#9ca3af]">Redeem tokens to Bitcoin or Ethereum via ZetaChain</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Tabs defaultValue="all">
        <TabsList className="bg-[#1f2128] border-[#2d2d3a]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="nft">NFTs</TabsTrigger>
          <TabsTrigger value="special_access">Special Access</TabsTrigger>
          <TabsTrigger value="my_items">My Items</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewardItems.map(item => (
              <Card key={item.id} className="bg-[#1f2128] border-[#2d2d3a] overflow-hidden hover:border-teal-500 transition-all group">
                <div className="relative h-48 bg-gradient-to-br from-[#17171f] to-[#1f2128] flex items-center justify-center">
                  {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <div className="text-6xl">{getRarityIcon(item.rarity)}</div>}
                  <Badge className={'absolute top-2 right-2 ' + getRarityColor(item.rarity)}>{item.rarity}</Badge>
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-bold text-white mb-2">{item.name}</h3>
                  <p className="text-sm text-[#9ca3af] mb-4">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-teal-400" />
                      <span className="text-xl font-bold text-white">{item.points_cost.toLocaleString()}</span>
                    </div>
                    <Button onClick={() => handleRedeemClick(item)} className="bg-teal-500 hover:bg-teal-600">Redeem</Button>
                  </div>
                  {item.stock_quantity > 0 && item.stock_quantity < 10 && <p className="text-xs text-teal-400 mt-2">Only {item.stock_quantity} left!</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Templates */}
          {showTemplates && (
            <div className="bg-[#1f2128] border-[#2d2d3a] border rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="text-center flex-1">
                  <div className="w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Award className="w-10 h-10 text-teal-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Create Your First Reward!</h2>
                  <p className="text-[#9ca3af]">Start with these popular reward templates</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowTemplates(false)} className="text-[#9ca3af] hover:text-white self-start">Hide Templates</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SAMPLE_REWARDS.map((sample) => (
                  <Card key={sample.id} className="bg-[#17171f] border-[#2d2d3a] hover:border-teal-500 transition-all">
                    <CardContent className="p-6 text-center">
                      <div className="text-6xl mb-3">{sample.icon}</div>
                      <h3 className="font-bold text-white mb-2">{sample.name}</h3>
                      <p className="text-sm text-[#9ca3af] mb-4">{sample.description}</p>
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <Coins className="w-5 h-5 text-teal-400" />
                        <span className="text-xl font-bold text-white">{sample.points_cost}</span>
                        <span className="text-sm text-[#9ca3af]">points</span>
                      </div>
                      <Button onClick={() => createSampleMutation.mutate(sample)} disabled={createSampleMutation.isPending} className="w-full bg-teal-500 hover:bg-teal-600">
                        {createSampleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add This Reward'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {!showTemplates && (
            <Button variant="outline" onClick={() => setShowTemplates(true)} className="w-full border-[#2d2d3a] text-white hover:bg-[#2d2d3a]">
              <Award className="w-4 h-4 mr-2" />Show Reward Templates
            </Button>
          )}
        </TabsContent>

        <TabsContent value="nft" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterByType('nft').map(item => (
              <Card key={item.id} className="bg-[#1f2128] border-[#2d2d3a]">
                <div className="relative h-48 bg-gradient-to-br from-[#17171f] to-[#1f2128] flex items-center justify-center">
                  <div className="text-6xl">{getRarityIcon(item.rarity)}</div>
                  <Badge className={'absolute top-2 right-2 ' + getRarityColor(item.rarity)}>NFT</Badge>
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-bold text-white mb-2">{item.name}</h3>
                  <p className="text-sm text-[#9ca3af] mb-4">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-teal-400" />
                      <span className="text-xl font-bold text-white">{item.points_cost.toLocaleString()}</span>
                    </div>
                    <Button onClick={() => handleRedeemClick(item)} className="bg-teal-500 hover:bg-teal-600">Redeem NFT</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="special_access" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterByType('special_access').map(item => (
              <Card key={item.id} className="bg-[#1f2128] border-[#2d2d3a]">
                <div className="relative h-48 bg-gradient-to-br from-[#17171f] to-[#1f2128] flex items-center justify-center">
                  <Sparkles className="w-16 h-16 text-teal-400" />
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-bold text-white mb-2">{item.name}</h3>
                  <p className="text-sm text-[#9ca3af] mb-4">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-teal-400" />
                      <span className="text-xl font-bold text-white">{item.points_cost.toLocaleString()}</span>
                    </div>
                    <Button onClick={() => handleRedeemClick(item)} className="bg-teal-500 hover:bg-teal-600">Redeem</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my_items" className="mt-6">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="p-4 border-b border-[#2d2d3a]">
              <CardTitle className="text-white text-sm font-semibold">All Redemptions ({redemptions.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {redemptions.map(redemption => {
                  const redeemClient = clients.find(c => c.id === redemption.client_id);
                  return (
                    <div key={redemption.id} className="flex items-center gap-3 p-3 bg-[#17171f] rounded-lg">
                      <Award className="w-6 h-6 text-teal-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm">{redemption.item_name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-[#9ca3af]">{new Date(redemption.created_date).toLocaleString()}</span>
                          {redemption.points_cost && <span className="text-xs text-teal-400">-{redemption.points_cost.toLocaleString()} pts</span>}
                        </div>
                        {redeemClient && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[9px]">{redeemClient.full_name?.charAt(0) || '?'}</span>
                            </div>
                            <span className="text-xs text-slate-300">{redeemClient.full_name || 'No name'} · {redeemClient.phone}</span>
                          </div>
                        )}
                      </div>
                      <Badge className={redemption.status === 'completed' ? 'bg-teal-500/20 text-teal-300 flex-shrink-0' : redemption.status === 'pending' ? 'bg-amber-500/20 text-amber-300 flex-shrink-0' : 'bg-rose-500/20 text-rose-300 flex-shrink-0'}>
                        {redemption.status === 'completed' ? 'Completed' : redemption.status === 'pending' ? 'Pending' : 'Failed'}
                      </Badge>
                    </div>
                  );
                })}
                {redemptions.length === 0 && (
                  <div className="text-center py-8 text-[#9ca3af]">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No redemptions yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={redeemDialogOpen} onOpenChange={(open) => { setRedeemDialogOpen(open); if (!open) { setSelectedItem(null); setClientSearch(''); } }}>
        <DialogContent className="sm:max-w-md bg-[#1f2128] border-[#2d2d3a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Select Customer</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="py-2">
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 mb-4 flex items-center gap-3">
                <Coins className="w-5 h-5 text-teal-400" />
                <div>
                  <p className="font-semibold text-white text-sm">{selectedItem.name}</p>
                  <p className="text-xs text-[#9ca3af]">{selectedItem.points_cost.toLocaleString()} points</p>
                </div>
              </div>
              <Label className="text-xs text-[#9ca3af] mb-2 block">Search Customer</Label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                <Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Name, phone or email..." className="pl-9 bg-[#17171f] border-[#2d2d3a] text-white" />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {filteredClients.length === 0 && <p className="text-center text-[#9ca3af] text-sm py-4">No clients found</p>}
                {filteredClients.map(c => (
                  <button key={c.id} onClick={() => setSelectedClientId(c.id)}
                    className={'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ' + (selectedClientId === c.id ? 'bg-teal-500/20 border border-teal-500/50' : 'bg-[#17171f] border border-[#2d2d3a] hover:border-teal-500/30')}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-medium">{c.full_name?.charAt(0) || c.phone?.charAt(0) || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{c.full_name || 'No name'}</p>
                      <p className="text-[#9ca3af] text-xs">{c.phone}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-teal-400 text-sm font-semibold">{(c.current_balance || 0).toLocaleString()}</p>
                      <p className="text-[#9ca3af] text-xs">balance</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemDialogOpen(false)} className="bg-[#17171f] border-[#2d2d3a] text-white hover:bg-[#2d2d3a]">Cancel</Button>
            <Button onClick={handleConfirmRedeem} disabled={redeemMutation.isPending || !selectedClientId} className="bg-teal-500 hover:bg-teal-600">
              {redeemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Redeem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}