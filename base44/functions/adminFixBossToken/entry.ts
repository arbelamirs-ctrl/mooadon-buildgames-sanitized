/**
 * adminFixBossToken.js
 * 1. Fix BOSS CompanyToken: set is_primary=true, fix token_name double-space
 * 2. Diagnose the shared wallet bug (0xA527F59fb4f50Fe3f6c07A49B38f9B3e38052583)
 * 3. Generate fresh unique wallets for all clients sharing that address
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { generatePrivateKey, privateKeyToAddress } from 'npm:viem@2.7.0/accounts';

const SHARED_WALLET = '0xA527F59fb4f50Fe3f6c07A49B38f9B3e38052583';
const BOSS_TOKEN_ID = '6995aa8967ceff25fd3cba59';

async function encryptPrivateKey(privateKey) {
  const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY');
  if (!encryptionKey) throw new Error('WALLET_ENCRYPTION_KEY not configured');
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
    'AES-GCM', false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyMaterial, encoder.encode(privateKey));
  return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, dry_run } = body;
    const dryRun = dry_run !== false; // default safe = dry_run

    const results = {};

    // ── ACTION 1: Fix BOSS token record ─────────────────────────────────────
    if (!action || action === 'fix-boss-token') {
      console.log('Fixing BOSS token record...');
      if (!dryRun) {
        await base44.asServiceRole.entities.CompanyToken.update(BOSS_TOKEN_ID, {
          is_primary: true,
          token_name: 'Boss Token',
        });
        console.log('✅ BOSS token updated: is_primary=true, name fixed');
      }
      results['boss_token'] = {
        dry_run: dryRun,
        action: 'set is_primary=true, fix name "Boss  Token" -> "Boss Token"',
        token_id: BOSS_TOKEN_ID,
      };
    }

    // ── ACTION 2: Diagnose shared wallet ────────────────────────────────────
    if (!action || action === 'diagnose-shared-wallet') {
      console.log(`Finding all clients with shared wallet ${SHARED_WALLET}...`);
      const clients = await base44.asServiceRole.entities.Client.filter({
        wallet_address: SHARED_WALLET
      });
      console.log(`Found ${clients.length} clients sharing the wallet`);
      results['shared_wallet_diagnosis'] = {
        shared_address: SHARED_WALLET,
        affected_clients: clients.map(c => ({
          id: c.id,
          phone: c.phone,
          company_id: c.company_id,
          full_name: c.full_name,
          current_balance: c.current_balance,
          onchain_balance: c.onchain_balance,
          has_encrypted_key: !!c.encryptedPrivateKey,
        })),
        total: clients.length,
      };
    }

    // ── ACTION 3: Fix shared wallets — generate unique wallet per client ─────
    if (action === 'fix-shared-wallets') {
      console.log(`Generating fresh wallets for all clients with ${SHARED_WALLET}...`);
      const clients = await base44.asServiceRole.entities.Client.filter({
        wallet_address: SHARED_WALLET
      });

      const fixed = [];
      const skipped = [];

      for (const client of clients) {
        // Skip the "original" client that owns this wallet (the one with encryptedPrivateKey that decrypts to this address)
        // We keep the one with the highest onchain_balance as the true owner
        // For now, generate new wallets for ALL of them — the treasury wallet holds all tokens anyway
        if (dryRun) {
          fixed.push({ id: client.id, company_id: client.company_id, phone: client.phone, action: 'would_generate_new_wallet' });
          continue;
        }

        const newPrivKey = generatePrivateKey();
        const newAddress = privateKeyToAddress(newPrivKey);
        const encryptedKey = await encryptPrivateKey(newPrivKey);

        await base44.asServiceRole.entities.Client.update(client.id, {
          wallet_address: newAddress,
          hasWallet: true,
          encryptedPrivateKey: encryptedKey,
          wallet_chain: 'avalanche_fuji',
        });

        console.log(`✅ Client ${client.id} (${client.phone} / ${client.company_id}): new wallet ${newAddress}`);
        fixed.push({
          id: client.id,
          company_id: client.company_id,
          phone: client.phone,
          new_address: newAddress,
        });
      }

      results['fix_shared_wallets'] = {
        dry_run: dryRun,
        total_affected: clients.length,
        fixed,
        skipped,
      };
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error('adminFixBossToken error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});