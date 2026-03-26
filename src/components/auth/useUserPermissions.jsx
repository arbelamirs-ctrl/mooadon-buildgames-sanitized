import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/permissions/usePermissions';

export function useUserPermissions() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['userPermissions', user?.id],
    queryFn: () => base44.entities.UserPermission.filter({ 
      user_id: user.id,
      is_active: true 
    }),
    enabled: !!user?.id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const {
    isSystemAdmin,
    isCompanyAdmin,
    isBranchManager,
    isBranchUser,
    hasCapability,
    hasRole,
    primaryRole,
    CAPABILITIES,
    ROLES
  } = usePermissions();
  
  const [adminCompanyId, setAdminCompanyId] = useState(() => {
    return localStorage.getItem('selected_company_id') || null;
  });
  
  const { data: allCompanies = [], isLoading: allCompaniesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date'),
    enabled: isSystemAdmin,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  
  const { data: userCompany, isLoading: userCompanyLoading } = useQuery({
    queryKey: ['userCompany', user?.id, permissions.map(p => p.company_id).join(',')],
    queryFn: async () => {
      if (permissions.length === 0) return null;

      // Pass 1: find a completed company across all active permissions
      for (const perm of permissions) {
        if (!perm.is_active || !perm.company_id) continue;
        const companies = await base44.entities.Company.filter({ id: perm.company_id });
        if (companies.length > 0 && (companies[0].onboarding_completed === true || companies[0].setup_status === 'ready')) {
          return companies[0];
        }
      }

      // Pass 2: fallback – return the first available company from any active permission
      for (const perm of permissions) {
        if (!perm.is_active || !perm.company_id) continue;
        const companies = await base44.entities.Company.filter({ id: perm.company_id });
        if (companies.length > 0) return companies[0];
      }

      return null;
    },
    enabled: !isSystemAdmin && !!user && permissions.length > 0,
    retry: 3,
    retryDelay: 500,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  
  // Auto-select first company for admin if none selected
  useEffect(() => {
    if (!isSystemAdmin || allCompaniesLoading || allCompanies.length === 0) return;
    
    const stored = localStorage.getItem('selected_company_id');
    
    if (stored) {
      const exists = allCompanies.some(c => c.id === stored);
      if (exists) {
        if (adminCompanyId !== stored) setAdminCompanyId(stored);
      } else {
        localStorage.removeItem('selected_company_id');
        const firstId = allCompanies[0].id;
        setAdminCompanyId(firstId);
        localStorage.setItem('selected_company_id', firstId);
      }
    } else if (!adminCompanyId) {
      const firstId = allCompanies[0].id;
      setAdminCompanyId(firstId);
      localStorage.setItem('selected_company_id', firstId);
    }
  }, [isSystemAdmin, allCompanies, allCompaniesLoading]);
  
  // Listen for company selection changes
  useEffect(() => {
    if (!isSystemAdmin) return;
    
    const handleCompanyChanged = (event) => {
      const newCompanyId = event.detail?.companyId;
      if (newCompanyId && newCompanyId !== adminCompanyId) {
        setAdminCompanyId(newCompanyId);
        queryClient.invalidateQueries({ queryKey: ['company'] });
        queryClient.invalidateQueries({ queryKey: ['companyToken'] });
      }
    };
    
    const handleStorageChange = (event) => {
      if (event.key === 'selected_company_id' && event.newValue && event.newValue !== adminCompanyId) {
        setAdminCompanyId(event.newValue);
      }
    };
    
    window.addEventListener('companyChanged', handleCompanyChanged);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('companyChanged', handleCompanyChanged);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isSystemAdmin, adminCompanyId, queryClient]);
  
  const primaryPermission = permissions[0];
  const primaryCompanyId = isSystemAdmin ? adminCompanyId : userCompany?.id;

  const setSelectedCompany = useCallback((companyId) => {
    if (!isSystemAdmin) return;
    localStorage.setItem('selected_company_id', companyId);
    setAdminCompanyId(companyId);
    window.dispatchEvent(new CustomEvent('companyChanged', { detail: { companyId } }));
    queryClient.invalidateQueries({ queryKey: ['company'] });
    queryClient.invalidateQueries({ queryKey: ['companyToken'] });
  }, [isSystemAdmin, queryClient]);

  const permittedCompanyIds = useMemo(() => {
    if (isSystemAdmin) return null;
    const companyIds = new Set();
    permissions.forEach(p => { if (p.is_active && p.company_id) companyIds.add(p.company_id); });
    return Array.from(companyIds);
  }, [permissions, isSystemAdmin]);

  const permittedBranchIds = useMemo(() => {
    if (isSystemAdmin) return null;
    const branchIds = new Set();
    permissions.forEach(p => { if (p.is_active && p.branch_id) branchIds.add(p.branch_id); });
    return Array.from(branchIds);
  }, [permissions, isSystemAdmin]);

  const primaryBranchId = useMemo(() => {
    if (isSystemAdmin) return null;
    if (!primaryCompanyId) return null;
    const companyPermission = permissions.find(
      p => p.is_active && p.company_id === primaryCompanyId && p.branch_id
    );
    return companyPermission?.branch_id || null;
  }, [permissions, primaryCompanyId, isSystemAdmin]);

  const getPermittedBranchesForCompany = (companyId) => {
    if (isSystemAdmin) return null;
    if (!companyId) return [];
    const branchIds = [];
    permissions.forEach(p => {
      if (p.is_active && p.company_id === companyId && p.branch_id) branchIds.push(p.branch_id);
    });
    if (branchIds.length === 0) {
      const hasCompanyAccess = permissions.some(p => p.is_active && p.company_id === companyId && !p.branch_id);
      if (hasCompanyAccess) return null;
    }
    return branchIds;
  };

  const hasCompanyPermission = (companyId) => {
    if (isSystemAdmin) return true;
    if (!companyId) return false;
    return permissions.some(p => p.is_active && p.company_id === companyId);
  };

  const hasBranchPermission = (companyId, branchId) => {
    if (isSystemAdmin) return true;
    if (!companyId || !branchId) return false;
    const hasBranchAccess = permissions.some(p => p.is_active && p.company_id === companyId && p.branch_id === branchId);
    if (hasBranchAccess) return true;
    return permissions.some(p => p.is_active && p.company_id === companyId && !p.branch_id);
  };

  return {
    user,
    permissions,
    primaryCompanyId,
    primaryBranchId,
    primaryPermission,
    permittedCompanyIds,
    permittedBranchIds,
    isSystemAdmin,
    isCompanyAdmin,
    isBranchUser,
    isBranchManager,
    hasCapability,
    hasRole,
    primaryRole,
    CAPABILITIES,
    ROLES,
    getPermittedBranchesForCompany,
    hasCompanyPermission,
    hasBranchPermission,
    setSelectedCompany,
    allCompanies: isSystemAdmin ? allCompanies : [],
    loading: loading || permissionsLoading || (isSystemAdmin && allCompaniesLoading) || (!isSystemAdmin && userCompanyLoading)
  };
}