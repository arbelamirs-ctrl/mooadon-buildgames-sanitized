import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Store, Users, Zap, Gift, Key, CheckCircle,
  ArrowRight, Rocket, Loader2, Plus, Trash2, Sparkles,
  MessageSquare, UserCheck, Crown, Briefcase, UserCog
} from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import confetti from 'canvas-confetti';
import { useI18n } from '@/components/i18n/useI18n';
import WalletSetupStep from '@/components/onboarding/WalletSetupStep';

// ─── Role options shown in Step 1 ────────────────────────────────────────────
const USER_ROLES = [
  {
    value: 'owner',
    label: 'I am the business owner',
    description: 'You own this business and are setting it up yourself.',
    icon: Crown,
    color: 'text-yellow-400',
    border: 'border-yellow-500',
    bg: 'bg-yellow-500/10'
  },
  {
    value: 'manager',
    label: 'I am a manager',
    description: "You manage the business but the owner is someone else.",
    icon: Briefcase,
    color: 'text-blue-400',
    border: 'border-blue-500',
    bg: 'bg-blue-500/10'
  },
  {
    value: 'employee',
    label: 'I am an employee setting this up for the owner',
    description: "The owner will receive login details and notifications.",
    icon: UserCog,
    color: 'text-purple-400',
    border: 'border-purple-500',
    bg: 'bg-purple-500/10'
  }
];

