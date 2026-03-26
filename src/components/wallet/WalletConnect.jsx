import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import magicWallet from '@/components/services/magicWallet';
import { toast } from "sonner";

export default function WalletConnect({ onWalletConnected, existingWallet }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState(existingWallet || '');
  const [showEmailInput, setShowEmailInput] = useState(false);

  useEffect(() => {
    magicWallet.initialize();
  }, []);

  const handleCreateWallet = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const { address } = await magicWallet.createWallet(email);
      setWalletAddress(address);
      onWalletConnected(address);
      toast.success('Wallet created successfully!');
    } catch (error) {
      toast.error('Error creating wallet');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onWalletConnected(null);
  };

  if (walletAddress) {
    return (
      <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <div className="flex-1">
            <p className="text-white font-medium">Wallet connected</p>
            <code className="text-xs text-emerald-200">
              {walletAddress.substring(0, 12)}...{walletAddress.substring(walletAddress.length - 8)}
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/10 border border-white/20 rounded-xl p-4">
        <div className="flex items-start gap-3 mb-4">
          <Wallet className="w-5 h-5 text-yellow-400 mt-1" />
          <div>
            <p className="text-white font-medium mb-1">Want to add a wallet?</p>
            <p className="text-sm text-white/60">
              Optional - enables future conversion to digital tokens
            </p>
          </div>
        </div>

        {!showEmailInput ? (
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowEmailInput(true)}
              className="flex-1 bg-yellow-400 text-slate-900 hover:bg-yellow-500"
              disabled={true}
            >
              <Mail className="w-4 h-4 ml-2" />
              Create Wallet (Coming Soon)
            </Button>
            <Button 
              onClick={handleSkip}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              Continue without wallet
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-white/70">Email</Label>
              <Input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                dir="ltr"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateWallet}
                disabled={loading || !email}
                className="flex-1 bg-yellow-400 text-slate-900 hover:bg-yellow-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    Creating wallet...
                    </>
                    ) : (
                    'Create Wallet'
                )}
              </Button>
              <Button 
                onClick={() => setShowEmailInput(false)}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-white/50 text-center">
              A verification code will be sent to the email you entered
            </p>
          </div>
        )}
      </div>

      <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5" />
        <p className="text-xs text-blue-200">
          Wallet creation via Magic Link will be available after enabling Backend Functions
        </p>
      </div>
    </div>
  );
}