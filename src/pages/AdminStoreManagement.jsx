import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingBag, Search, TrendingUp, DollarSign, Users } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isSystemAdmin } from '@/components/constants/adminConfig';

export default function AdminStoreManagement() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all products
  const isAdmin = isSystemAdmin(user);

  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ['admin-all-products'],
    queryFn: () => base44.entities.Product.list(),
    enabled: isAdmin
  });

  // Fetch all orders
  const { data: allOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-all-orders'],
    queryFn: () => base44.entities.Purchase.list(),
    enabled: isAdmin
  });

  // Fetch all companies
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list()
  });

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="bg-red-500/10 border-red-500/50">
          <CardContent className="p-6 text-center">
            <p className="text-red-400">Access denied. Admin only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredProducts = allProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = allOrders.filter(o =>
    o.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const stats = {
    totalProducts: allProducts.length,
    activeProducts: allProducts.filter(p => p.is_active).length,
    totalOrders: allOrders.length,
    completedOrders: allOrders.filter(o => o.status === 'completed').length,
    totalRevenue: allOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.tokens_spent, 0)
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Unknown';
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-white">🛍️ Store Management (Admin)</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Total Products</p>
                <p className="text-white text-2xl font-bold">{stats.totalProducts}</p>
              </div>
              <Package className="w-8 h-8 text-teal-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Active Products</p>
                <p className="text-white text-2xl font-bold">{stats.activeProducts}</p>
              </div>
              <ShoppingBag className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Total Orders</p>
                <p className="text-white text-2xl font-bold">{stats.totalOrders}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Total Revenue</p>
                <p className="text-white text-2xl font-bold">{stats.totalRevenue}</p>
              </div>
              <DollarSign className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search products or orders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#1f2128] border-[#2d2d3a] text-white"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="products">
        <TabsList className="bg-[#1f2128] border-[#2d2d3a]">
          <TabsTrigger value="products">
            <Package className="w-4 h-4 mr-2" />
            All Products ({allProducts.length})
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingBag className="w-4 h-4 mr-2" />
            All Orders ({allOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-3 mt-4">
          {productsLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-slate-400">No products found.</p>
          ) : (
            filteredProducts.map((product) => (
              <Card key={product.id} className="bg-[#1f2128] border-[#2d2d3a]">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {product.image_url && (
                      <img src={product.image_url} alt={product.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-white font-semibold text-sm leading-tight truncate">{product.name}</h3>
                        <Badge className={`flex-shrink-0 text-xs ${product.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{product.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Badge className="bg-blue-500/20 text-blue-400 text-xs truncate max-w-[100px]">{getCompanyName(product.company_id)}</Badge>
                        <Badge className="bg-teal-500/20 text-teal-400 text-xs">{product.price_tokens} Tokens</Badge>
                        <Badge className="bg-purple-500/20 text-purple-400 text-xs">Stock: {product.stock_quantity || 0}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-3 mt-4">
          {ordersLoading ? (
            <p className="text-slate-500">Loading...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-slate-400">No orders found.</p>
          ) : (
            filteredOrders.map((order) => (
              <Card key={order.id} className="bg-[#1f2128] border-[#2d2d3a]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold">{order.product_name}</h3>
                      <div className="flex gap-3 text-xs text-slate-400 mt-1">
                        <span>{new Date(order.created_date).toLocaleString()}</span>
                        <span>{getCompanyName(order.company_id)}</span>
                        <span>{order.tokens_spent} Tokens</span>
                      </div>
                    </div>
                    <Badge className={
                      order.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }>
                      {order.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}