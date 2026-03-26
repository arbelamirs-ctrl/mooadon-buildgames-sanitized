import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Copy, Eye, EyeOff, Check, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ExportPrivateKeyDialog({ companyId, open, onOpenChange }) {
  const [step, setStep] = useState(1); // 1=warning, 2=confirm, 3=show key
  const [confirmText, setConfirmText] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('exportPrivateKey', {
        company_id: companyId
      });

      if (response.data.success) {
        setPrivateKey(response.data.private_key);
        setWalletAddress(response.data.wallet_address);
        setStep(3);
        toast.success('Private key retrieved');
      } else {
        toast.error(response.data.error || 'Failed to export private key');
      }
    } catch (error) {
      toast.error('Failed to export: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Private key copied to clipboard');
  };

  const handleClose = () => {
    setStep(1);
    setConfirmText('');
    setPrivateKey('');
    setWalletAddress('');
    setShowKey(false);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1f2128] border-[#2d2d3a] max-w-2xl">
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Security Warning: Export Private Key
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Please read carefully before proceeding
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  CRITICAL SECURITY WARNINGS
                </h3>
                <ul className="space-y-2 text-sm text-red-300">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">•</span>
                    <span>Your private key gives COMPLETE control over your wallet funds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">•</span>
                    <span>Anyone with this key can steal all your funds - NEVER share it</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">•</span>
                    <span>If you lose this key, your funds are GONE FOREVER - no recovery</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">•</span>
                    <span>Store it in a secure password manager or hardware wallet</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">•</span>
                    <span>This action is logged for security audit purposes</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="text-blue-400 font-semibold mb-2">How to use your private key:</h3>
                <ol className="space-y-1 text-sm text-blue-300 list-decimal list-inside">
                  <li>Install MetaMask browser extension</li>
                  <li>Click "Import Account"</li>
                  <li>Select "Private Key"</li>
                  <li>Paste your private key</li>
                  <li>Your wallet is now connected to MetaMask</li>
                </ol>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} className="border-[#2d2d3a] text-white">
                Cancel
              </Button>
              <Button 
                onClick={() => setStep(2)}
                className="bg-red-600 hover:bg-red-700"
              >
                I Understand the Risks
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Final Confirmation</DialogTitle>
              <DialogDescription className="text-slate-400">
                Type "I UNDERSTAND" to proceed
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-amber-400 text-sm font-medium">
                  ⚠️ By exporting your private key, you take full responsibility for securing it. 
                  Mooadon is not liable for any loss of funds due to compromised private keys.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-medium">
                  Type "I UNDERSTAND" to confirm:
                </label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="I UNDERSTAND"
                  className="bg-[#17171f] border-[#2d2d3a] text-white"
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} className="border-[#2d2d3a] text-white">
                Back
              </Button>
              <Button 
                onClick={handleExport}
                disabled={confirmText !== 'I UNDERSTAND' || loading}
                className="bg-red-600 hover:bg-red-700"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Export Private Key
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Your Private Key</DialogTitle>
              <DialogDescription className="text-slate-400">
                Save this securely. This is the ONLY time you'll see this.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">Wallet Address:</label>
                <Input
                  value={walletAddress}
                  readOnly
                  className="bg-[#17171f] border-[#2d2d3a] text-slate-300 font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-medium">Private Key:</label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={privateKey}
                    readOnly
                    className="bg-[#17171f] border-[#2d2d3a] text-white font-mono text-xs pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowKey(!showKey)}
                      className="h-7 w-7"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCopy}
                      className="h-7 w-7"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm font-medium">
                  🔒 Store this private key in a secure location (password manager, hardware wallet).
                  Close this dialog when done - you won't be able to see it again.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">
                Done - I've Saved My Key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}