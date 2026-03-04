import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      companyId,
      companyName,
      tokenName,
      tokenSymbol,
      // Role selection from onboarding step 1
      userRole,       // 'owner' | 'manager' | 'employee'
      ownerEmail,     // only present when userRole !== 'owner'
      ownerName,      // only present when userRole !== 'owner'
    } = body;

    if (!companyId) {
      return Response.json({ error: 'Company ID required' }, { status: 400 });
    }

    console.log('Registering company:', companyId, companyName, '| userRole:', userRole);

    // ── Mark setup as in-progress ───────────────────────────────────────────
    await base44.asServiceRole.entities.Company.update(companyId, {
      setup_status: 'pending',
      setup_started_at: new Date().toISOString(),
      setup_last_error: null
    });

    // ── Step 1: Verify company exists ───────────────────────────────────────
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    if (companies.length === 0) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }
    const company = companies[0];

    // ── Step 1b: Assign sequential client_number if not already set ─────────
    if (!company.client_number) {
      const allCompanies = await base44.asServiceRole.entities.Company.list('-created_date', 1000);
      const existingNumbers = allCompanies
        .map(c => c.client_number)
        .filter(n => n && n.startsWith('CUST-'))
        .map(n => parseInt(n.replace('CUST-', ''), 10))
        .filter(n => !isNaN(n));
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const clientNumber = `CUST-${String(nextNumber).padStart(6, '0')}`;
      await base44.asServiceRole.entities.Company.update(companyId, { client_number: clientNumber });
      console.log('Assigned client_number:', clientNumber);
    }

    // ── Step 2: Configure Twilio (use platform creds if no custom ones) ─────
    // The shared platform number is always +16812498172
    const PLATFORM_TWILIO_PHONE = '+16812498172';
    let twilioConfigured = false;
    if (!company.twilio_account_sid) {
      const platformSid   = Deno.env.get('TWILIO_ACCOUNT_SID');
      const platformToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const platformWA    = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
      if (platformSid && platformToken) {
        await base44.asServiceRole.entities.Company.update(companyId, {
          twilio_account_sid:    platformSid,
          twilio_auth_token:     platformToken,
          twilio_phone_number:   PLATFORM_TWILIO_PHONE,
          whatsapp_phone_number: platformWA || ''
        });
        console.log('Step 2 DONE - Platform Twilio configured. Phone:', PLATFORM_TWILIO_PHONE);
        twilioConfigured = true;
      } else {
        // Even without full Twilio creds, always stamp the platform phone number
        await base44.asServiceRole.entities.Company.update(companyId, {
          twilio_phone_number: PLATFORM_TWILIO_PHONE
        });
        console.log('Step 2 - No Twilio SID/token in env, but stamped platform phone:', PLATFORM_TWILIO_PHONE);
      }
    } else {
      // Company has their own Twilio — still ensure platform phone is stored as fallback
      await base44.asServiceRole.entities.Company.update(companyId, {
        twilio_phone_number: company.twilio_phone_number || PLATFORM_TWILIO_PHONE
      });
      console.log('Step 2 - Company has own Twilio. Phone:', company.twilio_phone_number || PLATFORM_TWILIO_PHONE);
      twilioConfigured = true;
    }

    // ── Step 3: Update auth user with company association ───────────────────
    try {
      await base44.auth.updateMe({ company_id: companyId, user_role: 'company_admin' });
    } catch (e) {
      console.warn('User profile update failed (non-critical):', e.message);
    }

    // ── Step 4: Blockchain (all non-blocking) ───────────────────────────────
    const refreshedCompany = (await base44.asServiceRole.entities.Company.filter({ id: companyId }))[0];
    let blockchainWarning = null;

    // base44.asServiceRole.functions.invoke handles auth automatically — no manual headers needed

    // 4.1 Create wallet — retry x3
    if (!refreshedCompany.blockchain_wallet_address) {
      let walletCreated = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const r = await base44.asServiceRole.functions.invoke('createCompanyWallet', { companyId });
          if (r.data?.error) throw new Error(r.data.error);
          if (!r.data?.wallet_address && !r.data?.address) throw new Error('No wallet address returned');
          console.log(`Step 4.1 DONE (attempt ${attempt}) - Wallet:`, r.data.wallet_address || r.data.address);
          walletCreated = true;
          break;
        } catch (e) {
          console.warn(`Step 4.1 attempt ${attempt}/3 failed:`, e.message);
          if (attempt < 3) await new Promise(res => setTimeout(res, 1000 * attempt));
        }
      }
      if (!walletCreated) {
        const errMsg = 'Wallet creation failed after 3 attempts';
        await base44.asServiceRole.entities.Company.update(companyId, {
          setup_status: 'error',
          setup_last_error: errMsg,
          onboarding_completed: false
        });
        // Return early — cannot proceed without a wallet
        return Response.json({
          success: false,
          error: errMsg,
          companyId,
          blockchain_warning: errMsg
        });
      }
    }

    // Re-fetch company to get wallet address for token generation
    const companyAfterWallet = (await base44.asServiceRole.entities.Company.filter({ id: companyId }))[0];

    // 4.2 Generate tokens
    const existingTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: companyId });
    if (existingTokens.length === 0) {
      try {
        const resolvedName   = tokenName   || `${companyName} Token`;
        const resolvedSymbol = tokenSymbol || companyName.substring(0, 4).toUpperCase();
        const r = await base44.asServiceRole.functions.invoke('generateCompanyTokens', {
          company_id: companyId, tokenName: resolvedName, tokenSymbol: resolvedSymbol, initialSupply: '1000000'
        });
        if (r.data?.error) throw new Error(r.data.error);
        console.log('Step 4.2 DONE - Tokens generated:', resolvedSymbol);
      } catch (e) {
        const errMsg = `Token generation failed: ${e.message}`;
        console.warn('Step 4.2 FAIL - Token generation failed:', e.message);
        await base44.asServiceRole.entities.Company.update(companyId, {
          setup_status: 'error',
          setup_last_error: errMsg,
          onboarding_completed: false
        });
        return Response.json({
          success: false,
          error: errMsg,
          companyId,
          blockchain_warning: errMsg
        });
      }
    }

    // 4.3 Fund treasury
    const existingTransfers = await base44.asServiceRole.entities.BlockchainTransfer.filter({ company_id: companyId });
    let fundingFailed = false;
    if (!existingTransfers.some(t => t.status === 'confirmed' || t.status === 'success') && companyAfterWallet?.blockchain_wallet_address) {
      try {
        const r = await base44.asServiceRole.functions.invoke('fundNewCompanyTreasury', {
          company_id: companyId, avax_amount: 1.0
        });
        if (!r.data?.success) throw new Error(r.data?.error || 'Treasury funding returned no success');
        console.log('Step 4.3 DONE - Treasury funded');
      } catch (e) {
        console.warn('Step 4.3 WARN - Treasury funding failed:', e.message);
        blockchainWarning = `Gas funding failed: ${e.message}`;
        fundingFailed = true;
        await base44.asServiceRole.entities.Company.update(companyId, {
          setup_status: 'ready_partial',
          setup_last_error: blockchainWarning,
          gas_wallet_funded: false,
          onboarding_completed: false
        });
      }
    } else if (!companyAfterWallet?.blockchain_wallet_address) {
      console.warn('Step 4.3 SKIP - No wallet address, skipping treasury funding');
    }

    // ── FINALIZE: only mark completed if all 3 steps succeeded ──
    if (!fundingFailed) {
      await base44.asServiceRole.entities.Company.update(companyId, {
        setup_status: 'ready',
        setup_completed_at: new Date().toISOString(),
        onboarding_completed: true,
        blockchain_setup_complete: true,
        gas_wallet_funded: true
      });
    }

    console.log('ALL STEPS DONE - Company registered:', companyName);

    // ── Step 5: Send welcome email ──────────────────────────────────────────
    // If current user is NOT the owner, send email to the actual owner.
    // Otherwise send to the logged-in user.
    try {
      const isSetupOnBehalfOfOwner =
        userRole && userRole !== 'owner' &&
        typeof ownerEmail === 'string' && ownerEmail.includes('@');

      const toEmail      = isSetupOnBehalfOfOwner ? ownerEmail    : user.email;
      const toName       = isSetupOnBehalfOfOwner ? (ownerName || 'Business Owner') : (user.full_name || user.email);
      const inviterLabel = isSetupOnBehalfOfOwner ? (user.full_name || user.email) : null;

      const subject = isSetupOnBehalfOfOwner
        ? `Your loyalty program on Mooadon is ready — ${companyName} 🎉`
        : `Welcome to Mooadon — ${companyName} is live! 🎉`;

      const introParagraph = isSetupOnBehalfOfOwner
        ? `<strong>${inviterLabel}</strong> completed the Mooadon setup for your business, <strong>${companyName}</strong>. Your loyalty program is live and ready to use.`
        : `Your business <strong>${companyName}</strong> has been successfully set up on Mooadon. Your loyalty program is live.`;

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background-color: #f5f5f5;">

          <div style="background: linear-gradient(135deg, #14b8a6 0%, #0891b2 100%); color: white; padding: 32px 28px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0 0 8px; font-size: 26px;">🎉 Welcome to Mooadon!</h1>
            <p style="margin: 0; font-size: 15px; opacity: 0.9;">${companyName} is now live</p>
          </div>

          <div style="background-color: white; padding: 28px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
            <h2 style="color: #0f766e; margin-top: 0; font-size: 20px;">Hi ${toName},</h2>
            <p style="font-size: 15px; line-height: 1.65; color: #374151; margin: 0 0 16px;">
              ${introParagraph}
            </p>

            <div style="background-color: #ecfeff; border-left: 4px solid #0891b2; padding: 16px 20px; margin: 20px 0; border-radius: 8px;">
              <p style="margin: 0 0 6px; font-size: 14px; font-weight: 600; color: #155e75;">Account details</p>
              <p style="margin: 4px 0; font-size: 14px; color: #1e3a5f;"><strong>Business:</strong> ${companyName}</p>
              <p style="margin: 4px 0; font-size: 14px; color: #1e3a5f;"><strong>Login email:</strong> ${toEmail}</p>
            </div>

            <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 8px;"><strong>Next steps:</strong></p>
            <ol style="margin: 0 0 20px; padding-left: 20px; font-size: 14px; color: #374151; line-height: 1.8;">
              <li>Log in to Mooadon using <strong>${toEmail}</strong>.</li>
              <li>Review your reward program settings (points, welcome bonus, token name).</li>
              <li>Connect your POS or share your reward link with customers to start issuing rewards.</li>
            </ol>

            <div style="text-align: center; margin-top: 24px;">
              <a href="https://mooadon.base44.app"
                 style="display: inline-block; background: linear-gradient(135deg, #14b8a6, #0891b2); color: white; padding: 13px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; letter-spacing: 0.2px;">
                Open Mooadon Dashboard
              </a>
            </div>
          </div>

          <div style="text-align: center; margin-top: 18px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">© 2026 Mooadon — Rewards. Verified.</p>
          </div>
        </div>
      `;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: toEmail,
        subject,
        body: emailBody
      });

      console.log('Welcome email sent to:', toEmail);
    } catch (emailError) {
      console.error('Welcome email failed (non-critical):', emailError.message);
    }

    return Response.json({
      success: true,
      message: `Company ${companyName} registered successfully`,
      companyId,
      twilioConfigured,
      blockchain_warning: blockchainWarning || null
    });

  } catch (error) {
    console.error('Registration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});