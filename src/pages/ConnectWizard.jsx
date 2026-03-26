import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { toast } from 'sonner';
import {
  Check, Copy, ChevronRight, ChevronLeft, Loader2,
  Zap, Code2, HelpCircle, CheckCircle2, XCircle,
  Clock, RefreshCw, Store, Globe, ExternalLink
} from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'online', label: 'Online Store',  sub: 'Ecommerce / website',   icon: Globe,  color: '#0F7B6C', desc: 'Connect Shopify, WooCommerce, Wix, Stripe, or any custom store.' },
  { id: 'pos',    label: 'Physical POS',  sub: 'In-store terminal',      icon: Store,  color: '#2563EB', desc: 'Connect Square, Tranzila, Android POS, or any physical terminal.' },
  { id: 'manual', label: 'Manual / API',  sub: 'Custom integration',     icon: Code2,  color: '#7C3AED', desc: 'Direct API, webhooks, or a custom system.' },
];

const PLATFORMS = {
  online: [
    { id: 'shopify',     label: 'Shopify',         emoji: '🛍️', method: 'webhook' },
    { id: 'woocommerce', label: 'WooCommerce',      emoji: '🟣', method: 'webhook' },
    { id: 'wix',         label: 'Wix',              emoji: '⬛', method: 'webhook' },
    { id: 'stripe',      label: 'Stripe',           emoji: '💳', method: 'stripe'  },
    { id: 'zapier',      label: 'Zapier / Make',    emoji: '⚡', method: 'zapier'  },
    { id: 'other_web',   label: 'Other',            emoji: '🔧', method: 'webhook' },
  ],
  pos: [
    { id: 'square',      label: 'Square',           emoji: '⬛', method: 'oauth'   },
    { id: 'tranzila',    label: 'Tranzila',         emoji: '🇮🇱', method: 'webhook' },
    { id: 'android',     label: 'Android POS',      emoji: '📱', method: 'api'     },
    { id: 'lightspeed',  label: 'Lightspeed',       emoji: '⚡', method: 'webhook' },
    { id: 'other_pos',   label: 'Other Terminal',   emoji: '🖥️', method: 'webhook' },
  ],
  manual: [
    { id: 'api_direct',  label: 'Direct API',       emoji: '🔌', method: 'api'     },
    { id: 'make',        label: 'Make (Integromat)', emoji: '⚙️', method: 'zapier'  },
    { id: 'custom',      label: 'Custom System',    emoji: '🛠️', method: 'webhook' },
  ],
};

const WEBHOOK_URL   = 'https://mooadon.base44.app/functions/posTransactionWebhook';

const PLATFORM_GUIDE = {
  shopify:     { steps: ["Go to Shopify Admin → Settings → Notifications", "Scroll to Webhooks → Create webhook", "Event: Order payment · Format: JSON · URL: paste Webhook URL below", "Save ✅"] },
  woocommerce: { steps: ["Go to WooCommerce → Settings → Advanced → Webhooks", "Click Add Webhook · Status: Active", "Topic: Order completed · Delivery URL: paste Webhook URL below", "Save ✅"] },
  wix:         { steps: ["Go to Wix Dashboard → Automations → New Automation", "Trigger: Order Paid · Action: Send Webhook", "Paste the Webhook URL below as the destination", "Activate ✅"] },
  stripe:      { steps: ["Go to Stripe Dashboard → Developers → Webhooks", "Click Add endpoint · paste Webhook URL below", "Select event: checkout.session.completed", "Save ✅"] },
  zapier:      { steps: ["In Zapier, create a new Zap", "Trigger: your app (Shopify, Wix, etc.)", "Action: Webhooks by Zapier → POST · URL: paste Webhook URL below", "Turn on ✅"] },
  tranzila:    { steps: ["Contact Tranzila support", "Ask them to enable webhooks for your account", "Give them the Webhook URL below", "Done ✅"] },
  square:      { steps: ["Click Connect Square below", "Approve access in Square", "Return here automatically", "Done ✅"] },
  other_web:   { steps: ["Copy the Webhook URL below", "In your platform find Webhooks / Integrations", "Add the URL for order/payment events", "Done ✅"] },
  other_pos:   { steps: ["Copy the Webhook URL and API Key below", "Enter them in your POS integration settings", "Place a test transaction", "Done ✅"] },
  api_direct:  { steps: ["Copy your API Key and Webhook URL below", "Add them to your system HTTP headers", "POST to the Webhook URL on each sale", "Done ✅"] },
};
const STRIPE_WH_URL = 'https://mooadon.base44.app/functions/stripeWebhook';

