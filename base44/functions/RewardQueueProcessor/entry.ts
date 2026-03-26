import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createWalletClient, createPublicClient, http, parseUnits } from 'npm:viem@2.7.0';
import { avalancheFuji, avalanche } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

// ── FIX 1: Nonce lock management (prevents parallel nonce conflicts) ─────────
const nonceLocks = new Map<string, Promise<void>>();

async function acquireNonceLock(walletAddress: string): Promise<() => void> {
  const key = walletAddress.toLowerCase();
  
  // Wait for any existing lock to complete
  const currentLock = nonceLocks.get(key);
  if (currentLock) {
    await currentLock;
  }
  
  // Create new lock
  let releaseFn: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseFn = resolve;
  });
  
  nonceLocks.set(key, lockPromise);
  
  // Return release function
  return () => {
    nonceLocks.delete(key);
    releaseFn();
  };
}

// ── Dual-format private key decrypt/encrypt helpers ─────────────────────────
async function decryptPrivateKey(encryptedData, encryptionKey) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let iv, ciphertext, keyMaterial;
  try {
    const parsed = JSON.parse(encryptedData);
    if (parsed.iv && parsed.data) {
      iv = new Uint8Array(parsed.iv);
      ciphertext = new Uint8Array(parsed.data);
      const rawKey = encoder.encode(encryptionKey.padEnd(32, '0')).slice(0, 32);
      keyMaterial = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
    } else { throw new Error('not JSON format'); }
  } catch {
    const [ivB64, ctB64] = encryptedData.split(':');
    iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    ciphertext = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
    const keyHash = await crypto.subtle.digest('SHA-256', encoder.encode(encryptionKey));
    keyMaterial = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['decrypt']);
  }
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyMaterial, ciphertext);
  return decoder.decode(decrypted);
}

async function encryptPrivateKey(privateKey, encryptionKey) {
  const encoder = new TextEncoder();
  const keyHash = await crypto.subtle.digest('SHA-256', encoder.encode(encryptionKey));
  const keyMaterial = await crypto.subtle.importKey('raw', keyHash, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyMaterial, encoder.encode(privateKey));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  return `${ivB64}:${ctB64}`;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Network resolution helper (company-based) ────────────────────────────────
function normalizeNetwork(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'fuji' || s === 'avalanche_fuji' || s === 'avax_fuji' || s === 'testnet') return 'fuji';
  if (s === 'mainnet' || s === 'avalanche' || s === 'avax' || s === 'avax_mainnet') return 'mainnet';
  return s;
}

