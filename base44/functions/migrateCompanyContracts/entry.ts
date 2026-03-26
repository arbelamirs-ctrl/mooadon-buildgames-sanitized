import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createWalletClient, createPublicClient, http, parseUnits, encodeDeployData } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

/**
 * migrateCompanyContracts
 * One-time migration: deploys a unique ERC20 contract on Avalanche Fuji
 * for each company that still has no contract or the shared placeholder.
 *
 * Protected by a migration secret.
 * Call with: { "secret": "migrate_now_2026" }
 * Or just check balances: { "secret": "migrate_now_2026", "check_only": true }
 */

const PLACEHOLDER_CONTRACT = '0x1D6f7270Fe4A3674C571Fb8835EA37Eda0e059dA';

// This is the EXACT same bytecode used in generateCompanyTokens (viem-based, working on Fuji).
// constructor(string name_, string symbol_, uint256 initialSupply_) – mints supply to deployer
const ERC20_BYTECODE = '0x60806040523480156200001157600080fd5b5060405162001a0e38038062001a0e8339818101604052810190620000379190620002b4565b82816003908162000049919062000553565b5080600490816200005b919062000553565b505050620000806200007462000088602090811b620009a817901c565b82620000906020811b60201c565b5050620006d5565b600033905090565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620000fb576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401620000f29062000675565b60405180910390fd5b6200010f600083836200017560201b60201c565b806002600082825462000123919062000697565b92505081905550806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508173ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051620001b59190620006f3565b60405180910390a3620001d16000838362000185602090811b60201c565b5050565b505050565b505050565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6200023282620001f7565b810181811067ffffffffffffffff8211171562000254576200025362000208565b5b80604052505050565b6000620002686200018b565b905062000276828262000227565b919050565b600067ffffffffffffffff82111562000299576200029862000208565b5b620002a482620001f7565b9050602081019050919050565b60008060006060848603121562000298576200029762000195565b5b600084015167ffffffffffffffff811115620002b957620002b86200019a565b5b620002c7868287016200031a565b935050602084015167ffffffffffffffff811115620002eb57620002ea6200019a565b5b620002f9868287016200031a565b92505060406200030c86828701620003a8565b9150509250925092565b6000620003278262000278565b6200033384826200035a565b93506200034981856020860162000383565b6200035481620001f7565b840191505092915050565b600082825260208201905092915050565b60005b838110156200038f57808201518184015260208101905062000372565b8381111562000370576000848401525b50505050565b6000819050919050565b620003ab8162000396565b8114620003b757600080fd5b50565b600081519050620003cb81620003a0565b92915050565b600060208284031215620003ec57620003eb62000195565b5b6000620003fc84828501620003ba565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806200044757607f821691505b6020821081036200045d576200045c62000405565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b600060088302620004c77fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8262000488565b620004d3868362000488565b95508019841693508086168417925050509392505050565b6000819050919050565b6000620005066200050062000553565b8362000396565b9050919050565b60006200051a82620004eb565b60209050919050565b6000819050919050565b7f45524332303a206d696e7420746f20746865207a65726f206164647265737300600082015250565b600062000662601f83620005a3565b91506200066f828562000551565b602082019050919050565b60006200068982866200054b565b9150620006978285620005e5565b9150620006a58284620005e5565b9150620006b282620003d1565b9150620006c28282620006c8565b91508190509392505050565b620006d38162000396565b82525050565b6000602082019050620006f06000830184620006c8565b92915050565b60805160a051611312620007166000396000610248015260006102230152611312f3fe';

