import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Building2,
  ArrowLeft,
  Loader2,
  Settings,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";
import webhookService from '@/components/services/webhookService';

export default function Companies() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    status: 'active',
    points_name: 'Points',
    points_to_currency_ratio: 100
  });

  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date', 100),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 1000),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const newCompany = await base44.entities.Company.create(data);
      
      // Provision wallet and tokens
      try {
        console.log('🪙 Provisioning company wallet and tokens...');
        
        // Create wallet
        await base44.functions.invoke('createCompanyWallet', {
          companyId: newCompany.id
        });
        
        // Generate tokens
        await base44.functions.invoke('generateCompanyTokens', {
          company_id: newCompany.id,
          tokenName: `${newCompany.name} Token`,
          tokenSymbol: newCompany.name.substring(0, 4).toUpperCase(),
          initialSupply: '1000000'
        });
        
        // Fund with AVAX
        await base44.asServiceRole.functions.invoke('fundNewCompanyTreasury', {
          company_id: newCompany.id,
          avax_amount: 1.0
        });
        
        console.log('✅ Company provisioned successfully');
      } catch (provisionError) {
        console.error('⚠️ Provisioning error (non-critical):', provisionError);
        toast.warning('Company created but wallet setup failed. Complete setup from Company Settings.');
      }
      
      return newCompany;
    },
    onSuccess: (newCompany) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDialogOpen(false);
      setFormData({ name: '', status: 'active', points_name: 'Points', points_to_currency_ratio: 100 });
      toast.success('Company created successfully');
      
      // Trigger webhook
      webhookService.trigger('company_created', {
        company_id: newCompany.id,
        name: newCompany.name,
        status: newCompany.status,
        timestamp: new Date().toISOString()
      }, null);
    },
    onError: (err) => {
      toast.error('Error creating company');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (company) => {
      // Delete UserPermissions for this company
      const permissions = await base44.entities.UserPermission.filter({ company_id: company.id });
      for (const perm of permissions) {
        await base44.entities.UserPermission.delete(perm.id);
      }
      // Delete the company itself (NOT CompanyToken)
      await base44.entities.Company.delete(company.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Business and user permissions deleted successfully');
    },
    onError: () => {
      toast.error('Error deleting business');
    }
  });

  const handleDelete = async (company) => {
    if (window.confirm(`Are you sure you want to delete ${company.name}?\n\nUser permissions will also be deleted (tokens will be kept).\nThis action is irreversible.`)) {
      deleteMutation.mutate(company);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { 
      header: 'Business', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-white">{row.name}</p>
            <p className="text-sm text-slate-400">{row.points_name || 'Points'}</p>
          </div>
        </div>
      )
    },
    { 
      header: 'Status', 
      cell: (row) => <StatusBadge status={row.status || 'active'} />
    },
    { 
      header: 'Clients',
      className: 'hidden sm:table-cell',
      cell: (row) => (
        <span className="font-medium text-white">
          {clients.filter(c => c.company_id === row.id).length.toLocaleString()}
        </span>
      )
    },
    { 
      header: 'Network',
      className: 'hidden md:table-cell',
      cell: (row) => {
        const network = row.onchain_network || row.wallet_chain || null;
        const isMainnet = network === 'mainnet' || network === 'avalanche';
        const isFuji = network === 'fuji' || network === 'avalanche_fuji';
        const isEnabled = row.onchain_enabled === true;

        if (isMainnet) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
              🔴 Mainnet
            </span>
          );
        }
        if (isFuji && isEnabled) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              🟢 Fuji
            </span>
          );
        }
        if (isFuji && !isEnabled) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              🟡 Fuji (off)
            </span>
          );
        }
        return (
          <span className="text-slate-500 text-xs">—</span>
        );
      }
    },
    { 
      header: 'Created',
      className: 'hidden lg:table-cell',
      cell: (row) => (
        <span className="text-slate-400 text-sm">
          {row.created_date ? format(new Date(row.created_date), 'dd/MM/yy') : '-'}
        </span>
      )
    },
    {
      header: '',
      cell: (row) => (
        <div className="flex gap-2">
          <Link to={createPageUrl(`CompanySettings?companyId=${row.id}`)}>
            <Button variant="ghost" size="sm" className="text-yellow-400 hover:text-yellow-300">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
          <Link to={createPageUrl(`CompanySettings?companyId=${row.id}`)}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-400 hover:text-red-300"
            onClick={() => handleDelete(row)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Business Platform Management</h1>
          <p className="text-sm text-[#9ca3af] mt-1">Manage businesses on the platform</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#10b981] hover:bg-[#059669] text-sm font-medium">
              <Plus className="w-4 h-4 ml-2" />
              Add Business
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Business</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. My Coffee Shop"
                />
              </div>
              <div className="space-y-2">
                <Label>Points Name</Label>
                <Input 
                  value={formData.points_name}
                  onChange={(e) => setFormData({...formData, points_name: e.target.value})}
                  placeholder="e.g. Stars"
                />
              </div>
              <div className="space-y-2">
                <Label>Points to Currency Ratio</Label>
                <Input 
                  type="number"
                  value={formData.points_to_currency_ratio}
                  onChange={(e) => setFormData({...formData, points_to_currency_ratio: Number(e.target.value)})}
                  placeholder="100"
                />
                <p className="text-xs text-slate-500">How many points equal $1</p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({...formData, status: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || createMutation.isPending}
                className="bg-[#10b981] hover:bg-[#059669]"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input 
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10 bg-[#1f2128] border-[#2d2d3a] text-white"
        />
      </div>

      {/* Table */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-0">
          <DataTable 
            columns={columns}
            data={filteredCompanies}
            isLoading={isLoading}
            emptyMessage="No businesses found"
          />
        </CardContent>
      </Card>
    </div>
  );
}