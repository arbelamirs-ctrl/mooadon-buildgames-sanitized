import { CHAIN_CONFIG } from '@/components/services/chainAdapter';
import { toast } from 'sonner';

/**
 * Switch MetaMask to a specific network
 */
export async function switchToNetwork(chainName) {
  if (typeof window.ethereum === 'undefined') {
    toast.error('MetaMask Not installed ');
    return false;
  }

  const config = CHAIN_CONFIG[chainName];
  if (!config) {
    toast.error('Unsupported network');
    return false;
  }

  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.chainIdHex }],
    });
    return true;
  } catch (switchError) {
    // Network not added to MetaMask, try to add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: config.chainIdHex,
            chainName: config.name,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: [config.explorer]
          }],
        });
        toast.success(`network ${config.name} Added successfully!`);
        return true;
      } catch (addError) {
        console.error('Failed to add network:', addError);
        toast.error('Failed to add network');
        return false;
      }
    }
    console.error('Failed to switch network:', switchError);
    toast.error('Failed to replace network');
    return false;
  }
}

/**
 * Add token to MetaMask
 */
export async function addTokenToWallet(tokenAddress, symbol, decimals = 18, image = '') {
  if (typeof window.ethereum === 'undefined') {
    toast.error('MetaMask Not installed');
    return false;
  }

  try {
    const wasAdded = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: tokenAddress,
          symbol: symbol,
          decimals: decimals,
          image: image,
        },
      },
    });

    if (wasAdded) {
      toast.success('Token added to MetaMask successfully!');
    }
    return wasAdded;
  } catch (error) {
    console.error('Failed to add token:', error);
    toast.error('Failed to add token');
    return false;
  }
}

/**
 * Get current connected account
 */
export async function getCurrentAccount() {
  if (typeof window.ethereum === 'undefined') {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_accounts' 
    });
    return accounts[0] || null;
  } catch (error) {
    console.error('Failed to get account:', error);
    return null;
  }
}

/**
 * Get current network
 */
export async function getCurrentChainId() {
  if (typeof window.ethereum === 'undefined') {
    return null;
  }

  try {
    const chainId = await window.ethereum.request({ 
      method: 'eth_chainId' 
    });
    return chainId;
  } catch (error) {
    console.error('Failed to get chain:', error);
    return null;
  }
}