const ERC20_ABI = [
  {
    type: 'constructor',
    inputs: [
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'initialSupply_', type: 'uint256' }
    ]
  },
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const migrationSecret = Deno.env.get('MIGRATION_SECRET');
    if (!migrationSecret || body.secret !== migrationSecret) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Setup gas wallet
    let gasPrivateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    if (!gasPrivateKey) return Response.json({ error: 'GAS_WALLET_PRIVATE_KEY not set' }, { status: 500 });
    if (!gasPrivateKey.startsWith('0x')) gasPrivateKey = `0x${gasPrivateKey}`;

    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || Deno.env.get('AVALANCHE_RPC') || 'https://api.avax-test.network/ext/bc/C/rpc';
    const account = privateKeyToAccount(gasPrivateKey);
    const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });

    const avaxBalance = await publicClient.getBalance({ address: account.address });
    const avaxFormatted = (Number(avaxBalance) / 1e18).toFixed(4);

    console.log(`[migrate] Gas wallet: ${account.address} | Balance: ${avaxFormatted} AVAX`);

    // Always report gas wallet info
    const gasInfo = {
      gas_wallet_address: account.address,
      gas_wallet_balance_avax: avaxFormatted,
      faucet_url: `https://faucet.avax.network/?subnet=fuji&address=${account.address}`
    };

    // check_only mode — just report balance, don't deploy
    if (body.check_only) {
      return Response.json({
        ...gasInfo,
        message: avaxBalance < 100000000000000000n
          ? `⚠️ Low balance! Please fund at: https://faucet.avax.network/?subnet=fuji&address=${account.address}`
          : '✅ Balance sufficient for deployments'
      });
    }

    if (avaxBalance < 100000000000000000n) { // < 0.1 AVAX
      return Response.json({
        error: 'Insufficient AVAX balance',
        ...gasInfo,
        message: `Gas wallet needs AVAX. Visit: https://faucet.avax.network/?subnet=fuji&address=${account.address}`
      }, { status: 400 });
    }

    // Get all CompanyToken records
    const allTokens = await base44.asServiceRole.entities.CompanyToken.list();
    console.log(`[migrate] Total CompanyToken records: ${allTokens.length}`);

    // Deduplicate by company_id — only one deployment per unique company
    const seenCompanies = new Set();
    const needsMigration = allTokens.filter(t => {
      const needsDeploy = !t.contract_address || t.contract_address === PLACEHOLDER_CONTRACT;
      if (!needsDeploy) return false;
      if (seenCompanies.has(t.company_id)) return false;
      seenCompanies.add(t.company_id);
      return true;
    });

    console.log(`[migrate] ${needsMigration.length} unique companies need a new contract`);

    if (needsMigration.length === 0) {
      // Report current state
      const alreadyDone = allTokens.map(t => ({
        company_id: t.company_id,
        token_symbol: t.token_symbol,
        contract_address: t.contract_address
      }));
      return Response.json({
        ...gasInfo,
        message: 'All companies already have unique contracts',
        already_deployed: alreadyDone
      });
    }

    const results = [];

    for (const token of needsMigration) {
      const name = token.token_name || `${token.token_symbol} Token`;
      const symbol = (token.token_symbol || 'TKN').trim();
      const supply = token.total_supply || 1000000;
      const supplyWei = parseUnits(supply.toString(), 18);

      console.log(`[migrate] Deploying ${symbol} ("${name}") supply=${supply}...`);

      try {
        // Fuji public RPC doesn't support eth_estimateGas for contract deployment,
        // so we supply a fixed gas limit (~3M is enough for a standard ERC20).
        const deployTxHash = await walletClient.deployContract({
          abi: ERC20_ABI,
          bytecode: ERC20_BYTECODE,
          args: [name, symbol, supplyWei],
          gas: 3_000_000n
        });

        console.log(`[migrate] TX sent: ${deployTxHash}`);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: deployTxHash,
          timeout: 120_000
        });

        if (!receipt.contractAddress) {
          throw new Error('No contractAddress in receipt');
        }

        const contractAddress = receipt.contractAddress;
        console.log(`[migrate] ✅ ${symbol} => ${contractAddress}`);

        // Update ALL CompanyToken records for this company_id
        const companyTokenRecords = allTokens.filter(t => t.company_id === token.company_id);
        for (const ct of companyTokenRecords) {
          await base44.asServiceRole.entities.CompanyToken.update(ct.id, {
            contract_address: contractAddress,
            chain: 'avalanche_fuji',
            decimals: 18
          });
        }

        // Update Company.token_contract
        const companies = await base44.asServiceRole.entities.Company.filter({ id: token.company_id });
        if (companies && companies[0]) {
          await base44.asServiceRole.entities.Company.update(companies[0].id, {
            token_contract: contractAddress,
            wallet_chain: 'avalanche_fuji'
          });
          console.log(`[migrate] Updated Company "${companies[0].name}" => ${contractAddress}`);
        }

        results.push({
          company_id: token.company_id,
          company_name: companies[0]?.name || 'unknown',
          token_symbol: symbol,
          token_name: name,
          status: 'deployed',
          contract_address: contractAddress,
          deploy_tx_hash: deployTxHash,
          explorer_url: `https://testnet.snowtrace.io/address/${contractAddress}`
        });

      } catch (err) {
        console.error(`[migrate] ❌ ${symbol} failed: ${err.message}`);
        results.push({
          company_id: token.company_id,
          token_symbol: symbol,
          status: 'failed',
          error: err.message
        });
      }

      // Wait between deployments to avoid nonce collision
      await new Promise(r => setTimeout(r, 3000));
    }

    const deployed = results.filter(r => r.status === 'deployed');
    const failed = results.filter(r => r.status === 'failed');

    return Response.json({
      success: true,
      ...gasInfo,
      summary: {
        total: needsMigration.length,
        deployed: deployed.length,
        failed: failed.length
      },
      results
    });

  } catch (error) {
    console.error('[migrateCompanyContracts] top-level error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});