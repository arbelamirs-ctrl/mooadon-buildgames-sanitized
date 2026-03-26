import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle2, ChevronRight, Loader2, RefreshCw, Plug, Settings, ArrowRight, Info, Zap
} from 'lucide-react';

const CRM_OPTIONS = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    logo: 'https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png',
    color: '#ff7a59',
    fields: [{ key: 'access_token', label: 'Access Token', placeholder: 'pat-na1-xxxxxxxx' }],
    docs: 'https://developers.hubspot.com/docs/api/private-apps',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    logo: 'https://www.salesforce.com/content/dam/sfdc-docs/www/logos/logo-salesforce.svg',
    color: '#00a1e0',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: '3MVG9...' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'xxxxxxxx', type: 'password' },
      { key: 'username', label: 'Username', placeholder: 'you@company.com' },
      { key: 'password', label: 'Password + Security Token', placeholder: 'passwordTOKEN', type: 'password' },
    ],
    docs: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    logo: 'https://pipedrive.com/favicon.ico',
    color: '#1a1a2e',
    fields: [{ key: 'api_token', label: 'API Token', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }],
    docs: 'https://developers.pipedrive.com/docs/api/v1',
  },
  {
    id: 'zoho',
    name: 'Zoho CRM',
    logo: 'https://www.zoho.com/favicon.ico',
    color: '#e42527',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: '1000.xxxxx' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'xxxxxxxx', type: 'password' },
      { key: 'refresh_token', label: 'Refresh Token', placeholder: '1000.xxxxx', type: 'password' },
    ],
    docs: 'https://www.zoho.com/crm/developer/docs/api/v6',
  },
  {
    id: 'monday',
    name: 'Monday.com',
    logo: 'https://monday.com/favicon.ico',
    color: '#ff3d57',
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'eyJ...' },
      { key: 'board_id', label: 'Board ID', placeholder: '1234567890' },
    ],
    docs: 'https://developer.monday.com/api-reference/docs',
  },
  {
    id: 'freshsales',
    name: 'Freshsales',
    logo: 'https://www.freshworks.com/favicon.ico',
    color: '#05b96b',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'domain', label: 'Domain', placeholder: 'yourcompany.freshsales.io' },
    ],
    docs: 'https://developer.freshsales.io/api',
  },
  {
    id: 'dynamics',
    name: 'Dynamics 365',
    logo: 'https://www.microsoft.com/favicon.ico',
    color: '#0078d4',
    fields: [
      { key: 'client_id', label: 'Client ID (App ID)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'xxxxxxxx', type: 'password' },
      { key: 'tenant_id', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'org_url', label: 'Org URL', placeholder: 'https://yourorg.crm.dynamics.com' },
    ],
    docs: 'https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview',
  },
];

