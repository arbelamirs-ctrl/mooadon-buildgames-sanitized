import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, RefreshCw, CheckCircle, XCircle, Clock,
  Wallet, Coins, Zap, AlertTriangle, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

// gas_wallet_funded is often not written back after setup.
// Treat a company as funded/complete if wallet + token both exist.
function isTrulyFunded(company) {
  return company.gas_wallet_funded === true ||
    (!!company.blockchain_wallet_address && !!company.token_contract);
}

function computeStatus(company) {
  const hasWallet  = !!company.blockchain_wallet_address;
  const hasToken   = !!company.token_contract;
  const isFunded   = isTrulyFunded(company);
  const isComplete = company.blockchain_setup_complete === true || (hasWallet && hasToken);

  if (hasWallet && hasToken && isFunded && isComplete) return 'ready';
  if (hasWallet && hasToken && (!isFunded || !isComplete)) return 'pending';
  if (hasWallet && !hasToken) return 'wallet_only';
  return 'not_started';
}

const STATUS_CONFIG = {
  ready:        { label: 'Ready',          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  pending:      { label: 'Pending',        color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',   icon: Clock },
  wallet_only:  { label: 'Wallet Only',    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',         icon: Wallet },
  not_started:  { label: 'Not Started',    color: 'bg-slate-500/10 text-slate-400 border-slate-500/30',      icon: XCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function CheckItem({ label, ok }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? 'text-emerald-400' : 'text-slate-500'}`}>
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

export default function CompanySetupMonitorPage() {
  const { isSystemAdmin } = useUserPermissions();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState({});

  const { data: companies = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['companies-setup-monitor'],
    queryFn: () => base44.entities.Company.list('-created_date', 500),
    enabled: isSystemAdmin,
    staleTime: 0,
  });

  const handleRetry = async (company) => {
    setRetrying(r => ({ ...r, [company.id]: true }));
    try {
      // Fund the treasury
      const fundResult = await base44.functions.invoke('fundCompanyTreasury', {
        company_id: company.id,
        avax_amount: 0.05,
      });
      if (fundResult.data?.error) throw new Error(fundResult.data.error);
      
      // Complete the setup
      const completeResult = await base44.functions.invoke('completeCompanySetup', {
        company_id: company.id,
      });
      if (completeResult.data?.error) throw new Error(completeResult.data.error);
      
      toast.success(`${company.name}: Setup completed`);
      queryClient.invalidateQueries({ queryKey: ['companies-setup-monitor'] });
    } catch (err) {
      toast.error(`Retry failed: ${err.message}`);
    } finally {
      setRetrying(r => ({ ...r, [company.id]: false }));
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['companies-setup-monitor'] });
  };

  if (!isSystemAdmin) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center text-slate-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>Admin access required</p>
        </div>
      </div>
    );
  }

  const withStatus = companies.map(c => ({ ...c, _status: computeStatus(c) }));
  const readyCount       = withStatus.filter(c => c._status === 'ready').length;
  const pendingCount     = withStatus.filter(c => c._status === 'pending').length;
  const notStartedCount  = withStatus.filter(c => c._status === 'not_started').length;
  const walletOnlyCount  = withStatus.filter(c => c._status === 'wallet_only').length;

  // Sort: not_started first, then pending, then wallet_only, then ready
  const sorted = [...withStatus].sort((a, b) => {
    const order = { not_started: 0, pending: 1, wallet_only: 2, ready: 3 };
    return (order[a._status] ?? 4) - (order[b._status] ?? 4);
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            Company Setup Monitor
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Blockchain setup status for all registered companies
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="border-slate-600 text-slate-300 hover:text-white"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ready',       count: readyCount,      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Pending',     count: pendingCount,    color: 'text-yellow-400',  bg: 'bg-yellow-500/10  border-yellow-500/20'  },
          { label: 'Wallet Only', count: walletOnlyCount, color: 'text-blue-400',    bg: 'bg-blue-500/10    border-blue-500/20'    },
          { label: 'Not Started', count: notStartedCount, color: 'text-slate-400',   bg: 'bg-slate-500/10   border-slate-500/20'   },
        ].map(({ label, count, color, bg }) => (
          <Card key={label} className={`${bg} border`}>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-slate-400 mt-1">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Company Table */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="p-4 border-b border-[#2d2d3a]">
          <CardTitle className="text-white text-sm font-semibold">
            {companies.length} Companies
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No companies found</div>
          ) : (
            <div className="divide-y divide-[#2d2d3a]">
              {sorted.map(company => {
                const hasWallet   = !!company.blockchain_wallet_address;
                const hasToken    = !!company.token_contract;
                const isFunded    = isTrulyFunded(company);
                const isComplete  = company.blockchain_setup_complete === true || (hasWallet && hasToken);
                const needsRetry  = company._status === 'not_started' || company._status === 'pending' || company._status === 'wallet_only';

                return (
                  <div key={company.id} className="px-4 py-4 hover:bg-[#17171f] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: company info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white text-sm font-medium truncate">{company.name}</span>
                          <StatusBadge status={company._status} />
                        </div>
                        <p className="text-slate-500 text-xs mb-2">{company.created_by}</p>

                        {/* Checklist */}
                        <div className="flex flex-wrap gap-3">
                          <CheckItem label="Wallet"   ok={hasWallet} />
                          <CheckItem label="Token"    ok={hasToken} />
                          <CheckItem label="Funded"   ok={isFunded} />
                          <CheckItem label="Complete" ok={isComplete} />
                        </div>

                        {/* Missing items warning */}
                        {company._status === 'pending' && (
                          <div className="text-xs text-yellow-400 mt-1.5">
                            Missing: {!isFunded && 'Funded'}{!isFunded && !isComplete ? ', ' : ''}{!isComplete && 'Complete'}
                          </div>
                        )}

                        {/* Wallet address link */}
                        {company.blockchain_wallet_address && (
                          <a
                            href={`https://testnet.snowtrace.io/address/${company.blockchain_wallet_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 mt-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {company.blockchain_wallet_address.slice(0, 8)}...{company.blockchain_wallet_address.slice(-6)}
                          </a>
                        )}

                        {/* Setup error */}
                        {company.setup_last_error && (
                          <p className="text-red-400 text-xs mt-1 truncate max-w-md" title={company.setup_last_error}>
                            ⚠ {company.setup_last_error}
                          </p>
                        )}
                      </div>

                      {/* Right: retry button */}
                      {needsRetry && (
                        <button
                          onClick={() => handleRetry(company)}
                          disabled={!!retrying[company.id]}
                          className="h-8 px-3 text-xs rounded-md border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 flex-shrink-0 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {retrying[company.id] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <><RefreshCw className="w-3 h-3" />Retry</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}