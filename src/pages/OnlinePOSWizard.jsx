import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { toast } from 'sonner';
import { Check, Copy, ChevronRight, Loader2, Zap, Code2, HelpCircle, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'shopify',     label: 'Shopify',        emoji: '🛍️' },
  { id: 'woocommerce', label: 'WooCommerce',    emoji: '🟣' },
  { id: 'wix',         label: 'Wix',            emoji: '⬛' },
  { id: 'stripe',      label: 'Stripe',         emoji: '💳' },
  { id: 'other',       label: 'Other / Custom', emoji: '🔧' },
];

const METHODS = [
  { id: 'zapier', label: 'Fast Setup',  sub: 'via Make or Zapier', icon: Zap,         color: '#FF6B35', desc: 'No code needed. Use a ready-made automation template.' },
  { id: 'api',    label: 'Direct API',  sub: 'Webhook / REST',     icon: Code2,       color: '#0F7B6C', desc: 'Send orders directly to our webhook. Full control.' },
  { id: 'help',   label: 'Need Help',   sub: 'Custom setup',       icon: HelpCircle,  color: '#6B7280', desc: "We'll guide you through the setup step by step." },
];

const WEBHOOK_URL = 'https://mooadon.base44.app/functions/posTransactionWebhook';

const SAMPLE_PAYLOAD = (apiKey, companyId) => JSON.stringify({
  phone: '+972501234567',
  amount: 150.00,
  order_id: 'ORD-001',
  branch_api_key: apiKey || 'YOUR_API_KEY',
  company_id: companyId || 'YOUR_COMPANY_ID',
}, null, 2);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = useCallback((text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);
  return { copied, copy };
}

