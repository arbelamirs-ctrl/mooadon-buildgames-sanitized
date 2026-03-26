import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { customerPhone, purchaseAmount, companyId } = await req.json();

    console.log(`Processing reward for phone: ${customerPhone}, amount: ${purchaseAmount}`);

    // Get company token treasury - SECURITY: Filter by company_id only
    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ 
      company_id: companyId 
    });

    if (!companyTokens || companyTokens.length === 0) {
      return Response.json({
        success: false,
        error: 'Company token not configured. Please setup token treasury first.'
      }, { status: 400 });
    }

    // CRITICAL SECURITY CHECK: Verify all tokens belong to correct company
    const mismatchedTokens = companyTokens.filter(t => t.company_id !== companyId);
    if (mismatchedTokens.length > 0) {
      console.error('🚫 SECURITY VIOLATION: Found tokens with mismatched company_id', {
        requested_company: companyId,
        mismatched_tokens: mismatchedTokens.map(t => ({ id: t.id, company_id: t.company_id }))
      });
      return Response.json({
        success: false,
        error: 'Security check failed: Token company mismatch detected'
      }, { status: 403 });
    }

    // Get active token with contract_address, prefer newest
    const activeTokens = companyTokens.filter(t => t.is_active !== false && t.contract_address);

    if (activeTokens.length === 0) {
      return Response.json({
        success: false,
        error: `Company token not deployed. Token ${companyTokens[0]?.token_symbol || 'unknown'} has no contract_address.`,
        action_required: 'deployCompanyToken'
      }, { status: 400 });
    }

    const companyToken = activeTokens[activeTokens.length - 1];
    console.log('📄 Using token:', companyToken.token_symbol, '| Contract:', companyToken.contract_address);

    // Calculate reward tokens: 10 tokens per 1 ILS
    const rewardTokens = Math.floor(purchaseAmount * 10);
    
    if (rewardTokens <= 0) {
      return Response.json({
        success: false,
        message: 'Purchase amount too small for rewards',
        purchaseAmount,
        rewardTokens: 0
      }, { status: 400 });
    }

    // Check treasury balance
    if (companyToken.treasury_balance < rewardTokens) {
      console.error('❌ Insufficient treasury balance:', {
        required: rewardTokens,
        available: companyToken.treasury_balance
      });
      
      await base44.asServiceRole.entities.AuditLog.create({
        company_id: companyId,
        action: 'reward_failed_insufficient_treasury',
        entity_type: 'Transaction',
        details: {
          required_tokens: rewardTokens,
          treasury_balance: companyToken.treasury_balance,
          customer_phone: customerPhone
        }
      });

      return Response.json({
        success: false,
        error: `Insufficient treasury balance. Required: ${rewardTokens}, Available: ${companyToken.treasury_balance}`
      }, { status: 400 });
    }

    // Find customer's wallet address
    const clients = await base44.asServiceRole.entities.Client.filter({
      company_id: companyId,
      phone: customerPhone
    });

    if (!clients || clients.length === 0) {
      return Response.json({ success: false, error: 'Customer not found or wallet not registered' }, { status: 404 });
    }

    const client = clients[0];
    
    if (!client.wallet_address || client.wallet_address.length !== 42 || !client.wallet_address.startsWith('0x')) {
      return Response.json({ success: false, error: `Invalid wallet address: ${client.wallet_address}` }, { status: 400 });
    }

    // Execute on-chain transfer from treasury
    console.log(`🔗 Transferring ${rewardTokens} tokens to ${client.wallet_address}`);
    const transferResult = await base44.asServiceRole.functions.invoke('transferTokensOnChain', {
      companyId,
      recipientAddress: client.wallet_address,
      amount: rewardTokens,
      reason: 'purchase_reward'
    });

    if (!transferResult.data?.success) {
      throw new Error(transferResult.data?.error || 'Failed to transfer tokens on-chain');
    }

    const { tx_hash, block_number, explorer_url } = transferResult.data;
    console.log('✅ Transfer successful:', tx_hash);

    // Create transaction record
    const transaction = await base44.asServiceRole.entities.Transaction.create({
      company_id: companyId,
      client_id: client.id,
      client_phone: customerPhone,
      amount: purchaseAmount,
      tokens_expected: rewardTokens,
      tokens_actual: rewardTokens,
      token_symbol: companyToken.token_symbol,
      status: 'completed',
      claimed_at: new Date().toISOString(),
      blockchain_tx_hash: tx_hash,
      blockchain_confirmed_at: new Date().toISOString()
    });

    // Create ledger event
    await base44.asServiceRole.entities.LedgerEvent.create({
      company_id: companyId,
      client_id: client.id,
      transaction_id: transaction.id,
      type: 'earn',
      points: rewardTokens,
      balance_before: client.current_balance || 0,
      balance_after: (client.current_balance || 0) + rewardTokens,
      source: 'treasury',
      description: `Auto reward: ${rewardTokens} tokens for ${purchaseAmount} purchase`,
      metadata: {
        blockchain: 'avalanche',
        tx_hash,
        block_number,
        explorer_url,
        purchase_amount: purchaseAmount
      }
    });

    // Calculate new level
    const newTotalEarned = (client.total_earned || 0) + rewardTokens;
    let newLevel = 'Bronze';
    if (newTotalEarned >= 10001) newLevel = 'Gold';
    else if (newTotalEarned >= 1001) newLevel = 'Silver';

    // Update client balance
    await base44.asServiceRole.entities.Client.update(client.id, {
      current_balance: (client.current_balance || 0) + rewardTokens,
      total_earned: newTotalEarned,
      level: newLevel,
      onchain_balance: (client.onchain_balance || 0) + rewardTokens,
      last_sync: new Date().toISOString(),
      last_activity: new Date().toISOString()
    });

    // Send WhatsApp notification
    let messageSent = false;
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    const company = companies?.[0];

    if (company?.twilio_account_sid && company?.twilio_auth_token && company?.twilio_phone_number) {
      try {
        const message = `🎉 You received ${rewardTokens} tokens for a purchase of ${purchaseAmount}!\n\nTokens have been sent to your wallet.\nView transaction: ${explorer_url}`;
        
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${company.twilio_account_sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${company.twilio_account_sid}:${company.twilio_auth_token}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: `whatsapp:+${customerPhone.replace(/^\+/, '')}`,
              From: `whatsapp:+14155238886`,
              Body: message
            })
          }
        );

        const smsStatus = twilioResponse.ok ? 'sent' : 'failed';
        const errorText = twilioResponse.ok ? null : await twilioResponse.text();
        if (errorText) console.error('Twilio error:', errorText);

        await base44.asServiceRole.entities.SMSLog.create({
          company_id: companyId,
          client_id: client.id,
          client_phone: customerPhone,
          transaction_id: transaction.id,
          message_type: 'points_earned',
          message_content: message,
          status: smsStatus,
          sent_at: new Date().toISOString(),
          error_message: errorText
        });

        messageSent = twilioResponse.ok;
      } catch (smsError) {
        console.error('Failed to send notification:', smsError.message);
      }
    }

    return Response.json({
      success: true,
      message: 'Reward tokens sent successfully',
      data: {
        customerPhone,
        purchaseAmount,
        rewardTokens,
        transactionHash: tx_hash,
        blockNumber: block_number,
        explorerUrl: explorer_url,
        walletAddress: client.wallet_address,
        notificationSent: messageSent
      }
    });

  } catch (error) {
    console.error('Error in sendRewardTokens:', error.message);
    return Response.json({ success: false, error: `Failed to send reward tokens: ${error.message}` }, { status: 500 });
  }
});