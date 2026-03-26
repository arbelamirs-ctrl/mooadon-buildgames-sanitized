import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, CheckCircle, Clock, Search, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusConfig = {
  pending:   { label: 'Pending',   className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  fulfilled: { label: 'Fulfilled', className: 'bg-green-500/20  text-green-400  border-green-500/30'  },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/20    text-red-400    border-red-500/30'    },
};

export default function WalletStoreOrders() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch company to check plan tier
  const { data: company } = useQuery({
    queryKey: ['company-for-wallet-store', primaryCompanyId],
    queryFn: async () => {
      if (!primaryCompanyId) return null;
      const companies = await base44.entities.Company.filter({ id: primaryCompanyId });
      return companies[0] || null;
    },
    enabled: !!primaryCompanyId,
  });

  // Check if advanced plan - wallet store requires advanced or pro
  // But admins bypass this check
  const { user, isSystemAdmin } = useUserPermissions();
  const hasAccess = isSystemAdmin || company?.plan_tier === 'advanced' || company?.plan_tier === 'pro';

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['wallet-store-orders', primaryCompanyId],
    queryFn: () => base44.entities.WalletStoreOrder.filter({ company_id: primaryCompanyId }, '-created_date', 500),
    enabled: !!primaryCompanyId,
  });

  const fulfillMutation = useMutation({
    mutationFn: (orderId) => base44.entities.WalletStoreOrder.update(orderId, {
      status: 'fulfilled',
      fulfilled_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-store-orders', primaryCompanyId] });
      toast.success('Order marked as fulfilled');
    },
    onError: () => toast.error('Failed to update order'),
  });

  const filtered = orders.filter(o => {
    const matchSearch =
      !search ||
      o.order_id?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone?.includes(search) ||
      o.product_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  // Show upgrade message if no access
  if (company && !hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-blue-500/30 max-w-md">
          <CardContent className="p-6 text-center">
            <Package className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Wallet Store Requires Advanced Plan</h2>
            <p className="text-slate-400 text-sm mb-4">
              Upgrade your plan to unlock the Wallet Store and start selling digital products to your customers.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700 w-full">
              Upgrade to Advanced
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-400" />
            Wallet Store Orders
          </h1>
          <p className="text-sm text-[#9ca3af] mt-1">
            {orders.length} total orders · {pendingCount} pending
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
          <Input
            placeholder="Search by order ID, phone, or product…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[#1f2128] border-[#2d2d3a] text-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-[#1f2128] border-[#2d2d3a] text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="p-4 border-b border-[#2d2d3a]">
          <CardTitle className="text-white text-sm font-semibold">
            {filtered.length} order{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-[#9ca3af]">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d2d3a] text-[#9ca3af] text-xs uppercase">
                    <th className="text-left px-4 py-3 font-medium">Order ID</th>
                    <th className="text-left px-4 py-3 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                    <th className="text-right px-4 py-3 font-medium">Tokens</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => {
                    const cfg = statusConfig[order.status] || statusConfig.pending;
                    const dateStr = order.created_at || order.created_date;
                    return (
                      <tr key={order.id} className="border-b border-[#2d2d3a] hover:bg-[#17171f] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{order.order_id}</td>
                        <td className="px-4 py-3 text-white">{order.customer_phone}</td>
                        <td className="px-4 py-3 text-white font-medium">{order.product_name}</td>
                        <td className="px-4 py-3 text-right text-teal-400 font-semibold">{order.price_tokens}</td>
                        <td className="px-4 py-3 text-[#9ca3af] text-xs">
                          {dateStr ? format(new Date(dateStr), 'dd/MM/yyyy HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${cfg.className} border text-xs`}>
                            {order.status === 'fulfilled' && <CheckCircle className="w-3 h-3 mr-1 inline" />}
                            {order.status === 'pending' && <Clock className="w-3 h-3 mr-1 inline" />}
                            {order.status === 'cancelled' && <XCircle className="w-3 h-3 mr-1 inline" />}
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {order.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => fulfillMutation.mutate(order.id)}
                              disabled={fulfillMutation.isPending}
                              className="bg-teal-500 hover:bg-teal-600 text-white text-xs h-7 px-3"
                            >
                              {fulfillMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : 'Mark Fulfilled'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}