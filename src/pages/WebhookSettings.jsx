import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Webhook, 
  Key, 
  Copy, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Code,
  Activity,
  Send,
  Loader2,
  Clock,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function WebhookSettings() {
  const { user, primaryCompanyId } = useUserPermissions();
  const [testPhone, setTestPhone] = useState('');
  const [testAmount, setTestAmount] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', primaryCompanyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const mainBranch = branches[0];

  const { data: webhookLogs = [] } = useQuery({
    queryKey: ['webhookLogs', mainBranch?.id],
    queryFn: () => base44.entities.WebhookLog.filter(
      { branch_id: mainBranch.id },
      '-created_date',
      50
    ),
    enabled: !!mainBranch?.id,
    refetchInterval: 5000
  });

  const generateApiKeyMutation = useMutation({
    mutationFn: async () => {
      const newKey = `mlt_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      await base44.entities.Branch.update(mainBranch.id, {
        api_key: newKey
      });
      return newKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success('API key generated!');
    },
    onError: () => {
      toast.error('Failed to generate API key');
    }
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const testWebhook = async () => {
    if (!testPhone || !testAmount) {
      toast.error('Enter phone and amount');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const response = await base44.functions.invoke('posTransactionWebhook', {
        phone: testPhone,
        amount: parseFloat(testAmount),
        branch_api_key: mainBranch.api_key,
        order_id: `TEST-${Date.now()}`
      });

      setTestResult({
        success: true,
        data: response.data
      });
      toast.success('Test successful!');
      queryClient.invalidateQueries({ queryKey: ['webhookLogs'] });
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message
      });
      toast.error('Test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/functions/posTransactionWebhook`;

  const curlExample = `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+1234567890",
    "amount": 50.00,
    "branch_api_key": "${mainBranch?.api_key || 'YOUR_API_KEY'}",
    "order_id": "ORDER-123"
  }'`;

  const pythonExample = `import requests

url = "${webhookUrl}"
data = {
    "phone": "+1234567890",
    "amount": 50.00,
    "branch_api_key": "${mainBranch?.api_key || 'YOUR_API_KEY'}",
    "order_id": "ORDER-123"
}

response = requests.post(url, json=data)
print(response.json())`;

  const jsExample = `fetch('${webhookUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone: '+1234567890',
    amount: 50.00,
    branch_api_key: '${mainBranch?.api_key || 'YOUR_API_KEY'}',
    order_id: 'ORDER-123'
  })
})
.then(res => res.json())
.then(data => console.log(data));`;

  const successRate = webhookLogs.length > 0
    ? ((webhookLogs.filter(log => log.status_code === 200).length / webhookLogs.length) * 100).toFixed(1)
    : 0;

  const avgDuration = webhookLogs.length > 0
    ? (webhookLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / webhookLogs.length).toFixed(0)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhook Integration</h1>
          <p className="text-[#9ca3af] text-sm mt-1">
            Connect your POS system to the loyalty platform
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#9ca3af] text-xs">Total Calls</p>
                <p className="text-2xl font-bold text-white mt-1">{webhookLogs.length}</p>
              </div>
              <Activity className="w-8 h-8 text-[#10b981]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#9ca3af] text-xs">Success Rate</p>
                <p className="text-2xl font-bold text-[#10b981] mt-1">{successRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-[#10b981]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#9ca3af] text-xs">Avg Response</p>
                <p className="text-2xl font-bold text-white mt-1">{avgDuration}ms</p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList className="bg-[#1f2128] border border-[#2d2d3a]">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-6">
          {/* API Key */}
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="flex items-center gap-2 text-white">
                <Key className="w-5 h-5" />
                API Key
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-white">Your API Key</Label>
                <div className="flex gap-2">
                  <Input
                    value={mainBranch?.api_key || 'No API key generated'}
                    readOnly
                    className="font-mono bg-[#17171f] border-[#2d2d3a] text-white"
                  />
                  {mainBranch?.api_key && (
                    <Button
                      onClick={() => copyToClipboard(mainBranch.api_key)}
                      variant="outline"
                      className="border-[#2d2d3a]"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <Button
                onClick={() => generateApiKeyMutation.mutate()}
                disabled={generateApiKeyMutation.isPending}
                className="bg-[#10b981] hover:bg-[#059669]"
              >
                {generateApiKeyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {mainBranch?.api_key ? 'Regenerate' : 'Generate'} API Key
                  </>
                )}
              </Button>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <p className="text-orange-400 text-xs">
                  ⚠️ Keep your API key secure. Regenerating will invalidate the old key.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Webhook URL */}
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="flex items-center gap-2 text-white">
                <Webhook className="w-5 h-5" />
                Webhook Endpoint
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-white">Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono bg-[#17171f] border-[#2d2d3a] text-white"
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
                <Label className="text-white">Rate Limit</Label>
                <p className="text-[#9ca3af] text-sm">100 requests per minute per API key</p>
              </div>
            </CardContent>
          </Card>

          {/* Code Examples */}
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="flex items-center gap-2 text-white">
                <Code className="w-5 h-5" />
                Integration Examples
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Tabs defaultValue="curl">
                <TabsList className="bg-[#17171f]">
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                  <TabsTrigger value="js">JavaScript</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                </TabsList>

                <TabsContent value="curl" className="mt-4">
                  <pre className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 overflow-x-auto text-xs text-[#9ca3af]">
                    {curlExample}
                  </pre>
                  <Button
                    onClick={() => copyToClipboard(curlExample)}
                    variant="outline"
                    size="sm"
                    className="mt-2 border-[#2d2d3a]"
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copy
                  </Button>
                </TabsContent>

                <TabsContent value="js" className="mt-4">
                  <pre className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 overflow-x-auto text-xs text-[#9ca3af]">
                    {jsExample}
                  </pre>
                  <Button
                    onClick={() => copyToClipboard(jsExample)}
                    variant="outline"
                    size="sm"
                    className="mt-2 border-[#2d2d3a]"
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copy
                  </Button>
                </TabsContent>

                <TabsContent value="python" className="mt-4">
                  <pre className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 overflow-x-auto text-xs text-[#9ca3af]">
                    {pythonExample}
                  </pre>
                  <Button
                    onClick={() => copyToClipboard(pythonExample)}
                    variant="outline"
                    size="sm"
                    className="mt-2 border-[#2d2d3a]"
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copy
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="space-y-6">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="flex items-center gap-2 text-white">
                <Send className="w-5 h-5" />
                Test Webhook
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">Phone Number</Label>
                  <Input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="bg-[#17171f] border-[#2d2d3a] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Amount</Label>
                  <Input
                    type="number"
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    placeholder="50.00"
                    className="bg-[#17171f] border-[#2d2d3a] text-white"
                  />
                </div>
              </div>

              <Button
                onClick={testWebhook}
                disabled={testLoading || !mainBranch?.api_key}
                className="w-full bg-[#10b981] hover:bg-[#059669]"
              >
                {testLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Test Request
                  </>
                )}
              </Button>

              {testResult && (
                <div className={`rounded-lg p-4 ${
                  testResult.success 
                    ? 'bg-[#10b981]/10 border border-[#10b981]/30' 
                    : 'bg-red-500/10 border border-red-500/30'
                }`}>
                  <div className="flex items-start gap-3">
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5 text-[#10b981] mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium mb-2 ${
                        testResult.success ? 'text-[#10b981]' : 'text-red-400'
                      }`}>
                        {testResult.success ? 'Success!' : 'Failed'}
                      </p>
                      <pre className="text-xs text-[#9ca3af] overflow-x-auto">
                        {JSON.stringify(testResult.success ? testResult.data : testResult.error, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="flex items-center gap-2 text-white">
                <Activity className="w-5 h-5" />
                Recent Webhook Calls
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {webhookLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-[#9ca3af] opacity-30" />
                  <p className="text-[#9ca3af]">No webhook calls yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {webhookLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 hover:border-[#10b981]/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.status_code === 200 ? (
                            <CheckCircle className="w-4 h-4 text-[#10b981]" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className={`font-mono text-sm font-bold ${
                            log.status_code === 200 ? 'text-[#10b981]' : 'text-red-400'
                          }`}>
                            {log.status_code}
                          </span>
                          <span className="text-[#9ca3af] text-xs">
                            {log.method} {log.endpoint}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#9ca3af]">
                            {format(new Date(log.created_date), 'HH:mm:ss')}
                          </p>
                          <p className="text-xs text-blue-400">{log.duration_ms}ms</p>
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        {log.request_body?.phone && (
                          <p className="text-[#9ca3af]">
                            Phone: <span className="text-white">{log.request_body.phone}</span>
                          </p>
                        )}
                        {log.request_body?.amount && (
                          <p className="text-[#9ca3af]">
                            Amount: <span className="text-white">${log.request_body.amount}</span>
                          </p>
                        )}
                        {log.error_message && (
                          <p className="text-red-400 mt-1">Error: {log.error_message}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}