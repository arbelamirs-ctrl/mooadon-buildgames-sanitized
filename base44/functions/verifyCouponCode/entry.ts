import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
    
    const { code } = await req.json();
    
    if (!code) {
      return Response.json({ error: 'code required' }, { status: 400 });
    }

    // Find campaign by coupon code (variant A or B)
    let campaigns = await base44.asServiceRole.entities.CouponCampaign.filter({ coupon_code: code });
    let variant = 'a';
    
    if (!campaigns.length) {
      campaigns = await base44.asServiceRole.entities.CouponCampaign.filter({ coupon_code_b: code });
      variant = 'b';
    }
    
    if (!campaigns.length) {
      console.log(`[verifyCouponCode] Code not found: ${code}`);
      return Response.json({
        valid: false,
        reason: 'not_found',
        expires_at: null,
        remaining: 0
      });
    }

    const campaign = campaigns[0];
    const now = new Date();

    // Check campaign expiry
    if (campaign.expires_at && new Date(campaign.expires_at) < now) {
      console.log(`[verifyCouponCode] Campaign expired: ${code}`);
      return Response.json({
        valid: false,
        reason: 'expired',
        expires_at: campaign.expires_at,
        remaining: 0
      });
    }

    // Check campaign status
    if (campaign.status && campaign.status !== 'published') {
      console.log(`[verifyCouponCode] Campaign not published: ${code}`);
      return Response.json({
        valid: false,
        reason: 'disabled',
        expires_at: campaign.expires_at,
        remaining: 0
      });
    }

    // Try to find a Coupon record (if tracked separately)
    const coupons = await base44.asServiceRole.entities.Coupon.filter({
      company_id: campaign.company_id,
      coupon_code: code
    });

    let coupon = coupons.length > 0 ? coupons[0] : null;

    // If no explicit Coupon record, still allow if campaign is valid
    // (backward compat: some systems may only track via CouponCampaign)
    
    if (coupon) {
      // Check Coupon status
      if (coupon.status !== 'active') {
        console.log(`[verifyCouponCode] Coupon not active: ${code}`);
        return Response.json({
          valid: false,
          reason: 'disabled',
          expires_at: campaign.expires_at,
          remaining: 0
        });
      }

      // Check max_uses
      if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
        console.log(`[verifyCouponCode] Max uses exceeded: ${code}`);
        return Response.json({
          valid: false,
          reason: 'maxed_out',
          expires_at: campaign.expires_at,
          remaining: 0
        });
      }
    }

    // All checks passed
    const remaining = coupon ? Math.max(0, (coupon.max_uses || 1) - (coupon.times_used || 0)) : 999;

    console.log(`[verifyCouponCode] ✅ Valid coupon verified`);

    return Response.json({
      valid: true,
      reason: 'active',
      variant,
      expires_at: campaign.expires_at,
      remaining,
      discount_percent: campaign.discount_percent || 0,
      discount_amount: campaign.discount_amount || 0
    });

  } catch (error) {
    console.error('[verifyCouponCode] ERROR:', error.message);
    return Response.json({ 
      error: 'Internal server error',
      valid: false
    }, { status: 500 });
  }
});