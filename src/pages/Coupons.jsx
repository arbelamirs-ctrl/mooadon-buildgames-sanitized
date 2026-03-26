import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, Search, Calendar, User, DollarSign, CheckCircle, XCircle, Clock, ExternalLink, Gift, Coffee, ShoppingBag, Cake, Sparkles, ArrowLeft, Loader2, Send, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const COUPON_TEMPLATES = [
  {
    id: 'welcome',
    title: 'Welcome Bonus',
    description: '50 bonus points for new customers',
    icon: Sparkles,
    color: 'from-purple-500 to-pink-500',
    config: {
      discount_type: 'fixed_amount',
      discount_value: 50,
      min_purchase_amount: 0,
      max_uses: 1
    }
  },
  {
    id: 'percentage',
    title: '10% Off Next Purchase',
    description: 'Classic percentage discount',
    icon: Ticket,
    color: 'from-blue-500 to-cyan-500',
    config: {
      discount_type: 'percentage',
      discount_value: 10,
      min_purchase_amount: 0,
      max_uses: 1
    }
  },
  {
    id: 'coffee',
    title: 'Free Coffee',
    description: 'Redeem 100 points for free coffee',
    icon: Coffee,
    color: 'from-amber-500 to-orange-500',
    config: {
      discount_type: 'fixed_amount',
      discount_value: 15,
      min_purchase_amount: 0,
      max_uses: 1
    }
  },
  {
    id: 'bogo',
    title: 'Buy 1 Get 1 Free',
    description: '50% off when you buy two',
    icon: ShoppingBag,
    color: 'from-green-500 to-emerald-500',
    config: {
      discount_type: 'percentage',
      discount_value: 50,
      min_purchase_amount: 20,
      max_uses: 1
    }
  },
  {
    id: 'birthday',
    title: 'Birthday Special',
    description: '20% off during birthday month',
    icon: Cake,
    color: 'from-pink-500 to-rose-500',
    config: {
      discount_type: 'percentage',
      discount_value: 20,
      min_purchase_amount: 0,
      max_uses: 1
    }
  }
];

