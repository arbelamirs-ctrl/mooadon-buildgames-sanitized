import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createWalletClient, createPublicClient, http, parseUnits, decodeEventLog } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

/**
 * generateCompanyTokens
 * Deploys a UNIQUE ERC20 contract on Avalanche Fuji for each company.
 * Each company gets its OWN contract — tokens are NOT shared.
 */

/**
 * MooadonRewards ERC20 bytecode — extracted from successful GCC deployment tx:
 * 0x104db039ee23ba4636f8abd5d5d58a35efd50203094ab7ba8050cc7646488bdd
 * Constructor: (string name, string symbol, address owner, address minter, uint256 initialSupply)
 * initialSupply is in whole token units (NOT wei) — contract multiplies by 10^decimals internally.
 * Deployed size: ~8KB init + ~8KB runtime (0x2f30 / 0x2061 bytes respectively)
 */
const ERC20_BYTECODE = '0x60806040523480156200001157600080fd5b5060405162002f3038038062002f308339818101604052810190620000379190620007b2565b33858581600390816200004b919062000ad8565b5080600490816200005d919062000ad8565b505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603620000d55760006040517f1e4fbdf7000000000000000000000000000000000000000000000000000000008152600401620000cc919062000bd0565b60405180910390fd5b620000e681620001f360201b60201c565b50600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036200014e576040517fd92e233d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b82600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508160079081620001a0919062000ad8565b506000811115620001e857620001e783620001c0620002b960201b60201c565b600a620001ce919062000d7d565b83620001db919062000dce565b620002c260201b60201c565b5b505050505062000ebf565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b60006012905090565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620003375760006040517fec442f050000000000000000000000000000000000000000000000000000000081526004016200032e919062000bd0565b60405180910390fd5b6200034b600083836200034f60201b60201c565b5050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603620003a557806002600082825462000398919062000e19565b925050819055506200047b565b60008060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205490508181101562000434578381836040517fe450d38c0000000000000000000000000000000000000000000000000000000081526004016200042b9392919062000e65565b60405180910390fd5b8181036000808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603620004c6578060026000828254039250508190555062000513565b806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405162000572919062000ea2565b60405180910390a3505050565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b620005e8826200059d565b810181811067ffffffffffffffff821117156200060a5762000609620005ae565b5b80604052505050565b60006200061f6200057f565b90506200062d8282620005dd565b919050565b600067ffffffffffffffff82111562000650576200064f620005ae565b5b6200065b826200059d565b9050602081019050919050565b60005b83811015620006885780820151818401526020810190506200066b565b60008484015250505050565b6000620006ab620006a58462000632565b62000613565b905082815260208101848484011115620006ca57620006c962000598565b5b620006d784828562000668565b509392505050565b600082601f830112620006f757620006f662000593565b5b81516200070984826020860162000694565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006200073f8262000712565b9050919050565b620007518162000732565b81146200075d57600080fd5b50565b600081519050620007718162000746565b92915050565b6000819050919050565b6200078c8162000777565b81146200079857600080fd5b50565b600081519050620007ac8162000781565b92915050565b600080600080600060a08688031215620007d157620007d062000589565b5b600086015167ffffffffffffffff811115620007f257620007f16200058e565b5b6200080088828901620006df565b955050602086015167ffffffffffffffff8111156200082457620008236200058e565b5b6200083288828901620006df565b9450506040620008458882890162000760565b935050606086015167ffffffffffffffff8111156200086957620008686200058e565b5b6200087788828901620006df565b92505060806200088a888289016200079b565b9150509295509295909350565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680620008ea57607f821691505b6020821081036200090057620008ff620008a2565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026200096a7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826200092b565b6200097686836200092b565b95508019841693508086168417925050509392505050565b6000819050919050565b6000620009b9620009b3620009ad8462000777565b6200098e565b62000777565b9050919050565b6000819050919050565b620009d58362000998565b620009ed620009e482620009c0565b84845462000938565b825550505050565b600090565b62000a04620009f5565b62000a11818484620009ca565b505050565b5b8181101562000a395762000a2d600082620009fa565b60018101905062000a17565b5050565b601f82111562000a885762000a528162000906565b62000a5d846200091b565b8101602085101562000a6d578190505b62000a8562000a7c856200091b565b83018262000a16565b50505b505050565b600082821c905092915050565b600062000aad6000198460080262000a8d565b1980831691505092915050565b600062000ac8838362000a9a565b9150826002028217905092915050565b62000ae38262000897565b67ffffffffffffffff81111562000aff5762000afe620005ae565b5b62000b0b8254620008d1565b62000b1882828562000a3d565b600060209050601f83116001811462000b50576000841562000b3b578287015190505b62000b47858262000aba565b86555062000bb7565b601f19841662000b608662000906565b60005b8281101562000b8a5784890151825560018201915060208501945060208101905062000b63565b8683101562000baa578489015162000ba6601f89168262000a9a565b8355505b6001600288020188555050505b505050505050565b62000bca8162000732565b82525050565b600060208201905062000be7600083018462000bbf565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b60008160011c9050919050565b6000808291508390505b600185111562000c7b5780860481111562000c535762000c5262000bed565b5b600185161562000c635780820291505b808102905062000c738562000c1c565b945062000c33565b94509492505050565b60008262000c96576001905062000d69565b8162000ca6576000905062000d69565b816001811462000cbf576002811462000cca5762000d00565b600191505062000d69565b60ff84111562000cdf5762000cde62000bed565b5b8360020a91508482111562000cf95762000cf862000bed565b5b5062000d69565b5060208310610133831016604e8410600b841016171562000d3a5782820a90508381111562000d345762000d3362000bed565b5b62000d69565b62000d49848484600162000c29565b9250905081840481111562000d635762000d6262000bed565b5b81810290505b9392505050565b600060ff82169050919050565b600062000d8a8262000777565b915062000d978362000d70565b925062000dc67fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff848462000c84565b905092915050565b600062000ddb8262000777565b915062000de88362000777565b925082820262000df88162000777565b9150828204841483151762000e125762000e1162000bed565b5b5092915050565b600062000e268262000777565b915062000e338362000777565b925082820190508082111562000e4e5762000e4d62000bed565b5b92915050565b62000e5f8162000777565b82525050565b600060608201905062000e7c600083018662000bbf565b62000e8b602083018562000e54565b62000e9a604083018462000e54565b949350505050565b600060208201905062000eb9600083018462000e54565b92915050565b6120618062000ecf6000396000f3fe';

