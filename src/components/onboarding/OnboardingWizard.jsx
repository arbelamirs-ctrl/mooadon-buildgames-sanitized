import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Plug,
  Users,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Palette,
  Coins,
  Zap,
  Server,
  ArrowRight,
  Sparkles,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import QuickAddClient from '@/components/company/QuickAddClient';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const STEPS = [
  {
    id: 1,
    label: 'Company Details',
    icon: Building2,
    description: 'Name, logo, branding',
  },
  {
    id: 2,
    label: 'Connections',
    icon: Plug,
    description: 'POS & CRM basics',
  },
  {
    id: 3,
    label: 'First Clients',
    icon: Users,
    description: 'Add your first customers',
  },
];

const POINT_NAME_PRESETS = ['Points', 'Stars', 'Coins', 'Credits', 'Gems', 'Stamps'];

// ─────────────────────────────────────────────
// Progress Bar
// ─────────────────────────────────────────────
function ProgressBar({ currentStep, totalSteps }) {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="w-full">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isComplete = currentStep > step.id;
          const isActive = currentStep === step.id;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isComplete
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : isActive
                      ? 'bg-slate-800 border-emerald-500 text-emerald-400'
                      : 'bg-slate-900 border-slate-700 text-slate-600'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
                    isActive ? 'text-emerald-400' : isComplete ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <div className="flex-1 mx-3 mb-5">
                  <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: currentStep > step.id ? '100%' : '0%' }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step subtitle */}
      <div className="text-center">
        <p className="text-xs text-slate-500">
          Step {currentStep} of {totalSteps} —{' '}
          <span className="text-slate-400">{STEPS[currentStep - 1]?.description}</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 1: Company Details + Branding
