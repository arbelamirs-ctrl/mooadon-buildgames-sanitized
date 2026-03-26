import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { getChainAdapter, CHAIN_CONFIG } from '@/components/services/chainAdapter';
import { toast } from "sonner";

export default function TransferTokens({ client, company, onSuccess }) {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const queryClient = useQueryClient();

  const maxAmount = client.current_balance || 0;
  const chainConfig = CHAIN_CONFIG[company.wallet_chain];

  const handleTransfer = async () => {
    const transferAmount = parseFloat(amount);
    
    if (!toAddress || !transferAmount || transferAmount <= 0) {
      toast.error('Please fill in a valid address and quantity.');
      return;
    }

    if (transferAmount > maxAmount) {
      toast.error('Not enough balance');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Get chain adapter
      const adapter = getChainAdapter(company.wallet_chain);
      
      // Execute transfer on blockchain
      const txResult = await adapter.sendPointsOrToken(
        client.wallet_address,
        toAddress,
        transferAmount,
        company.token_contract
      );

      if (!txResult.success) {
        throw new Error(txResult.error || 'Transfer failed');
      }

      // Record in database
      await base44.entities.BlockchainTransfer.create({
        company_id: company.id,
        client_id: client.id,
        from_address: client.wallet_address,
        to_address: toAddress,
        chain: company.wallet_chain,
        amount: transferAmount,
        tx_hash: txResult.txHash,
        status: 'confirmed',
        metadata: {
          explorer_url: txResult.explorerUrl
        }
      });

      // Update client balance
      const newBalance = client.current_balance - transferAmount;
      await base44.entities.Client.update(client.id, {
        current_balance: newBalance
      });

      // Create ledger event
      await base44.entities.LedgerEvent.create({
        company_id: company.id,
        client_id: client.id,
        type: 'transfer',
        points: -transferAmount,
        balance_before: client.current_balance,
        balance_after: newBalance,
        source: 'client',
        description: `Transfer to blockchain: ${toAddress.substring(0, 10)}...`,
        metadata: {
          tx_hash: txResult.txHash,
          to_address: toAddress,
          chain: company.wallet_chain
        }
      });

      setResult({
        success: true,
        txHash: txResult.txHash,
        explorerUrl: txResult.explorerUrl
      });

      toast.success('The transfer was completed successfully!');
      
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      
      if (onSuccess) onSuccess();

    } catch (error) {
      console.error('Transfer error:', error);
      setResult({
        success: false,
        error: error.message
      });
      toast.error('Transfer error');
    } finally {
      setLoading(false);
    }
  };

  if (!chainConfig) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="w-5 h-5" />
            <p>'Blockchain is not defined for this company.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!client.wallet_address) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="w-5 h-5" />
            <p>The customer does not have a connected wallet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (result?.success) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-bold text-emerald-700"> Transfer completed.!</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">amount:</span>
                <span className="font-medium">{amount} {company.points_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">To the address:</span>
                <code className="text-xs bg-white px-2 py-1 rounded">
                  {toAddress.substring(0, 12)}...{toAddress.substring(toAddress.length - 8)}
                </code>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">network:</span>
                <Badge variant="outline">{chainConfig.name}</Badge>
              </div>
            </div>
            {result.explorerUrl && (
              <a 
                href={result.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-blue-600 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
               View blockchain
              </a>
            )}
            <Button 
              onClick={() => {
                setResult(null);
                setToAddress('');
                setAmount('');
              }}
              variant="outline"
              className="w-full"
            >
             Additional transfer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
         Transfer tokens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Transfer to blockchain</p>
              <p>The tokens will be transferred from your balance to-{chainConfig.name}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Destination address </Label>
          <Input
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder={chainConfig.type === 'evm' ? '0x...' : 'Solana address'}
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>amount {company.points_name}</Label>
            <span className="text-sm text-slate-500">
              maximum: {maxAmount.toLocaleString()}
            </span>
          </div>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            max={maxAmount}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAmount(maxAmount.toString())}
            className="text-xs"
          >
           Transfer everything
          </Button>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">network:</span>
            <Badge variant="outline">{chainConfig.name}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">From the wallet:</span>
            <code className="text-xs">
              {client.wallet_address.substring(0, 8)}...{client.wallet_address.substring(client.wallet_address.length - 6)}
            </code>
          </div>
        </div>

        {result?.error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
            <p className="text-sm text-rose-800">{result.error}</p>
          </div>
        )}

        <Button
          onClick={handleTransfer}
          disabled={loading || !toAddress || !amount}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              Transferring...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 ml-2" />
             Move to blockchain
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}