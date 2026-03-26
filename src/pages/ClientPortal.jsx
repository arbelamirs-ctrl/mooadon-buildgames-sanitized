import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coins,
  History,
  TrendingUp,
  TrendingDown,
  Wallet,
  Phone,
  ArrowRight,
  Store,
  QrCode,
  ChevronDown,
  ShoppingBag,
  Gift,
  CheckCircle,
  Loader2,
  AlertCircle,
  Pencil,
  X,
  Check
} from 'lucide-react';
import CustomerQR from '@/components/pos/CustomerQR';
import { format } from 'date-fns';
import { toast } from "sonner";

export default function ClientPortal() {
  // Read URL params — support direct link from welcome WhatsApp
  const urlParams = new URLSearchParams(window.location.search);
  const urlClientId  = urlParams.get('client_id');
  const urlCompanyId = urlParams.get('company_id');
  const isWelcomeRef = urlParams.get('ref') === 'welcome';

  const [phone, setPhone] = useState('');
  const [client, setClient] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Auto-load client if URL params present
  React.useEffect(() => {
    if (!urlClientId || !urlCompanyId) return;
    setLoading(true);
    Promise.all([
      base44.entities.Client.filter({ id: urlClientId }),
      base44.entities.Company.filter({ id: urlCompanyId }),
    ]).then(([clients, companies]) => {
      if (clients.length > 0) { setClient(clients[0]); setSearched(true); }
      if (companies.length > 0) setCompany(companies[0]);
    }).finally(() => setLoading(false));
  }, [urlClientId, urlCompanyId]);
  const [showQR, setShowQR] = useState(false);
  const [redeemingId, setRedeemingId] = useState(null);
  const [editingWallet, setEditingWallet] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const queryClient = useQueryClient();

  const { data: ledgerEvents = [] } = useQuery({
    queryKey: ['clientLedger', client?.id],
    queryFn: () => base44.entities.LedgerEvent.filter({ client_id: client.id }, '-created_date', 50),
    enabled: !!client?.id,
  });

  const { data: rewardItems = [] } = useQuery({
    queryKey: ['rewardItems', client?.company_id],
    queryFn: () => base44.entities.RewardItem.filter({ company_id: client.company_id, is_active: true }),
    enabled: !!client?.company_id,
  });

  const { data: myRedemptions = [] } = useQuery({
    queryKey: ['myRedemptions', client?.id],
    queryFn: () => base44.entities.Redemption.filter({ client_id: client.id, company_id: client.company_id }),
    enabled: !!client?.id,
  });

  const searchClient = async () => {
    if (!phone) return;
    setLoading(true);
    setSearched(true);
    try {
      const clients = await base44.entities.Client.filter({ phone });
      if (clients.length > 0) {
        const foundClient = clients[0];
        setClient(foundClient);
        if (foundClient.company_id) {
          const companies = await base44.entities.Company.filter({ id: foundClient.company_id });
          if (companies.length > 0) setCompany(companies[0]);
        }
      } else {
        setClient(null);
        setCompany(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const redeemMutation = useMutation({
    mutationFn: async (item) => {
      if (!client) throw new Error('No client');
      const balance = client.current_balance || 0;
      if (balance < item.points_cost) throw new Error('not_enough');

      await base44.entities.Redemption.create({
        company_id: client.company_id,
        client_id: client.id,
        item_type: item.item_type,
        item_name: item.name,
        item_description: item.description,
        points_cost: item.points_cost,
        status: 'completed',
        metadata: { source: 'client_portal', rarity: item.rarity }
      });

      await base44.entities.LedgerEvent.create({
        company_id: client.company_id,
        client_id: client.id,
        type: 'redeem',
        points: -item.points_cost,
        balance_before: balance,
        balance_after: balance - item.points_cost,
        source: 'client_portal',
        description: 'Rewards Store: ' + item.name
      });

      const updatedClient = await base44.entities.Client.update(client.id, {
        current_balance: balance - item.points_cost,
        total_redeemed: (client.total_redeemed || 0) + item.points_cost
      });

      await base44.entities.RewardItem.update(item.id, {
        times_redeemed: (item.times_redeemed || 0) + 1,
        ...(item.stock_quantity > 0 ? { stock_quantity: item.stock_quantity - 1 } : {})
      });

      if (client.phone) {
        base44.functions.invoke('sendWhatsAppMessage', {
          phone: client.phone,
          message: `🎁 Reward Redeemed: ${item.name}\n💰 Cost: ${item.points_cost.toLocaleString()} points\n✅ New balance: ${(balance - item.points_cost).toLocaleString()} points\n\nThank you for choosing ${company?.name || 'us'}!`,
          company_id: client.company_id
        }).catch(e => console.warn('WhatsApp failed (non-critical):', e.message));
      }

      return updatedClient;
    },
    onSuccess: (updatedClient, item) => {
      setClient(prev => ({
        ...prev,
        current_balance: (prev.current_balance || 0) - item.points_cost,
        total_redeemed: (prev.total_redeemed || 0) + item.points_cost
      }));
      queryClient.invalidateQueries(['clientLedger', client?.id]);
      queryClient.invalidateQueries(['myRedemptions', client?.id]);
      queryClient.invalidateQueries(['rewardItems', client?.company_id]);
      setRedeemingId(null);
      toast.success(`✅ ${item.name} redeemed successfully!`);
    },
    onError: (error, item) => {
      setRedeemingId(null);
      if (error.message === 'not_enough') {
        toast.error(`Not enough points. Required: ${item.points_cost.toLocaleString()}`);
      } else {
        toast.error('Redemption error: ' + error.message);
      }
    }
  });

  const handleRedeem = (item) => {
    setRedeemingId(item.id);
    redeemMutation.mutate(item);
  };

  const updateWalletMutation = useMutation({
    mutationFn: async (address) => {
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) throw new Error('Invalid wallet address format (must be 0x...)');
      await base44.entities.Client.update(client.id, { wallet_address: address, wallet_chain: 'avalanche_fuji' });
      return address;
    },
    onSuccess: (address) => {
      setClient(prev => ({ ...prev, wallet_address: address }));
      setEditingWallet(false);
      setNewWalletAddress('');
      toast.success('Wallet address updated!');
    },
    onError: (e) => toast.error(e.message)
  });

  const pointsName = company?.points_name || 'Points';
  const balance = client?.current_balance || 0;

  // ─── Login screen ───────────────────────────────────────────────
  if (!searched || !client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="fixed top-4 right-4">
          <img src="https://storage.googleapis.com/base44-prod-public-data/apps/682181be-b78b-45d8-96e9-6aafeef994d0/icon-1736870036055.png" alt="Mooadon" className="h-12 w-12 rounded-lg" />
        </div>
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-xl border-white/20">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Coins className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">My Balance</h1>
              <p className="text-white/70">Enter your phone number to view your balance and redeem rewards.</p>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="h-14 text-lg pl-12 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  onKeyPress={(e) => e.key === 'Enter' && searchClient()}
                />
              </div>
              <Button onClick={searchClient} disabled={loading || !phone} className="w-full h-14 text-lg bg-white text-slate-900 hover:bg-white/90">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'View My Rewards'}
              </Button>
            </div>
            {searched && !client && !loading && (
              <div className="mt-6 bg-rose-500/20 border border-rose-400/30 rounded-xl p-4 text-center">
                <p className="text-rose-200">No account found for this number.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main portal ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 p-4">
      <div className="fixed top-4 right-4">
        <img src="https://storage.googleapis.com/base44-prod-public-data/apps/682181be-b78b-45d8-96e9-6aafeef994d0/icon-1736870036055.png" alt="Mooadon" className="h-12 w-12 rounded-lg" />
      </div>

      <div className="max-w-lg mx-auto space-y-4 pt-6">
        {/* Company + back */}
        <div className="text-center">
          {company?.logo_url
            ? <img src={company.logo_url} alt={company.name} className="h-10 mx-auto mb-2" />
            : <div className="flex items-center justify-center gap-2 mb-2"><Store className="w-5 h-5 text-white/70" /><span className="text-white/70">{company?.name}</span></div>
          }
          <Button variant="ghost" className="text-white/50 hover:text-white hover:bg-white/10" onClick={() => { setClient(null); setSearched(false); setPhone(''); }}>
            <ArrowRight className="w-4 h-4 mr-1" />Switch Account
          </Button>
        </div>

        {/* QR toggle */}
        <Button onClick={() => setShowQR(v => !v)} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 gap-2">
          <QrCode className="w-4 h-4" />
          {showQR ? 'Hide QR Code' : 'Show QR at Checkout'}
          <ChevronDown className={`w-4 h-4 transition-transform ${showQR ? 'rotate-180' : ''}`} />
        </Button>
        {showQR && <CustomerQR phone={client.phone} companyId={client.company_id} />}

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border-white/20 overflow-hidden">
          <CardContent className="p-8 text-center">
            <p className="text-white/70 mb-2">Your Balance</p>
            <div className="flex items-center justify-center gap-3 mb-2">
              <Coins className="w-10 h-10 text-amber-400" />
              <span className="text-6xl font-bold text-white">{balance.toLocaleString()}</span>
            </div>
            <p className="text-xl text-white/80">{pointsName}</p>
            {/* Wallet address section */}
            <div className="mt-4">
              {!editingWallet ? (
                <div className="flex items-center justify-center gap-2">
                  <Wallet className="w-4 h-4 text-white/40" />
                  <code className="text-xs text-white/50">
                    {client.wallet_address
                      ? `${client.wallet_address.slice(0, 8)}...${client.wallet_address.slice(-6)}`
                      : 'No wallet connected'}
                  </code>
                  <button
                    onClick={() => { setEditingWallet(true); setNewWalletAddress(client.wallet_address || ''); }}
                    className="text-white/40 hover:text-white/80 transition-colors"
                    title="Change wallet"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 px-2">
                  <p className="text-xs text-white/60 text-center">Enter new wallet address</p>
                  <Input
                    value={newWalletAddress}
                    onChange={e => setNewWalletAddress(e.target.value)}
                    placeholder="0x..."
                    dir="ltr"
                    className="bg-white/10 border-white/20 text-white text-xs font-mono h-9"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEditingWallet(false); setNewWalletAddress(''); }}
                      className="flex-1 text-white/50 hover:text-white hover:bg-white/10 h-8"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateWalletMutation.mutate(newWalletAddress)}
                      disabled={!newWalletAddress || updateWalletMutation.isPending}
                      className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white h-8"
                    >
                      {updateWalletMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" />Save</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{(client.total_earned || 0).toLocaleString()}</p>
              <p className="text-sm text-white/60">Total Earned</p>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="p-4 text-center">
              <TrendingDown className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{(client.total_redeemed || 0).toLocaleString()}</p>
              <p className="text-sm text-white/60">Total Redeemed</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="store" className="w-full">
          <TabsList className="w-full bg-white/10 border border-white/20">
            <TabsTrigger value="store" className="flex-1 data-[state=active]:bg-white/20 text-white gap-1">
              <Gift className="w-4 h-4" />Rewards Store
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 data-[state=active]:bg-white/20 text-white gap-1">
              <History className="w-4 h-4" />History
            </TabsTrigger>
            <TabsTrigger value="my_items" className="flex-1 data-[state=active]:bg-white/20 text-white gap-1">
              <ShoppingBag className="w-4 h-4" />My Items
            </TabsTrigger>
          </TabsList>

          {/* ── STORE TAB ── */}
          <TabsContent value="store" className="mt-4 space-y-3">
            {rewardItems.length === 0 ? (
              <Card className="bg-white/10 border-white/20">
                <CardContent className="p-8 text-center">
                  <Gift className="w-12 h-12 text-white/30 mx-auto mb-3" />
                  <p className="text-white/60">No rewards available at the moment.</p>
                </CardContent>
              </Card>
            ) : (
              rewardItems.map(item => {
                const canAfford = balance >= item.points_cost;
                const outOfStock = item.stock_quantity === 0;
                const isRedeeming = redeemingId === item.id;
                return (
                  <Card key={item.id} className={`border transition-all ${canAfford && !outOfStock ? 'bg-white/10 border-white/20 hover:border-teal-400/50' : 'bg-white/5 border-white/10 opacity-60'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-white truncate">{item.name}</h3>
                            {item.rarity && item.rarity !== 'common' && (
                              <Badge className="text-xs bg-purple-500/20 text-purple-300 border-0 flex-shrink-0">{item.rarity}</Badge>
                            )}
                          </div>
                          {item.description && <p className="text-sm text-white/60 mb-2 line-clamp-2">{item.description}</p>}
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            <span className="text-lg font-bold text-amber-400">{item.points_cost.toLocaleString()}</span>
                            <span className="text-white/50 text-sm">{pointsName}</span>
                          </div>
                          {outOfStock && <p className="text-xs text-rose-400 mt-1">Out of stock</p>}
                          {!outOfStock && item.stock_quantity > 0 && item.stock_quantity < 5 && (
                            <p className="text-xs text-amber-400 mt-1">Only {item.stock_quantity} left!</p>
                          )}
                          {!canAfford && !outOfStock && (
                            <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {(item.points_cost - balance).toLocaleString()} more {pointsName} needed
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => handleRedeem(item)}
                          disabled={!canAfford || outOfStock || redeemMutation.isPending}
                          className={`flex-shrink-0 ${canAfford && !outOfStock ? 'bg-teal-500 hover:bg-teal-600 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
                          size="sm"
                        >
                          {isRedeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redeem'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ── HISTORY TAB ── */}
          <TabsContent value="history" className="mt-4">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                {ledgerEvents.length === 0 ? (
                  <p className="text-center text-white/50 py-6">No history yet.</p>
                ) : (
                  <div className="space-y-3">
                    {ledgerEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${event.type === 'earn' ? 'bg-emerald-500/20' : event.type === 'redeem' ? 'bg-purple-500/20' : 'bg-slate-500/20'}`}>
                            {event.type === 'earn'
                              ? <TrendingUp className="w-5 h-5 text-emerald-400" />
                              : <TrendingDown className="w-5 h-5 text-purple-400" />}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {event.type === 'earn' ? 'Earned' : event.type === 'redeem' ? 'Redeemed' : event.type === 'adjust' ? 'Adjustment' : event.type}
                            </p>
                            {event.description && <p className="text-xs text-white/50 max-w-[160px] truncate">{event.description}</p>}
                            <p className="text-xs text-white/40">{event.created_date ? format(new Date(event.created_date), 'MM/dd/yy HH:mm') : ''}</p>
                          </div>
                        </div>
                        <span className={`text-lg font-bold ${event.points >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {event.points >= 0 ? '+' : ''}{event.points?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── MY ITEMS TAB ── */}
          <TabsContent value="my_items" className="mt-4">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                {myRedemptions.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="w-12 h-12 text-white/20 mx-auto mb-3" />
                    <p className="text-white/50">No items redeemed yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myRedemptions.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                        <Gift className="w-6 h-6 text-teal-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{r.item_name}</p>
                          {r.item_description && <p className="text-xs text-white/50 truncate">{r.item_description}</p>}
                          <p className="text-xs text-white/40">{r.created_date ? format(new Date(r.created_date), 'MM/dd/yy') : ''}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-amber-400">-{r.points_cost?.toLocaleString()}</p>
                          {r.status === 'completed'
                            ? <CheckCircle className="w-4 h-4 text-teal-400 ml-auto mt-1" />
                            : <Badge className="text-xs bg-amber-500/20 text-amber-300 border-0">{r.status}</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}