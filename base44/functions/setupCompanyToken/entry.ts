import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { ethers } from 'npm:ethers@6.9.0';

async function encryptPrivateKey(privateKey) {
  const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not set in environment');
  }
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encoder.encode(privateKey)
  );
  
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const encHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return ivHex + ':' + encHex;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { companyId, tokenName, tokenSymbol, totalSupply } = body;

    if (!companyId || !tokenName || !tokenSymbol || !totalSupply || totalSupply <= 0) {
      return Response.json({ error: 'Invalid inputs' }, { status: 400 });
    }

    const existingTokens = await base44.asServiceRole.entities.CompanyToken.filter({ 
      company_id: companyId 
    });
    
    if (existingTokens && existingTokens.length > 0) {
      return Response.json({ error: 'Company token already exists' }, { status: 400 });
    }

    const treasuryWallet = ethers.Wallet.createRandom();
    const encryptedKey = await encryptPrivateKey(treasuryWallet.privateKey);
    // No default contract address - each company must deploy its own token contract

    const companyToken = await base44.asServiceRole.entities.CompanyToken.create({
      company_id: companyId,
      token_name: tokenName,
      token_symbol: tokenSymbol,
      total_supply: totalSupply,
      treasury_balance: totalSupply,
      distributed_tokens: 0,
      treasury_wallet: treasuryWallet.address,
      treasury_private_key_encrypted: encryptedKey,
      contract_address: null,
      decimals: 18,
      chain: 'avalanche_fuji'
    });

    await base44.asServiceRole.entities.Company.update(companyId, {
      wallet_address: treasuryWallet.address,
      wallet_chain: 'avalanche_fuji',
      token_contract: null
    });

    await base44.asServiceRole.entities.AuditLog.create({
      company_id: companyId,
      action: 'setup_company_token',
      entity_type: 'CompanyToken',
      entity_id: companyToken.id,
      details: {
        token_name: tokenName,
        token_symbol: tokenSymbol,
        total_supply: totalSupply,
        treasury_wallet: treasuryWallet.address
      }
    });

    return Response.json({
      success: true,
      data: {
        tokenId: companyToken.id,
        tokenName,
        tokenSymbol,
        totalSupply,
        treasuryWallet: treasuryWallet.address
      }
    });

  } catch (error) {
    console.error('setupCompanyToken error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});