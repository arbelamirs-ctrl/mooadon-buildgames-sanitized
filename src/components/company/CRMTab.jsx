// src/components/company/CRMTab.jsx
// MOBILE-FIRST VERSION
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plug, RefreshCw, Loader2, Link2, Link2Off,
  Zap, Shield, CheckCircle2, Users,
} from 'lucide-react';
import { toast } from 'sonner';

const CRM_TYPES = [
  { value: 'hubspot',    label: 'HubSpot',       color: 'text-orange-400', field: 'access_token',  placeholder: 'Bearer token' },
  { value: 'salesforce', label: 'Salesforce',     color: 'text-blue-400',   field: 'api_token',     placeholder: 'API token' },
  { value: 'pipedrive',  label: 'Pipedrive',      color: 'text-green-400',  field: 'api_token',     placeholder: 'API token' },
  { value: 'zoho',       label: 'Zoho',           color: 'text-red-400',    field: 'access_token',  placeholder: 'OAuth token' },
  { value: 'monday',     label: 'Monday.com',     color: 'text-yellow-400', field: 'api_token',     placeholder: 'API v2 token' },
  { value: 'freshsales', label: 'Freshsales',     color: 'text-teal-400',   field: 'api_token',     placeholder: 'API key' },
  { value: 'dynamics',   label: 'Dynamics 365',   color: 'text-purple-400', field: 'access_token',  placeholder: 'OAuth token' },
];

export default function CRMTab({ integrationStatus }) {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [selectedCRM, setSelectedCRM] = useState('');
  const [credentials, setCredentials] = useState({});

  const crmStatus = integrationStatus?.integrations?.crm;
  const isConnected = crmStatus?.connected || false;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['integration-status', primaryCompanyId] });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const crmDef = CRM_TYPES.find(c => c.value === selectedCRM);
      if (!crmDef) throw new Error('Select a CRM first');
      const cred = credentials[crmDef.field];
      if (!cred?.trim()) throw new Error(`${crmDef.label} requires ${crmDef.field}`);
      const res = await base44.functions.invoke('testCRMConnection', {
        company_id: primaryCompanyId,
        crm_type: selectedCRM,
        credentials: { [crmDef.field]: cred.trim() },
        save: true,
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => { toast.success('CRM connected!'); invalidate(); setIsSetupOpen(false); },
    onError: (err) => toast.error('Connection failed', { description: err.message }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('testCRMConnection', { company_id: primaryCompanyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => { toast.success('CRM connection is working!'); invalidate(); },
    onError: (err) => toast.error('Test failed', { description: err.message }),
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('manualCRMSync', { company_id: primaryCompanyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('CRM sync complete', { description: `${data?.synced ?? 0} contacts synced` });
      invalidate();
    },
    onError: (err) => toast.error('Sync failed', { description: err.message }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('testCRMConnection', {
        company_id: primaryCompanyId, action: 'disconnect',
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => { toast.success('CRM disconnected'); invalidate(); },
    onError: (err) => toast.error('Disconnect failed', { description: err.message }),
  });

  const selectedDef = CRM_TYPES.find(c => c.value === selectedCRM);

  return (
    <div className="space-y-4">
      {/* Status header */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-3 p-3 sm:p-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-white text-base sm:text-lg">
            <Plug className="w-5 h-5 text-blue-400 shrink-0" />
            CRM Integration
            <Badge className={isConnected
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs'
              : 'bg-slate-700/50 text-slate-400 border-slate-600 text-xs'}>
              {isConnected ? `Connected · ${crmStatus?.name || ''}` : 'Not connected'}
            </Badge>
          </CardTitle>
        </CardHeader>

        {isConnected && (
          <CardContent className="p-3 sm:p-4 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">CRM Type</p>
                <p className="text-sm font-medium text-white">{crmStatus?.name || '—'}</p>
              </div>
              <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">Contacts Synced</p>
                <p className="text-sm font-medium text-white">{crmStatus?.total_synced ?? 0}</p>
              </div>
              <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">Last Sync</p>
                <p className="text-sm font-medium text-white">
                  {crmStatus?.last_sync
                    ? new Date(crmStatus.last_sync).toLocaleString('he-IL')
                    : 'Never'}
                </p>
              </div>
            </div>

            <div className="bg-slate-950/30 rounded-lg p-3 sm:p-4 border border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Synced Fields</p>
              <div className="space-y-2">
                {['Full name, phone, email', 'Loyalty data (points, tier, achievements)', 'Wallet address (on-chain)', 'Tags and custom fields'].map((field) => (
                  <div key={field} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {field}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="sm" variant="outline"
                onClick={() => testMutation.mutate()} disabled={testMutation.isPending}
                className="flex-1 border-slate-700 text-slate-300 hover:text-white h-10">
                {testMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Test Connection
              </Button>
              <Button size="sm"
                onClick={() => syncAllMutation.mutate()} disabled={syncAllMutation.isPending}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-10">
                {syncAllMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync All Now
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}
                className="flex-1 border-rose-700/50 text-rose-400 hover:bg-rose-950/30 h-10">
                {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2Off className="w-4 h-4 mr-2" />}
                Disconnect
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Not connected */}
      {!isConnected && !isSetupOpen && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardContent className="py-8 p-3 sm:p-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto">
                <Plug className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-medium text-white">No CRM connected yet</h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Connect your CRM to automatically sync customer and loyalty data.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 py-2">
                {CRM_TYPES.map((crm) => (
                  <span key={crm.value}
                    className={`px-3 py-1 rounded-full border border-slate-800 text-xs ${crm.color}`}>
                    {crm.label}
                  </span>
                ))}
              </div>
              <Button onClick={() => setIsSetupOpen(true)}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white h-10">
                <Link2 className="w-4 h-4 mr-2" />
                Connect your CRM
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup form */}
      {!isConnected && isSetupOpen && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Plug className="w-5 h-5 text-emerald-400" />
              Connect CRM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-3 sm:p-4 pt-0">
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm text-slate-300">CRM Platform</Label>
              <Select value={selectedCRM} onValueChange={setSelectedCRM}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white w-full h-10">
                  <SelectValue placeholder="Select your CRM..." />
                </SelectTrigger>
                <SelectContent>
                  {CRM_TYPES.map((crm) => (
                    <SelectItem key={crm.value} value={crm.value}>{crm.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDef && (
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm text-slate-300">{selectedDef.field.replace('_', ' ')}</Label>
                <Input
                  value={credentials[selectedDef.field] || ''}
                  onChange={(e) => setCredentials(prev => ({ ...prev, [selectedDef.field]: e.target.value }))}
                  placeholder={selectedDef.placeholder}
                  className="w-full bg-slate-950 border-slate-800 text-white focus:border-emerald-500 h-10"
                  dir="ltr"
                />
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-950/30 border border-blue-900/50">
              <Shield className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-200">Credentials stored encrypted and used only for CRM sync.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !selectedCRM}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-10">
                {connectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                Test & Connect
              </Button>
              <Button variant="outline" onClick={() => setIsSetupOpen(false)}
                className="flex-1 sm:flex-none border-slate-700 text-slate-300 hover:text-white h-10">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}