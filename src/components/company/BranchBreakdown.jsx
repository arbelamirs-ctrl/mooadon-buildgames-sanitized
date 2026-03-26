import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, TrendingUp, TrendingDown, Receipt, ArrowLeft } from 'lucide-react';

export default function BranchBreakdown({ branches, transactions, ledgerEvents }) {
  const branchStats = branches.map(branch => {
    const branchTx = transactions.filter(t => t.branch_id === branch.id);
    const branchLedger = ledgerEvents.filter(e => 
      branchTx.some(tx => tx.id === e.transaction_id)
    );
    
    const earned = branchLedger
      .filter(e => e.type === 'earn')
      .reduce((sum, e) => sum + (e.points || 0), 0);
    
    const redeemed = Math.abs(
      branchLedger
        .filter(e => e.type === 'redeem')
        .reduce((sum, e) => sum + (e.points || 0), 0)
    );
    
    return {
      ...branch,
      txCount: branchTx.length,
      earned,
      redeemed,
      totalAmount: branchTx.reduce((s, t) => s + (t.amount || 0), 0)
    };
  }).sort((a, b) => b.txCount - a.txCount);

  return (
    <Card className="border-slate-800 bg-slate-900 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-white">Details by branches</CardTitle>
        <Link to={createPageUrl('Branches')}>
          <Button variant="ghost" size="sm" className="text-yellow-400 hover:bg-slate-800">
           Manage branches
            <ArrowLeft className="w-4 h-4 mr-2" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {branchStats.length === 0 ? (
          <div className="text-center py-12">
            <Store className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No branches yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {branchStats.map((branch) => (
              <div 
                key={branch.id}
                className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <Store className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{branch.name}</h4>
                      <p className="text-xs text-slate-400">{branch.location || 'Without address'}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={branch.status === 'active' ? 'default' : 'secondary'}
                    className={branch.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : ''}
                  >
                    {branch.status === 'active' ? 'active' : 'not active'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Receipt className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-400">Transactions</span>
                    </div>
                    <p className="text-lg font-bold text-white">{branch.txCount}</p>
                  </div>
                  
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-slate-400">Accumulated</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-400">{branch.earned.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingDown className="w-3 h-3 text-rose-400" />
                      <span className="text-xs text-slate-400">Redeemed</span>
                    </div>
                    <p className="text-lg font-bold text-rose-400">{branch.redeemed.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Total sum</span>
                    <span className="font-medium text-slate-300">₪{branch.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}