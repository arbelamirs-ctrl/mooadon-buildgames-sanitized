import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Coins, Loader2, ExternalLink, Package, Search, ArrowLeft, ShoppingCart, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useUserPermissions } from '@/components/auth/useUserPermissions';

export default function WalletStore() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { primaryCompanyId } = useUserPermissions();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients', primaryCompanyId],
    queryFn: () => base44.entities.Client.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const filteredClients = allClients.filter(c => {
    if (!clientSearch) return true;
    const s = clientSearch.toLowerCase();
    return (c.full_name && c.full_name.toLowerCase().includes(s)) ||
           (c.phone && c.phone.includes(clientSearch)) ||
           (c.email && c.email.toLowerCase().includes(s));
  });

  const selectedClient = allClients.find(c => c.id === selectedClientId) || null;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-active', primaryCompanyId],
    queryFn: () => base44.entities.Product.filter({ is_active: true, company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const { data: myOrders = [] } = useQuery({
    queryKey: ['wallet-store-orders', primaryCompanyId],
    queryFn: () => base44.entities.WalletStoreOrder.filter({ company_id: primaryCompanyId }, '-created_at', 200),
    enabled: !!primaryCompanyId
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ product, client }) => {
      if (!client) throw new Error('Please select a customer');
      if ((client.current_balance || 0) < product.price_tokens) throw new Error('Insufficient token balance');
      if (product.stock_quantity <= 0) throw new Error('Out of stock');
      if (product.company_id !== primaryCompanyId) throw new Error('This product does not belong to your company');

      const res = await base44.functions.invoke('walletStorePurchase', {
        product_id: product.id,
        client_id: client.id,
        company_id: primaryCompanyId
      });

      if (!res.data?.success) throw new Error(res.data?.error || 'Purchase failed');
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['products-active'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-store-orders'] });
      toast.success(`Order ${data.order_id} confirmed! SMS sent.`);
      setBuyDialogOpen(false);
      setSelectedProduct(null);
      setSelectedClientId('');
      setClientSearch('');
    },
    onError: (error) => {
      toast.error(error.message || 'Purchase failed');
    }
  });

  const handleBuyClick = (product) => {
    setSelectedProduct(product);
    setSelectedClientId('');
    setClientSearch('');
    setBuyDialogOpen(true);
  };

  const handleConfirmBuy = () => {
    if (!selectedClient) { toast.error('Please select a customer'); return; }
    purchaseMutation.mutate({ product: selectedProduct, client: selectedClient });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 bg-[#1f2128] border-[#2d2d3a] text-white hover:bg-[#2d2d3a]">
            <ArrowLeft className="w-4 h-4" />Back
          </Button>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <ShoppingBag className="w-7 h-7" />Wallet Store
          </h1>
        </div>
        <div className="text-sm text-slate-400">{allClients.length} customers</div>
      </div>

      <Tabs defaultValue="shop" className="space-y-6">
        <TabsList className="bg-[#1f2128] border-[#2d2d3a]">
          <TabsTrigger value="shop"><ShoppingBag className="w-4 h-4 mr-2" />Shop</TabsTrigger>
          <TabsTrigger value="orders"><Package className="w-4 h-4 mr-2" />My Orders ({myOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-[#1f2128] border-[#2d2d3a] text-white" />
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-4 rounded-md bg-[#1f2128] border border-[#2d2d3a] text-white text-sm">
              <option value="all">All Categories</option>
              <option value="physical">Physical</option>
              <option value="digital">Digital</option>
              <option value="service">Service</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>

          {isLoading ? (
            <div className="text-slate-500 text-center py-12">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No products found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 gap-1.5">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="bg-[#1f2128] border-[#2d2d3a] overflow-hidden hover:border-teal-500/50 transition-all">
                  {product.image_url ? (
                    <div className="relative">
                      <img src={product.image_url} alt={product.name} className="w-full h-14 object-cover" />
                      {product.stock_quantity === 0 && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-red-400 text-xs font-bold">Out</span></div>}
                    </div>
                  ) : (
                    <div className="w-full h-10 bg-[#17171f] flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                  <CardContent className="p-1.5">
                    <h3 className="text-white font-medium text-xs leading-tight truncate">{product.name}</h3>
                    <div className="text-teal-400 font-bold text-xs mt-0.5">{product.price_tokens.toLocaleString()}<span className="text-slate-500 font-normal ml-0.5">T</span></div>
                    <Button
                      size="sm"
                      onClick={() => handleBuyClick(product)}
                      disabled={product.stock_quantity <= 0 || purchaseMutation.isPending}
                      className="bg-teal-500 hover:bg-teal-600 w-full mt-1 h-5 text-xs px-1"
                    >
                      {purchaseMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Buy'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {myOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No orders yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map((order) => {
                const client = allClients.find(c => c.id === order.customer_id);
                return (
                  <Card key={order.id} className="bg-[#1f2128] border-[#2d2d3a]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-semibold">{order.product_name}</h3>
                            <span className="text-xs text-slate-500 font-mono">{order.order_id}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                            <span>{new Date(order.created_at || order.created_date).toLocaleString()}</span>
                            <span className="text-teal-400 font-medium">-{order.price_tokens} Tokens</span>
                          </div>
                          {(client || order.customer_phone) && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs">{client?.full_name?.charAt(0) || order.customer_phone?.charAt(0) || '?'}</span>
                              </div>
                              <span className="text-slate-300 text-xs">{client?.full_name || 'Customer'} · {order.customer_phone}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Badge className={order.status === 'fulfilled' ? 'bg-green-500/20 text-green-400' : order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}>
                            {order.status === 'fulfilled' && <CheckCircle className="w-3 h-3 mr-1 inline" />}
                            {order.status}
                          </Badge>
                          {order.tx_hash && (
                            <a href={'https://testnet.snowtrace.io/tx/' + order.tx_hash} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="gap-2 bg-transparent border-[#2d2d3a] text-slate-400 hover:text-white">
                                <ExternalLink className="w-3 h-3" />TX
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Buy Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={(open) => { setBuyDialogOpen(open); if (!open) { setSelectedProduct(null); setClientSearch(''); } }}>
        <DialogContent className="sm:max-w-md bg-[#1f2128] border-[#2d2d3a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Select Customer</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="py-2">
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 mb-4 flex items-center gap-3">
                <Coins className="w-5 h-5 text-teal-400" />
                <div>
                  <p className="font-semibold text-white text-sm">{selectedProduct.name}</p>
                  <p className="text-xs text-[#9ca3af]">{selectedProduct.price_tokens.toLocaleString()} tokens</p>
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
                      <p className={`text-sm font-semibold ${(c.current_balance || 0) >= selectedProduct.price_tokens ? 'text-teal-400' : 'text-red-400'}`}>{(c.current_balance || 0).toLocaleString()}</p>
                      <p className="text-[#9ca3af] text-xs">balance</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyDialogOpen(false)} className="bg-[#17171f] border-[#2d2d3a] text-white hover:bg-[#2d2d3a]">Cancel</Button>
            <Button onClick={handleConfirmBuy} disabled={purchaseMutation.isPending || !selectedClientId} className="bg-teal-500 hover:bg-teal-600">
              {purchaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}