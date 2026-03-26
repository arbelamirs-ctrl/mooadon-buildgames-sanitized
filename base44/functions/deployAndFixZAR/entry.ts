import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createWalletClient, createPublicClient, http, parseUnits } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

// Minimal ERC20 bytecode + ABI for deployment
// Using a standard OpenZeppelin-style ERC20 compiled bytecode
const ERC20_BYTECODE = '0x60806040523480156200001157600080fd5b5060405162001a5138038062001a518339818101604052810190620000379190620002b0565b8282816003908162000049919062000574565b5080600490816200005b919062000574565b505050620000706200008260201b60201c565b6200007c33836200008b60201b60201c565b5062000660565b600033905090565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620000fe576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401620000f59062000696565b60405180910390fd5b62000112600083836200019e60201b60201c565b80600260008282546200012691906200070c565b9250508190555080600060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508173ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051620001d8919062000748565b60405180910390a3620001f4600083836200019360201b60201c565b5050565b505050565b505050565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6200026a826200021f565b810181811067ffffffffffffffff821117156200028c576200028b62000230565b5b80604052505050565b6000620002a162000201565b9050620002af82826200025f565b919050565b600080600060608486031215620002cf57620002ce62000211565b5b600084015167ffffffffffffffff811115620002ef57620002ee62000216565b5b620002fd8682870162000342565b935050602084015167ffffffffffffffff8111156200032157620003206200021b565b5b6200032f8682870162000342565b92505060406200034286828701620003bb565b9150509250925092565b600080fd5b600080fd5b600080fd5b60008083601f8401126200037357620003726200034d565b5b8235905067ffffffffffffffff8111156200039257620003916200034e565b5b602083019150836001820283011115620003b057620003af62000357565b5b9250929050565b600081519050620003c88162000646565b92915050565b600060208284031215620003e657620003e562000211565b5b81519050620003f68162000646565b92915050565b600082825260208201905092915050565b600062000419826200041f565b9050919050565b6000819050919050565b60005b838110156200044a5780820151818401526020810190506200042d565b60008484015250505050565b600062000463826200040d565b915092915050565b60006200047882620004ae565b90506200048682826200045c565b915050919050565b6000620004a8600f83620003fc565b9150620004b5826200046b565b602082019050919050565b60006020820190508181036000830152620004db816200049b565b9050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806200052957607f821691505b6020821081036200053f576200053e620004e2565b5b50919050565b60006200055282620004ae565b915062000561836200040d565b9250826200057357620005726200046b565b5b828204905092915050565b6000620005c1576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401620005b89062000656565b60405180910390fd5b600080fd5b6000819050919050565b620005dc81620005c6565b8114620005e857600080fd5b50565b600081519050620005fc81620005d1565b92915050565b6000602082840312156200061a576200061962000211565b5b600062000629848285016200060a565b91505092915050565b6000602082019050818103600083015260208101905092915050565b62000659816200040d565b811462000665575062000660565b5b50565b6113e180620006706000396000f3fe';

// Simpler approach: use a pre-compiled minimal ERC20
// We'll use the factory pattern via raw bytecode from a known-good minimal ERC20

const MINIMAL_ERC20_ABI = [
  { type: 'constructor', inputs: [{ name: 'name_', type: 'string' }, { name: 'symbol_', type: 'string' }, { name: 'supply', type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';

  let privateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
  if (!privateKey) return Response.json({ error: 'GAS_WALLET_PRIVATE_KEY not set' }, { status: 500 });
  if (!privateKey.startsWith('0x')) privateKey = `0x${privateKey}`;

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });

  console.log('Deployer:', account.address);

  // Check AVAX balance
  const avaxBal = await publicClient.getBalance({ address: account.address });
  console.log('AVAX balance:', avaxBal.toString());

  // Deploy using setupCompanyToken function approach - call the existing deployMooadonRewards or use raw deploy
  // We'll use the base44 function to redeploy via generateCompanyTokens
  // Actually let's call our existing setupCompanyToken function for ZARA's company
  
  // Get ZARA company token record
  const allTokens = await base44.asServiceRole.entities.CompanyToken.filter({});
  const zarToken = allTokens.find(t => t.token_symbol === 'ZAR');
  
  if (!zarToken) {
    return Response.json({ error: 'ZAR CompanyToken record not found' }, { status: 404 });
  }
  
  console.log('Found ZAR token record:', zarToken.id, 'company:', zarToken.company_id);
  console.log('Old contract_address:', zarToken.contract_address);

  // Deploy via setupCompanyToken backend function
  const setupResult = await base44.asServiceRole.functions.invoke('setupCompanyToken', {
    company_id: zarToken.company_id,
    force_redeploy: true
  });

  console.log('setupCompanyToken result:', JSON.stringify(setupResult));

  return Response.json({
    success: true,
    zar_token_id: zarToken.id,
    company_id: zarToken.company_id,
    old_contract: zarToken.contract_address,
    setup_result: setupResult
  });
});