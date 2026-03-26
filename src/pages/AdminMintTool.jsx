import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Coins, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMintTool() {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState('');
  const [useMainnet, setUseMainnet] = useState(false);
  const [mintResult, setMintResult] = useState(null);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => base44.entities.Company.list('-created_date', 1000)
  });

  const { data: companyToken } = useQuery({
    queryKey: ['company-token', selectedCompanyId],
    queryFn: async () => {
      const tokens = await base44.entities.CompanyToken.filter({ 
        company_id: selectedCompanyId 
      });
      // Prefer the primary token; fall back to first
      return tokens.find(t => t.is_primary) || tokens[0];
    },
    enabled: !!selectedCompanyId
  });

  const mintMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('manualAdminMint', data),
    onSuccess: (result) => {
      setMintResult(result.data);
      toast.success('Tokens minted successfully!');
      setAmount('');
      setRecipient('');
      setReason('');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleMint = () => {
    if (!selectedCompanyId || !amount || !reason) {
      toast.error('Please fill all required fields');
      return;
    }

    mintMutation.mutate({
      company_id: selectedCompanyId,
      client_id: recipient, // Using recipient field as client_id
      amount: parseFloat(amount),
      reason
    });
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Coins className="w-8 h-8 text-teal-400" />
        <div>
          <h1 className="text-2xl font-semibold text-white">Admin Mint Tool</h1>
          <p className="text-slate-400 text-sm">Manually mint tokens to company treasury</p>
        </div>
      </div>

      <Card className="bg-amber-500/10 border-amber-500/30">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div className="text-sm text-amber-400">
            <p className="font-medium mb-1">⚠️ Admin Only</p>
            <p>This tool allows direct minting of tokens. Use with caution and always document the reason.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white">Mint Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-white">Select Company *</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white">
                <SelectValue placeholder="Choose company..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1f2128] border-[#2d2d3a]">
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id} className="text-white">
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {companyToken && (
            <Card className="bg-[#17171f] border-[#2d2d3a]">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Token Symbol:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono">{companyToken.token_symbol}</span>
                    {companyToken.is_primary && <span className="text-yellow-400 text-xs">★ Primary</span>}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Treasury:</span>
                  <span className="text-white font-mono text-xs">{companyToken.treasury_wallet?.substring(0, 10)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Supply:</span>
                  <span className="text-white">{companyToken.total_supply?.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <Label className="text-white">Amount to Mint *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>

          <div>
            <Label className="text-white">Client ID *</Label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Enter client ID"
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
            <p className="text-xs text-slate-500 mt-1">Client must have a valid wallet address</p>
          </div>

          <div>
            <Label className="text-white">Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Initial treasury funding, bonus campaign..."
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>

          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-3 text-xs text-amber-400">
              <p><strong>Environment:</strong> {process.env.MOOD_ENV || 'dev'} (Testnet only - Mainnet blocked)</p>
              <p><strong>Daily Cap:</strong> {parseFloat(process.env.ADMIN_MINT_DAILY_CAP || 0).toLocaleString()} tokens</p>
            </CardContent>
          </Card>

          <Button
            onClick={handleMint}
            disabled={mintMutation.isPending}
            className="w-full bg-teal-500 hover:bg-teal-600"
          >
            {mintMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Minting...
              </>
            ) : (
              <>
                <Coins className="w-4 h-4 mr-2" />
                Mint Tokens
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {mintResult && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-6 space-y-3">
            <h3 className="text-green-400 font-semibold">✅ Mint Successful</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="text-white">{mintResult.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">To:</span>
                <span className="text-white font-mono text-xs">{mintResult.recipient?.substring(0, 20)}...</span>
              </div>
              {mintResult.txHash && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Transaction:</span>
                  <a
                    href={mintResult.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:text-teal-300 flex items-center gap-1"
                  >
                    View on Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}