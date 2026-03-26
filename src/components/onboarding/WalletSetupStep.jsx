import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Shield, Key, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WalletSetupStep({ formData, setFormData }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Wallet Setup</h2>
        <p className="text-slate-400">Choose how you want to manage your blockchain wallet</p>
      </div>

      <div className="space-y-4">
        {/* Option 1: Managed Wallet */}
        <Card 
          className={`cursor-pointer transition-all ${
            formData.walletOption === 'managed' 
              ? 'bg-teal-500/20 border-teal-500/50' 
              : 'bg-[#1f2128] border-[#2d2d3a] hover:border-teal-500/30'
          }`}
          onClick={() => setFormData({...formData, walletOption: 'managed', ownWalletAddress: ''})}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                formData.walletOption === 'managed' ? 'border-teal-400' : 'border-slate-600'
              }`}>
                {formData.walletOption === 'managed' && (
                  <div className="w-3 h-3 rounded-full bg-teal-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-400" />
                  Let Mooadon Manage My Wallet (Recommended)
                </h3>
                <p className="text-slate-400 text-sm mb-3">
                  We'll create and secure a wallet for you. Best for businesses new to blockchain.
                </p>
                <div className="space-y-1 text-xs">
                  <p className="text-green-400">✓ Automatic setup - no crypto knowledge needed</p>
                  <p className="text-green-400">✓ We handle security and backups</p>
                  <p className="text-green-400">✓ Can export private key later if needed</p>
                  <p className="text-amber-400">⚠ Mooadon initially controls the wallet</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Option 2: Own Wallet */}
        <Card 
          className={`cursor-pointer transition-all ${
            formData.walletOption === 'own' 
              ? 'bg-purple-500/20 border-purple-500/50' 
              : 'bg-[#1f2128] border-[#2d2d3a] hover:border-purple-500/30'
          }`}
          onClick={() => setFormData({...formData, walletOption: 'own'})}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                formData.walletOption === 'own' ? 'border-purple-400' : 'border-slate-600'
              }`}>
                {formData.walletOption === 'own' && (
                  <div className="w-3 h-3 rounded-full bg-purple-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-400" />
                  Connect My Own Wallet (Advanced)
                </h3>
                <p className="text-slate-400 text-sm mb-3">
                  Use your existing MetaMask or hardware wallet. Full control from day one.
                </p>
                <div className="space-y-1 text-xs">
                  <p className="text-green-400">✓ You control the private keys</p>
                  <p className="text-green-400">✓ Use MetaMask, Ledger, etc.</p>
                  <p className="text-amber-400">⚠ You're responsible for wallet security</p>
                  <p className="text-amber-400">⚠ Requires crypto knowledge</p>
                </div>

                {formData.walletOption === 'own' && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-white">Your Wallet Address:</Label>
                    <Input
                      value={formData.ownWalletAddress}
                      onChange={(e) => setFormData({...formData, ownWalletAddress: e.target.value})}
                      placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
                      dir="ltr"
                      className="bg-[#17171f] border-[#2d2d3a] text-white font-mono text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <p className="text-xs text-slate-500">
                      Paste your Ethereum/Avalanche wallet address from MetaMask
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}