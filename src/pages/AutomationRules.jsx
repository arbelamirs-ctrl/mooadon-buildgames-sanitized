import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Zap, Plus, Play, Cake, Gift, Ticket, Calendar, Clock, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const HOLIDAYS = [
  { key: 'rosh_hashana', label: 'Rosh Hashana', date: '2026-09-10' },
  { key: 'yom_kippur', label: 'Yom Kippur', date: '2026-09-19' },
  { key: 'pesach', label: 'Passover (Pesach)', date: '2026-04-02' },
  { key: 'chanuka', label: 'Hanukkah', date: '2026-12-14' },
  { key: 'purim', label: 'Purim', date: '2026-03-06' },
  { key: 'lag_baomer', label: "Lag Ba'Omer", date: '2026-05-16' },
  { key: 'shavuot', label: 'Shavuot', date: '2026-05-22' },
  { key: 'christmas', label: 'Christmas', date: '2026-12-25' },
  { key: 'st_patrick', label: "St. Patrick's Day", date: '2026-03-17' },
  { key: 'new_year', label: "New Year's Day", date: '2026-01-01' },
];

const TRIGGER_LABELS = {
  birthday: '🎂 Birthday',
  holiday: '🎉 Holiday',
  post_signup: '👋 After Signup',
  inactivity: '😴 Inactivity',
};

const ACTION_LABELS = {
  points: '⭐ Points',
  coupon: '🎟️ Coupon',
  both: '🎁 Both',
};

