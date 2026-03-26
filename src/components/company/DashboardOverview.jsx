import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import StatsCard from '@/components/ui/StatsCard';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BranchBreakdown from '@/components/company/BranchBreakdown';
import OnchainBalanceCard from '@/components/company/OnchainBalanceCard';
import { 
  Users, 
  Store, 
  Receipt, 
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Wallet
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function DashboardOverview({ companyId, company }) {
  const { data: branches = [] } = useQuery({
    queryKey: ['branches', companyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['transactions', companyId],
    queryFn: () => base44.entities.Transaction.filter({ company_id: companyId }, '-created_date', 100),
    enabled: !!companyId,
  });

  const { data: ledgerEvents = [] } = useQuery({
    queryKey: ['ledger', companyId],
    queryFn: () => base44.entities.LedgerEvent.filter({ company_id: companyId }, '-created_date', 500),
    enabled: !!companyId,
  });

  // Stats calculations
  const totalEarned = ledgerEvents
    .filter(e => e.type === 'earn')
    .reduce((sum, e) => sum + (e.points || 0), 0);
  
  const totalRedeemed = Math.abs(
    ledgerEvents
      .filter(e => e.type === 'redeem')
      .reduce((sum, e) => sum + (e.points || 0), 0)
  );

  const totalBalance = clients.reduce((sum, c) => sum + (c.current_balance || 0), 0);

  // Chart data - last 7 days
  const chartData = [...Array(7)].map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEvents = ledgerEvents.filter(e => 
      e.created_date?.startsWith(dateStr)
    );
    const earned = dayEvents.filter(e => e.type === 'earn').reduce((s, e) => s + (e.points || 0), 0);
    const redeemed = Math.abs(dayEvents.filter(e => e.type === 'redeem').reduce((s, e) => s + (e.points || 0), 0));
    
    return {
      date: format(date, 'dd/MM'),
      accumulation: earned,
      redeemed: redeemed
    };
  });

  const recentTxColumns = [
    { 
      header: 'customer', 
      cell: (row) => <span className="text-white">{row.client_phone}</span>
    },
    { 
      header: 'amount', 
      cell: (row) => <span className="text-slate-300">₪{row.amount?.toLocaleString()}</span>
    },
    { 
      header: 'Points', 
      cell: (row) => <span className="text-yellow-400">{row.points_expected?.toLocaleString()}</span>
    },
    { 
      header: 'status', 
      cell: (row) => <StatusBadge status={row.status} />
    },
    { 
      header: 'date', 
      cell: (row) => <span className="text-slate-400">{row.created_date ? format(new Date(row.created_date), 'dd/MM HH:mm') : '-'}</span>
    },
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Points earned "
          value={totalEarned.toLocaleString()}
          subtitle={company?.points_name || 'Points'}
          icon={TrendingUp}
          className="border-emerald-800/50 bg-emerald-900/10"
        />
        <StatsCard
          title="Points redeemed"
          value={totalRedeemed.toLocaleString()}
          subtitle="Total realizations"
          icon={TrendingDown}
          className="border-rose-800/50 bg-rose-900/10"
        />
        <StatsCard
          title="Current balance"
          value={totalBalance.toLocaleString()}
          subtitle="Total customer balances"
          icon={Wallet}
          className="border-yellow-800/50 bg-yellow-900/10"
        />
        <StatsCard
          title="Active customers"
          value={clients.length.toLocaleString()}
          subtitle={`${branches.filter(b => b.status === 'active').length} branches`}
          icon={Users}
          className="border-indigo-800/50 bg-indigo-900/10"
        />
      </div>

      {/* Chart + Onchain Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-slate-800 bg-slate-900 shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Last 7 days activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEarn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRedeem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155', 
                      borderRadius: '12px',
                      color: '#f1f5f9'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="accumulation" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorEarn)" 
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Redeem" 
                    stroke="#f43f5e" 
                    fillOpacity={1} 
                    fill="url(#colorRedeem)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <OnchainBalanceCard company={company} totalBalance={totalBalance} />
      </div>

      {/* Branch Breakdown */}
      <BranchBreakdown 
        branches={branches}
        transactions={transactions}
        ledgerEvents={ledgerEvents}
      />

      {/* Recent Transactions */}
      <Card className="border-slate-800 bg-slate-900 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Receipt className="w-5 h-5" />
           Recent transactions
          </CardTitle>
          <Link to={createPageUrl('POSTerminal')}>
            <Button variant="outline" size="sm" className="text-slate-300 border-slate-700 hover:bg-slate-800">
              <Store className="w-4 h-4 ml-2" />
             Cash register
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={recentTxColumns}
            data={transactions.slice(0, 10)}
            isLoading={loadingTx}
            emptyMessage="no transactions"
          />
        </CardContent>
      </Card>
    </>
  );
}