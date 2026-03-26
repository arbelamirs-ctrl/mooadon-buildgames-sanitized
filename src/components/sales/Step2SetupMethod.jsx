import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, CheckCircle2, Terminal, Mail, ArrowRight, Loader2, ArrowLeft, ExternalLink, Phone, Building2, Key, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const WEBHOOK_URL = 'https://mooadon.base44.app/api/posWebhook';

const GATEWAY_INSTRUCTIONS = {
  Square: {
    hint: 'Square sends order.fulfillment_updated events. Map order_id → external_transaction_id.',
    steps: [
      'Go to Square Developer Dashboard → Webhooks',
      `Add endpoint: ${WEBHOOK_URL}`,
      'Subscribe to: payments.completed, orders.fulfillment_updated',
      'Copy the Signature Key — add it as X-Mooadon-Signature header',
    ],
    docsUrl: 'https://developer.squareup.com/docs/webhooks/overview',
  },
  Lightspeed: {
    hint: 'Lightspeed uses REST webhooks. Use sale_id as external_transaction_id.',
    steps: [
      'Go to Lightspeed → Settings → Integrations → Webhooks',
      `Add webhook URL: ${WEBHOOK_URL}`,
      'Event: sale.created or sale.paid',
      'Map sale.id → external_transaction_id',
    ],
    docsUrl: 'https://developers.lightspeedhq.com/ecom/endpoints/webhook/',
  },
  'Shopify POS': {
    hint: 'Shopify sends orders/paid events. Use order_number as external_transaction_id.',
    steps: [
      'Go to Shopify Admin → Settings → Notifications → Webhooks',
      `Add webhook for "Order payment" → URL: ${WEBHOOK_URL}`,
      'Format: JSON',
      'Map order.order_number → external_transaction_id',
    ],
    docsUrl: 'https://shopify.dev/docs/api/admin-rest/webhook',
  },
  Clover: {
    hint: 'Clover uses APP_NOTIFICATION topic. Map order.id → external_transaction_id.',
    steps: [
      'In Clover Developer Dashboard → Webhooks',
      `Set endpoint: ${WEBHOOK_URL}`,
      'Subscribe to: PAYMENT events',
      'Map payment.order.id → external_transaction_id',
    ],
    docsUrl: 'https://docs.clover.com/docs/webhooks',
  },
  Toast: {
    hint: 'Toast sends orderCompleted webhooks. Use toastGuid as external_transaction_id.',
    steps: [
      'Contact Toast support or go to Toast Developer Portal',
      `Register webhook URL: ${WEBHOOK_URL}`,
      'Subscribe to: OrderCompleted event',
      'Map toastGuid → external_transaction_id',
    ],
    docsUrl: 'https://doc.toasttab.com/doc/devguide/apiWebhooks.html',
  },
  Tranzila: {
    hint: 'Tranzila שולחת Notify URL אחרי כל עסקה מאושרת.',
    steps: [
      'כנס לממשק הניהול של טרנזילה → הגדרות → Notify URL',
      `הגדר את ה-Notify URL: ${WEBHOOK_URL}`,
      'סמן: שלח התראה על כל עסקה מאושרת',
      'שדות שיימפו: index (→ external_transaction_id), sum (→ amount), phone (→ customer_phone)',
    ],
    docsUrl: 'https://www.tranzila.com/developer/',
    hebrewInstructions: true,
  },
  CreditGuard: {
    hint: 'CreditGuard (Hyp) שולח redirect + server-to-server notification אחרי כל עסקה.',
    steps: [
      'כנס ל-Hyp Dev Portal → הגדרות Terminal שלך',
      `הגדר successUrl / notifyUrl: ${WEBHOOK_URL}`,
      'הוסף את company_id כפרמטר ב-userData1 או ב-uniqueId',
      'שדות: txId (→ external_transaction_id), total (→ amount), cardOwnerPhone (→ customer_phone)',
    ],
    docsUrl: 'https://hyp.co.il/about-hyp/',
    hebrewInstructions: true,
  },
  Cardcom: {
    hint: 'Cardcom שולח ReturnURL עם פרמטרים של העסקה אחרי אישור.',
    steps: [
      'כנס ל-Cardcom Dashboard → Low Profile Settings',
      `הגדר ReturnUrl: ${WEBHOOK_URL}`,
      'הגדר IndicatorUrl (server callback) לאותה כתובת',
      'שדות: InternalDealNumber (→ external_transaction_id), DealSum (→ amount), Phone (→ customer_phone)',
    ],
    docsUrl: 'https://kb.cardcom.solutions/',
    hebrewInstructions: true,
  },
  Pelecard: {
    hint: 'Pelecard שולח callback URL עם תוצאת העסקה.',
    steps: [
      'פנה ל-Pelecard לתמיכה טכנית לפתיחת Webhook',
      `תן להם את ה-Callback URL: ${WEBHOOK_URL}`,
      'בקש שישלחו: TransactionId, TotalX10 (amount×10), Phone',
      'שדות: TransactionId (→ external_transaction_id), TotalX10/10 (→ amount)',
    ],
    docsUrl: 'https://www.pelecard.com/',
    hebrewInstructions: true,
  },
  PayPlus: {
    hint: 'PayPlus שולח webhook event מסוג payment.success.',
    steps: [
      'כנס ל-PayPlus Dashboard → Settings → Webhooks',
      `הוסף Endpoint: ${WEBHOOK_URL}`,
      'בחר event: payment.success',
      'שדות: payment_id (→ external_transaction_id), amount (→ amount), customer.phone (→ customer_phone)',
    ],
    docsUrl: 'https://payplus.co.il/',
    hebrewInstructions: true,
  },
  PayMe: {
    hint: 'PayMe שולח webhook callback לאחר כל תשלום מאושר.',
    steps: [
      'כנס ל-PayMe Business Dashboard → Integrations → Webhooks',
      `הגדר Callback URL: ${WEBHOOK_URL}`,
      'Event: transaction.approved',
      'שדות: transaction_id (→ external_transaction_id), amount (→ amount), phone (→ customer_phone)',
    ],
    docsUrl: 'https://payme.co.il/',
    hebrewInstructions: true,
  },
  'Revel Systems': {
    hint: 'Revel uses REST webhooks. Use order_id as external_transaction_id.',
    steps: [
      'Go to Revel Management Console → Integrations → Webhooks',
      `Register endpoint: ${WEBHOOK_URL}`,
      'Subscribe to: order.finalized',
      'Map order.id → external_transaction_id',
    ],
    docsUrl: 'https://developer.revelsystems.com/',
  },
  SumUp: {
    hint: 'SumUp sends a webhook on successful checkout.',
    steps: [
      'Go to SumUp Developer Portal → Webhooks',
      `Set webhook URL: ${WEBHOOK_URL}`,
      'Event: CHECKOUT_COMPLETED',
      'Map checkout_id → external_transaction_id',
    ],
    docsUrl: 'https://developer.sumup.com/docs/register-webhook',
  },
  Other: {
    hint: 'Any POST with the required fields below will work.',
    steps: [
      `Configure your system to POST to: ${WEBHOOK_URL}`,
      'Add header: Content-Type: application/json',
      'Add header: X-Mooadon-Secret: [your webhook secret]',
      'Send the minimal JSON payload shown below',
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tranzila Connector — dedicated flow for pull-based POS integration
// ─────────────────────────────────────────────────────────────────────────────
function TranzilaConnectorFlow({ companyId, companyName, onNext, onBack }) {
  const [step, setStep] = useState('collect');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [terminalName, setTerminalName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [copying, setCopying] = useState('');

  const MOOADON_WEBHOOK = 'https://mooadon.base44.app/api/posWebhook';

  const copyText = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopying(key);
    toast.success('הועתק!');
    setTimeout(() => setCopying(''), 2000);
  };

  const handleSaveAndContinue = async () => {
    if (!terminalName.trim()) { toast.error('נא להזין שם מסוף'); return; }
    setSaving(true);
    try {
      const existing = await base44.entities.POSIntegration.filter({ company_id: companyId });
      const data = {
        company_id: companyId,
        integration_type: 'pos',
        platform: 'tranzila',
        terminal_name: terminalName.trim(),
        supplier_id: supplierId.trim() || null,
        connection_method: 'pull',
        status: 'pending',
        last_sync_index: null,
        last_synced_at: null,
        sync_enabled: false,
        metadata: {
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          setup_step: 'awaiting_tranzila_api',
        },
      };
      if (existing.length > 0) {
        await base44.entities.POSIntegration.update(existing[0].id, data);
      } else {
        await base44.entities.POSIntegration.create(data);
      }
      toast.success('פרטי המסוף נשמרו ✓');
      setStep('credentials');
    } catch (err) {
      toast.error('שגיאה בשמירה: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!contactEmail.trim()) { toast.error('נא להזין אימייל'); return; }
    setSending(true);

    const subject = `בקשת גישה ל-TRAPI — ${companyName || 'לקוח Mooadon'} (מסוף: ${terminalName})`;
    const body = `שלום${contactName ? ' ' + contactName : ''},

אנחנו מחברים את מערכת ההטבות Mooadon לקופה של ${companyName || 'הלקוח'} דרך טרנזילה.

כדי לאפשר שליפת עסקאות אוטומטית (pull via TRAPI), אנחנו צריכים:

1. גישה ל-TRAPI של טרנזילה לשליפת עסקאות
   - שם מסוף: ${terminalName}
   ${supplierId ? `- מזהה ספק/מסוף: ${supplierId}` : ''}
   - נדרש: user + password לממשק TRAPI, או API key אם זמין

2. אלטרנטיבה (Webhook / Notify URL):
   אם TRAPI לא זמין — אפשר להגדיר Notify URL שישלח כל עסקה ישירות:
   Notify URL: ${MOOADON_WEBHOOK}
   שדות נדרשים: index (מזהה עסקה), sum (סכום), phone (טלפון לקוח)

נשמח לתיאום שיחה טכנית לפי הצורך.

תודה,
צוות Mooadon
https://mooadon.com`;

    try {
      await base44.integrations.Core.SendEmail({
        to: contactEmail,
        subject,
        body: body.replace(/\n/g, '<br>'),
      });
      toast.success(`אימייל נשלח ל-${contactEmail}`);
    } catch {
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } finally {
      setSending(false);
      setStep('done');
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center py-10 space-y-4">
        <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-teal-400" />
        </div>
        <h3 className="text-xl font-bold text-white">הכל מוכן מצידנו ✓</h3>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          פרטי המסוף נשמרו. אחרי שטרנזילה תאשר גישה ל-TRAPI,
          הסנכרון יופעל אוטומטית וטוקנים יחולקו אחרי כל קנייה.
        </p>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-300 text-right max-w-md mx-auto">
          <strong>שלב הבא:</strong> להתקשר לטרנזילה ולבקש גישת TRAPI למסוף <strong>{terminalName}</strong>.
          ברגע שמתקבל — לעדכן ב-CompanySettings → Integrations.
        </div>
        <Button onClick={() => onNext('tranzila_pending', { terminalName, supplierId })} className="bg-teal-500 hover:bg-teal-600 text-white">
          סיום <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  if (step === 'credentials') {
    return (
      <div className="space-y-5">
        <button onClick={() => setStep('collect')} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3 h-3" /> חזרה
        </button>
        <div>
          <h3 className="text-lg font-bold text-white mb-1">מה טרנזילה צריכה לדעת</h3>
          <p className="text-gray-400 text-sm">שמור את הפרטים האלו — תצטרך אותם בשיחה עם טרנזילה.</p>
        </div>

        <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold mb-1">
            <Building2 className="w-4 h-4" /> פרטי המסוף שנשמרו
          </div>
          {[
            { label: 'שם מסוף',      value: terminalName,  key: 'tn' },
            { label: 'מזהה ספק',    value: supplierId || '—', key: 'sid' },
            { label: 'Webhook URL', value: MOOADON_WEBHOOK, key: 'wh' },
          ].map(({ label, value, key }) => (
            <div key={key}>
              <Label className="text-gray-500 text-xs uppercase tracking-wide">{label}</Label>
              <div className="flex gap-2 mt-1">
                <code className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-green-400 text-sm font-mono truncate">{value}</code>
                {value !== '—' && (
                  <button onClick={() => copyText(value, key)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                    {copying === key ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-200 space-y-2">
          <div className="font-semibold flex items-center gap-2"><Phone className="w-4 h-4" /> מה לבקש מטרנזילה בשיחה</div>
          <ol className="list-decimal list-inside space-y-1 text-blue-300 text-xs">
            <li>פתיחת גישה ל-<strong>TRAPI</strong> — ממשק שליפת עסקאות</li>
            <li>קבלת <strong>user + password</strong> לממשק TRAPI</li>
            <li>או הפעלת <strong>Notify URL</strong> על מסוף <strong>{terminalName}</strong></li>
            <li>Notify URL לתת להם: <code className="text-teal-400">{MOOADON_WEBHOOK}</code></li>
          </ol>
          <p className="text-blue-400 text-xs">טלפון טרנזילה: <strong>03-9165000</strong></p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setStep('email')}
            className="border-[#2d2d3a] text-gray-300 hover:border-teal-500/50">
            <Mail className="w-4 h-4 mr-2" /> שלח אימייל לטרנזילה / IT
          </Button>
          <Button onClick={() => setStep('done')} className="bg-teal-500 hover:bg-teal-600 text-white">
            אני אתקשר בעצמי <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'email') {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep('credentials')} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3 h-3" /> חזרה
        </button>
        <h3 className="text-lg font-bold text-white">שלח בקשת TRAPI</h3>
        <p className="text-gray-400 text-sm">נכין אימייל מוכן לשליחה לטרנזילה או לIT של הלקוח.</p>
        <div className="space-y-3">
          <div>
            <Label className="text-gray-300 text-sm">שם איש הקשר</Label>
            <Input placeholder="למשל: תמיכה טרנזילה" value={contactName}
              onChange={e => setContactName(e.target.value)}
              className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" />
          </div>
          <div>
            <Label className="text-gray-300 text-sm">אימייל *</Label>
            <Input type="email" placeholder="support@tranzila.com" value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" />
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-400 space-y-1">
          <p className="font-medium text-gray-300">האימייל יכלול:</p>
          <p>✓ שם מסוף: <span className="text-teal-400">{terminalName}</span></p>
          {supplierId && <p>✓ מזהה ספק: <span className="text-teal-400">{supplierId}</span></p>}
          <p>✓ בקשה ל-TRAPI user+password</p>
          <p>✓ Webhook URL כאלטרנטיבה</p>
        </div>
        <Button onClick={handleSendEmail} disabled={sending || !contactEmail}
          className="bg-teal-500 hover:bg-teal-600 text-white w-full">
          {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
          שלח אימייל
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors">
        <ArrowLeft className="w-3 h-3" /> חזרה
      </button>

      <div>
        <h2 className="text-2xl font-bold text-white mb-1">🇮🇱 חיבור טרנזילה</h2>
        <p className="text-gray-400 text-sm">מלא את פרטי המסוף — נשמור ונכין את כל מה שצריך לשיחה עם טרנזילה.</p>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">איך זה עובד</p>
            <p className="text-blue-300 text-xs mt-1">
              Mooadon שולפת עסקאות מטרנזילה אחרי כל קנייה ומחלקת טוקנים ללקוח אוטומטית.
              לחיבור זה נדרש אישור גישה מטרנזילה — אנחנו נכין את כל מה שצריך.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-5 space-y-4">
        <div>
          <Label className="text-gray-300 text-sm">שם מסוף (Terminal Name) *</Label>
          <Input
            placeholder="למשל: RESTO_TEL_AVIV_01"
            value={terminalName}
            onChange={e => setTerminalName(e.target.value)}
            className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">השם שמופיע בממשק הניהול של טרנזילה</p>
        </div>

        <div>
          <Label className="text-gray-300 text-sm">מספר ספק / מסוף <span className="text-gray-500 font-normal">(אופציונלי)</span></Label>
          <Input
            placeholder="למשל: 12345"
            value={supplierId}
            onChange={e => setSupplierId(e.target.value)}
            className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">אם יש — מופיע בחשבוניות או בממשק טרנזילה</p>
        </div>

        <div className="border-t border-[#2d2d3a] pt-4">
          <p className="text-xs text-gray-500 mb-3 font-medium">פרטי איש קשר בטרנזילה / IT (לשליחת אימייל — אופציונלי)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-sm">שם</Label>
              <Input placeholder="שם" value={contactName} onChange={e => setContactName(e.target.value)}
                className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" />
            </div>
            <div>
              <Label className="text-gray-300 text-sm">אימייל</Label>
              <Input type="email" placeholder="support@tranzila.com" value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={handleSaveAndContinue}
        disabled={saving || !terminalName.trim()}
        className="bg-teal-500 hover:bg-teal-600 text-white w-full"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
        שמור והמשך
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic Israeli Connector Flow — for Pelecard, CreditGuard, Cardcom, PayPlus, PayMe
// ─────────────────────────────────────────────────────────────────────────────
const ISRAELI_GATEWAY_CONFIG = {
  Pelecard: {
    flag: '🇮🇱',
    color: 'teal',
    phone: '03-7697000',
    email: 'support@pelecard.com',
    accessType: 'callback',
    accessLabel: 'Callback URL (דרך תמיכה טכנית)',
    requiresSupport: true,
    fields: [
      { key: 'terminal_id',   label: 'מזהה מסוף (Terminal ID)', placeholder: '12345', required: true,  hint: 'מופיע בממשק הניהול של Pelecard' },
      { key: 'supplier_id',   label: 'מספר ספק',                placeholder: '9876',  required: false, hint: 'אופציונלי — אם קיים בחשבוניות' },
    ],
    whatToAsk: [
      'הפעלת Callback URL על המסוף',
      'Callback URL לתת להם: [WEBHOOK_URL]',
      'בקש שישלחו: TransactionId, TotalX10, Phone',
      'שדות: TransactionId → external_transaction_id, TotalX10÷10 → amount',
    ],
    note: 'Pelecard דורש פנייה לתמיכה טכנית — אין הגדרה self-serve.',
    docsUrl: 'https://www.pelecard.com/',
  },
  CreditGuard: {
    flag: '🏪',
    color: 'indigo',
    phone: '03-7100100',
    email: 'support@hyp.co.il',
    accessType: 'notify',
    accessLabel: 'Notify URL (דרך Hyp Dev Portal)',
    requiresSupport: true,
    fields: [
      { key: 'terminal_id',   label: 'מזהה Terminal (Hyp)',    placeholder: 'HYP-12345', required: true,  hint: 'מופיע ב-Hyp Dev Portal' },
      { key: 'merchant_id',   label: 'Merchant ID',             placeholder: 'MRC-9876',  required: false, hint: 'אופציונלי — מזהה בית עסק ב-Hyp' },
    ],
    whatToAsk: [
      'גישה ל-Hyp Dev Portal לקביעת Notify URL',
      'successUrl / notifyUrl לתת להם: [WEBHOOK_URL]',
      'הוספת company_id כפרמטר ב-userData1',
      'שדות: txId → external_transaction_id, total → amount, cardOwnerPhone → customer_phone',
    ],
    note: 'CreditGuard הוא המוצר של Hyp — גישה דרך Hyp Dev Portal או נציג.',
    docsUrl: 'https://hyp.co.il/about-hyp/',
  },
  Cardcom: {
    flag: '🇮🇱',
    color: 'cyan',
    phone: '072-2200650',
    email: 'support@cardcom.solutions',
    accessType: 'webhook',
    accessLabel: 'ReturnUrl + IndicatorUrl (Low Profile Settings)',
    requiresSupport: false,
    fields: [
      { key: 'terminal_number', label: 'מספר מסוף Cardcom',   placeholder: '1000', required: true,  hint: 'מופיע ב-Cardcom Dashboard → Settings' },
      { key: 'api_name',        label: 'API Name (Username)',  placeholder: 'user', required: true,  hint: 'שם המשתמש ל-Cardcom API' },
      { key: 'api_password',    label: 'API Password',         placeholder: '****', required: false, hint: 'סיסמת API (תישמר מוצפן)', secret: true },
    ],
    whatToAsk: [
      'כנס ל-Cardcom Dashboard → Low Profile Settings',
      'הגדר ReturnUrl: [WEBHOOK_URL]',
      'הגדר IndicatorUrl (server callback): [WEBHOOK_URL]',
      'שדות: InternalDealNumber → external_transaction_id, DealSum → amount, Phone → customer_phone',
    ],
    note: 'Cardcom תומך ב-self-serve דרך ה-Dashboard — לא חייב לפנות לתמיכה.',
    docsUrl: 'https://kb.cardcom.solutions/',
  },
  PayPlus: {
    flag: '🇮🇱',
    color: 'violet',
    phone: '03-3094950',
    email: 'support@payplus.co.il',
    accessType: 'webhook',
    accessLabel: 'Webhook Endpoint (PayPlus Dashboard)',
    requiresSupport: false,
    fields: [
      { key: 'api_key',    label: 'PayPlus API Key',    placeholder: 'pk_live_...', required: true,  hint: 'מ-PayPlus Dashboard → Settings → API Keys' },
      { key: 'api_secret', label: 'PayPlus Secret Key', placeholder: 'sk_live_...', required: false, hint: 'Secret Key לאימות webhook', secret: true },
    ],
    whatToAsk: [
      'כנס ל-PayPlus Dashboard → Settings → Webhooks',
      'הוסף Endpoint: [WEBHOOK_URL]',
      'בחר event: payment.success',
      'שדות: payment_id → external_transaction_id, amount → amount, customer.phone → customer_phone',
    ],
    note: 'PayPlus תומך ב-self-serve מלא — API Key זמין מיידית.',
    docsUrl: 'https://payplus.co.il/developers',
  },
  PayMe: {
    flag: '🇮🇱',
    color: 'pink',
    phone: '03-5099055',
    email: 'business@payme.co.il',
    accessType: 'webhook',
    accessLabel: 'Callback URL (Business Dashboard)',
    requiresSupport: false,
    fields: [
      { key: 'seller_id',  label: 'Seller ID',      placeholder: 'PM-12345',    required: true,  hint: 'מ-PayMe Business Dashboard → My Account' },
      { key: 'api_key',    label: 'PayMe API Key',  placeholder: 'payme_...',   required: true,  hint: 'API Key מ-PayMe Dashboard → Integrations' },
    ],
    whatToAsk: [
      'כנס ל-PayMe Business Dashboard → Integrations → Webhooks',
      'הגדר Callback URL: [WEBHOOK_URL]',
      'Event: transaction.approved',
      'שדות: transaction_id → external_transaction_id, amount → amount, phone → customer_phone',
    ],
    note: 'PayMe תומך ב-self-serve — הגדרה מ-Dashboard בלבד.',
    docsUrl: 'https://payme.co.il/developers',
  },
};

function IsraeliConnectorFlow({ posSystem, companyId, companyName, onNext, onBack }) {
  const cfg = ISRAELI_GATEWAY_CONFIG[posSystem];
  if (!cfg) return null;

  const MOOADON_WEBHOOK = 'https://mooadon.base44.app/api/posWebhook';

  const [step, setStep] = useState('collect');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [copying, setCopying] = useState('');
  const [fields, setFields] = useState({});
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const setField = (key, val) => setFields(prev => ({ ...prev, [key]: val }));

  const copyText = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopying(key);
    toast.success('הועתק!');
    setTimeout(() => setCopying(''), 2000);
  };

  const requiredFilled = cfg.fields.filter(f => f.required).every(f => fields[f.key]?.trim());

  const handleSave = async () => {
    if (!requiredFilled) { toast.error('נא למלא את כל השדות החובה'); return; }
    setSaving(true);
    try {
      const existing = await base44.entities.POSIntegration.filter({ company_id: companyId });
      const data = {
        company_id: companyId,
        integration_type: 'pos',
        platform: posSystem.toLowerCase(),
        connection_method: cfg.requiresSupport ? 'pull' : 'webhook',
        status: 'pending',
        sync_enabled: false,
        terminal_id: fields.terminal_id || fields.terminal_number || null,
        supplier_id: fields.supplier_id || fields.merchant_id || null,
        api_key: fields.api_key || null,
        api_secret: fields.api_secret || fields.api_password || null,
        metadata: {
          ...fields,
          contact_name: contactName,
          contact_email: contactEmail,
          setup_step: cfg.requiresSupport ? 'awaiting_gateway_approval' : 'awaiting_webhook_test',
          gateway: posSystem,
        },
      };
      if (existing.length > 0) {
        await base44.entities.POSIntegration.update(existing[0].id, data);
      } else {
        await base44.entities.POSIntegration.create(data);
      }
      toast.success('פרטים נשמרו ✓');
      setStep('credentials');
    } catch (err) {
      toast.error('שגיאה: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!contactEmail.trim()) { toast.error('נא להזין אימייל'); return; }
    setSending(true);
    const webhookLine = MOOADON_WEBHOOK;
    const stepsText = cfg.whatToAsk.map((s, i) => `${i + 1}. ${s.replace('[WEBHOOK_URL]', webhookLine)}`).join('\n');
    const subject = `בקשת חיבור Mooadon — ${posSystem} (${companyName || ''})`;
    const body = `שלום${contactName ? ' ' + contactName : ''},\n\nאנחנו מחברים את מערכת ההטבות Mooadon ל-${posSystem} של ${companyName || 'הלקוח'}.\n\nנדרשת הגדרת ${cfg.accessLabel}:\n\n${stepsText}\n\nכתובת Webhook:\n${webhookLine}\n\n${cfg.note}\n\nנשמח לתיאום שיחה טכנית.\n\nצוות Mooadon\nhttps://mooadon.com`;
    try {
      await base44.integrations.Core.SendEmail({ to: contactEmail, subject, body: body.replace(/\n/g, '<br>') });
      toast.success(`אימייל נשלח ל-${contactEmail}`);
    } catch {
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } finally {
      setSending(false);
      setStep('done');
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center py-10 space-y-4">
        <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-teal-400" />
        </div>
        <h3 className="text-xl font-bold text-white">{cfg.flag} הכל מוכן מצידנו ✓</h3>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          {cfg.requiresSupport
            ? `פרטים נשמרו. אחרי ש-${posSystem} יאשרו גישה — הסנכרון יופעל אוטומטית.`
            : `פרטים נשמרו. לאחר הגדרת ה-Webhook ב-${posSystem} — בצע עסקת בדיקה לאימות.`}
        </p>
        <Button onClick={() => onNext(`${posSystem.toLowerCase()}_pending`, fields)} className="bg-teal-500 hover:bg-teal-600 text-white">
          סיום <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  if (step === 'credentials') {
    return (
      <div className="space-y-5">
        <button onClick={() => setStep('collect')} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3 h-3" /> חזרה
        </button>
        <h3 className="text-lg font-bold text-white">{cfg.flag} מה {posSystem} צריכים</h3>

        <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 space-y-3">
          <Label className="text-gray-400 text-xs uppercase tracking-wide">Webhook URL לתת ל-{posSystem}</Label>
          <div className="flex gap-2">
            <code className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-green-400 text-sm font-mono truncate">{MOOADON_WEBHOOK}</code>
            <button onClick={() => copyText(MOOADON_WEBHOOK, 'wh')} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
              {copying === 'wh' ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm space-y-2">
          <div className="font-semibold text-blue-200 flex items-center gap-2">
            <Phone className="w-4 h-4" /> מה לבקש מ-{posSystem}
          </div>
          <ol className="list-decimal list-inside space-y-1 text-blue-300 text-xs">
            {cfg.whatToAsk.map((s, i) => (
              <li key={i}>{s.replace('[WEBHOOK_URL]', MOOADON_WEBHOOK)}</li>
            ))}
          </ol>
          <p className="text-blue-400 text-xs pt-1">
            📞 {cfg.phone} &nbsp;|&nbsp; ✉️ {cfg.email}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setStep('email')} className="border-[#2d2d3a] text-gray-300 hover:border-teal-500/50">
            <Mail className="w-4 h-4 mr-2" /> שלח אימייל
          </Button>
          <Button onClick={() => setStep('done')} className="bg-teal-500 hover:bg-teal-600 text-white">
            {cfg.requiresSupport ? 'אתקשר בעצמי' : 'הגדרתי ✓'} <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'email') {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep('credentials')} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3 h-3" /> חזרה
        </button>
        <h3 className="text-lg font-bold text-white">שלח בקשת חיבור</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-gray-300 text-sm">שם איש קשר</Label>
            <Input placeholder={`תמיכה ${posSystem}`} value={contactName} onChange={e => setContactName(e.target.value)}
              className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" />
          </div>
          <div>
            <Label className="text-gray-300 text-sm">אימייל *</Label>
            <Input type="email" placeholder={cfg.email} value={contactEmail} onChange={e => setContactEmail(e.target.value)}
              className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" />
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-400 space-y-1">
          <p className="font-medium text-gray-300">האימייל יכלול:</p>
          <p>✓ בקשת הגדרת {cfg.accessLabel}</p>
          <p>✓ Webhook URL: <span className="text-teal-400 font-mono">{MOOADON_WEBHOOK}</span></p>
          <p>✓ שלבי הגדרה מפורטים</p>
        </div>
        <Button onClick={handleSendEmail} disabled={sending || !contactEmail} className="bg-teal-500 hover:bg-teal-600 text-white w-full">
          {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
          שלח אימייל
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors">
        <ArrowLeft className="w-3 h-3" /> חזרה
      </button>

      <div>
        <h2 className="text-2xl font-bold text-white mb-1">{cfg.flag} חיבור {posSystem}</h2>
        <p className="text-gray-400 text-sm">מלא את פרטי החשבון — נשמור ונכין את כל מה שצריך לחיבור.</p>
      </div>

      <div className={`rounded-xl p-4 text-sm border ${cfg.requiresSupport 
        ? 'bg-yellow-500/10 border-yellow-500/30' 
        : 'bg-blue-500/10 border-blue-500/30'}`}>
        <div className="flex items-start gap-2">
          <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.requiresSupport ? 'text-yellow-400' : 'text-blue-400'}`} />
          <div>
            <p className={`font-semibold ${cfg.requiresSupport ? 'text-yellow-200' : 'text-blue-200'}`}>
              {cfg.requiresSupport ? 'דורש אישור מ-' + posSystem : 'הגדרה self-serve'}
            </p>
            <p className={`text-xs mt-1 ${cfg.requiresSupport ? 'text-yellow-300' : 'text-blue-300'}`}>{cfg.note}</p>
          </div>
        </div>
      </div>

      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-5 space-y-4">
        {cfg.fields.map(f => (
          <div key={f.key}>
            <Label className="text-gray-300 text-sm">
              {f.label} {f.required ? '*' : <span className="text-gray-500 font-normal">(אופציונלי)</span>}
            </Label>
            <Input
              type={f.secret ? 'password' : 'text'}
              placeholder={f.placeholder}
              value={fields[f.key] || ''}
              onChange={e => setField(f.key, e.target.value)}
              className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 font-mono"
            />
            {f.hint && <p className="text-xs text-gray-500 mt-1">{f.hint}</p>}
          </div>
        ))}

        <div className="border-t border-[#2d2d3a] pt-4">
          <p className="text-xs text-gray-500 mb-3 font-medium">איש קשר (לשליחת אימייל — אופציונלי)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-sm">שם</Label>
              <Input placeholder="שם" value={contactName} onChange={e => setContactName(e.target.value)}
                className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" />
            </div>
            <div>
              <Label className="text-gray-300 text-sm">אימייל</Label>
              <Input type="email" placeholder={cfg.email} value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving || !requiredFilled} className="bg-teal-500 hover:bg-teal-600 text-white w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
        שמור והמשך
      </Button>
    </div>
  );
}

export default function Step2SetupMethod({ posSystem, companyId, companyName, webhookSecret, onNext, onBack }) {
  // Israeli gateways — each gets dedicated connector flow
  if (posSystem === 'Tranzila' || posSystem === 'tranzila') {
    return <TranzilaConnectorFlow companyId={companyId} companyName={companyName} onNext={onNext} onBack={onBack} />;
  }
  if (ISRAELI_GATEWAY_CONFIG[posSystem]) {
    return <IsraeliConnectorFlow posSystem={posSystem} companyId={companyId} companyName={companyName} onNext={onNext} onBack={onBack} />;
  }

  const [method, setMethod] = useState(null);
  const [itName, setItName] = useState('');
  const [itEmail, setItEmail] = useState('');
  const [itMessage, setItMessage] = useState(`Hi, please configure our POS to send sales events to Mooadon for our loyalty program.`);
  const [copying, setCopying] = useState('');
  const [sending, setSending] = useState(false);

  const gwInfo = GATEWAY_INSTRUCTIONS[posSystem] || GATEWAY_INSTRUCTIONS['Other'];
  const isIsraeli = gwInfo.hebrewInstructions;

  const copyText = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopying(key);
    toast.success('Copied!');
    setTimeout(() => setCopying(''), 2000);
  };

  const samplePayload = `{
  "company_id": "${companyId}",
  "external_transaction_id": "TXN-001",
  "amount": 49.90,
  "currency": "ILS",
  "timestamp": "${new Date().toISOString()}",
  "customer_phone": "+972501234567"
}`;

  const emailSubject = `${companyName || 'Our Company'} — Mooadon Loyalty Webhook Setup`;
  const emailBody = `Hi ${itName || '[Contact Name]'},

We've signed up for Mooadon, a blockchain loyalty platform. To automatically issue loyalty rewards after each sale, please configure our ${posSystem} system as follows:

Webhook URL: ${WEBHOOK_URL}
${webhookSecret ? `Secret Key: ${webhookSecret}` : ''}

Setup steps:
${(gwInfo.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}

Minimal payload required:
${samplePayload}

Note: ${gwInfo.hint}

Once configured, send one test transaction and we'll see "Connected ✅" immediately.

Thank you!
${companyName || 'The Team'}`;

  const handleSendEmail = async () => {
    if (!itEmail) { toast.error('Please enter the contact email'); return; }
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: itEmail,
        subject: emailSubject,
        body: emailBody.replace(/\n/g, '<br>'),
      });
      toast.success(`Instructions sent to ${itEmail}!`);
      onNext('it_email', { itName, itEmail });
    } catch {
      window.location.href = `mailto:${itEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      onNext('it_email', { itName, itEmail });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1 mb-4 transition-colors">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>
      <h2 className="text-2xl font-bold text-white mb-1">How do you want to connect?</h2>
      <p className="text-gray-400 mb-2">
        Setting up <strong className="text-white">{posSystem}</strong> integration.
      </p>

      {isIsraeli && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 mb-5 text-sm text-blue-200">
          🇮🇱 <strong>{posSystem}</strong> — {gwInfo.hint}
          {gwInfo.docsUrl && (
            <a href={gwInfo.docsUrl} target="_blank" rel="noopener noreferrer"
              className="ml-2 text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-0.5">
              Docs <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setMethod('self')}
          className={`p-5 rounded-xl border-2 text-left transition-all ${method === 'self' ? 'border-teal-500 bg-teal-500/10' : 'border-[#2d2d3a] bg-[#17171f] hover:border-teal-500/50'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center mb-3">
            <Terminal className="w-5 h-5 text-green-400" />
          </div>
          <div className="font-semibold text-white">I'll do it myself</div>
          <div className="text-gray-400 text-sm mt-1">Step-by-step instructions for {posSystem}</div>
        </button>

        <button
          onClick={() => setMethod('it_email')}
          className={`p-5 rounded-xl border-2 text-left transition-all ${method === 'it_email' ? 'border-teal-500 bg-teal-500/10' : 'border-[#2d2d3a] bg-[#17171f] hover:border-teal-500/50'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="font-semibold text-white">Send to my IT / POS provider</div>
          <div className="text-gray-400 text-sm mt-1">We write the email for you — full instructions included</div>
        </button>
      </div>

      {method === 'self' && (
        <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-5 space-y-5">
          <div>
            <Label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 block">
              Setup Steps for {posSystem}
            </Label>
            <ol className="space-y-2">
              {gwInfo.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="text-gray-300">{step}</span>
                </li>
              ))}
            </ol>
            {gwInfo.docsUrl && (
              <a href={gwInfo.docsUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300">
                Official docs <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div>
            <Label className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Webhook URL</Label>
            <div className="flex gap-2 mt-1.5">
              <code className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-green-400 text-sm font-mono truncate">{WEBHOOK_URL}</code>
              <button onClick={() => copyText(WEBHOOK_URL, 'url')} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                {copying === 'url' ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          </div>

          {webhookSecret && (
            <div>
              <Label className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Secret Key</Label>
              <div className="flex gap-2 mt-1.5">
                <code className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-amber-400 text-sm font-mono truncate">{webhookSecret}</code>
                <button onClick={() => copyText(webhookSecret, 'secret')} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  {copying === 'secret' ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <Label className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Minimal Payload (JSON)</Label>
            <div className="flex gap-2 mt-1.5">
              <pre className="flex-1 bg-gray-900 border border-gray-700 text-green-400 rounded-lg p-3 text-xs font-mono overflow-auto">{samplePayload}</pre>
              <button onClick={() => copyText(samplePayload, 'payload')} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg h-fit self-start transition-colors">
                {copying === 'payload' ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          </div>

          <Button onClick={() => onNext('self', {})} className="bg-teal-500 hover:bg-teal-600 text-white w-full">
            I've set it up → Test connection <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {method === 'it_email' && (
        <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="itName" className="text-gray-300 text-sm">Contact name</Label>
              <Input
                id="itName"
                placeholder="Contact name"
                value={itName}
                onChange={e => setItName(e.target.value)}
                className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label htmlFor="itEmail" className="text-gray-300 text-sm">Contact email *</Label>
              <Input
                id="itEmail"
                type="email"
                placeholder="it@mycompany.com"
                value={itEmail}
                onChange={e => setItEmail(e.target.value)}
                className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
          <div>
            <Label className="text-gray-300 text-sm">Optional message</Label>
            <textarea
              value={itMessage}
              onChange={e => setItMessage(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-500 mb-1 font-medium">Email includes:</p>
            <ul className="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
              <li>Webhook URL + Secret Key</li>
              <li>Step-by-step instructions for {posSystem}</li>
              <li>Minimal JSON payload example</li>
            </ul>
          </div>
          <Button onClick={handleSendEmail} disabled={sending || !itEmail} className="bg-teal-500 hover:bg-teal-600 text-white w-full">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '📧 '}
            Send Setup Instructions
          </Button>
        </div>
      )}
    </div>
  );
}