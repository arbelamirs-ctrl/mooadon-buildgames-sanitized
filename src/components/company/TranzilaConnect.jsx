import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Link2Off, RefreshCw, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function TranzilaConnect({ companyId }) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [form, setForm] = useState({ terminal_name: '', api_user: '', api_password: '' });

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['tranzila-connection', companyId],
    queryFn: () => base44.entities.TranzilaConnection.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const connection = connections[0] || null;

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (connection) {
        return await base44.entities.TranzilaConnection.update(connection.id, {
          ...data,
          is_active: true,
          last_error: null,
        });
      } else {
        return await base44.entities.TranzilaConnection.create({
          ...data,
          company_id: companyId,
          is_active: true,
        });
      }
    },
    onSuccess: () => {
      toast.success('Tranzila connection saved');
      queryClient.invalidateQueries({ queryKey: ['tranzila-connection', companyId] });
      setForm({ terminal_name: '', api_user: '', api_password: '' });
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.TranzilaConnection.update(connection.id, { is_active: false });
    },
    onSuccess: () => {
      toast.success('Tranzila disconnected');
      queryClient.invalidateQueries({ queryKey: ['tranzila-connection', companyId] });
    },
    onError: (err) => toast.error(`Disconnect failed: ${err.message}`),
  });

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const result = await base44.functions.invoke('tranzilaSync', { company_id: companyId });
      const summary = result?.data?.summary;
      toast.success(`Sync done: ${summary?.new_transactions ?? 0} new transactions`);
      queryClient.invalidateQueries({ queryKey: ['tranzila-connection', companyId] });
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = () => {
    if (!form.terminal_name || !form.api_user || !form.api_password) {
      toast.error('All fields are required');
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return (
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-6 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading Tranzila status...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1f2128] border-[#2d2d3a]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <span>🇮🇱</span>
          Tranzila Integration
          {connection?.is_active ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Connected</Badge>
          ) : (
            <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">Not connected</Badge>
          )}
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Pull transactions automatically from Tranzila TRAPI every 5 minutes
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Active connection status */}
        {connection?.is_active && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-300">
                  Terminal: {connection.terminal_name}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="border-[#2d2d3a] text-slate-300 hover:bg-[#2d2d3a] h-7 text-xs"
                >
                  {isSyncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                  Sync now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 text-xs"
                >
                  <Link2Off className="w-3 h-3 mr-1" />
                  Disconnect
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
              <div>
                Last sync:{' '}
                <span className="text-slate-300">
                  {connection.last_sync_at
                    ? new Date(connection.last_sync_at).toLocaleString('he-IL')
                    : 'Never'}
                </span>
              </div>
              <div>
                Transactions pulled:{' '}
                <span className="text-slate-300">{connection.last_sync_count ?? 0}</span>
              </div>
            </div>

            {connection.last_error && (
              <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Last error: {connection.last_error}
              </div>
            )}
          </div>
        )}

        {/* Connect form */}
        {!connection?.is_active && (
          <div className="space-y-3">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
              💡 You need: terminal name + API user + password from Tranzila back office (my.tranzila.com)
            </div>

            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Terminal Name (supplier)</Label>
              <Input value={form.terminal_name} onChange={e => setForm({ ...form, terminal_name: e.target.value })} placeholder="e.g. mystore1" className="bg-[#17171f] border-[#2d2d3a] text-white text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">API User</Label>
              <Input value={form.api_user} onChange={e => setForm({ ...form, api_user: e.target.value })} placeholder="Tranzila API username" className="bg-[#17171f] border-[#2d2d3a] text-white text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">API Password</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={form.api_password} onChange={e => setForm({ ...form, api_password: e.target.value })} placeholder="••••••••" className="bg-[#17171f] border-[#2d2d3a] text-white text-sm pr-10" />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
              Connect Tranzila
            </Button>
          </div>
        )}

        {/* Update credentials when connected */}
        {connection?.is_active && (
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-300 select-none">
              Update credentials
            </summary>
            <div className="mt-3 space-y-3 pl-1">
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Terminal Name</Label>
                <Input value={form.terminal_name} onChange={e => setForm({ ...form, terminal_name: e.target.value })} placeholder={connection.terminal_name} className="bg-[#17171f] border-[#2d2d3a] text-white text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">API User</Label>
                <Input value={form.api_user} onChange={e => setForm({ ...form, api_user: e.target.value })} placeholder={connection.api_user} className="bg-[#17171f] border-[#2d2d3a] text-white text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">New Password</Label>
                <Input type="password" value={form.api_password} onChange={e => setForm({ ...form, api_password: e.target.value })} placeholder="Leave blank to keep current" className="bg-[#17171f] border-[#2d2d3a] text-white text-sm" />
              </div>
              <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                Update
              </Button>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}