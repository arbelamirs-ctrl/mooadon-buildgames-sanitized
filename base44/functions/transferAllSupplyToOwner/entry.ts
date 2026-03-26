import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { ethers } from 'npm:ethers@6.13.0';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const RPC_URLS = {
  avalanche_fuji: 'https://api.avax-test.network/ext/bc/C/rpc',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const base44 = createClientFromRequest(req);
    const gasPrivateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    const ownerWallet = Deno.env.get('OWNER_WALLET_ADDRESS');

    if (!gasPrivateKey || !ownerWallet) {
      return Response.json({ error: 'Missing GAS_WALLET_PRIVATE_KEY or OWNER_WALLET_ADDRESS' }, { status: 500 });
    }

    const fujiRpc = Deno.env.get('FUJI_RPC_URL') || RPC_URLS['avalanche_fuji'];

    const allTokens = await base44.asServiceRole.entities.CompanyToken.list();
    const tokens = allTokens.filter(t =>
      t.contract_address &&
      t.contract_address.length === 42 &&
      (t.chain === 'avalanche_fuji' || !t.chain)
    );

    const results = [];

    for (const token of tokens) {
      const chain = 'avalanche_fuji';
      const rpcUrl = fujiRpc;

      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = new ethers.Wallet(gasPrivateKey, provider);
        const gasWalletAddress = signer.address;

        const contract = new ethers.Contract(token.contract_address, ERC20_ABI, signer);
        const balance = await contract.balanceOf(gasWalletAddress);

        if (balance === 0n) {
          results.push({
            token_id: token.id,
            token_symbol: token.token_symbol,
            contract_address: token.contract_address,
            chain,
            status: 'skipped',
            reason: 'Zero balance in gas wallet'
          });
          continue;
        }

        const decimals = await contract.decimals();
        const humanBalance = ethers.formatUnits(balance, decimals);

        const tx = await contract.transfer(ownerWallet, balance);
        const receipt = await tx.wait();

        await base44.asServiceRole.entities.CompanyToken.update(token.id, {
          treasury_wallet: ownerWallet
        });

        results.push({
          token_id: token.id,
          token_symbol: token.token_symbol,
          contract_address: token.contract_address,
          chain,
          status: 'transferred',
          amount: humanBalance,
          from: gasWalletAddress,
          to: ownerWallet,
          tx_hash: receipt.hash
        });

      } catch (err) {
        results.push({
          token_id: token.id,
          token_symbol: token.token_symbol,
          contract_address: token.contract_address,
          chain,
          status: 'error',
          error: err.message
        });
      }
    }

    const transferred = results.filter(r => r.status === 'transferred').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    return Response.json({
      success: true,
      summary: { total: tokens.length, transferred, skipped, errors },
      results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});