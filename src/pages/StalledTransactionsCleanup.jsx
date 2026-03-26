import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function StalledTransactionsCleanup() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const { data: stalledTxs = [], isLoading, refetch } = useQuery({
    queryKey: ['stalled-transactions'],
    queryFn: async () => {
      const txs = await base44.asServiceRole.entities.Transaction.filter(
        { status: { $in: ['pending', 'blockchain_failed', 'failed'] } },
        '-created_date',
        500
      );
      return txs.filter(tx => {
        if (!tx.created_date) return true;
        const daysSince = (Date.now() - new Date(tx.created_date).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 1; // More than 1 day old
      });
    },
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (txIds) => {
      let deleted = 0;
      let skipped = 0;
      for (const id of txIds) {
        try {
          // PROTECTION: Check if any pending/processing RewardQueue items reference this transaction
          const blockingRewards = await base44.entities.RewardQueue.filter({
            transaction_id: id,
            status: { $in: ['pending', 'processing'] }
          });
          if (blockingRewards && blockingRewards.length > 0) {
            console.warn(`⚠️ Skipping transaction ${id} — has ${blockingRewards.length} pending RewardQueue item(s)`);
            skipped++;
            continue;
          }
          await base44.asServiceRole.entities.Transaction.delete(id);
          deleted++;
        } catch (err) {
          console.warn(`Failed to delete ${id}:`, err.message);
        }
      }
      return { deleted, skipped, total: txIds.length };
    },
    onSuccess: (data) => {
      const skippedMsg = data.skipped > 0 ? ` (${data.skipped} skipped — pending rewards)` : '';
      toast.success(`✅ Deleted ${data.deleted}/${data.total} transactions${skippedMsg}`);
      setSelectedIds([]);
      setSelectAll(false);
      queryClient.invalidateQueries({ queryKey: ['stalled-transactions'] });
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(stalledTxs.map(tx => tx.id));
    }
    setSelectAll(!selectAll);
  };

  const handleToggleTx = (txId) => {
    setSelectedIds(prev =>
      prev.includes(txId)
        ? prev.filter(id => id !== txId)
        : [...prev, txId]
    );
    setSelectAll(false);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      toast.error('Please select transactions to delete');
      return;
    }
    if (window.confirm(`⚠️ Delete ${selectedIds.length} transaction(s)? This cannot be undone!`)) {
      deleteMutation.mutate(selectedIds);
    }
  };

  return (
    <div className="min-h-screen bg-[#17171f] p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h1 className="text-2xl font-bold text-white">Stalled Transactions Cleanup</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Found {stalledTxs.length} transaction(s) stuck for more than 1 day
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-red-950/30 border border-red-500/50 rounded-lg p-4 mb-6">
          <p className="text-red-300 text-sm">
            These are transactions that haven't completed or failed. Deleting them will clear them from the system. Consider checking if rewards were actually sent before deleting.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
          </div>
        ) : stalledTxs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            No stalled transactions found. Great!
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-slate-300">Select All ({stalledTxs.length})</span>
              </label>
              
              {selectedIds.length > 0 && (
                <>
                  <span className="text-sm text-slate-400">
                    {selectedIds.length} selected
                  </span>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Selected
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Table */}
            <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2d2d3a] bg-[#17171f] text-slate-400 text-xs uppercase">
                      <th className="px-4 py-3 text-left w-12">
                        <input type="checkbox" className="w-4 h-4 rounded" disabled />
                      </th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Created</th>
                      <th className="px-4 py-3 text-left">Days Old</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stalledTxs.map((tx) => {
                      const daysOld = Math.floor(
                        (Date.now() - new Date(tx.created_date).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <tr
                          key={tx.id}
                          className={`border-b border-[#2d2d3a] hover:bg-[#1a1a22] transition-colors ${
                            selectedIds.includes(tx.id) ? 'bg-[#2d2d3a]' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(tx.id)}
                              onChange={() => handleToggleTx(tx.id)}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-4 py-3 text-white font-mono text-xs">
                            {tx.client_phone}
                          </td>
                          <td className="px-4 py-3 text-white font-semibold">
                            ₪{tx.amount}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                            {tx.created_date ? format(new Date(tx.created_date), 'dd/MM/yy HH:mm') : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-300 font-semibold">
                            {daysOld}d
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}