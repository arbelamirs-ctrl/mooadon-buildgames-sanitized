import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Copy, CheckCircle, ExternalLink, Webhook, Key } from 'lucide-react';
import { toast } from "sonner";

export default function POSIntegrationGuide({ branch, company }) {
  const [copied, setCopied] = useState('');

  const apiEndpoint = `${window.location.origin}/api/pos/transaction`;
  
  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(''), 2000);
  };

  const createTransactionExample = `POST ${apiEndpoint}
Content-Type: application/json
X-API-Key: ${branch?.api_key || 'YOUR_API_KEY'}

{
  "order_id": "ORDER_12345",
  "client_phone": "+972501234567",
  "amount": 150.50,
  "points": 15,
  "branch_id": "${branch?.id || 'BRANCH_ID'}",
  "timestamp": "${new Date().toISOString()}"
}`;

  const responseExample = `{
  "success": true,
  "transaction_id": "tx_abc123",
  "claim_url": "https://yourapp.com/claim?token=xyz",
  "sms_sent": true,
  "points_earned": 15
}`;

  const curlExample = `curl -X POST ${apiEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${branch?.api_key || 'YOUR_API_KEY'}" \\
  -d '{
    "order_id": "ORDER_12345",
    "client_phone": "+972501234567",
    "amount": 150.50,
    "points": 15,
    "branch_id": "${branch?.id || 'BRANCH_ID'}"
  }'`;

  const webhookExample = `POST https://your-pos-system.com/webhook
Content-Type: application/json
X-Webhook-Secret: YOUR_WEBHOOK_SECRET

{
  "event": "transaction_completed",
  "transaction_id": "tx_abc123",
  "client_phone": "+972501234567",
  "points": 15,
  "status": "completed",
  "timestamp": "${new Date().toISOString()}"
}`;

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            POS Integration Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-300 mb-2">Branch API Key</h4>
                <div className="bg-slate-950 rounded-lg p-3 flex items-center justify-between overflow-hidden">
                   <code className="text-blue-300 text-sm truncate" dir="ltr">
                     {branch?.api_key || 'API Key not configured'}
                   </code>
                  {branch?.api_key && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(branch.api_key, 'apikey')}
                      className="text-blue-400"
                    >
                      {copied === 'apikey' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800">
              <TabsTrigger value="create">Create Transaction</TabsTrigger>
              <TabsTrigger value="curl">cURL Example</TabsTrigger>
              <TabsTrigger value="webhook">Webhooks</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-300">POST Request</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(createTransactionExample, 'create')}
                    className="text-slate-400"
                  >
                    {copied === 'create' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <pre className="bg-slate-950 rounded-lg p-4 overflow-auto text-xs text-slate-300 border border-slate-800 max-w-full" dir="ltr">
                   {createTransactionExample}
                 </pre>
                </div>

                <div>
                 <div className="flex items-center justify-between mb-2">
                   <h4 className="text-sm font-medium text-slate-300">Response</h4>
                   <Button
                     size="sm"
                     variant="ghost"
                     onClick={() => copyToClipboard(responseExample, 'response')}
                     className="text-slate-400"
                   >
                     {copied === 'response' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                   </Button>
                 </div>
                 <pre className="bg-slate-950 rounded-lg p-4 overflow-auto text-xs text-emerald-400 border border-slate-800 max-w-full" dir="ltr">
                   {responseExample}
                 </pre>
              </div>

              <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-amber-300 mb-2">Required Fields</h4>
                <ul className="text-xs text-amber-200 space-y-1">
                  <li>• <code>client_phone</code> - Customer phone number (international format)</li>
                  <li>• <code>amount</code> - Transaction amount</li>
                  <li>• <code>points</code> - Points to grant</li>
                  <li>• <code>branch_id</code> - Branch identifier</li>
                  <li>• <code>order_id</code> - Unique order ID (for idempotency)</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="curl" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-300">cURL Command</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(curlExample, 'curl')}
                    className="text-slate-400"
                  >
                    {copied === 'curl' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <pre className="bg-slate-950 rounded-lg p-4 overflow-auto text-xs text-slate-300 border border-slate-800 max-w-full" dir="ltr">
                   {curlExample}
                 </pre>
              </div>

              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-300 mb-2">Terminal Testing</h4>
                <p className="text-xs text-blue-200">
                  Run this command from the terminal to test the connection.
                  Replace with your actual branch values.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="webhook" className="space-y-4">
              <div className="bg-indigo-900/20 border border-indigo-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-indigo-300 mb-2">Webhook Events</h4>
                <p className="text-xs text-indigo-200 mb-3">
                  The system will send webhook messages to your POS when events occur:
                </p>
                <div className="space-y-2 text-xs text-indigo-200">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-indigo-600 text-indigo-300">
                      transaction_completed
                    </Badge>
                    <span>- Transaction completed and points added</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-indigo-600 text-indigo-300">
                      points_redeemed
                    </Badge>
                    <span>- Customer redeemed points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-indigo-600 text-indigo-300">
                      client_balance_updated
                    </Badge>
                    <span>- Client balance updated</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-300">Webhook Payload</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(webhookExample, 'webhook')}
                    className="text-slate-400"
                  >
                    {copied === 'webhook' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <pre className="bg-slate-950 rounded-lg p-4 overflow-auto text-xs text-slate-300 border border-slate-800 max-w-full" dir="ltr">
                   {webhookExample}
                 </pre>
              </div>

              <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-amber-300 mb-2">Security</h4>
                <p className="text-xs text-amber-200">
                  Each webhook will contain an <code>X-Webhook-Secret</code> header for source verification.
                  Make sure to validate the secret on your server side.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-slate-700 text-slate-300">
              <ExternalLink className="w-4 h-4 ml-2" />
              Full Documentation
            </Button>
            <Button variant="outline" className="flex-1 border-slate-700 text-slate-300">
              <Code className="w-4 h-4 ml-2" />
              Code Examples
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}