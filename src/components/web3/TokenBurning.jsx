import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Flame, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TokenBurning({ client, companyToken }) {
  const [burnAmount, setBurnAmount] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const tokenBalance = client?.tokenBalance || 0;
  const maxBurn = Math.floor(tokenBalance);

  const burnMutation = useMutation({
    mutationFn: async (amount) => {
      const response = await base44.functions.invoke('burnTokens', {
        clientId: client.id,
        amount: parseFloat(amount)
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setResult(data.data);
        toast.success('Tokens burned successfully!');
        queryClient.invalidateQueries({ queryKey: ['client'] });
        setBurnAmount('');
        setShowConfirmDialog(false);
      } else {
        toast.error(data.error || 'Burn failed');
      }
    },
    onError: (error) => {
      toast.error('Failed to burn tokens: ' + error.message);
    },
  });

  const handleBurnClick = () => {
    const amount = parseFloat(burnAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amount > maxBurn) {
      toast.error(`Maximum amount is ${maxBurn} MLT`);
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmBurn = () => {
    burnMutation.mutate(burnAmount);
  };

  const setMaxAmount = () => {
    setBurnAmount(maxBurn.toString());
  };

  return (
    <div className="space-y-6">
      {/* Burn Interface */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Flame className="w-5 h-5 text-orange-500" />
            Burn Tokens
          </CardTitle>
          <CardDescription className="text-slate-400">
            Permanently remove tokens from circulation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Your Balance</span>
              <span className="text-white font-semibold">{tokenBalance.toFixed(2)} MLT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Token Symbol</span>
              <span className="text-white">{companyToken?.token_symbol || 'MLT'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Amount to Burn</label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                placeholder="0.00"
                max={maxBurn}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <Button
                variant="outline"
                onClick={setMaxAmount}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                MAX
              </Button>
            </div>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-orange-300">
              Burning tokens is irreversible. Tokens will be sent to a dead address and cannot be recovered.
            </p>
          </div>

          <Button
            onClick={handleBurnClick}
            disabled={!burnAmount || burnMutation.isPending || tokenBalance === 0}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {burnMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Burning...
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 mr-2" />
                Burn Tokens
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Result Display */}
      {result && (
        <Card className="bg-green-900/20 border-green-700/50">
          <CardHeader>
            <CardTitle className="text-green-400 text-lg">Burn Successful</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-400">Tokens Burned</div>
                <div className="text-white font-semibold">{result.tokensBurned} MLT</div>
              </div>
              <div>
                <div className="text-slate-400">New Balance</div>
                <div className="text-white font-semibold">{result.newTokenBalance} MLT</div>
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-sm mb-1">Transaction Hash</div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-green-400 break-all">{result.transactionHash}</code>
                <a
                  href={result.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Confirm Token Burn
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <p className="text-orange-300 text-sm mb-3">
                You are about to permanently destroy:
              </p>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">{burnAmount} MLT</div>
                <div className="text-slate-400 text-sm">This action cannot be undone</div>
              </div>
            </div>
            <div className="text-sm text-slate-400 space-y-1">
              <p>• Tokens will be sent to dead address (0x...dEaD)</p>
              <p>• Total supply will be reduced</p>
              <p>• Your balance will decrease to {(tokenBalance - parseFloat(burnAmount || 0)).toFixed(2)} MLT</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBurn}
              disabled={burnMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {burnMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Burning...
                </>
              ) : (
                'Confirm Burn'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}