import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Receipt, Package, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

function getExplorerUrl(txHash, network) {
  if (!txHash) return null;
  return network === 'mainnet' || network === 'avalanche'
    ? `https://snowtrace.io/tx/${txHash}`
    : `https://testnet.snowtrace.io/tx/${txHash}`;
}

export default function TransactionsTab({ companyId }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', companyId],
    queryFn: () => base44.entities.Transaction.filter({ company_id: companyId }, '-created_date'),
    enabled: !!companyId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', companyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));

  const filtered = transactions.filter(t => {
    const matchesSearch = !search || 
      t.client_phone?.includes(search) || 
      t.order_id?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: transactions.length,
    completed: transactions.filter(t => t.status === 'completed').length,
    pending: transactions.filter(t => t.status === 'pending').length,
    amount: transactions.reduce((s, t) => s + (t.amount || 0), 0),
    points: transactions.reduce((s, t) => s + (t.points_actual || 0), 0),
  };

  const columns = [
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
      cell: (row) => (
        <div>
          <span className="text-yellow-400 font-medium">{row.points_expected?.toLocaleString()}</span>
          {row.points_actual > 0 && row.points_actual !== row.points_expected && (
            <span className="text-emerald-500 text-xs mr-1">
              ({row.points_actual})
            </span>
          )}
        </div>
      )
    },
    { 
      header: 'branch', 
      cell: (row) => <span className="text-slate-300">{branchMap[row.branch_id] || '-'}</span>
    },
    { 
      header: 'status', 
      cell: (row) => <StatusBadge status={row.status} />
    },
    { 
      header: 'SMS', 
      cell: (row) => <StatusBadge status={row.sms_status} />
    },
    // ✅ Blockchain delivery status column with correct network-aware explorer link
    {
      header: 'Blockchain',
      cell: (row) => {
        const explorerUrl = getExplorerUrl(row.blockchain_tx_hash, row.metadata?.network || row.network);
        if (explorerUrl) {
          return (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs"
            >
              <CheckCircle className="w-3 h-3" />
              <span>{row.blockchain_tx_hash.substring(0, 8)}...</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          );
        }
        const deliveryStatus = row.token_delivery_status;
        if (deliveryStatus === 'failed_permanent') {
          return (
            <span className="flex items-center gap-1 text-red-400 text-xs">
              <XCircle className="w-3 h-3" />
              Failed
            </span>
          );
        }
        if (deliveryStatus === 'retrying') {
          return <span className="text-yellow-400 text-xs">Retrying...</span>;
        }
        return <span className="text-slate-500 text-xs">Pending</span>;
      }
    },
    { 
      header: 'invitation', 
      cell: (row) => row.order_id ? (
        <div className="flex items-center gap-1">
          <Package className="w-3 h-3 text-slate-400" />
          <code className="text-xs text-indigo-300">{row.order_id.substring(0, 8)}</code>
        </div>
      ) : <span className="text-slate-500">-</span>
    },
    { 
      header: 'date', 
      cell: (row) => (
        <span className="text-slate-400">
          {row.created_date ? format(new Date(row.created_date), 'dd/MM HH:mm') : '-'}
        </span>
      )
    },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Transactions</h2>
        <p className="text-slate-400 mt-1">Transaction history and tracking</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Total</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </Card>
        <Card className="border-emerald-800/50 bg-emerald-900/10 shadow-sm p-4">
          <p className="text-sm text-emerald-400">Completed</p>
          <p className="text-2xl font-bold text-white">{stats.completed}</p>
        </Card>
        <Card className="border-yellow-800/50 bg-yellow-900/10 shadow-sm p-4">
          <p className="text-sm text-yellow-400">Waiting</p>
          <p className="text-2xl font-bold text-white">{stats.pending}</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Total money</p>
          <p className="text-2xl font-bold text-white">₪{stats.amount.toLocaleString()}</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Total Points</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.points.toLocaleString()}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Search by phone or order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-slate-900 border-slate-800 text-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-slate-900 border-slate-800 text-white">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="completed">completed</SelectItem>
            <SelectItem value="expired">expired</SelectItem>
            <SelectItem value="cancelled">cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-slate-800 bg-slate-900 shadow-lg">
        <CardContent className="p-0">
          <DataTable 
            columns={columns}
            data={filtered}
            isLoading={isLoading}
            emptyMessage="No transactions found"
          />
        </CardContent>
      </Card>
    </div>
  );
}