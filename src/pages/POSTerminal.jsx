import React, { useState, useEffect, useMemo } from 'react';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CashierPINEntry from '@/components/pos/CashierPINEntry';
import AmountKeypad from '@/components/pos/AmountKeypad';
import CustomerIdentifier from '@/components/pos/CustomerIdentifier';
import { offlineQueue } from '@/components/pos/OfflineQueueManager';
import { 
  Wifi, 
  WifiOff, 
  User, 
  LogOut, 
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Wrench,
  Building2,
  MapPin,
  ShieldAlert,
  Copy,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function POSTerminal() {
  const { 
    primaryCompanyId, 
    permissions, 
    isSystemAdmin, 
    loading: permissionsLoading 
  } = useUserPermissions();
  
  const queryClient = useQueryClient();
  const [cashier, setCashier] = useState(null);
  const [cashierSession, setCashierSession] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [amount, setAmount] = useState('');
  const [customer, setCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [queueStats, setQueueStats] = useState({ total: 0, pending: 0, failed: 0 });
  const [diagnosticError, setDiagnosticError] = useState(null);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [lastProof, setLastProof] = useState(null);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  
  // Multi-tenant selection state
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  // Get permitted companies for this user
  const permittedCompanyIds = useMemo(() => {
    if (isSystemAdmin) return null;
    return permissions
      .filter(p => p.is_active && p.company_id)
      .map(p => p.company_id);
  }, [permissions, isSystemAdmin]);

  // For Admin: Get all companies
  const { data: allCompanies = [], isLoading: allCompaniesLoading } = useQuery({
    queryKey: ['all-companies-pos'],
    queryFn: () => base44.entities.Company.list('-created_date'),
    enabled: isSystemAdmin,
  });

  // For Business/Agent: Get only permitted companies
  const { data: permittedCompanies = [], isLoading: permittedCompaniesLoading } = useQuery({
    queryKey: ['permitted-companies', permittedCompanyIds],
    queryFn: async () => {
      if (!permittedCompanyIds || permittedCompanyIds.length === 0) return [];
      const companies = await base44.entities.Company.list();
      return companies.filter(c => permittedCompanyIds.includes(c.id));
    },
    enabled: !isSystemAdmin && permittedCompanyIds?.length > 0,
  });

  const availableCompanies = isSystemAdmin ? allCompanies : permittedCompanies;
  const companiesLoading = isSystemAdmin ? allCompaniesLoading : permittedCompaniesLoading;

  const effectiveCompanyId = useMemo(() => {
    if (selectedCompanyId) return selectedCompanyId;
    if (primaryCompanyId) return primaryCompanyId;
    if (availableCompanies.length > 0) return availableCompanies[0].id;
    return null;
  }, [selectedCompanyId, primaryCompanyId, availableCompanies]);

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches', effectiveCompanyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: effectiveCompanyId }),
    enabled: !!effectiveCompanyId
  });

  const availableBranches = useMemo(() => {
    if (isSystemAdmin) return branches;
    
    const permittedBranchIds = permissions
      .filter(p => p.is_active && p.company_id === effectiveCompanyId && p.branch_id)
      .map(p => p.branch_id);
    
    const hasCompanyLevelPermission = permissions.some(
      p => p.is_active && p.company_id === effectiveCompanyId && !p.branch_id
    );
    
    if (hasCompanyLevelPermission || permittedBranchIds.length === 0) {
      return branches;
    }
    
    return branches.filter(b => permittedBranchIds.includes(b.id));
  }, [branches, permissions, effectiveCompanyId, isSystemAdmin]);

  const effectiveBranchId = useMemo(() => {
    if (selectedBranchId) {
      const isValid = availableBranches.some(b => b.id === selectedBranchId);
      return isValid ? selectedBranchId : null;
    }
    if (availableBranches.length > 0) return availableBranches[0].id;
    return null;
  }, [selectedBranchId, availableBranches]);

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company-for-pos', effectiveCompanyId],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: effectiveCompanyId });
      return companies[0];
    },
    enabled: !!effectiveCompanyId,
    staleTime: 10_000
  });

  const { data: companyToken, isLoading: tokenLoading } = useQuery({
    queryKey: ['companyToken', effectiveCompanyId],
    queryFn: async () => {
      const tokens = await base44.entities.CompanyToken.filter({ company_id: effectiveCompanyId });
      return tokens[0];
    },
    enabled: !!effectiveCompanyId,
    staleTime: 10_000
  });

  const { data: recentTransactions = [] } = useQuery({
    queryKey: ['recentTransactions', effectiveCompanyId, effectiveBranchId],
    queryFn: () => base44.entities.Transaction.filter(
      { company_id: effectiveCompanyId, branch_id: effectiveBranchId },
      '-created_date',
      5
    ),
    enabled: !!effectiveCompanyId && !!effectiveBranchId,
    refetchInterval: 5000
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    const handleCompanySettingsChanged = () => {
      queryClient.invalidateQueries({ queryKey: ['company-for-pos'] });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('companySettingsChanged', handleCompanySettingsChanged);
    
    const interval = setInterval(() => {
      setQueueStats(offlineQueue.getStats());
    }, 1000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('companySettingsChanged', handleCompanySettingsChanged);
      clearInterval(interval);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!selectedCompanyId && availableCompanies.length > 0) {
      const preferred = primaryCompanyId && availableCompanies.some(c => c.id === primaryCompanyId)
        ? primaryCompanyId
        : availableCompanies[0].id;
      setSelectedCompanyId(preferred);
    }
  }, [availableCompanies, selectedCompanyId, primaryCompanyId]);

  useEffect(() => {
    if (isSystemAdmin && selectedCompanyId) {
      const stored = localStorage.getItem('selected_company_id');
      if (stored !== selectedCompanyId) {
        localStorage.setItem('selected_company_id', selectedCompanyId);
        window.dispatchEvent(new CustomEvent('companyChanged', { detail: { companyId: selectedCompanyId } }));
      }
    }
  }, [selectedCompanyId, isSystemAdmin]);

  useEffect(() => {
    if (!selectedBranchId && availableBranches.length > 0) {
      setSelectedBranchId(availableBranches[0].id);
    }
    if (selectedBranchId && !availableBranches.some(b => b.id === selectedBranchId)) {
      setSelectedBranchId(availableBranches[0]?.id || null);
    }
  }, [availableBranches, selectedBranchId]);

  useEffect(() => {
    if (permissionsLoading || companiesLoading) return;

    if (!isSystemAdmin && (!permissions || permissions.length === 0)) {
      setDiagnosticError({
        type: 'no_permission',
        message: 'You do not have any active company permissions. Please contact your administrator.',
        canFix: false,
        details: 'Your user account is not assigned to any company or branch.'
      });
      return;
    }

    if (availableCompanies.length === 0 && !companiesLoading) {
      setDiagnosticError({
        type: 'no_company',
        message: 'No company assigned to your account',
        canFix: isSystemAdmin,
        details: isSystemAdmin 
          ? 'No companies exist in the system. Run diagnostics to create one.'
          : 'Your permissions do not include any active companies.'
      });
      return;
    }

    if (effectiveCompanyId && availableBranches.length === 0 && !branchesLoading) {
      setDiagnosticError({
        type: 'no_branch',
        message: 'No branch configured for this company',
        canFix: isSystemAdmin,
        details: 'At least one branch is required to process POS transactions.'
      });
      return;
    }

    if (effectiveCompanyId && !tokenLoading && !companyToken && !branchesLoading) {
      setDiagnosticError({
        type: 'no_token',
        message: 'Company token not configured',
        canFix: isSystemAdmin,
        details: 'A reward token must be configured before processing transactions.'
      });
      return;
    }

    setDiagnosticError(null);
  }, [
    permissionsLoading, 
    companiesLoading, 
    branchesLoading, 
    tokenLoading,
    permissions, 
    availableCompanies, 
    availableBranches, 
    effectiveCompanyId, 
    companyToken, 
    isSystemAdmin
  ]);

  const syncOfflineQueue = async () => {
    if (!effectiveCompanyId || !effectiveBranchId) {
      console.warn('Cannot sync offline queue: missing company or branch ID');
      return;
    }

    const pending = offlineQueue.getPendingTransactions();
    if (pending.length === 0) return;

    for (const txn of pending) {
      try {
        await base44.functions.invoke('createPOSTransaction', {
          phone: txn.phone,
          amount: txn.amount,
          order_id: txn.order_id,
          company_id: effectiveCompanyId,
          branch_id: effectiveBranchId
        });
        offlineQueue.markAsSynced(txn.id);
        toast.success(`✅ Synced: ${txn.phone}`);
      } catch (error) {
        offlineQueue.markAsFailed(txn.id, error);
      }
    }
  };

  const handleCharge = async () => {
    if (!customer) {
      setShowCustomerModal(true);
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!effectiveCompanyId) {
      toast.error('No company selected. Please select a company first.');
      return;
    }

    if (!effectiveBranchId) {
      toast.error('No branch selected. Please select a branch first.');
      return;
    }

    console.log('🔵 POS Transaction Starting', { 
      phone: customer.phone, 
      amount: amountValue, 
      companyId: effectiveCompanyId,
      branchId: effectiveBranchId,
      isSystemAdmin,
      permissionsCount: permissions?.length || 0
    });

    setProcessing(true);

    try {
      const orderId = `ORD-${Date.now()}`;
      const finalAmount = appliedCoupon ? calculateDiscountedAmount() : amountValue;
      
      if (!isOnline) {
        const txnId = offlineQueue.addToQueue({
          phone: customer.phone,
          amount: finalAmount,
          order_id: orderId,
          cashier_id: cashier?.pin,
          company_id: effectiveCompanyId,
          branch_id: effectiveBranchId
        });
        
        toast.success('💾 Saved offline - will sync when online');
        resetCheckout();
        return;
      }

      const result = await base44.functions.invoke('createPOSTransaction', {
        phone: customer.phone,
        amount: finalAmount,
        order_id: orderId,
        company_id: effectiveCompanyId,
        branch_id: effectiveBranchId,
        reward_type: 'token',
        coupon_code: appliedCoupon?.code
      });

      if (result.data && result.data.success) {
        queryClient.invalidateQueries({ queryKey: ['transactions', effectiveCompanyId] });
        queryClient.invalidateQueries({ queryKey: ['recentTransactions', effectiveCompanyId, effectiveBranchId] });
        
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });

        if (result.data.receipt_hash) {
          setLastProof({
            receipt_hash: result.data.receipt_hash,
            receipt_id: result.data.receipt_id,
            anchor_status: 'unanchored',
            anchor_tx_hash: null
          });
        }

        toast.success(`✅ ${result.data.tokens} tokens earned!`);
        resetCheckout();
      } else {
        const errorMessage = result.data?.error || 'Transaction failed';
        
        if (result.data?.code === 'PERMISSION_DENIED' || result.data?.code === 'FORBIDDEN') {
          toast.error('Permission denied: You are not authorized for this company/branch');
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.error('❌ Transaction error:', error);
      
      if (error.response?.status === 400) {
        toast.error('Invalid request: ' + (error.response?.data?.error || 'Missing required fields'));
      } else if (error.response?.status === 403) {
        toast.error('Permission denied: You are not authorized to transact for this company/branch');
      } else {
        toast.error('Transaction failed: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setProcessing(false);
    }
  };

  const resetCheckout = () => {
    setAmount('');
    setCustomer(null);
    setProcessing(false);
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Enter a coupon code');
      return;
    }

    setCouponValidating(true);
    setCouponError(null);
    
    try {
      const coupons = await base44.entities.Coupon.filter({
        company_id: effectiveCompanyId,
        coupon_code: couponCode.toUpperCase()
      });

      if (!coupons || coupons.length === 0) {
        setCouponError('Coupon not found');
        return;
      }

      const coupon = coupons[0];
      
      if (coupon.status !== 'active') {
        setCouponError(`Coupon is ${coupon.status}`);
        return;
      }

      const now = new Date();
      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        setCouponError('Coupon has expired');
        return;
      }

      if (coupon.times_used >= coupon.max_uses) {
        setCouponError('Coupon has been used');
        return;
      }

      const amountValue = parseFloat(amount);
      if (coupon.min_purchase_amount && amountValue < coupon.min_purchase_amount) {
        setCouponError(`Minimum purchase: $${coupon.min_purchase_amount}`);
        return;
      }

      setAppliedCoupon(coupon);
      toast.success('✅ Coupon applied');
    } catch (error) {
      setCouponError('Failed to validate coupon');
    } finally {
      setCouponValidating(false);
    }
  };

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      const result = await base44.functions.invoke('diagnoseAndFixPOS', {});
      
      if (result.data.success) {
        toast.success(result.data.message);
        
        if (result.data.fixes.length > 0) {
          setTimeout(() => {
            toast.info(result.data.fixes.join('\n'), { duration: 5000 });
          }, 500);
        }
        
        queryClient.invalidateQueries({ queryKey: ['branches'] });
        queryClient.invalidateQueries({ queryKey: ['companyToken'] });
        queryClient.invalidateQueries({ queryKey: ['all-companies-pos'] });
        queryClient.invalidateQueries({ queryKey: ['permitted-companies'] });
        
        if (result.data.company_id) {
          localStorage.setItem('selected_company_id', result.data.company_id);
          window.location.reload();
        }
      } else {
        toast.error('Diagnostics failed: ' + result.data.error);
      }
    } catch (error) {
      toast.error('Failed to run diagnostics: ' + error.message);
    } finally {
      setRunningDiagnostics(false);
    }
  };

  if (permissionsLoading || companiesLoading) {
    return (
      <div className="min-h-screen bg-[#17171f] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400 mx-auto mb-4" />
          <p className="text-[#9ca3af]">Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (!isSystemAdmin && (!permissions || permissions.length === 0)) {
    return (
      <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#1f2128] border-red-500/50">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-[#9ca3af] mb-4">
              You do not have permission to access the POS terminal. 
              Please contact your administrator to be assigned to a company and branch.
            </p>
            <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-4 text-left">
              <h4 className="text-red-400 font-medium text-sm mb-2">Debug Info:</h4>
              <ul className="text-xs text-red-300 space-y-1">
                <li>• User Role: {isSystemAdmin ? 'Admin' : 'Business/Agent'}</li>
                <li>• Active Permissions: {permissions?.length || 0}</li>
                <li>• Primary Company ID: {primaryCompanyId || 'None'}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!cashierSession) {
    if (!effectiveCompanyId || !effectiveBranchId || branchesLoading || companiesLoading) {
      return (
        <div className="min-h-screen bg-[#17171f] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400 mx-auto mb-4" />
            <p className="text-[#9ca3af]">Loading terminal configuration...</p>
          </div>
        </div>
      );
    }
    return (
      <CashierPINEntry
        company_id={effectiveCompanyId}
        branch_id={effectiveBranchId}
        terminal_id="pos-terminal-1"
        onSessionStart={(session) => {
          setCashierSession(session);
          setCashier({ name: session.cashier_name });
        }}
      />
    );
  }

  const currentCompany = availableCompanies.find(c => c.id === effectiveCompanyId);
  const currentBranch = availableBranches.find(b => b.id === effectiveBranchId);

  const canSubmit = !!effectiveCompanyId && !!effectiveBranchId && !processing && !diagnosticError;

  const calculateDiscountedAmount = () => {
    const baseAmount = parseFloat(amount);
    if (!appliedCoupon) return baseAmount;
    
    let discount = 0;
    if (appliedCoupon.discount_type === 'percentage') {
      discount = (baseAmount * appliedCoupon.discount_value) / 100;
    } else {
      discount = appliedCoupon.discount_value;
    }
    return Math.max(0, baseAmount - discount);
  };

  const getCurrencySymbol = () => {
    const curr = company?.pos_currency || localStorage.getItem('dashboard_currency') || 'ILS';
    const symbols = { ILS: '₪', USD: '$', EUR: '€' };
    return symbols[curr] || '₪';
  };

  const chargeButtonText = () => {
    const baseAmount = parseFloat(amount) || 0;
    const symbol = getCurrencySymbol();
    if (!appliedCoupon) return `Charge ${symbol}${baseAmount.toFixed(2)}`;
    
    const discounted = calculateDiscountedAmount();
    let discountText = '';
    if (appliedCoupon.discount_type === 'percentage') {
      discountText = `-${appliedCoupon.discount_value}%`;
    } else {
      discountText = `-${symbol}${appliedCoupon.discount_value}`;
    }
    return `Charge ${symbol}${discounted.toFixed(2)} (${discountText})`;
  };

  return (
    <div className="min-h-screen bg-[#17171f] flex">
      <div className="flex-1 p-4 flex flex-col">
        {(availableCompanies.length > 1 || availableBranches.length > 1) && (
          <div className="mb-4 bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4">
            <div className="flex items-center gap-4 flex-wrap">
              {availableCompanies.length > 1 && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#9ca3af]" />
                  <Select 
                    value={effectiveCompanyId || ''} 
                    onValueChange={(value) => {
                      setSelectedCompanyId(value);
                      setSelectedBranchId(null);
                    }}
                  >
                    <SelectTrigger className="w-[200px] bg-[#17171f] border-[#2d2d3a] text-white">
                      <SelectValue placeholder="Select Company" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCompanies.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {availableBranches.length > 1 && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#9ca3af]" />
                  <Select 
                    value={effectiveBranchId || ''} 
                    onValueChange={setSelectedBranchId}
                    disabled={!effectiveCompanyId}
                  >
                    <SelectTrigger className="w-[200px] bg-[#17171f] border-[#2d2d3a] text-white">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBranches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {availableCompanies.length === 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-teal-400" />
                  <span className="text-white font-medium">{currentCompany?.name}</span>
                </div>
              )}
              {availableBranches.length === 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-teal-400" />
                  <span className="text-white font-medium">{currentBranch?.name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {diagnosticError && (
          <div className="mb-4 bg-red-950/30 border border-red-500/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-white font-semibold">{diagnosticError.message}</h3>
                {diagnosticError.details && (
                  <p className="text-red-300 text-sm mt-1">{diagnosticError.details}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {diagnosticError.type === 'no_token' && (
                  <Button
                    onClick={() => window.location.href = createPageUrl('CompanyRepairTool')}
                    className="bg-amber-500 hover:bg-amber-600 gap-2"
                  >
                    <Wrench className="w-4 h-4" />
                    Fix Setup
                  </Button>
                )}
                {diagnosticError.canFix && diagnosticError.type !== 'no_token' && (
                  <Button
                    onClick={runDiagnostics}
                    disabled={runningDiagnostics}
                    className="bg-red-500 hover:bg-red-600 gap-2"
                  >
                    {runningDiagnostics ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        <Wrench className="w-4 h-4" />
                        Run Diagnostics
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {(!effectiveCompanyId || !effectiveBranchId) && !diagnosticError && (
          <div className="mb-4 bg-yellow-950/30 border border-yellow-500/50 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <div>
              <h3 className="text-yellow-400 font-semibold">Selection Required</h3>
              <p className="text-yellow-300 text-sm">
                {!effectiveCompanyId 
                  ? 'Please select a company to continue' 
                  : 'Please select a branch to continue'}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4 bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <Badge className={isOnline ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            
            {queueStats.pending > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                {queueStats.pending} pending sync
              </Badge>
            )}

            {availableCompanies.length === 1 && availableBranches.length === 1 && (
              <div className="text-sm text-[#9ca3af]">
                {currentCompany?.name} • {currentBranch?.name}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-teal-400" />
              <span className="text-white font-medium">{cashier.name}</span>
            </div>
            <Button
              onClick={async () => {
                if (cashierSession?.cashier_session_id) {
                  await base44.functions.invoke('endCashierSession', {
                    cashier_session_id: cashierSession.cashier_session_id
                  }).catch(() => {});
                }
                setCashier(null);
                setCashierSession(null);
              }}
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1 lg:col-span-2">
            <Card className="bg-[#1f2128] border-[#2d2d3a] h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Enter Amount</h2>
                  <div className="text-sm text-slate-400">Currency: <span className="text-teal-400 font-semibold">{company?.pos_currency || 'ILS'}</span></div>
                </div>
                <AmountKeypad
                  amount={amount}
                  onAmountChange={setAmount}
                  onCharge={handleCharge}
                  disabled={processing || !canSubmit}
                  chargeButtonText={chargeButtonText()}
                  currencySymbol={getCurrencySymbol()}
                />

                <div className="mt-6 bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
                  <button 
                    onClick={() => setCouponCode(appliedCoupon ? '' : couponCode)}
                    className="flex items-center gap-2 w-full text-white font-medium mb-3 hover:text-teal-400 transition-colors"
                  >
                    <span>🎟️ Apply Coupon</span>
                    <span className="text-xs text-[#9ca3af]">{appliedCoupon ? '✓' : ''}</span>
                  </button>

                  {!appliedCoupon && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter coupon code..."
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && validateCoupon()}
                        className="flex-1 px-3 py-2 bg-[#1f2128] border border-[#2d2d3a] rounded text-white text-sm"
                        disabled={couponValidating}
                      />
                      <Button
                        onClick={validateCoupon}
                        disabled={couponValidating || !couponCode.trim()}
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        {couponValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  )}

                  {couponError && (
                    <div className="text-red-400 text-sm mt-2">{couponError}</div>
                  )}

                  {appliedCoupon && (
                    <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-green-400 font-medium text-sm">✅ Coupon Applied</span>
                        <button
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponCode('');
                          }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="text-white text-sm">{appliedCoupon.code}</div>
                      <div className="text-green-300 text-xs mt-1">
                        {appliedCoupon.discount_type === 'percentage' 
                          ? `${appliedCoupon.discount_value}% off`
                          : `$${appliedCoupon.discount_value} off`}
                      </div>
                    </div>
                  )}
                </div>

                {!canSubmit && !processing && (
                  <div className="mt-4 text-center text-yellow-400 text-sm">
                    {!effectiveCompanyId ? 'Select a company to continue' : 
                     !effectiveBranchId ? 'Select a branch to continue' :
                     diagnosticError ? diagnosticError.message : 'Cannot process transaction'}
                  </div>
                )}

                {customer && (
                  <div className="mt-6 bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                          <div className="text-white font-medium">{customer.full_name || customer.phone}</div>
                          <div className="text-xs text-teal-400">Balance: {customer.current_balance || 0} tokens</div>
                        </div>
                      </div>
                      <Button
                        onClick={() => setCustomer(null)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                )}

                {!customer && (
                  <Button
                    onClick={() => setShowCustomerModal(true)}
                    className="w-full mt-6 h-14 text-lg bg-cyan-500 hover:bg-cyan-600"
                    disabled={!canSubmit}
                  >
                    Select Customer
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-1 lg:col-span-1">
            <Card className="bg-[#1f2128] border-[#2d2d3a] h-full">
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#9ca3af]" />
                  Recent
                </h3>
                <div className="space-y-2">
                  {recentTransactions.length === 0 && (
                    <p className="text-[#9ca3af] text-sm text-center py-8">No recent transactions</p>
                  )}
                  {recentTransactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm font-medium">{getCurrencySymbol()}{txn.amount}</span>
                        {txn.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : txn.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                        )}
                      </div>
                      <div className="text-xs text-[#9ca3af]">{txn.client_phone}</div>
                      <div className="text-xs text-teal-400 mt-1">+{txn.tokens_expected} tokens</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {lastProof && lastProof.receipt_hash && (
        <div className="mx-4 mb-4 bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white">On-Chain Proof</h3>
            {lastProof.anchor_status === 'anchored' ? (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Anchored</span>
            ) : (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending Anchor</span>
            )}
          </div>

          <div className="flex items-center gap-2 bg-[#17171f] rounded-lg px-3 py-2 mb-2">
            <code className="text-xs text-teal-300 flex-1 font-mono truncate">
              {lastProof.receipt_hash.slice(0, 10)}...{lastProof.receipt_hash.slice(-8)}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(lastProof.receipt_hash);
                toast.success('Hash copied!');
              }}
              className="text-[#9ca3af] hover:text-white transition-colors flex-shrink-0"
              title="Copy full hash"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {lastProof.anchor_tx_hash && (
            <a
              href={`https://${(Deno?.env?.get?.('MOOD_ENV') || 'dev') === 'prod' ? 'snowtrace.io' : 'testnet.snowtrace.io'}/tx/${lastProof.anchor_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors mb-2"
            >
              <ExternalLink className="w-3 h-3" />
              View on Snowtrace
            </a>
          )}

          <p className="text-xs text-[#6b7280]">
            This receipt is cryptographically committed and will be anchored to Avalanche blockchain.
          </p>
        </div>
      )}

      {showCustomerModal && effectiveCompanyId && (
        <CustomerIdentifier
          companyId={effectiveCompanyId}
          onCustomerSelected={(c) => {
            setCustomer(c);
            setShowCustomerModal(false);
          }}
          onCancel={() => setShowCustomerModal(false)}
        />
      )}
    </div>
  );
}