import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Key,
  Loader2,
  RefreshCw,
  Edit,
  Building2
} from 'lucide-react';
import { toast } from "sonner";

export default function BranchesTab({ companyId }) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    phone: '',
    status: 'active'
  });

  const queryClient = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: companyId });
      return companies[0];
    },
    enabled: !!companyId
  });

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', companyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', companyId],
    queryFn: () => base44.entities.Transaction.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const generateApiKey = () => {
    return 'sk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (editingBranch) {
        return await base44.entities.Branch.update(editingBranch.id, data);
      } else {
        return await base44.entities.Branch.create({
          ...data,
          company_id: companyId,
          api_key: generateApiKey()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', companyId] });
      setDialogOpen(false);
      setEditingBranch(null);
      setFormData({ name: '', location: '', phone: '', status: 'active' });
      toast.success(editingBranch ? 'The branch has been updated.' : 'The branch was created successfully.');
    },
  });

  const regenerateApiKeyMutation = useMutation({
    mutationFn: async (branchId) => {
      const newApiKey = generateApiKey();
      return await base44.entities.Branch.update(branchId, { api_key: newApiKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', companyId] });
      toast.success('New API Key created ');
    },
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
      header: 'company', 
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="text-slate-300">{company?.name || '-'}</span>
        </div>
      )
    },
    { 
      header: 'branch', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-white">{row.name}</p>
            <div className="flex items-center gap-1 text-sm text-slate-400">
              <MapPin className="w-3 h-3" />
              {row.location || 'not mention'}
            </div>
          </div>
        </div>
      )
    },
    { 
      header: 'phone', 
      cell: (row) => <span className="text-slate-300">{row.phone || '-'}</span>
    },
    { 
      header: 'API Key', 
      cell: (row) => (
        <code className="text-xs text-indigo-300" dir="ltr">
          {row.api_key ? `${row.api_key.substring(0, 12)}...` : 'Not defined'}
        </code>
      )
    },
    { 
      header: 'status', 
      cell: (row) => <StatusBadge status={row.status || 'active'} />
    },
    { 
      header: 'Transactions', 
      cell: (row) => {
        const stats = getBranchStats(row.id);
        return (
          <div>
            <p className="font-medium text-white">{stats.count}</p>
            <p className="text-sm text-slate-400">₪{stats.amount.toLocaleString()}</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Branch management</h2>
          <p className="text-slate-400 mt-1"> Company branches and integration POS</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
              <Plus className="w-4 h-4 ml-2" />
             Add a branch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingBranch ? 'Edit Branch' : 'New Branch'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Branch name </Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="For example: Dizengoff branch"
                />
              </div>
              <div className="space-y-2">
                <Label>address</Label>
                <Input 
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="For example: 100 Dizengoff, Tel Aviv"
                />
              </div>
              <div className="space-y-2">
                <Label>phone</Label>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="03-1234567"
                />
              </div>
              <div className="space-y-2">
                <Label>status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({...formData, status: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
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
                Cancellation
              </Button>
              <Button 
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || !companyId || createMutation.isPending}
                className="bg-gradient-to-r from-indigo-500 to-purple-600"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {editingBranch ? 'updating' : 'creation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={integrationDialogOpen} onOpenChange={setIntegrationDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
               POS system connection - {selectedBranch?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedBranch && (
                <>
                  <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400 mb-1">API Key</p>
                      <code className="text-indigo-300" dir="ltr">
                        {selectedBranch.api_key || 'Not defined'}
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
                         Create a new key
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
          placeholder="Branch search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10 bg-slate-900 border-slate-800 text-white"
        />
      </div>

      {/* Table */}
      <Card className="border-slate-800 bg-slate-900 shadow-lg">
        <CardContent className="p-0">
          <DataTable 
            columns={columns}
            data={filteredBranches}
            isLoading={isLoading}
            emptyMessage="No branches found"
          />
        </CardContent>
      </Card>
    </div>
  );
}