import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DataTable from '@/components/ui/DataTable';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Phone,
  Wallet,
  Coins,
  ArrowLeft,
  Loader2,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";
import webhookService from '@/components/services/webhookService';
import QuickAddClient from '@/components/company/QuickAddClient';
import FreeTokensQR from '@/components/company/FreeTokensQR';

export default function ClientsTab({ companyId }) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    full_name: ''
  });

  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }, '-created_date'),
    enabled: !!companyId,
  });

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => base44.entities.Company.filter({ id: companyId }),
    enabled: !!companyId,
    select: (data) => data[0]
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create({
      ...data,
      company_id: companyId,
      current_balance: 0,
      total_earned: 0,
      total_redeemed: 0
    }),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDialogOpen(false);
      setFormData({ phone: '', email: '', full_name: '' });
      toast.success('Customer added successfully.');
      
      webhookService.trigger('client_created', {
        client_id: newClient.id,
        company_id: companyId,
        phone: newClient.phone,
        full_name: newClient.full_name,
        timestamp: new Date().toISOString()
      }, companyId);
    },
  });

  const filteredClients = clients.filter(c => 
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pointsName = company?.points_name || 'Points';

  const columns = [
    { 
      header: 'client', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-white font-medium">
              {row.full_name?.charAt(0) || row.phone?.charAt(0) || '?'}
            </span>
          </div>
          <div>
            <p className="font-medium text-white">{row.full_name || 'Unnamed'}</p>
            <div className="flex items-center gap-1 text-sm text-slate-400">
              <Phone className="w-3 h-3" />
              {row.phone}
            </div>
          </div>
        </div>
      )
    },
    { 
      header: 'Email', 
      cell: (row) => <span className="text-slate-300">{row.email || '-'}</span>
    },
    { 
      header: 'balance', 
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-white">
            {(row.current_balance || 0).toLocaleString()}
          </span>
          <span className="text-sm text-slate-400">{pointsName}</span>
        </div>
      )
    },
    { 
      header: 'Total accumulation', 
      cell: (row) => (
        <span className="text-emerald-600 font-medium">
          +{(row.total_earned || 0).toLocaleString()}
        </span>
      )
    },
    { 
      header: 'Total realization', 
      cell: (row) => (
        <span className="text-purple-600 font-medium">
          -{(row.total_redeemed || 0).toLocaleString()}
        </span>
      )
    },
    { 
      header: 'wallet', 
      cell: (row) => (
        row.wallet_address ? (
          <div className="flex items-center gap-1 text-sm">
            <Wallet className="w-3 h-3 text-indigo-500" />
            <code className="text-xs text-indigo-300" dir="ltr">
              {row.wallet_address.substring(0, 8)}...
            </code>
          </div>
        ) : (
          <span className="text-slate-400 text-sm">Not connected</span>
        )
      )
    },
    { 
      header: 'Join', 
      cell: (row) => <span className="text-slate-400">{row.created_date ? format(new Date(row.created_date), 'dd/MM/yy') : '-'}</span>
    },
    {
      header: '',
      cell: (row) => (
        <Link to={createPageUrl(`ClientDetails?id=${row.id}`)}>
          <Button variant="ghost" size="sm" className="text-yellow-400 hover:bg-slate-800">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
      )
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left column - Main content (2 columns) */}
      <div className="col-span-2 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Customer management</h2>
          <p className="text-slate-400 mt-1">
            {clients.length.toLocaleString()}Registered customers
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600">
              <Plus className="w-4 h-4 ml-2" />
             Adding a customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>New customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label> Phone number*</Label>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="050-1234567"
                />
              </div>
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input 
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancellation
              </Button>
              <Button 
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.phone || createMutation.isPending}
                className="bg-gradient-to-r from-indigo-500 to-purple-600"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Total customers</p>
          <p className="text-2xl font-bold text-white">{clients.length}</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">With a wallet</p>
          <p className="text-2xl font-bold text-indigo-400">
            {clients.filter(c => c.wallet_address).length}
          </p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Total {pointsName} activity</p>
          <p className="text-2xl font-bold text-emerald-400">
            {clients.reduce((s, c) => s + (c.current_balance || 0), 0).toLocaleString()}
          </p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm p-4">
          <p className="text-sm text-slate-400">Average per customer</p>
          <p className="text-2xl font-bold text-white">
            {clients.length > 0 
              ? Math.round(clients.reduce((s, c) => s + (c.current_balance || 0), 0) / clients.length).toLocaleString()
              : 0
            }
          </p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input 
          placeholder="Search by phone, email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10 bg-slate-900 border-slate-800 text-white"
        />
      </div>

        {/* Table */}
        <Card className="border-slate-800 bg-slate-900 shadow-sm">
          <CardContent className="p-0">
            <DataTable 
              columns={columns}
              data={filteredClients}
              isLoading={isLoading}
              emptyMessage="No customers found"
            />
          </CardContent>
        </Card>
      </div>

      {/* Right column - Quick actions (1 column) */}
      <div className="space-y-4">
        <QuickAddClient companyId={companyId} />
        <FreeTokensQR companyId={companyId} />
      </div>
    </div>
  );
}