// ─────────────────────────────────────────────
function StepCompanyDetails({ data, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Tell us about your business</h2>
        <p className="text-sm text-slate-400 mt-1">
          This info will appear in your loyalty program and customer-facing screens.
        </p>
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <Label className="text-slate-300">
          Business name <span className="text-rose-400">*</span>
        </Label>
        <Input
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g. Coffee House Tel Aviv"
          className="bg-slate-950 border-slate-800 text-white focus:border-emerald-500"
        />
      </div>

      {/* Business Type */}
      <div className="space-y-2">
        <Label className="text-slate-300">Business type</Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'retail', label: '🛍️ Retail' },
            { value: 'restaurant', label: '🍽️ Restaurant' },
            { value: 'cafe', label: '☕ Café' },
            { value: 'beauty', label: '💅 Beauty' },
            { value: 'fitness', label: '🏋️ Fitness' },
            { value: 'other', label: '🏢 Other' },
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => onChange('business_type', type.value)}
              className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
                data.business_type === type.value
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Points Name */}
      <div className="space-y-2">
        <Label className="text-slate-300 flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-400" />
          What do you call your loyalty points?
        </Label>
        <div className="flex gap-2 flex-wrap mb-2">
          {POINT_NAME_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => onChange('points_name', preset)}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${
                data.points_name === preset
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <Input
          value={data.points_name}
          onChange={(e) => onChange('points_name', e.target.value)}
          placeholder="Or type your own..."
          className="bg-slate-950 border-slate-800 text-white focus:border-emerald-500"
        />
      </div>

      {/* Conversion Rate */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">
            Points per ₪1 spent
          </Label>
          <Input
            type="number"
            min={1}
            value={data.points_per_currency}
            onChange={(e) => onChange('points_per_currency', parseInt(e.target.value) || 1)}
            className="bg-slate-950 border-slate-800 text-white focus:border-emerald-500"
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">
            Welcome bonus ({data.points_name || 'points'})
          </Label>
          <Input
            type="number"
            min={0}
            value={data.welcome_bonus_points}
            onChange={(e) => onChange('welcome_bonus_points', parseInt(e.target.value) || 0)}
            className="bg-slate-950 border-slate-800 text-white focus:border-emerald-500"
            dir="ltr"
          />
        </div>
      </div>

      {/* Preview card */}
      {data.name && (
        <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
            <Palette className="w-3 h-3" />
            Preview
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">{data.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Earn {data.points_per_currency || 1} {data.points_name || 'point'} per ₪1
              </p>
            </div>
            {data.welcome_bonus_points > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Sparkles className="w-3 h-3 mr-1" />
                {data.welcome_bonus_points} welcome {data.points_name || 'points'}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 2: Connections (POS + CRM quick connect)
// ─────────────────────────────────────────────
function StepConnections({ companyId }) {
  const [posType, setPosType] = useState(null);
  const [crmType, setCrmType] = useState(null);
  const [tranzilaTerminal, setTranzilaTerminal] = useState('');
  const [tranzilaUser, setTranzilaUser] = useState('');
  const [tranzilaPassword, setTranzilaPassword] = useState('');
  const [hubspotToken, setHubspotToken] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSavePOS = async () => {
    if (!posType || posType === 'generic') return;
    setSaving(true);
    try {
      await base44.functions.invoke('tranzilaConnect', {
        action: 'connect',
        company_id: companyId,
        terminal: tranzilaTerminal,
        username: tranzilaUser,
        password: tranzilaPassword,
      });
      toast.success('Tranzila connected!');
    } catch (err) {
      toast.error('Failed to connect POS', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Connect your tools</h2>
        <p className="text-sm text-slate-400 mt-1">
          Connect your POS and CRM to automate loyalty. You can skip and do this later.
        </p>
      </div>

      {/* POS Section */}
      <div className="space-y-3">
        <Label className="text-slate-300 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          Point of Sale (POS)
        </Label>

        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'tranzila', label: 'Tranzila' },
            { value: 'priority', label: 'Priority' },
            { value: 'generic', label: 'API / Other' },
          ].map((pos) => (
            <button
              key={pos.value}
              onClick={() => setPosType(pos.value)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                posType === pos.value
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>

        {posType === 'tranzila' && (
          <div className="bg-slate-950/40 rounded-lg p-4 border border-slate-800 space-y-3">
            <Input
              value={tranzilaTerminal}
              onChange={(e) => setTranzilaTerminal(e.target.value)}
              placeholder="Terminal name"
              className="bg-slate-950 border-slate-800 text-white focus:border-emerald-500"
              dir="ltr"
            />
            <Input
              value={tranzilaUser}
              onChange={(e) => setTranzilaUser(e.target.value)}
              placeholder="Username"
              className="bg-slate-950 border-slate-800 text-white focus:border-emerald-500"
              dir="ltr"
            />
            <Input
              type="password"
              value={tranzilaPassword}
              onChange={(e) => setTranzilaPassword(e.target.value)}
              placeholder="Password"
              className="bg-slate-950 border-slate-800 text-white focus:border-emerald-500"
              dir="ltr"
            />
            <Button
              size="sm"
              onClick={handleSavePOS}
              disabled={saving || !tranzilaTerminal}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Tranzila'}
            </Button>
          </div>
        )}

        {posType === 'generic' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-xs text-amber-400">
              You can set up the generic POS API webhook later in the Integrations Center.
            </p>
          </div>
        )}

        {posType === 'priority' && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-400">
              Priority ERP sync is available in the Integrations Center after setup.
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* CRM Section */}
      <div className="space-y-3">
        <Label className="text-slate-300 flex items-center gap-2">
          <Plug className="w-4 h-4 text-blue-400" />
          CRM (optional)
        </Label>

        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'hubspot', label: 'HubSpot' },
            { value: 'salesforce', label: 'Salesforce' },
            { value: 'other', label: 'Other' },
          ].map((crm) => (
            <button
              key={crm.value}
              onClick={() => setCrmType(crm.value === crmType ? null : crm.value)}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                crmType === crm.value
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              {crm.label}
            </button>
          ))}
        </div>

        {(crmType === 'hubspot' || crmType === 'salesforce' || crmType === 'other') && (
          <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800">
            <p className="text-xs text-slate-400">
              Full CRM setup is available in the{' '}
              <span className="text-emerald-400 font-medium">Integrations Center</span> after
              onboarding. You'll be able to configure field mapping, sync direction, and test the
              connection.
            </p>
          </div>
        )}
      </div>

      {/* Skip note */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-950/30 border border-slate-800">
        <Zap className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-xs text-slate-400">
          You can skip connections for now and finish them later in{' '}
          <span className="text-white font-medium">Settings → Integrations</span>.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3: First Clients
// ─────────────────────────────────────────────
function StepFirstClients({ companyId, company, clientsAdded, onClientAdded }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Add your first clients</h2>
        <p className="text-sm text-slate-400 mt-1">
          Start with 2–3 VIP customers so you can test the rewards flow right away.
        </p>
      </div>

      {/* Counter */}
      {clientsAdded > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-400">
              {clientsAdded} client{clientsAdded > 1 ? 's' : ''} added!
            </p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              {clientsAdded >= 3
                ? "You're ready to go. Hit Finish to complete setup."
                : `Add ${3 - clientsAdded} more to complete this step (or skip).`}
            </p>
          </div>
        </div>
      )}

      <QuickAddClient
        companyId={companyId}
        onSuccess={onClientAdded}
      />

      {clientsAdded === 0 && (
        <p className="text-center text-xs text-slate-600">
          You can also import customers via CSV after setup.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Wizard
// ─────────────────────────────────────────────
export default function OnboardingWizard({ onComplete }) {
  const { primaryCompanyId, currentUser } = useUserPermissions();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [clientsAdded, setClientsAdded] = useState(0);
  const [companyData, setCompanyData] = useState({
    name: '',
    business_type: '',
    points_name: 'Points',
    points_per_currency: 10,
    welcome_bonus_points: 50,
  });

  // ── registerCompany mutation (Step 1 → Step 2)
  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!companyData.name.trim()) throw new Error('Business name is required');
      const res = await base44.functions.invoke('registerCompany', {
        company_name: companyData.name.trim(),
        business_type: companyData.business_type || 'other',
        points_name: companyData.points_name || 'Points',
        points_per_currency: companyData.points_per_currency,
        welcome_bonus_points: companyData.welcome_bonus_points,
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['integration-status'] });
      setStep(2);
      toast.success('Company created!', {
        description: `${companyData.name} is ready.`,
      });
    },
    onError: (err) => toast.error('Failed to create company', { description: err.message }),
  });

  // ── Mark onboarding complete
  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('completeOnboarding', {
        company_id: primaryCompanyId,
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Setup complete! Welcome to Mooadon 🎉');
      onComplete?.();
    },
    onError: (err) => {
      // fallback: navigate even if the function fails
      toast.error('Could not mark onboarding complete', { description: err.message });
      onComplete?.();
    },
  });

  const handleFieldChange = useCallback((key, value) => {
    setCompanyData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleNext = () => {
    if (step === 1) {
      // If company already exists (primaryCompanyId), skip register
      if (primaryCompanyId) {
        setStep(2);
      } else {
        registerMutation.mutate();
      }
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      completeMutation.mutate();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const canProceed = () => {
    if (step === 1) return companyData.name.trim().length > 0;
    return true; // Steps 2 & 3 are optional
  };

  const isLoading = registerMutation.isPending || completeMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Store className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-2xl font-bold text-white">Mooadon</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Let's set up your loyalty program</h1>
          <p className="text-slate-400">Takes about 2 minutes. You can always change things later.</p>
        </div>

        {/* Progress */}
        <ProgressBar currentStep={step} totalSteps={STEPS.length} />

        {/* Step Content */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardContent className="pt-6">
            {step === 1 && (
              <StepCompanyDetails data={companyData} onChange={handleFieldChange} />
            )}
            {step === 2 && (
              <StepConnections companyId={primaryCompanyId} />
            )}
            {step === 3 && (
              <StepFirstClients
                companyId={primaryCompanyId}
                company={{ ...companyData, id: primaryCompanyId }}
                clientsAdded={clientsAdded}
                onClientAdded={() => setClientsAdded((n) => n + 1)}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || isLoading}
            className="border-slate-700 text-slate-300 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            {/* Skip (steps 2 & 3 only) */}
            {step > 1 && (
              <Button
                variant="ghost"
                onClick={handleNext}
                disabled={isLoading}
                className="text-slate-500 hover:text-slate-300"
              >
                {step === 3 ? 'Skip & Finish' : 'Skip for now'}
              </Button>
            )}

            <Button
              onClick={handleNext}
              disabled={!canProceed() || isLoading}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : step === 3 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Finish Setup
                </>
              ) : step === 1 && !primaryCompanyId ? (
                <>
                  Create & Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Step counter */}
        <p className="text-center text-xs text-slate-700">
          {step} / {STEPS.length}
        </p>
      </div>
    </div>
  );
}