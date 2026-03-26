/**
 * Chain Adapter Interface
 * Provides blockchain integration layer for LoyaltyFlow
 * Supports: none (DB only), avalanche, solana, polygon, bsc, ethereum
 */

const CHAIN_CONFIG = {
  polygon: {
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137,
    chainIdHex: '0x89',
    type: 'evm',
    explorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  },
  bsc: {
    name: 'BSC',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    chainId: 56,
    chainIdHex: '0x38',
    type: 'evm',
    explorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }
  },
  ethereum: {
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    chainId: 1,
    chainIdHex: '0x1',
    type: 'evm',
    explorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  avalanche: {
    name: 'Avalanche',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    chainId: 43114,
    chainIdHex: '0xa86a',
    type: 'evm',
    explorer: 'https://snowtrace.io',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 }
  },
  avalanche_fuji: {
    name: 'Avalanche Fuji',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    chainId: 43113,
    chainIdHex: '0xa869',
    type: 'evm',
    explorer: 'https://testnet.snowtrace.io',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    isTestnet: true
  },
  solana: {
    name: 'Solana',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    type: 'solana',
    explorer: 'https://explorer.solana.com'
  }
};

export class ChainAdapter {
  constructor(chain = 'none') {
    this.chain = chain;
    this.enabled = chain !== 'none';
    this.config = CHAIN_CONFIG[chain] || null;
  }

  /**
   * Verify wallet ownership via signature
   * @param {string} walletAddress - The wallet address
   * @param {string} signature - Signature of a message
   * @param {string} message - The message that was signed
   * @returns {Promise<boolean>}
   */
  async verifyWalletOwnership(walletAddress, signature, message) {
    if (!this.enabled) {
      console.log('[ChainAdapter] Verification skipped - blockchain disabled');
      return true;
    }

    // TODO: Implement actual signature verification
    console.log('[ChainAdapter] Would verify signature for:', walletAddress);
    
    return true; // Stub - always returns true for now
  }

  /**
   * Send points/tokens on-chain
   * @param {string} fromAddress - Sender wallet
   * @param {string} toAddress - Recipient wallet
   * @param {number} amount - Amount to send
   * @param {string} contractAddress - Token contract address
   * @returns {Promise<{txHash: string | null, success: boolean, error?: string}>}
   */
  async sendPointsOrToken(fromAddress, toAddress, amount, contractAddress) {
    if (!this.enabled) {
      console.log(`[ChainAdapter] Would send ${amount} from ${fromAddress} to ${toAddress} (off-chain mode)`);
      return { txHash: null, success: false, error: 'blockchain_disabled' };
    }

    try {
      if (this.config.type === 'evm') {
        return await this.sendEVMToken(fromAddress, toAddress, amount, contractAddress);
      } else if (this.config.type === 'solana') {
        return await this.sendSolanaToken(fromAddress, toAddress, amount, contractAddress);
      }
      
      throw new Error(`Unsupported chain type: ${this.config.type}`);
    } catch (error) {
      console.error('[ChainAdapter] Transfer failed:', error);
      return { txHash: null, success: false, error: error.message };
    }
  }
  
  /**
   * Send EVM token (Polygon, BSC, Ethereum, Avalanche)
   */
  async sendEVMToken(fromAddress, toAddress, amount, contractAddress) {
    // This would require backend functions with private keys
    console.log(`[ChainAdapter] Would send ${amount} tokens from ${fromAddress} to ${toAddress} on ${this.chain}`);
    console.log(`[ChainAdapter] Contract: ${contractAddress}, Chain: ${this.config.name}`);
    
    // Stub: Return simulated transaction
    const mockTxHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    
    return {
      txHash: mockTxHash,
      success: true,
      explorerUrl: `${this.config.explorer}/tx/${mockTxHash}`
    };
  }
  
  /**
   * Send Solana token
   */
  async sendSolanaToken(fromAddress, toAddress, amount, contractAddress) {
    console.log(`[ChainAdapter] Would send ${amount} SPL tokens from ${fromAddress} to ${toAddress}`);
    
    // Stub: Return simulated transaction
    const mockTxHash = Array(88).fill(0).map(() => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
    ).join('');
    
    return {
      txHash: mockTxHash,
      success: true,
      explorerUrl: `${this.config.explorer}/tx/${mockTxHash}`
    };
  }

