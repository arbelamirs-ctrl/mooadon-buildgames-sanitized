/**
 * safeDeleteClient.js
 *
 * Safe client deletion with two safeguards:
 *   1. Blocks deletion if onchain_balance > 0 unless `force=true` is passed
 *   2. Archives encryptedPrivateKey (and full client snapshot) to DeletedClientKeyVault before deleting
 *
 * Usage:
 *   { client_id, force: false }         → blocked if onchain_balance > 0
 *   { client_id, force: true, reason }  → archives key vault entry, then deletes
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { client_id, force = false, reason = '' } = await req.json();
    if (!client_id) {
      return Response.json({ error: 'client_id is required' }, { status: 400 });
    }

    // Fetch client
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    if (!clients || clients.length === 0) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }
    const client = clients[0];

    // SAFEGUARD 1: Block if onchain_balance > 0 without force
    const onchainBalance = client.onchain_balance || 0;
    if (onchainBalance > 0 && !force) {
      return Response.json({
        error: 'BLOCKED: Client has onchain_balance > 0. Deleting would permanently lose their tokens.',
        onchain_balance: onchainBalance,
        wallet_address: client.wallet_address,
        hint: 'Pass force=true with a reason to confirm deletion and archive the private key.'
      }, { status: 409 });
    }

    // SAFEGUARD 2: Archive encryptedPrivateKey to vault before deleting
    if (client.encryptedPrivateKey || client.wallet_address) {
      await base44.asServiceRole.entities.DeletedClientKeyVault.create({
        original_client_id: client.id,
        company_id: client.company_id,
        phone: client.phone,
        wallet_address: client.wallet_address || null,
        onchain_balance_at_deletion: onchainBalance,
        encrypted_private_key: client.encryptedPrivateKey || null,
        deleted_by: user.email,
        deletion_reason: reason,
        client_snapshot: client
      });
      console.log(`[safeDeleteClient] 🔐 Archived key vault entry for client ${client.id} (wallet: ${client.wallet_address})`);
    }

    // Perform deletion
    await base44.asServiceRole.entities.Client.delete(client.id);
    console.log(`[safeDeleteClient] ✅ Deleted client ${client.id} by ${user.email}`);

    return Response.json({
      success: true,
      client_id: client.id,
      phone: client.phone,
      onchain_balance_at_deletion: onchainBalance,
      key_archived: !!(client.encryptedPrivateKey || client.wallet_address),
      message: `Client deleted. Private key archived to DeletedClientKeyVault.`
    });

  } catch (error) {
    console.error('[safeDeleteClient] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});