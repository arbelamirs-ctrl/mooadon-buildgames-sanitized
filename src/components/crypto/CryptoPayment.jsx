import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  DollarSign, 
  ArrowRight, 
  CheckCircle, 
  Loader2,
  QrCode,
  Copy
} from 'lucide-react';
import { toast } from "sonner";
import { getChainAdapter } from '@/components/services/chainAdapter';

const SUPPORTED_TOKENS = [
  { symbol: 'USDC', name: 'USD Coin', decimals: 6, icon: '💵' },
  { symbol: 'USDT', name: 'Tether', decimals: 6, icon: '💵' },
  { symbol: 'MATIC', name: 'Polygon', decimals: 18, icon: '🟣' },
  { symbol: 'ETH', name: 'Ethereum', decimals: 18, icon: '◆' }
];

export default function CryptoPayment({ 
  amount, 
  currency = 'ILS',
  onPaymentComplete,
  companyWallet,
  chain = 'polygon'
}) {
  const [selectedToken, setSelectedToken] = useState(SUPPORTED_TOKENS[0]);
  const [cryptoAmount, setCryptoAmount] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(3.5); // Mock: 1 USD = 3.5 ILS
  const [walletConnected, setWalletConnected] = useState(false);
  const [userWallet, setUserWallet] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const chainAdapter = getChainAdapter(chain);

  useEffect(() => {
    calculateCryptoAmount();
  }, [amount, selectedToken, exchangeRate]);

  const calculateCryptoAmount = () => {
    // Convert ILS to USD
    const usdAmount = amount / exchangeRate;
    // For stablecoins (USDC/USDT), 1:1 with USD
    if (selectedToken.symbol === 'USDC' || selectedToken.symbol === 'USDT') {
      setCryptoAmount(usdAmount.toFixed(2));
    } else {
      // For other tokens, would need real-time price API
      // Mock: ETH = $2000, MATIC = $0.8
      const mockPrices = { ETH: 2000, MATIC: 0.8 };
      const price = mockPrices[selectedToken.symbol] || 1;
      setCryptoAmount((usdAmount / price).toFixed(6));
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        toast.error('Please install a wallet Web3 (MetaMask, Trust Wallet וכו׳)');
        return;
      }

      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      setUserWallet(accounts[0]);
      setWalletConnected(true);
      toast.success(' Wallet is connected.');
    } catch (error) {
      toast.error('Wallet connection error');
    }
  };

  const processPayment = async () => {
    setProcessing(true);
    setPaymentStatus('processing');

    try {
      // In production, this would:
      // 1. Create payment request smart contract call
      // 2. User approves token spend (if ERC20)
      // 3. Transfer tokens to company wallet
      // 4. Verify transaction on-chain
      // 5. Update backend with payment confirmation

      // Mock transaction
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const mockTxHash = '0x' + Math.random().toString(36).substring(2, 15) + 
                         Math.random().toString(36).substring(2, 15);
      
      setTxHash(mockTxHash);
      setPaymentStatus('completed');
      
      toast.success('Payment was made successfully!');
      
      if (onPaymentComplete) {
        onPaymentComplete({
          txHash: mockTxHash,
          amount: cryptoAmount,
          token: selectedToken.symbol,
          chain: chain,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      setPaymentStatus('failed');
      toast.error('Payment failed.');
    } finally {
      setProcessing(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(companyWallet);
    toast.success('Address copied');
  };

  if (paymentStatus === 'completed') {
    return (
      <Card className="border-emerald-500/50 bg-emerald-50">
        <CardContent className="p-6 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-emerald-900 mb-2">
           Payment completed!
          </h3>
          <p className="text-emerald-700 mb-4">
            {cryptoAmount} {selectedToken.symbol} Transferred successfully
          </p>
          <div className="bg-white rounded-lg p-3 mb-4">
            <p className="text-xs text-slate-500 mb-1">Transaction Hash</p>
            <code className="text-xs text-slate-700 break-all" dir="ltr">
              {txHash}
            </code>
          </div>
          <Button
            onClick={() => window.open(`${chainAdapter.explorerUrl}/tx/${txHash}`, '_blank')}
            variant="outline"
            className="w-full"
          >
           View blockchain
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Wallet className="w-5 h-5" />
         Crypto payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Amount Display */}
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400">Amount to be paid:</span>
            <div className="text-left">
              <span className="text-2xl font-bold text-white">₪{amount}</span>
              <span className="text-slate-400 text-sm mr-2">
                (≈ ${(amount / exchangeRate).toFixed(2)})
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-yellow-400">
            <ArrowRight className="w-4 h-4" />
            <span className="text-xl font-bold">
              {cryptoAmount} {selectedToken.symbol}
            </span>
          </div>
        </div>

        {/* Token Selection */}
        <div className="space-y-2">
          <Label className="text-slate-300">Select a payment token:</Label>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_TOKENS.map(token => (
              <button
                key={token.symbol}
                onClick={() => setSelectedToken(token)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedToken.symbol === token.symbol
                    ? 'border-yellow-400 bg-yellow-400/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{token.icon}</span>
                  <div className="text-right">
                    <p className="font-medium text-white">{token.symbol}</p>
                    <p className="text-xs text-slate-400">{token.name}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Network Badge */}
        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">
          {chainAdapter.name}
        </Badge>

        {/* Company Wallet Address */}
        <div className="bg-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-2">Company payment address:</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-slate-300 flex-1 break-all" dir="ltr">
              {companyWallet || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyAddress}
              className="text-slate-400"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Wallet Connection */}
        {!walletConnected ? (
          <Button
            onClick={connectWallet}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            size="lg"
          >
            <Wallet className="w-5 h-5 ml-2" />
           Wallet member
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Connected wallet:</span>
              </div>
              <code className="text-xs text-emerald-300" dir="ltr">
                {userWallet.substring(0, 6)}...{userWallet.substring(38)}
              </code>
            </div>

            <Button
              onClick={processPayment}
              disabled={processing}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-slate-900"
              size="lg"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                 Payment processor...
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5 ml-2" />
                 whole {cryptoAmount} {selectedToken.symbol}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
          <p className="text-xs text-blue-300">
            💡The payment will be made directly from your wallet to the company's wallet on the network. {chainAdapter.name}.
           The points will be credited automatically after the transaction is confirmed..
          </p>
        </div>
      </CardContent>
    </Card>
  );
}