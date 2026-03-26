import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings, Copy, CheckCircle, XCircle, AlertCircle, Zap, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

const PAYMENT_PROVIDERS = [
  {
    type: 'zettle',
    name: 'Zettle by PayPal',
    icon: '🇸🇪',
    description: '1.75% fee, Swish support, Swedish Tax Agency approved',
    countries: ['Sweden', 'Norway', 'Denmark', 'Finland'],
    features: ['No monthly fees', 'Swish integration', 'Tax approved']
  },
  {
    type: 'tidypay',
    name: 'Tidypay',
    icon: '🇳🇴',
    description: 'Scandinavian PSP using SUNMI hardware (P2 Pro, P2 Mini)',
    countries: ['Norway', 'Sweden', 'Denmark'],
    features: ['SUNMI terminals', 'Cloud-based', 'Modern POS']
  },
  {
    type: 'sitoo',
    name: 'Sitoo',
    icon: '🇸🇪',
    description: 'Cloud-native POS used by Varner (1100+ stores), Zebra devices',
    countries: ['Sweden', 'Norway', 'Denmark'],
    features: ['Enterprise scale', 'Zebra Android', 'Retail focused']
  },
  {
    type: 'softpay',
    name: 'Softpay.io',
    icon: '🇩🇰',
    description: 'Copenhagen-based Tap-to-Phone/SoftPOS provider',
    countries: ['Denmark', 'EU-wide'],
    features: ['Tap-to-Phone', 'No hardware', 'Quick onboarding']
  },
  {
    type: 'sumup',
    name: 'SumUp',
    icon: '🇪🇺',
    description: 'Solo/Air terminals, ~1.90% fee, entry-level solution',
    countries: ['EU-wide', '30+ countries'],
    features: ['Low cost', 'Simple setup', 'Portable terminals']
  },
  {
    type: 'loomis_pay',
    name: 'Loomis Pay',
    icon: '🇸🇪',
    description: 'Castles Technology partnership across Scandinavia & Spain',
    countries: ['Sweden', 'Denmark', 'Norway', 'Spain'],
    features: ['Multi-country', 'Secure payments', 'Cloud integration']
  },
  {
    type: 'worldline',
    name: 'Worldline SmartPOS',
    icon: '🇬🇧',
    description: 'Saturn 1000F2 terminals across 16 European markets',
    countries: ['UK', 'France', 'Germany', 'Belgium', 'Netherlands', '+11 more'],
    features: ['Wide coverage', 'EMV certified', 'Contactless']
  },
  {
    type: 'nets',
    name: 'Nets SmartPOS',
    icon: '🇩🇰',
    description: 'Wi-Fi/4G connectivity, DCC support, digital receipts',
    countries: ['Denmark', 'Norway', 'Finland'],
    features: ['DCC support', 'Digital receipts', '4G connectivity']
  },
  {
    type: 'mypos',
    name: 'myPOS',
    icon: '🇪🇺',
    description: 'European-wide payment solutions',
    countries: ['EU-wide', '30+ countries'],
    features: ['Pan-European', 'Instant settlement', 'Business account']
  }
];

const HARDWARE_MANUFACTURERS = [
  {
    type: 'pax',
    name: 'PAX Technology',
    icon: '🔧',
    description: 'Global leader in payment terminals',
    features: ['Android-based', 'Multiple models', 'EMV certified']
  },
  {
    type: 'ingenico',
    name: 'Ingenico',
    icon: '🔧',
    description: 'Worldline brand, industry standard terminals',
    features: ['Enterprise grade', 'Secure', 'Global support']
  },
  {
    type: 'verifone',
    name: 'Verifone',
    icon: '🔧',
    description: 'Trusted payment technology provider',
    features: ['Reliable', 'Cloud-connected', 'Multi-payment']
  },
  {
    type: 'sunmi',
    name: 'Sunmi',
    icon: '🔧',
    description: 'Smart business IoT devices',
    features: ['All-in-one', 'Android OS', 'Affordable']
  },
  {
    type: 'castles',
    name: 'Castles Technology',
    icon: '🔧',
    description: 'Secure payment solutions',
    features: ['PCI certified', 'Robust', 'Flexible']
  }
];

