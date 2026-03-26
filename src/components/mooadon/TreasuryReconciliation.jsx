import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

export default function TreasuryReconciliation({ companyToken, clients }) {
  // Calculate off-chain stats
  const totalStarsIssued = clients.reduce((sum, c) => sum + (c.total_earned || 0), 0);
  const starsRedeemed = clients.reduce((sum, c) => sum + (c.total_redeemed || 0), 0);
  const starsRemaining = clients.reduce((sum, c) => sum + (c.current_balance || 0), 0);

  // On-chain data
  const onchainSupply = companyToken.total_supply || 0;
  const treasuryBalance = companyToken.treasury_balance || 0;
  const distributedTokens = companyToken.distributed_tokens || 0;

  // Reconciliation
  const conversionRate = 100; // 100 Stars = 1 MLT
  const expectedTokens = starsRemaining / conversionRate;
  const actualDistributed = distributedTokens;
  const discrepancy = Math.abs(expectedTokens - actualDistributed);
  const discrepancyPercent = expectedTokens > 0 ? (discrepancy / expectedTokens) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Treasury (On-chain) */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            🏦 Treasury (On-chain)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400 mb-1">Token Supply</div>
              <div className="text-2xl font-bold text-white">
                {onchainSupply.toLocaleString()} MLT
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400 mb-1">Treasury Balance</div>
              <div className="text-2xl font-bold text-yellow-400">
                {treasuryBalance.toLocaleString()} MLT
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-400 mb-1">Distributed</div>
              <div className="text-2xl font-bold text-green-400">
                {distributedTokens.toLocaleString()} MLT
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Distribution Progress</span>
              <span>{((distributedTokens / onchainSupply) * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all"
                style={{ width: `${(distributedTokens / onchainSupply) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Off-chain Stats */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            💫 Off-chain Stats (Stars)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400">Total Stars Issued</div>
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400">
                {totalStarsIssued.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ≈ {(totalStarsIssued / conversionRate).toFixed(2)} MLT
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-red-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400">Stars Redeemed</div>
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-400">
                {starsRedeemed.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ≈ {(starsRedeemed / conversionRate).toFixed(2)} MLT
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400">Stars Remaining</div>
                <ArrowUpDown className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-green-400">
                {starsRemaining.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ≈ {(starsRemaining / conversionRate).toFixed(2)} MLT
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            ⚖️ Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/20">
              <div className="text-xs text-slate-400 mb-1">On-chain Supply</div>
              <div className="text-2xl font-bold text-white mb-1">
                {onchainSupply.toLocaleString()} MLT
              </div>
              <div className="text-xs text-slate-500">
                Treasury: {treasuryBalance.toLocaleString()} | Distributed: {distributedTokens.toLocaleString()}
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-900/30 to-yellow-900/30 rounded-lg p-4 border border-orange-500/20">
              <div className="text-xs text-slate-400 mb-1">Off-chain Liability</div>
              <div className="text-2xl font-bold text-white mb-1">
                {starsRemaining.toLocaleString()} Stars
              </div>
              <div className="text-xs text-slate-500">
                Expected tokens: {expectedTokens.toFixed(2)} MLT
              </div>
            </div>
          </div>

          {/* Discrepancy Alert */}
          {discrepancy > 0.01 && (
            <div className={`rounded-lg p-4 border ${
              discrepancyPercent > 5 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`w-5 h-5 mt-0.5 ${
                  discrepancyPercent > 5 ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <div className="flex-1">
                  <div className={`font-semibold mb-1 ${
                    discrepancyPercent > 5 ? 'text-red-300' : 'text-yellow-300'
                  }`}>
                    Reconciliation {discrepancyPercent > 5 ? 'Warning' : 'Notice'}
                  </div>
                  <div className="text-sm text-slate-300">
                    Discrepancy: <span className="font-mono">{discrepancy.toFixed(2)} MLT</span> ({discrepancyPercent.toFixed(2)}%)
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Expected distributed tokens based on Stars: {expectedTokens.toFixed(2)} MLT
                    <br />
                    Actual distributed tokens on-chain: {actualDistributed.toFixed(2)} MLT
                  </div>
                </div>
              </div>
            </div>
          )}

          {discrepancy <= 0.01 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                  ✓
                </div>
                <div>
                  <div className="font-semibold text-green-300 mb-1">Perfect Balance</div>
                  <div className="text-sm text-slate-300">
                    On-chain and off-chain records are in sync
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}