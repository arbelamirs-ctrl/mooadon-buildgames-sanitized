// src/components/company/WooCommerceConnect.jsx  –  MOBILE-FIRST
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Link2, Link2Off, RefreshCw, CheckCircle2, Loader2, ExternalLink, Webhook, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function WooCommerceConnect({ companyId, integrationStatus }) {
  const queryClient = useQueryClient();
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');

  const wooStatus = integrationStatus?.integrations?.online_store?.woocommerce;
  const isConnected = wooStatus?.connected || false;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['integration-status', companyId] });

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!storeUrl.trim() || !consumerKey.trim() || !consumerSecret.trim())
        throw new Error('All fields are required');
      let cleanUrl = storeUrl.trim();
      if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
      cleanUrl = cleanUrl.replace(/\/$/, '');
      const res = await base44.functions.invoke('wooConnect', {
        action: 'connect', company_id: companyId,
        store_url: cleanUrl, consumer_key: consumerKey.trim(), consumer_secret: consumerSecret.trim(),
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => { toast.success('WooCommerce connected', { description: `Store: ${data.store_url}` }); invalidate(); },
    onError: (err) => toast.error('Failed to connect WooCommerce', { description: err.message }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('wooConnect', { action: 'test', company_id: companyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => { toast.success('WooCommerce connection is working!'); invalidate(); },
    onError: (err) => toast.error('Test failed', { description: err.message }),
  });

  const reinstallMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('wooConnect', { action: 'install_webhooks', company_id: companyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => { toast.success('Webhooks re-installed', { description: `OK: ${data.success?.length}, Failed: ${data.failed?.length}` }); invalidate(); },
    onError: (err) => toast.error('Webhook install failed', { description: err.message }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('wooConnect', { action: 'disconnect', company_id: companyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => { toast.success('WooCommerce disconnected'); invalidate(); },
    onError: (err) => toast.error('Disconnect failed', { description: err.message }),
  });

  if (isConnected) {
    return (
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-white text-sm sm:text-base">
            <ShoppingBag className="w-5 h-5 text-emerald-400 shrink-0" />
            WooCommerce Store
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Connected</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-3 sm:p-4 pt-0">
          <div className="bg-slate-950/50 rounded-lg p-3 sm:p-4 border border-slate-800">
            <a href={wooStatus?.store_url} target="_blank" rel="noopener noreferrer"
              className="text-white font-medium hover:text-emerald-400 flex items-center gap-1 text-sm break-all">
              {wooStatus?.store_url}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>

          <div className="bg-slate-950/30 rounded-lg p-3 sm:p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Webhook className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Webhooks</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Tracks <code className="text-[11px]">order.paid</code>, <code className="text-[11px]">order.updated</code>, <code className="text-[11px]">order.refunded</code>
            </p>
            <Button variant="outline" size="sm" onClick={() => reinstallMutation.mutate()} disabled={reinstallMutation.isPending}
              className="w-full sm:w-auto border-slate-700 text-slate-300 hover:text-white h-10">
              {reinstallMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Webhook className="w-4 h-4 mr-2" />}
              Re-install webhooks
            </Button>
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
          <ShoppingBag className="w-5 h-5 text-slate-400 shrink-0" />
          WooCommerce Store
          <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 text-xs">Not connected</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:p-4 pt-0">
        <div className="space-y-2">
          <Label className="text-xs sm:text-sm text-slate-300">Store URL</Label>
          <Input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="https://mystore.com"
            className="w-full bg-slate-950 border-slate-800 text-white focus:border-emerald-500 h-10" dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs sm:text-sm text-slate-300">Consumer Key</Label>
          <Input value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)}
            placeholder="ck_xxxxxxxxxxxxx"
            className="w-full bg-slate-950 border-slate-800 text-white focus:border-emerald-500 h-10" dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs sm:text-sm text-slate-300">Consumer Secret</Label>
          <Input value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)}
            placeholder="cs_xxxxxxxxxxxxx"
            className="w-full bg-slate-950 border-slate-800 text-white focus:border-emerald-500 h-10" dir="ltr" />
        </div>

        <Button onClick={() => connectMutation.mutate()}
          disabled={connectMutation.isPending || !storeUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-10">
          {connectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4 mr-2" />Connect WooCommerce</>}
        </Button>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-950/30 border border-blue-900/50">
          <Shield className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-200">API keys stored encrypted, used only to call WooCommerce REST API.</p>
        </div>
      </CardContent>
    </Card>
  );
}