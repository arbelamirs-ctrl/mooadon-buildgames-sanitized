import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, XCircle, Loader2, Search, ExternalLink, ChevronRight, Trash2, X, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
  failed:    'bg-red-500/20 text-red-400 border-red-500/30',
  blockchain_failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  expired:   'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const STATUS_ICON = {
  completed: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  pending:   <Clock className="w-4 h-4 text-amber-400" />,
  failed:    <XCircle className="w-4 h-4 text-red-400" />,
  blockchain_failed: <XCircle className="w-4 h-4 text-red-400" />,
  cancelled: <XCircle className="w-4 h-4 text-slate-400" />,
  expired:   <XCircle className="w-4 h-4 text-slate-400" />,
};

// Wallet address display component with copy button
function WalletAddress({ address }) {
  const [copied, setCopied] = useState(false);

  if (!address) return <span className="text-slate-600 text-xs">—</span>;

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Wallet address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs text-blue-400">{truncated}</span>
      <button
        onClick={handleCopy}
        className="p-0.5 hover:bg-blue-500/20 rounded transition-colors"
        title="Copy wallet address"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3 text-slate-400 hover:text-blue-400" />
        )}
      </button>
    </div>
  );
}

export default function Transactions() {
  const { primaryCompanyId, isSystemAdmin } = useUserPermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [cancellingTxId, setCancellingTxId] = useState(null);
  const [deletingTxId, setDeletingTxId] = useState(null);

  const cancelMutation = useMutation({
    mutationFn: async (txId) => {
      const result = await base44.functions.invoke('cancelPendingTransaction', { transaction_id: txId });
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions-page'] });
      toast.success('✅ Transaction cancelled');
      setSelectedTx(null);
      setCancellingTxId(null);
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error.message}`);
      setCancellingTxId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (txId) => {
      return await base44.asServiceRole.entities.Transaction.delete(txId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions-page'] });
      toast.success('✅ Transaction deleted');
      setDeletingTxId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
      setDeletingTxId(null);
    }
  });

  const companyId = primaryCompanyId;

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions-page', companyId, isSystemAdmin],
    queryFn: () => {
      if (!companyId) return [];
      return base44.entities.Transaction.filter(
        { company_id: companyId },
        '-created_date',
        200
      );
    },
    enabled: !!companyId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Fetch clients to get wallet addresses
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-wallet', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await base44.entities.Client.filter({ company_id: companyId });
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  // Create a phone -> wallet map
  const phoneToWallet = React.useMemo(() => {
    const map = {};
    clients.forEach(client => {
      if (client.phone && client.wallet_address) {
        map[client.phone] = client.wallet_address;
      }
    });
    return map;
  }, [clients]);

  // Fetch client details when transaction is selected
  React.useEffect(() => {
    if (selectedTx?.client_phone) {
      const client = clients.find(c => c.phone === selectedTx.client_phone);
      setSelectedClient(client || null);
    }
  }, [selectedTx, clients]);

  const filtered = transactions.filter(tx => {
    const matchSearch = !search ||
      tx.client_phone?.includes(search) ||
      tx.order_id?.toLowerCase().includes(search.toLowerCase()) ||
      tx.blockchain_tx_hash?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || tx.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filtered.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const totalTokens  = filtered.reduce((s, t) => s + (t.tokens_actual || t.tokens_expected || 0), 0);

  return (
    <div className="min-h-screen bg-[#17171f] overflow-x-hidden">
      <div className="max-w-full mx-auto p-3 lg:p-4">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-sm text-slate-400 mt-1">
            {companyId ? `Company: ${companyId}` : 'No company selected'}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6">
          {[
            { label: 'Total Transactions', value: filtered.length },
            { label: 'Total Revenue', value: `₪${totalRevenue.toLocaleString()}` },
            { label: 'Tokens Distributed', value: totalTokens.toLocaleString() },
            {
              label: 'Completed',
              value: filtered.filter(t => t.status === 'completed').length,
            },
          ].map(s => (
            <div key={s.label} className="bg-[#1f2128] border border-[#2d2d3a] rounded-lg p-3 sm:p-4">
              <div className="text-lg sm:text-xl font-bold text-white break-words">{s.value}</div>
              <div className="text-xs text-slate-400 mt-1 break-words">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 flex-shrink-0" />
            <Input
              placeholder="Search phone, order ID, tx hash..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-full bg-[#1f2128] border-[#2d2d3a] text-white text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-[#1f2128] border-[#2d2d3a] text-white text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="blockchain_failed">Blockchain Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
          </div>
        ) : (
          <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-lg overflow-hidden">
            <div className="overflow-x-auto -mx-3 sm:-mx-4 lg:mx-0">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#2d2d3a] text-slate-400 text-xs uppercase bg-[#17171f]">
                    <th className="text-left px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Status</th>
                    <th className="text-left px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Phone</th>
                    <th className="text-left px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Wallet</th>
                    <th className="text-left px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Amount</th>
                    <th className="text-left px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Tokens</th>
                    <th className="text-left px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Order ID</th>
                    <th className="text-left px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Date</th>
                    <th className="text-left px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Blockchain</th>
                    <th className="text-right px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-500">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    filtered.map(tx => (
                       <tr 
                         key={tx.id} 
                         onClick={() => setSelectedTx(tx)}
                         className="border-b border-[#2d2d3a] hover:bg-[#1a1a22] transition-colors cursor-pointer text-xs sm:text-sm"
                       >
                         <td className="px-2 sm:px-3 py-2 sm:py-3">
                          <div className="flex items-center gap-1">
                            {STATUS_ICON[tx.status] || <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" />}
                            <Badge className={`text-xs border whitespace-nowrap ${STATUS_COLORS[tx.status] || 'bg-slate-500/20 text-slate-400'}`}>
                              {tx.status}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-white font-mono text-xs whitespace-nowrap">{tx.client_phone}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3">
                          <WalletAddress address={phoneToWallet[tx.client_phone]} />
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-white font-semibold whitespace-nowrap">₪{tx.amount}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-teal-400 font-semibold whitespace-nowrap">
                          {tx.tokens_actual ?? tx.tokens_expected ?? 0}
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-slate-400 text-xs font-mono truncate max-w-[80px] sm:max-w-none">{tx.order_id}</td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-slate-400 text-xs whitespace-nowrap">
                          {tx.created_date ? format(new Date(tx.created_date), 'dd/MM/yy HH:mm') : '—'}
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3">
                          {tx.blockchain_tx_hash ? (
                            <a
                              href={`https://testnet.snowtrace.io/tx/${tx.blockchain_tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-0.5 sm:gap-1 text-teal-400 hover:text-teal-300 text-xs whitespace-nowrap"
                              onClick={e => e.stopPropagation()}
                            >
                              <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                              <span className="hidden sm:inline">{tx.blockchain_tx_hash.slice(0, 8)}…</span>
                              <span className="sm:hidden">TX</span>
                            </a>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Delete this transaction?')) {
                                setDeletingTxId(tx.id);
                                deleteMutation.mutate(tx.id);
                              }
                            }}
                            disabled={deletingTxId === tx.id}
                            className="p-1 sm:p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                            title="Delete transaction"
                          >
                            {deletingTxId === tx.id ? (
                              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                            ) : (
                              <X className="w-3 h-3 sm:w-4 sm:h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transaction Details Modal */}
        {selectedTx && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTx(null)}
          >
            <div 
              className="bg-[#1f2128] border border-[#2d2d3a] rounded-lg max-w-lg w-full max-h-96 overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[#1f2128] border-b border-[#2d2d3a] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Transaction Details</h2>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {/* Status */}
                <div>
                  <div className="text-xs uppercase text-slate-400 font-semibold mb-2">Status</div>
                  <Badge className={`text-sm border ${STATUS_COLORS[selectedTx.status] || 'bg-slate-500/20 text-slate-400'}`}>
                    {selectedTx.status}
                  </Badge>
                </div>

                {/* Phone */}
                <div>
                  <div className="text-xs uppercase text-slate-400 font-semibold mb-2">Customer Phone</div>
                  <div className="font-mono text-white">{selectedTx.client_phone}</div>
                </div>

                {/* Wallet Address */}
                {selectedClient?.wallet_address && (
                  <div>
                    <div className="text-xs uppercase text-slate-400 font-semibold mb-2">Wallet Address</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400 text-sm break-all">{selectedClient.wallet_address}</span>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(selectedClient.wallet_address);
                            toast.success('Wallet address copied!');
                          } catch (err) {
                            toast.error('Failed to copy');
                          }
                        }}
                        className="p-1.5 hover:bg-blue-500/20 rounded transition-colors flex-shrink-0"
                        title="Copy wallet address"
                      >
                        <Copy className="w-4 h-4 text-slate-400 hover:text-blue-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Amount & Tokens */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs uppercase text-slate-400 font-semibold mb-2">Amount</div>
                    <div className="text-white font-bold">₪{selectedTx.amount}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400 font-semibold mb-2">Tokens</div>
                    <div className="text-teal-400 font-bold">
                      {selectedTx.tokens_actual ?? selectedTx.tokens_expected ?? 0} {selectedTx.token_symbol}
                    </div>
                  </div>
                </div>

                {/* Order ID */}
                <div>
                  <div className="text-xs uppercase text-slate-400 font-semibold mb-2">Order ID</div>
                  <div className="font-mono text-slate-300 text-sm break-all">{selectedTx.order_id}</div>
                </div>

                {/* Date */}
                <div>
                  <div className="text-xs uppercase text-slate-400 font-semibold mb-2">Date</div>
                  <div className="text-slate-300">
                    {selectedTx.created_date ? format(new Date(selectedTx.created_date), 'dd/MM/yyyy HH:mm:ss') : '—'}
                  </div>
                </div>

                {/* Blockchain TX Hash */}
                {selectedTx.blockchain_tx_hash && (
                  <div>
                    <div className="text-xs uppercase text-slate-400 font-semibold mb-2">Blockchain TX</div>
                    <a
                      href={`https://testnet.snowtrace.io/tx/${selectedTx.blockchain_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors font-mono text-sm break-all"
                    >
                      {selectedTx.blockchain_tx_hash.slice(0, 16)}…
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                )}

                {/* Claim Payment Link */}
                {selectedTx.claim_token && (
                   <div>
                     <div className="text-xs uppercase text-slate-400 font-semibold mb-2">Claim Payment</div>
                     <a
                       href={`/ClaimReward?token=${selectedTx.claim_token}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors font-mono text-sm break-all"
                     >
                       {selectedTx.claim_token.slice(0, 16)}…
                       <ExternalLink className="w-3 h-3 flex-shrink-0" />
                     </a>
                   </div>
                )}

                {/* Error Message */}
                {selectedTx.status === 'blockchain_failed' && selectedTx.error_message && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div className="text-xs uppercase text-red-400 font-semibold mb-1">Error</div>
                    <div className="text-red-200 text-sm break-words">{selectedTx.error_message}</div>
                  </div>
                )}

                {/* Cancel Button for Pending Transactions */}
                {selectedTx.status === 'pending' && (
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to cancel this transaction?')) {
                        setCancellingTxId(selectedTx.id);
                        cancelMutation.mutate(selectedTx.id);
                      }
                    }}
                    disabled={cancellingTxId === selectedTx.id || cancelMutation.isPending}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 hover:text-red-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancellingTxId === selectedTx.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Cancel Transaction
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}