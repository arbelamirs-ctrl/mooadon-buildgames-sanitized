/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * Roles hierarchy:
 * - systemadmin: Full system access (Mooadon platform admin)
 * - companyadmin: Company owner/manager (can manage company, branches, settings)
 * - branchmanager: Branch manager (can manage branch operations)
 * - branchuser: Cashier/employee (can only process transactions)
 */

export const ROLES = {
  SYSTEM_ADMIN: 'systemadmin',
  COMPANY_ADMIN: 'companyadmin',
  BRANCH_MANAGER: 'branchmanager',
  BRANCH_USER: 'branchuser'
};

export const CAPABILITIES = {
  // System admin capabilities
  SYSTEM_VIEW: 'system:view',
  SYSTEM_MANAGE: 'system:manage',
  ALL_COMPANIES_VIEW: 'companies:viewAll',
  
  // Company management
  COMPANY_CREATE: 'company:create',
  COMPANY_UPDATE: 'company:update',
  COMPANY_DELETE: 'company:delete',
  COMPANY_VIEW: 'company:view',
  COMPANY_SETTINGS: 'company:settings',
  
  // Branch management
  BRANCH_CREATE: 'branch:create',
  BRANCH_UPDATE: 'branch:update',
  BRANCH_DELETE: 'branch:delete',
  BRANCH_VIEW: 'branch:view',
  
  // Client/Customer management
  CLIENT_CREATE: 'client:create',
  CLIENT_UPDATE: 'client:update',
  CLIENT_DELETE: 'client:delete',
  CLIENT_VIEW: 'client:view',
  CLIENT_EXPORT: 'client:export',
  
  // Transaction management
  TRANSACTION_CREATE: 'transaction:create',
  TRANSACTION_VIEW: 'transaction:view',
  TRANSACTION_REFUND: 'transaction:refund',
  TRANSACTION_EXPORT: 'transaction:export',
  
  // POS operations
  POS_TERMINAL_ACCESS: 'pos:access',
  POS_INTEGRATION_MANAGE: 'pos:integration',
  
  // Rewards & Coupons
  REWARDS_CREATE: 'rewards:create',
  REWARDS_MANAGE: 'rewards:manage',
  REWARDS_VIEW: 'rewards:view',
  COUPON_CREATE: 'coupon:create',
  COUPON_MANAGE: 'coupon:manage',
  
  // Cash management
  CASH_POOL_VIEW: 'cash:view',
  CASH_POOL_MANAGE: 'cash:manage',
  
  // Web3 & Blockchain
  WEB3_VIEW: 'web3:view',
  WEB3_MANAGE: 'web3:manage',
  BLOCKCHAIN_TESTING: 'blockchain:testing',
  
  // Reporting & Analytics
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',
  ANALYTICS_VIEW: 'analytics:view',
  
  // Automation & Webhooks
  AUTOMATION_VIEW: 'automation:view',
  AUTOMATION_MANAGE: 'automation:manage',
  WEBHOOK_MANAGE: 'webhook:manage',
  
  // API & Integrations
  API_VIEW: 'api:view',
  API_MANAGE: 'api:manage'
};

