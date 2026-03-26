/**
 * fixDMDTreasury.js
 * 1. Decrypt Diamond Bourse's blockchain_private_key_encrypted
 * 2. Transfer 100,000 DMD from company wallet → OWNER wallet
 * 3. Trigger the pending DMD RewardQueue retry job
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createWalletClient, createPublicClient, http, parseUnits } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';

const DMD_COMPANY_ID      = '699c0fcc39be6fed84f0bfe3';
const DMD_CONTRACT        = '0x4D4e59Fc92337F99E6F7CFB54b3142213BABfE03';
const COMPANY_WALLET      = '0x4eB0167e97793e5B19d8d1F3b94744C879E0cf7B';
const TRANSFER_AMOUNT     = 100_000;

const ERC20_ABI = [
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];

async function decryptPrivateKey(encryptedStr) {
  // Try both encryption keys — company wallet keys may use either ENCRYPTION_KEY or WALLET_ENCRYPTION_KEY
  const encKey = Deno.env.get('WALLET_ENCRYPTION_KEY') || Deno.env.get('ENCRYPTION_KEY');
  if (!encKey) throw new Error('No encryption key found in env');

  const colonIdx = encryptedStr.indexOf(':');
  if (colonIdx === -1) throw new Error('Unexpected encrypted key format — expected "iv:ciphertext"');

  const ivPart = encryptedStr.slice(0, colonIdx);
  const ctPart = encryptedStr.slice(colonIdx + 1);

  // Detect encoding: hex strings only contain 0-9a-f; base64 has +/= or uppercase
  const isHex = /^[0-9a-f]+$/i.test(ivPart) && ivPart.length % 2 === 0 && ivPart.length <= 32;
  console.log(`🔐 Detected key format: ${isHex ? 'hex' : 'base64'} (iv part: "${ivPart.slice(0,8)}...")`);

  const iv         = isHex
    ? new Uint8Array(ivPart.match(/.{2}/g).map(b => parseInt(b, 16)))
    : Uint8Array.from(atob(ivPart), c => c.charCodeAt(0));
  const ciphertext = isHex
    ? new Uint8Array(ctPart.match(/.{2}/g).map(b => parseInt(b, 16)))
    : Uint8Array.from(atob(ctPart), c => c.charCodeAt(0));

  // (key derivation handled per-attempt below)
  // createCompanyWallet derives the AES key via SHA-256(WALLET_ENCRYPTION_KEY)
  // setupCompanyToken uses raw ENCRYPTION_KEY padded to 32 bytes
  // Try both approaches with both keys
  const enc = new TextEncoder();
  const keysToTry = [];

  const wKey = Deno.env.get('WALLET_ENCRYPTION_KEY');
  const eKey = Deno.env.get('ENCRYPTION_KEY');

  if (wKey) {
    // SHA-256 derived (createCompanyWallet approach)
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(wKey));
    keysToTry.push({ bytes: new Uint8Array(hash), label: 'WALLET_KEY_sha256' });
    // Raw padded
    const raw = enc.encode(wKey); const padded = new Uint8Array(32); padded.set(raw.slice(0,32)); keysToTry.push({ bytes: padded, label: 'WALLET_KEY_raw32' });
  }
  if (eKey) {
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(eKey));
    keysToTry.push({ bytes: new Uint8Array(hash), label: 'ENC_KEY_sha256' });
    const raw = enc.encode(eKey); const padded = new Uint8Array(32); padded.set(raw.slice(0,32)); keysToTry.push({ bytes: padded, label: 'ENC_KEY_raw32' });
  }

  for (const { bytes, label } of keysToTry) {
    try {
      const km = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, km, ciphertext);
      console.log(`✅ Decrypted successfully with: ${label}`);
      return new TextDecoder().decode(dec);
    } catch { /* try next */ }
  }
  throw new Error(`AES-GCM decrypt failed with all key variants | iv_len=${iv.length} ct_len=${ciphertext.length} format=${isHex ? 'hex' : 'base64'}`);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || (user.role !== 'admin' && user.collaborator_role !== 'editor' && user.collaborator_role !== 'owner')) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
    const ownerWallet = Deno.env.get('OWNER_WALLET_ADDRESS');
    if (!ownerWallet) throw new Error('OWNER_WALLET_ADDRESS env var not set');

    // 1. Get Company record and decrypt private key
    console.log('🔑 Fetching Diamond Bourse company record...');
    const companies = await base44.asServiceRole.entities.Company.filter({ id: DMD_COMPANY_ID });
    if (!companies.length) throw new Error('Diamond Bourse company not found');
    const company = companies[0];

    const encryptedKey = company.blockchain_private_key_encrypted;
    if (!encryptedKey) throw new Error('No blockchain_private_key_encrypted on company record');

    console.log('🔓 Decrypting company private key...');
    let privateKey = await decryptPrivateKey(encryptedKey);
    if (!privateKey.startsWith('0x')) privateKey = `0x${privateKey}`;

    const account = privateKeyToAccount(privateKey);
    console.log(`✅ Decrypted. Signer address: ${account.address}`);

    if (account.address.toLowerCase() !== COMPANY_WALLET.toLowerCase()) {
      throw new Error(`Decrypted key address ${account.address} does not match expected company wallet ${COMPANY_WALLET}`);
    }

    // 2. Check current balances
    const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });

    const [senderBal, ownerBal] = await Promise.all([
      publicClient.readContract({ address: DMD_CONTRACT, abi: ERC20_ABI, functionName: 'balanceOf', args: [COMPANY_WALLET] }),
      publicClient.readContract({ address: DMD_CONTRACT, abi: ERC20_ABI, functionName: 'balanceOf', args: [ownerWallet] }),
    ]);

    const senderBalHuman = Number(BigInt(String(senderBal)) / 10n**18n);
    const ownerBalBefore = Number(BigInt(String(ownerBal)) / 10n**18n);
    console.log(`💰 Company wallet DMD balance: ${senderBalHuman}`);
    console.log(`💰 OWNER wallet DMD balance (before): ${ownerBalBefore}`);

    if (senderBalHuman < TRANSFER_AMOUNT) {
      throw new Error(`Company wallet only has ${senderBalHuman} DMD — need ${TRANSFER_AMOUNT}`);
    }

    // 3. Transfer 100,000 DMD → OWNER wallet
    console.log(`📤 Transferring ${TRANSFER_AMOUNT} DMD from company wallet → ${ownerWallet}...`);
    const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });

    const { encodeFunctionData, getAddress } = await import('npm:viem@2.7.0');
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [getAddress(ownerWallet), parseUnits(TRANSFER_AMOUNT.toString(), 18)]
    });

    const txHash = await walletClient.sendTransaction({ to: DMD_CONTRACT, data, gas: 100_000n });
    console.log(`📡 TX broadcast: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    if (receipt.status !== 'success') throw new Error(`Transfer TX reverted: ${txHash}`);

    console.log(`✅ Transfer confirmed! TX: ${txHash}`);

    // 4. Verify new owner balance
    const ownerBalAfter = await publicClient.readContract({ address: DMD_CONTRACT, abi: ERC20_ABI, functionName: 'balanceOf', args: [ownerWallet] });
    const ownerBalAfterHuman = Number(BigInt(String(ownerBalAfter)) / 10n**18n);
    console.log(`💰 OWNER wallet DMD balance (after): ${ownerBalAfterHuman}`);

    // 5. Reset the failed DMD reward job to pending so processor picks it up
    console.log('🔄 Finding and resetting failed DMD reward job...');
    const failedJobs = await base44.asServiceRole.entities.RewardQueue.filter({
      company_id: DMD_COMPANY_ID,
      status: 'failed'
    });

    const dmdJob = failedJobs.find(j => j.customer_id === '699c105f039afa8812f58897');
    let jobReset = null;
    if (dmdJob) {
      await base44.asServiceRole.entities.RewardQueue.update(dmdJob.id, {
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        error_message: null
      });
      jobReset = { id: dmdJob.id, amount: dmdJob.amount };
      console.log(`✅ Reset job ${dmdJob.id} to pending`);
    } else {
      console.warn('⚠️ No failed DMD job found for that customer — may have already been cleaned up');
    }

    return Response.json({
      success: true,
      transfer_tx: txHash,
      explorer_url: `https://testnet.snowtrace.io/tx/${txHash}`,
      owner_balance_before: ownerBalBefore,
      owner_balance_after: ownerBalAfterHuman,
      company_wallet_balance_before: senderBalHuman,
      job_reset: jobReset,
    });

  } catch (error) {
    console.error('❌ fixDMDTreasury error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});