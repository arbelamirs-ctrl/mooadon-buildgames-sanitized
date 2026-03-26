import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * requestRedeemVerification — Step 1 of Verified Redemption flow.
 * Creates a pending RedeemVerification record.
 * CRE Trigger-ready: can be called by Chainlink CRE as the entry point.
 *
 * POST body: { company_id, coupon_code, receipt_id, branch_id? }
 * Returns: { verification_id, status: "pending" }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { company_id, coupon_code, receipt_id, branch_id } = await req.json();

    if (!company_id || !coupon_code || !receipt_id) {
      return Response.json(
        { error: 'Missing required fields: company_id, coupon_code, receipt_id' },
        { status: 400 }
      );
    }

    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies.length) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];

    if (company.status === 'suspended') {
      return Response.json({ error: 'Company account is suspended' }, { status: 403 });
    }

    // Validate coupon (variant A or B)
    let coupon = null;
    const couponsA = await base44.asServiceRole.entities.CouponCampaign.filter({ coupon_code, company_id });
    coupon = couponsA[0];
    if (!coupon) {
      const couponsB = await base44.asServiceRole.entities.CouponCampaign.filter({ coupon_code_b: coupon_code, company_id });
      coupon = couponsB[0];
    }

    if (!coupon) {
      return Response.json(
        { error: 'Coupon not found or does not belong to this company', reason_code: 'coupon_not_found' },
        { status: 404 }
      );
    }

    if (coupon.status && coupon.status !== 'active' && coupon.status !== 'published') {
      return Response.json(
        { error: 'Coupon is not active', reason_code: 'coupon_inactive' },
        { status: 400 }
      );
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return Response.json(
        { error: 'Coupon has expired', reason_code: 'expired' },
        { status: 400 }
      );
    }

    // Prevent duplicate receipt_id for already-verified redemptions
    const existingVerifications = await base44.asServiceRole.entities.RedeemVerification.filter({
      company_id,
      receipt_id,
      status: 'verified'
    });

    if (existingVerifications.length > 0) {
      return Response.json(
        { error: 'This receipt has already been used for a verified redemption', reason_code: 'duplicate_receipt' },
        { status: 409 }
      );
    }

    const verification = await base44.asServiceRole.entities.RedeemVerification.create({
      company_id,
      branch_id: branch_id || null,
      coupon_id: coupon.id,
      coupon_code,
      receipt_id,
      status: 'pending',
      source: 'internal',
      metadata: {
        coupon_name: coupon.product_name || coupon_code,
        company_name: company.name,
        request_timestamp: Date.now()
      }
    });

    await base44.asServiceRole.entities.AuditLog.create({
      company_id,
      action: 'redeem_verification_requested',
      entity_type: 'RedeemVerification',
      entity_id: verification.id,
      details: { coupon_code, receipt_id, branch_id }
    }).catch(() => {});

    console.log(`[requestRedeemVerification] created verification:${verification.id} coupon:${coupon_code} company:${company_id}`);

    return Response.json({
      success: true,
      verification_id: verification.id,
      status: 'pending',
      coupon_id: coupon.id,
      message: 'Verification created. Call creVerifiedRedemptionWorkflow to process.'
    });

  } catch (error) {
    console.error('[requestRedeemVerification] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});