export default function OnboardingWizard() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    // ── Role fields (Step 1) ──────────────────────────────────────────────
    userRole: '',           // 'owner' | 'manager' | 'employee'
    ownerName: '',          // if not owner
    ownerEmail: '',         // if not owner
    // ── Business info ─────────────────────────────────────────────────────
    businessName: '',
    businessType: '',
    address: '',
    phone: '',
    company_registration_id: '',
    // ── Branches / Customers ──────────────────────────────────────────────
    branches: [{ name: '', location: '', phone: '' }],
    customers: [],
    // ── POS & Rewards ─────────────────────────────────────────────────────
    posType: '',
    posApiKey: '',
    rewardType: 'token',
    rewardRate: 10,
    welcomeBonus: 100,
    pointsName: '',
    // ── Wallet & Messaging ────────────────────────────────────────────────
    walletOption: 'managed',
    ownWalletAddress: '',
    usePlatformTwilio: true,
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    twilioWhatsappNumber: '',
    // ── Webhooks ─────────────────────────────────────────────────────────
    webhookUrl: '',
    enableWebhooks: false
  });

  const [loading, setLoading] = useState(false);
  const [blockchainError, setBlockchainError] = useState(null); // { companyId, message }
  const [retrying, setRetrying] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ phone: '', full_name: '' });

  const queryClient = useQueryClient();

  // ─── Auth check ──────────────────────────────────────────────────────────
  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (user.role === 'admin' || user.role === 'super_admin') {
          setIsRedirecting(true);
          navigate(createPageUrl('SuperAdminDashboard'));
          return;
        }
        setIsCheckingUser(false);
      } catch (error) {
        console.error('Error checking user:', error);
        setIsCheckingUser(false);
      }
    };
    checkUser();
  }, [navigate]);

  // ─── Load existing partial company ──────────────────────────────────────
  const { data: userCompany, isLoading: isCheckingCompany } = useQuery({
    queryKey: ['userCompany', currentUser?.id],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (user.role === 'admin' || user.role === 'super_admin') return null;
      const permissions = await base44.entities.UserPermission.filter({ user_id: user.id, is_active: true });
      if (permissions.length > 0 && permissions[0].company_id) {
        const companies = await base44.entities.Company.filter({ id: permissions[0].company_id });
        if (companies.length > 0) return companies[0];
      }
      return null;
    },
    enabled: !isCheckingUser && !!currentUser
  });

  useEffect(() => {
    if (!currentUser || isCheckingCompany || loading || isRedirecting) return;
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') return;
    if (userCompany?.onboarding_completed) {
      setIsRedirecting(true);
      navigate(createPageUrl('AgentDashboard'));
      return;
    }
    if (userCompany && !userCompany.onboarding_completed) {
      loadExistingCompanyData(userCompany);
    }
  }, [currentUser, userCompany, isCheckingCompany, navigate, loading]);

  const loadExistingCompanyData = async (company) => {
    const branches = await base44.entities.Branch.filter({ company_id: company.id });
    const clients  = await base44.entities.Client.filter({ company_id: company.id });
    setFormData(prev => ({
      ...prev,
      businessName: company.name || '',
      address: company.physical_address || '',
      phone: company.phone || company.phone_number || '',
      company_registration_id: company.company_registration_id || '',
      branches: branches.length > 0
        ? branches.map(b => ({ name: b.name, location: b.location, phone: b.phone || '' }))
        : [{ name: '', location: '', phone: '' }],
      customers: clients.map(c => ({ phone: c.phone, full_name: c.full_name || '' })),
      posType: company.pos_type || '',
      posApiKey: company.pos_api_key || '',
      rewardType: company.enable_coupons ? 'coupon' : 'token',
      rewardRate: company.reward_rate || 10,
      welcomeBonus: company.welcome_bonus || 100,
      pointsName: company.points_name || ''
    }));
    setCurrentStep(company.onboarding_step || 1);
  };

  // ─── Lookup data ─────────────────────────────────────────────────────────
  const BUSINESS_TYPES = [
    { value: 'retail',     label: t('businessTypes.retail'),     icon: '🛍️' },
    { value: 'restaurant', label: t('businessTypes.restaurant'), icon: '🍽️' },
    { value: 'cafe',       label: t('businessTypes.cafe'),       icon: '☕' },
    { value: 'other',      label: t('businessTypes.other'),      icon: '🪄' }
  ];

  const POS_TYPES = [
    { value: 'manual',   label: '✅ ' + t('onboarding.pos.manual'),  description: t('onboarding.pos.manualDesc') },
    { value: 'square',   label: '✅ Square',                          description: t('onboarding.pos.squareDesc') },
    { value: 'custom',   label: '✅ ' + t('onboarding.pos.custom'),  description: t('onboarding.pos.customDesc') },
    { value: 'priority', label: '⏳ Priority ERP',                    description: t('onboarding.pos.comingSoon'), disabled: true },
    { value: 'toast',    label: '⏳ Toast',                           description: t('onboarding.pos.comingSoon'), disabled: true },
    { value: 'clover',   label: '⏳ Clover',                          description: t('onboarding.pos.comingSoon'), disabled: true }
  ];

  const REWARD_TYPES = [
    { value: 'token',     label: t('onboarding.rewards.token'),    description: t('onboarding.rewards.tokenDesc'),    icon: '🪙', color: 'from-yellow-500 to-amber-600' },
    { value: 'coupon',    label: t('onboarding.rewards.coupon'),   description: t('onboarding.rewards.couponDesc'),   icon: '🎟️', color: 'from-purple-500 to-pink-600' },
    { value: 'free_item', label: t('onboarding.rewards.freeItem'), description: t('onboarding.rewards.freeItemDesc'), icon: '🎁', color: 'from-green-500 to-emerald-600' }
  ];

  const selectedReward   = REWARD_TYPES.find(r => r.value === formData.rewardType);
  const selectedUserRole = USER_ROLES.find(r => r.value === formData.userRole);
  const isOwner          = formData.userRole === 'owner';

  // ─── Form helpers ─────────────────────────────────────────────────────────
  const updateField    = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const addBranch      = () => setFormData(prev => ({ ...prev, branches: [...prev.branches, { name: '', location: '', phone: '' }] }));
  const removeBranch   = (i) => { if (formData.branches.length > 1) setFormData(prev => ({ ...prev, branches: prev.branches.filter((_, idx) => idx !== i) })); };
  const updateBranch   = (i, field, value) => setFormData(prev => ({ ...prev, branches: prev.branches.map((b, idx) => idx === i ? { ...b, [field]: value } : b) }));

  const addCustomer = () => {
    if (!newCustomer.phone) { toast.error(t('onboarding.customers.phoneRequired')); return; }
    setFormData(prev => ({ ...prev, customers: [...prev.customers, { ...newCustomer }] }));
    setNewCustomer({ phone: '', full_name: '' });
    toast.success(t('onboarding.customers.customerAdded'));
  };
  const removeCustomer = (i) => setFormData(prev => ({ ...prev, customers: prev.customers.filter((_, idx) => idx !== i) }));

  // ─── Validation ───────────────────────────────────────────────────────────
  const validateStep = () => {
    if (currentStep === 1) {
      if (!formData.userRole) { toast.error('Please select your role in this business'); return false; }
      if (!isOwner) {
        if (!formData.ownerEmail) { toast.error("Please enter the owner's email address"); return false; }
        if (!formData.ownerEmail.includes('@')) { toast.error('Please enter a valid email address for the owner'); return false; }
      }
      if (!formData.businessName) { toast.error(t('onboarding.businessInfo.nameRequired')); return false; }
      if (!formData.businessType) { toast.error(t('onboarding.businessInfo.typeRequired')); return false; }
      if (!formData.address)      { toast.error(t('onboarding.businessInfo.addressRequired')); return false; }
      if (!formData.company_registration_id) { toast.error('Registration number is required'); return false; }
      if (!/^\d{9}$/.test(formData.company_registration_id)) { toast.error('Registration number must be exactly 9 digits'); return false; }
    }
    if (currentStep === 2) {
      if (!formData.branches.some(b => b.name && b.location)) { toast.error(t('onboarding.branches.atLeastOne')); return false; }
    }
    if (currentStep === 4) {
      if (!formData.posType) { toast.error(t('onboarding.pos.posRequired')); return false; }
      if (POS_TYPES.find(p => p.value === formData.posType)?.disabled) { toast.error(t('onboarding.pos.comingSoon')); return false; }
    }
    if (currentStep === 5) {
      if (!formData.rewardType) { toast.error(t('onboarding.rewards.rewardTypeRequired')); return false; }
    }
    if (currentStep === 6) {
      if (formData.walletOption === 'own' && !formData.ownWalletAddress) { toast.error('Please enter a wallet address'); return false; }
      if (formData.walletOption === 'own' && !formData.ownWalletAddress.match(/^0x[a-fA-F0-9]{40}$/)) { toast.error('Invalid wallet address format'); return false; }
    }
    return true;
  };

  // ─── Navigation ───────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (!validateStep()) return;
    if (userCompany) {
      try { await base44.entities.Company.update(userCompany.id, { onboarding_step: currentStep + 1 }); }
      catch (e) { console.error('Error saving progress:', e); }
    }
    // Pre-generate tokens when leaving step 5 if token reward selected
    if (currentStep === 5 && formData.rewardType === 'token' && userCompany) {
      try {
        const tokens = await base44.entities.CompanyToken.filter({ company_id: userCompany.id });
        if (tokens.length === 0) {
          const customSymbol = formData.pointsName
            ? formData.pointsName.substring(0, 5).toUpperCase().replace(/\s+/g, '')
            : formData.businessName.substring(0, 4).toUpperCase();
          const customName = formData.pointsName || formData.businessName + ' Token';
          await base44.functions.invoke('generateCompanyTokens', {
            company_id: userCompany.id, tokenName: customName, tokenSymbol: customSymbol, initialSupply: '1000000'
          });
        }
      } catch (e) { console.error('Error pre-creating token:', e); }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => setCurrentStep(prev => prev - 1);

  // ─── Complete Setup ───────────────────────────────────────────────────────
  const completeSetup = async () => {
    if (loading) return;
    setLoading(true);

    if (!formData.businessName)            { setLoading(false); toast.error('Business name is required'); return; }
    if (!formData.address)                 { setLoading(false); toast.error('Business address is required'); return; }
    if (!formData.company_registration_id) { setLoading(false); toast.error('Registration number is required'); return; }

    try {
      const me = await base44.auth.me();

      const generateApiKey  = () => 'sk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const customSymbol    = formData.pointsName
        ? formData.pointsName.substring(0, 5).toUpperCase().replace(/\s+/g, '')
        : formData.businessName.substring(0, 4).toUpperCase();
      const customTokenName = formData.pointsName || formData.businessName + ' Token';

      // ── 1. Create or update Company record ──────────────────────────────
      let company;
      if (userCompany) {
        await base44.entities.Company.update(userCompany.id, {
          name:                    formData.businessName,
          status:                  'active',
          pos_type:                formData.posType || 'manual',
          reward_rate:             formData.rewardRate || 10,
          welcome_bonus:           formData.welcomeBonus || 100,
          points_name:             formData.pointsName || 'points',
          points_to_currency_ratio: formData.rewardRate || 10,
          enable_coupons:          formData.rewardType === 'coupon',
          phone:                   formData.phone || '',
          phone_number:            formData.phone || '',
          physical_address:        formData.address || '',
          wallet_chain:            'avalanche_fuji',
          company_registration_id: formData.company_registration_id || ''
        });
        company = { ...userCompany, id: userCompany.id };
      } else {
        company = await base44.entities.Company.create({
          name:                    formData.businessName,
          status:                  'active',
          pos_type:                formData.posType || 'manual',
          reward_rate:             formData.rewardRate || 10,
          welcome_bonus:           formData.welcomeBonus || 100,
          primary_color:           '#10b981',
          points_name:             formData.pointsName || 'points',
          points_to_currency_ratio: formData.rewardRate || 10,
          enable_coupons:          formData.rewardType === 'coupon',
          phone:                   formData.phone || '',
          phone_number:            formData.phone || '',
          physical_address:        formData.address || '',
          wallet_chain:            'avalanche_fuji',
          onboarding_step:         9,
          onboarding_completed:    false  // backend sets this to true
        });
      }

      // ── 2. Create UserPermission for the current (setup) user ────────────
      // Role: 'owner' if they selected owner, otherwise their selected role
      const setupUserRole = formData.userRole || 'owner';
      const existingPerm  = await base44.entities.UserPermission.filter({ user_id: me.id, company_id: company.id });
      if (existingPerm.length === 0) {
        await base44.entities.UserPermission.create({
          user_id:      me.id,
          user_email:   me.email,
          company_id:   company.id,
          company_name: formData.businessName,
          role:         setupUserRole,
          is_active:    true
        });
      } else {
        // Update role in case it changed
        await base44.entities.UserPermission.update(existingPerm[0].id, { role: setupUserRole });
      }

      // ── 3. If NOT the owner → create an 'owner' permission for the real owner ──
      if (!isOwner && formData.ownerEmail) {
        const ownerPerms = await base44.entities.UserPermission.filter({
          user_email: formData.ownerEmail,
          company_id: company.id
        });
        if (ownerPerms.length === 0) {
          await base44.entities.UserPermission.create({
            user_email:   formData.ownerEmail,
            company_id:   company.id,
            company_name: formData.businessName,
            role:         'owner',
            is_active:    true
            // user_id will be linked when the owner logs in
          });
        }
      }

      // ── 4. Create branch(es) ─────────────────────────────────────────────
      const existingBranches = await base44.entities.Branch.filter({ company_id: company.id });
      if (existingBranches.length === 0) {
        const validBranches    = formData.branches.filter(b => b.name && b.location);
        // English fallback for HQ branch name
        const branchesToCreate = validBranches.length > 0
          ? validBranches
          : [{ name: 'Main Branch', location: formData.address, phone: formData.phone || '' }];
        for (const b of branchesToCreate) {
          await base44.entities.Branch.create({
            company_id: company.id,
            name:       b.name,
            location:   b.location,
            phone:      b.phone || '',
            status:     'active',
            api_key:    generateApiKey()
          });
        }
      }

      // ── 5. Call backend setup (wallet + token + fund + email) ────────────
      toast.info('Setting up your account…', { duration: 10000 });

      // ── 5. Call backend setup ────────────────────────────────────────────
      const setupResult = await base44.functions.invoke('registerCompany', {
        companyId:    company.id,
        companyName:  formData.businessName,
        tokenName:    customTokenName,
        tokenSymbol:  customSymbol,
        userRole:     formData.userRole || 'owner',
        ownerEmail:   isOwner ? undefined : formData.ownerEmail,
        ownerName:    isOwner ? undefined : formData.ownerName
      });

      // ── 6. Verify backend completed onboarding ───────────────────────────
      const updatedCompanies = await base44.entities.Company.filter({ id: company.id });
      const updatedCompany   = updatedCompanies[0];

      if (updatedCompany?.onboarding_completed !== true) {
        const errMsg = setupResult?.data?.error || 'Setup did not complete. Please try again.';
        throw new Error(errMsg);
      }

      // ── 6b. Check blockchain setup_status ───────────────────────────────
      const setupStatus = updatedCompany?.setup_status;
      if (setupStatus === 'error' || setupStatus === 'ready_partial') {
        setLoading(false);
        toast.error(
          'Blockchain setup incomplete. Please retry.',
          { duration: 10000 }
        );
        // Show retry UI — store the company id for retry
        setBlockchainError({ companyId: company.id, message: setupResult?.data?.error || updatedCompany?.setup_last_error || 'Blockchain setup failed' });
        return;
      }

      // ── 7. Create initial customers ──────────────────────────────────────
      const validCustomers = formData.customers.filter(c => c.phone);
      for (const customer of validCustomers) {
        const existing = await base44.entities.Client.filter({ phone: customer.phone, company_id: company.id });
        if (existing.length === 0) {
          await base44.entities.Client.create({
            company_id:      company.id,
            phone:           customer.phone,
            full_name:       customer.full_name || '',
            current_balance: formData.welcomeBonus || 100
          });
        }
      }

      // ── 8. Celebrate & redirect ──────────────────────────────────────────
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      toast.success('🎉 Business set up successfully! Redirecting to dashboard…', { duration: 3000 });

      queryClient.invalidateQueries();
      queryClient.clear();

      setLoading(false);
      setTimeout(() => navigate(createPageUrl('AgentDashboard'), { replace: true }), 2500);

    } catch (error) {
      console.error('SETUP ERROR:', error);
      setLoading(false);
      toast.error('Setup error: ' + (error?.message || String(error)), { duration: 8000 });
    }
  };

  const handleRetryBlockchain = async () => {
    if (!blockchainError?.companyId) return;
    setRetrying(true);
    try {
      const result = await base44.functions.invoke('registerCompany', {
        companyId: blockchainError.companyId,
        companyName: formData.businessName,
        tokenName: formData.pointsName || formData.businessName + ' Token',
        tokenSymbol: formData.pointsName
          ? formData.pointsName.substring(0, 5).toUpperCase().replace(/\s+/g, '')
          : formData.businessName.substring(0, 4).toUpperCase(),
        userRole: formData.userRole || 'owner',
        ownerEmail: formData.userRole !== 'owner' ? formData.ownerEmail : undefined,
        ownerName: formData.userRole !== 'owner' ? formData.ownerName : undefined
      });
      const updatedCompanies = await base44.entities.Company.filter({ id: blockchainError.companyId });
      const updatedCompany = updatedCompanies[0];
      if (updatedCompany?.setup_status === 'ready') {
        setBlockchainError(null);
        toast.success('Blockchain setup complete! Redirecting to dashboard…');
        queryClient.invalidateQueries();
        queryClient.clear();
        setTimeout(() => navigate(createPageUrl('AgentDashboard'), { replace: true }), 2000);
      } else {
        setBlockchainError(prev => ({ ...prev, message: result?.data?.error || updatedCompany?.setup_last_error || 'Retry failed' }));
        toast.error('Retry failed. Please try again.');
      }
    } catch (e) {
      setBlockchainError(prev => ({ ...prev, message: e.message }));
      toast.error('Retry error: ' + e.message);
    } finally {
      setRetrying(false);
    }
  };

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (isCheckingUser || isCheckingCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  const stepLabels = [
    'Role & Info', t('onboarding.step2'), t('onboarding.step3'),
    'POS', t('onboarding.step5'), t('onboarding.step6'),
    'SMS', 'API', t('onboarding.step7')
  ];

  // ─── Blockchain error state ───────────────────────────────────────────────
  if (blockchainError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#1f2128] border border-red-500/30 rounded-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
            <Building2 className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Blockchain setup incomplete</h2>
          <p className="text-red-400 text-sm">{blockchainError.message}</p>
          <p className="text-[#9ca3af] text-xs">Wallet creation, token deployment, or AVAX funding failed. Click Retry to try again.</p>
          <Button
            onClick={handleRetryBlockchain}
            disabled={retrying}
            className="w-full bg-red-500 hover:bg-red-600 text-white"
          >
            {retrying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Retrying…</> : 'Retry Blockchain Setup'}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4" dir={dir}>
      <div className="max-w-4xl w-full">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-2xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t('onboarding.title')}</h1>
          <p className="text-[#9ca3af]">{t('onboarding.subtitle')}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((step, idx) => (
              <div key={step} className="flex items-center" style={{ flex: idx < 8 ? 1 : 0 }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  currentStep >= step ? 'bg-teal-500 text-white' : 'bg-[#2d2d3a] text-[#9ca3af]'
                }`}>{step}</div>
                {step < 9 && <div className={`h-1 flex-1 mx-1 ${currentStep > step ? 'bg-teal-500' : 'bg-[#2d2d3a]'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-[#9ca3af]">
            {stepLabels.map((label, i) => <span key={i}>{label}</span>)}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 1 — Role Selection + Business Info
        ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 1 && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-teal-400" />
                Your role &amp; business details
              </CardTitle>
              <CardDescription className="text-[#9ca3af]">
                Tell us who you are and enter your business information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* ── Role Selection ── */}
              <div>
                <Label className="text-white text-sm font-medium mb-3 block">
                  What is your role in this business? *
                </Label>
                <div className="grid grid-cols-1 gap-3">
                  {USER_ROLES.map(role => {
                    const Icon      = role.icon;
                    const isSelected = formData.userRole === role.value;
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => updateField('userRole', role.value)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? `${role.border} ${role.bg}`
                            : 'border-[#2d2d3a] bg-[#17171f] hover:border-[#3d3d4a]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 shrink-0 ${isSelected ? role.color : 'text-[#9ca3af]'}`} />
                          <div>
                            <p className={`font-medium text-sm ${isSelected ? 'text-white' : 'text-[#d1d5db]'}`}>
                              {role.label}
                            </p>
                            <p className="text-xs text-[#9ca3af] mt-0.5">{role.description}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle className={`w-4 h-4 ml-auto shrink-0 ${role.color}`} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Owner details (only when NOT owner) ── */}
              {formData.userRole && !isOwner && (
                <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 space-y-3">
                  <p className="text-sm text-[#9ca3af]">
                    Since you are not the owner, we'll send the welcome email and create an account for the owner.
                  </p>
                  <div>
                    <Label className="text-white text-xs">Owner's full name</Label>
                    <Input
                      value={formData.ownerName}
                      onChange={(e) => updateField('ownerName', e.target.value)}
                      placeholder="Jane Smith"
                      className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-xs">Owner's email address *</Label>
                    <Input
                      type="email"
                      value={formData.ownerEmail}
                      onChange={(e) => updateField('ownerEmail', e.target.value)}
                      placeholder="owner@business.com"
                      className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              {/* ── Business Info fields (shown once role is selected) ── */}
              {formData.userRole && (
                <div className="space-y-4 pt-2 border-t border-[#2d2d3a]">
                  <p className="text-xs text-[#9ca3af] pt-1">Business details</p>

                  <div>
                    <Label className="text-white">{t('onboarding.businessInfo.businessName')} *</Label>
                    <Input
                      value={formData.businessName}
                      onChange={(e) => updateField('businessName', e.target.value)}
                      placeholder={t('onboarding.businessInfo.businessNamePlaceholder')}
                      className="mt-1 bg-[#17171f] border-[#2d2d3a] text-white"
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label className="text-white">{t('onboarding.businessInfo.businessType')} *</Label>
                    <Select value={formData.businessType} onValueChange={(v) => updateField('businessType', v)}>
                      <SelectTrigger className="mt-1 bg-[#17171f] border-[#2d2d3a] text-white">
                        <SelectValue placeholder={t('onboarding.businessInfo.selectBusinessType')} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                        {BUSINESS_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value} className="text-white">
                            {type.icon} {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white">{t('onboarding.businessInfo.address')} *</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder={t('onboarding.businessInfo.addressPlaceholder')}
                      className="mt-1 bg-[#17171f] border-[#2d2d3a] text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-white">{t('onboarding.businessInfo.phone')}</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder={t('onboarding.businessInfo.phonePlaceholder')}
                      className="mt-1 bg-[#17171f] border-[#2d2d3a] text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-white">
                      Registration Number (Corp/Business ID) *
                      <span className="text-xs text-slate-400 block mt-1">Exactly 9 digits</span>
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{9}"
                      maxLength={9}
                      value={formData.company_registration_id}
                      onChange={(e) => updateField('company_registration_id', e.target.value.replace(/\D/g, ''))}
                      placeholder="514588763"
                      className="mt-1 bg-[#17171f] border-[#2d2d3a] text-white"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleNext}
                  disabled={!formData.userRole}
                  className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50"
                >
                  {t('common.continue')} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 2 — Branches
        ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 2 && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Store className="w-5 h-5 text-cyan-400" />{t('onboarding.branches.title')}</CardTitle>
              <CardDescription className="text-[#9ca3af]">{t('onboarding.branches.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.branches.map((branch, index) => (
                <div key={index} className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium">{t('onboarding.branches.branch')} {index + 1}</h4>
                    {formData.branches.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeBranch(index)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-white text-xs">{t('onboarding.branches.branchName')} *</Label>
                      <Input value={branch.name} onChange={(e) => updateBranch(index, 'name', e.target.value)} placeholder={t('onboarding.branches.branchName')} className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" />
                    </div>
                    <div>
                      <Label className="text-white text-xs">{t('onboarding.branches.branchLocation')} *</Label>
                      <Input value={branch.location} onChange={(e) => updateBranch(index, 'location', e.target.value)} placeholder={t('onboarding.branches.branchLocation')} className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-white text-xs">{t('common.phone')} ({t('common.optional')})</Label>
                      <Input value={branch.phone} onChange={(e) => updateBranch(index, 'phone', e.target.value)} placeholder={t('onboarding.businessInfo.phonePlaceholder')} className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" />
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={addBranch} variant="outline" className="w-full border-[#2d2d3a] text-teal-400">
                <Plus className="w-4 h-4 ml-2" />{t('onboarding.branches.addBranch')}
              </Button>
              <div className="flex justify-between pt-4">
                <Button onClick={handleBack} variant="outline" className="border-[#2d2d3a] text-white">{t('common.back')}</Button>
                <Button onClick={handleNext} className="bg-teal-500 hover:bg-teal-600">{t('common.continue')} <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 3 — Initial Customers
        ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 3 && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Users className="w-5 h-5 text-purple-400" />{t('onboarding.customers.title')}</CardTitle>
              <CardDescription className="text-[#9ca3af]">{t('onboarding.customers.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <p className="text-xs text-purple-400">{t('onboarding.customers.skipNote')}</p>
              </div>
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">{t('onboarding.customers.addCustomer')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label className="text-white text-xs">{t('common.phone')} *</Label>
                    <Input value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder={t('onboarding.businessInfo.phonePlaceholder')} className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" />
                  </div>
                  <div>
                    <Label className="text-white text-xs">{t('onboarding.customers.fullName')} ({t('common.optional')})</Label>
                    <Input value={newCustomer.full_name} onChange={(e) => setNewCustomer({...newCustomer, full_name: e.target.value})} placeholder={t('onboarding.customers.fullName')} className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" />
                  </div>
                </div>
                <Button onClick={addCustomer} variant="outline" size="sm" className="border-[#2d2d3a] text-purple-400">
                  <Plus className="w-4 h-4 ml-2" />{t('onboarding.customers.addCustomer')}
                </Button>
              </div>
              {formData.customers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-white font-medium text-sm">{t('onboarding.customers.customers')} ({formData.customers.length})</h4>
                  {formData.customers.map((customer, index) => (
                    <div key={index} className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{customer.full_name || t('onboarding.customers.noName')}</p>
                        <p className="text-[#9ca3af] text-xs">{customer.phone}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeCustomer(index)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between pt-4">
                <Button onClick={handleBack} variant="outline" className="border-[#2d2d3a] text-white">{t('common.back')}</Button>
                <Button onClick={handleNext} className="bg-teal-500 hover:bg-teal-600">{t('common.continue')} <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 4 — POS Integration
        ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 4 && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Zap className="w-5 h-5 text-cyan-400" />{t('onboarding.pos.title')}</CardTitle>
              <CardDescription className="text-[#9ca3af]">{t('onboarding.pos.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-white">{t('onboarding.pos.selectPos')}</Label>
                <Select value={formData.posType} onValueChange={(v) => updateField('posType', v)}>
                  <SelectTrigger className="mt-1 bg-[#17171f] border-[#2d2d3a] text-white">
                    <SelectValue placeholder={t('onboarding.pos.selectPosPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                    {POS_TYPES.map(pos => (
                      <SelectItem
                        key={pos.value}
                        value={pos.value}
                        disabled={pos.disabled}
                        className={pos.disabled ? 'text-[#555] cursor-not-allowed opacity-50' : 'text-white'}
                      >
                        <div>
                          <div className="font-medium">{pos.label}</div>
                          <div className="text-xs text-[#9ca3af]">{pos.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.posType && formData.posType !== 'manual' && (
                <div>
                  <Label className="text-white">{t('onboarding.pos.apiKey')}</Label>
                  <Input type="password" value={formData.posApiKey} onChange={(e) => updateField('posApiKey', e.target.value)} placeholder={t('onboarding.pos.apiKeyPlaceholder')} className="mt-1 bg-[#17171f] border-[#2d2d3a] text-white" />
                  <p className="text-xs text-[#9ca3af] mt-1">{t('onboarding.pos.configLater')}</p>
                </div>
              )}
              <div className="flex justify-between pt-4">
                <Button onClick={handleBack} variant="outline" className="border-[#2d2d3a] text-white">{t('common.back')}</Button>
                <Button onClick={handleNext} className="bg-teal-500 hover:bg-teal-600">{t('common.continue')} <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 5 — Reward Program
        ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 5 && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Gift className="w-5 h-5 text-pink-400" />{t('onboarding.rewards.title')}</CardTitle>
              <CardDescription className="text-[#9ca3af]">{t('onboarding.rewards.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {REWARD_TYPES.map(reward => (
                  <button key={reward.value} onClick={() => updateField('rewardType', reward.value)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${formData.rewardType === reward.value ? 'border-teal-500 bg-teal-500/10' : 'border-[#2d2d3a] bg-[#17171f] hover:border-[#3d3d4a]'}`}>
                    <div className="text-3xl mb-2">{reward.icon}</div>
                    <h4 className="text-white font-medium mb-1">{reward.label}</h4>
                    <p className="text-xs text-[#9ca3af]">{reward.description}</p>
                  </button>
                ))}
              </div>
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 space-y-3">
                <h4 className="text-white font-medium">{t('onboarding.rewards.settings')}</h4>
                <div>
                  <Label className="text-white">{t('onboarding.rewards.pointsName')}</Label>
                  <Input value={formData.pointsName} onChange={(e) => updateField('pointsName', e.target.value)} placeholder={t('onboarding.rewards.pointsNamePlaceholder')} className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" />
                </div>
                <div>
                  <Label className="text-white">{t('onboarding.rewards.rewardRate')}</Label>
                  <Input type="number" value={formData.rewardRate} onChange={(e) => updateField('rewardRate', Number(e.target.value))} className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" />
                  <p className="text-xs text-[#9ca3af] mt-1">{t('onboarding.rewards.rewardRateDesc')}</p>
                </div>
                <div>
                  <Label className="text-white">{t('onboarding.rewards.welcomeBonus')}</Label>
                  <Input type="number" value={formData.welcomeBonus} onChange={(e) => updateField('welcomeBonus', Number(e.target.value))} className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" />
                  <p className="text-xs text-[#9ca3af] mt-1">{t('onboarding.rewards.welcomeBonusDesc')}</p>
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <Button onClick={handleBack} variant="outline" className="border-[#2d2d3a] text-white">{t('common.back')}</Button>
                <Button onClick={handleNext} className="bg-teal-500 hover:bg-teal-600">{t('common.continue')} <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 6 — Wallet Setup
        ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 6 && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-6">
              <WalletSetupStep formData={formData} setFormData={setFormData} />
              <div className="flex justify-between pt-4 mt-6 border-t border-[#2d2d3a]">
                <Button onClick={handleBack} variant="outline" className="border-[#2d2d3a] text-white">{t('common.back')}</Button>
                <Button onClick={handleNext} className="bg-teal-500 hover:bg-teal-600">{t('common.continue')} <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 7 — SMS / WhatsApp
        ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 7 && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-400" />
                SMS &amp; WhatsApp ({t('common.optional')})
              </CardTitle>
              <CardDescription className="text-[#9ca3af]">
                Configure messaging to send reward links to customers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="text-xs text-green-400">💡 You can use the platform's shared Twilio account or connect your own.</p>
              </div>
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">Use platform messaging</h4>
                    <p className="text-xs text-[#9ca3af]">Send via shared Twilio account (recommended)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.usePlatformTwilio} onChange={(e) => updateField('usePlatformTwilio', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-[#2d2d3a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                  </label>
                </div>
              </div>
              {!formData.usePlatformTwilio && (
                <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 space-y-3">
                  <h4 className="text-white font-medium">Your Twilio Account</h4>
                  <div>
                    <Label className="text-white">Account SID</Label>
                    <Input value={formData.twilioAccountSid} onChange={(e) => updateField('twilioAccountSid', e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-white">Auth Token</Label>
                    <Input type="password" value={formData.twilioAuthToken} onChange={(e) => updateField('twilioAuthToken', e.target.value)} placeholder="••••••••••••••••••••••••••••••" className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-white">Twilio Phone Number (SMS)</Label>
                    <Input value={formData.twilioPhoneNumber} onChange={(e) => updateField('twilioPhoneNumber', e.target.value)} placeholder="+1234567890" className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" dir="ltr" />
                  </div>
                  <div>
                    <Label className="text-white">WhatsApp Number ({t('common.optional')})</Label>
                    <Input value={formData.twilioWhatsappNumber} onChange={(e) => updateField('twilioWhatsappNumber', e.target.value)} placeholder="+14155238886" className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" dir="ltr" />
                    <p className="text-xs text-[#9ca3af] mt-1">Get this from your Twilio WhatsApp Sandbox.</p>
                  </div>
                </div>
              )}
              <div className="flex justify-between pt-4">
                <Button onClick={handleBack} variant="outline" className="border-[#2d2d3a] text-white">{t('common.back')}</Button>
                <Button onClick={handleNext} className="bg-teal-500 hover:bg-teal-600">{t('common.continue')} <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 8 — API & Webhooks
        ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 8 && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Key className="w-5 h-5 text-yellow-400" />{t('onboarding.api.title')}</CardTitle>
              <CardDescription className="text-[#9ca3af]">{t('onboarding.api.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-xs text-yellow-400">{t('onboarding.api.skipNote')}</p>
              </div>
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">{t('onboarding.api.webhooks')}</h4>
                    <p className="text-xs text-[#9ca3af]">{t('onboarding.api.webhooksDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.enableWebhooks} onChange={(e) => updateField('enableWebhooks', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-[#2d2d3a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                  </label>
                </div>
                {formData.enableWebhooks && (
                  <div>
                    <Label className="text-white">{t('onboarding.api.webhookUrl')}</Label>
                    <Input value={formData.webhookUrl} onChange={(e) => updateField('webhookUrl', e.target.value)} placeholder={t('onboarding.api.webhookUrlPlaceholder')} className="mt-1 bg-[#1f2128] border-[#2d2d3a] text-white" dir="ltr" />
                    <p className="text-xs text-[#9ca3af] mt-1">{t('onboarding.api.webhookEvents')}</p>
                  </div>
                )}
              </div>
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">{t('onboarding.api.apiKeys')}</h4>
                <p className="text-xs text-[#9ca3af] mb-3">{t('onboarding.api.apiKeysDesc')}</p>
                <div className="flex items-center gap-2 text-teal-400 text-xs">
                  <CheckCircle className="w-4 h-4" />
                  <span>{t('onboarding.api.apiKeysNote')}</span>
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <Button onClick={handleBack} variant="outline" className="border-[#2d2d3a] text-white">{t('common.back')}</Button>
                <Button onClick={handleNext} className="bg-teal-500 hover:bg-teal-600">{t('common.continue')} <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 9 — Review & Launch
        ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 9 && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-400" />{t('onboarding.review.title')}</CardTitle>
              <CardDescription className="text-[#9ca3af]">{t('onboarding.review.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">

                {/* Role summary */}
                {selectedUserRole && (
                  <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="w-4 h-4 text-teal-400" />
                      <h4 className="text-white font-medium">Your role</h4>
                    </div>
                    <p className="text-sm text-white">{selectedUserRole.label}</p>
                    {!isOwner && formData.ownerEmail && (
                      <p className="text-xs text-[#9ca3af] mt-1">
                        Welcome email will be sent to the owner at <strong className="text-white">{formData.ownerEmail}</strong>
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-teal-400" /><h4 className="text-white font-medium">{t('onboarding.review.businessDetails')}</h4></div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-[#9ca3af]">{t('common.name')}:</span><span className="text-white">{formData.businessName}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">{t('onboarding.businessInfo.businessType')}:</span><span className="text-white">{BUSINESS_TYPES.find(bt => bt.value === formData.businessType)?.label}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">{t('common.address')}:</span><span className="text-white">{formData.address}</span></div>
                  </div>
                </div>

                <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><Store className="w-4 h-4 text-cyan-400" /><h4 className="text-white font-medium">{t('nav.branches')} ({formData.branches.filter(b => b.name && b.location).length})</h4></div>
                  <div className="space-y-1 text-sm">
                    {formData.branches.filter(b => b.name && b.location).map((branch, i) => (
                      <div key={i} className="text-white">• {branch.name} - {branch.location}</div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-cyan-400" /><h4 className="text-white font-medium">{t('onboarding.pos.title')}</h4></div>
                  <p className="text-sm text-white">{POS_TYPES.find(p => p.value === formData.posType)?.label}</p>
                </div>

                <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><Gift className="w-4 h-4 text-pink-400" /><h4 className="text-white font-medium">{t('onboarding.rewards.title')}</h4></div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-[#9ca3af]">{t('common.name')}:</span><span className="text-white">{selectedReward?.label}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">{t('onboarding.rewards.pointsName')}:</span><span className="text-white">{formData.pointsName}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">{t('onboarding.rewards.rewardRate')}:</span><span className="text-white">x {formData.rewardRate}</span></div>
                    <div className="flex justify-between"><span className="text-[#9ca3af]">{t('onboarding.rewards.welcomeBonus')}:</span><span className="text-white">x {formData.welcomeBonus}</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <Sparkles className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-green-400">
                    <p className="font-medium mb-1">{t('onboarding.review.readyToLaunch')}</p>
                    <p>{t('onboarding.review.readyDesc')}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button onClick={handleBack} variant="outline" className="border-[#2d2d3a] text-white">{t('common.back')}</Button>
                <Button
                  onClick={async () => {
                    try { await completeSetup(); }
                    catch (error) { setLoading(false); toast.error('Setup error: ' + (error?.message || String(error))); }
                  }}
                  disabled={loading}
                  className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" />{t('onboarding.review.creating')}</>
                  ) : (
                    <><Rocket className="w-4 h-4 ml-2" />{t('onboarding.review.launchButton')}</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-[#9ca3af] text-sm">
            {t('onboarding.needHelp')}{' '}
            <a href="#" className="text-teal-400 hover:text-teal-300 font-medium">{t('onboarding.contactSupport')}</a>
          </p>
        </div>

      </div>
    </div>
  );
}