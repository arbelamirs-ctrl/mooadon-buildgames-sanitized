import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Send, Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function UserWalletManagement() {
  const { user, isLoading: userLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  // Redirect if not authenticated or is admin
  useEffect(() => {
    if (!userLoading && (!user || user?.role === 'admin')) {
      navigate('/');
    }
  }, [user, userLoading, navigate]);

  // Fetch company data
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company', user?.id],
    queryFn: async () => {
      const perms = await base44.entities.UserPermission.filter({ user_id: user.id });
      if (perms.length === 0) return null;
      const comp = await base44.entities.Company.filter({ id: perms[0].company_id });
      return comp[0];
    },
    enabled: !!user?.id,
  });

  // Fetch clients for this company
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', company?.id],
    queryFn: () => base44.entities.Client.filter({ company_id: company.id }),
    enabled: !!company?.id,
  });

  // Transfer tokens mutation
  const transferMutation = useMutation({
    mutationFn: async ({ recipientId, amount }) => {
      // Create transaction record
      const transaction = await base44.entities.Transaction.create({
        company_id: company.id,
        branch_id: '', // Will be set by user
        client_id: recipientId,
        client_phone: '',
        amount: parseFloat(amount),
        tokens_expected: parseFloat(amount),
        status: 'completed',
        token_symbol: company.points_name || 'TOKENS',
      });
      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Transfer completed');
      setTransferAmount('');
      setTransferRecipient('');
      setShowTransferDialog(false);
    },
    onError: (error) => {
      toast.error('Transfer failed: ' + error.message);
    },
  });

  const handleTransfer = async () => {
    if (!transferAmount || !transferRecipient) {
      toast.error('Please enter amount and select recipient');
      return;
    }

    transferMutation.mutate({
      recipientId: transferRecipient,
      amount: transferAmount,
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (userLoading || companyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="pt-6">
            <p className="text-slate-400">No company assigned to your account</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Wallet Management</h1>
        <p className="text-slate-400 mt-1">Manage your company wallet and transfer tokens to customers</p>
      </div>

      {/* Wallet Balance Card */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white">Your Wallet</CardTitle>
          <CardDescription className="text-slate-400">{company.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400 text-xs">Wallet Address</Label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-mono text-slate-300">
                  {company.blockchain_wallet_address ? (
                    <>
                      {company.blockchain_wallet_address.slice(0, 10)}...{company.blockchain_wallet_address.slice(-8)}
                    </>
                  ) : (
                    'Not configured'
                  )}
                </span>
                {company.blockchain_wallet_address && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(company.blockchain_wallet_address)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">On-Chain Balance</Label>
              <p className="text-2xl font-bold text-[#10b981] mt-2">
                {company.blockchain_wallet_address ? (company.total_earned || 0).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogTrigger asChild>
          <Button className="bg-[#10b981] hover:bg-[#059669] gap-2">
            <Send className="w-4 h-4" />
            Transfer Tokens
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-[#1f2128] border-[#2d2d3a]">
          <DialogHeader>
            <DialogTitle className="text-white">Transfer Tokens</DialogTitle>
            <DialogDescription className="text-slate-400">
              Send tokens to a customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm">Recipient</Label>
              <select
                value={transferRecipient}
                onChange={(e) => setTransferRecipient(e.target.value)}
                className="w-full mt-2 bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Select a customer</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.full_name || client.phone} - Balance: {client.current_balance || 0}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Amount</Label>
              <Input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00"
                className="mt-2 bg-[#17171f] border-[#2d2d3a] text-white"
              />
            </div>
            <Button
              className="w-full bg-[#10b981] hover:bg-[#059669]"
              onClick={handleTransfer}
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Transfer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Balances */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader>
          <CardTitle className="text-white">Customer Balances</CardTitle>
          <CardDescription className="text-slate-400">
            {clients.length} customer{clients.length !== 1 ? 's' : ''} registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#10b981]" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No customers found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2d2d3a] hover:bg-transparent">
                    <TableHead className="text-slate-300">Customer</TableHead>
                    <TableHead className="text-slate-300">Phone</TableHead>
                    <TableHead className="text-slate-300">Current Balance</TableHead>
                    <TableHead className="text-slate-300">Total Earned</TableHead>
                    <TableHead className="text-slate-300">On-Chain Balance</TableHead>
                    <TableHead className="text-slate-300">Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} className="border-[#2d2d3a] hover:bg-[#17171f]">
                      <TableCell className="text-white font-medium">
                        {client.full_name || 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-300 font-mono text-xs">
                        {client.phone}
                      </TableCell>
                      <TableCell className="text-[#10b981] font-semibold">
                        {(client.current_balance || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {(client.total_earned || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {(client.onchain_balance || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-slate-700 text-slate-100">
                          {client.level || 'Bronze'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}