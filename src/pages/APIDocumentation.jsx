import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Code, Webhook, Key, Shield } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = window.location.origin;

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/pos/transaction',
    name: 'Create Transaction',
    description: 'Record a new sale and award loyalty points',
    auth: true,
    params: [
      { name: 'client_phone', type: 'string', required: true, description: 'Customer phone number' },
      { name: 'amount', type: 'number', required: true, description: 'Transaction amount' },
      { name: 'order_id', type: 'string', required: false, description: 'Your POS order ID' },
      { name: 'branch_id', type: 'string', required: false, description: 'Branch identifier' }
    ],
    example: {
      client_phone: '+972501234567',
      amount: 150.50,
      order_id: 'POS-12345'
    }
  },
  {
    method: 'GET',
    path: '/api/pos/balance',
    name: 'Check Balance',
    description: 'Get customer loyalty points balance',
    auth: true,
    params: [
      { name: 'phone', type: 'string', required: true, description: 'Customer phone number' }
    ],
    example: {
      phone: '+972501234567'
    }
  },
  {
    method: 'POST',
    path: '/api/pos/redeem',
    name: 'Redeem Reward',
    description: 'Redeem loyalty points for rewards',
    auth: true,
    params: [
      { name: 'client_phone', type: 'string', required: true, description: 'Customer phone number' },
      { name: 'reward_id', type: 'string', required: true, description: 'Reward item ID' },
      { name: 'points', type: 'number', required: true, description: 'Points to redeem' }
    ],
    example: {
      client_phone: '+972501234567',
      reward_id: 'reward_abc123',
      points: 100
    }
  }
];