function resolveCompanyChain(company, companyToken) {
  const raw = company?.onchain_network || companyToken?.chain || null;
  
  // Fallback to global AVAX_NETWORK if company doesn't specify
  const fallbackNetwork = Deno.env.get('AVAX_NETWORK') || 'fuji';
  const networkToUse = raw || fallbackNetwork;
  
  const normalized = normalizeNetwork(networkToUse);
  if (normalized !== 'fuji' && normalized !== 'mainnet') {
    console.warn(`⚠️ Invalid network "${networkToUse}", falling back to fuji`);
    return {
      chain: avalancheFuji,
      rpcUrl: Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc',
      walletChain: 'avalanche_fuji',
      networkName: 'fuji',
      isMainnet: false
    };
  }
  
  const isMainnet = normalized === 'mainnet';
  return {
    chain: isMainnet ? avalanche : avalancheFuji,
    rpcUrl: isMainnet
      ? (Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc')
      : (Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc'),
    walletChain: isMainnet ? 'avalanche' : 'avalanche_fuji',
    networkName: normalized,
    isMainnet
  };
}

// ── Sender wallet resolution ─────────────────────────────────────────────────
function resolveSenderWallet(company) {
  // Priority: company treasury wallet > global OWNER_PRIVATE_KEY > GAS_WALLET_PRIVATE_KEY
  let key = null;
  let source = null;

  // 1. Try company-specific treasury wallet
  if (company?.treasury_wallet_private_key) {
    key = company.treasury_wallet_private_key;
    source = 'company_treasury';
  }
  // 2. Fallback to OWNER_PRIVATE_KEY
  else if (Deno.env.get('OWNER_PRIVATE_KEY')) {
    key = Deno.env.get('OWNER_PRIVATE_KEY');
    source = 'owner_key';
  }
  // 3. Fallback to GAS_WALLET_PRIVATE_KEY
  else if (Deno.env.get('GAS_WALLET_PRIVATE_KEY')) {
    key = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    source = 'gas_wallet';
  }

  if (!key) {
    throw new Error('No sender wallet configured (tried: treasury_wallet_private_key, OWNER_PRIVATE_KEY, GAS_WALLET_PRIVATE_KEY)');
  }

  // Normalize key
  if (!key.startsWith('0x')) key = `0x${key}`;

  console.log(`🔑 Sender wallet source: ${source}`);
  return { key, source };
}
// ─────────────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable'
  }
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow service-role internal calls, app admins, and company_admins (app builders).
  const user = await base44.auth.me().catch(() => null);
  if (user && user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'company_admin' && user.collaborator_role !== 'editor' && user.collaborator_role !== 'owner') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    console.log('🔄 RewardQueueProcessor started');
    
    // Get pending reward jobs
    const pendingRewards = await base44.asServiceRole.entities.RewardQueue.filter({
      status: 'pending'
    });

    // Also retry failed jobs that are due for retry
    const now = new Date();
    const failedRewards = await base44.asServiceRole.entities.RewardQueue.filter({
      status: 'failed'
    });

    const retryableRewards = failedRewards.filter(r => {
      if (r.retry_count >= r.max_retries) return false;
      if (!r.next_retry_at) return true;
      return new Date(r.next_retry_at) <= now;
    });

    const jobsToProcess = [...pendingRewards, ...retryableRewards];
    console.log(`📋 Found ${jobsToProcess.length} rewards to process`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    };

    for (const job of jobsToProcess) {
      try {
        console.log(`🎁 Processing reward job ${job.id} for customer ${job.customer_id}`);
        
        // Mark as processing
        await base44.asServiceRole.entities.RewardQueue.update(job.id, {
          status: 'processing'
        });

        // Process based on reward type
        if (job.reward_type === 'tokens' || job.reward_type === 'token' || job.reward_type === 'points') {
          await processTokenReward(base44, job);
        } else if (job.reward_type === 'coupon') {
          await processCouponReward(base44, job);
        }

        // Mark as completed
        await base44.asServiceRole.entities.RewardQueue.update(job.id, {
          status: 'completed',
          processed_at: new Date().toISOString(),
          error_message: null
        });

        results.succeeded++;
        console.log(`✅ Reward job ${job.id} completed`);

      } catch (error) {
        console.error(`❌ Failed to process reward job ${job.id}:`, error.message);
        
        // Calculate next retry with exponential backoff
        const retryCount = job.retry_count + 1;
        const backoffMinutes = Math.pow(2, retryCount) * 5; // 5, 10, 20 minutes
        const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

        if (retryCount >= job.max_retries) {
          // Max retries reached - mark as failed
          await base44.asServiceRole.entities.RewardQueue.update(job.id, {
            status: 'failed',
            retry_count: retryCount,
            error_message: error.message
          });
          console.log(`❌ Max retries reached for job ${job.id}`);
        } else {
          // Schedule retry
          await base44.asServiceRole.entities.RewardQueue.update(job.id, {
            status: 'failed',
            retry_count: retryCount,
            next_retry_at: nextRetry.toISOString(),
            error_message: error.message
          });
          console.log(`⏰ Scheduled retry ${retryCount}/${job.max_retries} for job ${job.id} at ${nextRetry.toISOString()}`);
        }

        results.failed++;
        results.errors.push({ job_id: job.id, error: error.message });
      }

      results.processed++;
    }

    console.log('✅ Processing complete:', results);

    return Response.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('❌ RewardQueueProcessor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── Structured token-send audit log ─────────────────────────────────────────
function logTokenSend({ phase, company, companyToken, client, amount, txHash, network, error, jobId }) {
  const ts = new Date().toISOString();
  const wallet = client?.wallet_address || 'UNKNOWN';
  const symbol = companyToken?.token_symbol || '???';
  const companyName = company?.name || company_id;

  if (phase === 'start') {
    console.log(`[TOKEN_SEND][START] ${ts} | job=${jobId} | company="${companyName}" | client=${client?.id} | phone=${client?.phone} | wallet=${wallet} | amount=${amount} ${symbol} | network=${network}`);
  } else if (phase === 'broadcast') {
    console.log(`[TOKEN_SEND][BROADCAST] ${ts} | job=${jobId} | tx_hash=${txHash} | to=${wallet} | amount=${amount} ${symbol} | network=${network}`);
  } else if (phase === 'confirmed') {
    console.log(`[TOKEN_SEND][CONFIRMED] ${ts} | job=${jobId} | tx_hash=${txHash} | to=${wallet} | amount=${amount} ${symbol} | network=${network} | company="${companyName}" | client=${client?.id}`);
  } else if (phase === 'db_updated') {
    console.log(`[TOKEN_SEND][DB_UPDATED] ${ts} | job=${jobId} | client=${client?.id} | new_balance=${client?.current_balance} | tx_hash=${txHash}`);
  } else if (phase === 'error') {
    console.error(`[TOKEN_SEND][ERROR] ${ts} | job=${jobId} | company="${companyName}" | client=${client?.id} | wallet=${wallet} | amount=${amount} ${symbol} | error=${error}`);
  }
}

// Process token/points rewards
async function processTokenReward(base44, job) {
  const { customer_id, company_id, amount, transaction_id } = job;

  // ── FIX 2: IDEMPOTENCY CHECK ──────────────────────────────────────────────
  // Check if this reward has already been processed (idempotency key = job.id)
  const existingTransactions = await base44.asServiceRole.entities.Transaction.filter({
    reward_queue_id: job.id
  });
  
  const completedTx = existingTransactions.find(
    tx => tx.status === 'completed' && tx.blockchain_tx_hash
  );
  
  if (completedTx) {
    console.log(`✅ Idempotency: Job ${job.id} already processed (tx_hash=${completedTx.blockchain_tx_hash}). Skipping blockchain send.`);
    return; // RewardQueue job will be marked completed by caller
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Get customer and company
  const clients = await base44.asServiceRole.entities.Client.filter({ id: customer_id });
  if (clients.length === 0) throw new Error(`Customer not found: ${customer_id}`);
  const client = clients[0];

  const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
  if (companies.length === 0) throw new Error(`Company not found: ${company_id}`);
  const company = companies[0];

  // Get company token
  const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id });
  if (companyTokens.length === 0) throw new Error(`Company token not found for company: ${company_id}`);
  // prefer is_primary: true, fallback to newest with contract_address
  const primaryToken = companyTokens.find(t => t.is_primary === true && t.contract_address);
  const companyToken = primaryToken
    || companyTokens.filter(t => t.contract_address).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0]
    || companyTokens[companyTokens.length - 1];
  console.log(`🪙 Selected token: ${companyToken?.token_symbol} | contract: ${companyToken?.contract_address} | is_primary: ${companyToken?.is_primary}`);

  // Resolve network from company
  const chainConfig = resolveCompanyChain(company, companyToken);
  console.log(`🌐 Network: ${chainConfig.networkName} for company ${company.name}`);

  logTokenSend({ phase: 'start', company, companyToken, client, amount, network: chainConfig.networkName, jobId: job.id });

  // Create custodial wallet if needed
  if (!client.wallet_address) {
    const { generatePrivateKey, privateKeyToAddress } = await import('npm:viem@2.7.0/accounts');
    const privateKey = generatePrivateKey();
    const address = privateKeyToAddress(privateKey);

    const encryptedPrivateKey = await encryptPrivateKey(privateKey, Deno.env.get('WALLET_ENCRYPTION_KEY'));

    await base44.asServiceRole.entities.Client.update(client.id, {
      wallet_address: address,
      wallet_chain: chainConfig.walletChain,
      hasWallet: true,
      encryptedPrivateKey
    });

    client.wallet_address = address;
    console.log('🔑 Created custodial wallet:', address);
  }

  // Resolve sender wallet (treasury > OWNER > GAS)
  const { key: senderKey, source: senderSource } = resolveSenderWallet(company);
  
  const account = privateKeyToAccount(senderKey);
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl)
  });

  const walletClient = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl)
  });

  // Use company-specific token contract - NO FALLBACK to global TOKEN_CONTRACT!
  const tokenContractAddress = companyToken.contract_address;

  if (!tokenContractAddress) {
    throw new Error(
      `Company token not deployed for company ${company_id}. ` +
      `Token symbol: ${companyToken.token_symbol}. ` +
      `Please run deployCompanyToken first.`
    );
  }

  // Clean contract address if needed (remove any legacy prefixes)
  const cleanAddress = tokenContractAddress.includes('$')
    ? tokenContractAddress.split('$')[1]
    : tokenContractAddress;

  console.log(`📄 Token: ${companyToken.token_symbol} | Contract: ${cleanAddress} | Sender: ${account.address} (${senderSource}) | Recipient: ${client.wallet_address}`);

  const { isAddress, getAddress, encodeFunctionData } = await import('npm:viem@2.7.0');
  if (!isAddress(client.wallet_address)) {
    throw new Error(`Invalid address: ${client.wallet_address}`);
  }

  const recipientAddress = getAddress(client.wallet_address);
  const amountInWei = parseUnits(amount.toString(), 18);

  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [recipientAddress, amountInWei]
  });

  console.log(`📤 Sending ${amount} ${companyToken.token_symbol} → ${recipientAddress} on ${chainConfig.networkName}`);

  // ── FIX 1: NONCE MANAGEMENT ───────────────────────────────────────────────
  const releaseLock = await acquireNonceLock(account.address);
  
  let txHash;
  try {
    // Get current nonce (pending block to account for in-flight txs)
    const nonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending'
    });
    
    console.log(`🔢 Using nonce ${nonce} for wallet ${account.address}`);

    // ── FIX 3: DYNAMIC GAS ESTIMATION ─────────────────────────────────────────
    let gasLimit;
    try {
      const estimatedGas = await publicClient.estimateGas({
        account: account.address,
        to: cleanAddress,
        data
      });
      
      // Add 20% buffer
      gasLimit = (estimatedGas * 12n) / 10n;
      console.log(`⛽ Estimated gas: ${estimatedGas}, using ${gasLimit} (with 20% buffer)`);
    } catch (gasError) {
      console.warn(`⚠️ Gas estimation failed, using fallback 100000:`, gasError.message);
      gasLimit = 100000n;
    }
    // ──────────────────────────────────────────────────────────────────────────

    txHash = await walletClient.sendTransaction({
      to: cleanAddress,
      data,
      gas: gasLimit,
      nonce
    });
    
    logTokenSend({ phase: 'broadcast', company, companyToken, client, amount, txHash, network: chainConfig.networkName, jobId: job.id });
  } finally {
    // Always release the nonce lock
    releaseLock();
  }
  // ──────────────────────────────────────────────────────────────────────────

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000
  });

  if (receipt.status !== 'success') {
    throw new Error(`Blockchain transaction reverted. tx=${txHash} network=${chainConfig.networkName} recipient=${recipientAddress}`);
  }

  logTokenSend({ phase: 'confirmed', company, companyToken, client, amount, txHash, network: chainConfig.networkName, jobId: job.id });

  // Update customer balance (only after blockchain success)
  const balanceBefore = client.current_balance || 0;
  const newBalance = balanceBefore + amount;
  const newTotalEarned = (client.total_earned || 0) + amount;
  
  let newLevel = 'Bronze';
  if (newTotalEarned >= 10001) newLevel = 'Gold';
  else if (newTotalEarned >= 1001) newLevel = 'Silver';

  await base44.asServiceRole.entities.Client.update(client.id, {
    current_balance: newBalance,
    total_earned: newTotalEarned,
    level: newLevel,
    tokenBalance: (client.tokenBalance || 0) + amount,
    onchain_balance: (client.onchain_balance || 0) + amount,
    last_sync: new Date().toISOString(),
    last_activity: new Date().toISOString()
  });
  logTokenSend({ phase: 'db_updated', company, companyToken, client: { ...client, current_balance: newBalance }, amount, txHash, network: chainConfig.networkName, jobId: job.id });

  // Update transaction status to 'completed' only after blockchain success
  // RESILIENCE: Transaction may have been deleted by StalledTransactionsCleanup - that's OK!
  if (transaction_id) {
    try {
      await base44.asServiceRole.entities.Transaction.update(transaction_id, {
        status: 'completed',
        tokens_actual: amount,
        blockchain_tx_hash: txHash,
        blockchain_confirmed_at: new Date().toISOString(),
        reward_queue_id: job.id  // Link to RewardQueue for idempotency
      });
      console.log(`✅ Transaction ${transaction_id} marked as completed`);
    } catch (txUpdateError) {
      console.warn(`⚠️ Transaction ${transaction_id} not found (may have been cleaned up) - tokens sent anyway:`, txUpdateError.message);
    }
  }

  // Create ledger event
  await base44.asServiceRole.entities.LedgerEvent.create({
    company_id,
    client_id: customer_id,
    transaction_id,
    type: 'earn',
    points: amount,
    balance_before: balanceBefore,
    balance_after: newBalance,
    source: 'reward_queue',
    description: `Earned ${amount} ${companyToken.token_symbol} tokens (async processing)`,
    metadata: {
      tx_hash: txHash,
      reward_queue_job_id: job.id,
      sender_source: senderSource,
      network: chainConfig.networkName
    }
  });

  // Send notification
  try {
    await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
      phone: client.phone,
      message: `✅ ${amount} ${companyToken.token_symbol} tokens confirmed and added to your wallet!`,
      company_id
    });
  } catch (err) {
    console.error('⚠️ Notification failed:', err.message);
  }
}