/**
 * ABI for MooadonRewards constructor.
 * Constructor args: (string name, string symbol, address owner, address minter, uint256 initialSupply)
 * NOTE: initialSupply is in whole units — contract does supply * 10^18 internally.
 */
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
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }
];

const PLACEHOLDER_CONTRACT = '0x1D6f7270Fe4A3674C571Fb8835EA37Eda0e059dA';

Deno.serve(async (req) => {
  console.log('[generateCompanyTokens] function started');

  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    const svcToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const reqToken = req.headers.get('X-Service-Token');
    const isSvcCall = !!(svcToken && reqToken === svcToken);
    if (!isSvcCall && (!user || (user.role !== 'admin' && user.role !== 'super_admin'))) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    console.log('[generateCompanyTokens] called by:', user?.email || 'service/anon');

    const body = await req.json();
    const { company_id, tokenName, tokenSymbol, initialSupply, force_redeploy } = body;

    if (!company_id) {
      return Response.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Get company
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies || companies.length === 0) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];
    console.log('[generateCompanyTokens] Company:', company.name);

    // Get or create CompanyToken record
    const existingTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id });
    let companyToken = existingTokens && existingTokens.length > 0 ? existingTokens[0] : null;

    // Determine token params
    const name = tokenName || companyToken?.token_name || `${company.name} Token`;
    const symbol = tokenSymbol || companyToken?.token_symbol || company.name.substring(0, 4).toUpperCase();
    const supplyAmount = initialSupply || companyToken?.total_supply || 1000000;

    // Check if already deployed with a REAL (non-placeholder) contract
    const existingContract = companyToken?.contract_address;
    const SHARED_MLT = '0x398E35BDbc4A2774D2534a8cCb1183c26a049130';
    const hasRealContract = existingContract
      && existingContract !== PLACEHOLDER_CONTRACT
      && existingContract.toLowerCase() !== SHARED_MLT.toLowerCase();

    if (hasRealContract && !force_redeploy) {
      console.log('[generateCompanyTokens] Already has real contract:', existingContract);
      return Response.json({
        success: true,
        message: 'Token already deployed with unique contract',
        token_contract: existingContract,
        token_symbol: symbol
      });
    }

    if (hasRealContract && force_redeploy) {
      console.log('[generateCompanyTokens] force_redeploy=true, redeploying...');
    } else {
      console.log('[generateCompanyTokens] Placeholder or no contract found — deploying real contract...');
    }

    // Ensure treasury wallet
    let treasuryWalletAddress = company.blockchain_wallet_address;
    if (!treasuryWalletAddress) {
      const walletRes = await base44.asServiceRole.functions.invoke('createCompanyWallet', { companyId: company_id });
      treasuryWalletAddress = walletRes?.data?.wallet_address || walletRes?.data?.address;
      if (!treasuryWalletAddress) {
        return Response.json({ error: 'Failed to create treasury wallet' }, { status: 500 });
      }
      await base44.asServiceRole.entities.Company.update(company.id, { blockchain_wallet_address: treasuryWalletAddress });
    }

    // Get gas wallet
    let gasPrivateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    if (!gasPrivateKey) {
      return Response.json({ error: 'GAS_WALLET_PRIVATE_KEY not configured' }, { status: 500 });
    }
    if (!gasPrivateKey.startsWith('0x')) gasPrivateKey = `0x${gasPrivateKey}`;

    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || Deno.env.get('AVALANCHE_RPC') || 'https://api.avax-test.network/ext/bc/C/rpc';
    const account = privateKeyToAccount(gasPrivateKey);
    console.log('[generateCompanyTokens] Deploying from gas wallet:', account.address);

    const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });

    // Check gas wallet AVAX balance
    const avaxBalance = await publicClient.getBalance({ address: account.address });
    console.log('[generateCompanyTokens] Gas wallet AVAX balance:', avaxBalance.toString());
    if (avaxBalance < 50000000000000000n) { // < 0.05 AVAX
      return Response.json({ error: 'Gas wallet has insufficient AVAX. Please fund the gas wallet on Fuji testnet.' }, { status: 500 });
    }

    // Deploy the MooadonRewards ERC20 contract
    // Constructor: (name, symbol, owner, minter, initialSupply) — supply in whole units (NOT wei)
    const ownerAddress = Deno.env.get('OWNER_WALLET_ADDRESS') || account.address;
    const minterAddress = ownerAddress; // minter = same as owner (treasury wallet sends rewards)
    console.log(`[generateCompanyTokens] Deploying: name="${name}" symbol="${symbol}" supply=${supplyAmount} owner=${ownerAddress}`);

    const deployTxHash = await walletClient.deployContract({
      abi: ERC20_ABI,
      bytecode: ERC20_BYTECODE,
      args: [name, symbol, ownerAddress, minterAddress, BigInt(supplyAmount)],
      gas: 3_000_000n
    });

    console.log('[generateCompanyTokens] Deploy TX sent:', deployTxHash);

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployTxHash, timeout: 120_000 });

    if (receipt.status === 'reverted') {
      throw new Error(`Contract deployment reverted. TX: ${deployTxHash}. Check explorer: https://testnet.snowtrace.io/tx/${deployTxHash}`);
    }
    
    if (!receipt.contractAddress) {
      throw new Error('Contract deployment failed — no contract address in receipt');
    }

    const contractAddress = receipt.contractAddress;
    console.log(`[generateCompanyTokens] ✅ Contract deployed: ${contractAddress} for ${company.name} (${symbol})`);

    // The deployer (gas wallet) is the actual on-chain token holder
    const actualTokenHolder = account.address;
    console.log(`[generateCompanyTokens] Actual on-chain token holder (deployer): ${actualTokenHolder}`);

    // Update CompanyToken record — treasury_wallet = deployer address (actual on-chain holder)
    if (companyToken) {
      await base44.asServiceRole.entities.CompanyToken.update(companyToken.id, {
        contract_address: contractAddress,
        token_name: name,
        token_symbol: symbol,
        total_supply: supplyAmount,
        treasury_balance: supplyAmount,
        treasury_wallet: actualTokenHolder,
        chain: 'avalanche_fuji',
        decimals: 18
      });
    } else {
      companyToken = await base44.asServiceRole.entities.CompanyToken.create({
        company_id,
        token_name: name,
        token_symbol: symbol,
        total_supply: supplyAmount,
        treasury_balance: supplyAmount,
        treasury_wallet: actualTokenHolder,
        contract_address: contractAddress,
        chain: 'avalanche_fuji',
        decimals: 18
      });
    }

    // Update Company record
    await base44.asServiceRole.entities.Company.update(company.id, {
      token_contract: contractAddress,
      token_status: 'deployed',
      token_name: name,
      token_symbol: symbol,
      wallet_chain: 'avalanche_fuji'
    });

    // Transfer full supply from deployer (gas wallet) to OWNER wallet so it can send rewards
    // ownerAddress already declared above during deploy args
    if (ownerAddress && ownerAddress.toLowerCase() !== account.address.toLowerCase()) {
      console.log(`[generateCompanyTokens] Transferring supply from deployer to OWNER: ${ownerAddress}`);
      const { readContract, writeContract } = await import('npm:viem@2.7.0');
      const deployerBalance = await publicClient.readContract({
        address: contractAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address]
      });
      if (deployerBalance > 0n) {
        const transferHash = await walletClient.writeContract({
          address: contractAddress,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [ownerAddress, deployerBalance]
        });
        await publicClient.waitForTransactionReceipt({ hash: transferHash, timeout: 60_000 });
        console.log(`[generateCompanyTokens] ✅ Supply transferred to OWNER. TX: ${transferHash}`);
        // Update treasury_wallet to OWNER in DB
        await base44.asServiceRole.entities.CompanyToken.update(companyToken.id, {
          treasury_wallet: ownerAddress
        });
        await base44.asServiceRole.entities.Company.update(company.id, {
          blockchain_wallet_address: ownerAddress
        });
      }
    } else if (!ownerAddress) {
      console.warn('[generateCompanyTokens] OWNER_WALLET_ADDRESS not set — tokens remain with deployer');
    }

    console.log(`[generateCompanyTokens] ✅ Done. ${company.name} => ${symbol} => ${contractAddress}`);

    return Response.json({
      success: true,
      token_contract: contractAddress,
      token_name: name,
      token_symbol: symbol,
      deploy_tx_hash: deployTxHash,
      explorer_url: `https://testnet.snowtrace.io/address/${contractAddress}`,
      company_token_id: companyToken.id
    });

  } catch (error) {
    console.error('[generateCompanyTokens] error:', error?.message);
    console.error('[generateCompanyTokens] stack:', error?.stack);
    return Response.json({
      error: 'Token deployment failed',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
});