// ─── Shared UI ────────────────────────────────────────────────────────────────

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

function CopyBtn({ value, label = 'Copy', copiedKey, copied, copy }) {
  const isCopied = copied === copiedKey;
  return (
    <button
      onClick={() => copy(value, copiedKey)}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border flex-shrink-0 ${
        isCopied
          ? 'bg-teal-500/20 border-teal-500/40 text-teal-400'
          : 'bg-[#17171f] border-[#2d2d3a] text-slate-400 hover:text-white hover:border-slate-500'
      }`}
    >
      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {isCopied ? 'Copied!' : label}
    </button>
  );
}

function Field({ label, value, copyKey, copied, copy, secret }) {
  const [show, setShow] = useState(false);
  const display = secret && !show ? '••••••••••••••••' : value;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 bg-[#0d0d14] border border-[#2d2d3a] rounded-xl px-3 py-2.5">
        <span className="flex-1 text-sm text-white truncate font-mono">{display}</span>
        {secret && (
          <button onClick={() => setShow(s => !s)} className="text-xs text-slate-500 hover:text-slate-300 px-1">
            {show ? 'Hide' : 'Show'}
          </button>
        )}
        <CopyBtn value={value} copiedKey={copyKey} copied={copied} copy={copy} />
      </div>
    </div>
  );
}

function InfoBox({ color = 'teal', children }) {
  const map = {
    teal:   'bg-teal-500/10 border-teal-500/25 text-teal-200',
    yellow: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-200',
    blue:   'bg-blue-500/10 border-blue-500/25 text-blue-200',
    orange: 'bg-orange-500/10 border-orange-500/25 text-orange-200',
  };
  return <div className={`rounded-xl border p-4 text-sm ${map[color]}`}>{children}</div>;
}

function StepBar({ current }) {
  const labels = ['Type', 'Platform', 'Credentials', 'Test', 'Go Live'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const n = i + 1;
        const done   = current > n;
        const active = current === n;
        return (
          <React.Fragment key={n}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                done   ? 'bg-teal-500 border-teal-500 text-white' :
                active ? 'bg-transparent border-teal-400 text-teal-400' :
                         'bg-transparent border-[#2d2d3a] text-slate-600'
              }`}>
                {done ? <Check className="w-3.5 h-3.5" /> : n}
              </div>
              <span className={`text-xs hidden sm:block max-w-[60px] text-center leading-tight ${
                active ? 'text-teal-400' : done ? 'text-slate-400' : 'text-slate-600'
              }`}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={`flex-1 h-px mx-1 mb-4 transition-colors duration-300 ${done ? 'bg-teal-500' : 'bg-[#2d2d3a]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1({ value, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">What are you connecting?</h2>
        <p className="text-sm text-slate-400 mt-1">Choose the type of integration.</p>
      </div>
      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const sel  = value === cat.id;
          return (
            <button key={cat.id} onClick={() => onChange(cat.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                sel ? 'border-teal-500 bg-teal-500/8' : 'border-[#2d2d3a] bg-[#17171f] hover:border-[#3d3d4a]'
              }`}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: cat.color + '22', border: `1.5px solid ${cat.color}44` }}>
                <Icon className="w-5 h-5" style={{ color: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm">{cat.label}
                  <span className="ml-2 text-xs font-normal text-slate-500">{cat.sub}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{cat.desc}</div>
              </div>
              {sel && <Check className="w-5 h-5 text-teal-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step2({ category, value, onChange }) {
  const options = PLATFORMS[category] || [];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Choose your platform</h2>
        <p className="text-sm text-slate-400 mt-1">Which system are you connecting?</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {options.map(p => (
          <button key={p.id} onClick={() => onChange(p)}
            className={`relative p-4 rounded-xl border-2 text-left transition-all ${
              value?.id === p.id ? 'border-teal-500 bg-teal-500/10' : 'border-[#2d2d3a] bg-[#17171f] hover:border-[#3d3d4a]'
            }`}>
            {value?.id === p.id && <CheckCircle2 className="absolute top-2.5 right-2.5 w-4 h-4 text-teal-400" />}
            <div className="text-2xl mb-2">{p.emoji}</div>
            <div className="font-semibold text-white text-sm">{p.label}</div>
            <div className="text-xs text-slate-600 mt-0.5 capitalize">{p.method}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step3({ companyId, platform, integration }) {
  const { copied, copy } = useCopy();
  if (!integration) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-7 h-7 text-teal-500 animate-spin" />
        <p className="text-slate-400 text-sm">Generating credentials…</p>
      </div>
    );
  }

  const isStripe = platform?.method === 'stripe';
  const isOAuth  = platform?.method === 'oauth';
  const isZapier = platform?.method === 'zapier';
  const webhookUrl = isStripe ? STRIPE_WH_URL : WEBHOOK_URL;

  const sampleJson = JSON.stringify({
    phone: '+972501234567',
    amount: 150.00,
    order_id: 'ORD-001',
    branch_api_key: integration.api_key || 'YOUR_API_KEY',
    company_id: companyId,
  }, null, 2);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Connect {platform?.label}</h2>
        <p className="text-sm text-slate-400 mt-1">Follow these steps to connect {platform?.label} to Mooadon.</p>
      </div>

      {/* Plain-language guide */}
      {PLATFORM_GUIDE[platform?.id] && (
        <div className="bg-teal-500/8 border border-teal-500/20 rounded-xl p-4 space-y-2">
          <p className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3">How to connect</p>
          {PLATFORM_GUIDE[platform?.id].steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-teal-400 text-[10px] font-bold">{i + 1}</span>
              </div>
              <span className="text-sm text-slate-300">{s}</span>
            </div>
          ))}
        </div>
      )}

      {isOAuth && (
        <InfoBox color="blue">
          <strong>Square — OAuth connection</strong>
          <p className="text-slate-300 text-xs mt-1">Click "Connect Square" below. You'll be redirected to Square to approve access.</p>
        </InfoBox>
      )}
      {isZapier && (
        <InfoBox color="orange">
          <strong>Zapier / Make</strong>
          <p className="text-slate-300 text-xs mt-1">Create a new Webhook action and paste the URL below as the destination.</p>
        </InfoBox>
      )}
      {isStripe && (
        <InfoBox color="blue">
          <strong>Stripe Webhook</strong>
          <p className="text-slate-300 text-xs mt-1">In Stripe Dashboard → Developers → Webhooks → Add endpoint. Listen to: <code className="text-teal-400">checkout.session.completed</code></p>
        </InfoBox>
      )}

      <div className="space-y-3">
        <Field label="Company ID"   value={companyId}                     copyKey="cid" copied={copied} copy={copy} />
        <Field label="Webhook URL"  value={webhookUrl}                    copyKey="wh"  copied={copied} copy={copy} />
        {!isOAuth && (
          <>
            <Field label="API Key"    value={integration.api_key    || '—'} copyKey="key" copied={copied} copy={copy} />
            <Field label="API Secret" value={integration.api_secret || '—'} copyKey="sec" copied={copied} copy={copy} secret />
          </>
        )}
      </div>

      {!isOAuth && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sample JSON</p>
            <CopyBtn value={sampleJson} label="Copy JSON" copiedKey="json" copied={copied} copy={copy} />
          </div>
          <pre className="bg-[#0d0d14] border border-[#2d2d3a] rounded-xl p-4 text-xs font-mono text-teal-300 overflow-x-auto whitespace-pre">
            {sampleJson}
          </pre>
        </div>
      )}

      {isOAuth && (
        <button
          onClick={async () => {
            try {
              const res = await base44.functions.invoke('squareOAuth', { action: 'initiate', company_id: companyId });
              if (res.data?.authorization_url) {
                window.location.href = res.data.authorization_url;
              } else {
                toast.error('Failed to start Square connection');
              }
            } catch (e) {
              toast.error(e.message);
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Connect with Square →
        </button>
      )}
    </div>
  );
}

function Step4({ companyId, integration, platform, onStatusChange, testStatus }) {
  const [state, setState]   = useState(testStatus || 'idle');
  const [result, setResult] = useState(null);
  const isOAuth = platform?.method === 'oauth';

  useEffect(() => { setState(testStatus || 'idle'); }, [testStatus]);

  const sendTest = async () => {
    setState('sending');
    try {
      const res = await base44.functions.invoke('posTransactionWebhook', {
        phone: '+972500000000', amount: 1.00,
        order_id: `TEST-${Date.now()}`,
        branch_api_key: integration?.api_key,
        company_id: companyId, _test: true,
      });
      const ok = res.data?.success || res.data?.status === 'exists';
      setState(ok ? 'success' : 'failed');
      setResult(res.data);
      onStatusChange(ok ? 'connected' : 'failed');
    } catch (e) {
      setState('failed');
      setResult({ error: e.message });
      onStatusChange('failed');
    }
  };

  const checkSquare = async () => {
    setState('sending');
    try {
      const res = await base44.functions.invoke('squareOAuth', { action: 'status', company_id: companyId });
      const ok = res.data?.connected;
      setState(ok ? 'success' : 'failed');
      setResult(res.data);
      onStatusChange(ok ? 'connected' : 'failed');
    } catch (e) {
      setState('failed');
      setResult({ error: e.message });
      onStatusChange('failed');
    }
  };

  const statusUI = {
    idle:    { icon: Clock,        color: 'text-slate-400',  bg: 'bg-[#17171f]',     border: 'border-[#2d2d3a]',      label: 'Not tested yet' },
    sending: { icon: Loader2,      color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/25',    label: 'Testing connection…' },
    waiting: { icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25',  label: 'Waiting for order…' },
    success: { icon: CheckCircle2, color: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/25',    label: 'Connected ✓' },
    failed:  { icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25',     label: 'Connection failed' },
  };
  const s = statusUI[state];
  const Icon = s.icon;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Test your connection</h2>
        <p className="text-sm text-slate-400 mt-1">Verify that orders flow through correctly.</p>
      </div>

      <div className={`flex items-center gap-3 p-4 rounded-xl border ${s.bg} ${s.border}`}>
        <Icon className={`w-5 h-5 ${s.color} ${state === 'sending' ? 'animate-spin' : ''}`} />
        <span className={`font-medium text-sm ${s.color}`}>{s.label}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isOAuth ? (
          <button onClick={checkSquare} disabled={state === 'sending'}
            className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors">
            {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Check Square connection status
          </button>
        ) : (
          <>
            <button onClick={sendTest} disabled={state === 'sending'}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors">
              {state === 'sending' ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><RefreshCw className="w-4 h-4" /> Send test order</>}
            </button>
            <button onClick={() => { setState('waiting'); onStatusChange('waiting'); toast.info('Watching for your test order…'); }}
              disabled={state === 'sending'}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[#17171f] border border-[#2d2d3a] hover:border-slate-500 text-slate-300 rounded-xl font-medium text-sm transition-colors">
              <Check className="w-4 h-4" /> I placed a test order
            </button>
          </>
        )}
      </div>

      {result && (
        <div className="bg-[#0d0d14] border border-[#2d2d3a] rounded-xl p-4">
          <p className="text-xs text-slate-600 font-mono mb-1">Response</p>
          <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function Step5({ category, platform, testStatus, integration }) {
  const catLabel  = CATEGORIES.find(c => c.id === category)?.label || category;
  const platLabel = platform?.label || '—';
  const testOk    = testStatus === 'connected';

  const rows = [
    { label: 'Type',               value: catLabel },
    { label: 'Platform',           value: platLabel },
    { label: 'Test status',        value: testOk ? '✅ Connected' : testStatus === 'waiting' ? '⏳ Waiting' : '❌ Not tested' },
    { label: 'Integration status', value: integration?.integration_status === 'active' ? '🟢 Active' : '🟡 Pending' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{testOk ? "You're live! 🎉" : "Almost there…"}</h2>
        <p className="text-sm text-slate-400 mt-1">Integration summary for {platLabel}.</p>
      </div>

      <div className="rounded-xl border border-[#2d2d3a] overflow-hidden">
        {rows.map((r, i) => (
          <div key={i} className={`flex justify-between px-4 py-3 ${i % 2 === 0 ? 'bg-[#17171f]' : 'bg-[#0d0d14]'}`}>
            <span className="text-sm text-slate-400">{r.label}</span>
            <span className="text-sm font-medium text-white">{r.value}</span>
          </div>
        ))}
      </div>

      {testOk ? (
        <InfoBox color="teal">
          <strong>Integration active.</strong> Orders from {platLabel} will automatically award loyalty tokens to your customers.
        </InfoBox>
      ) : (
        <InfoBox color="yellow">
          <strong>Test not completed.</strong> Go back to Step 4 and run a test order to confirm rewards are working.
        </InfoBox>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ConnectWizard() {
  const { primaryCompanyId } = useUserPermissions();
  const companyId = primaryCompanyId;

  const [step, setStep]               = useState(1);
  const [category, setCategory]       = useState('');
  const [platform, setPlatform]       = useState(null);
  const [integration, setIntegration] = useState(null);
  const [testStatus, setTestStatus]   = useState('idle');
  const [saving, setSaving]           = useState(false);

  // Load existing integration
  useEffect(() => {
    if (!companyId) return;
    base44.entities.POSIntegration
      .filter({ company_id: companyId })
      .then(list => {
        if (!list?.length) return;
        const rec = list[0];
        setIntegration(rec);
        if (rec.platform_type) {
          const allPlats = Object.values(PLATFORMS).flat();
          const found = allPlats.find(p => p.id === rec.platform_type);
          if (found) setPlatform(found);
          const catEntry = Object.entries(PLATFORMS).find(([, arr]) => arr.some(p => p.id === rec.platform_type));
          if (catEntry) setCategory(catEntry[0]);
        }
        if (rec.last_test_result) setTestStatus(rec.last_test_result);
      })
      .catch(() => {});
  }, [companyId]);

  const saveIntegration = async () => {
    if (!companyId || !platform) return;
    setSaving(true);
    try {
      const existing  = await base44.entities.POSIntegration.filter({ company_id: companyId });
      const apiKey    = existing[0]?.api_key    || `mk_${companyId.slice(0,8)}_${Math.random().toString(36).slice(2,10)}`;
      const apiSecret = existing[0]?.api_secret || `sk_${Math.random().toString(36).slice(2,18)}`;

      const data = {
        company_id: companyId, integration_type: category,
        platform_type: platform.id, connection_method: platform.method,
        integration_status: 'pending', api_key: apiKey, api_secret: apiSecret, status: 'active',
      };

      let rec;
      if (existing.length > 0) {
        await base44.entities.POSIntegration.update(existing[0].id, data);
        rec = { ...existing[0], ...data };
      } else {
        rec = await base44.entities.POSIntegration.create(data);
      }
      setIntegration(rec);
    } catch (e) {
      toast.error('Could not save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestStatus = async (status) => {
    setTestStatus(status);
    if (!integration) return;
    try {
      await base44.entities.POSIntegration.update(integration.id, {
        last_test_at: new Date().toISOString(),
        last_test_result: status,
        integration_status: status === 'connected' ? 'active' : 'pending',
      });
      setIntegration(p => ({ ...p, last_test_result: status, integration_status: status === 'connected' ? 'active' : 'pending' }));
    } catch (_) {}
  };

  const canNext = () => {
    if (step === 1) return !!category;
    if (step === 2) return !!platform;
    return true;
  };

  const goNext = async () => {
    if (step === 2) {
      await saveIntegration();
      await new Promise(r => setTimeout(r, 50));
    }
    setStep(s => Math.min(s + 1, 5));
  };

  return (
    <div className="min-h-screen bg-[#0d0d14] px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <p className="text-teal-400 text-xs font-semibold uppercase tracking-widest mb-1">Setup</p>
          <h1 className="text-2xl font-bold text-white">Connect your sales channel</h1>
          <p className="text-slate-400 text-sm mt-1">Online store, physical POS, or custom API — we support them all.</p>
        </div>

        <StepBar current={step} />

        <div className="bg-[#1a1a27] border border-[#2d2d3a] rounded-2xl p-6 sm:p-8">
          {step === 1 && <Step1 value={category} onChange={v => { setCategory(v); setPlatform(null); }} />}
          {step === 2 && <Step2 category={category} value={platform} onChange={setPlatform} />}
          {step === 3 && <Step3 companyId={companyId} platform={platform} integration={integration} />}
          {step === 4 && <Step4 companyId={companyId} integration={integration} platform={platform} onStatusChange={handleTestStatus} testStatus={testStatus} />}
          {step === 5 && <Step5 category={category} platform={platform} testStatus={testStatus} integration={integration} />}

          <div className="flex items-center justify-between mt-8 pt-5 border-t border-[#2d2d3a]">
            <button onClick={() => setStep(s => Math.max(s - 1, 1))} disabled={step === 1}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {step < 5 ? (
              <button onClick={goNext} disabled={!canNext() || saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Next <ChevronRight className="w-4 h-4" /></>}
              </button>
            ) : (
              <button onClick={() => toast.success("Integration saved! You're live 🎉")}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-medium text-sm transition-colors">
                <Check className="w-4 h-4" /> Done
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">Settings are saved per company and can be updated anytime.</p>
      </div>
    </div>
  );
}