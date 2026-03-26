/**
 * Magic Wallet Service (Stub Implementation)
 * Handles wallet creation and connection via Magic Link
 * 
 * Note: Full Magic SDK integration requires backend functions
 * This is a stub implementation for MVP
 */

class MagicWalletService {
  constructor() {
    this.magic = null;
    this.initialized = false;
  }

  /**
   * Initialize Magic SDK
   * Uses MAGIC_PUBLISHABLE_KEY from environment
   */
  initialize() {
    if (this.initialized) return;

    console.warn('[MagicWallet] Stub implementation - full Magic Link requires backend functions');
    this.initialized = false; // Keep disabled for now
  }

  /**
   * Check if Magic is available
   */
  isAvailable() {
    return this.initialized && this.magic !== null;
  }

  /**
   * Create wallet for new user via email
   * @param {string} email - User email
   * @returns {Promise<{address: string, email: string}>}
   */
  async createWallet(email) {
    // Stub implementation - would require Magic SDK
    throw new Error('Magic wallet requires backend functions - coming soon');
  }

  /**
   * Create wallet via SMS (alternative)
   * @param {string} phoneNumber - Phone number in international format
   */
  async createWalletWithSMS(phoneNumber) {
    throw new Error('Magic wallet requires backend functions - coming soon');
  }

  /**
   * Connect existing wallet
   * @returns {Promise<string>} wallet address
   */
  async connectWallet() {
    throw new Error('Magic wallet requires backend functions - coming soon');
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    console.log('[MagicWallet] Disconnect stub');
  }

  /**
   * Get current wallet info
   */
  async getWalletInfo() {
    return null;
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn() {
    return false;
  }
}

// Export singleton
const magicWallet = new MagicWalletService();
export default magicWallet;