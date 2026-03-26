import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { createPublicClient, http, formatUnits } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { company_id } = body;

  const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
  const ownerWallet = Deno.env.get('OWNER_WALLET_ADDRESS');
  const gasWallet = '0xFA9b000dF91BfAC4925151070018aE8A13C52a38';

  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });

  // Gas wallet AVAX balance
  let gas_avax = null;
  try {
    const bal = await publicClient.getBalance({ address: gasWallet });
    gas_avax = parseFloat(formatUnits(bal, 18)).toFixed(4);
  } catch (e) {}

  // If company_id provided, get their token balance
  let treasury_balance = null;
  let token_symbol = null;
  let contract_address = null;
  let total_supply = null;
  let distributed = null;

  if (company_id) {
    const tokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id });
    const token = tokens.find(t => t.is_primary) || tokens[0];

    if (token?.contract_address) {
      contract_address = token.contract_address;
      token_symbol = token.token_symbol;
      total_supply = token.total_supply;
      distributed = token.distributed_tokens || 0;

      const walletToCheck = ownerWallet || gasWallet;
      try {
        const bal = await publicClient.readContract({
          address: contract_address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletToCheck],
        });
        treasury_balance = parseFloat(formatUnits(bal, token.decimals || 18));
      } catch (e) {
        treasury_balance = token.treasury_balance || 0;
      }
    }
  }

  return Response.json({
    gas_avax,
    gas_wallet: gasWallet,
    treasury_balance,
    token_symbol,
    contract_address,
    total_supply,
    distributed,
  });
});