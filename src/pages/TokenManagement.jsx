import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Copy, Star, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

export default function TokenManagement() {
  const { user, isLoading: userLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedToken, setSelectedToken] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loadingKey, setLoadingKey] = useState(false);
  const [keyError, setKeyError] = useState(null);

  // Redirect if not admin (only after loading is complete AND user is confirmed non-admin)
  useEffect(() => {
    if (!userLoading && user !== null && user?.role !== 'admin') {
      navigate('/');
    }
  }, [user, userLoading, navigate]);

  const queryClient = useQueryClient();

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['companyTokens'],
    queryFn: () => base44.entities.CompanyToken.list('-created_date'),
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async ({ tokenId, companyId }) => {
      // First, unset all tokens for this company
      const companyTokens = tokens.filter(t => t.company_id === companyId);
      await Promise.all(companyTokens.map(t =>
        base44.entities.CompanyToken.update(t.id, { is_primary: false })
      ));
      // Then set the chosen one as primary
      await base44.entities.CompanyToken.update(tokenId, { is_primary: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyTokens'] });
      toast.success('Primary token updated');
    }
  });

  const deleteTokenMutation = useMutation({
    mutationFn: (tokenId) => base44.entities.CompanyToken.delete(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyTokens'] });
      toast.success('Token record deleted');
    }
  });

  const handleShowPrivateKey = async (token) => {
    setSelectedToken(token);
    setShowDialog(true);
    setLoadingKey(true);
    setKeyError(null);
    setPrivateKey(null);
    
    try {
      console.log('🔐 Exporting private key for:', token.token_name);
      console.log('   Company ID:', token.company_id);
      
      const response = await base44.functions.invoke('getDecryptedPrivateKey', {
        company_id: token.company_id
      });
      
      console.log('✅ Backend decryption result:', response.data);
      
      if (response.data && response.data.success) {
        setPrivateKey(response.data.private_key);
        console.log('🎉 Private key exported successfully');
        console.log('   Wallet:', response.data.wallet_address);
        console.log('   Token:', response.data.token_symbol);
      } else {
        const errorMsg = response.data?.error || 'Decryption failed';
        console.error('❌ Decryption failed:', errorMsg);
        setKeyError(errorMsg);
        setPrivateKey(token.treasury_private_key_encrypted);
      }
    } catch (error) {
      console.error('❌ Export error:', error);
      setKeyError(error.message);
      setPrivateKey(token.treasury_private_key_encrypted);
    } finally {
      setLoadingKey(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Token Management</h1>
        <p className="text-slate-400 mt-1">Manage all company tokens and treasury wallets</p>
      </div>

      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white">Company Tokens</CardTitle>
          <CardDescription className="text-slate-400">
            {tokens.length} token{tokens.length !== 1 ? 's' : ''} registered — click ⭐ to set the primary token per company (used for minting)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No tokens found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2d2d3a] hover:bg-transparent">
                    <TableHead className="text-slate-300">Token Name</TableHead>
                    <TableHead className="text-slate-300">Symbol</TableHead>
                    <TableHead className="text-slate-300">Total Supply</TableHead>
                    <TableHead className="text-slate-300">Treasury Balance</TableHead>
                    <TableHead className="text-slate-300">Treasury Wallet</TableHead>
                    <TableHead className="text-slate-300">Contract Address</TableHead>
                    <TableHead className="text-slate-300">Chain</TableHead>
                    <TableHead className="text-slate-300">Primary</TableHead>
                    <TableHead className="text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow key={token.id} className="border-[#2d2d3a] hover:bg-[#17171f]">
                      <TableCell className="text-white font-medium">{token.token_name}</TableCell>
                      <TableCell>
                        <Badge className="bg-[#10b981] text-white">
                          {token.token_symbol}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {token.total_supply?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {token.treasury_balance?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {token.treasury_wallet ? (
                          <a
                            href={`https://testnet.snowtrace.io/address/${token.treasury_wallet}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#10b981] hover:underline text-xs font-mono"
                          >
                            {token.treasury_wallet.slice(0, 6)}...{token.treasury_wallet.slice(-4)}
                          </a>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {token.contract_address ? (
                          <a
                            href={`https://testnet.snowtrace.io/address/${token.contract_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#10b981] hover:underline text-xs font-mono"
                          >
                            {token.contract_address.slice(0, 6)}...{token.contract_address.slice(-4)}
                          </a>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {token.chain || 'avalanche_fuji'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          title={token.is_primary ? 'Primary token' : 'Set as primary'}
                          onClick={() => !token.is_primary && setPrimaryMutation.mutate({ tokenId: token.id, companyId: token.company_id })}
                          className={`text-lg transition-opacity ${token.is_primary ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-300 cursor-pointer'}`}
                        >
                          ★
                        </button>
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 text-xs"
                          onClick={() => handleShowPrivateKey(token)}
                        >
                          <Eye className="w-3 h-3" />
                          Show Key
                        </Button>
                        {!token.is_primary && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
                            onClick={() => {
                              if (window.confirm('Delete this token record? This does NOT affect the blockchain.')) {
                                deleteTokenMutation.mutate(token.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#1f2128] border-[#2d2d3a]">
          <DialogHeader>
            <DialogTitle className="text-white">Private Key</DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedToken?.token_name} ({selectedToken?.token_symbol})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingKey ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-[#10b981]" />
              </div>
            ) : (
              <>
                {keyError && (
                  <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-xs text-red-100">
                    ❌ {keyError}
                  </div>
                )}
                <div className={`${keyError ? 'bg-red-950 border-red-800' : 'bg-amber-950 border-amber-800'} border rounded-lg p-3 text-xs text-amber-100`}>
                  ⚠️ Keep this private. Never share it or paste it in public.
                </div>
                <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs break-all text-slate-300 max-h-32 overflow-y-auto">
                  {privateKey}
                </div>
                <Button
                  className="w-full gap-2 bg-[#10b981] hover:bg-[#059669]"
                  onClick={() => copyToClipboard(privateKey)}
                >
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}