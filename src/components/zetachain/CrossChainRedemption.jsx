import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bitcoin, Coins, ArrowRight, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function CrossChainRedemption({ client, company }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Bitcoin redemption
  const [btcAddress, setBtcAddress] = useState('');
  const [btcAmount, setBtcAmount] = useState('');
  
  // Ethereum redemption
  const [ethAddress, setEthAddress] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [ethTokenType, setEthTokenType] = useState('USDC');
  
  const handleBitcoinRedeem = async () => {
    if (!btcAddress || !btcAmount) {
      toast.error('Please fill in all fields');
      return;
    }
    
    const amount = parseFloat(btcAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }
    
    if (amount > client.current_balance) {
      toast.error('Insufficient balance');
      return;
    }
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await base44.functions.invoke('redeemViaBitcoin', {
        client_id: client.id,
        company_id: company.id,
        amount_mlt: amount,
        bitcoin_address: btcAddress
      });
      
      if (response.data.success) {
        setResult(response.data);
        toast.success('Bitcoin redemption completed successfully! ✅');
        setBtcAddress('');
        setBtcAmount('');
      } else {
        toast.error(response.data.error || 'Redemption error');
      }
    } catch (error) {
      console.error('Redemption error:', error);
      toast.error('Error redeeming to Bitcoin');
    } finally {
      setLoading(false);
    }
  };
  
  const handleEthereumRedeem = async () => {
    if (!ethAddress || !ethAmount) {
      toast.error('Please fill in all fields');
      return;
    }
    
    const amount = parseFloat(ethAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }
    
    if (amount > client.current_balance) {
      toast.error('Insufficient balance');
      return;
    }
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await base44.functions.invoke('redeemViaEthereum', {
        client_id: client.id,
        company_id: company.id,
        amount_mlt: amount,
        ethereum_address: ethAddress,
        token_type: ethTokenType
      });
      
      if (response.data.success) {
        setResult(response.data);
        toast.success(`${ethTokenType} redemption completed successfully! ✅`);
        setEthAddress('');
        setEthAmount('');
      } else {
        toast.error(response.data.error || 'Redemption error');
      }
    } catch (error) {
      console.error('Redemption error:', error);
      toast.error('Error redeeming to Ethereum');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-indigo-400" />
          Cross-Chain Redemption via ZetaChain
        </CardTitle>
        <CardDescription className="text-slate-400">
          Redeem points directly to Bitcoin or Ethereum without bridges
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="bitcoin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="bitcoin" className="gap-2">
              <Bitcoin className="w-4 h-4" />
              Bitcoin
            </TabsTrigger>
            <TabsTrigger value="ethereum" className="gap-2">
              <Coins className="w-4 h-4" />
              Ethereum
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="bitcoin" className="space-y-4">
            <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Exchange rate:</span>
                <span className="text-white font-mono">10,000,000 MLT = 1 BTC</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="btc-amount">MLT amount to redeem</Label>
                <Input
                  id="btc-amount"
                  type="number"
                  placeholder="10000000"
                  value={btcAmount}
                  onChange={(e) => setBtcAmount(e.target.value)}
                  className="bg-slate-900/50 border-slate-700"
                />
                <p className="text-xs text-slate-500 mt-1">
                  ≈ {btcAmount ? (parseFloat(btcAmount) / 10000000).toFixed(8) : '0'} BTC
                </p>
              </div>
              
              <div>
                <Label htmlFor="btc-address">Bitcoin address</Label>
                <Input
                  id="btc-address"
                  placeholder="bc1q..."
                  value={btcAddress}
                  onChange={(e) => setBtcAddress(e.target.value)}
                  className="bg-slate-900/50 border-slate-700 font-mono text-sm"
                />
              </div>
              
              <Button
                onClick={handleBitcoinRedeem}
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                    </>
                    ) : (
                    <>
                    <Bitcoin className="w-4 h-4 mr-2" />
                    Redeem to Bitcoin
                    <ArrowRight className="w-4 h-4 mr-2" />
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="ethereum" className="space-y-4">
            <div className="bg-slate-900/50 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">USDC:</span>
                <span className="text-white font-mono">100 MLT = 1 USDC</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">ETH:</span>
                <span className="text-white font-mono">10,000,000 MLT = 1 ETH</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="eth-token">Token type</Label>
                <select
                  value={ethTokenType}
                  onChange={(e) => setEthTokenType(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-700 bg-slate-900/50 px-3 text-sm text-white"
                >
                  <option value="USDC">USDC (Stablecoin)</option>
                  <option value="ETH">ETH (Ethereum)</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="eth-amount">MLT amount to redeem</Label>
                <Input
                  id="eth-amount"
                  type="number"
                  placeholder={ethTokenType === 'USDC' ? '1000' : '10000000'}
                  value={ethAmount}
                  onChange={(e) => setEthAmount(e.target.value)}
                  className="bg-slate-900/50 border-slate-700"
                />
                <p className="text-xs text-slate-500 mt-1">
                  ≈ {ethAmount ? (
                    ethTokenType === 'USDC' 
                      ? (parseFloat(ethAmount) / 100).toFixed(2)
                      : (parseFloat(ethAmount) / 10000000).toFixed(6)
                  ) : '0'} {ethTokenType}
                </p>
              </div>
              
              <div>
                <Label htmlFor="eth-address">Ethereum address</Label>
                <Input
                  id="eth-address"
                  placeholder="0x..."
                  value={ethAddress}
                  onChange={(e) => setEthAddress(e.target.value)}
                  className="bg-slate-900/50 border-slate-700 font-mono text-sm"
                />
              </div>
              
              <Button
                onClick={handleEthereumRedeem}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                    </>
                    ) : (
                    <>
                    <Coins className="w-4 h-4 mr-2" />
                    Redeem to {ethTokenType}
                    <ArrowRight className="w-4 h-4 mr-2" />
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        {result && (
          <div className="mt-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-green-400 font-medium">
                  {result.message}
                </p>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>Amount: {result.amount_mlt} MLT → {result.amount_btc || result.amount_out} {result.token_out}</div>
                  <div className="font-mono">CCTX: {result.zeta_cctx_index}</div>
                </div>
                {result.explorer_url && (
                  <a 
                    href={result.explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    View on Explorer
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-6 bg-slate-900/30 rounded-lg p-4 border border-slate-800">
          <p className="text-xs text-slate-400 mb-2">💡 How does it work?</p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="bg-indigo-500/20 px-2 py-1 rounded">Avalanche</span>
            <ArrowRight className="w-3 h-3" />
            <span className="bg-purple-500/20 px-2 py-1 rounded">ZetaChain</span>
            <ArrowRight className="w-3 h-3" />
            <span className="bg-orange-500/20 px-2 py-1 rounded">Bitcoin/Ethereum</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            ZetaChain performs the conversion automatically without bridges or wrapped tokens
          </p>
        </div>
      </CardContent>
    </Card>
  );
}