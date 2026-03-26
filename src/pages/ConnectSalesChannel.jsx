import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import {
  Phone, QrCode, Webhook, Mail, Copy, Send, CheckCircle2, XCircle, ExternalLink,
  Loader2, ChevronRight, Shield, ScanLine
} from 'lucide-react';
import { format } from 'date-fns';

const WEBHOOK_URL = `${window.location.origin}/api/functions/posWebhook`;

function copyText(text, message) {
  navigator.clipboard.writeText(text);
  toast.success(message);
}

// -- Channel Selector -------------------------------------------------------
function ChannelSelector({ selected, onSelect }) {
  const channels = [
    { id: 'offline', label: 'In-store (Offline)', icon: QrCode, desc: 'QR codes, receipts' },
    { id: 'online', label: 'Online (E-commerce)', icon: Webhook, desc: 'Shopify, WooCommerce, Stripe' },
    { id: 'both', label: 'Both', icon: Phone, desc: 'Offline + Online' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {channels.map(ch => (
        <button
          key={ch.id}
          onClick={() => onSelect(ch.id)}
          className={`text-left rounded-xl border-2 p-4 transition-all ${
            selected === ch.id
              ? 'border-teal-500 bg-teal-500/10'
              : 'border-[#2d2d3a] bg-[#17171f] hover:border-teal-500/40'
          }`}
        >
          <ch.icon className={`w-6 h-6 mb-2 ${selected === ch.id ? 'text-teal-400' : 'text-slate-400'}`} />
          <p className="font-semibold text-sm text-white">{ch.label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{ch.desc}</p>
        </button>
      ))}
    </div>
  );
}

// -- Simple QR Section (offline) -----------------------------------------------
function SimpleQRSection({ company, branch }) {
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const generateQR = async () => {
    if (!branch) {
      toast.error('Create a branch first');
      return;
    }
    setLoading(true);
    try {
      const result = await base44.functions.invoke('generateCustomerQR', {
        company_id: company.id,
        branch_id: branch.id,
        type: 'receipt'
      });
      setQrUrl(result.data?.qr_url || '');
      toast.success('QR code generated');
    } catch (e) {
      toast.error('Failed to generate QR: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-teal-500/10 border border-teal-500/25 rounded-xl p-4 text-sm text-teal-300">
        <p className="font-semibold mb-1">No IT needed — Get live in 2 minutes</p>
        <p className="text-xs text-teal-400/80">Print a QR code or add a link to your receipts.</p>
      </div>

      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-semibold text-white">Generate QR Code</h4>
        {qrUrl && (
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
          </div>
        )}
        <Button
          onClick={generateQR}
          disabled={loading || !branch}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <QrCode className="w-3.5 h-3.5 mr-2" />}
          {loading ? 'Generating...' : 'Generate QR Code'}
        </Button>
        {!branch && <p className="text-xs text-amber-400">Create a branch first.</p>}
      </div>
    </div>
  );
}

// -- Webhook Section -------------------------------------------------------
function WebhookSection({ company, branch, config, onConfigUpdate }) {
  const [identifierMode, setIdentifierMode] = useState(config?.customer_identifier_mode || 'phone');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [providerName, setProviderName] = useState('');
  const [providerEmail, setProviderEmail] = useState('');

  const examplePayload = JSON.stringify({
    company_id: company?.id || 'YOUR_COMPANY_ID',
    branch_id: branch?.id || 'YOUR_BRANCH_ID',
    customer_phone: '+972501234567',
    amount: 100,
    external_transaction_id: 'order_12345',
    currency: 'ILS',
    reward_type: 'token'
  }, null, 2);

  const sendTest = async () => {
    if (!branch) return;
    setTesting(true);
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mooadon-Signature': 'test-signature'
        },
        body: JSON.stringify({
          company_id: company.id,
          branch_id: branch.id,
          customer_phone: '+972501234567',
          amount: 1,
          external_transaction_id: 'test_' + Date.now()
        })
      });
      const result = await response.json();
      setTestResult({
        success: response.ok,
        error: result.error || 'Connected',
        time: new Date()
      });
    } catch (e) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const buildEmailBody = () => {
    return `Hi ${providerName || 'IT Team'},

Please configure your POS system to send transaction events to our webhook:

Webhook URL: ${WEBHOOK_URL}

Required fields in JSON payload:
- company_id: ${company?.id}
- branch_id: ${branch?.id}
- customer_phone: Customer phone in E.164 format (e.g., +972501234567)
- amount: Transaction amount
- external_transaction_id: Unique order ID (for idempotency)

Example payload:
${examplePayload}

Headers:
- Content-Type: application/json
- X-Mooadon-Signature: HMAC-SHA256 signature (secret key provided separately)

Questions? Contact our support team.

Thanks,
Mooadon Team`;
  };

  const openEmailClient = () => {
    const subject = 'Mooadon Webhook Integration Setup';
    const body = buildEmailBody();
    const mailtoLink = `mailto:${providerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 text-sm text-amber-300">
        <p className="font-semibold mb-1">Requires IT / POS provider setup</p>
        <p className="text-xs text-amber-400/80">Your POS sends events to us automatically when a transaction occurs.</p>
      </div>

      {/* Example payload */}
      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-400 uppercase tracking-wide">Example Payload</Label>
          <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-400 hover:text-white px-2"
            onClick={() => copyText(examplePayload, 'Payload copied!')}>
            <Copy className="w-3 h-3 mr-1" />Copy
          </Button>
        </div>
        <pre className="text-xs text-teal-300 bg-[#0f1015] border border-[#2d2d3a] rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
          {examplePayload}
        </pre>
      </div>

      {/* Customer identification mode */}
      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-semibold text-white">How do you identify customers?</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'phone', icon: Phone, label: 'Phone number', sub: 'Recommended' },
            { id: 'qr', icon: ScanLine, label: 'Customer QR scan', sub: 'Cashier scans app QR' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setIdentifierMode(opt.id); onConfigUpdate({ customer_identifier_mode: opt.id }); }}
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all ${
                identifierMode === opt.id
                  ? 'border-teal-500 bg-teal-500/10'
                  : 'border-[#2d2d3a] hover:border-teal-500/30'
              }`}
            >
              <opt.icon className={`w-4 h-4 mt-0.5 shrink-0 ${identifierMode === opt.id ? 'text-teal-400' : 'text-slate-500'}`} />
              <div>
                <p className={`text-xs font-medium ${identifierMode === opt.id ? 'text-white' : 'text-slate-300'}`}>{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>
        {identifierMode === 'phone' && (
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2 text-xs text-teal-400">
            Your POS must send <code className="font-mono">customer_phone</code> (E.164) in each event payload.
          </div>
        )}
        {identifierMode === 'qr' && (
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2 text-xs text-violet-400">
            The cashier scans the customer's QR from the Mooadon app. Send <code className="font-mono">customer_qr_session</code> in the payload.
          </div>
        )}
      </div>

      {/* Send test */}
      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-semibold text-white">Send test transaction</h4>
        <p className="text-xs text-slate-400">Verifies your connection is working end-to-end.</p>
        <Button
          onClick={sendTest}
          disabled={testing || !branch}
          className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 h-9 text-sm"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-2" />}
          {testing ? 'Sending...' : 'Send test transaction'}
        </Button>
        {!branch && <p className="text-xs text-amber-400">Create a branch first to send a test transaction.</p>}
        {testResult && (
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
            testResult.success
              ? 'bg-teal-500/10 border border-teal-500/25 text-teal-400'
              : 'bg-rose-500/10 border border-rose-500/25 text-rose-400'
          }`}>
            {testResult.success
              ? <><CheckCircle2 className="w-4 h-4" />Connected - event received at {format(new Date(testResult.time), 'HH:mm:ss')}</>
              : <><XCircle className="w-4 h-4" />Failed: {testResult.error}</>}
          </div>
        )}
      </div>

      {/* Send to IT */}
      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-white">Send instructions to my IT / POS provider</h4>
        </div>
        <p className="text-xs text-slate-400">Prepare a ready-to-send email with all webhook details.</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Provider / IT name (optional)</Label>
            <Input value={providerName} onChange={e => setProviderName(e.target.value)}
              placeholder="e.g. John from IT" className="h-8 text-xs bg-[#0f1015] border-[#2d2d3a] text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Their email (optional)</Label>
            <Input value={providerEmail} onChange={e => setProviderEmail(e.target.value)}
              placeholder="it@myposprovider.com" type="email"
              className="h-8 text-xs bg-[#0f1015] border-[#2d2d3a] text-white" dir="ltr" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openEmailClient} className="flex-1 bg-[#2d2d3a] hover:bg-[#3a3a4a] text-white h-9 text-xs">
            <Mail className="w-3.5 h-3.5 mr-2" />Open in email client
          </Button>
          <Button onClick={() => copyText(buildEmailBody(), 'Email copied!')}
            variant="outline" className="border-[#2d2d3a] text-white h-9 text-xs">
            <Copy className="w-3.5 h-3.5 mr-1.5" />Copy
          </Button>
        </div>
      </div>
    </div>
  );
}

// -- Online (Make/Zapier) section -----------------------------------------------
function OnlineSection({ company }) {
  const [platform, setPlatform] = useState('');
  const [step, setStep] = useState(1);

  const PLATFORMS = [
    { id: 'shopify', label: 'Shopify' },
    { id: 'woocommerce', label: 'WooCommerce' },
    { id: 'stripe', label: 'Stripe' },
    { id: 'wix', label: 'Wix' },
    { id: 'other', label: 'Other / Custom' },
  ];

  const makeTemplateUrl = 'https://www.make.com/en/integrations';
  const zapierTemplateUrl = 'https://zapier.com/apps/webhook/integrations';

  return (
    <div className="space-y-4">
      <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl p-4 text-sm text-violet-300">
        <p className="font-semibold mb-1">Connect Online via Make / Zapier (Recommended)</p>
        <p className="text-xs text-violet-400/80">No code needed. Set up in ~5 minutes using a pre-built template.</p>
      </div>

      {/* Step 1 */}
      <div className={`bg-[#17171f] border rounded-xl p-4 space-y-3 ${step >= 1 ? 'border-[#2d2d3a]' : 'border-[#1a1a22] opacity-50'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-teal-500 text-white' : 'bg-[#2d2d3a] text-slate-500'}`}>1</div>
          <h4 className="text-sm font-semibold text-white">Choose your platform</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => { setPlatform(p.id); setStep(Math.max(step, 2)); }}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                platform === p.id
                  ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                  : 'border-[#2d2d3a] text-slate-300 hover:border-violet-500/40'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 */}
      <div className={`bg-[#17171f] border rounded-xl p-4 space-y-3 transition-opacity ${step >= 2 ? 'border-[#2d2d3a] opacity-100' : 'border-[#1a1a22] opacity-40 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-teal-500 text-white' : 'bg-[#2d2d3a] text-slate-500'}`}>2</div>
          <h4 className="text-sm font-semibold text-white">Open the template</h4>
        </div>
        <p className="text-xs text-slate-400">Connect {platform ? PLATFORMS.find(p=>p.id===platform)?.label : 'your platform'} to Mooadon using Make or Zapier. Use the webhook URL below.</p>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-xs h-8"
            onClick={() => { window.open(makeTemplateUrl, '_blank'); setStep(Math.max(step, 3)); }}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Open Make template
          </Button>
          <Button size="sm" variant="outline" className="border-[#2d2d3a] text-white text-xs h-8"
            onClick={() => { window.open(zapierTemplateUrl, '_blank'); setStep(Math.max(step, 3)); }}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Open Zapier template
          </Button>
        </div>
        <div className="flex gap-2">
          <Input value={WEBHOOK_URL} readOnly className="h-8 text-xs bg-[#0f1015] border-[#2d2d3a] text-teal-300 font-mono" dir="ltr" />
          <Button size="sm" variant="outline" className="border-[#2d2d3a] text-white h-8 shrink-0"
            onClick={() => copyText(WEBHOOK_URL, 'Webhook URL copied!')}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Step 3 */}
      <div className={`bg-[#17171f] border rounded-xl p-4 space-y-3 transition-opacity ${step >= 3 ? 'border-[#2d2d3a] opacity-100' : 'border-[#1a1a22] opacity-40 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 3 ? 'bg-teal-500 text-white' : 'bg-[#2d2d3a] text-slate-500'}`}>3</div>
          <h4 className="text-sm font-semibold text-white">Test - place a test order</h4>
        </div>
        <p className="text-xs text-slate-400">Place a ILS1 test order on your store. If configured correctly, the status below will turn green.</p>
        <Button size="sm" onClick={() => setStep(4)} className="bg-teal-500 hover:bg-teal-600 text-xs h-8">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />I placed a test order
        </Button>
      </div>

      {step >= 4 && (
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-teal-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-teal-400">Connected </p>
            <p className="text-xs text-teal-400/70 mt-0.5">Online sales channel is active. Your customers will earn rewards on every order.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Offline content (QR + optional webhook) ------------------------------------
function OfflineContent({ company, branch, config, onConfigUpdate }) {
  const [mode, setMode] = useState(config?.offline_mode || null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => { setMode('counter_qr'); onConfigUpdate({ offline_mode: 'counter_qr' }); }}
          className={`text-left rounded-xl border-2 p-5 transition-all ${
            mode === 'counter_qr'
              ? 'border-teal-500 bg-teal-500/10'
              : 'border-[#2d2d3a] bg-[#17171f] hover:border-teal-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <QrCode className="w-6 h-6 text-teal-400" />
            <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30 text-xs">Recommended</Badge>
          </div>
          <h3 className="font-semibold text-white text-sm mb-1">Start with QR / Receipt Link</h3>
          <p className="text-xs text-slate-400">No IT needed. Print a QR or add a link to your receipts. Live in 2 minutes.</p>
        </button>

        <button
          onClick={() => { setMode('webhook'); onConfigUpdate({ offline_mode: 'webhook' }); }}
          className={`text-left rounded-xl border-2 p-5 transition-all ${
            mode === 'webhook'
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-[#2d2d3a] bg-[#17171f] hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <Webhook className="w-6 h-6 text-amber-400" />
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">IT / POS provider</Badge>
          </div>
          <h3 className="font-semibold text-white text-sm mb-1">Use Webhook (Automatic)</h3>
          <p className="text-xs text-slate-400">Your POS sends events to Mooadon automatically. Requires IT or POS provider setup.</p>
        </button>
      </div>

      {mode === 'counter_qr' && (
        <SimpleQRSection company={company} branch={branch} />
      )}
      {mode === 'webhook' && (
        <WebhookSection company={company} branch={branch} config={config} onConfigUpdate={onConfigUpdate} />
      )}
    </div>
  );
}

// -- Main page ------------------------------------------------------------------
export default function ConnectSalesChannel() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ['company', primaryCompanyId],
    queryFn: async () => {
      const cs = await base44.entities.Company.filter({ id: primaryCompanyId });
      return cs[0];
    },
    enabled: !!primaryCompanyId
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', primaryCompanyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const mainBranch = branches[0] || null;

  // Load or create SalesChannelConfig
  const { data: configs = [] } = useQuery({
    queryKey: ['salesChannelConfig', primaryCompanyId],
    queryFn: () => base44.entities.SalesChannelConfig.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const config = configs[0] || null;
  const [localConfig, setLocalConfig] = useState({});
  const [channelType, setChannelType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setLocalConfig(config);
      setChannelType(config.sales_channel || null);
      setInitialized(true);
    }
  }, [config, initialized]);

  const saveConfig = async (updates = {}) => {
    if (!primaryCompanyId) return;
    const merged = { ...localConfig, ...updates };
    setSaving(true);
    try {
      if (config?.id) {
        await base44.entities.SalesChannelConfig.update(config.id, merged);
      } else {
        await base44.entities.SalesChannelConfig.create({
          ...merged,
          company_id: primaryCompanyId,
          webhook_enabled: (merged.offline_mode === 'webhook')
        });
      }
      queryClient.invalidateQueries(['salesChannelConfig', primaryCompanyId]);
    } catch (e) {
      toast.error('Could not save configuration: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfigUpdate = (updates) => {
    const merged = { ...localConfig, ...updates };
    setLocalConfig(merged);
    saveConfig(updates);
  };

  const handleChannelSelect = (type) => {
    setChannelType(type);
    handleConfigUpdate({ sales_channel: type });
  };

  const isGoLiveReady = () => {
    if (!channelType) return false;
    if (channelType === 'offline' || channelType === 'both') {
      return !!localConfig.offline_mode;
    }
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Connect POS / Sales</h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect your sales channel to start issuing rewards automatically.
            Get live in under 10 minutes.
          </p>
        </div>
        {saving && <Loader2 className="w-4 h-4 text-teal-400 animate-spin mt-1" />}
      </div>

      {/* Go live banner */}
      {isGoLiveReady() && (
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-teal-400">Ready to go live!</p>
            <p className="text-xs text-teal-400/70 mt-0.5">Your rewards channel is configured. Your customers can now earn rewards.</p>
          </div>
          <Button size="sm" 
            className="bg-teal-500 hover:bg-teal-600 shrink-0 h-8 text-xs font-semibold"
            onClick={() => { handleConfigUpdate({ is_live: true }); toast.success('Your rewards channel is now live! '); }}
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" />Go live
          </Button>
        </div>
      )}

      {/* Step 1: Channel type */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold text-white">1</div>
          <h2 className="text-base font-semibold text-white">How do you sell?</h2>
        </div>
        <ChannelSelector selected={channelType} onSelect={handleChannelSelect} />
      </div>

      {/* Step 2: Configure */}
      {channelType && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold text-white">2</div>
            <h2 className="text-base font-semibold text-white">Set up your connection</h2>
          </div>

          {(channelType === 'offline' || channelType === 'both') && (
            <div className="space-y-3">
              {channelType === 'both' && (
                <p className="text-xs text-slate-400 bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2">
                  Offline setup (below)
                </p>
              )}
              <OfflineContent
                company={company}
                branch={mainBranch}
                config={localConfig}
                onConfigUpdate={handleConfigUpdate}
              />
            </div>
          )}

          {(channelType === 'online' || channelType === 'both') && (
            <div className="space-y-3">
              {channelType === 'both' && (
                <p className="text-xs text-slate-400 bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 mt-4">
                  Online setup (below)
                </p>
              )}
              <OnlineSection company={company} />
            </div>
          )}
        </div>
      )}

      {/* Advanced integrations hint */}
      <div className="border border-dashed border-[#2d2d3a] rounded-xl p-4 flex items-center gap-3">
        <Shield className="w-4 h-4 text-slate-500 shrink-0" />
        <p className="text-xs text-slate-500 flex-1">
          Need a specific POS provider integration, native Shopify connector, or custom setup?
        </p>
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 text-xs shrink-0"
          onClick={() => window.location.href = createPageUrl('POSIntegrationHub')}>
          Advanced <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}