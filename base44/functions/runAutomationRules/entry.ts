import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const HOLIDAYS = [
  { key: 'rosh_hashana', date: '09-10' },
  { key: 'yom_kippur', date: '09-19' },
  { key: 'pesach', date: '04-02' },
  { key: 'chanuka', date: '12-14' },
  { key: 'purim', date: '03-06' },
  { key: 'lag_baomer', date: '05-16' },
  { key: 'shavuot', date: '05-22' },
  { key: 'christmas', date: '12-25' },
  { key: 'st_patrick', date: '03-17' },
  { key: 'new_year', date: '01-01' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const _svcToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const _reqToken = req.headers.get('X-Service-Token');
    const _isSvcCall = !!(_svcToken && _reqToken === _svcToken);

    const db = base44.asServiceRole;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const todayMmDd = todayStr.slice(5);

    const companies = await db.entities.Company.list();
    let totalFired = 0;
    const summary = [];

    for (const company of companies) {
      const companyId = company.id;

      const [rules, clients, transactions, todayLogs] = await Promise.all([
        db.entities.AutomationRule.filter({ company_id: companyId }),
        db.entities.Client.filter({ company_id: companyId }),
        db.entities.Transaction.filter({ company_id: companyId }),
        db.entities.AutomationLog.filter({ company_id: companyId, run_date: todayStr }),
      ]);

      const activeRules = rules.filter(r => r.is_active);
      if (activeRules.length === 0) continue;

      const firedKeys = new Set(todayLogs.map(l => `${l.rule_id}__${l.client_id}`));

      const lastTxByClient = {};
      for (const tx of transactions) {
        if (!tx.client_id) continue;
        const d = new Date(tx.created_date);
        if (!lastTxByClient[tx.client_id] || d > lastTxByClient[tx.client_id]) {
          lastTxByClient[tx.client_id] = d;
        }
      }

      for (const rule of activeRules) {
        let matchingClients = [];
        let clientPool = clients;

        if (rule.target_phone) {
          clientPool = clients.filter(c =>
            c.phone === rule.target_phone ||
            c.phone === rule.target_phone.replace(/^0/, '+972')
          );
        }

        if (rule.trigger_type === 'birthday') {
          const offsetDays = Number(rule.trigger_days) || 0;
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + offsetDays);
          const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
          const dd = String(targetDate.getDate()).padStart(2, '0');
          matchingClients = clientPool.filter(c => {
            if (!c.birthday) return false;
            const parts = c.birthday.split('-');
            const bMm = parts.length === 3 ? parts[1] : parts[0];
            const bDd = parts.length === 3 ? parts[2] : parts[1];
            return bMm === mm && bDd === dd;
          });
        } else if (rule.trigger_type === 'holiday') {
          const holiday = HOLIDAYS.find(h => h.key === rule.holiday_name);
          if (!holiday || holiday.date !== todayMmDd) continue;
          matchingClients = clientPool;
        } else if (rule.trigger_type === 'post_signup') {
          const days = Number(rule.trigger_days) || 0;
          matchingClients = clientPool.filter(c => {
            if (!c.created_date) return false;
            const diff = Math.floor((today - new Date(c.created_date)) / 86400000);
            return diff === days;
          });
        } else if (rule.trigger_type === 'inactivity') {
          const days = Number(rule.trigger_days) || 30;
          matchingClients = clientPool.filter(c => {
            const last = lastTxByClient[c.id];
            if (!last) return false;
            return Math.floor((today - last) / 86400000) >= days;
          });
        }

        for (const client of matchingClients) {
          const key = `${rule.id}__${client.id}`;
          if (firedKeys.has(key)) continue;

          if (rule.action_type === 'points' || rule.action_type === 'both') {
            const amount = Number(rule.points_amount) || 0;
            if (amount > 0) {
              const newBal = (client.current_balance || 0) + amount;
              await db.entities.Client.update(client.id, { current_balance: newBal });
              await db.entities.LedgerEntry.create({
                company_id: companyId,
                client_id: client.id,
                entry_type: 'EARN',
                credit: amount,
                debit: 0,
                balance_after: newBal,
                reference_type: 'Automation',
                reference_id: rule.id,
                note: `Automation: ${rule.name}`,
                created_at: new Date().toISOString(),
              });
            }
          }

          if (rule.action_type === 'coupon' || rule.action_type === 'both') {
            if (rule.coupon_template_id) {
              const templates = await db.entities.Coupon.filter({ id: rule.coupon_template_id });
              if (templates[0]) {
                const expiry = new Date();
                expiry.setMonth(expiry.getMonth() + 1);
                const code = `AUTO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const couponUrl = `https://mooadon.base44.app/CouponDisplay?coupon_code=${code}`;
                await db.entities.Coupon.create({
                  company_id: companyId,
                  client_phone: client.phone,
                  client_id: client.id,
                  coupon_code: code,
                  discount_type: templates[0].discount_type,
                  discount_value: templates[0].discount_value,
                  max_uses: 1,
                  times_used: 0,
                  status: 'active',
                  expires_at: expiry.toISOString(),
                  coupon_url: couponUrl,
                });
              }
            }
          }

          await db.entities.AutomationLog.create({
            company_id: companyId,
            rule_id: rule.id,
            client_id: client.id,
            run_date: todayStr,
            trigger_type: rule.trigger_type,
            action_type: rule.action_type,
            status: 'success',
            details: `${rule.name} → ${client.full_name || client.phone}`,
            executed_at: new Date().toISOString(),
          });

          firedKeys.add(key);
          totalFired++;
          console.log(`[Automation] Fired: ${rule.name} → ${client.full_name || client.phone} (${companyId})`);
        }

        if (matchingClients.length > 0) {
          await db.entities.AutomationRule.update(rule.id, { last_run_at: new Date().toISOString() });
        }
      }

      summary.push({ company: company.name, rules: activeRules.length });
    }

    return Response.json({ success: true, total_fired: totalFired, companies: summary.length, summary });
  } catch (error) {
    console.error('[runAutomationRules] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});