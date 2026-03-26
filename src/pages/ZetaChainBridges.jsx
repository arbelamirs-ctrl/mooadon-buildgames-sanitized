import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink, Bitcoin, Coins, Loader2, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';

export default function ZetaChainBridges() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  React.useEffect(() => {
    loadUser();
  }, []);
  
  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      base44.auth.redirectToLogin();
    } finally {
      setLoading(false);
    }
  };
  
  const { data: bridges = [], isLoading, refetch } = useQuery({
    queryKey: ['zetachain-bridges'],
    queryFn: () => base44.entities.ZetaChainBridge.list('-created_date', 100),
    enabled: !!user,
    refetchInterval: 10000 // Refresh every 10 seconds
  });
  
  const statusConfig = {
    pending: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-400', label: 'Pending' },
    processing: { icon: Loader2, color: 'bg-blue-500/20 text-blue-400', label: 'Processing', spin: true },
    completed: { icon: CheckCircle2, color: 'bg-green-500/20 text-green-400', label: 'Completed' },
    failed: { icon: XCircle, color: 'bg-red-500/20 text-red-400', label: 'Failed' },
    reverted: { icon: XCircle, color: 'bg-orange-500/20 text-orange-400', label: 'Reverted' }
  };
  
  const chainIcons = {
    avalanche_fuji: '🔺',
    avalanche: '🔺',
    zetachain: 'Ζ',
    bitcoin: '₿',
    ethereum: 'Ξ',
    bsc: '🔶',
    polygon: '💜'
  };
  
  const columns = [
    {
      header: 'Date',
      render: (row) => new Date(row.created_date).toLocaleString('en-US')
    },
    {
      header: 'Route',
      render: (row) => (
        <div className="flex items-center gap-2 text-sm">
          <span>{chainIcons[row.source_chain]} {row.source_chain}</span>
          <ArrowRight className="w-3 h-3 text-[#9ca3af]" />
          <span>{chainIcons[row.destination_chain]} {row.destination_chain}</span>
        </div>
      )
    },
    {
      header: 'Amount',
      render: (row) => (
        <div className="text-sm">
          <div className="font-mono">{row.amount_in} {row.token_in}</div>
          {row.amount_out && (
            <div className="text-xs text-[#9ca3af]">→ {row.amount_out} {row.token_out}</div>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      render: (row) => {
        const config = statusConfig[row.status] || statusConfig.pending;
        const Icon = config.icon;
        return (
          <Badge className={config.color}>
            <Icon className={`w-3 h-3 mr-1 ${config.spin ? 'animate-spin' : ''}`} />
            {config.label}
          </Badge>
        );
      }
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          {row.zeta_cctx_index && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`https://athens.explorer.zetachain.com/cc/tx/${row.zeta_cctx_index}`, '_blank')}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
        </div>
      )
    }
  ];
  
  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }
  
  // Stats
  const stats = {
    total: bridges.length,
    completed: bridges.filter(b => b.status === 'completed').length,
    processing: bridges.filter(b => b.status === 'processing').length,
    failed: bridges.filter(b => b.status === 'failed').length
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ZetaChain Cross-Chain Bridges</h1>
          <p className="text-sm text-[#9ca3af]">Track cross-chain transfers via ZetaChain</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="border-[#2d2d3a] text-white gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-[#9ca3af]">Total Transfers</div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-xs text-[#9ca3af]">Completed</div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.processing}</div>
            <div className="text-xs text-[#9ca3af]">Processing</div>
          </CardContent>
        </Card>
        
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
            <div className="text-xs text-[#9ca3af]">Failed</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Bridges Table */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-lg text-white">Transfer History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={bridges}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
      
      {/* Info Box */}
      <Card className="bg-teal-500/10 border-teal-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Coins className="w-5 h-5 text-teal-400 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="text-white font-medium">What is ZetaChain?</p>
              <p className="text-[#9ca3af]">
                ZetaChain enables you to transfer tokens between different networks without traditional bridges.
                Your tokens on Avalanche can be redeemed directly to Bitcoin, Ethereum, or any other network.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}