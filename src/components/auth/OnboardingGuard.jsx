import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { Loader2 } from 'lucide-react';
import { ADMIN_EMAILS, isSystemAdmin } from '@/components/constants/adminConfig';

export default function OnboardingGuard({ children }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = isSystemAdmin(user);
  const isAdminPage = location.pathname.includes('SuperAdmin') ||
    location.pathname.includes('MooadonAdmin') ||
    location.pathname.includes('Companies') ||
    location.pathname.includes('CompanyRepairTool') ||
    location.pathname.includes('AdminMintTool') ||
    location.pathname.includes('TokenManagement') ||
    location.pathname.includes('BlockchainTesting') ||
    location.pathname.includes('BlockchainTransactions') ||
    location.pathname.includes('ProductsAdmin') ||
    location.pathname.includes('AdminStoreManagement') ||
    location.pathname.includes('UserPermissionsManagement') ||
    location.pathname.includes('SettlementDashboard') ||
    location.pathname.includes('MigrationCenter') ||
    location.pathname.includes('CashPoolManagement') ||
    location.pathname.includes('LedgerEvents') ||

    location.pathname.includes('RewardQueueStatus');

  const { data: userCompany, isLoading: companiesLoading } = useQuery({
    queryKey: ['user-company-onboarding', user?.id],
    queryFn: async () => {
      const permissions = await base44.entities.UserPermission.filter({
        user_id: user.id,
        is_active: true
      });
      if (permissions.length === 0) return null;

      // Look for a completed company first, don't blindly take permissions[0]
      for (const perm of permissions) {
        const companies = await base44.entities.Company.filter({ id: perm.company_id });
        if (
          companies.length > 0 &&
          (companies[0].onboarding_completed === true || companies[0].setup_status === 'ready')
        ) {
          return companies[0];
        }
      }

      // Fallback: return the company from the first permission (still in onboarding)
      const fallback = await base44.entities.Company.filter({ id: permissions[0].company_id });
      return fallback.length > 0 ? fallback[0] : null;
    },
    enabled: !!user && !isAdmin,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    // Never act while auth is still resolving (either public settings OR user auth)
    if (isLoading) return;
    
    // Auth has fully resolved with no user — redirect to landing
    if (!user) {
      navigate(createPageUrl('LandingPage'));
      return;
    }
    
    // Block business users from admin pages
    if (isAdminPage && !isAdmin) {
      navigate(createPageUrl('AgentDashboard'));
      return;
    }
    
    // Block admin from onboarding
    if (isAdmin && location.pathname.includes('OnboardingWizard')) {
      navigate(createPageUrl('SuperAdminDashboard'));
      return;
    }
    
    // Admin - allow immediately, no company check needed
    if (isAdmin) return;
    
    // Business users — wait for company query to finish before redirecting
    if (companiesLoading) return;
    
    // If already on OnboardingWizard, don't redirect back to it — avoids loop
    const isOnOnboarding = location.pathname.includes('OnboardingWizard');
    
    if (!userCompany) {
      if (!isOnOnboarding) navigate(createPageUrl('OnboardingWizard'));
      return;
    }
    
    // Consider completed if flag is set OR if they reached the final step (step 9)
    const isCompleted = userCompany.onboarding_completed === true || userCompany.setup_status === 'ready';
    if (!isCompleted) {
      if (!isOnOnboarding) navigate(createPageUrl('OnboardingWizard'));
      return;
    }
  }, [user, userCompany, isLoading, companiesLoading, navigate, isAdmin, isAdminPage, location.pathname]);

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#10b981]" /></div>;
  }
  
  // Show spinner while company data is loading (non-admin only)
  // This prevents a flash where userCompany is undefined → guard incorrectly redirects to OnboardingWizard
  if (!isAdmin && companiesLoading && user) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#10b981]" /></div>;
  }

  if (!user) return null;
  return <>{children}</>;
}