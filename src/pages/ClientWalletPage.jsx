import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Loader2, ArrowRightLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientWalletPage() {
  const [tokensToRedeem, setTokensToRedeem] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [clientId, setClientId] = useState(null);
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Find client by user email
  const { data: clients = [] } = useQuery({
    queryKey: ['clientsByEmail', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.Client.filter({ email: user.email });
    },
    enabled: !!user?.email,
  });

  useEffect(() => {
    if (clients.length > 0) {
      setClientId(clients[0].id);
    }
  }, [clients]);

  const client = clients[0];
  const starsBalance = client?.current_balance || 0;
  const tokenBalance = client?.tokenBalance || 0;
  const hasWallet = client?.wallet_address ? true : false;

  // Fetch company token symbol
  const { data: companyToken } = useQuery({
    queryKey: ['companyToken', client?.company_id],
    queryFn: async () => {
      const tokens = await base44.entities.CompanyToken.filter({ company_id: client.company_id });
      return tokens[0] || null;
    },
    enabled: !!client?.company_id,
  });

  const tokenSymbol = companyToken?.token_symbol || 'Tokens';

  // Convert Stars to Tokens mutation
  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('No client ID');
      const response = await base44.functions.invoke('convertStarsToTokens', { clientId });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Converted ${data.data.starsConverted} Stars to ${data.data.tokensReceived} ${tokenSymbol}!`);
        queryClient.invalidateQueries({ queryKey: ['clientsByEmail'] });
      } else {
        toast.error(data.error || 'Conversion failed');
      }
    },
    onError: (error) => {
      toast.error('Failed to convert stars to tokens');
      console.error(error);
    },
  });

  const handleConvert = () => {
    if (!clientId) {
      toast.error('Client not found');
      return;
    }
    if (starsBalance < 100) {
      toast.error('You need at least 100 Stars to convert');
      return;
    }
    convertMutation.mutate();
  };

  const handleRedeem = async () => {
    const amount = parseInt(tokensToRedeem);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > tokenBalance) {
      toast.error('Insufficient token balance');
      return;
    }

    setRedeeming(true);
    try {
      const result = await base44.functions.invoke('redeemTokens', { 
        clientId, 
        tokensToRedeem: amount 
      });
      
      if (result.data.success) {
        toast.success(`Successfully redeemed ${amount} ${tokenSymbol}!`);
        setTokensToRedeem('');
        queryClient.invalidateQueries({ queryKey: ['clientsByEmail'] });
      } else {
        toast.error(result.data.error || 'Redemption failed');
      }
    } catch (error) {
      toast.error('Failed to redeem tokens');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">My Loyalty Wallet</h1>
        </div>

        {/* Stars Balance */}
        <Card className="shadow-xl border-2 border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              Your Stars
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-slate-600 mb-1">Available Balance</p>
              <p className="text-3xl font-bold text-indigo-600">{starsBalance} Stars</p>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Conversion Rate:</span>
                <span className="font-semibold text-slate-900">100 Stars = 1 {tokenSymbol}</span>
              </div>
              {starsBalance >= 100 && (
                <div className="mt-2 text-xs text-green-600">
                  You can convert {Math.floor(starsBalance / 100)} {tokenSymbol}
                </div>
              )}
            </div>

            <Button 
              onClick={handleConvert}
              disabled={starsBalance < 100 || convertMutation.isPending}
              className="w-full h-12 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              {convertMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-5 h-5 mr-2" />
                  Convert Stars to Tokens
                </>
              )}
            </Button>

            {starsBalance < 100 && (
              <p className="text-sm text-slate-500 text-center">
                You need at least 100 Stars to convert
              </p>
            )}
          </CardContent>
        </Card>

        {/* Token Balance & Redemption */}
        {hasWallet && (
          <Card className="shadow-xl border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-6 h-6 text-purple-600" />
                Redeem Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-slate-600 mb-1">Available Balance</p>
                <p className="text-3xl font-bold text-purple-600">{tokenBalance} {tokenSymbol}</p>
              </div>

              <div className="space-y-2">
                <Label>Tokens to Redeem</Label>
                <Input
                  type="number"
                  value={tokensToRedeem}
                  onChange={(e) => setTokensToRedeem(e.target.value)}
                  placeholder="Enter amount..."
                  min="1"
                  max={tokenBalance}
                />
              </div>

              <Button
                onClick={handleRedeem}
                disabled={!tokensToRedeem || redeeming || tokenBalance === 0}
                className="w-full h-12 text-lg bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
              >
                {redeeming ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Redeeming...
                  </>
                ) : (
                  <>
                    <Gift className="w-5 h-5 mr-2" />
                    Redeem Tokens
                  </>
                )}
              </Button>

              {tokenBalance === 0 && (
                <p className="text-sm text-slate-500 text-center">
                  You need {tokenSymbol} to redeem rewards
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}