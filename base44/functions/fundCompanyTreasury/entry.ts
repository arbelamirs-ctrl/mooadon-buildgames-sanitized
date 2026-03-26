import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createWalletClient, createPublicClient, http, parseEther } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

Deno.serve(async (req) => {
  console.log('🚀 fundCompanyTreasury function started');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      console.error('❌ Unauthorized - admin only');
      return Response.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { company_id, avax_amount } = body;
      console.log('[fundCompanyTreasury] input:', { company_id, avax_amount });

    if (!company_id || !avax_amount) {
      return Response.json({ error: 'Missing company_id or avax_amount' }, { status: 400 });
    }

    const amount = parseFloat(avax_amount);
    if (isNaN(amount) || amount <= 0) {
      return Response.json({ error: 'Invalid AVAX amount' }, { status: 400 });
    }

    console.log('📋 Funding company treasury:', company_id, 'Amount:', amount, 'AVAX');

    // Get company
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies || companies.length === 0) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];

    if (!company.blockchain_wallet_address) {
      return Response.json({ 
        error: 'Company has no treasury wallet. Run completeCompanySetup first.' 
      }, { status: 400 });
    }

    console.log('✅ Company found:', company.name);
    console.log('💼 Treasury wallet:', company.blockchain_wallet_address);

    // Get Master Wallet private key
    let masterPrivateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    if (!masterPrivateKey) {
      return Response.json({ 
        error: 'GAS_WALLET_PRIVATE_KEY not configured' 
      }, { status: 500 });
    }

    if (!masterPrivateKey.startsWith('0x')) {
      masterPrivateKey = `0x${masterPrivateKey}`;
    }

    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';

    // Create viem clients
    const masterAccount = privateKeyToAccount(masterPrivateKey);
    console.log('🔑 Master Wallet:', masterAccount.address);

    const publicClient = createPublicClient({
      chain: avalancheFuji,
      transport: http(rpcUrl)
    });

    const walletClient = createWalletClient({
      account: masterAccount,
      chain: avalancheFuji,
      transport: http(rpcUrl)
    });

    // Check Master Wallet balance
    const masterBalance = await publicClient.getBalance({
      address: masterAccount.address
    });
    const masterBalanceInAvax = Number(masterBalance) / 1e18;
    console.log('💰 Master Wallet balance:', masterBalanceInAvax, 'AVAX');

    if (masterBalanceInAvax < amount) {
      return Response.json({ 
        error: `Insufficient Master Wallet balance. Has ${masterBalanceInAvax} AVAX, needs ${amount} AVAX` 
      }, { status: 400 });
    }

    // Send AVAX to company treasury
    console.log('📤 Sending', amount, 'AVAX to', company.blockchain_wallet_address);
    
    const txHash = await walletClient.sendTransaction({
      to: company.blockchain_wallet_address,
      value: parseEther(amount.toString())
    });

    console.log('⏳ Transaction sent:', txHash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000
    });

    console.log('✅ Transaction confirmed! Block:', Number(receipt.blockNumber));

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      company_id: company_id,
      action: 'treasury_funded',
      entity_type: 'Company',
      entity_id: company_id,
      performed_by: user.id,
      details: {
        avax_amount: amount,
        tx_hash: txHash,
        block_number: Number(receipt.blockNumber),
        from_address: masterAccount.address,
        to_address: company.blockchain_wallet_address
      }
    });

    // Log blockchain transfer
    await base44.asServiceRole.entities.BlockchainTransfer.create({
      company_id: company_id,
      client_id: 'system',
      from_address: masterAccount.address,
      to_address: company.blockchain_wallet_address,
      chain: 'avalanche_fuji',
      amount: amount,
      tx_hash: txHash,
      status: 'confirmed'
    });

    // Mark company as funded
    await base44.asServiceRole.entities.Company.update(company_id, {
      gas_wallet_funded: true
    });

    return Response.json({
      success: true,
      tx_hash: txHash,
      block_number: Number(receipt.blockNumber),
      amount: amount,
      treasury_address: company.blockchain_wallet_address,
      message: `Successfully funded ${company.name} treasury with ${amount} AVAX`
    });

  } catch (error) {
    console.error('❌ Error funding treasury:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({
      error: error.message || 'Failed to fund treasury',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});