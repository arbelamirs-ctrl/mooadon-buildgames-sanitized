import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Search, 
  Filter,
  BookOpen,
  Plus,
  Minus,
  ArrowLeftRight,
  Settings,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";
import { useUserPermissions } from '@/components/auth/useUserPermissions';

export default function LedgerEvents() {
  const { primaryCompanyId, loading: permissionsLoading, user } = useUserPermissions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({
    client_id: '',
    points: 0,
    description: ''
  });

  const queryClient = useQueryClient();

  const companyId = primaryCompanyId;

  const { data: ledgerEvents = [], isLoading } = useQuery({
    queryKey: ['ledger', companyId],
    queryFn: () => base44.entities.LedgerEvent.filter({ company_id: companyId }, '-created_date', 500),
    enabled: !!companyId,
    refetchInterval: 5000,
    staleTime: 0, // Always refetch on interval for real-time updates
    gcTime: 5 * 60_000,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const getClientInfo = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? { phone: client.phone, name: client.full_name } : { phone: '-', name: '' };
  };

  const adjustMutation = useMutation({
    mutationFn: async (data) => {
      const client = clients.find(c => c.id === data.client_id);
      if (!client) throw new Error('Client not found');
      
      const balanceBefore = client.current_balance || 0;
      const balanceAfter = balanceBefore + data.points;
      
      // Create ledger event
      await base44.entities.LedgerEvent.create({
        company_id: companyId,
        client_id: data.client_id,
        type: 'adjust',
        points: data.points,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        source: 'admin',
        description: data.description,
        performed_by: user?.email
      });
      
      // Update client balance
      await base44.entities.Client.update(data.client_id, {
        current_balance: balanceAfter,
        total_earned: data.points > 0 ? (client.total_earned || 0) + data.points : client.total_earned,
        total_redeemed: data.points < 0 ? (client.total_redeemed || 0) + Math.abs(data.points) : client.total_redeemed
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger', companyId] });
      queryClient.invalidateQueries({ queryKey: ['clients', companyId] });
      setAdjustDialogOpen(false);
      setAdjustData({ client_id: '', points: 0, description: '' });
      toast.success('Adjustment completed successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Error performing adjustment');
    }
  });

  let filteredEvents = ledgerEvents.filter(e => {
    const clientInfo = getClientInfo(e.client_id);
    return clientInfo.phone?.includes(search);
  });

  if (typeFilter !== 'all') {
    filteredEvents = filteredEvents.filter(e => e.type === typeFilter);
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'earn': return <Plus className="w-4 h-4 text-emerald-600" />;
      case 'redeem': return <Minus className="w-4 h-4 text-purple-600" />;
      case 'transfer': return <ArrowLeftRight className="w-4 h-4 text-blue-600" />;
      case 'adjust': return <Settings className="w-4 h-4 text-amber-600" />;
      default: return <BookOpen className="w-4 h-4 text-slate-600" />;
    }
  };

  const columns = [
    { 
      header: 'Type', 
      cell: (row) => (
        <div className="flex items-center gap-2">
          {getTypeIcon(row.type)}
          <StatusBadge status={row.type} />
        </div>
      )
    },
    { 
      header: 'Client', 
      cell: (row) => {
        const info = getClientInfo(row.client_id);
        return (
          <div>
            <p className="font-medium text-white">{info.phone}</p>
            {info.name && <p className="text-sm text-slate-400">{info.name}</p>}
          </div>
        );
      }
    },
    { 
      header: 'Points', 
      cell: (row) => (
        <span className={`font-bold ${row.points >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {(row.points || 0) >= 0 ? '+' : ''}{(row.points || 0).toLocaleString()}
        </span>
      )
    },
    { 
      header: 'Balance Before', 
      cell: (row) => <span className="text-slate-300">{(row.balance_before || 0).toLocaleString()}</span>
    },
    { 
      header: 'Balance After', 
      cell: (row) => (
        <span className="font-medium text-white">{(row.balance_after || 0).toLocaleString()}</span>
      )
    },
    { 
      header: 'Source', 
      cell: (row) => (
        <span className="text-sm capitalize text-slate-300">{row.source}</span>
      )
    },
    { 
      header: 'Description', 
      cell: (row) => {
        const txHash = row.metadata?.tx_hash;
        return (
          <div className="space-y-1">
            <span className="text-sm text-slate-400 truncate max-w-[150px] block">
              {row.description || '-'}
            </span>
            {txHash && (
              <a 
                href={`https://testnet.snowtrace.io/tx/${txHash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="truncate max-w-[120px]" dir="ltr">
                  {txHash.substring(0, 6)}...{txHash.slice(-4)}
                </span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        );
      }
    },
    { 
      header: 'date', 
      cell: (row) => (
        <span className="text-slate-400">
          {row.created_date ? format(new Date(row.created_date), 'dd/MM/yy HH:mm') : '-'}
        </span>
      )
    },
  ];

  const stats = {
    total: ledgerEvents.length,
    earned: ledgerEvents.filter(e => e.type === 'earn').reduce((s, e) => s + (e.points || 0), 0),
    redeemed: Math.abs(ledgerEvents.filter(e => e.type === 'redeem').reduce((s, e) => s + (e.points || 0), 0)),
    adjusted: ledgerEvents.filter(e => e.type === 'adjust').reduce((s, e) => s + (e.points || 0), 0)
  };

  if (permissionsLoading || !companyId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }



  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Ledger Events</h1>
          <p className="text-sm text-[#9ca3af] mt-1">Complete balance change history</p>
        </div>
        <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#10b981] hover:bg-[#059669]">
              <Settings className="w-4 h-4 ml-2" />
              Adjust Points
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>Adjust Client Points</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Client</Label>
                <Select 
                  value={adjustData.client_id} 
                  onValueChange={(v) => setAdjustData({...adjustData, client_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsLoading ? (
                      <div className="p-2 text-center text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      </div>
                    ) : clients.length === 0 ? (
                      <div className="p-2 text-center text-slate-400">No clients found</div>
                    ) : (
                      clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.phone} - {client.full_name || 'No name'}
                          <span className="text-slate-500 mr-2">
                            (Balance: {(client.current_balance || 0).toLocaleString()})
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Points Amount (positive to add, negative to deduct)</Label>
                <Input 
                  type="number"
                  value={adjustData.points}
                  onChange={(e) => setAdjustData({...adjustData, points: Number(e.target.value)})}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Reason / Description</Label>
                <Textarea 
                value={adjustData.description}
                onChange={(e) => setAdjustData({...adjustData, description: e.target.value})}
                placeholder="e.g., Customer compensation / error correction"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => adjustMutation.mutate(adjustData)}
                disabled={!adjustData.client_id || adjustData.points === 0 || adjustMutation.isPending}
                className="bg-[#10b981] hover:bg-[#059669]"
              >
                {adjustMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                Make Adjustment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <p className="text-xs text-[#9ca3af]">Total Events</p>
          <p className="text-2xl font-semibold text-white">{stats.total}</p>
        </Card>
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <p className="text-xs text-[#9ca3af]">Total Earned</p>
          <p className="text-2xl font-semibold text-green-400">+{(stats.earned || 0).toLocaleString()}</p>
        </Card>
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <p className="text-xs text-[#9ca3af]">Total Redeemed</p>
          <p className="text-2xl font-semibold text-purple-400">-{(stats.redeemed || 0).toLocaleString()}</p>
        </Card>
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <p className="text-xs text-[#9ca3af]">Adjustments</p>
          <p className="text-2xl font-semibold text-amber-400">{(stats.adjusted || 0).toLocaleString()}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Search by customer phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-[#1f2128] border-[#2d2d3a] text-white"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 bg-[#1f2128] border-[#2d2d3a] text-white">
            <Filter className="w-4 h-4 ml-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="earn">Earned</SelectItem>
            <SelectItem value="redeem">Redeemed</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="adjust">Adjustment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-0">
          <DataTable 
            columns={columns}
            data={filteredEvents}
            isLoading={isLoading}
            emptyMessage="No events found"
          />
        </CardContent>
      </Card>
    </div>
  );
}