export default function Coupons() {
  const navigate = useNavigate();
  const { primaryCompanyId } = useUserPermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);
  const [creatingTemplate, setCreatingTemplate] = useState(null);
  const [lastCreatedCoupon, setLastCreatedCoupon] = useState(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningCoupon, setAssigningCoupon] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ discount_type: 'percentage', discount_value: 10, max_uses: 1, expires_days: 30, product_id: '' });
  const [creatingManual, setCreatingManual] = useState(false);
  const queryClient = useQueryClient();

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['coupons', primaryCompanyId],
    queryFn: () => base44.entities.Coupon.filter({ company_id: primaryCompanyId }, '-created_date'),
    enabled: !!primaryCompanyId
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients-for-assign', primaryCompanyId],
    queryFn: () => base44.entities.Client.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId && assignDialogOpen
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-for-coupon', primaryCompanyId],
    queryFn: () => base44.entities.Product.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId && manualDialogOpen
  });

  const filteredClientResults = allClients.filter(c => {
    if (!clientSearch.trim()) return false;
    const q = clientSearch.toLowerCase();
    return (c.full_name && c.full_name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q));
  });

  const assignCouponMutation = useMutation({
    mutationFn: async ({ couponId, clientId }) => {
      await base44.entities.Coupon.update(couponId, { client_id: clientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      setAssignDialogOpen(false);
      setAssigningCoupon(null);
      setClientSearch('');
      setSelectedClient(null);
      toast.success('Coupon assigned to client successfully!');
    }
  });

  const cancelCouponMutation = useMutation({
    mutationFn: async (couponId) => {
      await base44.entities.Coupon.update(couponId, { status: 'cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('Coupon cancelled successfully');
    }
  });

  const filteredCoupons = coupons.filter(coupon =>
    coupon.coupon_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coupon.client_phone?.includes(searchQuery)
  );

  const stats = {
    total: coupons.length,
    active: coupons.filter(c => c.status === 'active').length,
    used: coupons.filter(c => c.status === 'used').length,
    expired: coupons.filter(c => c.status === 'expired').length
  };

  const columns = [
    {
      header: 'Coupon Code',
      accessor: 'coupon_code',
      cell: (coupon) => (
        <div className={`flex items-center gap-2 ${lastCreatedCoupon === coupon.id ? 'animate-pulse' : ''}`}>
          <div className={`font-mono font-semibold text-sm ${lastCreatedCoupon === coupon.id ? 'text-yellow-400' : 'text-teal-400'}`}>
            {coupon.coupon_code}
            {lastCreatedCoupon === coupon.id && <span className="ml-2 text-xs">✨ NEW</span>}
          </div>
          <Link to={createPageUrl('CouponDisplay') + `?coupon_code=${coupon.coupon_code}`} target="_blank">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )
    },
    {
      header: 'Customer',
      accessor: 'client_phone',
      cell: (coupon) => (
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#9ca3af]" />
          <span dir="ltr" className="text-sm">{coupon.client_phone}</span>
        </div>
      )
    },
    {
      header: 'Discount',
      accessor: 'discount_value',
      cell: (coupon) => (
        <div>
          <div className="font-semibold text-teal-400 text-sm">
            {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₪${coupon.discount_value}`}
          </div>
          {coupon.product_id && (
            <div className="text-xs text-amber-400 mt-0.5">📦 Product only</div>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      cell: (coupon) => <StatusBadge status={coupon.status} />
    },
    {
      header: 'Expiry',
      accessor: 'expires_at',
      cell: (coupon) => (
        <div className="flex items-center gap-1 text-xs text-[#9ca3af]">
          <Calendar className="w-3 h-3" />
          {format(new Date(coupon.expires_at), 'dd/MM/yyyy')}
        </div>
      )
    },
    {
      header: 'Uses',
      accessor: 'times_used',
      cell: (coupon) => (
        <span className="text-xs text-[#9ca3af]">{coupon.times_used}/{coupon.max_uses}</span>
      )
    },
    {
      header: 'Created',
      accessor: 'created_date',
      cell: (coupon) => <span className="text-xs text-[#9ca3af]">{format(new Date(coupon.created_date), 'dd/MM/yyyy HH:mm')}</span>
    },
    {
      header: 'Customer',
      accessor: 'client_id',
      cell: (coupon) => (
        <span className="text-xs text-teal-400">{coupon.client_id ? '✅ Assigned' : '—'}</span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      cell: (coupon) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
            onClick={() => { setAssigningCoupon(coupon); setAssignDialogOpen(true); setClientSearch(''); setSelectedClient(null); }}
          >
            <Send className="w-3 h-3 mr-1" />
            Assign to Client
          </Button>
          {coupon.status === 'active' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => cancelCouponMutation.mutate(coupon.id)}
              disabled={cancelCouponMutation.isPending}
            >
              <XCircle className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      )
    }
  ];

  const createManualCoupon = async () => {
    setCreatingManual(true);
    try {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (manualForm.expires_days || 30));
      const prefix = manualForm.product_id ? 'PROD' : 'MAN';
      const couponCode = `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const couponUrl = `https://mooadon.base44.app/CouponDisplay?coupon_code=${couponCode}`;
      const newCoupon = await base44.entities.Coupon.create({
        company_id: primaryCompanyId,
        client_phone: 'MANUAL-000',
        coupon_code: couponCode,
        discount_type: manualForm.discount_type,
        discount_value: parseFloat(manualForm.discount_value),
        max_uses: parseInt(manualForm.max_uses),
        status: 'active',
        expires_at: expiry.toISOString(),
        coupon_url: couponUrl,
        ...(manualForm.product_id ? { product_id: manualForm.product_id } : {})
      });
      setLastCreatedCoupon(newCoupon.id);
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success(`✅ Coupon created: ${couponCode}`);
      setManualDialogOpen(false);
      setTimeout(() => setLastCreatedCoupon(null), 3000);
    } finally {
      setCreatingManual(false);
    }
  };

  const createFromTemplate = async (template) => {
    setCreatingTemplate(template.id);
    try {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1); // 1 month expiry
      
      const couponCode = `${template.id.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const couponUrl = `https://mooadon.base44.app/CouponDisplay?coupon_code=${couponCode}`;
      
      const newCoupon = await base44.entities.Coupon.create({
        company_id: primaryCompanyId,
        client_phone: 'TEMPLATE-000',
        coupon_code: couponCode,
        ...template.config,
        status: 'active',
        expires_at: expiry.toISOString(),
        coupon_url: couponUrl
      });
      
      setLastCreatedCoupon(newCoupon.id);
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success(`✅ Coupon created: ${couponCode}`);
      
      // Scroll to coupons table
      setTimeout(() => {
        document.querySelector('[data-coupons-table]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      
      // Clear highlight after 3 seconds
      setTimeout(() => setLastCreatedCoupon(null), 3000);
    } finally {
      setCreatingTemplate(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Assign Coupon Modal */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="bg-[#1f2128] border-[#2d2d3a] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Assign Coupon to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {assigningCoupon && (
              <div className="bg-[#17171f] rounded-lg p-3 text-sm">
                <span className="text-[#9ca3af]">Coupon: </span>
                <span className="font-mono text-teal-400 font-semibold">{assigningCoupon.coupon_code}</span>
              </div>
            )}
            <div>
              <Label className="text-white">Search client by name / phone</Label>
              <Input
                placeholder="Type name or phone number..."
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(null); }}
                className="bg-[#17171f] border-[#2d2d3a] text-white mt-1"
                autoFocus
              />
            </div>
            {filteredClientResults.length > 0 && !selectedClient && (
              <div className="border border-[#2d2d3a] rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {filteredClientResults.map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#2d2d3a] transition-colors flex items-center gap-3"
                    onClick={() => { setSelectedClient(c); setClientSearch(c.full_name || c.phone); }}
                  >
                    <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
                      {(c.full_name || c.phone || '?').charAt(0)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{c.full_name || '—'}</p>
                      <p className="text-[#9ca3af] text-xs">{c.phone}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedClient && (
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-teal-400 shrink-0" />
                <div>
                  <p className="text-white text-sm font-medium">{selectedClient.full_name || selectedClient.phone}</p>
                  <p className="text-teal-400 text-xs">{selectedClient.phone}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#2d2d3a] text-white" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedClient || assignCouponMutation.isPending}
              onClick={() => assignCouponMutation.mutate({ couponId: assigningCoupon.id, clientId: selectedClient.id })}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assignCouponMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Coupon Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="bg-[#1f2128] border-[#2d2d3a] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Create Manual Coupon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Product (optional) */}
            <div>
              <Label className="text-white text-sm">Specific Product <span className="text-slate-500">(optional)</span></Label>
              <Select value={manualForm.product_id || 'general'} onValueChange={(v) => setManualForm(f => ({ ...f, product_id: v === 'general' ? '' : v }))}>
                <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                  <SelectItem value="general">General (any purchase)</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {manualForm.product_id && (
                <p className="text-xs text-amber-400 mt-1">⚠️ This coupon will only be valid for the selected product</p>
              )}
            </div>
            <div>
              <Label className="text-white text-sm">Discount Type</Label>
              <Select value={manualForm.discount_type} onValueChange={(v) => setManualForm(f => ({ ...f, discount_type: v }))}>
                <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed_amount">Fixed Amount (₪)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white text-sm">
                Discount Value {manualForm.discount_type === 'percentage' ? '(%)' : '(₪)'}
              </Label>
              <Input
                type="number"
                value={manualForm.discount_value}
                onChange={(e) => setManualForm(f => ({ ...f, discount_value: e.target.value }))}
                className="bg-[#17171f] border-[#2d2d3a] text-white mt-1"
                min="1"
              />
            </div>
            <div>
              <Label className="text-white text-sm">Max Uses</Label>
              <Input
                type="number"
                value={manualForm.max_uses}
                onChange={(e) => setManualForm(f => ({ ...f, max_uses: e.target.value }))}
                className="bg-[#17171f] border-[#2d2d3a] text-white mt-1"
                min="1"
              />
            </div>
            <div>
              <Label className="text-white text-sm">Expires in (days)</Label>
              <Input
                type="number"
                value={manualForm.expires_days}
                onChange={(e) => setManualForm(f => ({ ...f, expires_days: e.target.value }))}
                className="bg-[#17171f] border-[#2d2d3a] text-white mt-1"
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#2d2d3a] text-white" onClick={() => setManualDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={creatingManual}
              onClick={createManualCoupon}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {creatingManual ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Coupons & Discounts</h1>
          <p className="text-sm text-[#9ca3af] mt-1">Create special offers to reward your customers</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setManualDialogOpen(true)}
            className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Create Manual
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2 bg-[#1f2128] border-[#2d2d3a] text-white hover:bg-[#2d2d3a]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
      </div>
      
      {/* Templates Section */}
      {showTemplates && (
        <div className="bg-[#1f2128] border-[#2d2d3a] border rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-white">Quick Templates</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(false)}
              className="text-[#9ca3af] hover:text-white text-xs h-7"
            >
              Hide
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {COUPON_TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  onClick={() => createFromTemplate(template)}
                  disabled={creatingTemplate === template.id}
                  className="bg-[#17171f] border border-[#2d2d3a] hover:border-teal-500 rounded-lg p-2.5 text-left transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-r ${template.color} flex items-center justify-center flex-shrink-0`}>
                    {creatingTemplate === template.id ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Icon className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-medium truncate">{template.title}</p>
                    <p className="text-[#9ca3af] text-[10px] truncate">{template.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Show Templates Button when hidden */}
      {!showTemplates && (
        <Button
          variant="outline"
          onClick={() => setShowTemplates(true)}
          className="w-full border-[#2d2d3a] text-white hover:bg-[#2d2d3a]"
        >
          <Gift className="w-4 h-4 mr-2" />
          Show Coupon Templates
        </Button>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-[#9ca3af] flex items-center gap-2">
              <Ticket className="w-3.5 h-3.5" />
              Total Coupons
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold text-white">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-[#9ca3af] flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold text-white">{stats.active}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-[#9ca3af] flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" />
              Redeemed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold text-white">{stats.used}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-[#9ca3af] flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Expired
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold text-white">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af] w-4 h-4" />
            <Input
              placeholder="Search by coupon code or customer phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Coupons Table */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]" data-coupons-table>
        <CardHeader className="p-4 border-b border-[#2d2d3a]">
          <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            Your Coupons
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCoupons.length === 0 && !isLoading ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Ticket className="w-10 h-10 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No coupons yet</h3>
              <p className="text-[#9ca3af] mb-4">Use a template above to create your first coupon!</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredCoupons}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}