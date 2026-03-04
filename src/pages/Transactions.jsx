import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Filter,
  Receipt,
  Phone,
  Store,
  MessageSquare,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Link as LinkIcon,
  Hash,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function Transactions() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const { user, primaryCompanyId, loading } = useUserPermissions();
  const companyId = primaryCompanyId;

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', companyId],
    queryFn: () => base44.entities.Transaction.filter({ company_id: companyId }, '-created_date', 500),
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', companyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: companyId }),
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: ledgerEvents = [] } = useQuery({
    queryKey: ['ledger-events', companyId],
    queryFn: () => base44.entities.LedgerEvent.filter({ company_id: companyId }, '-created_date', 500),
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const getBranchName = (branchId) => {
    return branches.find(b => b.id === branchId)?.name || '-';
  };

  let filteredTransactions = transactions.filter(t => 
    t.client_phone?.includes(search) ||
    t.order_id?.toLowerCase().includes(search.toLowerCase())
  );

  if (statusFilter !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.status === statusFilter);
  }

  const columns = [
    { 
      header: 'Transaction', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            row.status === 'completed' ? 'bg-emerald-100' :
            row.status === 'pending' ? 'bg-amber-100' :
            'bg-slate-100'
          }`}>
            <Receipt className={`w-5 h-5 ${
              row.status === 'completed' ? 'text-emerald-600' :
              row.status === 'pending' ? 'text-amber-600' :
              'text-slate-600'
            }`} />
          </div>
          <div>
            <p className="font-medium text-white">₪{(row.amount || 0).toLocaleString()}</p>
            <p className="text-sm text-slate-400">
              {(row.tokens_actual || row.points_expected || 0).toLocaleString()} points
            </p>
          </div>
        </div>
      )
    },
    { 
      header: 'Client', 
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Phone className="w-3 h-3 text-slate-400" />
          {row.client_phone}
        </div>
      )
    },
    { 
      header: 'Branch', 
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Store className="w-3 h-3 text-slate-400" />
          {getBranchName(row.branch_id)}
        </div>
      )
    },
    { 
      header: 'Status', 
      cell: (row) => <StatusBadge status={row.status} />
    },
    { 
      header: 'SMS', 
      cell: (row) => (
        <div className="flex items-center gap-1">
          <MessageSquare className={`w-4 h-4 ${
            row.sms_status === 'sent' ? 'text-emerald-500' :
            row.sms_status === 'failed' ? 'text-rose-500' :
            'text-slate-400'
          }`} />
          <span className="text-sm">
            {row.sms_status === 'sent' ? 'Sent' :
             row.sms_status === 'failed' ? 'Failed' : 'Pending'}
          </span>
        </div>
      )
    },
    { 
      header: 'Order ID', 
      cell: (row) => (
        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
          {row.order_id || '-'}
        </code>
      )
    },
    { 
      header: 'Date', 
      cell: (row) => (
        <div className="flex items-center gap-1 text-slate-500">
          <Calendar className="w-3 h-3" />
          {row.created_date ? format(new Date(row.created_date), 'dd/MM/yy HH:mm') : '-'}
        </div>
      )
    },
  ];

  const stats = {
    total: transactions.length,
    completed: transactions.filter(t => t.status === 'completed').length,
    pending: transactions.filter(t => t.status === 'pending').length,
    totalAmount: transactions.reduce((s, t) => s + (t.amount || 0), 0),
    totalPoints: transactions.filter(t => t.status === 'completed')
      .reduce((s, t) => s + (t.points_actual || t.points_expected || 0), 0)
  };

  if (loading || !companyId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Transactions</h1>
        <p className="text-slate-400 mt-1">Complete transaction history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Total Transactions</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Completed</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Revenue</p>
          <p className="text-2xl font-bold text-white">₪{(stats.totalAmount || 0).toLocaleString()}</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Points Earned</p>
          <p className="text-2xl font-bold text-indigo-400">{(stats.totalPoints || 0).toLocaleString()}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Search by phone or order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-slate-900 border-slate-800 text-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 ml-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* POS Transactions */}
        <Card className="border-slate-800 bg-slate-900 shadow-sm">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-yellow-400" />
              POS Transactions
            </h2>
            <p className="text-sm text-slate-400 mt-1">Client purchases</p>
          </div>
          <CardContent className="p-0">
            <DataTable 
              columns={columns}
              data={filteredTransactions}
              isLoading={isLoading}
              emptyMessage="No POS transactions"
              onRowClick={(row) => setSelectedTransaction(row)}
            />
          </CardContent>
        </Card>

        {/* Ledger Events */}
        <Card className="border-slate-800 bg-slate-900 shadow-sm">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-indigo-400" />
              Token Activity
            </h2>
            <p className="text-sm text-slate-400 mt-1">All token movements</p>
          </div>
          <CardContent className="p-4">
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {ledgerEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    event.type === 'earn' ? 'bg-emerald-900/30' :
                    event.type === 'redeem' ? 'bg-purple-900/30' :
                    'bg-slate-800'
                  }`}>
                    {event.type === 'earn' ? (
                      <ArrowDownRight className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {(event.points || 0) > 0 ? '+' : ''}{(event.points || 0)} Stars
                    </p>
                    <p className="text-xs text-slate-400">{event.description || event.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">
                      {event.created_date ? format(new Date(event.created_date), 'HH:mm') : '-'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {event.created_date ? format(new Date(event.created_date), 'dd/MM') : '-'}
                    </p>
                  </div>
                </div>
              ))}
              {ledgerEvents.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p>No token activity yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Details Sheet */}
      <Sheet open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <SheetContent className="bg-slate-900 border-slate-800 w-full sm:max-w-lg overflow-y-auto">
          {selectedTransaction && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-yellow-400" />
                  Transaction Details
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Status</span>
                  <StatusBadge status={selectedTransaction.status} />
                </div>

                {/* Amount & Points */}
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Amount</span>
                    <span className="text-2xl font-bold text-white">
                      ₪{(selectedTransaction.amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Points Expected</span>
                    <span className="text-lg font-semibold text-indigo-400">
                      {(selectedTransaction.points_expected || 0).toLocaleString()}
                    </span>
                  </div>
                  {selectedTransaction.points_actual > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Points Actual</span>
                      <span className="text-lg font-semibold text-emerald-400">
                        {(selectedTransaction.points_actual || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedTransaction.token_symbol && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Token Symbol</span>
                      <code className="text-sm bg-slate-700 px-2 py-1 rounded text-white">
                        {selectedTransaction.token_symbol}
                      </code>
                    </div>
                  )}
                </div>

                {/* Customer Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Customer Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Phone
                      </span>
                      <span className="text-sm text-white">{selectedTransaction.client_phone}</span>
                    </div>
                    {selectedTransaction.client_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Client ID</span>
                        <code className="text-xs bg-slate-700 px-2 py-1 rounded text-white">
                          {selectedTransaction.client_id}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Branch Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Branch & Order</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Store className="w-4 h-4" />
                        Branch
                      </span>
                      <span className="text-sm text-white">{getBranchName(selectedTransaction.branch_id)}</span>
                    </div>
                    {selectedTransaction.order_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400 flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          Order ID
                        </span>
                        <code className="text-xs bg-slate-700 px-2 py-1 rounded text-white">
                          {selectedTransaction.order_id}
                        </code>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Hash Key
                      </span>
                      <code className="text-xs bg-slate-700 px-2 py-1 rounded text-white font-mono max-w-[200px] truncate" title={selectedTransaction.hash_key}>
                        {selectedTransaction.hash_key || '-'}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Claim Info */}
                {(selectedTransaction.claim_token || selectedTransaction.claim_url) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-white">Claim Information</h3>
                    <div className="space-y-2">
                      {selectedTransaction.claim_token && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Claim Token</span>
                          <code className="text-xs bg-slate-700 px-2 py-1 rounded text-white">
                            {selectedTransaction.claim_token.substring(0, 16)}...
                          </code>
                        </div>
                      )}
                      {selectedTransaction.claim_url && (
                        <div className="flex flex-col gap-2">
                          <span className="text-sm text-slate-400 flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" />
                            Payment Link
                          </span>
                          <a 
                            href={selectedTransaction.claim_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 break-all bg-slate-800 p-2 rounded"
                          >
                            {selectedTransaction.claim_url}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Blockchain Info */}
                {selectedTransaction.blockchain_tx_hash && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-white">Blockchain</h3>
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2">
                        <span className="text-sm text-slate-400">Transaction Hash</span>
                        <a 
                          href={`https://testnet.snowtrace.io/tx/${selectedTransaction.blockchain_tx_hash}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 break-all bg-slate-800 p-2 rounded"
                        >
                          {selectedTransaction.blockchain_tx_hash}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                      {selectedTransaction.blockchain_confirmed_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            Confirmed
                          </span>
                          <span className="text-sm text-white">
                            {format(new Date(selectedTransaction.blockchain_confirmed_at), 'dd/MM/yy HH:mm')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SMS Status */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Notifications</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        SMS Status
                      </span>
                      <span className={`text-sm flex items-center gap-1 ${
                        selectedTransaction.sms_status === 'sent' ? 'text-emerald-400' :
                        selectedTransaction.sms_status === 'failed' ? 'text-rose-400' :
                        'text-slate-400'
                      }`}>
                        {selectedTransaction.sms_status === 'sent' && <CheckCircle className="w-4 h-4" />}
                        {selectedTransaction.sms_status === 'failed' && <XCircle className="w-4 h-4" />}
                        {selectedTransaction.sms_status === 'sent' ? 'Sent' :
                         selectedTransaction.sms_status === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </div>
                    {selectedTransaction.sms_sent_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Sent At</span>
                        <span className="text-sm text-white">
                          {format(new Date(selectedTransaction.sms_sent_at), 'dd/MM/yy HH:mm')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Timeline</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Created
                      </span>
                      <span className="text-sm text-white">
                        {selectedTransaction.created_date ? format(new Date(selectedTransaction.created_date), 'dd/MM/yy HH:mm:ss') : '-'}
                      </span>
                    </div>
                    {selectedTransaction.claimed_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Claimed</span>
                        <span className="text-sm text-white">
                          {format(new Date(selectedTransaction.claimed_at), 'dd/MM/yy HH:mm:ss')}
                        </span>
                      </div>
                    )}
                    {selectedTransaction.expires_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Expires</span>
                        <span className="text-sm text-white">
                          {format(new Date(selectedTransaction.expires_at), 'dd/MM/yy HH:mm:ss')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                {selectedTransaction.metadata && Object.keys(selectedTransaction.metadata).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-white">Additional Data</h3>
                    <pre className="text-xs bg-slate-800 p-3 rounded overflow-x-auto text-slate-300">
                      {JSON.stringify(selectedTransaction.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}