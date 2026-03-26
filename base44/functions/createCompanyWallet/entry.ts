import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.9.0';

/**
 * createCompanyWallet - Creates a custodial wallet for a company on Avalanche
 * Security: AES-256-GCM encryption, mandatory auth, ownership checks, audit log
 */

// AES-256-GCM encryption using SHA-256 derived key, 12-byte random IV
// Format: base64(iv):base64(ciphertext+authTag)
async function encryptAESGCM(plaintext, encryptionKey) {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('WALLET_ENCRYPTION_KEY must be at least 32 characters');
  }
  const encoder = new TextEncoder();
  // Derive a 256-bit key via SHA-256 of the raw key string
  const rawKey = encoder.encode(encryptionKey);
  const keyHash = await crypto.subtle.digest('SHA-256', rawKey);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, keyMaterial, encoder.encode(plaintext)
  );
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  return `${ivB64}:${ctB64}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: require authenticated user OR valid X-Service-Token
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_) {
      // not authenticated via session
    }

    if (!user) {
      const serviceToken = req.headers.get('X-Service-Token');
      const internalToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
      if (!internalToken || serviceToken !== internalToken) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { companyId } = body;

    if (!companyId) {
      return Response.json({ error: 'companyId is required' }, { status: 400 });
    }

    // Hard fail if encryption key is missing or too short
    const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY');
    if (!encryptionKey || encryptionKey.length < 32) {
      return Response.json({ error: 'Server misconfiguration: encryption key invalid' }, { status: 500 });
    }

    // Get company
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    if (companies.length === 0) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];

    // Ownership check for non-service-token requests
    if (user) {
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      const isOwner = company.created_by === user.email;
      if (!isAdmin && !isOwner) {
        // Audit denied attempt
        await base44.asServiceRole.entities.AuditLog.create({
          company_id: companyId,
          action: 'company_wallet_create_denied',
          entity_type: 'Company',
          entity_id: companyId,
          performed_by: user.email,
          details: { reason: 'not_owner_or_admin', user_email: user.email }
        }).catch(() => {});
        return Response.json({ error: 'Forbidden: must be company owner or admin' }, { status: 403 });
      }
    }

    // Check if company already has a wallet
    if (company.blockchain_wallet_address) {
      return Response.json({
        success: true,
        message: 'Company already has a wallet',
        walletAddress: company.blockchain_wallet_address,
        chain: 'avalanche_fuji'
      });
    }

    // Generate new wallet
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    // Encrypt private key using AES-256-GCM
    const encryptedPrivateKey = await encryptAESGCM(privateKey, encryptionKey);

    // Update company with wallet information
    await base44.asServiceRole.entities.Company.update(companyId, {
      blockchain_wallet_address: walletAddress,
      blockchain_private_key_encrypted: encryptedPrivateKey,
      wallet_chain: 'avalanche_fuji',
      wallet_address: walletAddress
    });

    // Audit log - always
    await base44.asServiceRole.entities.AuditLog.create({
      company_id: companyId,
      action: 'company_wallet_created',
      entity_type: 'Company',
      entity_id: companyId,
      performed_by: user ? user.email : 'service_token',
      details: {
        wallet_address: walletAddress,
        chain: 'avalanche_fuji',
        timestamp: new Date().toISOString()
      }
    }).catch(() => {});

    return Response.json({
      success: true,
      message: 'Company wallet created successfully',
      wallet_address: walletAddress,
      address: walletAddress,
      walletAddress,
      chain: 'avalanche_fuji',
      explorerUrl: `https://testnet.snowtrace.io/address/${walletAddress}`
    });

  } catch (error) {
    console.error('❌ Error creating company wallet:', error.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});