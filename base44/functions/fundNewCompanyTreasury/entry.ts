import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createWalletClient, createPublicClient, http, parseEther } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

function withTimeout(promise, ms, msg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))
  ]);
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://mooadon.base44.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  console.log('🚀 [STEP 1] fundNewCompanyTreasury function started at', new Date().toISOString());
  
  try {
    console.log('🔐 [STEP 2] Reading GAS_WALLET_PRIVATE_KEY from secrets...');
    let masterPrivateKey = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    if (!masterPrivateKey) {
      console.error('❌ [STEP 2] GAS_WALLET_PRIVATE_KEY not configured');
      return Response.json({ error: 'GAS_WALLET_PRIVATE_KEY not configured', success: false }, { status: 500 });
    }
    console.log('✅ [STEP 2] GAS_WALLET_PRIVATE_KEY exists, length:', masterPrivateKey.length, 'starts with 0x:', masterPrivateKey.startsWith('0x'));
    masterPrivateKey = masterPrivateKey.trim(); // strip any leading/trailing whitespace
    if (!masterPrivateKey.startsWith('0x')) {
      masterPrivateKey = `0x${masterPrivateKey}`;
    }
    console.log('🔑 [STEP 2] Final key length after normalization:', masterPrivateKey.length, '(expected 66)');

    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
    console.log('🌐 [STEP 2] RPC URL:', rpcUrl);

    const base44 = createClientFromRequest(req);
    
    // Get user but don't fail if none (for service role calls)
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      console.log('[fundNewCompanyTreasury] No user context - assuming service role call');
    }

    const body = await req.json();
    const { company_id, avax_amount, force_override = false } = body;
    console.log('[fundNewCompanyTreasury] input:', { company_id, avax_amount, force_override, user: user?.email || 'service_role' });

    if (!company_id || !avax_amount) {
      return Response.json({ error: 'Missing company_id or avax_amount' }, { status: 400 });
    }

    const amount = parseFloat(avax_amount);
    if (isNaN(amount) || amount <= 0) {
      return Response.json({ error: 'Invalid AVAX amount' }, { status: 400 });
    }

    // Get company using service role
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies || companies.length === 0) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];

    // --- IDEMPOTENCY GUARDS ---
    if (!force_override) {
      // Guard 1: check if company already has AVAX funding (existing BlockchainTransfer with client_id: 'system')
      const existingTransfers = await base44.asServiceRole.entities.BlockchainTransfer.filter({
        company_id,
        client_id: 'system'
      });
      if (existingTransfers && existingTransfers.length > 0) {
        const existing = existingTransfers[0];
        console.warn(`⚠️ Company ${company_id} already has treasury funding TX: ${existing.tx_hash} — aborting to prevent duplicate`);
        return Response.json({
          success: false,
          error: 'ALREADY_FUNDED',
          existing_tx: existing.tx_hash,
          existing_wallet: company.blockchain_wallet_address,
          message: 'Company treasury already has an AVAX funding record. Use force_override: true to override.'
        }, { status: 409 });
      }

      // NOTE: Token existence is NOT checked here — AVAX funding is independent of token deployment.
    } else {
      console.warn(`⚠️ force_override=true — clearing all existing transfer records and retrying for company ${company_id}`);

      // Delete any existing BlockchainTransfer records so the transfer is retried fresh
      try {
        const existingToDelete = await base44.asServiceRole.entities.BlockchainTransfer.filter({
          company_id,
          client_id: 'system'
        });
        for (const t of existingToDelete) {
          await base44.asServiceRole.entities.BlockchainTransfer.delete(t.id);
          console.log(`🗑️ Deleted existing BlockchainTransfer: ${t.id} (tx: ${t.tx_hash})`);
        }
        console.log(`🗑️ Deleted ${existingToDelete.length} existing transfer record(s) for force_override`);
      } catch (delErr) {
        console.warn('Could not delete existing transfer records (non-critical):', delErr.message);
      }

      // Audit log force override
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: company_id,
        action: 'treasury_fund_force_override',
        entity_type: 'Company',
        entity_id: company_id,
        performed_by: user?.email || 'service_role',
        details: {
          timestamp: new Date().toISOString(),
          avax_amount: amount,
          user_email: user?.email || 'service_role',
          note: 'force_override bypassed idempotency guards and cleared existing records'
        }
      });
    }
    // --- END IDEMPOTENCY GUARDS ---

    // Authorization: allow if called via service role OR if user is owner/admin
    if (user) {
      const isOwner = company.created_by === user.email;
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      
      if (!isOwner && !isAdmin) {
        console.error('❌ Unauthorized - user is not company owner or admin');
        return Response.json({ 
          error: 'Unauthorized - you can only fund your own company during onboarding' 
        }, { status: 403 });
      }
      
      console.log('👤 Authorized user:', user.email, isOwner ? '(owner)' : '(admin)');
    } else {
      console.log('🔐 Service role call - authorized');
    }

    if (!company.blockchain_wallet_address) {
      return Response.json({ 
        error: 'Company has no treasury wallet. Run createCompanyWallet first.' 
      }, { status: 400 });
    }

    console.log('✅ Company found:', company.name);
    console.log('💼 Treasury wallet:', company.blockchain_wallet_address);

    console.log('🏗️ [STEP 3] Creating viem wallet client with RPC:', rpcUrl);
    const masterAccount = privateKeyToAccount(masterPrivateKey);
    console.log('🔑 [STEP 3] Master Wallet address derived:', masterAccount.address);

    const publicClient = createPublicClient({
      chain: avalancheFuji,
      transport: http(rpcUrl, { timeout: 10_000 })
    });

    const walletClient = createWalletClient({
      account: masterAccount,
      chain: avalancheFuji,
      transport: http(rpcUrl, { timeout: 10_000 })
    });
    console.log('✅ [STEP 3] Viem clients created successfully');

    console.log('💰 [STEP 4] Calling getBalance for address:', masterAccount.address);
    const balanceStart = Date.now();
    let masterBalance;
    try {
      masterBalance = await withTimeout(
        publicClient.getBalance({ address: masterAccount.address }),
        8000,
        'Balance check timed out'
      );
    } catch (balanceError) {
      console.error('❌ [STEP 4] Balance check failed after', Date.now() - balanceStart, 'ms:', balanceError.message);
      return Response.json({ 
        error: 'Gas wallet balance check failed: ' + balanceError.message,
        success: false
      }, { status: 500 });
    }

    const masterBalanceInAvax = Number(masterBalance) / 1e18;
    console.log('✅ [STEP 5] getBalance returned after', Date.now() - balanceStart, 'ms. Balance:', masterBalanceInAvax, 'AVAX (raw:', masterBalance.toString(), ')');

    if (masterBalanceInAvax === 0 || masterBalanceInAvax < amount) {
      return Response.json({ 
        error: 'Insufficient gas wallet balance to complete this transaction',
        success: false
      }, { status: 400 });
    }

    console.log('📤 [STEP 6] About to send', amount, 'AVAX to', company.blockchain_wallet_address, 'with retry x3');

    const RETRY_DELAYS = [2000, 4000, 8000];
    let txHash = null;
    let receipt = null;
    let partial = false;
    let lastSendError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`📤 [STEP 6] Attempt ${attempt}/3 — sendTransaction`);
        const sendStart = Date.now();
        txHash = await withTimeout(
          walletClient.sendTransaction({
            to: company.blockchain_wallet_address,
            value: parseEther(amount.toString()),
            gas: 21000n
          }),
          15000,
          'Transaction send timed out'
        );
        console.log(`✅ [STEP 6] Attempt ${attempt} sent in ${Date.now() - sendStart}ms. TX:`, txHash);
        lastSendError = null;
        break; // success — exit retry loop
      } catch (sendError) {
        lastSendError = sendError;
        console.error(`❌ [STEP 6] Attempt ${attempt}/3 failed:`, sendError.message);
        if (attempt < 3) {
          await new Promise(res => setTimeout(res, RETRY_DELAYS[attempt - 1]));
        }
      }
    }

    if (!txHash) {
      // All 3 attempts failed
      console.error('❌ All 3 funding attempts failed:', lastSendError?.message);
      await base44.asServiceRole.entities.Company.update(company_id, {
        gas_wallet_funded: false,
        blockchain_setup_complete: false,
        setup_status: 'ready_partial',
        setup_last_error: `Funding failed after 3 attempts: ${lastSendError?.message}`
      });
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: company_id,
        action: 'treasury_funding_failed',
        entity_type: 'Company',
        entity_id: company_id,
        performed_by: user?.id || 'system',
        details: { error: lastSendError?.message, avax_amount: amount }
      });
      await base44.asServiceRole.entities.BlockchainTransfer.create({
        company_id: company_id,
        client_id: 'system',
        from_address: masterAccount.address,
        to_address: company.blockchain_wallet_address,
        chain: 'avalanche_fuji',
        amount: amount,
        status: 'failed',
        error_message: lastSendError?.message
      });
      return Response.json({ error: `Funding failed after 3 attempts: ${lastSendError?.message}`, success: false }, { status: 500 });
    }

    // Wait for receipt
    try {
      receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 20_000 });
      console.log('✅ [STEP 9] Receipt confirmed. Block:', Number(receipt.blockNumber));
    } catch (receiptError) {
      console.warn('⚠️ [STEP 9] Receipt wait timed out:', receiptError.message);
      partial = true;
    }

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      company_id: company_id,
      action: 'treasury_funding_success',
      entity_type: 'Company',
      entity_id: company_id,
      performed_by: user?.id || 'system',
      details: {
        avax_amount: amount,
        tx_hash: txHash,
        block_number: receipt ? Number(receipt.blockNumber) : null,
        from_address: masterAccount.address,
        to_address: company.blockchain_wallet_address,
        partial
      }
    });

    await base44.asServiceRole.entities.BlockchainTransfer.create({
      company_id: company_id,
      client_id: 'system',
      from_address: masterAccount.address,
      to_address: company.blockchain_wallet_address,
      chain: 'avalanche_fuji',
      amount: amount,
      tx_hash: txHash,
      status: partial ? 'pending' : 'confirmed'
    });

    // Update company flags on success
    await base44.asServiceRole.entities.Company.update(company_id, {
      gas_wallet_funded: true,
      blockchain_setup_complete: !partial,
      setup_status: partial ? 'ready_partial' : 'ready',
      onboarding_completed: !partial,
      setup_last_error: null
    });

    if (partial) {
      return Response.json({
        success: true,
        partial: true,
        tx_hash: txHash,
        amount,
        treasury_address: company.blockchain_wallet_address,
        message: 'TX sent but not yet confirmed - check Snowtrace for status'
      });
    }

    return Response.json({
      success: true,
      partial: false,
      tx_hash: txHash,
      block_number: Number(receipt.blockNumber),
      amount,
      treasury_address: company.blockchain_wallet_address,
      message: `Successfully funded ${company.name} treasury with ${amount} AVAX`
    });

  } catch (error) {
    console.error('❌ Error funding treasury:', error.message);
    return Response.json({ error: 'Internal server error', success: false }, { status: 500 });
  }
});