function Step1({ selected, onSelect }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Choose your CRM</h2>
        <p className="text-xs text-slate-400 mt-0.5">Select the CRM you want to sync loyalty data with.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CRM_OPTIONS.map(crm => (
          <button
            key={crm.id}
            onClick={() => onSelect(crm.id)}
            className={`flex items-center gap-3 text-left rounded-xl border-2 p-4 transition-all ${
              selected === crm.id
                ? 'border-teal-500 bg-teal-500/10'
                : 'border-[#2d2d3a] bg-[#17171f] hover:border-teal-500/40'
            }`}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/10 shrink-0">
              <img src={crm.logo} alt={crm.name} className="w-5 h-5 object-contain" onError={e => { e.target.style.display='none'; }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white">{crm.name}</p>
            </div>
            {selected === crm.id && <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step2({ crm, credentials, onChange, onTest, testLoading, testResult }) {
  const allFilled = crm?.fields.every(f => credentials[f.key]?.trim());
  
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Connect {crm.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Enter your API credentials. They're stored securely.</p>
        </div>
        <a href={crm.docs} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 shrink-0">
          <Info className="w-3 h-3" /> Docs
        </a>
      </div>

      <div className="space-y-3">
        {crm?.fields.map(field => (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs text-slate-400">{field.label}</Label>
            <Input
              type={field.type || 'text'}
              placeholder={field.placeholder}
              value={credentials[field.key] || ''}
              onChange={e => onChange({ ...credentials, [field.key]: e.target.value })}
              className="h-9 text-sm bg-[#0f1015] border-[#2d2d3a] text-white font-mono"
              dir="ltr"
            />
          </div>
        ))}
      </div>

      <Button onClick={onTest} disabled={testLoading || !allFilled}
        className="w-full bg-violet-600 hover:bg-violet-700 text-white h-9 text-sm gap-2">
        {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
        {testLoading ? 'Testing...' : 'Test Connection'}
      </Button>

      {testResult && (
        <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${
          testResult.success
            ? 'bg-teal-500/10 border border-teal-500/25 text-teal-400'
            : 'bg-rose-500/10 border border-rose-500/25 text-rose-400'
        }`}>
          {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <span className="w-4 h-4 rounded-full bg-rose-500/50" />}
          {testResult.success ? 'Connection successful!' : `Error: ${testResult.error}`}
        </div>
      )}

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400">
        Credentials are stored securely and used server-side only.
      </div>
    </div>
  );
}

function Step3({ config, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Sync settings</h2>
        <p className="text-xs text-slate-400 mt-0.5">Configure how data flows between Mooadon and your CRM.</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Sync direction</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'to_crm', label: 'Mooadon → CRM' },
              { id: 'from_crm', label: 'CRM → Mooadon' },
              { id: 'bidirectional', label: 'Bidirectional' },
            ].map(opt => (
              <button key={opt.id}
                onClick={() => onChange({ ...config, sync_direction: opt.id })}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  config.sync_direction === opt.id
                    ? 'border-teal-500 bg-teal-500/15 text-teal-300'
                    : 'border-[#2d2d3a] text-slate-300 hover:border-teal-500/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Sync trigger</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'on_transaction', label: 'On every transaction' },
              { id: 'manual', label: 'Manual only' },
            ].map(opt => (
              <button key={opt.id}
                onClick={() => onChange({ ...config, sync_trigger: opt.id })}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  config.sync_trigger === opt.id
                    ? 'border-teal-500 bg-teal-500/15 text-teal-300'
                    : 'border-[#2d2d3a] text-slate-300 hover:border-teal-500/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Events to log in CRM</Label>
          <div className="flex flex-wrap gap-2">
            {['purchase', 'redemption', 'tier_upgrade', 'registration'].map(evt => {
              const active = (config.log_events || []).includes(evt);
              return (
                <button key={evt}
                  onClick={() => {
                    const current = config.log_events || [];
                    onChange({ ...config, log_events: active ? current.filter(e => e !== evt) : [...current, evt] });
                  }}
                  className={`rounded-full px-3 py-1 text-xs border transition-all ${
                    active ? 'border-teal-500 bg-teal-500/15 text-teal-300' : 'border-[#2d2d3a] text-slate-400 hover:border-teal-500/40'
                  }`}
                >
                  {evt}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4({ crm, config, syncLoading, onManualSync }) {
  return (
    <div className="space-y-4">
      <div className="text-center py-4 space-y-4">
        <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-teal-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{crm.name} connected!</h2>
          <p className="text-sm text-slate-400 mt-1">
            Loyalty data will now sync to your CRM automatically on <span className="text-teal-300">{config.sync_trigger === 'manual' ? 'manual trigger' : 'every transaction'}</span>.
          </p>
        </div>
      </div>

      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 text-left space-y-2">
        <p className="text-xs text-slate-400">What syncs:</p>
        <ul className="text-xs text-slate-300 space-y-1">
          <li>✅ Contact create / update with deduplication by email</li>
          <li>✅ Loyalty points + tier level</li>
          <li>✅ Total points earned</li>
          {(config.log_events || []).length > 0 && (
            <li>✅ Events: {(config.log_events || []).join(', ')}</li>
          )}
          {config.sync_direction === 'bidirectional' && (
            <li>✅ Pulls name/email/phone back from CRM</li>
          )}
        </ul>
      </div>

      <Button onClick={onManualSync} disabled={syncLoading}
        className="w-full bg-teal-500 hover:bg-teal-600 text-white h-9 text-sm gap-2">
        {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {syncLoading ? 'Syncing...' : 'Sync all clients now'}
      </Button>
    </div>
  );
}

const STEPS = ['Choose CRM', 'Credentials', 'Settings', 'Done'];

export default function ConnectCRM() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [selectedCRM, setSelectedCRM] = useState(null);
  const [credentials, setCredentials] = useState({});
  const [syncConfig, setSyncConfig] = useState({ sync_direction: 'to_crm', sync_trigger: 'on_transaction', log_events: ['purchase', 'redemption'] });
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [existingConfigId, setExistingConfigId] = useState(null);

  const { data: existingConfigs = [] } = useQuery({
    queryKey: ['crmConfigs', primaryCompanyId],
    queryFn: () => base44.entities.CRMConfig.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId,
  });

  useEffect(() => {
    if (existingConfigs.length > 0 && !selectedCRM) {
      const cfg = existingConfigs[0];
      setSelectedCRM(cfg.crm_type);
      setCredentials(cfg.api_credentials || {});
      setSyncConfig({
        sync_direction: cfg.sync_direction || 'to_crm',
        sync_trigger: cfg.sync_trigger || 'on_transaction',
        log_events: cfg.log_events || ['purchase', 'redemption'],
      });
      setExistingConfigId(cfg.id);
      if (cfg.is_active) setStep(3);
    }
  }, [existingConfigs]);

  const crm = CRM_OPTIONS.find(c => c.id === selectedCRM);

  const handleTestConnection = async () => {
    if (!crm) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('testCRMConnection', {
        company_id: primaryCompanyId,
        crm_type: selectedCRM,
        credentials,
      });
      setTestResult(res.data);
    } catch (e) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTestLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!primaryCompanyId) return;
    setSyncLoading(true);
    try {
      const res = await base44.functions.invoke('manualCRMSync', {
        company_id: primaryCompanyId,
      });
      toast.success(`Synced ${res.data.synced} of ${res.data.total} clients`);
      queryClient.invalidateQueries(['crmConfigs', primaryCompanyId]);
    } catch (e) {
      toast.error('Sync failed: ' + e.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const saveAndFinish = async () => {
    if (!primaryCompanyId || !selectedCRM) return;
    setSaving(true);
    try {
      const payload = {
        company_id: primaryCompanyId,
        crm_type: selectedCRM,
        is_active: true,
        api_credentials: credentials,
        sync_direction: syncConfig.sync_direction,
        sync_trigger: syncConfig.sync_trigger,
        log_events: syncConfig.log_events,
      };
      if (existingConfigId) {
        await base44.entities.CRMConfig.update(existingConfigId, payload);
      } else {
        const created = await base44.entities.CRMConfig.create(payload);
        setExistingConfigId(created.id);
      }
      queryClient.invalidateQueries(['crmConfigs', primaryCompanyId]);
      setStep(3);
      toast.success(`${crm?.name} connected successfully!`);
    } catch (e) {
      toast.error('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!selectedCRM;
    if (step === 1) {
      return crm?.fields.every(f => credentials[f.key]?.trim()) && testResult?.success;
    }
    return true;
  };

  const disconnect = async () => {
    if (!existingConfigId) return;
    await base44.entities.CRMConfig.update(existingConfigId, { is_active: false });
    queryClient.invalidateQueries(['crmConfigs', primaryCompanyId]);
    setStep(0);
    setSelectedCRM(null);
    setCredentials({});
    setExistingConfigId(null);
    setTestResult(null);
    toast.success('CRM disconnected');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plug className="w-6 h-6 text-teal-400" /> Connect CRM
          </h1>
          <p className="text-sm text-slate-400 mt-1">Sync loyalty data to your CRM automatically.</p>
        </div>
        {existingConfigId && step === 3 && (
          <Button size="sm" variant="ghost" onClick={disconnect} className="text-rose-400 hover:text-rose-300 text-xs h-8">
            Disconnect
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
              i === step ? 'bg-teal-500/20 text-teal-300' :
              i < step   ? 'text-teal-500' : 'text-slate-600'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? 'bg-teal-500 text-white' :
                i === step ? 'bg-teal-500/30 text-teal-300' : 'bg-[#2d2d3a] text-slate-600'
              }`}>
                {i < step ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-5">
        {step === 0 && <Step1 selected={selectedCRM} onSelect={setSelectedCRM} />}
        {step === 1 && crm && <Step2 crm={crm} credentials={credentials} onChange={setCredentials} onTest={handleTestConnection} testLoading={testLoading} testResult={testResult} />}
        {step === 2 && <Step3 config={syncConfig} onChange={setSyncConfig} />}
        {step === 3 && crm && <Step4 crm={crm} config={syncConfig} syncLoading={syncLoading} onManualSync={handleManualSync} />}
      </div>

      {step < 3 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0} className="text-slate-400 hover:text-white text-sm h-9">
            Back
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
              className="bg-teal-500 hover:bg-teal-600 text-white h-9 text-sm gap-2">
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={saveAndFinish} disabled={saving}
              className="bg-teal-500 hover:bg-teal-600 text-white h-9 text-sm gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Connect CRM'}
            </Button>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => setStep(1)} className="border-[#2d2d3a] text-white text-sm h-9 gap-2">
            <Settings className="w-4 h-4" /> Edit credentials
          </Button>
          <Button variant="outline" onClick={() => setStep(2)} className="border-[#2d2d3a] text-white text-sm h-9 gap-2">
            <RefreshCw className="w-4 h-4" /> Edit sync settings
          </Button>
        </div>
      )}
    </div>
  );
}