const SOFTPOS_SOLUTIONS = [
  {
    type: 'mypos_glass',
    name: 'myPOS Glass',
    icon: '📱',
    description: 'Turn any smartphone into a POS terminal',
    features: ['No hardware', 'Tap-to-pay', 'Ideal for 35M micro-merchants'],
    note: 'SoftPOS - Smartphone only'
  },
  {
    type: 'caixabank',
    name: 'CaixaBank App',
    icon: '📱',
    description: 'Spanish banking SoftPOS solution',
    countries: ['Spain'],
    features: ['Bank integration', 'Mobile payment', 'Instant activation'],
    note: 'SoftPOS - Smartphone only'
  },
  {
    type: 'softpay_app',
    name: 'Softpay.io App',
    icon: '📱',
    description: 'Copenhagen Tap-to-Phone solution for merchants',
    countries: ['Denmark', 'Nordic region'],
    features: ['NFC payments', 'Quick setup', 'Cost-effective'],
    note: 'SoftPOS - Smartphone only'
  }
];

const LOCAL_PAYMENT_SCHEMES = [
  {
    type: 'bankaxept',
    name: 'BankAxept',
    icon: '🇳🇴',
    description: 'Norwegian local debit card scheme',
    countries: ['Norway'],
    features: ['Domestic debit', 'Wide acceptance', 'Lower fees'],
    note: 'Supported on modern Android terminals'
  },
  {
    type: 'dankort',
    name: 'Dankort',
    icon: '🇩🇰',
    description: 'Danish national debit card system',
    countries: ['Denmark'],
    features: ['National standard', 'Co-branded options', 'Instant settlement'],
    note: 'Supported on modern Android terminals'
  },
  {
    type: 'swish',
    name: 'Swish',
    icon: '🇸🇪',
    description: 'Swedish mobile payment system',
    countries: ['Sweden'],
    features: ['Mobile payments', 'Instant transfer', 'Bank integration'],
    note: 'Supported on modern Android terminals'
  }
];

const REGIONAL_SOLUTIONS = [
  {
    type: 'asa_bank',
    name: 'ASA Bank',
    icon: '🇧🇦',
    description: 'Leading POS provider in Bosnia',
    countries: ['Bosnia and Herzegovina'],
    features: ['Local support', 'Multi-currency', 'Reliable']
  },
  {
    type: 'sabadell',
    name: 'Banco Sabadell Smart POS',
    icon: '🇪🇸',
    description: 'Spanish banking POS solution',
    countries: ['Spain'],
    features: ['Bank integration', 'SME focused', 'Quick setup']
  },
  {
    type: 'tecstore',
    name: 'TecStore + Loyverse',
    icon: '🇬🇧',
    description: 'UK retail solution with Loyverse POS integration',
    countries: ['United Kingdom'],
    features: ['Retail focused', 'Inventory sync', 'Cloud-based']
  }
];

const LEGACY_SYSTEMS = [
  {
    type: 'priority',
    name: 'Priority ERP',
    icon: '📊',
    description: 'Israeli enterprise resource planning system',
    features: ['Real-time sync', 'Inventory management', 'Multi-branch support']
  },
  {
    type: 'zcs',
    name: 'ZCS POS',
    icon: '🏪',
    description: 'Popular retail POS solution',
    features: ['Fast checkout', 'Cloud-based', 'Mobile ready']
  },
  {
    type: 'android_pos',
    name: 'Android POS',
    icon: '📱',
    description: 'Generic Android POS integration',
    features: ['Tablet support', 'Offline mode', 'Custom apps']
  },
  {
    type: 'windows_pos',
    name: 'Windows POS',
    icon: '💻',
    description: 'Desktop POS systems',
    features: ['Legacy support', 'High performance', 'Local storage']
  },
  {
    type: 'custom',
    name: 'Custom Integration',
    icon: '⚡',
    description: 'Build your own integration',
    features: ['REST API', 'Webhooks', 'Full control']
  }
];

