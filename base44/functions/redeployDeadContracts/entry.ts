/**
 * redeployDeadContracts.js
 * Deploys new ERC20 token contracts for companies whose contracts are dead on Fuji
 * and transfers full supply to OWNER_WALLET_ADDRESS
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from 'npm:viem@2.7.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';

// Minimal ERC20 bytecode deployer using CREATE opcode via raw tx is complex.
// Instead we deploy using a standard ERC20 via a factory-style approach with viem.

// Solidity-compiled ERC20 bytecode (OpenZeppelin ERC20 with mint to deployer)
// This is a standard ERC20 that mints totalSupply to msg.sender on construction
// constructor(string name, string symbol, uint256 totalSupply)
const ERC20_BYTECODE = '0x60806040523480156200001157600080fd5b5060405162001a3a38038062001a3a833981810160405281019062000037919062000312565b82828160039081620000509190620005ee565b508060049081620000629190620005ee565b505050620000776200009960201b60201c565b6200008a838362000a2260201b60201c565b5050505050505062000764565b600073ffffffffffffffffffffffffffffffffffffffff16600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1603620001505760006040517f1e4fbdf70000000000000000000000000000000000000000000000000000000081526004016200014791906200073a565b60405180910390fd5b6200016181620001b160201b60201c565b565b600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000600660008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b80600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620002995760006040517fec442f0500000000000000000000000000000000000000000000000000000000815260040162000290919062000757565b60405180910390fd5b620002ad60008383620002b160201b60201c565b5050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff160362000307578060026000828254620002f9919062000771565b925050819055506200039f565b6000600660008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905081811015620003855760008085856040517fe450d38c0000000000000000000000000000000000000000000000000000000081526004016200037c93929190620007ac565b60405180910390fd5b818103600660008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620003ed578060026000828254620003e79190620007e7565b925050819055506200043f565b80600660008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040516200049e9190620007fd565b60405180910390a3505050565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6200051382620004c8565b810181811067ffffffffffffffff82111715620005355762000534620004d9565b5b80604052505050565b60006200054a620004ab565b905062000558828262000508565b919050565b600067ffffffffffffffff8211156200057b576200057a620004d9565b5b6200058682620004c8565b9050602081019050919050565b60005b83811015620005b357808201518184015260208101905062000596565b60008484015250505050565b6000620005d6620005d0846200055d565b6200053e565b905082815260208101848484011115620005f557620005f4620004c3565b5b6200060284828562000593565b509392505050565b600082601f830112620006225762000621620004be565b5b8151620006348482602086016200059f565b91505092915050565b6000819050919050565b62000652816200063d565b81146200065e57600080fd5b50565b600081519050620006728162000647565b92915050565b6000806000606084860312156200069457620006936200049f565b5b600084015167ffffffffffffffff811115620006b557620006b4620004a4565b5b620006c3868287016200060a565b935050602084015167ffffffffffffffff811115620006e757620006e6620004a4565b5b620006f5868287016200060a565b925050604062000708868287016200065e565b9150509250925092565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006200073e8262000712565b9050919050565b620007508162000731565b82525050565b60006020820190506200076d600083018462000745565b92915050565b60006200078062000731565b9050919050565b62000792816200076e565b82525050565b620007a3816200063d565b82525050565b6000606082019050620007c0600083018662000787565b620007cf602083018562000787565b620007de604083018462000798565b949350505050565b6000620007f3826200063d565b9050919050565b600060208201905062000811600083018462000798565b92915050565b61126680620007746000396000f3fe...';

// We'll use a simpler approach: call the existing generateCompanyTokens function logic inline
// Actually, let's just use the existing deployZARToken function pattern

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { company_ids } = body; // array of company IDs to redeploy

  const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
  const ownerWallet = Deno.env.get('OWNER_WALLET_ADDRESS');
  const ownerPrivateKey = Deno.env.get('OWNER_PRIVATE_KEY');

  if (!ownerPrivateKey) return Response.json({ error: 'OWNER_PRIVATE_KEY not set' }, { status: 500 });

  const account = privateKeyToAccount(ownerPrivateKey.startsWith('0x') ? ownerPrivateKey : `0x${ownerPrivateKey}`);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });

  const results = [];

  for (const companyId of company_ids) {
    try {
      const tokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: companyId });
      const token = tokens[0];
      if (!token) {
        results.push({ company_id: companyId, error: 'No token record found' });
        continue;
      }

      console.log(`Deploying token for ${token.token_symbol} (company ${companyId})...`);

      // Use generateCompanyTokens function which handles the full deploy flow
      const deployResult = await base44.asServiceRole.functions.invoke('generateCompanyTokens', {
        company_id: companyId,
        token_name: token.token_name,
        token_symbol: token.token_symbol,
        total_supply: token.total_supply || 1000000,
        force_redeploy: true,
      });

      results.push({
        company_id: companyId,
        symbol: token.token_symbol,
        deploy_result: deployResult,
      });

    } catch (err) {
      results.push({ company_id: companyId, error: err.message });
    }
  }

  return Response.json({ results });
});