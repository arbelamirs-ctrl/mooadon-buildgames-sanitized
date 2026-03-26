import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from 'lucide-react';
import { toast } from "sonner";

export default function WalletIntegrationExample() {
  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('The code has been copied. ');
  };

  const magicLinkExample = `// services/walletService.js - Magic Link Implementation
import { Magic } from 'magic-sdk';

class WalletService {
  constructor() {
    this.magic = new Magic(process.env.MAGIC_PUBLISHABLE_KEY, {
      network: {
        rpcUrl: process.env.AVALANCHE_RPC_URL,
        chainId: 43114 // Avalanche mainnet
      }
    });
  }

  /**
   * Create wallet for new user (email-based)
   * @param {string} email - User email
   * @returns {Promise<{address: string, provider: string}>}
   */
  async createWallet(email) {
    try {
      // Magic handles wallet creation automatically
      // when user logs in with email
      const didToken = await this.magic.auth.loginWithEmailOTP({ 
        email 
      });
      
      const metadata = await this.magic.user.getMetadata();
      
      return {
        address: metadata.publicAddress,
        provider: 'magic',
        email: metadata.email
      };
    } catch (error) {
      console.error('Wallet creation failed:', error);
      throw error;
    }
  }

  /**
   * Connect existing wallet
   * @returns {Promise<string>} wallet address
   */
  async connectWallet() {
    const isLoggedIn = await this.magic.user.isLoggedIn();
    
    if (isLoggedIn) {
      const metadata = await this.magic.user.getMetadata();
      return metadata.publicAddress;
    }
    
    // Trigger login flow
    const didToken = await this.magic.auth.loginWithEmailOTP({ 
      email: prompt('Enter your email') 
    });
    
    const metadata = await this.magic.user.getMetadata();
    return metadata.publicAddress;
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    await this.magic.user.logout();
  }

  /**
   * Get current wallet info
   */
  async getWalletInfo() {
    const isLoggedIn = await this.magic.user.isLoggedIn();
    
    if (!isLoggedIn) {
      return null;
    }
    
    const metadata = await this.magic.user.getMetadata();
    return {
      address: metadata.publicAddress,
      email: metadata.email,
      issuer: metadata.issuer
    };
  }
}

export default new WalletService();`;

  const privyExample = `// Alternative: Privy Implementation
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';

// Wrap app with provider
function App() {
  return (
    <PrivyProvider
      appId={process.env.PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'sms', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#6366F1',
          logo: 'https://your-logo.png'
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets'
        }
      }}
    >
      <YourApp />
    </PrivyProvider>
  );
}

// In claim component
function ClaimButton() {
  const { login, authenticated, user } = usePrivy();
  
  const handleClaim = async () => {
    if (!authenticated) {
      await login();
    }
    
    const walletAddress = user.wallet?.address;
    
    // Proceed with claim
    await claimPoints(claimToken, walletAddress);
  };
  
  return <button onClick={handleClaim}> Confirm points</button>;
}`;

  const claimFlowExample = `// Enhanced ClaimPoints.jsx with wallet integration

import { Magic } from 'magic-sdk';
import { useState, useEffect } from 'react';

export default function ClaimPoints() {
  const [magic, setMagic] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [hasWallet, setHasWallet] = useState(false);
  
  useEffect(() => {
    // Initialize Magic
    const m = new Magic(process.env.NEXT_PUBLIC_MAGIC_KEY);
    setMagic(m);
    
    // Check if user already has wallet
    m.user.isLoggedIn().then(loggedIn => {
      if (loggedIn) {
        m.user.getMetadata().then(metadata => {
          setWalletAddress(metadata.publicAddress);
          setHasWallet(true);
        });
      }
    });
  }, []);
  
  const connectWallet = async () => {
    try {
      // Email-based wallet creation
      const email = prompt('Enter your email to create/connect wallet');
      await magic.auth.loginWithEmailOTP({ email });
      
      const metadata = await magic.user.getMetadata();
      setWalletAddress(metadata.publicAddress);
      setHasWallet(true);
      
      toast.success('Wallet connected!');
    } catch (error) {
      toast.error('Failed to connect wallet');
    }
  };
  
  const skipWallet = () => {
    // Continue without wallet (points in DB only)
    setHasWallet(false);
    proceedToClaim();
  };
  
  const proceedToClaim = async () => {
    // Call claim API with optional wallet_address
    const result = await fetch('/api/claimPoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claim_token: claimToken,
        wallet_address: walletAddress || null
      })
    });
    
    // ... handle response
  };
  
  return (
    <div>
      {/* If no wallet, show options */}
      {!hasWallet && (
        <div>
          <h2>Want to add a wallet?</h2>
          <p> -Optional - to convert points to tokens in the future<</p>
          <button onClick={connectWallet}>Create a wallet</button>
          <button onClick={skipWallet}>Continue without a wallet</button>
        </div>
      )}
      
      {/* If wallet connected, show address */}
      {hasWallet && (
        <div>
          <p>Wallet: {walletAddress.substring(0, 8)}...</p>
          <button onClick={proceedToClaim}>Confirm points</button>
        </div>
      )}
    </div>
  );
}`;

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Magic Link WaaS</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(magicLinkExample)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {magicLinkExample}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Privy Alternative</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(privyExample)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {privyExample}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Claim Flow with Wallet</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyCode(claimFlowExample)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto" dir="ltr">
            {claimFlowExample}
          </pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Magic Link</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>✅ Email-based login</li>
            <li>✅ No private keys needed</li>
            <li>✅ Simple integration</li>
            <li>❌ Limited to email only</li>
          </ul>
          <pre className="text-xs bg-white p-2 rounded mt-2" dir="ltr">
npm install magic-sdk
          </pre>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <h3 className="font-semibold text-purple-800 mb-2">Privy</h3>
          <ul className="text-sm text-purple-700 space-y-1">
            <li>✅ Email + SMS + Social</li>
            <li>✅ Auto wallet creation</li>
            <li>✅ Better UX</li>
            <li>⚪ Slightly more complex</li>
          </ul>
          <pre className="text-xs bg-white p-2 rounded mt-2" dir="ltr">
npm install @privy-io/react-auth
          </pre>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h3 className="font-semibold text-slate-800 mb-2">Thirdweb</h3>
          <ul className="text-sm text-slate-700 space-y-1">
            <li>✅ Full Web3 toolkit</li>
            <li>✅ Multi-chain support</li>
            <li>✅ Contract interaction</li>
            <li>⚪ Heavier solution</li>
          </ul>
          <pre className="text-xs bg-white p-2 rounded mt-2" dir="ltr">
npm install @thirdweb-dev/react
          </pre>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <h3 className="font-semibold text-amber-800 mb-2">💡 Recommendation</h3>
        <p className="text-amber-700">
          <strong>Start with Magic Link</strong> -Very simple, just enough to-MVP.
          <br/>Can be replaced with-Privy or Thirdweb  Subsequently without change in  -DB schema.
        </p>
      </div>
    </div>
  );
}