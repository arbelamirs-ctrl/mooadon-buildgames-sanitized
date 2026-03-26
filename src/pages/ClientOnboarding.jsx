import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, User, Calendar, Gift } from 'lucide-react';
import { toast } from "sonner";

export default function ClientOnboarding() {
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('client_id');
  const companyId = urlParams.get('company_id');

  const [client, setClient] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [bonusAwarded, setBonusAwarded] = useState(0);

  const [form, setForm] = useState({
    full_name: '',
    birthday: '',
    consent_marketing_sms: false,
    consent_data_collection: false,
    consent_ai_analysis: false,
  });

  useEffect(() => {
    if (!clientId || !companyId) {
      setError('קישור לא תקין. בקש מבית העסק לשלוח שוב.');
      setLoading(false);
      return;
    }
    Promise.all([
      base44.entities.Client.filter({ id: clientId }),
      base44.entities.Company.filter({ id: companyId }),
    ]).then(([clients, companies]) => {
      if (!clients.length) { setError('לקוח לא נמצא.'); return; }
      const c = clients[0];
      setClient(c);
      setForm(f => ({
        ...f,
        full_name: c.full_name || '',
        birthday: c.birthday || '',
      }));
      if (companies.length) setCompany(companies[0]);
      if (c.full_name && c.birthday) setDone(true);
    }).catch(() => setError('שגיאה בטעינת הנתונים.')).finally(() => setLoading(false));
  }, [clientId, companyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('נא להזין שם מלא'); return; }
    if (!form.birthday) { toast.error('נא להזין תאריך לידה'); return; }

    setSaving(true);

    // 1. Update client profile
    await base44.entities.Client.update(clientId, {
      full_name: form.full_name.trim(),
      birthday: form.birthday,
      consent_marketing_sms: form.consent_marketing_sms,
      consent_data_collection: form.consent_data_collection,
      consent_ai_analysis: form.consent_ai_analysis,
      consent_last_updated: new Date().toISOString(),
    });

    // 2. Welcome bonus — only if first time
    const isFirstTime = (client?.current_balance || 0) === 0 && (client?.total_earned || 0) === 0;

    if (isFirstTime) {
      const bonus = company?.welcome_bonus || 50;

      try {
        const result = await base44.functions.invoke('createPOSTransaction', {
          phone: client.phone,
          amount: 0,
          order_id: `WELCOME-${clientId}-${Date.now()}`,
          company_id: companyId,
          branch_id: company?.default_branch_id || companyId,
          reward_type: 'token',
          welcome_bonus_override: bonus
        });

        if (result?.data?.success) {
          setBonusAwarded(bonus);
        } else {
          // Fallback: DB only
          await base44.entities.Client.update(clientId, {
            current_balance: bonus,
            total_earned: bonus,
          });
          await base44.entities.LedgerEvent.create({
            company_id: companyId,
            client_id: clientId,
            type: 'earn',
            points: bonus,
            balance_before: 0,
            balance_after: bonus,
            source: 'welcome_bonus',
            description: `בונוס ברוכים הבאים 🎁 (${bonus} נקודות)`,
          }).catch(() => {});
          setBonusAwarded(bonus);
        }
      } catch {
        // Fallback: DB only
        await base44.entities.Client.update(clientId, {
          current_balance: bonus,
          total_earned: bonus,
        });
        setBonusAwarded(bonus);
      }
    }

    setSaving(false);
    setDone(true);
  };

  const primaryColor = company?.brand_color_primary || '#10b981';
  const companyName = company?.name || 'בית העסק';
  const logoUrl = company?.logo_url;

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-white animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="max-w-sm w-full bg-white/10 border-white/20">
        <CardContent className="p-8 text-center">
          <p className="text-white text-lg">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${primaryColor}33, #1e1e2e)` }}>
      <Card className="max-w-sm w-full bg-white/10 backdrop-blur border-white/20 text-center">
        <CardContent className="p-10">
          <CheckCircle className="w-20 h-20 mx-auto mb-6" style={{ color: primaryColor }} />
          <h1 className="text-3xl font-bold text-white mb-3">תודה! 🎉</h1>
          <p className="text-white/70 text-lg mb-4">הפרופיל שלך הושלם בהצלחה.</p>
          {bonusAwarded > 0 && (
            <div className="rounded-2xl p-4 mt-4" style={{ background: `${primaryColor}22`, border: `1px solid ${primaryColor}44` }}>
              <Gift className="w-8 h-8 mx-auto mb-2" style={{ color: primaryColor }} />
              <p className="text-white font-semibold">קיבלת {bonusAwarded} נקודות בונוס! 🎁</p>
              <p className="text-white/60 text-sm mt-1">הנקודות נוספו לחשבון שלך</p>
            </div>
          )}
          <p className="text-white/50 text-sm mt-6">תוכל לעקוב אחר הנקודות שלך אצל {companyName}</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, #1a1a2e, #16213e)` }} dir="rtl">
      <div className="max-w-md w-full space-y-6">

        <div className="text-center">
          {logoUrl
            ? <img src={logoUrl} alt={companyName} className="h-16 w-16 rounded-2xl mx-auto mb-4 object-contain" />
            : (
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                style={{ background: primaryColor }}>
                {companyName.charAt(0)}
              </div>
            )
          }
          <h1 className="text-2xl font-bold text-white">ברוכים הבאים ל-{companyName}!</h1>
          <p className="text-white/60 mt-2">השלם את הפרופיל שלך וקבל {company?.welcome_bonus || 50} נקודות מתנה 🎁</p>
        </div>

        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              <div className="space-y-2">
                <label className="text-white/80 text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4" /> שם מלא
                </label>
                <Input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="ישראל ישראלי"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-white/80 text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> תאריך לידה
                </label>
                <Input
                  type="date"
                  value={form.birthday}
                  onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white h-12"
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-white/10">
                <p className="text-white/60 text-xs">הסכמות (אופציונלי)</p>
                {[
                  { key: 'consent_marketing_sms', label: 'אני מסכים לקבל הודעות פרסום ב-WhatsApp / SMS' },
                  { key: 'consent_data_collection', label: 'אני מסכים לאיסוף נתוני שימוש לצורך שיפור השירות' },
                  { key: 'consent_ai_analysis', label: 'אני מסכים לניתוח AI לצורך המלצות מותאמות אישית' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <div
                      className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                      style={{
                        background: form[key] ? primaryColor : 'transparent',
                        borderColor: form[key] ? primaryColor : 'rgba(255,255,255,0.3)'
                      }}
                      onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                    >
                      {form[key] && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-white/70 text-sm leading-relaxed">{label}</span>
                  </label>
                ))}
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full h-12 text-white font-semibold text-base"
                style={{ background: primaryColor }}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : `השלם רישום וקבל ${company?.welcome_bonus || 50} נקודות 🎁`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}