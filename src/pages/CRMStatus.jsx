import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  CheckCircle2, XCircle, Clock, Zap, RefreshCw, Loader2, ArrowRight, Plug
} from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function CRMStatus() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();
  const [syncLoading, setSyncLoading] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['crmConfig', primaryCompanyId],
    queryFn: async () => {
      const cfgs = await base44.entities.CRMConfig.filter({ company_id: primaryCompanyId, is_active: true });
      return cfgs[0] || null;
    },
    enabled: !!primaryCompanyId,
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ['crmSyncLogs', primaryCompanyId],
    queryFn: () => base44.entities.CRMSync.filter({ company_id: primaryCompanyId }, '-last_sync', 50),
    enabled: !!primaryCompanyId,
  });

  const handleManualSync = async () => {
    if (!primaryCompanyId) return;
    setSyncLoading(true);
    try {
      const res = await base44.functions.invoke('manualCRMSync', { company_id: primaryCompanyId });
      toast.success(`✅ סונכרנו ${res.data.synced} מתוך ${res.data.total} לקוחות`);
      queryClient.invalidateQueries(['crmConfig', primaryCompanyId]);
      queryClient.invalidateQueries(['crmSyncLogs', primaryCompanyId]);
    } catch (e) {
      toast.error('סנכרון נכשל: ' + e.message);
    } finally {
      setSyncLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Plug className="w-6 h-6 text-teal-400" /> CRM Status
            </h1>
            <p className="text-sm text-slate-400 mt-1">No CRM connected yet</p>
          </div>
        </div>
        <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-6 text-center space-y-4">
          <p className="text-slate-400">Connect a CRM to start syncing loyalty data automatically.</p>
          <Button onClick={() => window.location.href = createPageUrl('ConnectCRM')}
            className="bg-teal-500 hover:bg-teal-600 text-white gap-2">
            <Plug className="w-4 h-4" /> Connect CRM
          </Button>
        </div>
      </div>
    );
  }

  const CRM_NAMES = {
    hubspot: 'HubSpot',
    salesforce: 'Salesforce',
    pipedrive: 'Pipedrive',
    zoho: 'Zoho CRM',
    monday: 'Monday.com',
    freshsales: 'Freshsales',
    dynamics: 'Dynamics 365',
  };

  const lastSync = config.last_sync ? new Date(config.last_sync) : null;
  const isRecentlyActive = lastSync && (Date.now() - lastSync.getTime()) < 3600000; // less than 1 hour

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plug className="w-6 h-6 text-teal-400" /> CRM Status
          </h1>
          <p className="text-sm text-slate-400 mt-1">Connected to {CRM_NAMES[config.crm_type]}</p>
        </div>
        <Button onClick={() => window.location.href = createPageUrl('ConnectCRM')}
          variant="outline" className="border-[#2d2d3a] text-white text-sm h-9 gap-2">
          <RefreshCw className="w-4 h-4" /> Manage
        </Button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 uppercase">Status</p>
            {isRecentlyActive ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <Clock className="w-4 h-4 text-amber-400" />}
          </div>
          <p className="text-sm font-semibold text-white">{CRM_NAMES[config.crm_type]}</p>
          <p className="text-xs text-teal-400">Active</p>
        </div>

        <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 uppercase">Synced Clients</p>
          </div>
          <p className="text-2xl font-bold text-white">{config.total_synced_clients || 0}</p>
          <p className="text-xs text-slate-500">Total synced</p>
        </div>

        <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 uppercase">Last Sync</p>
            {config.last_sync_status === 'success' ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
          </div>
          <p className="text-sm font-semibold text-white">
            {lastSync ? format(lastSync, 'HH:mm', { locale: he }) : 'Never'}
          </p>
          <p className="text-xs text-slate-500">
            {lastSync ? format(lastSync, 'dd/MM/yyyy', { locale: he }) : 'Not synced yet'}
          </p>
        </div>
      </div>

      {/* Sync trigger info */}
      <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-white text-sm">Sync Configuration</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-slate-500 mb-1">Direction</p>
            <Badge className="bg-teal-500/20 text-teal-300 border-0 text-xs w-fit">
              {config.sync_direction === 'to_crm' ? '→ CRM' : config.sync_direction === 'from_crm' ? '← CRM' : '↔ Both'}
            </Badge>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Trigger</p>
            <Badge className="bg-violet-500/20 text-violet-300 border-0 text-xs w-fit">
              {config.sync_trigger === 'on_transaction' ? '🔄 Auto' : '🚀 Manual'}
            </Badge>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Events</p>
            <Badge className="bg-blue-500/20 text-blue-300 border-0 text-xs w-fit">
              {(config.log_events || []).length} types
            </Badge>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Status</p>
            <Badge className="bg-teal-500/20 text-teal-300 border-0 text-xs w-fit">Active</Badge>
          </div>
        </div>
      </div>

      {/* Manual sync button */}
      <Button onClick={handleManualSync} disabled={syncLoading}
        className="w-full bg-teal-500 hover:bg-teal-600 text-white h-10 text-sm gap-2">
        {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {syncLoading ? 'Syncing all clients...' : 'Sync all clients now'}
      </Button>

      {/* Recent syncs */}
      <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#2d2d3a]">
          <h3 className="font-semibold text-white text-sm">Recent Syncs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[#2d2d3a] bg-[#17171f]">
              <tr>
                <th className="px-4 py-2 text-left text-slate-400">Client ID</th>
                <th className="px-4 py-2 text-left text-slate-400">Event</th>
                <th className="px-4 py-2 text-left text-slate-400">Status</th>
                <th className="px-4 py-2 text-left text-slate-400">Time</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-3 text-center text-slate-500">No syncs yet</td>
                </tr>
              ) : (
                syncLogs.map(log => (
                  <tr key={log.id} className="border-b border-[#2d2d3a] hover:bg-[#17171f]">
                    <td className="px-4 py-2 text-slate-300 font-mono">{log.client_id?.slice(0, 8)}...</td>
                    <td className="px-4 py-2 text-slate-400">{log.event_type}</td>
                    <td className="px-4 py-2">
                      {log.sync_status === 'success' ? (
                        <div className="flex items-center gap-1.5 text-teal-400">
                          <CheckCircle2 className="w-3 h-3" /> Success
                        </div>
                      ) : log.sync_status === 'failed' ? (
                        <div className="flex items-center gap-1.5 text-rose-400">
                          <XCircle className="w-3 h-3" /> Failed
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400">
                          <Clock className="w-3 h-3" /> Pending
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {log.last_sync ? format(new Date(log.last_sync), 'HH:mm:ss', { locale: he }) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {config.last_sync_error && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-4 space-y-2">
          <p className="text-xs text-rose-400 font-semibold">Last Error</p>
          <p className="text-xs text-rose-300">{config.last_sync_error}</p>
        </div>
      )}
    </div>
  );
}