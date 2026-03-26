import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Zap,
  Plus,
  Mail,
  MessageSquare,
  Webhook,
  Bell,
  Edit,
  Trash2,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const triggerTypes = [
  { value: 'customer_registered', label: 'Customer Registered', icon: '👤' },
  { value: 'transaction_completed', label: 'Transaction Completed', icon: '💳' },
  { value: 'reward_granted', label: 'Reward Granted', icon: '🎁' },
  { value: 'coupon_redeemed', label: 'Coupon Redeemed', icon: '🎟️' },
  { value: 'milestone_reached', label: 'Customer Milestone', icon: '🏆' },
  { value: 'customer_inactive', label: 'Customer Inactive', icon: '😴' }
];

const actionTypes = [
  { value: 'send_sms', label: 'Send SMS', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'send_email', label: 'Send Email', icon: <Mail className="w-4 h-4" /> },
  { value: 'notify_owner', label: 'Notify Owner', icon: <Bell className="w-4 h-4" /> },
  { value: 'trigger_webhook', label: 'Trigger Webhook', icon: <Webhook className="w-4 h-4" /> }
];

export default function AutomationSettings() {
  const { primaryCompanyId } = useUserPermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['automationRules', primaryCompanyId],
    queryFn: async () => {
      if (!primaryCompanyId) return [];
      return await base44.entities.AutomationRule.filter({ company_id: primaryCompanyId });
    },
    enabled: !!primaryCompanyId
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['automationLogs', primaryCompanyId],
    queryFn: async () => {
      if (!primaryCompanyId) return [];
      return await base44.entities.AutomationLog.filter({ company_id: primaryCompanyId }, '-created_date', 50);
    },
    enabled: !!primaryCompanyId
  });

  const createRuleMutation = useMutation({
    mutationFn: (data) => base44.entities.AutomationRule.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationRules'] });
      setDialogOpen(false);
      setEditingRule(null);
      toast.success('Automation rule created');
    },
    onError: (error) => {
      toast.error('Failed to create rule: ' + error.message);
    }
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AutomationRule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationRules'] });
      setDialogOpen(false);
      setEditingRule(null);
      toast.success('Automation rule updated');
    },
    onError: (error) => {
      toast.error('Failed to update rule: ' + error.message);
    }
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id) => base44.entities.AutomationRule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationRules'] });
      toast.success('Automation rule deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete rule: ' + error.message);
    }
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.AutomationRule.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationRules'] });
    }
  });

  if (!primaryCompanyId) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-[#9ca3af] animate-spin mx-auto mb-4" />
            <p className="text-[#9ca3af]">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automation Settings</h1>
          <p className="text-sm text-[#9ca3af]">Configure automated actions for customer events</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#10b981] hover:bg-[#059669]"
              onClick={() => setEditingRule(null)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Automation
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1f2128] border-[#2d2d3a] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
              </DialogTitle>
              <DialogDescription className="text-[#9ca3af]">
                Define when and what actions to take automatically
              </DialogDescription>
            </DialogHeader>
            <AutomationRuleForm
              rule={editingRule}
              companyId={primaryCompanyId}
              onSubmit={(data) => {
                if (editingRule) {
                  updateRuleMutation.mutate({ id: editingRule.id, data });
                } else {
                  createRuleMutation.mutate(data);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList className="bg-[#1f2128] border-[#2d2d3a]">
          <TabsTrigger value="rules" className="data-[state=active]:bg-[#10b981]">
            Automation Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#10b981]">
            Execution Logs ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* Automation Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          {rulesLoading ? (
            <Card className="bg-[#1f2128] border-[#2d2d3a]">
              <CardContent className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-[#9ca3af] animate-spin mx-auto mb-4" />
                <p className="text-[#9ca3af]">Loading automation rules...</p>
              </CardContent>
            </Card>
          ) : rules.length === 0 ? (
            <Card className="bg-[#1f2128] border-[#2d2d3a]">
              <CardContent className="p-12 text-center">
                <Zap className="w-16 h-16 text-[#9ca3af] mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-semibold text-white mb-2">No automation rules yet</h3>
                <p className="text-sm text-[#9ca3af] mb-4">
                  Create your first automation to automatically respond to customer events
                </p>
                <Button 
                  onClick={() => setDialogOpen(true)}
                  className="bg-[#10b981] hover:bg-[#059669]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} className="bg-[#1f2128] border-[#2d2d3a] hover:border-[#10b981] transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-white">{rule.name}</h3>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-xs">
                          {rule.is_active ? '✓ Active' : '○ Inactive'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-[#9ca3af] mb-1">Trigger Event</p>
                          <p className="text-sm text-white font-medium">
                            {triggerTypes.find(t => t.value === rule.trigger_type)?.icon}{' '}
                            {triggerTypes.find(t => t.value === rule.trigger_type)?.label || rule.trigger_type}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#9ca3af] mb-1">Action Type</p>
                          <div className="flex items-center gap-2 text-sm text-white font-medium">
                            {actionTypes.find(a => a.value === rule.action_type)?.icon}
                            {actionTypes.find(a => a.value === rule.action_type)?.label || rule.action_type}
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 mb-3">
                        <p className="text-xs text-[#9ca3af] mb-1">Message Template</p>
                        <p className="text-sm text-white font-mono">{rule.template_message || 'No message template'}</p>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[#9ca3af]">
                        <span>Executed: <span className="text-white font-semibold">{rule.execution_count || 0}</span> times</span>
                        {rule.last_executed_at && (
                          <span>Last: {new Date(rule.last_executed_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) => 
                          toggleRuleMutation.mutate({ id: rule.id, is_active: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingRule(rule);
                          setDialogOpen(true);
                        }}
                        className="hover:bg-[#17171f]"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Delete this automation rule?')) {
                            deleteRuleMutation.mutate(rule.id);
                          }
                        }}
                        className="hover:bg-red-500/10 text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Execution Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          {logsLoading ? (
            <Card className="bg-[#1f2128] border-[#2d2d3a]">
              <CardContent className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-[#9ca3af] animate-spin mx-auto mb-4" />
                <p className="text-[#9ca3af]">Loading execution logs...</p>
              </CardContent>
            </Card>
          ) : logs.length === 0 ? (
            <Card className="bg-[#1f2128] border-[#2d2d3a]">
              <CardContent className="p-12 text-center">
                <Activity className="w-16 h-16 text-[#9ca3af] mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-semibold text-white mb-2">No execution logs yet</h3>
                <p className="text-sm text-[#9ca3af]">
                  Automation execution history will appear here once rules start running
                </p>
              </CardContent>
            </Card>
          ) : (
            logs.map((log) => (
              <Card key={log.id} className="bg-[#1f2128] border-[#2d2d3a]">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#17171f]">
                      {log.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                      {log.status === 'failed' && <XCircle className="w-5 h-5 text-red-400" />}
                      {(log.status === 'pending' || log.status === 'retrying') && <Clock className="w-5 h-5 text-yellow-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-white">{log.trigger_type}</span>
                        <span className="text-xs text-[#9ca3af]">→</span>
                        <span className="text-sm text-[#9ca3af]">{log.action_type}</span>
                        <Badge 
                          variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'} 
                          className="text-xs"
                        >
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#9ca3af] mb-1">
                        <span className="text-white">To:</span> {log.target_recipient || 'N/A'}
                      </p>
                      <p className="text-xs text-[#9ca3af]">
                        {new Date(log.created_date).toLocaleString()}
                      </p>
                      {log.error_message && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded">
                          <p className="text-xs text-red-400">Error: {log.error_message}</p>
                        </div>
                      )}
                      {log.retry_count > 0 && (
                        <p className="text-xs text-yellow-500 mt-2">
                          🔄 Retried {log.retry_count} time(s)
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AutomationRuleForm({ rule, companyId, onSubmit }) {
  const [formData, setFormData] = useState(rule || {
    name: '',
    trigger_type: '',
    action_type: '',
    template_message: '',
    template_subject: '',
    webhook_url: '',
    webhook_method: 'POST',
    trigger_conditions: {},
    is_active: true,
    company_id: companyId
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-white text-sm">Rule Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="bg-[#17171f] border-[#2d2d3a] text-white"
          placeholder="e.g., Welcome SMS for new customers"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white text-sm">Trigger Event</Label>
          <Select 
            value={formData.trigger_type} 
            onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}
          >
            <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white">
              <SelectValue placeholder="Select trigger" />
            </SelectTrigger>
            <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
              {triggerTypes.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-white">
                  {t.icon} {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-white text-sm">Action</Label>
          <Select 
            value={formData.action_type} 
            onValueChange={(value) => setFormData({ ...formData, action_type: value })}
          >
            <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white">
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
              {actionTypes.map((a) => (
                <SelectItem key={a.value} value={a.value} className="text-white">
                  <div className="flex items-center gap-2">
                    {a.icon} {a.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.action_type === 'send_email' && (
        <div>
          <Label className="text-white text-sm">Email Subject</Label>
          <Input
            value={formData.template_subject || ''}
            onChange={(e) => setFormData({ ...formData, template_subject: e.target.value })}
            className="bg-[#17171f] border-[#2d2d3a] text-white"
            placeholder="Welcome to {{company_name}}!"
          />
        </div>
      )}

      <div>
        <Label className="text-white text-sm">Message Template</Label>
        <Textarea
          value={formData.template_message}
          onChange={(e) => setFormData({ ...formData, template_message: e.target.value })}
          className="bg-[#17171f] border-[#2d2d3a] text-white h-24"
          placeholder="Hi {{customer_name}}! You earned {{tokens}} tokens. Your balance: {{balance}}"
          required
        />
        <p className="text-xs text-[#9ca3af] mt-1">
          Variables: {'{{customer_name}}, {{customer_phone}}, {{amount}}, {{tokens}}, {{balance}}, {{company_name}}'}
        </p>
      </div>

      {formData.action_type === 'trigger_webhook' && (
        <>
          <div>
            <Label className="text-white text-sm">Webhook URL</Label>
            <Input
              type="url"
              value={formData.webhook_url || ''}
              onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
              className="bg-[#17171f] border-[#2d2d3a] text-white"
              placeholder="https://your-webhook.com/endpoint"
              required
            />
          </div>
          <div>
            <Label className="text-white text-sm">HTTP Method</Label>
            <Select 
              value={formData.webhook_method} 
              onValueChange={(value) => setFormData({ ...formData, webhook_method: value })}
            >
              <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                <SelectItem value="POST" className="text-white">POST</SelectItem>
                <SelectItem value="PUT" className="text-white">PUT</SelectItem>
                <SelectItem value="GET" className="text-white">GET</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {formData.trigger_type === 'milestone_reached' && (
        <div>
          <Label className="text-white text-sm">Milestone (Transaction Count)</Label>
          <Input
            type="number"
            value={formData.trigger_conditions?.milestone || ''}
            onChange={(e) => setFormData({
              ...formData,
              trigger_conditions: { ...formData.trigger_conditions, milestone: parseInt(e.target.value) || 0 }
            })}
            className="bg-[#17171f] border-[#2d2d3a] text-white"
            placeholder="e.g., 10"
          />
        </div>
      )}

      {formData.trigger_type === 'customer_inactive' && (
        <div>
          <Label className="text-white text-sm">Inactive Days</Label>
          <Input
            type="number"
            value={formData.trigger_conditions?.inactive_days || ''}
            onChange={(e) => setFormData({
              ...formData,
              trigger_conditions: { ...formData.trigger_conditions, inactive_days: parseInt(e.target.value) || 0 }
            })}
            className="bg-[#17171f] border-[#2d2d3a] text-white"
            placeholder="e.g., 21"
          />
        </div>
      )}

      <Button type="submit" className="w-full bg-[#10b981] hover:bg-[#059669]">
        {rule ? 'Update Rule' : 'Create Rule'}
      </Button>
    </form>
  );
}