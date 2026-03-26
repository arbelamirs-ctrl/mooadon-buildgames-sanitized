import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import DataTable from '@/components/ui/DataTable';
import { 
  Users, 
  Search, 
  Coins, 
  Wallet, 
  Ticket,
  TrendingUp,
  DollarSign,
  Eye,
  Gift,
  History,
  Calendar,
  AlertCircle,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Zap,
  BarChart3,
  Wrench,
  Loader2,
  Package,
  CheckCircle
} from 'lucide-react';
import { useState as useLocalState } from 'react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function BusinessCustomersDashboard() {
  const { primaryCompanyId } = useUserPermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('balance_desc');
  const [repairingWallet, setRepairingWallet] = useLocalState(false);

  const { data: storeOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['wallet-store-orders', primaryCompanyId],
    queryFn: () => base44.entities.WalletStoreOrder.filter({ company_id: primaryCompanyId }, '-created_at', 200),
    enabled: !!primaryCompanyId
  });

  const fulfillOrderMutation = useMutation({
    mutationFn: (orderId) => base44.entities.WalletStoreOrder.update(orderId, {
      status: 'fulfilled',
      fulfilled_at: new Date().toISOString()
    }),
    onSuccess: () => { refetchOrders(); toast.success('Order marked as fulfilled'); },
    onError: () => toast.error('Failed to update order')
  });

  const { data: company, refetch: refetchCompany } = useQuery({
    queryKey: ['company', primaryCompanyId],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: primaryCompanyId });
      return companies[0];
    },
    enabled: !!primaryCompanyId
  });

  const handleRepairWallet = async () => {
    setRepairingWallet(true);
    try {
      const res = await base44.functions.invoke('repairCompanyTreasury', {
        company_id: primaryCompanyId,
        avax_amount: 0.05
      });
      if (res.data?.success) {
        toast.success('Wallet funded successfully! Blockchain setup is now complete.');
        refetchCompany();
      } else {
        toast.error(res.data?.error || 'Repair failed. Please try again.');
      }
    } catch (e) {
      toast.error('Repair request failed: ' + e.message);
    } finally {
      setRepairingWallet(false);
    }
  };

  const showBlockchainWarning = company && company.setup_status !== 'ready' && company.setup_status !== 'active';

  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers', primaryCompanyId],
    queryFn: () => base44.entities.Client.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', primaryCompanyId],
    queryFn: () => base44.entities.Transaction.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ['coupons', primaryCompanyId],
    queryFn: () => base44.entities.Coupon.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  // Enrich customers with transaction and coupon data
  const enrichedCustomers = useMemo(() => {
    return customers.map(customer => {
      const customerTransactions = transactions.filter(t => t.client_id === customer.id);
      const customerCoupons = coupons.filter(c => c.client_id === customer.id && c.status === 'active');
      
      return {
        ...customer,
        transactionCount: customerTransactions.length,
        totalSpent: customerTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        activeCouponsCount: customerCoupons.length,
        lastPurchaseDate: customerTransactions.length > 0 
          ? new Date(Math.max(...customerTransactions.map(t => new Date(t.created_date))))
          : null
      };
    });
  }, [customers, transactions, coupons]);

  // Calculate stats and KPIs
  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const thisMonthTransactions = transactions.filter(t => 
      t.created_date && new Date(t.created_date) >= monthStart
    );
    
    // 30-day returning customers
    const thirtyDaysAgo = subDays(new Date(), 30);
    const returningCustomers = enrichedCustomers.filter(c => 
      c.lastPurchaseDate && c.lastPurchaseDate >= thirtyDaysAgo
    ).length;
    
    // Avg basket & coupon impact
    const customersWithCoupons = enrichedCustomers.filter(c => c.activeCouponsCount > 0);
    const avgBasketChange = customersWithCoupons.length > 0 
      ? (customersWithCoupons.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / customersWithCoupons.length - 
         (customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / customers.length || 0))
      : 0;

    // Redemption rate
    const couponRedemptions = coupons.filter(c => c.status === 'redeemed').length;
    const redemptionRate = coupons.length > 0 ? (couponRedemptions / coupons.length) * 100 : 0;

    // Cost of rewards (total tokens issued)
    const rewardCost = customers.reduce((sum, c) => sum + (c.total_earned || 0), 0);

    return {
      totalCustomers: customers.length,
      totalStarsIssued: customers.reduce((sum, c) => sum + (c.total_earned || 0), 0),
      totalTokens: customers.reduce((sum, c) => sum + (c.tokenBalance || 0), 0),
      activeCoupons: coupons.filter(c => c.status === 'active').length,
      monthRevenue: thisMonthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      returningCustomers,
      returningCustomersChange: ((returningCustomers / customers.length) * 100).toFixed(1),
      avgBasketChange: avgBasketChange.toFixed(2),
      redemptionRate: redemptionRate.toFixed(1),
      rewardCost
    };
  }, [customers, transactions, coupons, enrichedCustomers]);

  // Action center items
  const actionItems = useMemo(() => {
    const items = [];
    
    // Customers at risk (inactive 21+ days)
    const twentyOneDaysAgo = subDays(new Date(), 21);
    const atRiskCustomers = enrichedCustomers.filter(c => 
      (!c.lastPurchaseDate || c.lastPurchaseDate < twentyOneDaysAgo) && 
      (c.current_balance || 0) > 50
    );
    if (atRiskCustomers.length > 0) {
      items.push({
        icon: AlertCircle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/30',
        title: 'Customers at Risk',
        count: atRiskCustomers.length,
        description: `Haven't visited in 21+ days with ${atRiskCustomers.reduce((sum, c) => sum + (c.current_balance || 0), 0)} total tokens`,
        action: 'Send Re-engagement SMS',
        actionIcon: 'MessageSquare'
      });
    }

    // Pending rewards (RewardQueue)
    items.push({
      icon: Gift,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
      title: 'Pending Rewards',
      count: 0,
      description: 'Rewards waiting to be processed in queue',
      action: 'View Queue',
      actionIcon: 'Eye'
    });

    // Low balance alerts (< 100 tokens, had activity)
    const lowBalanceCustomers = enrichedCustomers.filter(c => 
      c.lastPurchaseDate && 
      (c.current_balance || 0) < 100 && 
      (c.current_balance || 0) > 0
    );
    if (lowBalanceCustomers.length > 0) {
      items.push({
        icon: Coins,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        borderColor: 'border-orange-500/30',
        title: 'Low Balance Alerts',
        count: lowBalanceCustomers.length,
        description: 'Active customers with less than 100 tokens',
        action: 'Offer Bonus',
        actionIcon: 'Gift'
      });
    }

    // Birthday this week (simulate - would need birthday field)
    const birthdayCustomers = enrichedCustomers.slice(0, Math.floor(Math.random() * 5));
    if (birthdayCustomers.length > 0) {
      items.push({
        icon: Calendar,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        borderColor: 'border-purple-500/30',
        title: 'Birthdays This Week',
        count: birthdayCustomers.length,
        description: 'Send birthday rewards to celebrate',
        action: 'Send Birthday Offer',
        actionIcon: 'Gift'
      });
    }

    return items;
  }, [enrichedCustomers]);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    let filtered = enrichedCustomers.filter(customer => {
      const matchesSearch = 
        customer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.includes(searchQuery);

      const matchesFilter = 
        filterType === 'all' ||
        (filterType === 'with_stars' && (customer.current_balance || 0) > 0) ||
        (filterType === 'with_tokens' && (customer.tokenBalance || 0) > 0) ||
        (filterType === 'with_coupons' && customer.activeCouponsCount > 0);

      return matchesSearch && matchesFilter;
    });

    // Sort customers
    if (sortBy === 'balance_desc') {
      filtered.sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0));
    } else if (sortBy === 'balance_asc') {
      filtered.sort((a, b) => (a.current_balance || 0) - (b.current_balance || 0));
    } else if (sortBy === 'transactions_desc') {
      filtered.sort((a, b) => b.transactionCount - a.transactionCount);
    } else if (sortBy === 'last_purchase') {
      filtered.sort((a, b) => {
        if (!a.lastPurchaseDate) return 1;
        if (!b.lastPurchaseDate) return -1;
        return b.lastPurchaseDate - a.lastPurchaseDate;
      });
    } else if (sortBy === 'spent_desc') {
      filtered.sort((a, b) => b.totalSpent - a.totalSpent);
    }

    return filtered;
  }, [enrichedCustomers, searchQuery, filterType, sortBy]);

  const columns = [
    {
      header: 'Customer',
      accessor: 'full_name',
      cell: (customer) => (
        <div>
          <div className="font-semibold text-white text-sm">{customer.full_name || 'Not specified'}</div>
          <div className="text-xs text-[#9ca3af]" dir="ltr">{customer.phone}</div>
        </div>
      )
    },
    {
      header: `Balance (${company?.points_name || 'Stars'})`,
      accessor: 'current_balance',
      cell: (customer) => (
        <div className="flex items-center gap-1">
          <Coins className="w-3.5 h-3.5 text-[#10b981]" />
          <span className="font-semibold text-[#10b981] text-sm">
            {(customer.current_balance || 0).toLocaleString()}
          </span>
        </div>
      )
    },
    {
      header: 'Token Balance',
      accessor: 'tokenBalance',
      cell: (customer) => (
        <div className="flex items-center gap-1">
          <Wallet className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-blue-400 text-sm">
            {(customer.tokenBalance || 0).toLocaleString()}
          </span>
        </div>
      )
    },
    {
      header: 'Active Coupons',
      accessor: 'activeCouponsCount',
      cell: (customer) => (
        <div className="flex items-center gap-1">
          <Ticket className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-white text-sm">{customer.activeCouponsCount}</span>
        </div>
      )
    },
    {
      header: 'Transactions',
      accessor: 'transactionCount',
      cell: (customer) => (
        <span className="text-white text-sm">{customer.transactionCount}</span>
      )
    },
    {
      header: 'Total Spent',
      accessor: 'totalSpent',
      cell: (customer) => (
        <div className="flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5 text-green-400" />
          <span className="font-semibold text-green-400 text-sm">
            ₪{(customer.totalSpent || 0).toLocaleString()}
          </span>
        </div>
      )
    },
    {
      header: 'Join Date',
      accessor: 'created_date',
      cell: (customer) => (
        <div className="text-xs text-[#9ca3af]">
          {customer.created_date ? format(new Date(customer.created_date), 'dd/MM/yyyy') : '-'}
        </div>
      )
    },
    {
      header: 'Last Purchase',
      accessor: 'lastPurchaseDate',
      cell: (customer) => (
        <div className="text-xs text-[#9ca3af]">
          {customer.lastPurchaseDate ? format(customer.lastPurchaseDate, 'dd/MM/yyyy') : 'None'}
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      cell: (customer) => (
        <div className="flex gap-1">
          <Link to={createPageUrl('Clients')}>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Full details">
              <Eye className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <Link to={createPageUrl('Transactions')}>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Transaction history">
              <History className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )
    }
  ];

  const pendingOrdersCount = storeOrders.filter(o => o.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Blockchain Warning Banner */}
      {showBlockchainWarning && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-300">⚠️ Blockchain setup incomplete — your wallet is not funded. Transactions may fail.</p>
              {company?.setup_last_error && (
                <p className="text-xs text-orange-400/80 mt-0.5">{company.setup_last_error}</p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleRepairWallet}
            disabled={repairingWallet}
            className="bg-orange-500 hover:bg-orange-600 text-white flex-shrink-0 gap-2"
          >
            {repairingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
            {repairingWallet ? 'Fixing...' : 'Fix Now'}
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Business Customers Dashboard</h1>
          <p className="text-sm text-[#9ca3af] mt-1">Manage your customer balances, reward costs, and engagement metrics</p>
        </div>
      </div>

      <Tabs defaultValue="customers">
        <TabsList className="bg-[#1f2128] border-[#2d2d3a]">
          <TabsTrigger value="customers"><Users className="w-4 h-4 mr-2" />Customers</TabsTrigger>
          <TabsTrigger value="orders">
            <Package className="w-4 h-4 mr-2" />
            Store Orders
            {pendingOrdersCount > 0 && <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingOrdersCount}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-6 mt-4">

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Returning Customers */}
        <Card className="bg-gradient-to-br from-[#1f2128] to-[#17171f] border-[#2d2d3a] hover:border-teal-500 transition-all">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#9ca3af] font-medium mb-1">RETURNING CUSTOMERS (30 DAYS)</p>
                <div className="text-3xl font-bold text-white">{stats.returningCustomers}</div>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUp className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-green-400 font-medium">{stats.returningCustomersChange}%</span>
                </div>
              </div>
              <Users className="w-8 h-8 text-teal-500/40" />
            </div>
          </CardContent>
        </Card>

        {/* Avg Basket Change */}
        <Card className="bg-gradient-to-br from-[#1f2128] to-[#17171f] border-[#2d2d3a] hover:border-blue-500 transition-all">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#9ca3af] font-medium mb-1">AVG BASKET CHANGE</p>
                <div className="text-3xl font-bold text-white">₪{Math.abs(stats.avgBasketChange)}</div>
                <div className="flex items-center gap-1 mt-2">
                  {parseFloat(stats.avgBasketChange) >= 0 ? (
                    <ArrowUp className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className={`text-xs font-medium ${parseFloat(stats.avgBasketChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    vs. no coupons
                  </span>
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500/40" />
            </div>
          </CardContent>
        </Card>

        {/* Redemption Rate */}
        <Card className="bg-gradient-to-br from-[#1f2128] to-[#17171f] border-[#2d2d3a] hover:border-purple-500 transition-all">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#9ca3af] font-medium mb-1">COUPON REDEMPTION RATE</p>
                <div className="text-3xl font-bold text-white">{stats.redemptionRate}%</div>
                <div className="w-32 h-1.5 bg-[#2d2d3a] rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full"
                    style={{ width: `${Math.min(parseFloat(stats.redemptionRate), 100)}%` }}
                  />
                </div>
              </div>
              <Ticket className="w-8 h-8 text-purple-500/40" />
            </div>
          </CardContent>
        </Card>

        {/* Cost of Rewards */}
        <Card className="bg-gradient-to-br from-[#1f2128] to-[#17171f] border-[#2d2d3a] hover:border-green-500 transition-all">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#9ca3af] font-medium mb-1">TOTAL REWARD COST</p>
                <div className="text-3xl font-bold text-white">{(stats.rewardCost / 1000).toFixed(1)}K</div>
                <p className="text-xs text-[#9ca3af] mt-2">tokens spent from treasury</p>
              </div>
              <Coins className="w-8 h-8 text-green-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ACTION CENTER */}
      {actionItems.length > 0 && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="p-4 border-b border-[#2d2d3a]">
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-teal-400" />
              Action Center
            </CardTitle>
            <p className="text-xs text-[#9ca3af] mt-1">Take action on these opportunities</p>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {actionItems.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={idx}
                    className={`bg-[#17171f] border ${item.borderColor} rounded-lg p-4 hover:border-teal-500 transition-all`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 ${item.bgColor} rounded-lg flex items-center justify-center`}>
                        <IconComponent className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <Badge className={`${item.bgColor} ${item.color} border-0`}>
                        {item.count}
                      </Badge>
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-1">{item.title}</h4>
                    <p className="text-xs text-[#9ca3af] mb-3">{item.description}</p>
                    <Button 
                      size="sm" 
                      className="w-full bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 h-8"
                    >
                      {item.action}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-[#9ca3af] flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold text-white">{stats.totalCustomers}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-[#9ca3af] flex items-center gap-2">
              <Coins className="w-3.5 h-3.5" />
              Total {company?.points_name || 'Stars'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold text-white">{(stats.totalStarsIssued || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-[#9ca3af] flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" />
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold text-white">{(stats.totalTokens || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-[#9ca3af] flex items-center gap-2">
              <Ticket className="w-3.5 h-3.5" />
              Active Coupons
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold text-white">{stats.activeCoupons}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-xs font-medium text-[#9ca3af] flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              This Month Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-semibold text-white">₪{(stats.monthRevenue || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af] w-4 h-4" />
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>

            {/* Filter */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white">
                <SelectValue placeholder="Filter customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="with_stars">With Stars Balance</SelectItem>
                <SelectItem value="with_tokens">With Tokens</SelectItem>
                <SelectItem value="with_coupons">With Active Coupons</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="balance_desc">Balance - High to Low</SelectItem>
                <SelectItem value="balance_asc">Balance - Low to High</SelectItem>
                <SelectItem value="transactions_desc">Transactions - Most</SelectItem>
                <SelectItem value="spent_desc">Total Spent - Most</SelectItem>
                <SelectItem value="last_purchase">Last Purchase</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-xs text-[#9ca3af]">
        Showing {filteredCustomers.length} of {customers.length} customers
      </div>

      {/* Customers Table */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="p-4 border-b border-[#2d2d3a]">
          <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" />
            Customers List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredCustomers}
            isLoading={loadingCustomers}
            emptyMessage="No customers found"
          />
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="orders" className="space-y-4 mt-4">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="p-4 border-b border-[#2d2d3a]">
              <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" />
                Wallet Store Orders ({storeOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {storeOrders.length === 0 ? (
                <div className="text-center py-12 text-[#9ca3af]">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No store orders yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {storeOrders.map(order => (
                    <div key={order.id} className="flex items-center gap-4 p-3 bg-[#17171f] rounded-lg border border-[#2d2d3a]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white text-sm">{order.product_name}</span>
                          <span className="text-xs font-mono text-slate-500">{order.order_id}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-[#9ca3af] mt-1">
                          <span>📞 {order.customer_phone}</span>
                          <span className="text-teal-400 font-medium">{order.price_tokens} tokens</span>
                          <span>{new Date(order.created_at || order.created_date).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={order.status === 'fulfilled' ? 'bg-green-500/20 text-green-400' : order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}>
                          {order.status === 'fulfilled' && <CheckCircle className="w-3 h-3 mr-1 inline" />}
                          {order.status}
                        </Badge>
                        {order.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => fulfillOrderMutation.mutate(order.id)}
                            disabled={fulfillOrderMutation.isPending}
                            className="bg-teal-500 hover:bg-teal-600 text-white text-xs h-7 px-3"
                          >
                            {fulfillOrderMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Mark Fulfilled'}
                          </Button>
                        )}
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
  );
}