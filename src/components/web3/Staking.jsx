import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Coins, 
  Lock, 
  Unlock, 
  TrendingUp, 
  Clock,
  Gift,
  Loader2,
  Info
} from 'lucide-react';
import { toast } from "sonner";
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function Staking({ client, company }) {
  const [activeTab, setActiveTab] = useState('stake');
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState('0');
  const queryClient = useQueryClient();

  // Staking pools
  const stakingPools = [
    { id: '0', name: 'Flexible', apy: 12, lockDays: 0, risk: 'Low' },
    { id: '90', name: '90 Days', apy: 15, lockDays: 90, risk: 'Medium' },
    { id: '180', name: '180 Days', apy: 18, lockDays: 180, risk: 'Medium' },
    { id: '365', name: '365 Days', apy: 25, lockDays: 365, risk: 'High' }
  ];

  // Fetch active stakes
  const { data: stakes = [], refetch: refetchStakes } = useQuery({
    queryKey: ['stakes', client?.id],
    queryFn: () => base44.entities.Stake.filter({ client_id: client?.id, status: 'active' }),
    enabled: !!client?.id,
  });

  // Calculate total staked and rewards
  const totalStaked = stakes.reduce((sum, stake) => sum + (stake.amount_staked || 0), 0);
  const totalRewards = stakes.reduce((sum, stake) => {
    const daysSinceLastClaim = (Date.now() - new Date(stake.last_reward_claim).getTime()) / (1000 * 60 * 60 * 24);
    const reward = (stake.amount_staked * (stake.apy_rate / 100) * daysSinceLastClaim) / 365;
    return sum + reward;
  }, 0);

  const selectedPoolData = stakingPools.find(p => p.id === selectedPool) || stakingPools[0];

  const stakeMutation = useMutation({
    mutationFn: (data) => base44.functions.stakeTokens(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.data.amountStaked} tokens staked!`);
        setStakeAmount('');
        refetchStakes();
        queryClient.invalidateQueries(['clients']);
      } else {
        toast.error(result.error || 'Staking error');
      }
    },
    onError: () => toast.error('Staking error')
  });

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (amount > (client.tokenBalance || 0)) {
      toast.error('Insufficient balance');
      return;
    }

    stakeMutation.mutate({
      clientId: client.id,
      amountToStake: amount,
      lockPeriodDays: parseInt(selectedPool)
    });
  };

  const unstakeMutation = useMutation({
    mutationFn: (data) => base44.functions.unstakeTokens(data),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.data.amountUnstaked} tokens unstaked!`);
        setUnstakeAmount('');
        refetchStakes();
        queryClient.invalidateQueries(['clients']);
      } else {
        toast.error(result.error || 'Unstaking error');
      }
    },
    onError: () => toast.error('Unstaking error')
  });

  const claimRewardsMutation = useMutation({
    mutationFn: (stakeId) => base44.functions.claimStakingRewards({ stakeId }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.data.rewardsClaimed.toFixed(2)} tokens claimed as reward!`);
        refetchStakes();
        queryClient.invalidateQueries(['clients']);
      } else {
        toast.error(result.error || 'Error claiming rewards');
      }
    },
    onError: () => toast.error('Error claiming rewards')
  });

  const handleUnstake = async (stake) => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const amount = parseFloat(unstakeAmount);
    unstakeMutation.mutate({
      stakeId: stake.id,
      amountToUnstake: amount
    });
  };

  const handleClaimRewards = async (stakeId) => {
    claimRewardsMutation.mutate(stakeId);
  };

  const calculateProgress = (stake) => {
    if (!stake.start_date) return 0;
    const daysPassed = (Date.now() - new Date(stake.start_date).getTime()) / (1000 * 60 * 60 * 24);
    return Math.min((daysPassed / stake.lock_period_days) * 100, 100);
  };

  const calculatePendingRewards = (stake) => {
    const daysSinceLastClaim = (Date.now() - new Date(stake.last_reward_claim).getTime()) / (1000 * 60 * 60 * 24);
    const reward = (stake.amount_staked * (stake.apy_rate / 100) * daysSinceLastClaim) / 365;
    return Math.floor(reward * 100) / 100;
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-gradient-to-br from-indigo-900 to-indigo-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="w-5 h-5 text-indigo-300" />
              <p className="text-sm text-indigo-200">Total Staked</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {totalStaked.toLocaleString()}
            </p>
            <p className="text-xs text-indigo-300 mt-1">tokens</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-gradient-to-br from-emerald-900 to-emerald-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Gift className="w-5 h-5 text-emerald-300" />
              <p className="text-sm text-emerald-200">Rewards</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {totalRewards.toFixed(2)}
            </p>
            <p className="text-xs text-emerald-300 mt-1">tokens</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-gradient-to-br from-purple-900 to-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-300" />
              <p className="text-sm text-purple-200">APY</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {selectedPoolData.apy}%
            </p>
            <p className="text-xs text-purple-300 mt-1">Annual yield</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Stakes */}
      {stakes.length > 0 && (
        <div className="space-y-3">
          {stakes.map((stake) => {
            const pendingRewards = calculatePendingRewards(stake);
            const daysRemaining = Math.max(0, Math.ceil((new Date(stake.unlock_date) - Date.now()) / (1000 * 60 * 60 * 24)));
            
            return (
              <Card key={stake.id} className="border-slate-800 bg-slate-900">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-slate-400">Staked Amount</p>
                      <p className="text-2xl font-bold text-white">{stake.amount_staked.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Pending Rewards</p>
                      <p className="text-xl font-bold text-emerald-400">{pendingRewards.toFixed(2)}</p>
                    </div>
                  </div>
                  
                  {stake.lock_period_days > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-300">Lock Progress</span>
                        <span className="text-sm font-medium text-white">{Math.round(calculateProgress(stake))}%</span>
                      </div>
                      <Progress value={calculateProgress(stake)} className="h-2 bg-slate-800" />
                      <p className="text-xs text-slate-400 mt-1">
                        {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Unlocked'}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleClaimRewards(stake.id)}
                      disabled={pendingRewards < 0.01 || claimRewardsMutation.isPending}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      size="sm"
                    >
                      {claimRewardsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Claim Rewards'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Main Interface */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Staking Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 bg-slate-800">
              <TabsTrigger value="stake">Stake</TabsTrigger>
              <TabsTrigger value="unstake">Unstake</TabsTrigger>
              <TabsTrigger value="pools">Pools</TabsTrigger>
            </TabsList>

            <TabsContent value="stake" className="space-y-4 mt-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-2">Available balance</p>
                <p className="text-2xl font-bold text-white">
                  {(client?.tokenBalance || 0).toLocaleString()} tokens
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Select Pool</Label>
                <Select value={selectedPool} onValueChange={setSelectedPool}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stakingPools.map(pool => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {pool.name} - {pool.apy}% APY ({pool.lockDays} days)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Amount to Stake</Label>
                <Input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0"
                  className="bg-slate-800 border-slate-700 text-white text-lg"
                />
              </div>

              <Button
                onClick={handleStake}
                disabled={stakeMutation.isPending || !stakeAmount}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                {stakeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    Staking...
                    </>
                    ) : (
                    <>
                    <Lock className="w-4 h-4 ml-2" />
                    Stake Tokens
                  </>
                )}
              </Button>

              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 flex gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300">
                  Yield: {selectedPoolData.apy}% APY | Lock: {selectedPoolData.lockDays} days | Risk: {selectedPoolData.risk}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="unstake" className="space-y-4 mt-4">
              {stakes.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>You have no staked tokens</p>
                </div>
              ) : (
                stakes.map(stake => (
                  <Card key={stake.id} className="bg-slate-800 border-slate-700">
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-400">Staked</p>
                          <p className="text-xl font-bold text-white">{stake.amount_staked.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">APY</p>
                          <p className="text-xl font-bold text-emerald-400">{stake.apy_rate}%</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-300">Amount to Unstake</Label>
                        <Input
                          type="number"
                          value={unstakeAmount}
                          onChange={(e) => setUnstakeAmount(e.target.value)}
                          placeholder="0"
                          max={stake.amount_staked}
                          className="bg-slate-900 border-slate-700 text-white"
                        />
                      </div>

                      <Button
                        onClick={() => handleUnstake(stake)}
                        disabled={unstakeMutation.isPending || !unstakeAmount}
                        variant="outline"
                        className="w-full border-slate-600"
                      >
                        {unstakeMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                            Unstaking...
                            </>
                            ) : (
                            <>
                            <Unlock className="w-4 h-4 ml-2" />
                            Unstake Tokens
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="pools" className="mt-4">
              <div className="space-y-3">
                {stakingPools.map(pool => (
                  <Card
                    key={pool.id}
                    className="bg-slate-800 border-slate-700 hover:border-indigo-500 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedPool(pool.id);
                      setActiveTab('stake');
                    }}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white">{pool.name}</h4>
                        <span className="text-2xl font-bold text-emerald-400">{pool.apy}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Period: {pool.lockDays} days</span>
                        <span>Risk: {pool.risk}</span>
                      </div>
                      {pool.lockDays === 0 && (
                        <p className="text-xs text-blue-400 mt-2">No lock - withdraw anytime</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}