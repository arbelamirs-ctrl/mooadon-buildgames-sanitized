// src/components/company/POSTab.jsx
// MOBILE-FIRST VERSION
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Server, Store, CreditCard, RefreshCw, Loader2,
  CheckCircle2, AlertTriangle, Building2, Users, Webhook,
} from 'lucide-react';
import { toast } from 'sonner';
import TranzilaConnect from '@/components/company/TranzilaConnect';
import POSIntegrationGuide from '@/components/pos/POSIntegrationGuide';

export default function POSTab({ integrationStatus }) {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ['company', primaryCompanyId],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: primaryCompanyId });
      return companies[0] || null;
    },
    enabled: !!primaryCompanyId,
  });

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['branches', primaryCompanyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId,
  });

  const firstBranch = branches[0] || null;
  const posStatus = integrationStatus?.integrations?.pos;
  const hasAnyPOS =
    posStatus?.priority?.connected ||
    posStatus?.tranzila?.connected ||
    posStatus?.generic_pos?.configured;

  const syncBranchesMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('prioritySyncBranches', { company_id: primaryCompanyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Priority branches synced', { description: `Synced ${data?.synced ?? 0} branches` });
      queryClient.invalidateQueries({ queryKey: ['branches', primaryCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['integration-status', primaryCompanyId] });
    },
    onError: (err) => toast.error('Branch sync failed', { description: err.message }),
  });

  const syncCustomersMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('prioritySyncCustomers', { company_id: primaryCompanyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Priority customers synced', { description: `Synced ${data?.synced ?? 0} customers` });
      queryClient.invalidateQueries({ queryKey: ['integration-status', primaryCompanyId] });
    },
    onError: (err) => toast.error('Customer sync failed', { description: err.message }),
  });

  return (
    <div className="space-y-4">
      {/* POS Summary */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-3 p-3 sm:p-4 lg:p-6">
          <CardTitle className="flex flex-wrap items-center gap-2 text-white text-base sm:text-lg">
            <Server className="w-5 h-5 text-emerald-400 shrink-0" />
            POS & Terminals
            <Badge className={hasAnyPOS
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs'
              : 'bg-slate-700/50 text-slate-400 border-slate-600 text-xs'}>
              {hasAnyPOS ? 'Connected' : 'Not connected'}
            </Badge>
          </CardTitle>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Connect your POS systems to automatically sync sales and award loyalty points.
          </p>
        </CardHeader>

        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 sm:p-4 lg:p-6 pt-0">
          {[
            {
              icon: <Store className="w-4 h-4 text-emerald-400" />,
              label: 'Priority / ERP',
              desc: 'Sync branches and customers from Priority.',
              connected: posStatus?.priority?.connected,
            },
            {
              icon: <CreditCard className="w-4 h-4 text-teal-400" />,
              label: 'Tranzila TRAPI',
              desc: 'Pull card transactions from Tranzila every few minutes.',
              connected: posStatus?.tranzila?.connected,
            },
            {
              icon: <Webhook className="w-4 h-4 text-blue-400" />,
              label: 'Generic POS API',
              desc: 'Use a simple HTTPS API to connect any POS.',
              connected: posStatus?.generic_pos?.configured,
              label2: posStatus?.generic_pos?.configured ? 'Configured' : 'Not configured',
            },
          ].map((item, i) => (
            <div key={i} className="bg-slate-950/40 rounded-lg p-3 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                {item.icon}
                <span className="text-slate-200 font-medium text-sm">{item.label}</span>
              </div>
              <p className="text-xs text-slate-400 mb-2">{item.desc}</p>
              <Badge variant="outline" className={item.connected
                ? 'border-emerald-500/40 text-emerald-400 text-[11px]'
                : 'border-slate-600 text-slate-400 text-[11px]'}>
                {item.label2 || (item.connected ? 'Connected' : 'Not connected')}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Priority Sync */}
      {posStatus?.priority?.connected && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-3 p-3 sm:p-4">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <Store className="w-4 h-4 text-emerald-400" />
              Priority ERP Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4 pt-0">
            {/* Sync Branches */}
            <div className="bg-slate-950/40 rounded-lg p-3 sm:p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-slate-200">Sync Branches</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Pull branch data from Priority into Mooadon.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Branches: {branches.length}</span>
                <Button size="sm" variant="outline"
                  onClick={() => syncBranchesMutation.mutate()}
                  disabled={syncBranchesMutation.isPending}
                  className="w-full sm:w-auto border-slate-700 text-slate-300 hover:text-white h-10">
                  {syncBranchesMutation.isPending
                    ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    : <RefreshCw className="w-3 h-3 mr-1" />}
                  Sync branches
                </Button>
              </div>
            </div>

            {/* Sync Customers */}
            <div className="bg-slate-950/40 rounded-lg p-3 sm:p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-slate-200">Sync Customers</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Import customer records from Priority.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  Last: {posStatus?.priority?.last_sync
                    ? new Date(posStatus.priority.last_sync).toLocaleString('he-IL')
                    : 'Never'}
                </span>
                <Button size="sm" variant="outline"
                  onClick={() => syncCustomersMutation.mutate()}
                  disabled={syncCustomersMutation.isPending}
                  className="w-full sm:w-auto border-slate-700 text-slate-300 hover:text-white h-10">
                  {syncCustomersMutation.isPending
                    ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    : <RefreshCw className="w-3 h-3 mr-1" />}
                  Sync customers
                </Button>
              </div>
            </div>

            {posStatus?.priority?.synced_branches > 0 && (
              <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {posStatus.priority.synced_branches} branches synced
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {posStatus.priority.synced_customers ?? 0} customers synced
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TranzilaConnect companyId={primaryCompanyId} />

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <Webhook className="w-4 h-4 text-emerald-400" />
              POS API Integration Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 p-3 sm:p-4">
            {loadingBranches && (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading branches...
              </div>
            )}
            {!loadingBranches && !firstBranch && (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Create at least one branch to see API examples with real values.
              </div>
            )}
            {!loadingBranches && firstBranch && (
              <POSIntegrationGuide branch={firstBranch} company={company} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}