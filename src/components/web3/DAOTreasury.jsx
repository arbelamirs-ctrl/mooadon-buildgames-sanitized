import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  TrendingUp, 
  ArrowUpRight,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react';

export default function DAOTreasury({ treasuryBalance = 50000 }) {
  const [transactions, setTransactions] = useState([
    {
      id: 1,
      proposalId: 3,
      proposalTitle: 'Partnership with retail networks',
      amount: 5000,
      recipient: '0x1234...5678',
      status: 'completed',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      type: 'allocation'
    },
    {
      id: 2,
      proposalId: 1,
      proposalTitle: 'Increase APY for Staking',
      amount: 10000,
      recipient: 'Staking Contract',
      status: 'pending',
      timestamp: new Date(),
      type: 'contract_interaction'
    }
  ]);

  const pendingAmount = transactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);

  const availableBalance = treasuryBalance - pendingAmount;

  const getStatusBadge = (status) => {
    if (status === 'completed') {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">Completed</Badge>;
    }
    if (status === 'pending') {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">Pending</Badge>;
    }
    return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/50">Failed</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Treasury Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-gradient-to-br from-emerald-900 to-teal-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="w-5 h-5 text-emerald-300" />
              <p className="text-sm text-emerald-200">Treasury Balance</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {treasuryBalance.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-300 mt-1">tokens</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-gradient-to-br from-blue-900 to-indigo-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-blue-300" />
              <p className="text-sm text-blue-200">Available</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {availableBalance.toLocaleString()}
            </p>
            <p className="text-xs text-blue-300 mt-1">tokens</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-gradient-to-br from-amber-900 to-orange-900">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-amber-300" />
              <p className="text-sm text-amber-200">Pending</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {pendingAmount.toLocaleString()}
            </p>
            <p className="text-xs text-amber-300 mt-1">tokens</p>
          </CardContent>
        </Card>
      </div>

      {/* Treasury Allocation Progress */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Treasury Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Utilized</span>
              <span className="text-white font-medium">
                {((pendingAmount / treasuryBalance) * 100).toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={(pendingAmount / treasuryBalance) * 100} 
              className="h-2 bg-slate-800"
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Treasury Transactions */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Recent Treasury Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactions.map(tx => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    tx.status === 'completed' ? 'bg-emerald-900' : 'bg-amber-900'
                  }`}>
                    {tx.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(tx.status)}
                      <span className="text-xs text-slate-500">
                        Proposal #{tx.proposalId}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white truncate">
                      {tx.proposalTitle}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      To: {tx.recipient}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-white">
                    {tx.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">tokens</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}