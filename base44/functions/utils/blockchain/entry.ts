import { ethers } from 'npm:ethers@6.9.0';

/**
 * Safely parse and validate amounts
 * @param {unknown} value - The value to normalize
 * @returns {number} - Validated number
 * @throws {Error} - If value is invalid
 */
export function normalizeAmount(value) {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  
  if (isNaN(num) || num < 0) {
    throw new Error('Invalid amount: must be a positive number');
  }
  
  if (!isFinite(num)) {
    throw new Error('Invalid amount: must be finite');
  }
  
  return num;
}

/**
 * Validate wallet addresses for different chains
 * @param {string} address - The wallet address to validate
 * @param {string} chain - The blockchain (avalanche, ethereum, solana, etc.)
 * @returns {boolean} - True if valid
 */
export function validateWalletAddress(address, chain) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // EVM chains (Avalanche, Ethereum, BSC, Polygon, Base)
  if (['avalanche', 'avalanche_fuji', 'ethereum', 'polygon', 'bsc', 'base'].includes(chain)) {
    return ethers.isAddress(address);
  }

  // Solana
  if (chain === 'solana') {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  // Bitcoin
  if (chain === 'bitcoin') {
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(address);
  }

  return false;
}

/**
 * Get RPC provider for a given chain
 * @param {string} chain - The blockchain network
 * @returns {ethers.JsonRpcProvider} - Ethers provider
 * @throws {Error} - If chain is not supported
 */
export function getProviderForChain(chain) {
  const rpcUrls = {
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
    avalanche_fuji: Deno.env.get('AVALANCHE_RPC') || 'https://api.avax-test.network/ext/bc/C/rpc',
    ethereum: 'https://eth.llamarpc.com',
    polygon: 'https://polygon-rpc.com',
    bsc: 'https://bsc-dataseed.binance.org',
    base: 'https://mainnet.base.org'
  };

  const rpcUrl = rpcUrls[chain];
  if (!rpcUrl) {
    throw new Error(`Unsupported chain: ${chain}`);
  }

  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Convert number to blockchain units (wei for ERC20)
 * @param {number} amount - The amount in human-readable form
 * @param {number} decimals - Token decimals (default 18)
 * @returns {bigint} - Amount in smallest unit
 */
export function formatTokenAmount(amount, decimals = 18) {
  return ethers.parseUnits(amount.toString(), decimals);
}

/**
 * Convert blockchain units to number (wei to tokens)
 * @param {bigint} amount - Amount in smallest unit
 * @param {number} decimals - Token decimals (default 18)
 * @returns {number} - Amount in human-readable form
 */
export function parseTokenAmount(amount, decimals = 18) {
  return parseFloat(ethers.formatUnits(amount, decimals));
}

/**
 * Get master wallet from environment
 * @returns {{ wallet: ethers.Wallet, address: string }} - Wallet and address
 * @throws {Error} - If private key not configured
 */
export function getMasterWallet() {
  const privateKey = Deno.env.get('OWNER_PRIVATE_KEY');
  if (!privateKey) {
    throw new Error('OWNER_PRIVATE_KEY not configured');
  }

  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(formattedKey);

  return {
    wallet,
    address: wallet.address
  };
}

/**
 * @deprecated - DO NOT USE! Each company has its own token contract.
 * Use companyToken.contract_address instead.
 */
export function getTokenContract() {
  throw new Error(
    'getTokenContract() is deprecated. ' +
    'Use companyToken.contract_address from CompanyToken entity instead. ' +
    'Global TOKEN_CONTRACT should NOT be used for company-specific tokens.'
  );
}

/**
 * Standard ERC20 ABI for token operations
 */
export const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];