/**
 * deployDeadTokens.js
 * Deploys fresh ERC20 contracts for MYB and RYL (dead contracts on Fuji)
 * and transfers full supply to OWNER_WALLET_ADDRESS
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits, encodeDeployData } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

// Minimal ERC20 ABI
const ERC20_ABI = [
  {
    type: 'constructor',
    inputs: [
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'initialSupply_', type: 'uint256' }
    ]
  },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];

// Standard OpenZeppelin ERC20 bytecode (constructor: name, symbol, initialSupply minted to deployer)
const ERC20_BYTECODE = '0x60806040523480156200001157600080fd5b5060405162001a0e38038062001a0e8339818101604052810190620000379190620002b4565b82816003908162000049919062000553565b5080600490816200005b919062000553565b505050620000806200007462000088602090811b620009a817901c565b82620000906020811b60201c565b5050620006d5565b600033905090565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620000fb576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401620000f29062000675565b60405180910390fd5b6200010f600083836200017560201b60201c565b806002600082825462000123919062000697565b92505081905550806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508173ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051620001b59190620006f3565b60405180910390a3620001d16000838362000185602090811b60201c565b5050565b505050565b505050565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6200023282620001f7565b810181811067ffffffffffffffff8211171562000254576200025362000208565b5b80604052505050565b6000620002686200018b565b905062000276828262000227565b919050565b600067ffffffffffffffff82111562000299576200029862000208565b5b620002a482620001f7565b9050602081019050919050565b60008060006060848603121562000298576200029762000195565b5b600084015167ffffffffffffffff811115620002b957620002b86200019a565b5b620002c7868287016200031a565b935050602084015167ffffffffffffffff811115620002eb57620002ea6200019a565b5b620002f9868287016200031a565b92505060406200030c86828701620003a8565b9150509250925092565b6000620003278262000278565b6200033384826200035a565b93506200034981856020860162000383565b6200035481620001f7565b840191505092915050565b600082825260208201905092915050565b60005b838110156200038f57808201518184015260208101905062000372565b8381111562000370576000848401525b50505050565b6000819050919050565b620003ab8162000396565b8114620003b757600080fd5b50565b600081519050620003cb81620003a0565b92915050565b600060208284031215620003ec57620003eb62000195565b5b6000620003fc84828501620003ba565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806200044757607f821691505b6020821081036200045d576200045c62000405565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b600060088302620004c77fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8262000488565b620004d3868362000488565b95508019841693508086168417925050509392505050565b6000819050919050565b6000620005066200050062000553565b8362000396565b9050919050565b60006200051a82620004eb565b60209050919050565b6000819050919050565b7f45524332303a206d696e7420746f20746865207a65726f206164647265737300600082015250565b600062000662601f83620005a3565b91506200066f828562000551565b602082019050919050565b60006200068982866200054b565b9150620006978285620005e5565b9150620006a58284620005e5565b9150620006b282620003d1565b9150620006c28282620006c8565b91508190509392505050565b620006d38162000396565b82525050565b6000602082019050620006f06000830184620006c8565b92915050565b60805160a051611312620007166000396000610248015260006102230152611312f3fe';

async function deployToken(walletClient, publicClient, gasAccount, ownerAddress, tokenName, tokenSymbol, supply) {
  console.log(`Deploying ${tokenSymbol} (${tokenName}), supply=${supply}...`);
  const initialSupplyWei = parseUnits(supply.toString(), 18);

  const deployTxHash = await walletClient.deployContract({
    abi: ERC20_ABI,
    bytecode: ERC20_BYTECODE,
    args: [tokenName, tokenSymbol, initialSupplyWei],
    gas: 3_000_000n,
  });
  console.log(`${tokenSymbol} deploy TX:`, deployTxHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployTxHash, timeout: 120_000 });
  if (receipt.status === 'reverted') throw new Error(`Deploy reverted: ${deployTxHash}`);
  if (!receipt.contractAddress) throw new Error('No contract address in receipt');

  const contractAddress = receipt.contractAddress;
  console.log(`${tokenSymbol} deployed at: ${contractAddress}`);

  // Transfer supply to ownerAddress
  if (ownerAddress && ownerAddress.toLowerCase() !== gasAccount.address.toLowerCase()) {
    const balance = await publicClient.readContract({
      address: contractAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [gasAccount.address],
    });
    if (balance > 0n) {
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [ownerAddress, balance],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      console.log(`${tokenSymbol} supply transferred to owner. TX: ${txHash}`);
    }
  }

  return { contractAddress, deployTxHash };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { company_ids } = body;

    if (!company_ids || !Array.isArray(company_ids)) {
      return Response.json({ error: 'company_ids array required' }, { status: 400 });
    }

    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
    const ownerAddress = Deno.env.get('OWNER_WALLET_ADDRESS');
    let gasPrivateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    if (!gasPrivateKey) return Response.json({ error: 'GAS_WALLET_PRIVATE_KEY not set' }, { status: 500 });
    if (!gasPrivateKey.startsWith('0x')) gasPrivateKey = `0x${gasPrivateKey}`;

    const gasAccount = privateKeyToAccount(gasPrivateKey);
    const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account: gasAccount, chain: avalancheFuji, transport: http(rpcUrl) });

    // Check gas balance
    const avaxBalance = await publicClient.getBalance({ address: gasAccount.address });
    console.log(`Gas wallet AVAX: ${formatUnits(avaxBalance, 18)}`);
    if (avaxBalance < 100_000_000_000_000_000n) {
      return Response.json({ error: `Gas wallet has only ${formatUnits(avaxBalance, 18)} AVAX — need at least 0.1` }, { status: 500 });
    }

    const results = [];

    for (const companyId of company_ids) {
      try {
        const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
        const company = companies[0];
        if (!company) { results.push({ company_id: companyId, error: 'Company not found' }); continue; }

        const tokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: companyId });
        const token = tokens[0];
        if (!token) { results.push({ company_id: companyId, error: 'No CompanyToken record' }); continue; }

        const tokenName = token.token_name || `${company.name} Token`;
        const tokenSymbol = token.token_symbol || company.name.substring(0, 4).toUpperCase();
        const supply = token.total_supply || 1_000_000;

        const { contractAddress, deployTxHash } = await deployToken(
          walletClient, publicClient, gasAccount, ownerAddress,
          tokenName, tokenSymbol, supply
        );

        // Update CompanyToken
        await base44.asServiceRole.entities.CompanyToken.update(token.id, {
          contract_address: contractAddress,
          treasury_wallet: ownerAddress || gasAccount.address,
          treasury_balance: supply,
        });

        // Update Company
        await base44.asServiceRole.entities.Company.update(company.id, {
          token_contract: contractAddress,
          blockchain_wallet_address: ownerAddress || gasAccount.address,
        });

        results.push({
          company_id: companyId,
          company_name: company.name,
          symbol: tokenSymbol,
          contract_address: contractAddress,
          deploy_tx: deployTxHash,
          explorer: `https://testnet.snowtrace.io/address/${contractAddress}`,
          success: true,
        });

        console.log(`✅ ${company.name} (${tokenSymbol}) => ${contractAddress}`);
      } catch (err) {
        console.error(`❌ ${companyId}:`, err.message);
        results.push({ company_id: companyId, error: err.message });
      }
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});