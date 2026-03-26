import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { 
  Loader2, 
  Wrench, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Building2,
  Wallet,
  Coins,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

export default function CompanyRepairTool() {
  const { user, isSystemAdmin } = useUserPermissions();
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [overrideDialog, setOverrideDialog] = useState(null); // { type, existing_value, message }

  // Fetch all companies for dropdown
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['repair-companies'],
    queryFn: async () => {
      return await base44.entities.Company.list('-created_date');
    },
    enabled: isSystemAdmin,
  });

  // Diagnose company
  const handleDiagnose = async () => {
    if (!companyId) {
      toast.error('Please enter a company ID');
      return;
    }

    setDiagnosisLoading(true);
    setCompanyData(null);
    setResults(null);

    try {
      const companies = await base44.entities.Company.filter({ id: companyId });
      if (companies.length === 0) {
        toast.error('Company not found');
        return;
      }

      const company = companies[0];
      const tokens = await base44.entities.CompanyToken.filter({ company_id: companyId });
      const transfers = await base44.entities.BlockchainTransfer.filter({ company_id: companyId });

      // Also check on-chain balance if wallet exists, to catch cases where TX was sent but not recorded
      let onChainFunded = false;
      if (company.blockchain_wallet_address && transfers.length === 0) {
        try {
          const balanceRes = await Promise.race([
            base44.functions.invoke('getOnChainBalance', { address: company.blockchain_wallet_address }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
          ]);
          if (balanceRes?.data?.balance_avax > 0) {
            onChainFunded = true;
          }
        } catch (e) {
          // non-critical, ignore
        }
      }

      setCompanyData({
        company,
        hasWallet: !!company.blockchain_wallet_address,
        hasToken: tokens.length > 0,
        token: tokens[0],
        hasAvaxFunding: transfers.length > 0 || onChainFunded,
        transfers
      });

      toast.success('Diagnosis complete');
    } catch (error) {
      console.error('Diagnosis error:', error);
      toast.error(error.message);
    } finally {
      setDiagnosisLoading(false);
    }
  };

  // Repair company
  const handleRepair = async () => {
    if (!companyData) {
      toast.error('Please diagnose first');
      return;
    }

    setLoading(true);
    setResults({ steps: [] });

    try {
      const steps = [];

      // Step 1: Create wallet if missing
      if (!companyData.hasWallet) {
        steps.push({ name: 'Creating Wallet', status: 'running' });
        setResults({ steps: [...steps] });

        try {
          const walletResult = await base44.functions.invoke('createCompanyWallet', {
            companyId: companyId
          });

          if (walletResult.data?.error) {
            throw new Error(walletResult.data.error);
          }

          steps[steps.length - 1] = { 
            name: 'Creating Wallet', 
            status: 'success', 
            data: walletResult.data 
          };
        } catch (error) {
          steps[steps.length - 1] = { 
            name: 'Creating Wallet', 
            status: 'error', 
            error: error.message 
          };
          throw error;
        }
      } else {
        steps.push({ name: 'Wallet Already Exists', status: 'skipped' });
      }

      setResults({ steps: [...steps] });

      // Step 2: Generate tokens if missing
      if (!companyData.hasToken) {
        steps.push({ name: 'Generating Tokens', status: 'running' });
        setResults({ steps: [...steps] });

        try {
          const tokenResult = await base44.functions.invoke('generateCompanyTokens', {
            company_id: companyId,
            tokenName: `${companyData.company.name} Token`,
            tokenSymbol: companyData.company.name.substring(0, 4).toUpperCase(),
            initialSupply: '1000000'
          });

          if (tokenResult.data?.error) {
            throw new Error(tokenResult.data.error);
          }

          steps[steps.length - 1] = { 
            name: 'Generating Tokens', 
            status: 'success', 
            data: tokenResult.data 
          };
        } catch (error) {
          steps[steps.length - 1] = { 
            name: 'Generating Tokens', 
            status: 'error', 
            error: error.message 
          };
          throw error;
        }
      } else {
        steps.push({ name: 'Token Already Exists', status: 'skipped' });
      }

      setResults({ steps: [...steps] });

      // Step 3: Fund treasury if missing
      if (!companyData.hasAvaxFunding) {
        steps.push({ name: 'Funding Treasury (1 AVAX)', status: 'running' });
        setResults({ steps: [...steps] });

        try {
          const fundPromise = base44.functions.invoke('fundNewCompanyTreasury', {
            company_id: companyId,
            avax_amount: 1.0,
            force_override: true
          });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout after 35s. The TX may still be processing on-chain. Check Snowtrace for the gas wallet address, or re-diagnose in 1 minute.')), 35000)
          );

          const fundResult = await Promise.race([fundPromise, timeoutPromise]);

          // Handle idempotency guard responses (409)
          if (fundResult.data?.error === 'ALREADY_FUNDED' || fundResult.data?.error === 'ALREADY_HAS_TOKEN') {
            steps[steps.length - 1] = { name: 'Funding Treasury (1 AVAX)', status: 'skipped' };
            setResults({ steps: [...steps] });
            setLoading(false);
            // Show override dialog
            setOverrideDialog({
              type: fundResult.data.error === 'ALREADY_FUNDED' ? 'wallet' : 'token',
              existing_value: fundResult.data.existing_tx || fundResult.data.existing_token,
              message: fundResult.data.message
            });
            return;
          }

          if (fundResult.data?.error) {
            throw new Error(fundResult.data.error);
          }

          const isPartial = fundResult.data?.partial === true;
          steps[steps.length - 1] = {
            name: 'Funding Treasury (1 AVAX)',
            status: 'success',
            data: fundResult.data,
            partial: isPartial
          };
          setResults({ steps: [...steps] });

          if (isPartial) {
            toast.warning('TX sent but not yet confirmed on-chain. Re-diagnose in ~1 minute to verify.');
          }
        } catch (error) {
          steps[steps.length - 1] = {
            name: 'Funding Treasury (1 AVAX)',
            status: 'error',
            error: error.message
          };
          setResults({ steps: [...steps] });
          toast.error(`Funding failed: ${error.message}`);
          // Do NOT rethrow - let repair continue showing results
        }
      } else {
        steps.push({ name: 'Treasury Already Funded', status: 'skipped' });
      }

      setResults({ steps: [...steps] });

      const hasErrors = steps.some(s => s.status === 'error');
      if (!hasErrors) {
        toast.success('Company repair completed successfully!');
      }

      // Re-diagnose after repair
      setTimeout(() => handleDiagnose(), 2000);

    } catch (error) {
      console.error('Repair error:', error);
      toast.error(`Repair step failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Force-override repair (called after user confirms override dialog)
  const handleForceRepair = async () => {
    setOverrideDialog(null);
    setLoading(true);
    setResults({ steps: [] });

    const steps = [{ name: 'Funding Treasury (1 AVAX) [OVERRIDE]', status: 'running' }];
    setResults({ steps: [...steps] });

    try {
      const fundPromise = base44.functions.invoke('fundNewCompanyTreasury', {
        company_id: companyId,
        avax_amount: 1.0,
        force_override: true
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 35s.')), 35000)
      );

      const fundResult = await Promise.race([fundPromise, timeoutPromise]);

      if (fundResult.data?.error) throw new Error(fundResult.data.error);

      const isPartial = fundResult.data?.partial === true;
      steps[0] = { name: 'Funding Treasury (1 AVAX) [OVERRIDE]', status: 'success', data: fundResult.data, partial: isPartial };
      setResults({ steps: [...steps] });
      toast.success('Force override funding complete!');
      setTimeout(() => handleDiagnose(), 2000);
    } catch (error) {
      steps[0] = { name: 'Funding Treasury (1 AVAX) [OVERRIDE]', status: 'error', error: error.message };
      setResults({ steps: [...steps] });
      toast.error(`Override funding failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Only admins can access
  if (!isSystemAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="bg-red-900/10 border-red-500/30">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Admin Only</h2>
            <p className="text-slate-400">This tool is only accessible to system administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* Override Warning Dialog */}
      {overrideDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1f2128] border border-amber-500/40 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <h3 className="text-white font-semibold text-lg">
                Already Has {overrideDialog.type === 'wallet' ? 'Funding' : 'Token'}
              </h3>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              This company already has an existing {overrideDialog.type === 'wallet' ? 'AVAX funding transaction' : 'token contract'}.
              Re-creating it <span className="text-amber-400 font-medium">may waste AVAX</span> and create duplicate records.
            </p>
            <div className="bg-[#17171f] rounded-lg p-3 mb-4 border border-[#2d2d3a]">
              <p className="text-xs text-slate-500 mb-1">Existing {overrideDialog.type === 'wallet' ? 'TX hash' : 'contract'}:</p>
              <p className="text-xs font-mono text-amber-300 break-all">{overrideDialog.existing_value}</p>
            </div>
            <p className="text-slate-400 text-sm mb-5">Are you sure you want to proceed anyway?</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-[#2d2d3a] text-slate-300"
                onClick={() => setOverrideDialog(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleForceRepair}
              >
                Yes, Override Anyway
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <Card className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Wrench className="w-6 h-6 text-orange-400" />
            Company Repair Tool
          </CardTitle>
          <CardDescription className="text-orange-300">
            Re-run blockchain setup for companies missing wallet, tokens, or AVAX funding
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Input Form */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white text-sm">Step 1: Diagnose Company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-slate-400 text-xs">Company ID or Select from List</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="bg-[#17171f] border-[#2d2d3a] text-white w-full">
                <SelectValue placeholder={companiesLoading ? "Loading companies..." : "Select a company..."} />
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
          <div>
            <Label className="text-slate-400 text-xs">Or paste ID directly</Label>
            <Input
              placeholder="e.g., 69949f3df354a7aa25f11240"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>
          <Button
            onClick={handleDiagnose}
            disabled={diagnosisLoading || !companyId}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {diagnosisLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Diagnosing...
              </>
            ) : (
              'Diagnose Company'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Diagnosis Results */}
      {companyData && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {companyData.company.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Wallet Status */}
            <div className="flex items-center justify-between p-3 bg-[#17171f] rounded-lg border border-[#2d2d3a]">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-slate-400" />
                <span className="text-white text-sm">Blockchain Wallet</span>
              </div>
              {companyData.hasWallet ? (
                <Badge className="bg-green-500/20 text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Exists
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400">
                  <XCircle className="w-3 h-3 mr-1" />
                  Missing
                </Badge>
              )}
            </div>

            {/* Token Status */}
            <div className="flex items-center justify-between p-3 bg-[#17171f] rounded-lg border border-[#2d2d3a]">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-slate-400" />
                <span className="text-white text-sm">Company Token</span>
              </div>
              {companyData.hasToken ? (
                <Badge className="bg-green-500/20 text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Exists ({companyData.token?.token_symbol})
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400">
                  <XCircle className="w-3 h-3 mr-1" />
                  Missing
                </Badge>
              )}
            </div>

            {/* AVAX Funding Status */}
            <div className="flex items-center justify-between p-3 bg-[#17171f] rounded-lg border border-[#2d2d3a]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-slate-400" />
                <span className="text-white text-sm">AVAX Funding</span>
              </div>
              {companyData.hasAvaxFunding ? (
                <Badge className="bg-green-500/20 text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Funded ({companyData.transfers.length} transfers)
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400">
                  <XCircle className="w-3 h-3 mr-1" />
                  Not Funded
                </Badge>
              )}
            </div>

            {/* Repair Button */}
            {(!companyData.hasWallet || !companyData.hasToken || !companyData.hasAvaxFunding) && (
              <Button
                onClick={handleRepair}
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Repairing...
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4 mr-2" />
                    Repair Company
                  </>
                )}
              </Button>
            )}

            {companyData.hasWallet && companyData.hasToken && companyData.hasAvaxFunding && (
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">Company is fully configured!</p>
                <p className="text-green-400/70 text-xs mt-1">No repair needed</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Repair Progress */}
      {results && (
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <CardTitle className="text-white text-sm">Repair Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.steps.map((step, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-3 bg-[#17171f] rounded-lg border border-[#2d2d3a]"
              >
                <span className="text-white text-sm">{step.name}</span>
                {step.status === 'running' && (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                )}
                {step.status === 'success' && !step.partial && (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                )}
                {step.status === 'success' && step.partial && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                    TX Sent (unconfirmed)
                  </Badge>
                )}
                {step.status === 'error' && (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                {step.status === 'skipped' && (
                  <Badge variant="outline" className="text-slate-400 text-xs">
                    Skipped
                  </Badge>
                )}
              </div>
            ))}

            {results.steps.some(s => s.error) && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                <p className="text-red-400 text-xs font-mono whitespace-pre-wrap">
                  {results.steps.find(s => s.error)?.error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}