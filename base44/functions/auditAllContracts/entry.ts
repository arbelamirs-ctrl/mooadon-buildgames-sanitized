import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createPublicClient, http, formatUnits } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';

const ERC20_ABI = [
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { company_ids } = body;

  const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
  const ownerWallet = Deno.env.get('OWNER_WALLET_ADDRESS');

  const client = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });

  // Check OWNER_WALLET_ADDRESS AVAX balance
  const avaxBalance = await client.getBalance({ address: ownerWallet });
  const avaxHuman = parseFloat(formatUnits(avaxBalance, 18)).toFixed(4);

  const results = [];

  for (const companyId of company_ids) {
    const tokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: companyId });
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    const company = companies[0];
    const token = tokens[0];

    if (!token) {
      results.push({ company_id: companyId, company_name: company?.name || '?', status: 'NO_TOKEN', contract_address: null });
      continue;
    }

    const contractAddr = token.contract_address;
    if (!contractAddr) {
      results.push({ company_id: companyId, company_name: company?.name || '?', symbol: token.token_symbol, status: 'NO_CONTRACT_ADDRESS' });
      continue;
    }

    // Check bytecode
    let bytecode = '0x';
    try {
      bytecode = await client.getBytecode({ address: contractAddr });
    } catch (e) {}

    const isContract = bytecode && bytecode !== '0x' && bytecode.length > 10;

    if (!isContract) {
      results.push({
        company_id: companyId,
        company_name: company?.name || '?',
        symbol: token.token_symbol,
        contract_address: contractAddr,
        status: 'CONTRACT_DEAD', // needs redeploy
        treasury_balance_db: token.treasury_balance,
      });
      continue;
    }

    // Check balanceOf OWNER_WALLET
    let balance = BigInt(0);
    let balanceError = null;
    try {
      balance = await client.readContract({ address: contractAddr, abi: ERC20_ABI, functionName: 'balanceOf', args: [ownerWallet] });
    } catch (e) {
      balanceError = e.message?.slice(0, 100);
    }

    const balanceHuman = parseFloat(formatUnits(balance, token.decimals || 18));

    results.push({
      company_id: companyId,
      company_name: company?.name || '?',
      symbol: token.token_symbol,
      contract_address: contractAddr,
      status: balanceError ? 'READ_ERROR' : (balanceHuman === 0 ? 'ZERO_BALANCE' : 'OK'),
      owner_wallet_balance: balanceHuman,
      treasury_balance_db: token.treasury_balance,
      balance_error: balanceError,
      is_primary: token.is_primary,
    });
  }

  return Response.json({
    owner_wallet: ownerWallet,
    avax_balance: avaxHuman,
    avax_ok: parseFloat(avaxHuman) > 0.05,
    total_companies: company_ids.length,
    results,
    summary: {
      ok: results.filter(r => r.status === 'OK').length,
      dead_contracts: results.filter(r => r.status === 'CONTRACT_DEAD').map(r => r.company_name),
      zero_balance: results.filter(r => r.status === 'ZERO_BALANCE').map(r => r.company_name),
      no_token: results.filter(r => r.status === 'NO_TOKEN').map(r => r.company_name),
      errors: results.filter(r => r.status === 'READ_ERROR').map(r => r.company_name),
    }
  });
});