export const ROLE_CAPABILITIES = {
  [ROLES.SYSTEM_ADMIN]: [
    // System admin has ALL capabilities
    CAPABILITIES.SYSTEM_VIEW,
    CAPABILITIES.SYSTEM_MANAGE,
    CAPABILITIES.ALL_COMPANIES_VIEW,
    CAPABILITIES.COMPANY_CREATE,
    CAPABILITIES.COMPANY_UPDATE,
    CAPABILITIES.COMPANY_DELETE,
    CAPABILITIES.COMPANY_VIEW,
    CAPABILITIES.COMPANY_SETTINGS,
    CAPABILITIES.BRANCH_CREATE,
    CAPABILITIES.BRANCH_UPDATE,
    CAPABILITIES.BRANCH_DELETE,
    CAPABILITIES.BRANCH_VIEW,
    CAPABILITIES.CLIENT_CREATE,
    CAPABILITIES.CLIENT_UPDATE,
    CAPABILITIES.CLIENT_DELETE,
    CAPABILITIES.CLIENT_VIEW,
    CAPABILITIES.CLIENT_EXPORT,
    CAPABILITIES.TRANSACTION_CREATE,
    CAPABILITIES.TRANSACTION_VIEW,
    CAPABILITIES.TRANSACTION_REFUND,
    CAPABILITIES.TRANSACTION_EXPORT,
    CAPABILITIES.POS_TERMINAL_ACCESS,
    CAPABILITIES.POS_INTEGRATION_MANAGE,
    CAPABILITIES.REWARDS_CREATE,
    CAPABILITIES.REWARDS_MANAGE,
    CAPABILITIES.REWARDS_VIEW,
    CAPABILITIES.COUPON_CREATE,
    CAPABILITIES.COUPON_MANAGE,
    CAPABILITIES.CASH_POOL_VIEW,
    CAPABILITIES.CASH_POOL_MANAGE,
    CAPABILITIES.WEB3_VIEW,
    CAPABILITIES.WEB3_MANAGE,
    CAPABILITIES.BLOCKCHAIN_TESTING,
    CAPABILITIES.REPORTS_VIEW,
    CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.ANALYTICS_VIEW,
    CAPABILITIES.AUTOMATION_VIEW,
    CAPABILITIES.AUTOMATION_MANAGE,
    CAPABILITIES.WEBHOOK_MANAGE,
    CAPABILITIES.API_VIEW,
    CAPABILITIES.API_MANAGE
  ],
  
  [ROLES.COMPANY_ADMIN]: [
    // Company admin can manage their company and all operations
    CAPABILITIES.COMPANY_VIEW,
    CAPABILITIES.COMPANY_UPDATE,
    CAPABILITIES.COMPANY_SETTINGS,
    CAPABILITIES.BRANCH_CREATE,
    CAPABILITIES.BRANCH_UPDATE,
    CAPABILITIES.BRANCH_DELETE,
    CAPABILITIES.BRANCH_VIEW,
    CAPABILITIES.CLIENT_CREATE,
    CAPABILITIES.CLIENT_UPDATE,
    CAPABILITIES.CLIENT_DELETE,
    CAPABILITIES.CLIENT_VIEW,
    CAPABILITIES.CLIENT_EXPORT,
    CAPABILITIES.TRANSACTION_CREATE,
    CAPABILITIES.TRANSACTION_VIEW,
    CAPABILITIES.TRANSACTION_REFUND,
    CAPABILITIES.TRANSACTION_EXPORT,
    CAPABILITIES.POS_TERMINAL_ACCESS,
    CAPABILITIES.POS_INTEGRATION_MANAGE,
    CAPABILITIES.REWARDS_CREATE,
    CAPABILITIES.REWARDS_MANAGE,
    CAPABILITIES.REWARDS_VIEW,
    CAPABILITIES.COUPON_CREATE,
    CAPABILITIES.COUPON_MANAGE,
    CAPABILITIES.CASH_POOL_VIEW,
    CAPABILITIES.CASH_POOL_MANAGE,
    CAPABILITIES.WEB3_VIEW,
    CAPABILITIES.WEB3_MANAGE,
    CAPABILITIES.REPORTS_VIEW,
    CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.ANALYTICS_VIEW,
    CAPABILITIES.AUTOMATION_VIEW,
    CAPABILITIES.AUTOMATION_MANAGE,
    CAPABILITIES.WEBHOOK_MANAGE,
    CAPABILITIES.API_VIEW,
    CAPABILITIES.API_MANAGE
  ],
  
  [ROLES.BRANCH_MANAGER]: [
    // Branch manager can manage branch operations
    CAPABILITIES.BRANCH_VIEW,
    CAPABILITIES.CLIENT_CREATE,
    CAPABILITIES.CLIENT_UPDATE,
    CAPABILITIES.CLIENT_VIEW,
    CAPABILITIES.CLIENT_EXPORT,
    CAPABILITIES.TRANSACTION_CREATE,
    CAPABILITIES.TRANSACTION_VIEW,
    CAPABILITIES.TRANSACTION_REFUND,
    CAPABILITIES.TRANSACTION_EXPORT,
    CAPABILITIES.POS_TERMINAL_ACCESS,
    CAPABILITIES.REWARDS_VIEW,
    CAPABILITIES.COUPON_MANAGE,
    CAPABILITIES.CASH_POOL_VIEW,
    CAPABILITIES.CASH_POOL_MANAGE,
    CAPABILITIES.REPORTS_VIEW,
    CAPABILITIES.ANALYTICS_VIEW
  ],
  
  [ROLES.BRANCH_USER]: [
    // Branch user (cashier) can only process transactions
    CAPABILITIES.CLIENT_VIEW,
    CAPABILITIES.TRANSACTION_CREATE,
    CAPABILITIES.TRANSACTION_VIEW,
    CAPABILITIES.POS_TERMINAL_ACCESS,
    CAPABILITIES.REWARDS_VIEW,
    CAPABILITIES.CASH_POOL_VIEW
  ]
};

