import React, { useState } from 'react';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Copy, 
  ExternalLink, 
  ShoppingCart, 
  CreditCard,
  Sheet,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function ZapierIntegration() {
  const { primaryCompanyId } = useUserPermissions();

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', primaryCompanyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const mainBranch = branches[0];
  const webhookUrl = `${window.location.origin}/api/functions/posTransactionWebhook`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-orange-400" />
            Zapier Integration
          </h1>
          <p className="text-[#9ca3af] text-sm mt-1">
            Connect your loyalty program to 5,000+ apps
          </p>
        </div>
        <Button
          onClick={() => window.open('https://zapier.com', '_blank')}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Zapier
        </Button>
      </div>

      {/* Quick Setup Guide */}
      <Card className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-orange-500/30">
        <CardContent className="p-6">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-orange-400" />
            Quick Setup (3 minutes)
          </h3>
          <div className="space-y-2 text-sm text-[#9ca3af]">
            <p className="flex items-center gap-2">
              <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
              Choose your POS system below (Square, Shopify, WooCommerce, etc.)
            </p>
            <p className="flex items-center gap-2">
              <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
              Copy the webhook URL and API key
            </p>
            <p className="flex items-center gap-2">
              <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
              Follow the step-by-step instructions to create your Zap
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Your Credentials */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="border-b border-[#2d2d3a]">
          <CardTitle className="text-white">Your Integration Credentials</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Webhook URL</label>
            <div className="flex gap-2">
              <input
                value={webhookUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-[#17171f] border border-[#2d2d3a] rounded-lg text-white font-mono text-sm"
              />
              <Button
                onClick={() => copyToClipboard(webhookUrl)}
                variant="outline"
                className="border-[#2d2d3a]"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">API Key</label>
            <div className="flex gap-2">
              <input
                value={mainBranch?.api_key || 'Generate API key in Webhook Settings'}
                readOnly
                className="flex-1 px-3 py-2 bg-[#17171f] border border-[#2d2d3a] rounded-lg text-white font-mono text-sm"
              />
              <Button
                onClick={() => mainBranch?.api_key && copyToClipboard(mainBranch.api_key)}
                variant="outline"
                className="border-[#2d2d3a]"
                disabled={!mainBranch?.api_key}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Templates */}
      <Tabs defaultValue="square" className="space-y-6">
        <TabsList className="bg-[#1f2128] border border-[#2d2d3a]">
          <TabsTrigger value="square">
            <CreditCard className="w-4 h-4 mr-2" />
            Square
          </TabsTrigger>
          <TabsTrigger value="shopify">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Shopify
          </TabsTrigger>
          <TabsTrigger value="woo">
            <ShoppingCart className="w-4 h-4 mr-2" />
            WooCommerce
          </TabsTrigger>
          <TabsTrigger value="sheets">
            <Sheet className="w-4 h-4 mr-2" />
            Google Sheets
          </TabsTrigger>
        </TabsList>

        {/* Square Integration */}
        <TabsContent value="square">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Square POS Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-400 font-medium mb-2">What this does:</p>
                <p className="text-[#9ca3af] text-sm">
                  Automatically award loyalty points when a sale is completed in Square POS
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-white font-semibold">Step-by-Step Instructions:</h3>
                
                <div className="space-y-4">
                  <Step
                    number={1}
                    title="Create a new Zap in Zapier"
                    description="Go to Zapier and click 'Create Zap'"
                    image="📱"
                  />

                  <Step
                    number={2}
                    title="Choose Square as the Trigger"
                    description="Search for 'Square' and select 'New Payment'"
                    image="💳"
                  >
                    <div className="mt-2 bg-[#17171f] border border-[#2d2d3a] rounded p-3">
                      <p className="text-[#9ca3af] text-xs mb-2">Trigger Event:</p>
                      <Badge className="bg-[#10b981]">New Payment</Badge>
                    </div>
                  </Step>

                  <Step
                    number={3}
                    title="Connect your Square account"
                    description="Follow prompts to authenticate with Square"
                    image="🔐"
                  />

                  <Step
                    number={4}
                    title="Choose 'Webhooks by Zapier' as Action"
                    description="Search for 'Webhooks' and select 'POST'"
                    image="🎯"
                  />

                  <Step
                    number={5}
                    title="Configure the webhook"
                    description="Enter your loyalty platform webhook details"
                    image="⚙️"
                  >
                    <div className="mt-3 space-y-3 bg-[#17171f] border border-[#2d2d3a] rounded p-4">
                      <ConfigField label="URL" value={webhookUrl} />
                      <ConfigField label="Payload Type" value="JSON" />
                      <ConfigField 
                        label="Data" 
                        value={`{
  "phone": "{{customer_phone}}",
  "amount": "{{total_money}}",
  "branch_api_key": "${mainBranch?.api_key || 'YOUR_API_KEY'}",
  "order_id": "{{id}}"
}`}
                        mono
                      />
                    </div>
                  </Step>

                  <Step
                    number={6}
                    title="Map Square fields"
                    description="Use Square's phone field and total amount"
                    image="🗺️"
                  >
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <code className="bg-[#17171f] px-2 py-1 rounded">phone</code>
                        <ArrowRight className="w-3 h-3" />
                        <span>Square: Customer Phone Number</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <code className="bg-[#17171f] px-2 py-1 rounded">amount</code>
                        <ArrowRight className="w-3 h-3" />
                        <span>Square: Total Money (in dollars)</span>
                      </div>
                    </div>
                  </Step>

                  <Step
                    number={7}
                    title="Test your Zap"
                    description="Run a test to ensure everything works"
                    image="✅"
                  />

                  <Step
                    number={8}
                    title="Turn on your Zap"
                    description="Activate the Zap to start awarding points automatically"
                    image="🚀"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shopify Integration */}
        <TabsContent value="shopify">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Shopify Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 font-medium mb-2">What this does:</p>
                <p className="text-[#9ca3af] text-sm">
                  Automatically award loyalty points when an order is placed in your Shopify store
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-white font-semibold">Step-by-Step Instructions:</h3>
                
                <div className="space-y-4">
                  <Step number={1} title="Create a new Zap" image="📱" />
                  
                  <Step
                    number={2}
                    title="Choose Shopify as Trigger"
                    description="Select 'New Order' or 'New Paid Order'"
                    image="🛍️"
                  >
                    <div className="mt-2 bg-[#17171f] border border-[#2d2d3a] rounded p-3">
                      <Badge className="bg-green-500">New Paid Order</Badge>
                    </div>
                  </Step>

                  <Step number={3} title="Connect Shopify account" image="🔐" />

                  <Step
                    number={4}
                    title="Add Webhooks by Zapier action"
                    image="🎯"
                  />

                  <Step
                    number={5}
                    title="Configure webhook payload"
                    image="⚙️"
                  >
                    <div className="mt-3 space-y-3 bg-[#17171f] border border-[#2d2d3a] rounded p-4">
                      <ConfigField label="URL" value={webhookUrl} />
                      <ConfigField 
                        label="Data" 
                        value={`{
  "phone": "{{customer_phone}}",
  "amount": "{{total_price}}",
  "branch_api_key": "${mainBranch?.api_key || 'YOUR_API_KEY'}",
  "order_id": "{{order_number}}"
}`}
                        mono
                      />
                    </div>
                  </Step>

                  <Step
                    number={6}
                    title="Map Shopify fields"
                    image="🗺️"
                  >
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <code className="bg-[#17171f] px-2 py-1 rounded">phone</code>
                        <ArrowRight className="w-3 h-3" />
                        <span>Shopify: Customer Phone or Billing Phone</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <code className="bg-[#17171f] px-2 py-1 rounded">amount</code>
                        <ArrowRight className="w-3 h-3" />
                        <span>Shopify: Total Price</span>
                      </div>
                    </div>
                  </Step>

                  <Step number={7} title="Test & Activate" image="✅" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WooCommerce Integration */}
        <TabsContent value="woo">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                WooCommerce Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <p className="text-purple-400 font-medium mb-2">What this does:</p>
                <p className="text-[#9ca3af] text-sm">
                  Award loyalty points when orders are completed in WooCommerce
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-white font-semibold">Step-by-Step Instructions:</h3>
                
                <div className="space-y-4">
                  <Step number={1} title="Create a new Zap" image="📱" />
                  
                  <Step
                    number={2}
                    title="Choose WooCommerce as Trigger"
                    description="Select 'Order Status Updated' with status 'Completed'"
                    image="📦"
                  />

                  <Step number={3} title="Connect WooCommerce" image="🔐" />

                  <Step number={4} title="Add Webhook action" image="🎯" />

                  <Step
                    number={5}
                    title="Configure payload"
                    image="⚙️"
                  >
                    <div className="mt-3 space-y-3 bg-[#17171f] border border-[#2d2d3a] rounded p-4">
                      <ConfigField label="URL" value={webhookUrl} />
                      <ConfigField 
                        label="Data" 
                        value={`{
  "phone": "{{billing_phone}}",
  "amount": "{{total}}",
  "branch_api_key": "${mainBranch?.api_key || 'YOUR_API_KEY'}",
  "order_id": "{{order_number}}"
}`}
                        mono
                      />
                    </div>
                  </Step>

                  <Step number={6} title="Test & Activate" image="✅" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Sheets Integration */}
        <TabsContent value="sheets">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="text-white flex items-center gap-2">
                <Sheet className="w-5 h-5" />
                Google Sheets Logging
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400 font-medium mb-2">What this does:</p>
                <p className="text-[#9ca3af] text-sm">
                  Log every transaction to a Google Sheet for analysis and reporting
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-white font-semibold">Step-by-Step Instructions:</h3>
                
                <div className="space-y-4">
                  <Step
                    number={1}
                    title="Create spreadsheet"
                    description="Create a Google Sheet with columns: Date, Phone, Amount, Points, Status"
                    image="📊"
                  />
                  
                  <Step number={2} title="Create new Zap" image="📱" />

                  <Step
                    number={3}
                    title="Choose Webhook as Trigger"
                    description="Use 'Webhooks by Zapier' → 'Catch Hook'"
                    image="🎣"
                  >
                    <div className="mt-2 bg-orange-500/10 border border-orange-500/30 rounded p-3">
                      <p className="text-orange-400 text-xs">
                        💡 Tip: Copy the webhook URL Zapier provides and add it to the Outgoing Webhooks section below
                      </p>
                    </div>
                  </Step>

                  <Step
                    number={4}
                    title="Add Google Sheets action"
                    description="Choose 'Create Spreadsheet Row'"
                    image="➕"
                  />

                  <Step
                    number={5}
                    title="Map fields to columns"
                    image="🗺️"
                  >
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <span>Date</span>
                        <ArrowRight className="w-3 h-3" />
                        <code className="bg-[#17171f] px-2 py-1 rounded">created_date</code>
                      </div>
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <span>Phone</span>
                        <ArrowRight className="w-3 h-3" />
                        <code className="bg-[#17171f] px-2 py-1 rounded">phone</code>
                      </div>
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <span>Amount</span>
                        <ArrowRight className="w-3 h-3" />
                        <code className="bg-[#17171f] px-2 py-1 rounded">amount</code>
                      </div>
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <span>Points</span>
                        <ArrowRight className="w-3 h-3" />
                        <code className="bg-[#17171f] px-2 py-1 rounded">points</code>
                      </div>
                    </div>
                  </Step>

                  <Step number={6} title="Test & Activate" image="✅" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Outgoing Webhooks (Triggers) */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="border-b border-[#2d2d3a]">
          <CardTitle className="text-white">Outgoing Webhooks (Coming Soon)</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Zap className="w-12 h-12 mx-auto mb-3 text-[#9ca3af] opacity-30" />
            <p className="text-[#9ca3af] mb-4">
              Send real-time events to Zapier when:
            </p>
            <div className="space-y-2 text-sm text-[#9ca3af] max-w-md mx-auto">
              <p>• Customer earns points</p>
              <p>• Customer claims tokens</p>
              <p>• New customer registered</p>
              <p>• Points milestone reached</p>
            </div>
            <p className="text-xs text-[#9ca3af] mt-6">
              This feature will be available in the next update
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components
function Step({ number, title, description, image, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">
          {number}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{image}</span>
          <h4 className="text-white font-medium">{title}</h4>
        </div>
        {description && (
          <p className="text-[#9ca3af] text-sm mb-2">{description}</p>
        )}
        {children}
      </div>
    </div>
  );
}

function ConfigField({ label, value, mono }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[#9ca3af] font-medium">{label}:</label>
      <div className={`text-xs text-white ${mono ? 'font-mono' : ''} ${mono ? 'whitespace-pre-wrap' : ''}`}>
        {value}
      </div>
    </div>
  );
}