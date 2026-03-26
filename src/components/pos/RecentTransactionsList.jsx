import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import StatusBadge from '@/components/ui/StatusBadge';

export default function RecentTransactionsList({ branchId, cashierId }) {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['shiftTransactions', branchId, cashierId],
    queryFn: async () => {
      // Get today's transactions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const allTx = await base44.entities.Transaction.filter(
        { branch_id: branchId },
        '-created_date',
        100
      );
      
      // Filter for today only
      return allTx.filter(tx => {
        const txDate = new Date(tx.created_date);
        return txDate >= today;
      });
    },
    enabled: !!branchId,
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const totalTokens = transactions.reduce((sum, tx) => sum + (tx.tokens_expected || 0), 0);

  return (
    <Card className="bg-[#1f2128] border-[#2d2d3a] h-full">
      <CardHeader className="pb-3 border-b border-[#2d2d3a]">
        <CardTitle className="flex items-center justify-between text-white text-lg">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Today's Shift
          </div>
          <span className="text-[#10b981] text-2xl font-bold">{transactions.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#17171f] rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">${totalAmount.toFixed(2)}</p>
            <p className="text-[#9ca3af] text-xs">Total Sales</p>
          </div>
          <div className="bg-[#17171f] rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-[#10b981]">{totalTokens}</p>
            <p className="text-[#9ca3af] text-xs">Points Given</p>
          </div>
        </div>

        {/* Transaction List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {isLoading ? (
            <p className="text-[#9ca3af] text-center py-8">Loading...</p>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 mx-auto mb-2 text-[#9ca3af] opacity-30" />
              <p className="text-[#9ca3af] text-sm">No transactions yet today</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 hover:border-[#10b981]/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono text-white font-medium">{tx.client_phone}</p>
                  <StatusBadge status={tx.status} />
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-bold text-white">${(tx.amount || 0).toFixed(2)}</p>
                    <p className="text-xs text-[#9ca3af]">
                      {format(new Date(tx.created_date), 'HH:mm:ss')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#10b981]">+{tx.tokens_expected || 0}</p>
                    <p className="text-xs text-[#9ca3af]">points</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}