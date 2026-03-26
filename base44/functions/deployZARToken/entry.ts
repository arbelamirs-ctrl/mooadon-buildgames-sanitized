/**
 * deployZARToken
 * Deploys a new ZAR ERC20 on Fuji by cloning the bytecode from the working TOKEM contract,
 * then updates ZARA's CompanyToken record with the new address.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createWalletClient, createPublicClient, http, encodeAbiParameters, parseAbiParameters, parseUnits, encodeFunctionData } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

const TOKEM_CONTRACT = '0xEd1ebF72B9b590500F691ddc0d117D309D9180FB'; // known working ERC20 on Fuji

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
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

  // Step 1: Get deploy bytecode from the working TOKEM deployment tx
  // We know the deploy tx was: 0x6659c591b272ceb2a7ef8e773c5aca1d21660caf5a7d47d615fdb3ff461bf05f
  const deployTx = await publicClient.getTransaction({ hash: '0x6659c591b272ceb2a7ef8e773c5aca1d21660caf5a7d47d615fdb3ff461bf05f' });
  console.log('Got deploy tx, input length:', deployTx.input.length);

  // The original tx was deploy with args: ("Tokemx", "TOKEM", 1000000 * 10^18)
  // We need to replace the constructor args with ("ZARA Token", "ZAR", 1000000 * 10^18)
  // ABI-encode the new constructor args
  const newName = 'ZARA Token';
  const newSymbol = 'ZAR';
  const newSupply = parseUnits('1000000', 18);

  // Encode new args: (string, string, uint256)
  const newArgs = encodeAbiParameters(
    parseAbiParameters('string, string, uint256'),
    [newName, newSymbol, newSupply]
  );

  // The deploy data = bytecode + encoded constructor args
  // We need to find where the bytecode ends and args begin in the original tx
  // The original args were: ("Tokemx", "TOKEM", 1000000 * 10^18)
  const originalArgs = encodeAbiParameters(
    parseAbiParameters('string, string, uint256'),
    ['Tokemx', 'TOKEM', newSupply]
  );

  const originalInput = deployTx.input;
  const argsStart = originalInput.length - originalArgs.length + 2; // +2 for 0x
  const bytecodeOnly = originalInput.slice(0, argsStart);

  console.log('Bytecode length:', bytecodeOnly.length);
  console.log('Original args length:', originalArgs.length);
  console.log('New args length:', newArgs.length);

  // New deploy data = bytecode + new constructor args (without 0x prefix on args)
  const newDeployData = bytecodeOnly + newArgs.slice(2);
  console.log('New deploy data length:', newDeployData.length);

  // Step 2: Deploy
  const txHash = await walletClient.sendTransaction({
    data: newDeployData,
    gas: 3_000_000n,
  });
  console.log('Deploy TX sent:', txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
  console.log('Deploy receipt status:', receipt.status);
  console.log('Contract address:', receipt.contractAddress);

  if (receipt.status !== 'success' || !receipt.contractAddress) {
    return Response.json({ error: 'Deployment failed', tx: txHash, status: receipt.status }, { status: 500 });
  }

  const contractAddress = receipt.contractAddress;

  // Verify it works
  const balance = await publicClient.readContract({
    address: contractAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address]
  });
  console.log('Balance of deployer:', balance.toString());

  // Step 3: Update ZARA CompanyToken record
  const zarTokenId = '698f64350ba52a83f0ea907c';
  await base44.asServiceRole.entities.CompanyToken.update(zarTokenId, {
    contract_address: contractAddress,
    treasury_wallet: account.address,
    treasury_balance: 1000000,
    token_name: 'ZARA Token',
    token_symbol: 'ZAR',
    chain: 'avalanche_fuji',
  });

  // Also update the ZARA Company record
  await base44.asServiceRole.entities.Company.update('698e34c870359a1a7a3f7049', {
    token_contract: contractAddress,
  });

  return Response.json({
    success: true,
    contract_address: contractAddress,
    deploy_tx: txHash,
    deployer_balance_dmd: (Number(balance) / 1e18).toFixed(2),
    explorer: `https://testnet.snowtrace.io/address/${contractAddress}`,
    db_updated: true
  });
});