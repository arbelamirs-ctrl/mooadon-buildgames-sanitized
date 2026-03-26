// ─────────────────────────────────────────────────────────────────
// src/components/company/ShopifyConnect.jsx  –  MOBILE-FIRST
// ─────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Store, Link2, Link2Off, RefreshCw, CheckCircle2, Loader2, ExternalLink, Webhook, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function ShopifyConnect({ companyId, integrationStatus }) {
  const queryClient = useQueryClient();
  const [shopDomain, setShopDomain] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const shopifyStatus = integrationStatus?.integrations?.online_store?.shopify;
  const isConnected = shopifyStatus?.connected || false;

  const handleConnect = async () => {
    if (!shopDomain.trim()) { toast.error('Please enter your Shopify store domain'); return; }
    let domain = shopDomain.trim();
    if (!domain.includes('.')) domain = `${domain}.myshopify.com`;
    if (!domain.endsWith('.myshopify.com')) { toast.error('Please enter a valid .myshopify.com domain'); return; }
    setIsConnecting(true);
    const authUrl = `${window.location.origin}/functions/shopifyOAuth?action=install&shop=${encodeURIComponent(domain)}&company_id=${companyId}`;
    window.location.href = authUrl;
  };

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('shopifyOAuth', { action: 'test', company_id: companyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => { toast.success('Shopify connection is working!', { description: `Connected to ${data.shop}` }); queryClient.invalidateQueries({ queryKey: ['integration-status', companyId] }); },
    onError: (err) => toast.error('Connection test failed', { description: err.message }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('shopifyOAuth', { action: 'disconnect', company_id: companyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => { toast.success('Shopify disconnected'); queryClient.invalidateQueries({ queryKey: ['integration-status', companyId] }); },
    onError: (err) => toast.error('Disconnect failed', { description: err.message }),
  });

  if (isConnected) {
    return (
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-white text-sm sm:text-base">
            <Store className="w-5 h-5 text-emerald-400 shrink-0" />
            Shopify Store
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Connected</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-3 sm:p-4 pt-0">
          <div className="bg-slate-950/50 rounded-lg p-3 sm:p-4 border border-slate-800">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-400 shrink-0" />
              <a href={`https://${shopifyStatus?.shop_domain}`} target="_blank" rel="noopener noreferrer"
                className="text-white font-medium hover:text-emerald-400 transition-colors flex items-center gap-1 text-sm break-all">
                {shopifyStatus?.shop_domain}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-950/30 rounded-lg p-3 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Webhook className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-400">Webhooks</span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 text-[11px] border-emerald-500/30">Active</Badge>
            </div>
            <div className="bg-slate-950/30 rounded-lg p-3 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-400">Events</span>
              </div>
              <Badge className="bg-slate-700/50 text-slate-300 text-[11px]">Real-time</Badge>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}
              className="flex-1 border-slate-700 text-slate-300 hover:text-white h-10">
              {testMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Test Connection
            </Button>
            <Button variant="outline" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}
              className="flex-1 border-rose-700/50 text-rose-400 hover:bg-rose-950/30 h-10">
              {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2Off className="w-4 h-4 mr-2" />}
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="p-3 sm:p-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-white text-sm sm:text-base">
          <Store className="w-5 h-5 text-slate-400 shrink-0" />
          Shopify Store
          <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 text-xs">Not connected</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-3 sm:p-4 pt-0">
        <div className="space-y-2">
          <Label className="text-xs sm:text-sm text-slate-300">Shopify Store Domain</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={shopDomain} onChange={(e) => setShopDomain(e.target.value)}
              placeholder="mystore.myshopify.com"
              className="flex-1 bg-slate-950 border-slate-800 text-white focus:border-emerald-500 h-10"
              dir="ltr"
              onKeyDown={(e) => e.key === 'Enter' && !isConnecting && handleConnect()} />
            <Button onClick={handleConnect} disabled={isConnecting || !shopDomain.trim()}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white h-10">
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4 mr-2" />Connect</>}
            </Button>
          </div>
          <p className="text-xs text-slate-500">Enter your .myshopify.com domain or just "mystore"</p>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-950/30 border border-blue-900/50">
          <Shield className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-200">Secure OAuth — we never store your Shopify password.</p>
        </div>
      </CardContent>
    </Card>
  );
}