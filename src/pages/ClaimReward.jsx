import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Gift, 
  Wallet, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { toast } from "sonner";
import confetti from 'canvas-confetti';

export default function ClaimReward() {
  const urlParams = new URLSearchParams(window.location.search);
  const claimToken = urlParams.get('token') || urlParams.get('intentId');
  
  const [walletAddress, setWalletAddress] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState(null);
  const [step, setStep] = useState('connect'); // 'connect' | 'preview' | 'done'

  const { data: intent, isLoading, error } = useQuery({
    queryKey: ['intent', claimToken],
    queryFn: async () => {
      // First try Transaction (new flow)
      const transactions = await base44.entities.Transaction.filter({
        claim_token: claimToken
      });

      if (transactions.length > 0) {
        const tx = transactions[0];
        // Fetch token symbol and currency from company data
        let tokenSymbol = tx.token_symbol || 'tokens';
        let currencySymbol = '₪';
        if (tx.company_id) {
          const [companies] = await Promise.all([
            base44.entities.Company.filter({ id: tx.company_id }),
          ]);
          if (companies.length > 0) {
            const company = companies[0];
            currencySymbol = company.primary_color === 'USD' ? '$' : company.primary_color === 'EUR' ? '€' : company.primary_color === 'GBP' ? '£' : '₪';
          }
        }
        return {
          ...tx,
          type: 'transaction',
          amount: tx.amount,
          points: tx.tokens_expected || tx.tokens_actual || 0,
          token_symbol: tokenSymbol,
          currency_symbol: currencySymbol,
        };
      }

      // Fallback to RewardIntent (legacy flow)
      const intents = await base44.entities.RewardIntent.filter({ claim_token: claimToken });

      if (intents.length === 0) throw new Error('Intent not found');
      return { ...intents[0], type: 'reward_intent', currency_symbol: '₪' };
    },
    enabled: !!claimToken
  });

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('Please install MetaMask or Core Wallet');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      setStep('preview');
    } catch (error) {
      toast.error('Wallet connection failed');
    }
  };

  const changeWallet = async () => {
    if (!window.ethereum) return;
    try {
      // Force wallet picker to reappear
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      });
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts[0]) {
        setWalletAddress(accounts[0]);
        toast.success('Wallet updated!');
      }
    } catch (error) {
      toast.error('Could not switch wallet');
    }
  };

  const claimReward = async () => {
    setClaiming(true);
    try {
      const response = intent.type === 'transaction'
        ? await base44.functions.invoke('claimPoints', {
            claim_token: intent.claim_token,
            user_wallet: walletAddress
          })
        : await base44.functions.invoke('claimRewardIntent', {
            intent_id: intent.id,
            user_wallet: walletAddress
          });

      if (response.data.success) {
        setClaimResult(response.data);
        setStep('done');
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        toast.success('Tokens claimed successfully! 🎉');
      } else {
        toast.error(response.data.error || 'Failed to claim reward');
      }
    } catch (error) {
      console.error('Claim error:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to claim reward');
    } finally {
      setClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#10b981] mx-auto mb-3" />
            <p className="text-[#9ca3af] text-sm">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !intent) {
    return (
      <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">Reward Not Found</h2>
            <p className="text-[#9ca3af] text-sm">The link is invalid or the reward was already claimed</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (intent.status === 'CLAIMED' || intent.status === 'completed') {
    return (
      <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#10b981] mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">Already Claimed!</h2>
            <p className="text-[#9ca3af] text-sm mb-4">This reward has already been claimed successfully</p>
            {intent.blockchain_tx_hash && (
              <Button
                variant="outline"
                onClick={() => window.open(`https://testnet.snowtrace.io/tx/${intent.blockchain_tx_hash}`, '_blank')}
                className="gap-2 text-sm h-9 border-[#2d2d3a] hover:bg-[#17171f]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Transaction
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (intent.status === 'EXPIRED' || intent.status === 'expired') {
    return (
      <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">Reward Expired</h2>
            <p className="text-[#9ca3af] text-sm">This reward has expired. Please contact the business.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (claimResult) {
    return (
      <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="bg-[#10b981] text-white p-4">
            <CardTitle className="flex items-center gap-2 justify-center text-lg">
              <CheckCircle2 className="w-6 h-6" />
              Reward Claimed Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#10b981] rounded-full flex items-center justify-center mx-auto mb-3">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <p className="text-4xl font-bold text-white mb-1">
                {claimResult.tokens_claimed || intent.points}
              </p>
              <p className="text-[#9ca3af] text-sm">{claimResult.token_symbol || intent?.token_symbol || 'tokens'} added to your wallet!</p>
            </div>

            <div className="bg-[#17171f] rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#9ca3af]">Your Wallet:</span>
                <span className="font-mono text-xs text-white">{claimResult.user_wallet ? claimResult.user_wallet.slice(0, 10) + '...' : walletAddress.slice(0, 10) + '...'}</span>
              </div>
              {claimResult.relayer_address && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#9ca3af]">Relayer (paid gas):</span>
                  <span className="font-mono text-xs text-white">{claimResult.relayer_address.slice(0, 10)}...</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {claimResult.explorer_url && (
                <Button
                  onClick={() => window.open(claimResult.explorer_url, '_blank')}
                  className="w-full bg-[#10b981] hover:bg-[#059669] text-sm h-10"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  View on Explorer
                </Button>
              )}
            </div>

            {claimResult.relayer_address && (
              <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg p-2.5">
                <p className="text-xs text-[#10b981] text-center">
                  ✅ You paid 0 AVAX gas - Relayer paid for you!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: Connect Wallet
  if (step === 'connect') {
    return (
      <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="bg-[#17171f] border-b border-[#2d2d3a] text-white p-4">
            <CardTitle className="flex items-center gap-2 justify-center text-lg">
              <Gift className="w-6 h-6" />
              Claim Your Reward!
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 bg-[#10b981] rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <p className="text-4xl font-bold text-white mb-1">{intent.points}</p>
              <p className="text-[#9ca3af] text-sm mb-1">{intent.token_symbol || 'tokens'} waiting for you!</p>
              {intent.amount > 0 && <p className="text-xs text-[#9ca3af]">Purchase: {intent.currency_symbol}{intent.amount}</p>}
            </div>
            <Button onClick={connectWallet} className="w-full h-11 bg-[#10b981] hover:bg-[#059669] text-sm">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet to Claim
            </Button>
            <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg p-3">
              <p className="text-xs text-[#10b981] text-center">💡 Connect MetaMask or Core Wallet — you pay 0 gas fees</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Preview & Confirm
  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="bg-[#17171f] border-b border-[#2d2d3a] p-4">
            <CardTitle className="flex items-center gap-2 justify-center text-lg text-white">
              <Sparkles className="w-5 h-5 text-[#10b981]" />
              Review & Confirm
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* TX Summary */}
            <div className="bg-[#17171f] rounded-xl p-4 space-y-3 border border-[#2d2d3a]">
              <div className="flex justify-between text-sm">
                <span className="text-[#9ca3af]">You will receive</span>
                <span className="font-bold text-[#10b981] text-lg">{intent.points} {intent.token_symbol || 'tokens'}</span>
              </div>
              {intent.amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#9ca3af]">For purchase</span>
                  <span className="text-white">{intent.currency_symbol}{intent.amount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#9ca3af]">Gas fees</span>
                <span className="text-[#10b981] font-semibold">FREE ✓</span>
              </div>
              <div className="border-t border-[#2d2d3a] pt-3">
                <p className="text-xs text-[#9ca3af] mb-1">Destination wallet</p>
                <p className="font-mono text-xs text-white break-all">{walletAddress}</p>
              </div>
            </div>

            {/* Change wallet option */}
            <button
              onClick={changeWallet}
              className="text-xs text-[#9ca3af] hover:text-white underline underline-offset-2 w-full text-center"
            >
              Use a different wallet address
            </button>

            {/* Confirm button */}
            <Button
              onClick={claimReward}
              disabled={claiming}
              className="w-full h-11 bg-[#10b981] hover:bg-[#059669] text-sm font-semibold"
            >
              {claiming ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending to blockchain...</>
              ) : (
                <><Gift className="w-4 h-4 mr-2" />Confirm & Claim</>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => { setStep('connect'); setWalletAddress(null); }}
              className="w-full text-[#9ca3af] hover:text-white text-sm"
            >
              ← Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}