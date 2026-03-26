import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import POSIntegrationGuide from '@/components/pos/POSIntegrationGuide';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Store,
  MapPin,
  Phone,
  Key,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";
import CompanySelector from '@/components/company/CompanySelector';

export default function Branches() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    phone: '',
    status: 'active'
  });

  const queryClient = useQueryClient();
  const { user, primaryCompanyId, loading } = useUserPermissions();
  const companyId = primaryCompanyId;

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: companyId });
      return companies[0];
    },
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', companyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: companyId }),
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', companyId],
    queryFn: () => base44.entities.Transaction.filter({ company_id: companyId }),
    enabled: !!companyId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const generateApiKey = () => {
    return 'sk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      console.log('🔵 Creating/Updating branch...', { 
        editingBranch: !!editingBranch, 
        companyId, 
        user,
        permissions: user,
        loading,
        data 
      });

      if (!companyId) {
        console.error('❌ CRITICAL: No company_id available!');
        console.error('   User:', user?.email);
        console.error('   Loading state:', loading);
        console.error('   Primary company ID:', companyId);
        throw new Error('Company ID is required to create a branch. Please refresh the page or contact support.');
      }

      if (editingBranch) {
        console.log('📝 Updating branch:', editingBranch.id);
        const result = await base44.entities.Branch.update(editingBranch.id, data);
        console.log('✅ Branch updated:', result);
        return result;
      } else {
        const branchData = {
          ...data,
          company_id: companyId,
          api_key: generateApiKey(),
          created_date: new Date().toISOString()
        };
        console.log('📝 Creating new branch with data:', branchData);
        const result = await base44.entities.Branch.create(branchData);
        console.log('✅ Branch created:', result);
        return result;
      }
    },
    onSuccess: (result) => {
      console.log('✅ Mutation success, refreshing queries...');
      queryClient.invalidateQueries({ queryKey: ['branches', companyId] });
      setDialogOpen(false);
      setEditingBranch(null);
      setFormData({ name: '', location: '', phone: '', status: 'active' });
      toast.success(editingBranch ? 'Branch updated!' : 'Branch created successfully!');
    },
    onError: (error) => {
      console.error('❌ Mutation error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response
      });
      toast.error('Failed to save branch: ' + (error.message || 'Please try again'));
    }
  });

  const regenerateApiKeyMutation = useMutation({
    mutationFn: async (branchId) => {
      const newApiKey = generateApiKey();
      return await base44.entities.Branch.update(branchId, { api_key: newApiKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', companyId] });
      toast.success('New API Key generated');
    },
    onError: (error) => {
      toast.error('Error generating new key');
    }
  });

  const handleEdit = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name || '',
      location: branch.location || '',
      phone: branch.phone || '',
      status: branch.status || 'active'
    });
    setDialogOpen(true);
  };

  const copyApiKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success('API Key copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredBranches = branches.filter(b => 
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.location?.toLowerCase().includes(search.toLowerCase())
  );

  const getBranchStats = (branchId) => {
    const branchTx = transactions.filter(t => t.branch_id === branchId);
    return {
      count: branchTx.length,
      amount: branchTx.reduce((s, t) => s + (t.amount || 0), 0)
    };
  };

  const columns = [
    { 
      header: 'Branch', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-white">{row.name}</p>
            <div className="flex items-center gap-1 text-sm text-slate-400">
              <MapPin className="w-3 h-3" />
              {row.location || 'Not specified'}
            </div>
          </div>
        </div>
      )
    },
    { 
      header: 'Phone', 
      cell: (row) => <span className="text-slate-300">{row.phone || '-'}</span>
    },
    { 
      header: 'API Key', 
      cell: (row) => (
        <code className="text-xs text-indigo-300" dir="ltr">
          {row.api_key ? `${row.api_key.substring(0, 12)}...` : 'Not set'}
        </code>
      )
    },
    { 
      header: 'Status', 
      cell: (row) => <StatusBadge status={row.status || 'active'} />
    },
    { 
      header: 'Transactions', 
      cell: (row) => {
        const stats = getBranchStats(row.id);
        return (
          <div>
            <p className="font-medium text-white">{stats.count}</p>
            <p className="text-sm text-slate-400">₪{(stats.amount || 0).toLocaleString()}</p>
          </div>
        );
      }
    },
    {
      header: '',
      cell: (row) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBranch(row);
              setIntegrationDialogOpen(true);
            }}
            className="text-indigo-400 hover:bg-slate-800"
            title="POS Integration"
          >
            <Key className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row);
            }}
            className="text-yellow-400 hover:bg-slate-800"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Store className="w-12 h-12 text-slate-400" />
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">No Company Found</h2>
          <p className="text-slate-400 mb-2">Unable to load company data</p>
          <p className="text-xs text-slate-500">User: {user?.email || 'Not loaded'}</p>
          <p className="text-xs text-slate-500">Loading: {loading ? 'Yes' : 'No'}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-teal-500 hover:bg-teal-600"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin company selector */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && <CompanySelector />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-right w-full">
          <h1 className="text-xl font-semibold text-white">Branches</h1>
          <p className="text-sm text-[#9ca3af] mt-1">Branch management and POS integration</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#10b981] hover:bg-[#059669]">
              <Plus className="w-4 h-4 ml-2" />
              Add Branch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingBranch ? 'Edit Branch' : 'New Branch'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Branch Name</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Dizengoff Branch"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input 
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="e.g. 100 Main St, City"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+1-555-0123"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({...formData, status: v})}
                >
                  <SelectTrigger className="text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setDialogOpen(false);
                setEditingBranch(null);
                setFormData({ name: '', location: '', phone: '', status: 'active' });
              }}>
                Cancel
              </Button>
              <Button 
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || !companyId || createMutation.isPending}
                className="bg-gradient-to-r from-indigo-500 to-purple-600"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {editingBranch ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* POS Integration Dialog */}
        <Dialog open={integrationDialogOpen} onOpenChange={setIntegrationDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                POS System Integration - {selectedBranch?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedBranch && (
                <>
                  <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400 mb-1">API Key</p>
                      <code className="text-indigo-300" dir="ltr">
                        {selectedBranch.api_key || 'Not set'}
                      </code>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateApiKeyMutation.mutate(selectedBranch.id)}
                      disabled={regenerateApiKeyMutation.isPending}
                      className="border-slate-700"
                    >
                      {regenerateApiKeyMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 ml-2" />
                          Generate New Key
                        </>
                      )}
                    </Button>
                  </div>
                  <POSIntegrationGuide branch={selectedBranch} company={company} />
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input 
          placeholder="Search branch..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10 bg-[#1f2128] border-[#2d2d3a] text-white"
        />
      </div>

      {/* Table */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
            </div>
          ) : filteredBranches.length === 0 && !search ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Store className="w-12 h-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Branches Yet</h3>
              <p className="text-slate-400 text-center mb-6">Create your first branch to start managing locations</p>
              <Button 
                onClick={() => setDialogOpen(true)}
                className="bg-[#10b981] hover:bg-[#059669]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Branch
              </Button>
            </div>
          ) : (
            <DataTable 
              columns={columns}
              data={filteredBranches}
              isLoading={false}
              emptyMessage={search ? "No branches match your search" : "No branches found"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}