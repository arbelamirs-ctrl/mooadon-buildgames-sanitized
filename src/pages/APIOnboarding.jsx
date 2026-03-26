import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Zap, Code, TestTubes, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const CODE_SAMPLES = {
  curl: `curl -X POST https://api.mooadon.com/api/redeem \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_phone": "+972512345678",
    "amount": 100
  }'`,
  python: `import requests

headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

data = {
    "client_phone": "+972512345678",
    "amount": 100
}

response = requests.post(
    "https://api.mooadon.com/api/redeem",
    headers=headers,
    json=data
)

print(response.json())`,
  node: `const axios = require('axios');

const config = {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
};

const data = {
  client_phone: '+972512345678',
  amount: 100
};

axios.post('https://api.mooadon.com/api/redeem', data, config)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));`,
};

export default function APIOnboarding() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1); // 1=Generate, 2=Sample, 3=Test
  const [selectedLang, setSelectedLang] = useState('curl');
  const [showKey, setShowKey] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testAmount, setTestAmount] = useState('100');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState('');

  // Fetch company to check plan tier
  const { data: company } = useQuery({
    queryKey: ['company-for-api', primaryCompanyId],
    queryFn: async () => {
      if (!primaryCompanyId) return null;
      const companies = await base44.entities.Company.filter({ id: primaryCompanyId });
      return companies[0] || null;
    },
    enabled: !!primaryCompanyId,
  });

  // Fetch existing API keys
  const { data: apiKeys = [] } = useQuery({
    queryKey: ['api-keys', primaryCompanyId],
    queryFn: async () => {
      if (!primaryCompanyId) return [];
      // Using metadata or a custom entity - adjust based on your setup
      return [];
    },
    enabled: !!primaryCompanyId,
  });

  const primaryKey = apiKeys[0];

  // Generate API Key
  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      // Generate a random key (in production, store in database)
      const key = `mooadon_sk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // Store in company metadata or separate entity
      await base44.entities.Company.update(primaryCompanyId, {
        api_key: key, // Add this field to Company entity
      });
      return key;
    },
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', primaryCompanyId] });
      toast.success('API Key generated successfully');
    },
  });

  // Test API call
  const testAPI = async () => {
    if (!testPhone || !testAmount) {
      toast.error('Enter phone and amount');
      return;
    }

    setTestLoading(true);
    try {
      const response = await base44.functions.invoke('testAPIRedeem', {
        api_key: primaryKey,
        client_phone: testPhone,
        amount: parseInt(testAmount),
      });
      setTestResult(response.data);
      toast.success('Test successful!');
    } catch (error) {
      setTestResult({ error: error.message });
      toast.error('Test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  // Check access - admins can access regardless of plan
  const { user, isSystemAdmin } = useUserPermissions();
  if (company && !isSystemAdmin && company.plan_tier !== 'advanced' && company.plan_tier !== 'pro') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-blue-500/30 max-w-md">
          <CardContent className="p-6 text-center">
            <Zap className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">API Access Requires Advanced Plan</h2>
            <p className="text-slate-400 text-sm">Upgrade to unlock API integration.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Code className="w-6 h-6 text-teal-400" />
          API Integration
        </h1>
        <p className="text-slate-400 mt-1">Connect your systems and automate transactions</p>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              step === s
                ? 'bg-teal-500 text-white'
                : 'bg-[#1f2128] border border-[#2d2d3a] text-slate-400 hover:border-teal-500/50'
            }`}
          >
            {s === 1 && '🔑 Generate Key'}
            {s === 2 && '📝 Sample Code'}
            {s === 3 && '✅ Test API'}
          </button>
        ))}
      </div>

      {/* Step 1: Generate API Key */}
      {step === 1 && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="border-b border-[#2d2d3a]">
            <CardTitle className="text-white">Step 1: Generate API Key</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {primaryKey ? (
              <>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-sm text-green-400 font-medium mb-3">✓ You have an active API key</p>
                  <div className="bg-[#17171f] rounded-lg p-3 flex items-center justify-between">
                    <code className="text-xs text-slate-300 font-mono">
                      {showKey ? primaryKey : '••••••••••••••••'}
                    </code>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="p-1 hover:bg-[#2d2d3a] rounded transition-colors"
                      >
                        {showKey ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(primaryKey, 'key')}
                        className="p-1 hover:bg-[#2d2d3a] rounded transition-colors"
                      >
                        {copied === 'key' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-xs text-yellow-400">
                    <strong>⚠️ Keep this key secret!</strong> Never commit it to version control.
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
                <p className="text-sm text-blue-300">Generate your first API key to get started</p>
                <Button
                  onClick={() => generateKeyMutation.mutate()}
                  disabled={generateKeyMutation.isPending}
                  className="bg-teal-500 hover:bg-teal-600 w-full"
                >
                  {generateKeyMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Generate API Key
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 mt-6">
              <h3 className="text-sm font-semibold text-white mb-2">API Endpoint</h3>
              <code className="text-xs text-teal-400">https://api.mooadon.com/api/redeem</code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Sample Code */}
      {step === 2 && primaryKey && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="border-b border-[#2d2d3a]">
            <CardTitle className="text-white">Step 2: Code Examples</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Language Selector */}
            <div className="flex gap-2">
              {Object.keys(CODE_SAMPLES).map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    selectedLang === lang
                      ? 'bg-teal-500 text-white'
                      : 'bg-[#17171f] text-slate-400 hover:text-white'
                  }`}
                >
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </button>
              ))}
            </div>

            {/* Code Block */}
            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
              <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
                {CODE_SAMPLES[selectedLang].replace('YOUR_API_KEY', primaryKey)}
              </pre>
              <Button
                onClick={() => copyToClipboard(CODE_SAMPLES[selectedLang].replace('YOUR_API_KEY', primaryKey), 'code')}
                variant="outline"
                className="mt-3 w-full text-xs"
              >
                {copied === 'code' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copied === 'code' ? 'Copied!' : 'Copy Code'}
              </Button>
            </div>

            {/* API Reference */}
            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Request Parameters</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-teal-400">client_phone</span> <span className="text-slate-500">(string, required)</span>
                  <p className="text-slate-400 mt-0.5">Customer phone number with country code</p>
                </div>
                <div>
                  <span className="text-teal-400">amount</span> <span className="text-slate-500">(number, required)</span>
                  <p className="text-slate-400 mt-0.5">Amount to redeem/spend in tokens</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Test API */}
      {step === 3 && primaryKey && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="border-b border-[#2d2d3a]">
            <CardTitle className="flex items-center gap-2 text-white">
              <TestTubes className="w-5 h-5" />
              Step 3: Test Your API
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Customer Phone</label>
                <Input
                  placeholder="+972512345678"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="bg-[#17171f] border-[#2d2d3a] text-white text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Amount (Tokens)</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={testAmount}
                  onChange={e => setTestAmount(e.target.value)}
                  className="bg-[#17171f] border-[#2d2d3a] text-white text-xs"
                />
              </div>
              <Button
                onClick={testAPI}
                disabled={testLoading}
                className="bg-teal-500 hover:bg-teal-600 w-full"
              >
                {testLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  '✓ Test API Call'
                )}
              </Button>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`rounded-lg p-4 ${
                testResult.error
                  ? 'bg-red-500/10 border border-red-500/30'
                  : 'bg-green-500/10 border border-green-500/30'
              }`}>
                <p className={`text-xs font-semibold mb-2 ${testResult.error ? 'text-red-400' : 'text-green-400'}`}>
                  {testResult.error ? '❌ Test Failed' : '✓ Test Successful'}
                </p>
                <pre className="text-xs text-slate-300 bg-[#17171f] p-2 rounded overflow-x-auto">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300">
                💡 This will process a real transaction in test mode. You can undo it later.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Status */}
      <Card className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Integration Ready</p>
              <p className="text-xs text-slate-400 mt-1">Your API is live and ready to receive requests</p>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              ✓ Active
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}