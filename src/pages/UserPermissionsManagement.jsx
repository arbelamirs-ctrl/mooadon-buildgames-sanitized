import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, 
  Building2, 
  MapPin, 
  Shield, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const PERMISSION_ROLES = [
  { value: 'company_admin', label: 'Company Admin', description: 'Full access to company' },
  { value: 'branch_user', label: 'Branch User', description: 'POS access only' }
];

export default function UserPermissionsManagement() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);

  // Fetch all permissions
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: () => base44.entities.UserPermission.list('-created_date')
  });

  // Fetch all companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date')
  });

  // Fetch all branches
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['all-branches'],
    queryFn: () => base44.entities.Branch.list('-created_date')
  });

  // Create permission mutation
  const createPermission = useMutation({
    mutationFn: async (data) => {
      return base44.entities.UserPermission.create({
        ...data,
        created_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Permission created successfully');
      queryClient.invalidateQueries({ queryKey: ['all-permissions'] });
      setShowAddDialog(false);
    },
    onError: (error) => {
      toast.error('Failed to create permission: ' + error.message);
    }
  });

  // Update permission mutation
  const updatePermission = useMutation({
    mutationFn: async ({ id, data }) => {
      return base44.entities.UserPermission.update(id, data);
    },
    onSuccess: () => {
      toast.success('Permission updated successfully');
      queryClient.invalidateQueries({ queryKey: ['all-permissions'] });
      setEditingPermission(null);
    },
    onError: (error) => {
      toast.error('Failed to update permission: ' + error.message);
    }
  });

  // Delete permission mutation
  const deletePermission = useMutation({
    mutationFn: async (id) => {
      return base44.entities.UserPermission.delete(id);
    },
    onSuccess: () => {
      toast.success('Permission deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['all-permissions'] });
    },
    onError: (error) => {
      toast.error('Failed to delete permission: ' + error.message);
    }
  });

  // Toggle active status
  const toggleActive = async (permission) => {
    await updatePermission.mutateAsync({
      id: permission.id,
      data: { is_active: !permission.is_active }
    });
  };

  // Filter permissions
  const filteredPermissions = permissions.filter(p => {
    if (filterCompany !== 'all' && p.company_id !== filterCompany) return false;
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        p.user_id?.toLowerCase().includes(search) ||
        p.user_email?.toLowerCase().includes(search) ||
        p.role?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Get company name by ID
  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Unknown';
  };

  // Get branch name by ID
  const getBranchName = (branchId) => {
    if (!branchId) return 'All Branches';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Unknown';
  };

  if (permissionsLoading || companiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-400" />
                User Permissions
              </CardTitle>
              <CardDescription className="text-[#9ca3af]">
                Manage user access to companies and branches
              </CardDescription>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-teal-500 hover:bg-teal-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Permission
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#1f2128] border-[#2d2d3a]">
                <PermissionForm
                  companies={companies}
                  branches={branches}
                  onSubmit={(data) => createPermission.mutate(data)}
                  isSubmitting={createPermission.isPending}
                  onCancel={() => setShowAddDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <Input
                placeholder="Search by user ID or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#17171f] border-[#2d2d3a]"
              />
            </div>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[200px] bg-[#17171f] border-[#2d2d3a]">
                <SelectValue placeholder="Filter by company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Table */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2d2d3a]">
                <TableHead className="text-[#9ca3af]">User</TableHead>
                <TableHead className="text-[#9ca3af]">Company</TableHead>
                <TableHead className="text-[#9ca3af]">Branch</TableHead>
                <TableHead className="text-[#9ca3af]">Role</TableHead>
                <TableHead className="text-[#9ca3af]">Status</TableHead>
                <TableHead className="text-[#9ca3af] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-[#9ca3af]">
                    No permissions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPermissions.map((permission) => (
                  <TableRow key={permission.id} className="border-[#2d2d3a]">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-teal-400" />
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">
                            {permission.user_email || permission.user_id}
                          </div>
                          <div className="text-xs text-[#9ca3af]">
                            ID: {permission.user_id?.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#9ca3af]" />
                        <span className="text-white">{getCompanyName(permission.company_id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#9ca3af]" />
                        <span className="text-white">
                          {getBranchName(permission.branch_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={
                          permission.role === 'company_admin' 
                            ? 'border-purple-500/30 text-purple-400' 
                            : 'border-gray-500/30 text-gray-400'
                        }
                      >
                        {PERMISSION_ROLES.find(r => r.value === permission.role)?.label || permission.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={permission.is_active}
                          onCheckedChange={() => toggleActive(permission)}
                          className="data-[state=checked]:bg-teal-500"
                        />
                        {permission.is_active ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingPermission(permission)}
                          className="text-[#9ca3af] hover:text-white"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this permission?')) {
                              deletePermission.mutate(permission.id);
                            }
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingPermission} onOpenChange={(open) => !open && setEditingPermission(null)}>
        <DialogContent className="bg-[#1f2128] border-[#2d2d3a]">
          {editingPermission && (
            <PermissionForm
              permission={editingPermission}
              companies={companies}
              branches={branches}
              onSubmit={(data) => updatePermission.mutate({ id: editingPermission.id, data })}
              isSubmitting={updatePermission.isPending}
              onCancel={() => setEditingPermission(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Warning about unassigned users */}
      <Card className="bg-yellow-500/10 border-yellow-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <h4 className="text-yellow-400 font-medium">Permission Requirements</h4>
              <p className="text-yellow-400/80 text-sm mt-1">
                Users without active permissions will not be able to use the POS terminal.
                Ensure each agent/cashier has at least one active permission with a company and branch assigned.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== PERMISSION FORM COMPONENT ==========

function PermissionForm({ permission, companies, branches, onSubmit, isSubmitting, onCancel }) {
  const [formData, setFormData] = useState({
    user_id: permission?.user_id || '',
    user_email: permission?.user_email || '',
    company_id: permission?.company_id || '',
    branch_id: permission?.branch_id || '',
    role: permission?.role || 'branch_user',
    is_active: permission?.is_active ?? true
  });

  const availableBranches = branches.filter(b => b.company_id === formData.company_id);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.user_id && !formData.user_email) {
      toast.error('Please enter a user ID or email');
      return;
    }
    
    if (!formData.company_id) {
      toast.error('Please select a company');
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="text-white">
          {permission ? 'Edit Permission' : 'Add Permission'}
        </DialogTitle>
        <DialogDescription className="text-[#9ca3af]">
          {permission 
            ? 'Update the permission settings for this user'
            : 'Assign a user to a company and branch with a specific role'
          }
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* User ID */}
        <div className="space-y-2">
          <Label className="text-white">User ID</Label>
          <Input
            placeholder="Enter user ID"
            value={formData.user_id}
            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            className="bg-[#17171f] border-[#2d2d3a]"
            disabled={!!permission}
          />
        </div>

        {/* User Email */}
        <div className="space-y-2">
          <Label className="text-white">User Email (optional)</Label>
          <Input
            type="email"
            placeholder="user@example.com"
            value={formData.user_email}
            onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
            className="bg-[#17171f] border-[#2d2d3a]"
          />
        </div>

        {/* Company */}
        <div className="space-y-2">
          <Label className="text-white">Company</Label>
          <Select 
            value={formData.company_id} 
            onValueChange={(value) => setFormData({ 
              ...formData, 
              company_id: value,
              branch_id: '' // Reset branch when company changes
            })}
          >
            <SelectTrigger className="bg-[#17171f] border-[#2d2d3a]">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(company => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Branch */}
        <div className="space-y-2">
          <Label className="text-white">Branch (optional)</Label>
          <Select 
            value={formData.branch_id} 
            onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
            disabled={!formData.company_id}
          >
            <SelectTrigger className="bg-[#17171f] border-[#2d2d3a]">
              <SelectValue placeholder="All branches (company-level access)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Branches</SelectItem>
              {availableBranches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[#9ca3af]">
            Leave empty to grant access to all branches in the company
          </p>
        </div>

        {/* Role */}
        <div className="space-y-2">
          <Label className="text-white">Role</Label>
          <Select 
            value={formData.role} 
            onValueChange={(value) => setFormData({ ...formData, role: value })}
          >
            <SelectTrigger className="bg-[#17171f] border-[#2d2d3a]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERMISSION_ROLES.map(role => (
                <SelectItem key={role.value} value={role.value}>
                  <div>
                    <div className="font-medium">{role.label}</div>
                    <div className="text-xs text-[#9ca3af]">{role.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active Status */}
        <div className="flex items-center justify-between">
          <Label className="text-white">Active</Label>
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            className="data-[state=checked]:bg-teal-500"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-[#2d2d3a]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-teal-500 hover:bg-teal-600"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            permission ? 'Update Permission' : 'Create Permission'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}