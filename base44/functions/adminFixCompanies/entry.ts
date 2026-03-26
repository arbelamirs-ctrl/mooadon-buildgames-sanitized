/**
 * adminFixCompanies.js
 * One-off admin fix: 
 *   1. Deploy new RYL token with unique treasury wallet for Royal Time
 *   2. Redeploy BOSS token with correct decimals/supply
 *   3. Generate a new wallet for Royal Time company
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createWalletClient, createPublicClient, http } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount, generatePrivateKey, privateKeyToAddress } from 'npm:viem@2.7.0/accounts';

/**
 * MooadonRewards ERC20 bytecode — extracted from successful GCC deployment tx:
 * 0x104db039ee23ba4636f8abd5d5d58a35efd50203094ab7ba8050cc7646488bdd
 * Constructor: (string name, string symbol, address owner, address minter, uint256 initialSupply)
 * initialSupply is in whole token units — contract multiplies by 10^18 internally.
 */
const ERC20_BYTECODE = '0x60806040523480156200001157600080fd5b5060405162002f3038038062002f308339818101604052810190620000379190620007b2565b33858581600390816200004b919062000ad8565b5080600490816200005d919062000ad8565b505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603620000d55760006040517f1e4fbdf7000000000000000000000000000000000000000000000000000000008152600401620000cc919062000bd0565b60405180910390fd5b620000e681620001f360201b60201c565b50600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036200014e576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b82600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508160079081620001a0919062000ad8565b506000811115620001e857620001e783620001c0620002b960201b60201c565b600a620001ce919062000d7d565b83620001db919062000dce565b620002c260201b60201c565b5b505050505062000ebf565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b60006012905090565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620003375760006040517fec442f050000000000000000000000000000000000000000000000000000000081526004016200032e919062000bd0565b60405180910390fd5b6200034b600083836200034f60201b60201c565b5050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603620003a557806002600082825462000398919062000e19565b925050819055506200047b565b60008060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205490508181101562000434578381836040517fe450d38c0000000000000000000000000000000000000000000000000000000081526004016200042b9392919062000e65565b60405180910390fd5b8181036000808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620004c6578060026000828254039250508190555062000513565b806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405162000572919062000ea2565b60405180910390a3505050565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b620005e8826200059d565b810181811067ffffffffffffffff821117156200060a5762000609620005ae565b5b80604052505050565b60006200061f6200057f565b90506200062d8282620005dd565b919050565b600067ffffffffffffffff82111562000650576200064f620005ae565b5b6200065b826200059d565b9050602081019050919050565b60005b83811015620006885780820151818401526020810190506200066b565b60008484015250505050565b6000620006ab620006a58462000632565b62000613565b905082815260208101848484011115620006ca57620006c962000598565b5b620006d784828562000668565b509392505050565b600082601f830112620006f757620006f662000593565b5b81516200070984826020860162000694565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006200073f8262000712565b9050919050565b620007518162000732565b81146200075d57600080fd5b50565b600081519050620007718162000746565b92915050565b6000819050919050565b6200078c8162000777565b81146200079857600080fd5b50565b600081519050620007ac8162000781565b92915050565b600080600080600060a08688031215620007d157620007d062000589565b5b600086015167ffffffffffffffff811115620007f257620007f16200058e565b5b6200080088828901620006df565b955050602086015167ffffffffffffffff8111156200082457620008236200058e565b5b6200083288828901620006df565b9450506040620008458882890162000760565b935050606086015167ffffffffffffffff8111156200086957620008686200058e565b5b6200087788828901620006df565b92505060806200088a888289016200079b565b9150509295509295909350565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680620008ea57607f821691505b6020821081036200090057620008ff620008a2565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026200096a7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826200092b565b6200097686836200092b565b95508019841693508086168417925050509392505050565b6000819050919050565b6000620009b9620009b3620009ad8462000777565b6200098e565b62000777565b9050919050565b6000819050919050565b620009d58362000998565b620009ed620009e482620009c0565b84845462000938565b825550505050565b600090565b62000a04620009f5565b62000a11818484620009ca565b505050565b5b8181101562000a395762000a2d600082620009fa565b60018101905062000a17565b5050565b601f82111562000a885762000a528162000906565b62000a5d846200091b565b8101602085101562000a6d578190505b62000a8562000a7c856200091b565b83018262000a16565b50505b505050565b600082821c905092915050565b600062000aad6000198460080262000a8d565b1980831691505092915050565b600062000ac8838362000a9a565b9150826002028217905092915050565b62000ae38262000897565b67ffffffffffffffff81111562000aff5762000afe620005ae565b5b62000b0b8254620008d1565b62000b1882828562000a3d565b600060209050601f83116001811462000b50576000841562000b3b578287015190505b62000b47858262000aba565b86555062000bb7565b601f19841662000b608662000906565b60005b8281101562000b8a5784890151825560018201915060208501945060208101905062000b63565b8683101562000baa578489015162000ba6601f89168262000a9a565b8355505b6001600288020188555050505b505050505050565b62000bca8162000732565b82525050565b600060208201905062000be7600083018462000bbf565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b60008160011c9050919050565b6000808291508390505b600185111562000c7b5780860481111562000c535762000c5262000bed565b5b600185161562000c635780820291505b808102905062000c738562000c1c565b945062000c33565b94509492505050565b60008262000c96576001905062000d69565b8162000ca6576000905062000d69565b816001811462000cbf576002811462000cca5762000d00565b600191505062000d69565b60ff84111562000cdf5762000cde62000bed565b5b8360020a91508482111562000cf95762000cf862000bed565b5b5062000d69565b5060208310610133831016604e8410600b841016171562000d3a5782820a90508381111562000d345762000d3362000bed565b5b62000d69565b62000d49848484600162000c29565b9250905081840481111562000d635762000d6262000bed565b5b81810290505b9392505050565b600060ff82169050919050565b600062000d8a8262000777565b915062000d978362000d70565b925062000dc67fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff848462000c84565b905092915050565b600062000ddb8262000777565b915062000de88362000777565b925082820262000df88162000777565b9150828204841483151762000e125762000e1162000bed565b5b5092915050565b600062000e268262000777565b915062000e338362000777565b925082820190508082111562000e4e5762000e4d62000bed565b5b92915050565b62000e5f8162000777565b82525050565b600060608201905062000e7c600083018662000bbf565b62000e8b602083018562000e54565b62000e9a604083018462000e54565b949350505050565b600060208201905062000eb9600083018462000e54565b92915050565b6120618062000ecf6000396000f3fe';