export default function POSIntegrationHub() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('provider'); // 'provider' | 'manual'
  const [manualCreated, setManualCreated] = useState(null); // holds created manual integration
  const [formData, setFormData] = useState({
    pos_type: 'priority',
    name: '',
    webhook_url: ''
  });
  const [manualForm, setManualForm] = useState({ provider_name: '', webhook_url: '' });
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['pos-integrations', user?.company_id],
    queryFn: () => base44.entities.POSIntegration.filter({ company_id: user.company_id }),
    enabled: !!user?.company_id
  });

  const { data: apiLogs = [] } = useQuery({
    queryKey: ['api-logs', user?.company_id],
    queryFn: () => base44.entities.APILog.filter({ company_id: user.company_id }, '-created_date', 20),
    enabled: !!user?.company_id
  });

  const generateSecureKey = (prefix) => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${hex}`;
  };

  const createIntegration = useMutation({
    mutationFn: async (data) => {
      const apiKey = generateSecureKey('mk');
      const apiSecret = generateSecureKey('sk');
      
      return base44.entities.POSIntegration.create({
        company_id: user.company_id,
        ...data,
        api_key: apiKey,
        api_secret: apiSecret,
        status: 'active'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pos-integrations']);
      setDialogOpen(false);
      setFormData({ pos_type: 'priority', name: '', webhook_url: '' });
      toast.success('POS integration created successfully');
    }
  });

  const createManualIntegration = useMutation({
    mutationFn: async (data) => {
      const apiKey = generateSecureKey('mk');
      const apiSecret = generateSecureKey('sk');
      return base44.entities.POSIntegration.create({
        company_id: user.company_id,
        pos_type: 'manual',
        name: data.provider_name,
        webhook_url: data.webhook_url,
        api_key: apiKey,
        api_secret: apiSecret,
        status: 'active'
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries(['pos-integrations']);
      setManualCreated(created);
      toast.success('Manual integration created!');
    }
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      return base44.entities.POSIntegration.update(id, { 
        status: status === 'active' ? 'inactive' : 'active' 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pos-integrations']);
      toast.success('Status updated');
    }
  });

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-[#10b981] text-white',
      inactive: 'bg-[#9ca3af] text-white',
      error: 'bg-red-500 text-white'
    };
    return <Badge className={styles[status]}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10b981]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">POS Integration Hub</h1>
          <p className="text-[#9ca3af] text-sm">Connect your point-of-sale systems</p>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl('APIDocumentation')}>
            <Button variant="outline" className="border-[#2d2d3a]">
              <LinkIcon className="w-4 h-4 mr-2" />
              API Docs
            </Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setDialogMode('provider'); setManualCreated(null); setManualForm({ provider_name: '', webhook_url: '' }); } }}>
            <DialogTrigger asChild>
              <Button className="bg-[#10b981] hover:bg-[#059669]">
                <Plus className="w-4 h-4 mr-2" />
                Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1f2128] border-[#2d2d3a] max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">Add POS Integration</DialogTitle>
              </DialogHeader>

              {/* Mode selector */}
              <div className="flex gap-2 p-1 bg-[#17171f] rounded-lg">
                <button
                  onClick={() => setDialogMode('provider')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${dialogMode === 'provider' ? 'bg-[#10b981] text-white' : 'text-[#9ca3af] hover:text-white'}`}
                >
                  Provider from List
                </button>
                <button
                  onClick={() => setDialogMode('manual')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${dialogMode === 'manual' ? 'bg-blue-600 text-white' : 'text-[#9ca3af] hover:text-white'}`}
                >
                  ⚡ Manual / API
                </button>
              </div>

              {dialogMode === 'provider' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-white">POS System</Label>
                    <Select value={formData.pos_type} onValueChange={(val) => setFormData({...formData, pos_type: val})}>
                      <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                        {[...PAYMENT_PROVIDERS, ...HARDWARE_MANUFACTURERS, ...SOFTPOS_SOLUTIONS, ...LOCAL_PAYMENT_SCHEMES, ...REGIONAL_SOLUTIONS, ...LEGACY_SYSTEMS].map(pos => (
                          <SelectItem key={pos.type} value={pos.type} className="text-white">
                            {pos.icon} {pos.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Integration Name</Label>
                    <Input 
                      placeholder="e.g., Main Store POS"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="bg-[#17171f] border-[#2d2d3a] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Webhook URL (Optional)</Label>
                    <Input 
                      placeholder="https://your-pos.com/webhook"
                      value={formData.webhook_url}
                      onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                      className="bg-[#17171f] border-[#2d2d3a] text-white"
                    />
                  </div>
                  <Button 
                    onClick={() => createIntegration.mutate(formData)}
                    disabled={!formData.name || createIntegration.isPending}
                    className="w-full bg-[#10b981] hover:bg-[#059669]"
                  >
                    Create Integration
                  </Button>
                </div>
              )}

              {dialogMode === 'manual' && !manualCreated && (
                <div className="space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-400">
                    ⚡ Manual integration — your POS will call our API endpoint with transactions
                  </div>
                  <div>
                    <Label className="text-white">POS Provider Name</Label>
                    <Input
                      placeholder="e.g., Rotman, my-custom-pos"
                      value={manualForm.provider_name}
                      onChange={(e) => setManualForm({...manualForm, provider_name: e.target.value})}
                      className="bg-[#17171f] border-[#2d2d3a] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Webhook URL (Optional)</Label>
                    <Input
                      placeholder="https://your-pos.com/events"
                      value={manualForm.webhook_url}
                      onChange={(e) => setManualForm({...manualForm, webhook_url: e.target.value})}
                      className="bg-[#17171f] border-[#2d2d3a] text-white"
                    />
                    <p className="text-xs text-[#9ca3af] mt-1">We will call this URL when events happen (optional)</p>
                  </div>
                  <Button
                    onClick={() => createManualIntegration.mutate(manualForm)}
                    disabled={!manualForm.provider_name || createManualIntegration.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {createManualIntegration.isPending ? <><span className="animate-spin mr-2">⏳</span>Creating...</> : 'Create Manual Integration'}
                  </Button>
                </div>
              )}

              {dialogMode === 'manual' && manualCreated && (
                <div className="space-y-3">
                  <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg p-3 text-sm text-[#10b981]">
                    ✅ Integration created for <strong>{manualCreated.name}</strong>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-[#17171f] rounded-lg p-3">
                      <p className="text-xs text-[#9ca3af] mb-1">API Key</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-yellow-400 font-mono flex-1 break-all">{manualCreated.api_key}</code>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => { navigator.clipboard.writeText(manualCreated.api_key); toast.success('Copied!'); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-[#17171f] rounded-lg p-3">
                      <p className="text-xs text-[#9ca3af] mb-1">Transactions Endpoint</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-teal-400 font-mono flex-1 break-all">POST /api/pos/transaction</code>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => { navigator.clipboard.writeText('POST /api/pos/transaction'); toast.success('Copied!'); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-[#17171f] rounded-lg p-3">
                      <p className="text-xs text-[#9ca3af] mb-1">API Secret</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-blue-400 font-mono flex-1 break-all">{manualCreated.api_secret}</code>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => { navigator.clipboard.writeText(manualCreated.api_secret); toast.success('Copied!'); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full border-[#2d2d3a] text-white" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Scandinavian Providers */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-base">🇸🇪 🇳🇴 🇩🇰 Scandinavian Payment Providers</CardTitle>
          <CardDescription className="text-[#9ca3af] text-sm">
            Leading Nordic payment solutions with Swish, BankAxept & Dankort support
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-400">
              💡 Modern Android terminals support local schemes (BankAxept, Dankort, Swish) alongside international cards
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PAYMENT_PROVIDERS.filter(p => ['zettle', 'tidypay', 'sitoo', 'softpay', 'sumup'].includes(p.type)).map(provider => (
              <div key={provider.type} className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <div className="text-3xl mb-2">{provider.icon}</div>
                <h3 className="font-semibold text-white mb-1 text-sm">{provider.name}</h3>
                <p className="text-xs text-[#9ca3af] mb-2">{provider.description}</p>
                {provider.countries && (
                  <p className="text-xs text-[#10b981] mb-2">📍 {provider.countries.join(', ')}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {provider.features.map(feature => (
                    <Badge key={feature} variant="outline" className="text-xs border-[#2d2d3a] text-white">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* European Payment Providers */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-base">European Payment Providers</CardTitle>
          <CardDescription className="text-[#9ca3af] text-sm">
            Pan-European payment solutions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PAYMENT_PROVIDERS.filter(p => !['zettle', 'tidypay', 'sitoo', 'softpay', 'sumup'].includes(p.type)).map(provider => (
              <div key={provider.type} className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <div className="text-3xl mb-2">{provider.icon}</div>
                <h3 className="font-semibold text-white mb-1 text-sm">{provider.name}</h3>
                <p className="text-xs text-[#9ca3af] mb-2">{provider.description}</p>
                {provider.countries && (
                  <p className="text-xs text-[#10b981] mb-2">📍 {provider.countries.join(', ')}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {provider.features.map(feature => (
                    <Badge key={feature} variant="outline" className="text-xs border-[#2d2d3a] text-white">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SoftPOS Solutions */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-base">SoftPOS Solutions</CardTitle>
          <CardDescription className="text-[#9ca3af] text-sm">
            Turn smartphones into payment terminals - No hardware needed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-400">
              💡 Perfect for 35M+ micro-merchants - Accept payments with just a smartphone
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SOFTPOS_SOLUTIONS.map(solution => (
              <div key={solution.type} className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-3xl">{solution.icon}</div>
                  <Badge className="bg-[#10b981] text-xs">SoftPOS</Badge>
                </div>
                <h3 className="font-semibold text-white mb-1 text-sm">{solution.name}</h3>
                <p className="text-xs text-[#9ca3af] mb-2">{solution.description}</p>
                {solution.countries && (
                  <p className="text-xs text-[#10b981] mb-2">📍 {solution.countries.join(', ')}</p>
                )}
                <p className="text-xs text-yellow-400 mb-2">⚡ {solution.note}</p>
                <div className="flex flex-wrap gap-1">
                  {solution.features.map(feature => (
                    <Badge key={feature} variant="outline" className="text-xs border-[#2d2d3a] text-white">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Local Payment Schemes */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-base">Local Payment Schemes</CardTitle>
          <CardDescription className="text-[#9ca3af] text-sm">
            Nordic national payment systems - supported on modern Android terminals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {LOCAL_PAYMENT_SCHEMES.map(scheme => (
              <div key={scheme.type} className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <div className="text-3xl mb-2">{scheme.icon}</div>
                <h3 className="font-semibold text-white mb-1 text-sm">{scheme.name}</h3>
                <p className="text-xs text-[#9ca3af] mb-2">{scheme.description}</p>
                {scheme.countries && (
                  <p className="text-xs text-[#10b981] mb-2">📍 {scheme.countries.join(', ')}</p>
                )}
                <p className="text-xs text-yellow-400 mb-2">⚡ {scheme.note}</p>
                <div className="flex flex-wrap gap-1">
                  {scheme.features.map(feature => (
                    <Badge key={feature} variant="outline" className="text-xs border-[#2d2d3a] text-white">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hardware Manufacturers */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-base">Hardware Manufacturers</CardTitle>
          <CardDescription className="text-[#9ca3af] text-sm">
            Compatible payment terminal brands
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {HARDWARE_MANUFACTURERS.map(hw => (
              <div key={hw.type} className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <div className="text-3xl mb-2">{hw.icon}</div>
                <h3 className="font-semibold text-white mb-1 text-sm">{hw.name}</h3>
                <p className="text-xs text-[#9ca3af] mb-2">{hw.description}</p>
                <div className="flex flex-wrap gap-1">
                  {hw.features.map(feature => (
                    <Badge key={feature} variant="outline" className="text-xs border-[#2d2d3a] text-white">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Regional Solutions */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-base">Regional Solutions</CardTitle>
          <CardDescription className="text-[#9ca3af] text-sm">
            Local payment providers with regional expertise
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REGIONAL_SOLUTIONS.map(regional => (
              <div key={regional.type} className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <div className="text-3xl mb-2">{regional.icon}</div>
                <h3 className="font-semibold text-white mb-1 text-sm">{regional.name}</h3>
                <p className="text-xs text-[#9ca3af] mb-2">{regional.description}</p>
                {regional.countries && (
                  <p className="text-xs text-[#10b981] mb-2">📍 {regional.countries.join(', ')}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {regional.features.map(feature => (
                    <Badge key={feature} variant="outline" className="text-xs border-[#2d2d3a] text-white">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legacy Systems */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-base">Legacy & Custom Systems</CardTitle>
          <CardDescription className="text-[#9ca3af] text-sm">
            Traditional POS systems and custom integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {LEGACY_SYSTEMS.map(pos => (
              <div key={pos.type} className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                <div className="text-3xl mb-2">{pos.icon}</div>
                <h3 className="font-semibold text-white mb-1">{pos.name}</h3>
                <p className="text-xs text-[#9ca3af] mb-3">{pos.description}</p>
                <div className="flex flex-wrap gap-1">
                  {pos.features.map(feature => (
                    <Badge key={feature} variant="outline" className="text-xs border-[#2d2d3a] text-white">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Integrations */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-base">Active Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="w-12 h-12 text-[#9ca3af] mx-auto mb-3 opacity-50" />
              <p className="text-[#9ca3af] text-sm">No integrations yet. Create your first one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map(integration => {
                const allSystems = [...PAYMENT_PROVIDERS, ...HARDWARE_MANUFACTURERS, ...SOFTPOS_SOLUTIONS, ...LOCAL_PAYMENT_SCHEMES, ...REGIONAL_SOLUTIONS, ...LEGACY_SYSTEMS];
                const posSystem = allSystems.find(p => p.type === integration.pos_type);
                return (
                  <div key={integration.id} className="bg-[#17171f] rounded-lg p-4 border border-[#2d2d3a]">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{posSystem?.icon}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white">{integration.name}</h4>
                            {getStatusBadge(integration.status)}
                          </div>
                          <p className="text-xs text-[#9ca3af]">{posSystem?.name}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#2d2d3a]"
                        onClick={() => toggleStatus.mutate({ id: integration.id, status: integration.status })}
                      >
                        {integration.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="bg-[#1f2128] rounded p-2">
                        <Label className="text-xs text-[#9ca3af]">API Key</Label>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-white font-mono">{integration.api_key}</code>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(integration.api_key, 'API Key')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="bg-[#1f2128] rounded p-2">
                        <Label className="text-xs text-[#9ca3af]">API Secret</Label>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-white font-mono">{integration.api_secret}</code>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(integration.api_secret, 'API Secret')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {integration.last_sync && (
                        <p className="text-xs text-[#9ca3af]">
                          Last sync: {new Date(integration.last_sync).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent API Calls */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-base">Recent API Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {apiLogs.length === 0 ? (
            <p className="text-[#9ca3af] text-sm text-center py-4">No API calls yet</p>
          ) : (
            <div className="space-y-2">
              {apiLogs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-center justify-between bg-[#17171f] rounded p-3 text-xs">
                  <div className="flex items-center gap-3">
                    {log.status_code < 300 ? (
                      <CheckCircle className="w-4 h-4 text-[#10b981]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-[#2d2d3a] text-white">{log.method}</Badge>
                        <code className="text-white">{log.endpoint}</code>
                      </div>
                      <p className="text-[#9ca3af]">{new Date(log.created_date).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={log.status_code < 300 ? 'bg-[#10b981]' : 'bg-red-500'}>
                      {log.status_code}
                    </Badge>
                    {log.duration_ms && (
                      <p className="text-[#9ca3af] mt-1">{log.duration_ms}ms</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}