// Process coupon rewards
async function processCouponReward(base44, job) {
  const { customer_id, company_id, transaction_id } = job;

  const clients = await base44.asServiceRole.entities.Client.filter({ id: customer_id });
  if (clients.length === 0) throw new Error('Customer not found');
  const client = clients[0];

  // Create coupon
  const couponCode = `COUP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await base44.asServiceRole.entities.Coupon.create({
    company_id,
    client_id: customer_id,
    client_phone: client.phone,
    transaction_id,
    coupon_code: couponCode,
    discount_type: 'percentage',
    discount_value: 10,
    min_purchase_amount: 0,
    max_uses: 1,
    times_used: 0,
    status: 'active',
    expires_at: expiresAt.toISOString()
  });

  console.log('🎟️ Coupon created:', couponCode);

  // Update transaction
  // RESILIENCE: Transaction may have been deleted by StalledTransactionsCleanup - that's OK!
  if (transaction_id) {
    try {
      await base44.asServiceRole.entities.Transaction.update(transaction_id, {
        status: 'completed',
        metadata: { coupon_code: couponCode },
        reward_queue_id: job.id  // Link to RewardQueue for idempotency
      });
    } catch (txUpdateError) {
      console.warn(`⚠️ Transaction ${transaction_id} not found (may have been cleaned up) - coupon issued anyway:`, txUpdateError.message);
    }
  }

  // Send notification
  try {
    // FIX: Hardcoded to production domain until APP_URL env var is corrected in Base44
    const baseUrl = 'https://mooadon.com';
    const couponUrl = `${baseUrl}/CouponDisplay?coupon_code=${couponCode}`;
    
    // Validation: ensure coupon URL is on correct domain
    if (!couponUrl.startsWith('https://mooadon.com/') && !couponUrl.startsWith('https://www.mooadon.com/')) {
      console.error('❌ Invalid coupon URL domain:', couponUrl);
    }
    
    await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
      phone: client.phone,
      message: `🎟️ Your discount coupon: ${couponCode}\n10% off valid for 30 days!\n\nView: ${couponUrl}`,
      company_id
    });
  } catch (err) {
    console.error('⚠️ Notification failed:', err.message);
  }
}