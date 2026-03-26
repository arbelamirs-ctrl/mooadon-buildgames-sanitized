import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * executeRedeemVerification — Step 2 of the Verified Redemption flow.
 * Applies all 5 business rules and writes the final result.
 *
 * CRE-ready: returns a deterministic JSON response that CRE nodes
 * can reach consensus on, then write to Avalanche Fuji as on-chain proof.
 *
 * POST body: { verification_id }
 * Returns (deterministic, CRE-consensus-ready):
 *   { verified, reason_code, timestamp, proof_hash, on_chain_payload }
 */

async function buildProofHash(payload) {
  // Real SHA-256 via Web Crypto API
  const data = JSON.stringify(payload, Object.keys(payload).sort());
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function rejectVerification(base44, v, reason_code, errorMsg, timestamp) {
  const ts = timestamp || Date.now();
  const proof_hash = await buildProofHash({
    verification_id: v.id,
    verified: false,
    reason_code,
    timestamp: ts
  });

  await base44.asServiceRole.entities.RedeemVerification.update(v.id, {
    status: 'rejected',
    reason_code,
    verified_at: new Date(ts).toISOString(),
    proof_hash
  }).catch(() => {});

  await base44.asServiceRole.entities.AuditLog.create({
    company_id: v.company_id,
    action: 'redeem_verification_rejected',
    entity_type: 'RedeemVerification',
    entity_id: v.id,
    details: { reason_code }
  }).catch(() => {});

  // 200 intentional — CRE expects 200 for consensus on both verified/rejected
  return Response.json({
    verified: false,
    reason_code,
    timestamp: ts,
    proof_hash,
    success: false,
    verification_id: v.id,
    cre_ready: true,
    on_chain_payload: {
      function: 'recordVerification',
      args: [v.id, v.company_id, false, reason_code, ts, proof_hash]
    }
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: service token OR admin user
    const serviceToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const authHeader = req.headers.get('authorization') || '';
    const isServiceCall = serviceToken && authHeader === `Bearer ${serviceToken}`;

    if (!isServiceCall) {
      try {
        const user = await base44.auth.me();
        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
      } catch {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { verification_id } = await req.json();

    if (!verification_id) {
      return Response.json({ error: 'Missing verification_id' }, { status: 400 });
    }

    const verifications = await base44.asServiceRole.entities.RedeemVerification.filter({ id: verification_id });
    if (!verifications.length) {
      return Response.json({ error: 'Verification record not found' }, { status: 404 });
    }
    const v = verifications[0];

    if (v.status !== 'pending') {
      return Response.json({
        success: false,
        error: 'Already processed',
        verification_id,
        status: v.status,
        reason_code: v.reason_code
      }, { status: 409 });
    }

    const [coupons, companies] = await Promise.all([
      base44.asServiceRole.entities.CouponCampaign.filter({ id: v.coupon_id }),
      base44.asServiceRole.entities.Company.filter({ id: v.company_id })
    ]);

    if (!coupons.length) return rejectVerification(base44, v, 'coupon_not_found', 'Coupon not found');
    if (!companies.length) return rejectVerification(base44, v, 'company_not_found', 'Company not found');

    const coupon = coupons[0];
    const company = companies[0];
    const timestamp = Date.now();

    // RULE 1: Expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return rejectVerification(base44, v, 'expired', 'Coupon expired', timestamp);
    }

    // RULE 2: Max redemptions
    if (coupon.max_redemptions) {
      const used = await base44.asServiceRole.entities.RedeemVerification.filter({
        coupon_id: v.coupon_id,
        status: 'verified'
      });
      if (used.length >= coupon.max_redemptions) {
        return rejectVerification(base44, v, 'max_redemptions_reached', 'Max reached', timestamp);
      }
    }

    // RULE 3: Duplicate receipt
    const dupReceipt = await base44.asServiceRole.entities.RedeemVerification.filter({
      company_id: v.company_id,
      receipt_id: v.receipt_id,
      status: 'verified'
    });
    if (dupReceipt.length > 0) {
      return rejectVerification(base44, v, 'duplicate_receipt', 'Duplicate receipt', timestamp);
    }

    // RULE 4: Min purchase amount
    const minAmount = coupon.min_purchase_amount || 0;
    const receiptAmount = v.metadata?.receipt_amount || null;
    if (minAmount > 0 && receiptAmount !== null && receiptAmount < minAmount) {
      return rejectVerification(base44, v, 'min_amount_not_met', 'Min amount not met', timestamp);
    }

    // RULE 5: Branch restriction
    if (coupon.allowed_branch_ids?.length > 0 && v.branch_id) {
      if (!coupon.allowed_branch_ids.includes(v.branch_id)) {
        return rejectVerification(base44, v, 'wrong_branch', 'Invalid branch', timestamp);
      }
    }

    // === ALL RULES PASSED → VERIFIED ===
    const proof_hash = await buildProofHash({
      verification_id: v.id,
      verified: true,
      reason_code: 'verified',
      timestamp
    });

    await Promise.all([
      base44.asServiceRole.entities.RedeemVerification.update(v.id, {
        status: 'verified',
        reason_code: 'verified',
        verified_at: new Date(timestamp).toISOString(),
        proof_hash,
        source: v.source || 'internal'
      }),
      base44.asServiceRole.entities.CouponCampaign.update(coupon.id, {
        redemptions: (coupon.redemptions || 0) + 1
      }).catch(() => {}),
      base44.asServiceRole.entities.AuditLog.create({
        company_id: v.company_id,
        action: 'redeem_verification_approved',
        entity_type: 'RedeemVerification',
        entity_id: v.id,
        details: { proof_hash }
      }).catch(() => {})
    ]);

    console.log(`[executeRedeemVerification] VERIFIED id:${v.id} hash:${proof_hash.substring(0, 14)}...`);

    return Response.json({
      verified: true,
      reason_code: 'verified',
      timestamp,
      proof_hash,
      success: true,
      verification_id: v.id,
      cre_ready: true,
      on_chain_payload: {
        function: 'recordVerification',
        args: [v.id, v.company_id, true, 'verified', timestamp, proof_hash]
      }
    });

  } catch (error) {
    console.error('[executeRedeemVerification] error:', error.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});