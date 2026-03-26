import { useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { ROLES, CAPABILITIES, getRoleCapabilities, getPrimaryRole, PAGE_CAPABILITIES } from './permissionsConfig';
import { ADMIN_EMAILS } from '@/components/constants/adminConfig';

/**
 * Permissions hook - provides role and capability checking
 *
 * IMPORTANT SECURITY DISTINCTION:
 *   - isSystemAdmin: includes ADMIN_EMAILS list — for UI/nav rendering ONLY.
 *     ADMIN_EMAILS is a client-side convenience list. It does NOT grant backend privileges.
 *     Backend functions must NEVER rely on this — they must check user.role server-side.
 *   - isVerifiedAdmin: based solely on user.role === 'admin' | 'super_admin' from the auth provider.
 *     Use this for any data/logic decisions in the frontend (e.g. showing sensitive data).
 *
 * Usage:
 *   const { hasCapability, hasRole, canAccessPage, isSystemAdmin, isVerifiedAdmin } = usePermissions();
 */
export function usePermissions() {
  const { user } = useAuth();

  const userRoles = useMemo(() => {
    if (!user) return [];
    const roles = [];

    // isSystemAdmin role: includes ADMIN_EMAILS for UI/nav rendering convenience ONLY.
    // ⚠️  ADMIN_EMAILS is CLIENT-SIDE ONLY — NOT a substitute for backend role verification.
    // Backend functions must independently verify user.role from the auth token.
    if (user.role === 'admin' || user.role === 'super_admin' || ADMIN_EMAILS.includes(user?.email)) {
      roles.push(ROLES.SYSTEM_ADMIN);
    }

    // Add role from user_role field (for company/branch roles)
    if (user.user_role) {
      roles.push(user.user_role);
    }

    // Fallback: if user has company/branch access but no explicit role, assume company admin
    if (roles.length === 0 && user.company_id) {
      roles.push(ROLES.COMPANY_ADMIN);
    }

    return roles;
  }, [user]);

  const capabilities = useMemo(() => {
    if (!userRoles.length) return [];
    const allCapabilities = new Set();
    userRoles.forEach(role => {
      const roleCaps = getRoleCapabilities(role);
      roleCaps.forEach(cap => allCapabilities.add(cap));
    });
    return Array.from(allCapabilities);
  }, [userRoles]);

  const hasCapability = (capability) => capabilities.includes(capability);
  const hasRole = (role) => userRoles.includes(role);
  const hasAnyRole = (roles) => roles.some(role => userRoles.includes(role));

  const canAccessPage = (pageName) => {
    const requiredCapabilities = PAGE_CAPABILITIES[pageName];
    if (!requiredCapabilities || requiredCapabilities.length === 0) return true;
    return requiredCapabilities.some(cap => hasCapability(cap));
  };

  const filterNavigationItems = (navItems) => navItems.filter(item => canAccessPage(item.page));

  const primaryRole = useMemo(() => getPrimaryRole(userRoles), [userRoles]);

  // UI + ADMIN_EMAILS: for nav rendering only
  const isSystemAdmin = hasRole(ROLES.SYSTEM_ADMIN);
  // Server role only: use for logic/data decisions
  const isVerifiedAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const isCompanyAdmin = hasRole(ROLES.COMPANY_ADMIN);
  const isBranchManager = hasRole(ROLES.BRANCH_MANAGER);
  const isBranchUser = hasRole(ROLES.BRANCH_USER);

  return {
    userRoles,
    primaryRole,
    capabilities,
    hasCapability,
    hasRole,
    hasAnyRole,
    // isSystemAdmin: UI/nav only (includes ADMIN_EMAILS)
    isSystemAdmin,
    // isVerifiedAdmin: server role only — use for logic/data decisions
    isVerifiedAdmin,
    isCompanyAdmin,
    isBranchManager,
    isBranchUser,
    canAccessPage,
    filterNavigationItems,
    ROLES,
    CAPABILITIES,
  };
}