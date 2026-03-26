import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Loader2,
  ExternalLink,
  Database,
  Coins,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Copy
} from 'lucide-react';
import { toast } from "sonner";

export default function BlockchainTesting() {
  const { user, primaryCompanyId } = useUserPermissions();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [testResult, setTestResult] = useState(null);

  const queryClient = useQueryClient();

  const { data: client, refetch: refetchClient } = useQuery({
    queryKey: ['testClient', primaryCompanyId, phone],
    queryFn: async () => {
      if (!phone || !primaryCompanyId) return null;
      const clients = await base44.entities.Client.filter({
        company_id: primaryCompanyId,
        phone: phone
      });
      return clients[0] || null;
    },
    enabled: !!phone && !!primaryCompanyId
  });

  const { data: companyToken, refetch: refetchToken } = useQuery({
    queryKey: ['testCompanyToken', primaryCompanyId],
    queryFn: async () => {
      if (!primaryCompanyId) return null;
      const tokens = await base44.entities.CompanyToken.filter({
        company_id: primaryCompanyId
      });
      return tokens[0] || null;
    },
    enabled: !!primaryCompanyId
  });

  const testTransactionMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('createPOSTransaction', {
        phone: phone,
        amount: parseFloat(amount),
        order_id: `TEST-${Date.now()}`,
        company_id: primaryCompanyId,
        branch_id: 'test',
        reward_type: 'points'
      });
      return response.data;
    },
    onSuccess: async (data) => {
      setTestResult(data);
      await refetchClient();
      await refetchToken();
      toast.success('Test transaction completed!');
    },
    onError: (error) => {
      toast.error('Transaction failed: ' + error.message);
      setTestResult({ error: error.message });
    }
  });

  const syncBalanceMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('syncTreasuryBalance', {
        companyId: primaryCompanyId
      });
      return response.data;
    },
    onSuccess: () => {
      refetchToken();
      toast.success('Treasury balance synced!');
    }
  });

  const handleTest = async () => {
    if (!phone || !amount) {
      toast.error('Please enter phone and amount');
      return;
    }
    setTestResult(null);
    testTransactionMutation.mutate();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Blockchain Testing Lab</h1>
        <p className="text-sm text-[#9ca3af] mt-1">Test and debug blockchain transactions in real-time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Test Controls */}
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="border-b border-[#2d2d3a] p-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <Zap className="w-4 h-4" />
              Test Transaction
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-[#9ca3af]">Customer Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+972501234567"
                dir="ltr"
                className="bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[#9ca3af]">Purchase Amount ($)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                dir="ltr"
                className="bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>

            <Button
              onClick={handleTest}
              disabled={testTransactionMutation.isPending}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white"
            >
              {testTransactionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Create Test Transaction
                </>
              )}
            </Button>

            {/* Client Before State */}
            {client && (
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
                <div className="flex items-center gap-2 text-[#9ca3af] mb-2">
                  <Database className="w-3.5 h-3.5" />
                  <span className="font-medium text-xs">Before Transaction</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#9ca3af]">Stars (DB):</span>
                    <span className="font-semibold text-white">{client.current_balance || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9ca3af]">Tokens (DB):</span>
                    <span className="font-semibold text-white">{client.tokenBalance || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9ca3af]">Wallet:</span>
                    <code className="text-xs font-mono text-[#10b981]">{client.wallet_address?.substring(0, 10)}...</code>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="border-b border-[#2d2d3a] p-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle className="w-4 h-4" />
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {!testResult ? (
              <div className="text-center py-12 text-[#9ca3af]">
                <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Run a test transaction to see results</p>
              </div>
            ) : testResult.error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 font-medium text-sm">❌ Transaction Failed</p>
                <p className="text-xs text-red-400/80 mt-1">{testResult.error}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Success Badge */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="font-semibold text-green-400 text-sm">Transaction Successful!</span>
                  </div>
                </div>

                {/* Points Earned */}
                <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9ca3af] text-xs">Points Earned:</span>
                    <span className="text-xl font-bold text-[#10b981]">
                      +{testResult.points?.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Blockchain TX Hash */}
                {testResult.blockchain_tx_hash && (
                  <div className="space-y-2">
                    <Label className="text-xs text-[#9ca3af]">Blockchain Transaction</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-[#17171f] border border-[#2d2d3a] px-3 py-2 rounded font-mono overflow-hidden text-ellipsis text-[#10b981]">
                        {testResult.blockchain_tx_hash}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(testResult.blockchain_tx_hash);
                          toast.success('Copied!');
                        }}
                        className="bg-[#17171f] border-[#2d2d3a] text-white hover:bg-[#2d2d3a]"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    {testResult.explorer_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full bg-[#17171f] border-[#2d2d3a] text-white hover:bg-[#2d2d3a]"
                        onClick={() => window.open(testResult.explorer_url, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-2" />
                        View on SnowTrace
                      </Button>
                    )}
                  </div>
                )}

                {/* Client After State */}
                {client && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="font-medium text-xs">After Transaction</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#9ca3af]">Stars (DB):</span>
                        <span className="font-semibold text-green-400">{client.current_balance || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#9ca3af]">Tokens (DB):</span>
                        <span className="font-semibold text-green-400">{client.tokenBalance || 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Treasury Balance */}
      {companyToken && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="border-b border-[#2d2d3a] p-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Coins className="w-4 h-4" />
                Treasury Balance
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => syncBalanceMutation.mutate()}
                disabled={syncBalanceMutation.isPending}
                className="bg-[#10b981] hover:bg-[#059669] text-white border-0 h-7 px-3"
              >
                {syncBalanceMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  'Sync'
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
                <div className="text-xs text-[#9ca3af] mb-1">Treasury (DB)</div>
                <div className="text-2xl font-semibold text-white">
                  {companyToken.treasury_balance?.toLocaleString() || 0}
                </div>
              </div>
              
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
                <div className="text-xs text-[#9ca3af] mb-1">Distributed</div>
                <div className="text-2xl font-semibold text-white">
                  {companyToken.distributed_tokens?.toLocaleString() || 0}
                </div>
              </div>
              
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
                <div className="text-xs text-[#9ca3af] mb-1">Remaining</div>
                <div className="text-2xl font-semibold text-[#10b981]">
                  {((companyToken.treasury_balance || 0) - (companyToken.distributed_tokens || 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}