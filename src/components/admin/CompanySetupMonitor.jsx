import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock, Wallet, Coins, Zap } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  ready:          { label: 'Ready',          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  token_deployed: { label: 'Token Deployed', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',    icon: Coins },
  wallet_created: { label: 'Wallet Created', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30', icon: Wallet },
  pending:        { label: 'Pending',         color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', icon: Clock },
  failed:         { label: 'Failed',          color: 'bg-red-500/10 text-red-400 border-red-500/30',       icon: XCircle },
  none:           { label: 'Not Started',     color: 'bg-slate-500/10 text-slate-400 border-slate-500/30', icon: Clock },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.none;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function CompanySetupMonitor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState({});

  const ADMIN_EMAILS = ['arbel.amir.s@gmail.com'];
  const isAdmin = ['admin', 'super_admin'].includes(user?.role) || ADMIN_EMAILS.includes(user?.email);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies-setup-monitor'],
    queryFn: () => base44.entities.Company.list('-created_date', 500),
    enabled: isAdmin,
    refetchInterval: 15000,
  });

  const handleRetry = async (company) => {
    setRetrying(r => ({ ...r, [company.id]: true }));
    try {
      const result = await base44.functions.invoke('registerCompany', {
        companyId: company.id,
        companyName: company.name,
      });
      if (result.data?.error) throw new Error(result.data.error);
      toast.success(`${company.name}: Setup retried successfully`);
      queryClient.invalidateQueries({ queryKey: ['companies-setup-monitor'] });
    } catch (err) {
      toast.error(`Retry failed: ${err.message}`);
    } finally {
      setRetrying(r => ({ ...r, [company.id]: false }));
    }
  };

  if (!isAdmin) return null;

  const failed   = companies.filter(c => c.setup_status === 'failed');
  const pending  = companies.filter(c => c.setup_status === 'pending');
  const noStatus = companies.filter(c => !c.setup_status);
  const ready    = companies.filter(c => c.setup_status === 'ready');

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          Company Setup Monitor
        </CardTitle>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="text-emerald-400 font-medium">{ready.length} ready</span>
          {failed.length > 0 && <span className="text-red-400 font-medium">{failed.length} failed</span>}
          {pending.length > 0 && <span className="text-yellow-400 font-medium">{pending.length} pending</span>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['companies-setup-monitor'] })}
            className="text-slate-400 hover:text-white h-7 px-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {companies.map(company => {
              const status = company.setup_status || 'none';
              const isFailed = status === 'failed';
              const needsRetry = isFailed || status === 'none';

              return (
                <div key={company.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-white text-sm font-medium truncate">{company.name}</span>
                    <span className="text-slate-500 text-xs truncate">{company.created_by}</span>
                    {isFailed && company.setup_last_error && (
                      <span className="text-red-400 text-xs mt-0.5 truncate max-w-xs" title={company.setup_last_error}>
                        ⚠ {company.setup_last_error}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <StatusBadge status={status} />
                    {needsRetry && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs border-slate-600 text-slate-300 hover:text-white hover:border-slate-400"
                        onClick={() => handleRetry(company)}
                        disabled={retrying[company.id]}
                      >
                        {retrying[company.id] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <><RefreshCw className="w-3 h-3 mr-1" />Retry</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {companies.length === 0 && (
              <div className="text-center text-slate-500 py-8 text-sm">No companies found</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}