function CopyBtn({ value, label, copiedKey, copied, copy }) {
  const isCopied = copied === copiedKey;
  return (
    <button
      onClick={() => copy(value, copiedKey)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
        isCopied
          ? 'bg-teal-500/20 border-teal-500/40 text-teal-400'
          : 'bg-[#17171f] border-[#2d2d3a] text-slate-400 hover:text-white hover:border-slate-500'
      }`}
    >
      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {isCopied ? 'Copied!' : (label || 'Copy')}
    </button>
  );
}

function Field({ label, value, copyKey, copied, copy }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 bg-[#0d0d14] border border-[#2d2d3a] rounded-lg px-3 py-2">
        <span className="flex-1 text-sm text-white truncate font-mono">{value}</span>
        <CopyBtn value={value} label="Copy" copiedKey={copyKey} copied={copied} copy={copy} />
      </div>
    </div>
  );
}

function StepDot({ n, active, done }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
      done   ? 'bg-teal-500 border-teal-500 text-white' :
      active ? 'bg-transparent border-teal-500 text-teal-400' :
               'bg-transparent border-[#2d2d3a] text-slate-600'
    }`}>
      {done ? <Check className="w-4 h-4" /> : n}
    </div>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function Step1Platform({ value, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Choose your platform</h2>
        <p className="text-sm text-slate-400 mt-1">Where are your online sales happening?</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
              value === p.id
                ? 'border-teal-500 bg-teal-500/10'
                : 'border-[#2d2d3a] bg-[#17171f] hover:border-[#3d3d4a]'
            }`}
          >
            {value === p.id && <CheckCircle2 className="absolute top-2.5 right-2.5 w-4 h-4 text-teal-400" />}
            <div className="text-2xl mb-2">{p.emoji}</div>
            <div className="font-semibold text-white text-sm">{p.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step2Method({ value, onChange, platform }) {
  const platformLabel = PLATFORMS.find(p => p.id === platform)?.label || 'your platform';
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Choose connection method</h2>
        <p className="text-sm text-slate-400 mt-1">How do you want to connect {platformLabel}?</p>
      </div>
      <div className="space-y-3">
        {METHODS.map(m => {
          const Icon = m.icon;
          const isSelected = value === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                isSelected ? 'border-teal-500 bg-teal-500/10' : 'border-[#2d2d3a] bg-[#17171f] hover:border-[#3d3d4a]'
              }`}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: m.color + '22', border: `1px solid ${m.color}44` }}>
                <Icon className="w-5 h-5" style={{ color: m.color }} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white text-sm">
                  {m.label} <span className="ml-2 text-xs font-normal text-slate-400">{m.sub}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{m.desc}</div>
              </div>
              {isSelected && <Check className="w-5 h-5 text-teal-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step3Package({ integration, companyId }) {
  const { copied, copy } = useCopy();

  if (!integration) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
        <span className="ml-2 text-slate-400 text-sm">Generating credentials...</span>
      </div>
    );
  }

  const payload = SAMPLE_PAYLOAD(integration.api_key, companyId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Your connection package</h2>
        <p className="text-sm text-slate-400 mt-1">Use these credentials to connect your store.</p>
      </div>

      {integration.connection_method === 'zapier' && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <p className="text-orange-300 font-medium text-sm mb-1">⚡ Fast Setup — Make / Zapier</p>
          <p className="text-slate-400 text-xs">Create a new webhook trigger and use the Webhook URL below as the destination. Map your order fields to the JSON payload format shown below.</p>
        </div>
      )}
      {integration.connection_method === 'help' && (
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
          <p className="text-slate-300 font-medium text-sm mb-1">🛠 Custom Setup</p>
          <p className="text-slate-400 text-xs">Share the credentials below with your developer or integration partner.</p>
        </div>
      )}

      <div className="space-y-3">
        <Field label="Company ID"   value={companyId}                    copyKey="cid"  copied={copied} copy={copy} />
        <Field label="Webhook URL"  value={WEBHOOK_URL}                  copyKey="wh"   copied={copied} copy={copy} />
        <Field label="API Key"      value={integration.api_key || '—'}   copyKey="key"  copied={copied} copy={copy} />
        <Field label="API Secret"   value={integration.api_secret || '—'} copyKey="sec" copied={copied} copy={copy} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sample JSON Payload</p>
          <CopyBtn value={payload} label="Copy JSON" copiedKey="payload" copied={copied} copy={copy} />
        </div>
        <pre className="bg-[#0d0d14] border border-[#2d2d3a] rounded-xl p-4 text-xs text-teal-300 font-mono overflow-x-auto whitespace-pre">
          {payload}
        </pre>
      </div>
    </div>
  );
}

