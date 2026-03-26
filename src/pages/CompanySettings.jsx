import React, { useState, useEffect } from 'react';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, User, Phone, Mail, Wallet, Loader2, CheckCircle2, Save, Download, AlertTriangle, Copy, TrendingUp, RefreshCw, Zap } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { useI18n } from '@/components/i18n/useI18n';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ExportPrivateKeyDialog from '@/components/company/ExportPrivateKeyDialog';
import TranzilaConnect from '@/components/company/TranzilaConnect';

export default function CompanySettings() {
  const { t } = useI18n();
  const { primaryCompanyId, loading: permissionsLoading, user, isSystemAdmin } = useUserPermissions();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    contact_person_name: '',
    phone: '',
    email: '',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    whatsapp_phone_number: '',
    points_to_currency_ratio: 10,
    pos_currency: 'ILS',
    onchain_enabled: false
  });

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  const { data: availableCompanies = [] } = useQuery({
    queryKey: ['companies-settings'],
    queryFn: async () => {
      if (isSystemAdmin) {
        return await base44.entities.Company.list('-created_date');
      } else {
        if (!primaryCompanyId) return [];
        return await base44.entities.Company.filter({ id: primaryCompanyId });
      }
    },
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  
  const effectiveCompanyId = primaryCompanyId;

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company', effectiveCompanyId],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: effectiveCompanyId });
      return companies[0];
    },
    enabled: !!effectiveCompanyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: companyToken } = useQuery({
    queryKey: ['companyToken', effectiveCompanyId],
    queryFn: async () => {
      const tokens = await base44.entities.CompanyToken.filter({ company_id: effectiveCompanyId });
      const active = tokens.filter(t => t.is_active !== false && t.contract_address);
      return active.length > 0 ? active[active.length - 1] : tokens[tokens.length - 1];
    },
    enabled: !!effectiveCompanyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const isLoading = permissionsLoading || companyLoading;

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        contact_person_name: company.contact_person_name || '',
        phone: company.phone || company.phone_number || '',
        email: company.email || '',
        twilio_account_sid: company.twilio_account_sid || '',
        twilio_auth_token: company.twilio_auth_token || '',
        twilio_phone_number: company.twilio_phone_number || '',
        whatsapp_phone_number: company.whatsapp_phone_number || '',
        points_to_currency_ratio: company.points_to_currency_ratio || company.reward_rate || 10,
        pos_currency: company.pos_currency || 'ILS',
        onchain_enabled: company.onchain_enabled || false
      });
    }
  }, [company]);

  useEffect(() => {
    const handleCompanyChange = () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['companyToken'] });
      queryClient.invalidateQueries({ queryKey: ['companies-settings'] });
    };
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [queryClient]);

  const handleCompanyChange = (newCompanyId) => {
    if (!newCompanyId || newCompanyId === effectiveCompanyId) return;
    localStorage.setItem('selected_company_id', newCompanyId);
    window.dispatchEvent(new CustomEvent('companyChanged', { detail: { companyId: newCompanyId } }));
    queryClient.invalidateQueries({ queryKey: ['company'] });
    queryClient.invalidateQueries({ queryKey: ['companyToken'] });
    const selectedCompany = availableCompanies.find(c => c.id === newCompanyId);
    toast.success(`Switched to: ${selectedCompany?.name || 'Company'}`);
  };

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Company.update(effectiveCompanyId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['company-for-pos'] });
      queryClient.invalidateQueries({ queryKey: ['companies-settings'] });
      window.dispatchEvent(new CustomEvent('companySettingsChanged', { detail: { companyId: effectiveCompanyId } }));
      toast.success(t('settings.saveSuccess') || 'Settings saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    }
  });

  const handleSave = () => {
    updateMutation.mutate({
      name: formData.name,
      contact_person_name: formData.contact_person_name,
      phone: formData.phone,
      email: formData.email,
      twilio_account_sid: formData.twilio_account_sid,
      twilio_auth_token: formData.twilio_auth_token,
      twilio_phone_number: formData.twilio_phone_number,
      whatsapp_phone_number: formData.whatsapp_phone_number,
      points_to_currency_ratio: parseFloat(formData.points_to_currency_ratio) || 10,
      pos_currency: formData.pos_currency,
      onchain_enabled: formData.onchain_enabled
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  if (!effectiveCompanyId && availableCompanies.length === 0 && !permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No Company Assigned</p>
          <p className="text-slate-500 text-sm mt-2">Please contact support to create a company</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-white">
          {t('settings.title') || 'Company Settings'}
        </h1>
        <p className="text-slate-400 mt-1">
          {t('settings.subtitle') || 'Manage your company information and contact details'}
        </p>
      </div>

      {isSystemAdmin && availableCompanies.length > 1 && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <Label className="text-white mb-2 block">Select Company</Label>
            <Select value={effectiveCompanyId || ''} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-full bg-[#17171f] border-[#2d2d3a] text-white">
                <SelectValue placeholder="Select a company..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                {availableCompanies.map((comp) => (
                  <SelectItem key={comp.id} value={comp.id} className="text-white">
                    {comp.name} {comp.client_number ? `(${comp.client_number})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {company && (
              <p className="text-xs text-teal-400 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Currently viewing: {company.name}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Connections Card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(99,102,241,0.06))",
        border: "1px solid rgba(16,185,129,0.2)",
        borderRadius: "16px",
        padding: "16px",
        display: "flex", alignItems: "center", gap: "14px",
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: "14px",
          background: "rgba(16,185,129,0.2)", border: "1.5px solid rgba(16,185,129,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Zap className="w-5 h-5 text-teal-400" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="text-white font-semibold text-sm">Connections & Integrations</div>
          <div className="text-slate-400 text-xs mt-0.5">Connect your POS, CRM, Shopify, WooCommerce and more</div>
        </div>
        <Link to={createPageUrl('IntegrationsDashboard')}>
          <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white text-xs">
            Manage →
          </Button>
        </Link>
      </div>

      {/* Company Information */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-400" />
            {t('settings.companyInfo') || 'Company Information'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Company ID</Label>
            <div className="flex gap-2">
              <Input value={company?.id || ''} readOnly className="bg-[#17171f] border-[#2d2d3a] text-white font-mono text-sm" />
              <Button variant="outline" size="icon" className="border-[#2d2d3a]" onClick={() => { navigator.clipboard.writeText(company?.id || ''); toast.success('ID copied!'); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label className="text-slate-300">{t('settings.companyName') || 'Company Name'}</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-[#17171f] border-[#2d2d3a] text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">{t('settings.contactPerson') || 'Contact Person'}</Label>
              <Input value={formData.contact_person_name} onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })} className="bg-[#17171f] border-[#2d2d3a] text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">{t('settings.phone') || 'Phone'}</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="bg-[#17171f] border-[#2d2d3a] text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">{t('settings.email') || 'Email'}</Label>
              <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="bg-[#17171f] border-[#2d2d3a] text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blockchain Wallet */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-teal-400" />
            {t('settings.blockchainWallet') || 'Blockchain Wallet'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Treasury Wallet Address</Label>
            <div className="flex gap-2">
              <Input value={company?.blockchain_wallet_address || 'Not configured'} readOnly className="bg-[#17171f] border-[#2d2d3a] text-white font-mono text-sm" />
              {company?.blockchain_wallet_address && (
                <>
                  <Button variant="outline" size="icon" className="border-[#2d2d3a]" onClick={() => { navigator.clipboard.writeText(company.blockchain_wallet_address); toast.success('Address copied!'); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="border-[#2d2d3a]" onClick={() => window.open(`https://testnet.snowtrace.io/address/${company.blockchain_wallet_address}`, '_blank')}>
                    <TrendingUp className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {companyToken && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#2d2d3a]">
              <div className="space-y-1">
                <Label className="text-slate-500 text-xs">Token Symbol</Label>
                <p className="text-white font-semibold">{companyToken.token_symbol || '—'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-slate-500 text-xs">Treasury Balance</Label>
                <p className="text-teal-400 font-mono">{(companyToken.treasury_balance || 0).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-slate-500 text-xs">Contract</Label>
                {companyToken.contract_address ? (
                  <a href={`https://testnet.snowtrace.io/address/${companyToken.contract_address}`} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 text-xs font-mono truncate block">
                    {companyToken.contract_address.slice(0, 10)}...
                  </a>
                ) : (
                  <p className="text-amber-400 text-xs">Not deployed</p>
                )}
              </div>
            </div>
          )}

          {company?.blockchain_wallet_address && (
            <div className="pt-4">
              <Button variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => setExportDialogOpen(true)}>
                <Download className="w-4 h-4 mr-2" />
                Export Private Key
              </Button>
              <p className="text-xs text-slate-500 mt-2">⚠️ Keep your private key secure. Never share it with anyone.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reward Settings */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-400" />
            Reward Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">POS Currency</Label>
              <Select value={formData.pos_currency} onValueChange={(value) => setFormData({ ...formData, pos_currency: value })}>
                <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                  <SelectItem value="ILS" className="text-white">Israeli Shekel (₪)</SelectItem>
                  <SelectItem value="USD" className="text-white">US Dollar ($)</SelectItem>
                  <SelectItem value="EUR" className="text-white">Euro (€)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Currency displayed in POS Terminal</p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Points per unit spent</Label>
              <Input type="number" value={formData.points_to_currency_ratio} onChange={(e) => setFormData({ ...formData, points_to_currency_ratio: e.target.value })} className="bg-[#17171f] border-[#2d2d3a] text-white w-32" />
              <p className="text-xs text-slate-500">Customer spends {formData.points_to_currency_ratio * 100} tokens per 100 units</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp / SMS Settings */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-teal-400" />
            WhatsApp / SMS Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Twilio Account SID</Label>
              <Input value={formData.twilio_account_sid} onChange={(e) => setFormData({ ...formData, twilio_account_sid: e.target.value })} className="bg-[#17171f] border-[#2d2d3a] text-white" placeholder="AC..." />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Twilio Auth Token</Label>
              <Input type="password" value={formData.twilio_auth_token} onChange={(e) => setFormData({ ...formData, twilio_auth_token: e.target.value })} className="bg-[#17171f] border-[#2d2d3a] text-white" placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Twilio Phone Number</Label>
              <Input value={formData.twilio_phone_number} onChange={(e) => setFormData({ ...formData, twilio_phone_number: e.target.value })} className="bg-[#17171f] border-[#2d2d3a] text-white" placeholder="+1..." />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">WhatsApp Number</Label>
              <Input value={formData.whatsapp_phone_number} onChange={(e) => setFormData({ ...formData, whatsapp_phone_number: e.target.value })} className="bg-[#17171f] border-[#2d2d3a] text-white" placeholder="+972..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tranzila Integration */}
      <TranzilaConnect companyId={effectiveCompanyId} />

      {/* Onchain Pilot Toggle — admin only */}
      {isSystemAdmin && (
        <Card className="bg-[#1a1f2e] border-[#2a2f3e]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#10b981]" />
              Onchain Rewards (Pilot)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-[#0f1420] border border-[#2a2f3e]">
              <div>
                <p className="text-white text-sm font-medium">Enable Mainnet Token Minting</p>
                <p className="text-gray-400 text-xs mt-1">
                  When enabled, rewards are minted as real tokens on Avalanche{' '}
                  <span className={`font-medium ${formData.onchain_enabled ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {formData.onchain_enabled ? '🟢 Active' : '⚪ Inactive'}
                  </span>
                </p>
              </div>
              <Switch
                checked={formData.onchain_enabled}
                onCheckedChange={(val) => setFormData({ ...formData, onchain_enabled: val })}
              />
            </div>
            {formData.onchain_enabled && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Onchain minting is <strong>enabled</strong> for this company.
                  Every token reward will trigger a real blockchain transaction on Fuji Testnet.
                  Make sure the gas wallet has sufficient AVAX.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {t('settings.save') || 'Save Changes'}
        </Button>
      </div>

      <ExportPrivateKeyDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} companyId={effectiveCompanyId} />
    </div>
  );
}