/**
 * Get all capabilities for a given role
 */
export function getRoleCapabilities(role) {
  return ROLE_CAPABILITIES[role] || [];
}

/**
 * Check if a role has a specific capability
 */
export function roleHasCapability(role, capability) {
  const capabilities = getRoleCapabilities(role);
  return capabilities.includes(capability);
}

/**
 * Get the highest priority role from a list of roles
 * Priority: systemadmin > companyadmin > branchmanager > branchuser
 */
export function getPrimaryRole(roles = []) {
  if (roles.includes(ROLES.SYSTEM_ADMIN)) return ROLES.SYSTEM_ADMIN;
  if (roles.includes(ROLES.COMPANY_ADMIN)) return ROLES.COMPANY_ADMIN;
  if (roles.includes(ROLES.BRANCH_MANAGER)) return ROLES.BRANCH_MANAGER;
  if (roles.includes(ROLES.BRANCH_USER)) return ROLES.BRANCH_USER;
  return null;
}

/**
 * Navigation item capability requirements
 * Each page can require one or more capabilities
 */
export const PAGE_CAPABILITIES = {
  SuperAdminDashboard: [CAPABILITIES.SYSTEM_VIEW],
  AgentDashboard: [CAPABILITIES.COMPANY_VIEW],
  Companies: [CAPABILITIES.ALL_COMPANIES_VIEW],
  Branches: [CAPABILITIES.BRANCH_VIEW],
  BusinessCustomersDashboard: [CAPABILITIES.ANALYTICS_VIEW],
  Clients: [CAPABILITIES.CLIENT_VIEW],
  POSIntegrationHub: [CAPABILITIES.POS_INTEGRATION_MANAGE],
  POSTerminal: [CAPABILITIES.POS_TERMINAL_ACCESS],
  CashPoolManagement: [CAPABILITIES.CASH_POOL_VIEW],
  Coupons: [CAPABILITIES.COUPON_MANAGE],
  Transactions: [CAPABILITIES.TRANSACTION_VIEW],
  LedgerEvents: [CAPABILITIES.TRANSACTION_VIEW],
  RewardsStore: [CAPABILITIES.REWARDS_VIEW],
  ZetaChainBridges: [CAPABILITIES.WEB3_VIEW],
  Web3Hub: [CAPABILITIES.WEB3_VIEW],
  BlockchainTesting: [CAPABILITIES.BLOCKCHAIN_TESTING],
  BlockchainTransactions: [CAPABILITIES.BLOCKCHAIN_TESTING],
  MooadonAdmin: [CAPABILITIES.SYSTEM_MANAGE]
};