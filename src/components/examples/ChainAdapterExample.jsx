import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from 'lucide-react';
import { toast } from "sonner";

export default function ChainAdapterExample() {
  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('The code has been copied.');
  };

  const adapterCode = `// services/chainAdapter.js
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';

export class ChainAdapter {
  constructor(chain = 'none') {
    this.chain = chain;
    this.provider = null;
    this.connection = null;
    
    if (chain === 'avalanche') {
      this.provider = new ethers.JsonRpcProvider(
        process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc'
      );
    } else if (chain === 'solana') {
      this.connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
      );
    }
  }

  /**
   * Verify wallet ownership via signature
   * @param {string} walletAddress - The wallet address
   * @param {string} signature - Signature of a known message
   * @param {string} message - The message that was signed
   * @returns {Promise<boolean>}
   */
  async verifyWalletOwnership(walletAddress, signature, message) {
    if (this.chain === 'none') {
      return true; // No verification needed in DB-only mode
    }
    
    try {
      switch (this.chain) {
        case 'avalanche':
          return this.verifyEVMSignature(walletAddress, signature, message);
        case 'solana':
          return this.verifySolanaSignature(walletAddress, signature, message);
        default:
          return false;
      }
    } catch (error) {
      console.error('Wallet verification failed:', error);
      return false;
    }
  }

  async verifyEVMSignature(walletAddress, signature, message) {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  }

  async verifySolanaSignature(walletAddress, signature, message) {
    // Solana signature verification
    // Requires @solana/web3.js and nacl
    const nacl = require('tweetnacl');
    
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, 'base64');
    
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );
  }

  /**
   * Send points/tokens on-chain (FUTURE)
   * @param {string} toAddress - Recipient wallet
   * @param {number} amount - Amount to send
   * @returns {Promise<{txHash: string, onchain: boolean}>}
   */
  async sendPointsOrToken(toAddress, amount) {
    if (this.chain === 'none') {
      console.log(\`[ChainAdapter] Would send \${amount} to \${toAddress} (off-chain mode)\`);
      return { txHash: null, onchain: false };
    }
    
    // TODO: Implement actual token minting/transfer
    // For ERC-20 (Avalanche):
    // - Call contract.mint(toAddress, amount)
    // - Return transaction hash
    
    // For SPL Token (Solana):
    // - Create mint transaction
    // - Return signature
    
    throw new Error('On-chain transfers not implemented yet');
  }

  /**
   * Get on-chain token balance (FUTURE)
   * @param {string} walletAddress
   * @returns {Promise<number>}
   */
  async getOnchainBalance(walletAddress) {
    if (this.chain === 'none') {
      return 0;
    }
    
    try {
      switch (this.chain) {
        case 'avalanche':
          return await this.getERC20Balance(walletAddress);
        case 'solana':
          return await this.getSPLBalance(walletAddress);
        default:
          return 0;
      }
    } catch (error) {
      console.error('Failed to get on-chain balance:', error);
      return 0;
    }
  }

  async getERC20Balance(walletAddress) {
    if (!process.env.TOKEN_CONTRACT_ADDRESS) return 0;
    
    const abi = ['function balanceOf(address) view returns (uint256)'];
    const contract = new ethers.Contract(
      process.env.TOKEN_CONTRACT_ADDRESS,
      abi,
      this.provider
    );
    
    const balance = await contract.balanceOf(walletAddress);
    return Number(ethers.formatUnits(balance, 18));
  }

  async getSPLBalance(walletAddress) {
    // TODO: Query SPL token account
    return 0;
  }

  /**
   * Sync DB balance to blockchain (FUTURE)
   * @param {string} clientId
   * @param {number} dbBalance
   */
  async syncToBlockchain(clientId, dbBalance) {
    if (this.chain === 'none') {
      return { synced: false, reason: 'blockchain_disabled' };
    }
    
    // TODO: Compare DB balance with on-chain balance
    // If different, mint/burn tokens to match
    
    console.log(\`[ChainAdapter] Would sync \${dbBalance} for client \${clientId}\`);
    return { synced: false, reason: 'not_implemented' };
  }
}

// Export singleton instances
export const avalancheAdapter = new ChainAdapter('avalanche');
export const solanaAdapter = new ChainAdapter('solana');
export const noChainAdapter = new ChainAdapter('none');

// Factory function
export function getAdapter(chain) {
  switch (chain) {
    case 'avalanche': return avalancheAdapter;
    case 'solana': return solanaAdapter;
    default: return noChainAdapter;
}`;

  const usageCode = `// Usage in claim flow
import { getAdapter } from './services/chainAdapter';

async function claimPoints(claimToken, walletAddress) {
  const transaction = await findTransaction(claimToken);
  const company = await getCompany(transaction.company_id);
  const client = await getClient(transaction.client_id);
  
  // Get appropriate adapter
  const adapter = getAdapter(company.wallet_chain);
  
  // Verify wallet ownership (if wallet provided)
  if (walletAddress) {
    const message = \`Claim points for transaction \${transaction.id}\`;
    const signature = req.body.signature;
    
    const isValid = await adapter.verifyWalletOwnership(
      walletAddress, 
      signature, 
      message
    );
    
    if (!isValid) {
      throw new Error('Wallet verification failed');
    }
  }
  
  // Create ledger event and update balance
  // ... (existing claim logic)
  
  // Optional: Sync to blockchain (future)
  if (company.wallet_chain !== 'none') {
    await adapter.syncToBlockchain(client.id, newBalance);
  }
  
  return { success: true, balance: newBalance };
}`;

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Chain Adapter Implementation</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(adapterCode)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {adapterCode}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Usage in Claim Flow</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(usageCode)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {usageCode}
          </pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 mb-2">📦 Required Packages</h3>
          <pre className="text-xs bg-white p-2 rounded" dir="ltr">
{`npm install ethers
npm install @solana/web3.js
npm install tweetnacl`}
          </pre>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <h3 className="font-semibold text-purple-800 mb-2">🔐 Environment Variables</h3>
          <pre className="text-xs bg-white p-2 rounded" dir="ltr">
{`AVALANCHE_RPC_URL=...
SOLANA_RPC_URL=...
TOKEN_CONTRACT_ADDRESS=0x...`}
          </pre>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <h3 className="font-semibold text-amber-800 mb-2">⚠️ Current Status</h3>
        <p className="text-amber-700">
          Chain adapter Ready as -interface, But the -blockchain integration Not yet activated. .
         Right now everything is working in -DB only (chain='none').When you want to activate it - just change the company.wallet_chain.
        </p>
      </div>
    </div>
  );
}