export default function APIDocumentation() {
  const [selectedLang, setSelectedLang] = useState('curl');

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const generateCode = (endpoint, lang) => {
    const url = `${API_BASE}${endpoint.path}`;
    const exampleJson = JSON.stringify(endpoint.example, null, 2);
    
    if (lang === 'curl') {
      if (endpoint.method === 'GET') {
        const params = new URLSearchParams(endpoint.example).toString();
        return `curl -X GET "${url}?${params}" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-API-Secret: YOUR_API_SECRET"`;
      }
      return `curl -X ${endpoint.method} "${url}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-API-Secret: YOUR_API_SECRET" \\
  -d '${exampleJson}'`;
    }
    
    if (lang === 'javascript') {
      if (endpoint.method === 'GET') {
        const params = new URLSearchParams(endpoint.example).toString();
        return `const response = await fetch('${url}?${params}', {
  method: 'GET',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'X-API-Secret': 'YOUR_API_SECRET'
  }
});

const data = await response.json();
console.log(data);`;
      }
      return `const response = await fetch('${url}', {
  method: '${endpoint.method}',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY',
    'X-API-Secret': 'YOUR_API_SECRET'
  },
  body: JSON.stringify(${exampleJson})
});

const data = await response.json();
console.log(data);`;
    }
    
    if (lang === 'python') {
      if (endpoint.method === 'GET') {
        return `import requests

params = ${exampleJson}

response = requests.get(
    '${url}',
    params=params,
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'X-API-Secret': 'YOUR_API_SECRET'
    }
)

print(response.json())`;
      }
      return `import requests

data = ${exampleJson}

response = requests.${endpoint.method.toLowerCase()}(
    '${url}',
    json=data,
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'X-API-Secret': 'YOUR_API_SECRET'
    }
)

print(response.json())`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">API Documentation</h1>
        <p className="text-[#9ca3af] text-sm">Integrate Mooadon loyalty with your POS system</p>
      </div>

      {/* Authentication */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#10b981]" />
            <CardTitle className="text-white text-base">Authentication</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[#9ca3af] text-sm">
            All API requests require authentication using API Key and Secret. Include these in your request headers:
          </p>
          <div className="bg-[#17171f] rounded-lg p-3 border border-[#2d2d3a]">
            <code className="text-sm text-white">
              X-API-Key: your_api_key<br/>
              X-API-Secret: your_api_secret
            </code>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-sm text-blue-400">
              💡 Get your API credentials from the POS Integration Hub
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      {ENDPOINTS.map((endpoint) => (
        <Card key={endpoint.path} className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={endpoint.method === 'POST' ? 'bg-[#10b981]' : 'bg-blue-500'}>
                  {endpoint.method}
                </Badge>
                <div>
                  <CardTitle className="text-white text-base">{endpoint.name}</CardTitle>
                  <code className="text-xs text-[#9ca3af]">{endpoint.path}</code>
                </div>
              </div>
              {endpoint.auth && (
                <Badge variant="outline" className="border-[#2d2d3a]">
                  <Key className="w-3 h-3 mr-1" />
                  Auth Required
                </Badge>
              )}
            </div>
            <CardDescription className="text-[#9ca3af] text-sm">
              {endpoint.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Parameters */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Parameters</h4>
              <div className="space-y-2">
                {endpoint.params.map(param => (
                  <div key={param.name} className="bg-[#17171f] rounded p-2 border border-[#2d2d3a]">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm text-white">{param.name}</code>
                      <Badge variant="outline" className="text-xs border-[#2d2d3a]">{param.type}</Badge>
                      {param.required && <Badge className="text-xs bg-red-500">required</Badge>}
                    </div>
                    <p className="text-xs text-[#9ca3af]">{param.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Examples */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Code Examples</h4>
              <Tabs value={selectedLang} onValueChange={setSelectedLang}>
                <TabsList className="bg-[#17171f]">
                  <TabsTrigger value="curl" className="data-[state=active]:bg-[#10b981]">cURL</TabsTrigger>
                  <TabsTrigger value="javascript" className="data-[state=active]:bg-[#10b981]">JavaScript</TabsTrigger>
                  <TabsTrigger value="python" className="data-[state=active]:bg-[#10b981]">Python</TabsTrigger>
                </TabsList>
                {['curl', 'javascript', 'python'].map(lang => (
                  <TabsContent key={lang} value={lang}>
                    <div className="relative bg-[#0d1117] rounded-lg p-4 border border-[#2d2d3a]">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 h-8 w-8 p-0"
                        onClick={() => copyCode(generateCode(endpoint, lang))}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <pre className="text-xs text-[#c9d1d9] overflow-x-auto">
                        <code>{generateCode(endpoint, lang)}</code>
                      </pre>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            {/* Response Example */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Success Response</h4>
              <div className="bg-[#0d1117] rounded-lg p-4 border border-[#2d2d3a]">
                <pre className="text-xs text-[#c9d1d9]">
                  <code>{JSON.stringify({
                    success: true,
                    message: 'Operation completed successfully',
                    data: { ...endpoint.example }
                  }, null, 2)}</code>
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Webhooks */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-[#10b981]" />
            <CardTitle className="text-white text-base">Webhooks</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[#9ca3af] text-sm">
            Configure webhook URLs in your POS Integration to receive real-time notifications about:
          </p>
          <ul className="space-y-2 text-sm text-[#9ca3af]">
            <li className="flex items-start gap-2">
              <span className="text-[#10b981] mt-0.5">•</span>
              <span>New transactions and loyalty point awards</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#10b981] mt-0.5">•</span>
              <span>Reward redemptions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#10b981] mt-0.5">•</span>
              <span>Customer tier changes</span>
            </li>
          </ul>
          <div className="bg-[#17171f] rounded-lg p-3 border border-[#2d2d3a]">
            <p className="text-sm text-white mb-2">Webhook payload example:</p>
            <pre className="text-xs text-[#c9d1d9]">
              <code>{JSON.stringify({
                event: 'transaction.created',
                data: {
                  transaction_id: 'tx_123456',
                  client_phone: '+972501234567',
                  amount: 150.50,
                  points_earned: 15,
                  timestamp: '2026-02-02T10:30:00Z'
                }
              }, null, 2)}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}