const ERC20_ABI = [
  {
    type: 'constructor',
    inputs: [
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'owner_', type: 'address' },
      { name: 'minter_', type: 'address' },
      { name: 'initialSupply_', type: 'uint256' }
    ]
  },
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];


async function transferAllToOwner(walletClient, publicClient, contractAddress, deployer, ownerAddress) {
  const balance = await publicClient.readContract({
    address: contractAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [deployer]
  });
  if (balance > 0n) {
    const txHash = await walletClient.writeContract({
      address: contractAddress, abi: ERC20_ABI, functionName: 'transfer', args: [ownerAddress, balance]
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    console.log(`Transferred supply to owner: ${txHash}`);
  }
}

async function encryptPrivateKey(privateKey) {
  const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY');
  if (!encryptionKey) throw new Error('WALLET_ENCRYPTION_KEY not configured');
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyMaterial, encoder.encode(privateKey));
  return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, dry_run } = body;

    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
    let gasKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY') || '';
    if (!gasKey.startsWith('0x')) gasKey = `0x${gasKey}`;

    const account = privateKeyToAccount(gasKey);
    const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });
    const ownerAddress = Deno.env.get('OWNER_WALLET_ADDRESS') || account.address;

    const results = {};

    // ── ACTION: generate-royal-time-wallet ──────────────────────────────────
    if (!action || action === 'generate-royal-time-wallet') {
      console.log('Generating new unique wallet for Royal Time...');
      const newPrivKey = generatePrivateKey();
      const newAddress = privateKeyToAddress(newPrivKey);
      console.log(`New Royal Time wallet: ${newAddress}`);

      if (!dry_run) {
        const encryptedKey = await encryptPrivateKey(newPrivKey);
        // Update Company record
        await base44.asServiceRole.entities.Company.update('699ea5709de7911baf78c822', {
          blockchain_wallet_address: newAddress,
          blockchain_private_key_encrypted: encryptedKey
        });
        // Update CompanyToken record (RYL primary token)
        await base44.asServiceRole.entities.CompanyToken.update('69bfa9206315ce282123dd51', {
          treasury_wallet: newAddress
        });
        console.log('✅ Royal Time wallet updated in DB');
      }
      results['royal_time_wallet'] = { new_address: newAddress, dry_run: !!dry_run };
    }

    // ── ACTION: deploy-boss-token ────────────────────────────────────────────
    if (!action || action === 'deploy-boss-token') {
      console.log('Deploying new BOSS token via generateCompanyTokens...');
      if (!dry_run) {
        // Deploy inline — constructor: (name, symbol, owner, minter, initialSupply in whole units)
        const deployTxHash = await walletClient.deployContract({
          abi: ERC20_ABI,
          bytecode: ERC20_BYTECODE,
          args: ['Boss Token', 'BOSS', ownerAddress, ownerAddress, 1000000n],
          gas: 5_000_000n
        });
        console.log(`BOSS deploy TX: ${deployTxHash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: deployTxHash, timeout: 120_000 });
        if (receipt.status === 'reverted') throw new Error(`Deploy reverted: ${deployTxHash}`);
        if (!receipt.contractAddress) throw new Error('No contract address in receipt');

        const contractAddress = receipt.contractAddress;
        console.log(`✅ BOSS deployed: ${contractAddress}`);

        // Transfer supply to owner
        if (ownerAddress && ownerAddress.toLowerCase() !== account.address.toLowerCase()) {
          const bal = await publicClient.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] });
          if (bal > 0n) {
            const txH = await walletClient.writeContract({ address: contractAddress, abi: ERC20_ABI, functionName: 'transfer', args: [ownerAddress, bal] });
            await publicClient.waitForTransactionReceipt({ hash: txH, timeout: 60_000 });
          }
        }

        // Update CompanyToken + Company
        await base44.asServiceRole.entities.CompanyToken.update('6995aa8967ceff25fd3cba59', {
          contract_address: contractAddress,
          token_name: 'Boss Token',
          token_symbol: 'BOSS',
          total_supply: 1000000,
          treasury_balance: 1000000,
          treasury_wallet: ownerAddress || account.address,
          is_primary: true,
          decimals: 18
        });
        await base44.asServiceRole.entities.Company.update('6992dc67fe9359d7c81160f5', { token_contract: contractAddress });

        results['boss_token'] = { contract_address: contractAddress, explorer: `https://testnet.snowtrace.io/address/${contractAddress}`, deploy_tx: deployTxHash };
      } else {
        results['boss_token'] = { dry_run: true, message: 'Would deploy new BOSS ERC20 with 18 decimals, 1M supply via generateCompanyTokens' };
      }
    }

    return Response.json({ success: true, results });

  } catch (error) {
    console.error('adminFixCompanies error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});