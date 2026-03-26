/**
 * posQuote.ts — Preview reward before committing a transaction
 *
 * Returns: what the customer will receive (tokens/points/coupon) + coupon validity
 * Does NOT write to DB, does NOT issue tokens.
 *
 * Usage (POS UI):
 *   Step 1: POST /functions/posQuote → show preview card to cashier
 *   Step 2: Cashier confirms → POST /functions/posWebhook (actual commit)
 *
 * Inputs:
 *   company_id       string  required
 *   amount           number  required  — transaction amount
 *   customer_phone   string  optional  — to check existing balance + active coupons
 *   coupon_code      string  optional  — to validate redemption before committing
 *   currency         string  optional  default: ILS
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const {
      company_id,
      amount,
      customer_phone,
      coupon_code,
      currency = 'ILS',
    } = body;

    // ── Validate ─────────────────────────────────────────────────────────────
    if (!company_id || !amount || amount <= 0) {
      return Response.json(
        { error: 'Missing required fields: company_id, amount' },
        { status: 400 }
      );
    }

    // ── Load company config ───────────────────────────────────────────────────
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies.length) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];

    const rewardRate  = company.reward_rate  ?? 0.05;   // e.g. 5% of amount
    const tokenSymbol = company.token_symbol ?? 'PTS';
    const rewardType  = company.reward_type  ?? 'token'; // token | points | coupon

    // ── Calculate reward preview ──────────────────────────────────────────────
    const rewardAmount = parseFloat((amount * rewardRate).toFixed(4));

    const quote = {
      company_id,
      amount,
      currency,
      reward_type:      rewardType,
      reward_amount:    rewardAmount,
      reward_symbol:    tokenSymbol,
      reward_rate_pct:  Math.round(rewardRate * 100),
      display_label:    `${rewardAmount} ${tokenSymbol}`,
      quoted_at:        new Date().toISOString(),
      valid_for_seconds: 120, // cashier has 2 minutes to confirm
    };

    // ── Customer context (if phone provided) ──────────────────────────────────
    let customer_context = null;
    if (customer_phone) {
      const clients = await base44.asServiceRole.entities.Client.filter({
        company_id,
        phone: customer_phone,
      });

      if (clients.length > 0) {
        const client = clients[0];
        customer_context = {
          found:           true,
          name:            client.full_name || null,
          current_balance: client.token_balance ?? 0,
          balance_after:   parseFloat(((client.token_balance ?? 0) + rewardAmount).toFixed(4)),
          is_new_customer: false,
        };
      } else {
        customer_context = {
          found:           false,
          is_new_customer: true,
          current_balance: 0,
          balance_after:   rewardAmount,
          note:            'New customer — wallet will be created on commit',
        };
      }
    }

    // ── Coupon validation (if code provided) ──────────────────────────────────
    let coupon_validation = null;
    if (coupon_code) {
      const now = new Date().toISOString();
      const coupons = await base44.asServiceRole.entities.Coupon.filter({
        company_id,
        coupon_code,
        status: 'active',
      });

      if (!coupons.length) {
        coupon_validation = {
          valid:   false,
          reason:  'COUPON_NOT_FOUND',
          message: 'קוד קופון לא נמצא או לא פעיל',
        };
      } else {
        const coupon = coupons[0];
        const expired   = coupon.expires_at && coupon.expires_at < now;
        const maxedOut  = coupon.max_uses &&
                          (coupon.times_used ?? 0) >= coupon.max_uses;
        const tooSmall  = coupon.min_purchase_amount && amount < coupon.min_purchase_amount;

        if (expired) {
          coupon_validation = { valid: false, reason: 'EXPIRED', message: 'הקופון פג תוקף' };
        } else if (maxedOut) {
          coupon_validation = { valid: false, reason: 'MAX_REDEMPTIONS', message: 'הקופון נוצל עד תום' };
        } else if (tooSmall) {
          coupon_validation = {
            valid:   false,
            reason:  'MIN_PURCHASE_NOT_MET',
            message: `רכישה מינימלית: ${coupon.min_purchase_amount} ${currency}`,
          };
        } else {
          const discount = coupon.discount_type === 'percentage'
            ? parseFloat((amount * (coupon.discount_value / 100)).toFixed(2))
            : coupon.discount_value ?? 0;

          coupon_validation = {
            valid:           true,
            coupon_id:       coupon.id,
            description:     coupon.product_name || 'Discount',
            discount_type:   coupon.discount_type,
            discount_value:  coupon.discount_value,
            discount_amount: discount,
            amount_after:    parseFloat((amount - discount).toFixed(2)),
            expires_at:      coupon.expires_at || null,
          };
        }
      }
    }

    // ── Response ──────────────────────────────────────────────────────────────
    return Response.json({
      success: true,
      data: {
        quote,
        customer_context,
        coupon_validation,
      },
    });

  } catch (err) {
    console.error('[posQuote] error:', err);
    return Response.json(
      { error: err.message || 'Quote failed' },
      { status: 500 }
    );
  }
});