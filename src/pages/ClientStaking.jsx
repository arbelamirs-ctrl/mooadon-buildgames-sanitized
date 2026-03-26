import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Coins, 
  TrendingUp, 
  Calendar, 
  Lock,
  Unlock,
  Gift,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ClientStaking() {
  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState('flexible');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [selectedStakeForUnstake, setSelectedStakeForUnstake] = useState(null);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me()
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['myClient'],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Client.filter({ email: user.email });
    },
    enabled: !!user
  });

  const client = clients[0];

  const { data: stakes = [], isLoading: loadingStakes } = useQuery({
    queryKey: ['stakes', client?.id],
    queryFn: () => base44.entities.Stake.filter({ 
      client_id: client.id,
      status: 'active'
    }),
    enabled: !!client?.id
  });

  const { data: companyToken } = useQuery({
    queryKey: ['companyToken', client?.company_id],
    queryFn: () => base44.entities.CompanyToken.filter({ 
      company_id: client.company_id 
    }).then(r => r?.[0]),
    enabled: !!client?.company_id
  });

  const stakeMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(stakeAmount);
      if (!amount || amount <= 0) throw new Error('Invalid amount');
      if (amount > (client?.tokenBalance || 0)) throw new Error('Insufficient balance');

      const poolConfig = stakingPools.find(p => p.id === selectedPool);
      
      const result = await base44.functions.stakeTokens({
        clientId: client.id,
        amount: amount,
        lockPeriodDays: poolConfig.lockDays
      });

      if (!result.success) {
        throw new Error(result.error || 'Staking failed');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stakes'] });
      queryClient.invalidateQueries({ queryKey: ['myClient'] });
      setStakeAmount('');
      toast.success('Tokens staked successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to stake tokens');
    }
  });

  const claimMutation = useMutation({
    mutationFn: async (stakeId) => {
      const result = await base44.functions.claimStakingRewards({ stakeId });
      
      if (!result.success) {
        throw new Error(result.error || 'Claim failed');
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stakes'] });
      queryClient.invalidateQueries({ queryKey: ['myClient'] });
      toast.success(`Claimed ${data.data.rewards_claimed} tokens!`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to claim rewards');
    }
  });

  const unstakeMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(unstakeAmount);
      if (!amount || amount <= 0) throw new Error('Invalid amount');
      if (!selectedStakeForUnstake) throw new Error('No stake selected');

      const result = await base44.functions.unstakeTokens({
        stakeId: selectedStakeForUnstake,
        amountToUnstake: amount
      });

      if (!result.success) {
        throw new Error(result.error || 'Unstaking failed');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stakes'] });
      queryClient.invalidateQueries({ queryKey: ['myClient'] });
      setUnstakeAmount('');
      setSelectedStakeForUnstake(null);
      toast.success('Tokens unstaked successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to unstake tokens');
    }
  });

  const stakingPools = [
    { id: 'flexible', name: 'Flexible', apy: 5, lockDays: 0, description: 'Unstake anytime' },
    { id: '30day', name: '30 Days', apy: 8, lockDays: 30, description: 'Higher returns' },
    { id: '90day', name: '90 Days', apy: 12, lockDays: 90, description: 'Best APY' }
  ];

  const calculatePendingRewards = (stake) => {
    const now = new Date();
    const lastClaim = new Date(stake.last_reward_claim);
    const daysSinceClaim = (now - lastClaim) / (1000 * 60 * 60 * 24);
    
    const dailyRate = stake.apy_rate / 365 / 100;
    return stake.amount_staked * dailyRate * daysSinceClaim;
  };

  const totalStaked = stakes.reduce((sum, s) => sum + s.amount_staked, 0);
  const totalRewards = stakes.reduce((sum, s) => sum + calculatePendingRewards(s), 0);

  if (!user || !client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400">Please log in to view staking</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Token Staking</h1>
        <p className="text-slate-400 mt-1">Earn rewards by staking your tokens</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Available Balance</p>
                <p className="text-2xl font-bold text-white">{(client.tokenBalance || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">{companyToken?.token_symbol || 'MLT'}</p>
              </div>
              <Coins className="w-10 h-10 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Staked</p>
                <p className="text-2xl font-bold text-indigo-400">{totalStaked.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">{stakes.length} active stakes</p>
              </div>
              <Lock className="w-10 h-10 text-indigo-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Pending Rewards</p>
                <p className="text-2xl font-bold text-emerald-400">+{totalRewards.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Across all stakes</p>
              </div>
              <Gift className="w-10 h-10 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staking Pools */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Stake Tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stakingPools.map(pool => (
              <button
                key={pool.id}
                onClick={() => setSelectedPool(pool.id)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedPool === pool.id
                    ? 'border-yellow-400 bg-yellow-400/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-white">{pool.name}</p>
                  <p className="text-2xl font-bold text-yellow-400 my-2">{pool.apy}% APY</p>
                  <p className="text-xs text-slate-400">{pool.description}</p>
                  {pool.lockDays > 0 && (
                    <p className="text-xs text-slate-500 mt-2">🔒 {pool.lockDays} days lock</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <Label>Amount to Stake</Label>
              <Input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0"
                className="bg-slate-800 border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">
                Available: {(client.tokenBalance || 0).toLocaleString()} {companyToken?.token_symbol || 'MLT'}
              </p>
            </div>

            <Button
              onClick={() => stakeMutation.mutate()}
              disabled={!stakeAmount || stakeMutation.isPending}
              className="w-full bg-yellow-400 text-slate-900 hover:bg-yellow-500"
            >
              {stakeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Stake Tokens
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Stakes */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Your Active Stakes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStakes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
            </div>
          ) : stakes.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No active stakes</p>
          ) : (
            <div className="space-y-4">
              {stakes.map(stake => {
                const pendingRewards = calculatePendingRewards(stake);
                const unlockDate = new Date(stake.unlock_date);
                const isLocked = unlockDate > new Date();
                const daysRemaining = Math.max(0, Math.ceil((unlockDate - new Date()) / (1000 * 60 * 60 * 24)));

                return (
                  <div key={stake.id} className="bg-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-white">{stake.amount_staked.toLocaleString()} {companyToken?.token_symbol || 'MLT'}</p>
                        <p className="text-sm text-slate-400">{stake.apy_rate}% APY • {stake.lock_period_days} days lock</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-emerald-400">+{pendingRewards.toFixed(2)} rewards</p>
                        {isLocked ? (
                          <p className="text-xs text-yellow-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {daysRemaining} days left
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-400 flex items-center gap-1">
                            <Unlock className="w-3 h-3" />
                            Unlocked
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => claimMutation.mutate(stake.id)}
                        disabled={claimMutation.isPending || pendingRewards < 0.01}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {claimMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        Claim Rewards
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedStakeForUnstake(stake.id);
                          setUnstakeAmount(stake.amount_staked.toString());
                        }}
                        disabled={isLocked}
                        className="border-slate-700"
                      >
                        Unstake
                      </Button>
                    </div>

                    <p className="text-xs text-slate-500">
                      Started: {format(new Date(stake.start_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}