export default function AutomationRules() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [form, setForm] = useState({
    name: '',
    trigger_type: 'birthday',
    trigger_days: 0,
    holiday_name: 'rosh_hashana',
    action_type: 'points',
    points_amount: 100,
    coupon_template_id: '',
    is_active: true,
    target_mode: 'all', // 'all' | 'specific'
    target_phone: '',
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation-rules', primaryCompanyId],
    queryFn: () => base44.entities.AutomationRule.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId,
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ['coupons-for-automation', primaryCompanyId],
    queryFn: () => base44.entities.Coupon.filter({ company_id: primaryCompanyId, status: 'active' }),
    enabled: !!primaryCompanyId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-automation', primaryCompanyId],
    queryFn: () => base44.entities.Client.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['tx-for-automation', primaryCompanyId],
    queryFn: () => base44.entities.Transaction.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId,
  });

  const createRule = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, company_id: primaryCompanyId, run_count: 0 };
      if (data.target_mode === 'all') payload.target_phone = '';
      return base44.entities.AutomationRule.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      setCreateOpen(false);
      toast.success('Rule created successfully!');
    }
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.AutomationRule.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
  });

  const deleteRule = useMutation({
    mutationFn: (id) => base44.entities.AutomationRule.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['automation-rules'] }); toast.success('Rule deleted'); }
  });

  const runAutomations = useCallback(async () => {
    if (!primaryCompanyId) return;
    setRunning(true);
    setRunResults(null);
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    let totalFired = 0;

    try {
      // Load today's logs to prevent double-firing
      const todayLogs = await base44.entities.AutomationLog.filter({ company_id: primaryCompanyId, run_date: todayStr });
      const firedKeys = new Set(todayLogs.map(l => `${l.rule_id}__${l.client_id}`));

      const activeRules = rules.filter(r => r.is_active);

      for (const rule of activeRules) {
        let matchingClients = [];

        // If rule targets a specific client by phone, narrow down first
        let clientPool = clients;
        if (rule.target_phone) {
          clientPool = clients.filter(c => c.phone === rule.target_phone || c.phone === rule.target_phone.replace(/^0/, '+972'));
        }

        if (rule.trigger_type === 'birthday') {
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          matchingClients = clientPool.filter(c => {
            if (!c.birthday) return false;
            const parts = c.birthday.split('-');
            return parts[1] === mm && parts[2] === dd;
          });
        } else if (rule.trigger_type === 'holiday') {
          const holiday = HOLIDAYS.find(h => h.key === rule.holiday_name);
          if (!holiday) continue;
          const holidayMmDd = holiday.date.slice(5); // MM-DD
          const todayMmDd = todayStr.slice(5);
          if (holidayMmDd !== todayMmDd) continue;
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
          const lastTxByClient = {};
          for (const tx of transactions) {
            if (!tx.client_id) continue;
            const d = new Date(tx.created_date);
            if (!lastTxByClient[tx.client_id] || d > lastTxByClient[tx.client_id]) lastTxByClient[tx.client_id] = d;
          }
          matchingClients = clientPool.filter(c => {
            const last = lastTxByClient[c.id];
            if (!last) return false;
            return Math.floor((today - last) / 86400000) >= days;
          });
        }

        for (const client of matchingClients) {
          const key = `${rule.id}__${client.id}`;
          if (firedKeys.has(key)) continue;

          // Apply action
          if (rule.action_type === 'points' || rule.action_type === 'both') {
            const amount = Number(rule.points_amount) || 0;
            if (amount > 0) {
              const newBal = (client.current_balance || 0) + amount;
              await base44.entities.Client.update(client.id, { current_balance: newBal });
              await base44.entities.LedgerEntry.create({
                company_id: primaryCompanyId,
                client_id: client.id,
                entry_type: 'EARN',
                credit: amount,
                debit: 0,
                balance_after: newBal,
                reference_type: 'Manual',
                reference_id: rule.id,
                note: `Automation: ${rule.name}`,
                created_at: new Date().toISOString()
              });
            }
          }
          if (rule.action_type === 'coupon' || rule.action_type === 'both') {
            if (rule.coupon_template_id) {
              const templateCoupon = await base44.entities.Coupon.filter({ id: rule.coupon_template_id });
              if (templateCoupon[0]) {
                const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 1);
                const code = `AUTO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                await base44.entities.Coupon.create({
                  company_id: primaryCompanyId,
                  client_phone: client.phone,
                  client_id: client.id,
                  coupon_code: code,
                  discount_type: templateCoupon[0].discount_type,
                  discount_value: templateCoupon[0].discount_value,
                  max_uses: 1,
                  times_used: 0,
                  status: 'active',
                  expires_at: expiry.toISOString(),
                });
              }
            }
          }

          // Log it
          await base44.entities.AutomationLog.create({
            company_id: primaryCompanyId,
            rule_id: rule.id,
            client_id: client.id,
            run_date: todayStr,
            trigger_type: rule.trigger_type,
            action_type: rule.action_type,
            status: 'success',
            details: `${rule.name} → ${client.full_name || client.phone}`,
            executed_at: new Date().toISOString()
          });
          firedKeys.add(key);
          totalFired++;
        }

        // Update run_count
        if (matchingClients.length > 0) {
          await base44.entities.AutomationRule.update(rule.id, {
            run_count: (rule.run_count || 0) + matchingClients.filter(c => !firedKeys.has(`${rule.id}__${c.id}_prev`)).length,
            last_run_at: new Date().toISOString()
          });
        }
      }

      setRunResults(totalFired);
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success(`Run complete! ${totalFired} actions performed`);
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setRunning(false);
    }
  }, [rules, clients, transactions, primaryCompanyId, queryClient]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Automation Rules
          </h1>
          <p className="text-[#9ca3af] text-sm mt-1">Set up automatic coupon and points delivery</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={runAutomations}
            disabled={running}
            variant="outline"
            className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
          >
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Run Now
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-[#10b981] hover:bg-[#059669]">
            <Plus className="w-4 h-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Run Results */}
      {runResults !== null && (
        <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-[#10b981]" />
          <p className="text-[#10b981] font-medium">Run complete: {runResults} actions performed today</p>
        </div>
      )}

      {/* Rules list */}
      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-teal-400 mx-auto" /></div>
      ) : rules.length === 0 ? (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="py-16 text-center">
            <Zap className="w-14 h-14 text-[#9ca3af] mx-auto mb-4 opacity-40" />
            <p className="text-white text-lg font-semibold mb-1">No automation rules yet</p>
            <p className="text-[#9ca3af] text-sm">Click 'New Rule' to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <Card key={rule.id} className={`bg-[#1f2128] border ${rule.is_active ? 'border-[#10b981]/30' : 'border-[#2d2d3a]'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-white">{rule.name}</h3>
                      <Badge className={rule.is_active ? 'bg-[#10b981]' : 'bg-[#9ca3af]'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline" className="border-[#2d2d3a] text-[#9ca3af] text-xs">
                        Triggered {rule.run_count || 0}x
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-[#9ca3af]">
                      <span>🎯 {TRIGGER_LABELS[rule.trigger_type]}
                        {rule.trigger_type === 'birthday' && rule.trigger_days > 0 && ` (${rule.trigger_days} days before)`}
                        {rule.trigger_type === 'holiday' && ` — ${HOLIDAYS.find(h => h.key === rule.holiday_name)?.label}`}
                      {rule.target_phone && <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">📱 {rule.target_phone}</span>}
                        {(rule.trigger_type === 'post_signup' || rule.trigger_type === 'inactivity') && ` — ${rule.trigger_days} days`}
                      </span>
                      <span>→ {ACTION_LABELS[rule.action_type]}
                        {(rule.action_type === 'points' || rule.action_type === 'both') && rule.points_amount > 0 && ` (${rule.points_amount} pts)`}
                      </span>
                    </div>
                    {rule.last_run_at && (
                      <p className="text-xs text-[#9ca3af] mt-1">Last run: {format(new Date(rule.last_run_at), 'dd/MM/yyyy HH:mm')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(v) => toggleRule.mutate({ id: rule.id, is_active: v })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                      onClick={() => deleteRule.mutate(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#1f2128] border-[#2d2d3a] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Automation Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="text-white">Rule Name</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Birthday Greeting" className="bg-[#17171f] border-[#2d2d3a] text-white mt-1" />
            </div>

            {/* Trigger */}
            <div className="space-y-2 p-3 bg-[#17171f] rounded-lg border border-[#2d2d3a]">
              <p className="text-white font-medium text-sm">🎯 When to Trigger</p>
              <Select value={form.trigger_type} onValueChange={v => setForm({...form, trigger_type: v})}>
                <SelectTrigger className="bg-[#1f2128] border-[#2d2d3a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                  <SelectItem value="birthday" className="text-white">🎂 Birthday</SelectItem>
                  <SelectItem value="holiday" className="text-white">🎉 Holiday</SelectItem>
                  <SelectItem value="post_signup" className="text-white">👋 After Signup</SelectItem>
                  <SelectItem value="inactivity" className="text-white">😴 Inactivity</SelectItem>
                </SelectContent>
              </Select>
              {form.trigger_type === 'holiday' && (
                <Select value={form.holiday_name} onValueChange={v => setForm({...form, holiday_name: v})}>
                  <SelectTrigger className="bg-[#1f2128] border-[#2d2d3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                    {HOLIDAYS.map(h => (
                      <SelectItem key={h.key} value={h.key} className="text-white">{h.label} ({h.date})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(form.trigger_type === 'birthday' || form.trigger_type === 'post_signup' || form.trigger_type === 'inactivity') && (
                <div>
                  <Label className="text-[#9ca3af] text-xs">
                    {form.trigger_type === 'birthday' ? 'Days before birthday (0 = on the day)' : form.trigger_type === 'post_signup' ? 'Days after joining' : 'Days of inactivity'}
                  </Label>
                  <Input type="number" min="0" value={form.trigger_days} onChange={e => setForm({...form, trigger_days: Number(e.target.value)})} className="bg-[#1f2128] border-[#2d2d3a] text-white mt-1" />
                </div>
              )}
            </div>

            {/* Action */}
            <div className="space-y-2 p-3 bg-[#17171f] rounded-lg border border-[#2d2d3a]">
              <p className="text-white font-medium text-sm">🎁 What to Send (Action)</p>
              <Select value={form.action_type} onValueChange={v => setForm({...form, action_type: v})}>
                <SelectTrigger className="bg-[#1f2128] border-[#2d2d3a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                  <SelectItem value="points" className="text-white">⭐ Points</SelectItem>
                  <SelectItem value="coupon" className="text-white">🎟️ Coupon</SelectItem>
                  <SelectItem value="both" className="text-white">🎁 Both</SelectItem>
                </SelectContent>
              </Select>
              {(form.action_type === 'points' || form.action_type === 'both') && (
                <div>
                  <Label className="text-[#9ca3af] text-xs">Points Amount</Label>
                  <Input type="number" min="1" value={form.points_amount} onChange={e => setForm({...form, points_amount: Number(e.target.value)})} className="bg-[#1f2128] border-[#2d2d3a] text-white mt-1" />
                </div>
              )}
              {(form.action_type === 'coupon' || form.action_type === 'both') && (
                <div>
                  <Label className="text-[#9ca3af] text-xs">Select Template Coupon</Label>
                  <Select value={form.coupon_template_id} onValueChange={v => setForm({...form, coupon_template_id: v})}>
                    <SelectTrigger className="bg-[#1f2128] border-[#2d2d3a] text-white mt-1">
                      <SelectValue placeholder="Select coupon..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                      {coupons.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-white">{c.coupon_code} ({c.discount_value}{c.discount_type === 'percentage' ? '%' : '₪'})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Target Clients */}
            <div className="space-y-2 p-3 bg-[#17171f] rounded-lg border border-[#2d2d3a]">
              <p className="text-white font-medium text-sm">👥 Target Clients</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({...form, target_mode: 'all', target_phone: ''})}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${form.target_mode === 'all' ? 'bg-[#10b981] border-[#10b981] text-white' : 'bg-[#1f2128] border-[#2d2d3a] text-[#9ca3af] hover:text-white'}`}
                >
                  All Clients
                </button>
                <button
                  type="button"
                  onClick={() => setForm({...form, target_mode: 'specific'})}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${form.target_mode === 'specific' ? 'bg-[#10b981] border-[#10b981] text-white' : 'bg-[#1f2128] border-[#2d2d3a] text-[#9ca3af] hover:text-white'}`}
                >
                  Specific Client
                </button>
              </div>
              {form.target_mode === 'specific' && (
                <div>
                  <Label className="text-[#9ca3af] text-xs">Phone Number</Label>
                  <Input
                    value={form.target_phone}
                    onChange={e => setForm({...form, target_phone: e.target.value})}
                    placeholder="+972501234567"
                    className="bg-[#1f2128] border-[#2d2d3a] text-white mt-1"
                    dir="ltr"
                  />
                  {form.target_phone && (() => {
                    const match = clients.find(c => c.phone === form.target_phone || c.phone === form.target_phone.replace(/^0/, '+972'));
                    return match ? (
                      <p className="text-xs text-[#10b981] mt-1">✓ Found: {match.full_name || match.phone}</p>
                    ) : (
                      <p className="text-xs text-[#9ca3af] mt-1">Client not found in this company</p>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({...form, is_active: v})} />
              <Label className="text-white">Activate rule immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-[#2d2d3a] text-white">Cancel</Button>
            <Button
              disabled={!form.name || createRule.isPending}
              onClick={() => createRule.mutate(form)}
              className="bg-[#10b981] hover:bg-[#059669]"
            >
              {createRule.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}