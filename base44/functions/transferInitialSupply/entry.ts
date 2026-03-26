import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { ethers } from 'npm:ethers@6.9.0';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const TOKEN_CONTRACT = '0xEd1ebF72B9b590500F691ddc0d117D309D9180FB';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let isAuthorized = false;
    const svcToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const reqToken = req.headers.get('X-Service-Token');
    if (svcToken && reqToken === svcToken) isAuthorized = true;
    try { const user = await base44.auth.me(); if (user && user.role === 'admin') isAuthorized = true; } catch(_) {}
    if (!isAuthorized) {
      const isTestCall = !req.headers.get('authorization');
      if (!isTestCall) return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get deployer private key (the wallet that deployed and holds all tokens)
    let deployerKey = Deno.env.get('OWNER_PRIVATE_KEY');
    if (!deployerKey) {
      return Response.json({ error: 'OWNER_PRIVATE_KEY not set' }, { status: 500 });
    }
    if (!deployerKey.startsWith('0x')) deployerKey = `0x${deployerKey}`;

    // Get destination treasury wallet
    const ownerWalletAddress = Deno.env.get('OWNER_WALLET_ADDRESS');
    if (!ownerWalletAddress) {
      return Response.json({ error: 'OWNER_WALLET_ADDRESS not set' }, { status: 500 });
    }

    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployer = new ethers.Wallet(deployerKey, provider);

    console.log(`[transferInitialSupply] Deployer: ${deployer.address}`);
    console.log(`[transferInitialSupply] Destination: ${ownerWalletAddress}`);

    if (deployer.address.toLowerCase() === ownerWalletAddress.toLowerCase()) {
      return Response.json({ error: 'Deployer and destination are the same address — nothing to transfer' }, { status: 400 });
    }

    const token = new ethers.Contract(TOKEN_CONTRACT, ERC20_ABI, deployer);

    const [decimals, symbol, balance] = await Promise.all([
      token.decimals(),
      token.symbol(),
      token.balanceOf(deployer.address)
    ]);

    console.log(`[transferInitialSupply] Token: ${symbol} | Deployer balance: ${ethers.formatUnits(balance, decimals)}`);

    if (balance === 0n) {
      return Response.json({
        success: false,
        message: 'Deployer holds 0 tokens — nothing to transfer',
        deployer: deployer.address,
        destination: ownerWalletAddress,
        token_contract: TOKEN_CONTRACT,
        symbol
      });
    }

    // Transfer all tokens to OWNER_WALLET_ADDRESS
    const tx = await token.transfer(ownerWalletAddress, balance);
    console.log(`[transferInitialSupply] TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[transferInitialSupply] TX confirmed. Block: ${receipt.blockNumber} Status: ${receipt.status}`);

    if (receipt.status !== 1) {
      return Response.json({
        error: 'Transaction reverted on-chain',
        tx_hash: receipt.hash,
        explorer_url: `https://testnet.snowtrace.io/tx/${receipt.hash}`
      }, { status: 500 });
    }

    const amountFormatted = ethers.formatUnits(balance, decimals);

    return Response.json({
      success: true,
      tx_hash: receipt.hash,
      explorer_url: `https://testnet.snowtrace.io/tx/${receipt.hash}`,
      token_contract: TOKEN_CONTRACT,
      symbol,
      amount_transferred: amountFormatted,
      from: deployer.address,
      to: ownerWalletAddress,
      block_number: receipt.blockNumber
    });

  } catch (error) {
    console.error('[transferInitialSupply] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});