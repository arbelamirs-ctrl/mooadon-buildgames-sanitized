/**
 * Application Constants
 * Centralized location for all magic numbers and configuration values
 */

// ═══════════════════════════════════════════════════════════════════════════
// LOYALTY LEVELS
// ═══════════════════════════════════════════════════════════════════════════

export const LOYALTY_LEVELS = {
  BRONZE: {
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 1000,
    color: '#CD7F32',
    benefits: ['Basic rewards', 'Birthday bonus']
  },
  SILVER: {
    name: 'Silver',
    minPoints: 1001,
    maxPoints: 10000,
    color: '#C0C0C0',
    benefits: ['10% bonus on rewards', 'Early access to sales', 'Birthday bonus']
  },
  GOLD: {
    name: 'Gold',
    minPoints: 10001,
    maxPoints: Infinity,
    color: '#FFD700',
    benefits: ['20% bonus on rewards', 'VIP support', 'Exclusive events', 'Birthday bonus']
  }
};

/**
 * Calculate loyalty level based on total earned points
 * @param {number} totalEarned - Total points earned by customer
 * @returns {string} - Level name ('Bronze', 'Silver', or 'Gold')
 */
export function calculateLoyaltyLevel(totalEarned) {
  const points = totalEarned || 0;
  if (points >= LOYALTY_LEVELS.GOLD.minPoints) return LOYALTY_LEVELS.GOLD.name;
  if (points >= LOYALTY_LEVELS.SILVER.minPoints) return LOYALTY_LEVELS.SILVER.name;
  return LOYALTY_LEVELS.BRONZE.name;
}

/**
 * Get level details by name
 * @param {string} levelName - Level name
 * @returns {object} - Level details
 */
export function getLevelDetails(levelName) {
  return Object.values(LOYALTY_LEVELS).find(l => l.name === levelName) || LOYALTY_LEVELS.BRONZE;
}

// ═══════════════════════════════════════════════════════════════════════════
// REWARD CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const REWARD_CONFIG = {
  DEFAULT_RATIO: 10,
  MIN_RATIO: 1,
  MAX_RATIO: 100,
  DEFAULT_WELCOME_BONUS: 100,
  MIN_WELCOME_BONUS: 0,
  MAX_WELCOME_BONUS: 10000
};

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

export const RATE_LIMITS = {
  POS_TRANSACTION: {
    maxRequests: 120,
    windowMs: 60 * 1000
  },
  KEY_EXPORT: {
    maxRequests: 3,
    windowMs: 15 * 60 * 1000
  },
  CLAIM: {
    maxRequests: 10,
    windowMs: 60 * 1000
  },
  WEBHOOK: {
    maxRequests: 30,
    windowMs: 60 * 1000
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BLOCKCHAIN CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const BLOCKCHAIN_CONFIG = {
  AVALANCHE_FUJI: {
    chainId: 43113,
    name: 'Avalanche Fuji Testnet',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    explorerUrl: 'https://testnet.snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18
    }
  },
  TOKEN_DECIMALS: 18,
  DEFAULT_GAS_LIMIT: 100000n,
  TX_CONFIRMATION_TIMEOUT: 60000
};

// ═══════════════════════════════════════════════════════════════════════════
// COUPON CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const COUPON_CONFIG = {
  DEFAULT_EXPIRY_DAYS: 30,
  CODE_LENGTH: 8,
  MAX_USES_DEFAULT: 1,
  DISCOUNT_TYPES: ['percentage', 'fixed', 'free_item']
};

// ═══════════════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════════════════

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  TRANSACTIONS_LIMIT: 1000
};

// ═══════════════════════════════════════════════════════════════════════════
// TWILIO / MESSAGING
// ═══════════════════════════════════════════════════════════════════════════

export const MESSAGING_CONFIG = {
  WHATSAPP_SANDBOX_NUMBER: '+14155238886',
  SMS_SENDER_ID: 'Mooadon'
};