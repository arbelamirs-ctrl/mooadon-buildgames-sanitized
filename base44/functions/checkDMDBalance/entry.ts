/**
 * checkDMDBalance - one-shot diagnostic for Diamond Bourse DMD token
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createPublicClient, http } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';

const DMD_CONTRACT_COMPANYTOKEN = '0x4D4e59Fc92337F99E6F7CFB54b3142213BABfE03';
const DMD_CONTRACT_COMPANY      = '0xc1DeC321d7ddc4e08f1E158f9E7FB89A3674423D';
const OWNER_WALLET              = '0xFA9b000dF91BfAC4925151070018aE8A13C52a38';
const TREASURY_WALLET_DB        = '0x69F967A22C048229E16c1D3FdB9A74BF3E37f501';
const COMPANY_BLOCKCHAIN_WALLET = '0x4eB0167e97793e5B19d8d1F3b94744C879E0cf7B';
const RECIPIENT_WALLET          = '0x69EddeD8677580fae9d3C9d69Fcef246cf0f09F5'; // failed recipient

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'name',      inputs: [], outputs: [{ type: 'string' }],  stateMutability: 'view' },
  { type: 'function', name: 'symbol',    inputs: [], outputs: [{ type: 'string' }],  stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'owner',     inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
];

async function getTokenInfo(client, contractAddress, label, wallets) {
  const result = { contract: contractAddress, label };
  try {
    result.name       = await client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'name' });
    result.symbol     = await client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'symbol' });
    result.totalSupply = String(await client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'totalSupply' }));
    result.totalSupply_human = Number(BigInt(result.totalSupply) / 10n**18n);

    // Try to get owner (may not exist on all contracts)
    try {
      result.onchain_owner = await client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'owner' });
    } catch { result.onchain_owner = 'no owner() function'; }

    result.balances = {};
    for (const [name, addr] of Object.entries(wallets)) {
      const bal = await client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] });
      result.balances[name] = { address: addr, balance_raw: String(bal), balance_human: Number(BigInt(String(bal)) / 10n**18n) };
    }
    result.status = 'ok';
  } catch (e) {
    result.status = 'error';
    result.error = e.message;
  }
  return result;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || (user.role !== 'admin' && user.collaborator_role !== 'editor' && user.collaborator_role !== 'owner')) return Response.json({ error: 'Admin only' }, { status: 403 });

  const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });

  const wallets = {
    OWNER_WALLET:              OWNER_WALLET,
    TREASURY_WALLET_DB:        TREASURY_WALLET_DB,
    COMPANY_BLOCKCHAIN_WALLET: COMPANY_BLOCKCHAIN_WALLET,
    RECIPIENT_WALLET:          RECIPIENT_WALLET,
  };

  const [companyTokenInfo, legacyContractInfo] = await Promise.all([
    getTokenInfo(publicClient, DMD_CONTRACT_COMPANYTOKEN, 'CompanyToken.contract_address (used by processor)', wallets),
    getTokenInfo(publicClient, DMD_CONTRACT_COMPANY,      'Company.token_contract (legacy/mismatch?)', wallets),
  ]);

  const diagnosis = [];
  if (DMD_CONTRACT_COMPANYTOKEN.toLowerCase() !== DMD_CONTRACT_COMPANY.toLowerCase()) {
    diagnosis.push('⚠️ MISMATCH: CompanyToken.contract_address != Company.token_contract — processor uses CompanyToken but they point to DIFFERENT contracts!');
  }
  const ownerBalOnActiveContract = companyTokenInfo.balances?.OWNER_WALLET?.balance_human ?? 0;
  if (ownerBalOnActiveContract < 60) {
    diagnosis.push(`❌ OWNER wallet has only ${ownerBalOnActiveContract} DMD on active contract — transfer of 60 DMD WILL REVERT (insufficient balance)`);
  } else {
    diagnosis.push(`✅ OWNER wallet has ${ownerBalOnActiveContract} DMD on active contract — sufficient for 60 DMD transfer`);
  }

  return Response.json({
    diagnosis,
    active_contract: companyTokenInfo,
    legacy_contract: legacyContractInfo,
    db_state: {
      companyToken_contract: DMD_CONTRACT_COMPANYTOKEN,
      company_token_contract: DMD_CONTRACT_COMPANY,
      treasury_wallet_in_db: TREASURY_WALLET_DB,
      owner_wallet_env:       OWNER_WALLET,
    }
  });
});