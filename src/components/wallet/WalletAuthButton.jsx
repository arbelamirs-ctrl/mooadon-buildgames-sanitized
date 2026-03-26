import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from "sonner";

/**
 * WalletAuthButton - Connect wallet and request signature for actions
 * 
 * Usage:
 * <WalletAuthButton
 *   actionType="redeem_points"
 *   actionData={{ amount: 100, reward_id: "123" }}
 *   companyId="company_123"
 *   onSuccess={(result) => console.log('Action completed', result)}
 * />
 */
export default function WalletAuthButton({ 
  actionType, 
  actionData, 
  companyId,
  onSuccess,
  children 
}) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    // Check if wallet is already connected
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_accounts' 
        });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        }
      } catch (error) {
        console.error('Error checking wallet:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      setWalletAddress(accounts[0]);
      toast.success('Wallet connected: ' + accounts[0].substring(0, 6) + '...');
    } catch (error) {
      console.error('Wallet connection error:', error);
      toast.error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const signAndExecuteAction = async () => {
    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsSigning(true);
    try {
      // Step 1: Create action request
      const createResponse = await fetch('/api/functions/createActionRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          wallet_address: walletAddress,
          action_type: actionType,
          action_data: actionData
        })
      });

      const createData = await createResponse.json();
      
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to create action request');
      }

      // Step 2: Request signature from wallet
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [createData.message_to_sign, walletAddress]
      });

      // Step 3: Verify signature and execute action
      const executeResponse = await fetch('/api/functions/verifyAndExecuteAction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_request_id: createData.action_request_id,
          signature: signature
        })
      });

      const executeData = await executeResponse.json();

      if (!executeData.success) {
        throw new Error(executeData.error || 'Failed to execute action');
      }

      toast.success('✅ Action authorized and executed!');
      
      if (onSuccess) {
        onSuccess(executeData.execution_result);
      }

    } catch (error) {
      console.error('Action execution error:', error);
      if (error.code === 4001) {
        toast.error('Signature rejected by user');
      } else {
        toast.error('Failed to execute action: ' + error.message);
      }
    } finally {
      setIsSigning(false);
    }
  };

  if (!walletAddress) {
    return (
      <Button
        onClick={connectWallet}
        disabled={isConnecting}
        className="gap-2"
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span>
          {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
        </span>
      </div>
      <Button
        onClick={signAndExecuteAction}
        disabled={isSigning}
        className="w-full gap-2"
      >
        {isSigning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing...
          </>
        ) : (
          children || 'Sign & Execute'
        )}
      </Button>
    </div>
  );
}