function Step4Test({ companyId, integration, onStatusChange }) {
  const [testState, setTestState] = useState('idle');
  const [lastResult, setLastResult] = useState(null);

  const sendTestOrder = async () => {
    setTestState('sending');
    try {
      const res = await base44.functions.invoke('posTransactionWebhook', {
        phone: '+972500000000',
        amount: 1.00,
        order_id: `TEST-${Date.now()}`,
        branch_api_key: integration?.api_key,
        company_id: companyId,
        _test: true,
      });
      const ok = res.data?.success || res.data?.status === 'exists';
      setTestState(ok ? 'success' : 'failed');
      setLastResult(res.data);
      onStatusChange(ok ? 'connected' : 'failed', res.data);
    } catch (e) {
      setTestState('failed');
      setLastResult({ error: e.message });
      onStatusChange('failed', { error: e.message });
    }
  };

  const markManual = () => {
    setTestState('waiting');
    onStatusChange('waiting', null);
    toast.info('Waiting for your test order to arrive...');
  };

  const statusMap = {
    idle:    { icon: Clock,        color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  label: 'Not tested yet' },
    sending: { icon: Loader2,      color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20',   label: 'Sending test order...' },
    waiting: { icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Waiting for test order' },
    success: { icon: CheckCircle2, color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20',   label: 'Connected ✓' },
    failed:  { icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    label: 'Connection failed' },
  };
  const s = statusMap[testState];
  const Icon = s.icon;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Test your connection</h2>
        <p className="text-sm text-slate-400 mt-1">Send a test order to verify everything is wired up correctly.</p>
      </div>

      <div className={`flex items-center gap-3 p-4 rounded-xl border ${s.bg} ${s.border}`}>
        <Icon className={`w-5 h-5 ${s.color} ${testState === 'sending' ? 'animate-spin' : ''}`} />
        <span className={`font-medium text-sm ${s.color}`}>{s.label}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={sendTestOrder}
          disabled={testState === 'sending'}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors"
        >
          {testState === 'sending'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
            : <><RefreshCw className="w-4 h-4" /> Send test order</>}
        </button>
        <button
          onClick={markManual}
          disabled={testState === 'sending'}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-[#17171f] border border-[#2d2d3a] hover:border-slate-500 text-slate-300 rounded-xl font-medium text-sm transition-colors"
        >
          <Check className="w-4 h-4" /> I placed a test order
        </button>
      </div>

      {lastResult && (
        <div className="bg-[#0d0d14] border border-[#2d2d3a] rounded-xl p-4">
          <p className="text-xs text-slate-500 font-mono mb-1">Response</p>
          <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Step5GoLive({ platform, method, testStatus, integration }) {
  const platformLabel = PLATFORMS.find(p => p.id === platform)?.label || platform;
  const methodLabel   = METHODS.find(m => m.id === method)?.label    || method;

  const rows = [
    { label: 'Platform',           value: platformLabel },
    { label: 'Connection Method',  value: methodLabel },
    { label: 'Test Status',        value: testStatus === 'connected' ? '✅ Connected' : testStatus === 'waiting' ? '⏳ Waiting' : '❌ Not tested' },
    { label: 'Integration Status', value: integration?.integration_status === 'active' ? '🟢 Active' : '🟡 Pending' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">You're ready to go live</h2>
        <p className="text-sm text-slate-400 mt-1">Here's a summary of your online store integration.</p>
      </div>

      <div className="rounded-xl border border-[#2d2d3a] overflow-hidden">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-3 ${i % 2 === 0 ? 'bg-[#17171f]' : 'bg-[#0d0d14]'}`}>
            <span className="text-sm text-slate-400">{r.label}</span>
            <span className="text-sm font-medium text-white">{r.value}</span>
          </div>
        ))}
      </div>

      {testStatus === 'connected' ? (
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-5 text-center space-y-1">
          <div className="text-3xl">🎉</div>
          <p className="text-teal-300 font-semibold text-lg">Integration Active</p>
          <p className="text-slate-400 text-sm">Orders from {platformLabel} will now automatically award loyalty tokens to your customers.</p>
        </div>
      ) : (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-300 font-medium text-sm">⚠️ Test not completed</p>
          <p className="text-slate-400 text-xs mt-1">Go back to Step 4 and run a test before going live.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function OnlinePOSWizard() {
  const { user } = useAuth();
  const { primaryCompanyId } = useUserPermissions();
  const companyId = primaryCompanyId;

  const [step, setStep]               = useState(1);
  const [platform, setPlatform]       = useState('');
  const [method, setMethod]           = useState('');
  const [integration, setIntegration] = useState(null);
  const [testStatus, setTestStatus]   = useState('idle');
  const [saving, setSaving]           = useState(false);

  const TOTAL = 5;
  const stepLabels = ['Platform', 'Method', 'Credentials', 'Test', 'Go Live'];

  // Load existing integration on mount
  useEffect(() => {
    if (!companyId) return;
    base44.entities.POSIntegration
      .filter({ company_id: companyId, integration_type: 'online' })
      .then(res => {
        if (res?.length > 0) {
          const existing = res[0];
          setIntegration(existing);
          if (existing.platform_type)     setPlatform(existing.platform_type);
          if (existing.connection_method) setMethod(existing.connection_method);
          if (existing.last_test_result === 'connected') setTestStatus('connected');
        }
      })
      .catch(() => {});
  }, [companyId]);

  const saveIntegration = async (plat, meth) => {
    if (!companyId) return null;
    setSaving(true);
    try {
      const existing = await base44.entities.POSIntegration.filter({
        company_id: companyId,
        integration_type: 'online',
      });

      const apiKey    = existing[0]?.api_key    || `mk_${companyId.slice(0,8)}_${Math.random().toString(36).slice(2,10)}`;
      const apiSecret = existing[0]?.api_secret || `sk_${Math.random().toString(36).slice(2,18)}`;

      const payload = {
        company_id:         companyId,
        integration_type:   'online',
        platform_type:      plat,
        connection_method:  meth,
        integration_status: 'pending',
        api_key:            apiKey,
        api_secret:         apiSecret,
        status:             'active',
      };

      let record;
      if (existing.length > 0) {
        await base44.entities.POSIntegration.update(existing[0].id, payload);
        record = { ...existing[0], ...payload };
      } else {
        record = await base44.entities.POSIntegration.create(payload);
      }

      setIntegration(record);
      return record;
    } catch (e) {
      toast.error('Failed to save integration: ' + e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleTestStatus = async (status, result) => {
    setTestStatus(status);
    if (!integration) return;
    try {
      await base44.entities.POSIntegration.update(integration.id, {
        last_test_at:       new Date().toISOString(),
        last_test_result:   status,
        integration_status: status === 'connected' ? 'active' : 'pending',
      });
      setIntegration(prev => ({ ...prev, last_test_result: status, integration_status: status === 'connected' ? 'active' : 'pending' }));
    } catch (_) {}
  };

  const canAdvance = () => {
    if (step === 1) return !!platform;
    if (step === 2) return !!method;
    return true;
  };

  const advance = async () => {
    if (step === 2) await saveIntegration(platform, method);
    setStep(s => Math.min(s + 1, TOTAL));
  };

  const back = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-[#0d0d14] px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <p className="text-teal-400 text-xs font-semibold uppercase tracking-widest mb-1">Online Store</p>
          <h1 className="text-2xl font-bold text-white">Connect your online store</h1>
          <p className="text-slate-400 text-sm mt-1">Set up online sales integration in a few steps.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-0">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const isActive = step === n;
            const isDone   = step > n;
            return (
              <React.Fragment key={n}>
                <div className="flex flex-col items-center gap-1">
                  <StepDot n={n} active={isActive} done={isDone} />
                  <span className={`text-xs hidden sm:block ${isActive ? 'text-teal-400' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`flex-1 h-px mx-1 mb-4 transition-colors duration-300 ${isDone ? 'bg-teal-500' : 'bg-[#2d2d3a]'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-[#1a1a27] border border-[#2d2d3a] rounded-2xl p-6 sm:p-8 space-y-6">
          {step === 1 && <Step1Platform value={platform} onChange={setPlatform} />}
          {step === 2 && <Step2Method   value={method}   onChange={setMethod}   platform={platform} />}
          {step === 3 && <Step3Package  integration={integration} companyId={companyId} />}
          {step === 4 && <Step4Test     companyId={companyId} integration={integration} onStatusChange={handleTestStatus} />}
          {step === 5 && <Step5GoLive   platform={platform} method={method} testStatus={testStatus} integration={integration} />}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-[#2d2d3a]">
            <button
              onClick={back}
              disabled={step === 1}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Back
            </button>

            {step < TOTAL ? (
              <button
                onClick={advance}
                disabled={!canAdvance() || saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : <>Next <ChevronRight className="w-4 h-4" /></>}
              </button>
            ) : (
              <button
                onClick={() => toast.success("Integration saved! You're live 🎉")}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-medium text-sm transition-colors"
              >
                <Check className="w-4 h-4" /> Done
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-600">
          Integration settings are saved per company and can be updated anytime from Settings.
        </p>
      </div>
    </div>
  );
}