import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ethers } from 'npm:ethers@6.9.0';

const CONVERSION_RATE = 100;

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

Deno.serve(async (req) => {
  console.log('🚀 convertStarsToTokens function started');
  
  try {
    const base44 = createClientFromRequest(req);
    console.log('✅ Base44 client created');
    
    const user = await base44.auth.me();
    console.log('✅ User authenticated:', user?.email);

    if (!user) {
      console.error('❌ User not authenticated');
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ── Admin-only check ────────────────────────────────────────────────────
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      console.error('❌ User is not admin');
      return Response.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { clientId } = await req.json();
    console.log('📋 Request payload:', { clientId });

    if (!clientId) {
      console.error('❌ Missing clientId');
      return Response.json({ success: false, error: 'Missing clientId' }, { status: 400 });
    }

    // Get client
    console.log('🔍 Fetching client:', clientId);
    const client = await base44.asServiceRole.entities.Client.get(clientId);
    if (!client) {
      console.error('❌ Client not found:', clientId);
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }
    console.log('✅ Client found:', { id: client.id, balance: client.current_balance, wallet: client.wallet_address });

    // Check client has wallet
    if (!client.wallet_address) {
      console.error('❌ Client does not have wallet address');
      return Response.json({ 
        success: false, 
        error: 'Client does not have a wallet address' 
      }, { status: 400 });
    }
    console.log('✅ Client has wallet:', client.wallet_address);

    // Check client has sufficient balance
    const starsBalance = client.current_balance || 0;
    console.log('💰 Stars balance:', starsBalance);
    if (starsBalance < CONVERSION_RATE) {
      console.error(`❌ Insufficient balance: ${starsBalance} < ${CONVERSION_RATE}`);
      return Response.json({ 
        success: false, 
        error: `Insufficient Stars balance. Need at least ${CONVERSION_RATE} Stars` 
      }, { status: 400 });
    }

    // Get company token
    console.log('🔍 Fetching company token for company:', client.company_id);
    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ 
      company_id: client.company_id 
    });
    
    if (!companyTokens || companyTokens.length === 0) {
      console.error('❌ Company token not configured for company:', client.company_id);
      return Response.json({
        success: false,
        error: 'Company token not configured'
      }, { status: 400 });
    }
    
    // FIX: prefer active token with contract_address, newest first
    const _activeToks = companyTokens.filter(t => t.is_active !== false && t.contract_address);
    const companyToken = _activeToks.length > 0
      ? _activeToks[_activeToks.length - 1]
      : companyTokens[companyTokens.length - 1];
    console.log('✅ Company token found:', {
      contract: companyToken.contract_address,
      chain: companyToken.chain,
      treasury_balance: companyToken.treasury_balance
    });

    // Calculate conversion
    const starsToConvert = Math.floor(starsBalance / CONVERSION_RATE) * CONVERSION_RATE;
    const tokensToReceive = starsToConvert / CONVERSION_RATE;

    // Check treasury balance
    console.log('💰 Treasury check:', { required: tokensToReceive, available: companyToken.treasury_balance });
    if (companyToken.treasury_balance < tokensToReceive) {
      console.error(`❌ Insufficient treasury: ${companyToken.treasury_balance} < ${tokensToReceive}`);
      return Response.json({
        success: false,
        error: `Insufficient treasury balance. Required: ${tokensToReceive}, Available: ${companyToken.treasury_balance}`
      }, { status: 400 });
    }

    console.log('💫 Conversion details:', {
      clientId,
      wallet: client.wallet_address,
      starsBalance,
      starsToConvert,
      tokensToReceive,
      treasuryBalance: companyToken.treasury_balance,
      contractAddress: companyToken.contract_address
    });

    // Get RPC URL based on chain
    const rpcUrl = companyToken.chain === 'avalanche_fuji' 
      ? 'https://api.avax-test.network/ext/bc/C/rpc'
      : 'https://api.avax.network/ext/bc/C/rpc';
    console.log('🌐 RPC URL:', rpcUrl);

    // Setup blockchain connection
    console.log('🔐 Setting up blockchain connection...');
    let receipt;
    let txHash;
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log('✅ Provider created');

      // Test RPC connection
      const network = await provider.getNetwork();
      console.log('✅ Network connected:', { chainId: network.chainId.toString() });

      console.log('🔓 Using OWNER_PRIVATE_KEY...');
      const privateKey = Deno.env.get("OWNER_PRIVATE_KEY");
      if (!privateKey) {
        throw new Error('OWNER_PRIVATE_KEY not configured');
      }
      console.log('✅ Private key loaded (length:', privateKey.length, ')');

      const wallet = new ethers.Wallet(privateKey, provider);
      console.log('✅ Wallet created:', wallet.address);
      
      // Check wallet balance
      const balance = await provider.getBalance(wallet.address);
      console.log('💰 Wallet AVAX balance:', ethers.formatEther(balance), 'AVAX');
      
      const tokenContract = new ethers.Contract(
        companyToken.contract_address,
        ERC20_ABI,
        wallet
      );
      console.log('✅ Token contract initialized');

      // Get decimals and convert amount
      console.log('🔍 Fetching token decimals...');
      const decimals = await tokenContract.decimals();
      console.log('✅ Token decimals:', decimals);
      
      const amountInWei = ethers.parseUnits(tokensToReceive.toString(), decimals);
      console.log('💱 Amount in Wei:', amountInWei.toString());

      // Execute transfer
      console.log(`🔄 Transferring ${tokensToReceive} tokens to ${client.wallet_address}`);
      console.log('📝 Transaction parameters:', {
        to: client.wallet_address,
        amount: amountInWei.toString(),
        contract: companyToken.contract_address
      });
      
      const tx = await tokenContract.transfer(client.wallet_address, amountInWei);
      txHash = tx.hash;
      console.log('📤 Transaction sent:', txHash);
      console.log('⏳ Waiting for confirmation...');
      
      receipt = await tx.wait();
      console.log('✅ Transaction confirmed!');
      console.log('📦 Block:', receipt.blockNumber);
      console.log('⛽ Gas used:', receipt.gasUsed.toString());
      console.log('✅ Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');

    } catch (blockchainError) {
      console.error('❌ Blockchain error:', blockchainError);
      console.error('Error name:', blockchainError.name);
      console.error('Error message:', blockchainError.message);
      console.error('Error stack:', blockchainError.stack);
      
      if (blockchainError.code) {
        console.error('Error code:', blockchainError.code);
      }
      if (blockchainError.reason) {
        console.error('Error reason:', blockchainError.reason);
      }
      
      throw blockchainError;
    }

    // Update client balances
    console.log('💾 Updating client balances...');
    const newStarsBalance = starsBalance - starsToConvert;
    await base44.asServiceRole.entities.Client.update(clientId, {
      current_balance: newStarsBalance,
      total_redeemed: (client.total_redeemed || 0) + starsToConvert,
      tokenBalance: (client.tokenBalance || 0) + tokensToReceive,
      onchain_balance: (client.onchain_balance || 0) + tokensToReceive,
      last_sync: new Date().toISOString(),
      last_activity: new Date().toISOString()
    });
    console.log('✅ Client updated');

    // Update company token treasury balance
    console.log('💾 Updating treasury balance...');
    const newTreasuryBalance = companyToken.treasury_balance - tokensToReceive;
    const newDistributed = companyToken.distributed_tokens + tokensToReceive;
    
    await base44.asServiceRole.entities.CompanyToken.update(companyToken.id, {
      treasury_balance: newTreasuryBalance,
      distributed_tokens: newDistributed
    });
    console.log('✅ Treasury updated');

    // Use txHash for database updates
    const finalTxHash = receipt?.hash || txHash;
    const finalBlockNumber = receipt?.blockNumber;

    // Create ledger event
    console.log('💾 Creating ledger event...');
    await base44.asServiceRole.entities.LedgerEvent.create({
      company_id: client.company_id,
      client_id: clientId,
      type: 'redeem',
      points: -starsToConvert,
      balance_before: starsBalance,
      balance_after: newStarsBalance,
      source: 'system',
      description: `Converted ${starsToConvert} Stars to ${tokensToReceive} MLT tokens`,
      metadata: {
        tx_hash: finalTxHash,
        block_number: finalBlockNumber,
        tokens_received: tokensToReceive
      }
    });
    console.log('✅ Ledger event created');

    // Create redemption record
    console.log('💾 Creating redemption record...');
    await base44.asServiceRole.entities.Redemption.create({
      company_id: client.company_id,
      client_id: clientId,
      item_type: 'exclusive_content',
      item_name: 'MLT Token Conversion',
      item_description: `${tokensToReceive} MLT tokens`,
      points_cost: starsToConvert,
      status: 'completed',
      metadata: {
        tx_hash: finalTxHash,
        wallet_address: client.wallet_address,
        tokens_received: tokensToReceive
      }
    });
    console.log('✅ Redemption record created');

    // Create audit log
    console.log('💾 Creating audit log...');
    await base44.asServiceRole.entities.AuditLog.create({
      company_id: client.company_id,
      action: 'convert_stars_to_tokens',
      entity_type: 'Client',
      entity_id: clientId,
      performed_by: user.id,
      details: {
        starsConverted: starsToConvert,
        tokensReceived: tokensToReceive,
        transactionHash: finalTxHash,
        blockNumber: finalBlockNumber,
        newStarsBalance,
        newTokenBalance: (client.tokenBalance || 0) + tokensToReceive,
        treasury_balance_before: companyToken.treasury_balance,
        treasury_balance_after: newTreasuryBalance
      }
    });
    console.log('✅ Audit log created');

    // Send SMS notification
    console.log('📱 Sending SMS notification...');
    try {
      const company = await base44.asServiceRole.entities.Company.get(client.company_id);

      if (company.twilio_account_sid && company.twilio_auth_token && company.twilio_phone_number && client.phone) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${company.twilio_account_sid}/Messages.json`;

        const message = `🎉 Conversion successful! You converted ${starsToConvert} Stars to ${tokensToReceive} MLT tokens. View transaction: https://testnet.snowtrace.io/tx/${finalTxHash}`;

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${company.twilio_account_sid}:${company.twilio_auth_token}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: client.phone,
            From: company.twilio_phone_number,
            Body: message
          })
        });

        if (twilioResponse.ok) {
          console.log('✅ SMS sent successfully');

          // Log SMS
          await base44.asServiceRole.entities.SMSLog.create({
            company_id: client.company_id,
            client_id: clientId,
            client_phone: client.phone,
            message_type: 'custom',
            message_content: message,
            status: 'sent',
            sent_at: new Date().toISOString()
          });
        } else {
          const errorText = await twilioResponse.text();
          console.error('❌ SMS failed:', errorText);
        }
      } else {
        console.log('⚠️ Twilio not configured or client has no phone');
      }
    } catch (smsError) {
      console.error('❌ SMS error:', smsError.message);
      // Don't fail the whole conversion if SMS fails
    }

    console.log('🎉 Conversion completed successfully!');
    return Response.json({
      success: true,
      data: {
        starsConverted: starsToConvert,
        tokensReceived: tokensToReceive,
        newStarsBalance,
        transactionHash: finalTxHash,
        explorerUrl: `https://testnet.snowtrace.io/tx/${finalTxHash}`
      }
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR in convertStarsToTokens');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log additional error details if available
    if (error.code) console.error('Error code:', error.code);
    if (error.reason) console.error('Error reason:', error.reason);
    if (error.transaction) console.error('Failed transaction:', error.transaction);
    if (error.receipt) console.error('Transaction receipt:', error.receipt);
    
    return Response.json({
      success: false,
      error: error.message || 'Failed to convert stars to tokens',
      errorType: error.constructor.name,
      errorCode: error.code,
      errorReason: error.reason
    }, { status: 500 });
  }
});