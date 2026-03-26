// src/components/company/IntegrationsDashboard.jsx  –  MOBILE-FIRST
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, Server, Plug, ShoppingBag, CreditCard, Zap, CheckCircle2, ArrowLeft } from 'lucide-react';
import POSTab from '@/components/company/POSTab';
import CRMTab from '@/components/company/CRMTab';
import ShopifyConnect from '@/components/company/ShopifyConnect';
import WooCommerceConnect from '@/components/company/WooCommerceConnect';

function getHealthColor(score) {
  if (score >= 80) return 'text-emerald-400 bg-emerald-500/10';
  if (score >= 40) return 'text-amber-400 bg-amber-500/10';
  return 'text-rose-400 bg-rose-500/10';
}

function IntegrationCard({ icon: Icon, title, description, status, badge, primaryLabel, onTabSwitch }) {
  const connected = status === 'Connected';
  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-3 p-3 sm:p-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-emerald-400" />
          </div>
          <CardTitle className="text-sm text-white">{title}</CardTitle>
        </div>
        <Badge variant="outline" className={`text-[11px] shrink-0 ${connected ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-600 text-slate-500'}`}>
          {badge}
        </Badge>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
        <p className="text-xs text-slate-400">{description}</p>
        <div className="flex justify-end">
          <Button size="sm" onClick={onTabSwitch} className="h-10 min-w-[44px]">{primaryLabel}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntegrationsDashboard() {
  const { primaryCompanyId } = useUserPermissions();
  const [activeTab, setActiveTab] = React.useState('overview');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['integration-status', primaryCompanyId],
    enabled: !!primaryCompanyId,
    queryFn: async () => {
      const res = await base44.functions.invoke('getIntegrationStatus', { company_id: primaryCompanyId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
  });

  if (!primaryCompanyId) return <div className="p-4 text-slate-300 text-sm">No primary company selected.</div>;

  if (isLoading) return (
    <div className="min-h-[200px] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  if (isError || !data) return (
    <div className="p-3 sm:p-4">
      <Card className="border-rose-500/40 bg-rose-950/40">
        <CardContent className="py-4 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">Failed to load integration status</p>
              <p className="text-xs text-slate-300 mt-1">Try again or contact support.</p>
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="w-full sm:w-auto h-10">Retry</Button>
        </CardContent>
      </Card>
    </div>
  );

  const { health_score, integrations, recommendations, next_steps } = data;
  const healthColor = getHealthColor(health_score);
  const pos = integrations.pos;
  const crm = integrations.crm;
  const store = integrations.online_store;
  const payment = integrations.payment;

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white">Integration Center</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your POS, CRM, online store and payments from one place.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${healthColor}`}>
            <Activity className="w-4 h-4" />
            <span>Health: {health_score}%</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-10 min-w-[44px]">
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
         <div className="flex items-center gap-3">
           {activeTab !== 'overview' && (
             <Button 
               variant="ghost" 
               size="icon"
               onClick={() => setActiveTab('overview')}
               className="h-9 w-9 text-slate-400 hover:text-white"
               title="Back to Overview"
             >
               <ArrowLeft className="w-4 h-4" />
             </Button>
           )}
           <TabsList className="bg-slate-900 border border-slate-800 overflow-x-auto flex-nowrap w-full">
             <TabsTrigger value="overview" className="shrink-0 text-xs sm:text-sm">Overview</TabsTrigger>
             <TabsTrigger value="pos" className="shrink-0 text-xs sm:text-sm">POS</TabsTrigger>
             <TabsTrigger value="crm" className="shrink-0 text-xs sm:text-sm">CRM</TabsTrigger>
             <TabsTrigger value="store" className="shrink-0 text-xs sm:text-sm">Store</TabsTrigger>
             <TabsTrigger value="payments" className="shrink-0 text-xs sm:text-sm">Payments</TabsTrigger>
           </TabsList>
         </div>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-4">
            <div className="space-y-3">
              {[
                { icon: Server, title: 'POS & Terminals', description: 'Connect your in-store POS to sync sales and award points.', tab: 'pos',
                  status: (pos.priority.connected || pos.tranzila.connected || pos.generic_pos.configured) ? 'Connected' : 'Not connected',
                  badge: pos.priority.connected ? 'Priority' : pos.tranzila.connected ? 'Tranzila' : pos.generic_pos.configured ? 'Webhook' : 'No POS',
                  primaryLabel: (pos.priority.connected || pos.tranzila.connected || pos.generic_pos.configured) ? 'Manage POS' : 'Connect POS' },
                { icon: Plug, title: 'CRM', description: 'Keep customer data synced with your existing CRM.', tab: 'crm',
                  status: crm.connected ? 'Connected' : 'Not connected',
                  badge: crm.connected ? crm.name : 'No CRM',
                  primaryLabel: crm.connected ? 'Manage CRM' : 'Connect CRM' },
                { icon: ShoppingBag, title: 'Online Store', description: 'Reward customers for Shopify or WooCommerce purchases.', tab: 'store',
                  status: (store.shopify.connected || store.woocommerce.connected) ? 'Connected' : 'Not connected',
                  badge: store.shopify.connected ? 'Shopify' : store.woocommerce.connected ? 'WooCommerce' : 'No store',
                  primaryLabel: (store.shopify.connected || store.woocommerce.connected) ? 'Manage Store' : 'Connect Store' },
                { icon: CreditCard, title: 'Payments', description: 'Enable smooth reward redemptions at checkout.', tab: 'payments',
                  status: (payment.stripe.connected || payment.tranzila.connected) ? 'Connected' : 'Not connected',
                  badge: payment.stripe.connected ? 'Stripe' : payment.tranzila.connected ? 'Tranzila' : 'No provider',
                  primaryLabel: (payment.stripe.connected || payment.tranzila.connected) ? 'Manage Payments' : 'Configure Payments' },
              ].map((card) => (
                <IntegrationCard key={card.title} {...card} onTabSwitch={() => setActiveTab(card.tab)} />
              ))}
            </div>

            {/* Recommendations + Next Steps */}
            <div className="space-y-4">
              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader className="pb-3 p-3 sm:p-4">
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    Smart recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-3 sm:p-4 pt-0">
                  {(!recommendations || recommendations.length === 0) && (
                    <p className="text-sm text-slate-400">All set. Your key integrations look good.</p>
                  )}
                  {recommendations?.map((rec, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                      <p className="text-sm font-medium text-white">{rec.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{rec.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader className="pb-3 p-3 sm:p-4">
                  <CardTitle className="text-sm text-white">Next steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-3 sm:p-4 pt-0">
                  {next_steps?.map((step) => (
                    <div key={step.order} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-xs font-medium text-slate-100 truncate">{step.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{step.description}</p>
                      </div>
                      {step.complete
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        : <Badge variant="outline" className="text-[11px] border-emerald-500/50 text-emerald-400 shrink-0">
                            {step.order}
                          </Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pos"><POSTab integrationStatus={data} /></TabsContent>
        <TabsContent value="crm"><CRMTab integrationStatus={data} /></TabsContent>

        <TabsContent value="store">
          <div className="space-y-4">
            <ShopifyConnect companyId={primaryCompanyId} integrationStatus={data} />
            <WooCommerceConnect companyId={primaryCompanyId} integrationStatus={data} />
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="flex items-center gap-2 text-white text-sm sm:text-base">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 text-xs sm:text-sm text-slate-300">
              <p>Configure Stripe or Tranzila so customers can redeem rewards at checkout.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}