  /**
   * Get on-chain token balance
   * @param {string} walletAddress
   * @param {string} contractAddress - Token contract (for EVM) or mint address (for Solana)
   * @returns {Promise<number>}
   */
  async getOnchainBalance(walletAddress, contractAddress) {
    if (!this.enabled) {
      return 0;
    }

    try {
      if (this.config.type === 'evm') {
        return await this.getEVMBalance(walletAddress, contractAddress);
      } else if (this.config.type === 'solana') {
        return await this.getSolanaBalance(walletAddress, contractAddress);
      }
      return 0;
    } catch (error) {
      console.error('[ChainAdapter] Balance query failed:', error);
      return 0;
    }
  }
  
  /**
   * Get EVM token balance (real implementation)
   */
  async getEVMBalance(walletAddress, contractAddress) {
    if (!contractAddress) {
      console.log('[ChainAdapter] No contract address provided');
      return 0;
    }

    try {
      console.log(`[ChainAdapter] Querying EVM balance for ${walletAddress} on ${this.chain}`);
      
      // ERC20 balanceOf function signature
      const data = '0x70a08231' + walletAddress.substring(2).padStart(64, '0');
      
      const response = await fetch(this.config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{
            to: contractAddress,
            data: data
          }, 'latest']
        })
      });

      const result = await response.json();
      if (result.error) {
        console.error('[ChainAdapter] RPC error:', result.error);
        return 0;
      }

      // Convert hex to decimal (wei) then to tokens (divide by 10^18)
      const balanceWei = BigInt(result.result || '0x0');
      const balance = Number(balanceWei) / 1e18;
      
      console.log(`[ChainAdapter] Balance: ${balance} tokens`);
      return balance;
    } catch (error) {
      console.error('[ChainAdapter] Balance query failed:', error);
      return 0;
    }
  }
  
  /**
   * Get Solana token balance
   */
  async getSolanaBalance(walletAddress, contractAddress) {
    console.log(`[ChainAdapter] Querying Solana balance for ${walletAddress}`);
    
    // Stub: Return random balance for demo
    return Math.floor(Math.random() * 10000);
  }

  /**
   * Sync DB balance to blockchain
   * @param {object} client - Client record with wallet info
   * @param {number} dbBalance - Current database balance
   * @param {string} contractAddress - Token contract address
   * @returns {Promise<{synced: boolean, reason?: string, txHash?: string, onchainBalance?: number}>}
   */
  async syncToBlockchain(client, dbBalance, contractAddress) {
    if (!this.enabled) {
      return { synced: false, reason: 'blockchain_disabled' };
    }

    if (!client.wallet_address) {
      return { synced: false, reason: 'no_wallet' };
    }

    try {
      // Get current on-chain balance
      const onchainBalance = await this.getOnchainBalance(client.wallet_address, contractAddress);
      
      console.log(`[ChainAdapter] Sync check - DB: ${dbBalance}, Onchain: ${onchainBalance}`);
      
      // If balances match, no sync needed
      if (Math.abs(dbBalance - onchainBalance) < 0.01) {
        return { 
          synced: true, 
          reason: 'already_synced',
          onchainBalance 
        };
      }
      
      // Calculate difference
      const diff = dbBalance - onchainBalance;
      
      if (diff > 0) {
        // Need to mint/transfer more tokens on-chain
        const result = await this.sendPointsOrToken(
          contractAddress, // From contract/treasury
          client.wallet_address, 
          diff,
          contractAddress
        );
        
        return {
          synced: result.success,
          reason: result.success ? 'minted_difference' : 'mint_failed',
          txHash: result.txHash,
          onchainBalance: result.success ? dbBalance : onchainBalance,
          amount: diff
        };
      } else {
        // On-chain has more than DB - this shouldn't happen
        console.warn('[ChainAdapter] On-chain balance exceeds DB balance');
        return {
          synced: false,
          reason: 'onchain_exceeds_db',
          onchainBalance,
          dbBalance
        };
      }
    } catch (error) {
      console.error('[ChainAdapter] Sync failed:', error);
      return { 
        synced: false, 
        reason: 'sync_error',
        error: error.message 
      };
    }
  }
}

// Factory function
export function getChainAdapter(chain) {
  return new ChainAdapter(chain);
}

// Export singleton instances
export const noChainAdapter = new ChainAdapter('none');
export const avalancheAdapter = new ChainAdapter('avalanche');
export const avalancheFujiAdapter = new ChainAdapter('avalanche_fuji');
export const solanaAdapter = new ChainAdapter('solana');
export const polygonAdapter = new ChainAdapter('polygon');
export const bscAdapter = new ChainAdapter('bsc');
export const ethereumAdapter = new ChainAdapter('ethereum');

// Export chain configs for UI
export { CHAIN_CONFIG };