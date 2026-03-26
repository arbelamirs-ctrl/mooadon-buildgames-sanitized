import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react';
import { CHAIN_CONFIG } from '@/components/services/chainAdapter';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { useQueryClient } from '@tanstack/react-query';

export default function WalletConnectBar({ company, onConnect }) {
  const [connecting, setConnecting] = useState(false);
  const queryClient = useQueryClient();
  
  const isConnected = company?.wallet_address && company?.wallet_chain !== 'none';
  const chainConfig = company?.wallet_chain ? CHAIN_CONFIG[company.wallet_chain] : null;

  const handleConnect = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('MetaMask is not installed. Please install MetaMask or a compatible wallet.');
      return;
    }

    setConnecting(true);
    try {
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        
        // Get current chain
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        
        // Map chainId to our chain names
        const chainMapping = {
          '0x1': 'ethereum',
          '0x89': 'polygon',
          '0x38': 'bsc',
          '0xa86a': 'avalanche',
          '0xa869': 'avalanche_fuji'
        };
        
        const detectedChain = chainMapping[chainId] || 'ethereum';
        
        // Update company with wallet info
        await base44.entities.Company.update(company.id, {
          wallet_address: address,
          wallet_chain: detectedChain
        });
        
        // Refresh company data
        await queryClient.invalidateQueries({ queryKey: ['company'] });
        
        toast.success(`Wallet connected successfully! Network: ${detectedChain}`);
        if (onConnect) onConnect();
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      if (error.code === 4001) {
        toast.error('Wallet connection canceled');
      } else {
        toast.error('Error connecting wallet');
      }
    } finally {
      setConnecting(false);
    }
  };

  const getBuyTokensUrl = () => {
    // Placeholder URLs for different chains - would integrate with real onramp
    const onrampUrls = {
      ethereum: 'https://app.uniswap.org',
      polygon: 'https://quickswap.exchange',
      bsc: 'https://pancakeswap.finance',
      avalanche: 'https://traderjoexyz.com'
    };
    return onrampUrls[company?.wallet_chain] || '#';
  };

  if (!isConnected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 flex-1">
            <Wallet className="w-5 h-5 text-slate-400" />
            <span className="text-slate-300 text-sm">Wallet not connected</span>
          </div>
          <Button 
            onClick={handleConnect}
            disabled={connecting}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
          >
            {connecting ? 'connecting...' : 'Connect Wallet'}
          </Button>
        </div>
        <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-200">
            <strong>Supported networks:</strong> Ethereum, Polygon, BSC, Avalanche.Log in with MetaMask or a compatible Web3 wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-medium">Connected wallet</span>
            {chainConfig && (
              <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                {chainConfig.name}
              </Badge>
            )}
          </div>
          <code className="text-xs text-slate-400" dir="ltr">
            {company.wallet_address.substring(0, 10)}...{company.wallet_address.substring(company.wallet_address.length - 8)}
          </code>
        </div>
      </div>
      
      <a 
        href={getBuyTokensUrl()}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button 
          variant="outline" 
          className="border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
        >
          <ShoppingCart className="w-4 h-4 ml-2" />
          Buy Tokens
          <ExternalLink className="w-3 h-3 mr-2" />
        </Button>
      </a>
    </div>
  );
}