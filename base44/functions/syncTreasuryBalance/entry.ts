import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.9.0';

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow service-role calls (e.g. from schedulerWatchdog) AND authenticated users
    const user = await base44.auth.me().catch(() => null);

    const { companyId, tokenId } = await req.json();

    if (!companyId) {
      return Response.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Get company token
    let companyToken;
    if (tokenId) {
      const tokens = await base44.asServiceRole.entities.CompanyToken.filter({ id: tokenId });
      companyToken = tokens[0];
    } else {
      const tokens = await base44.asServiceRole.entities.CompanyToken.filter({
        company_id: companyId
      });
      companyToken = tokens[0];
    }

    if (!companyToken) {
      return Response.json({ error: 'Company token not found' }, { status: 404 });
    }

    if (!companyToken.contract_address || !companyToken.treasury_wallet) {
      return Response.json({ error: 'Token not properly configured' }, { status: 400 });
    }

    // Setup blockchain connection
    const rpcUrl = Deno.env.get('AVALANCHE_RPC') || 'https://api.avax-test.network/ext/bc/C/rpc';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const tokenContract = new ethers.Contract(
      companyToken.contract_address,
      ERC20_ABI,
      provider
    );

    // Get on-chain balance
    const decimals = await tokenContract.decimals();
    const balanceWei = await tokenContract.balanceOf(companyToken.treasury_wallet);
    const onchainBalance = parseFloat(ethers.formatUnits(balanceWei, decimals));

    console.log('📊 Treasury sync:', {
      treasury_wallet: companyToken.treasury_wallet,
      contract: companyToken.contract_address,
      onchain_balance: onchainBalance,
      db_balance: companyToken.treasury_balance
    });

    // Update DB with on-chain balance
    await base44.asServiceRole.entities.CompanyToken.update(companyToken.id, {
      treasury_balance: onchainBalance
    });

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      company_id: companyId,
      action: 'treasury_balance_synced',
      entity_type: 'CompanyToken',
      entity_id: companyToken.id,
      performed_by: user?.id || 'scheduler',
      details: {
        onchain_balance: onchainBalance,
        previous_db_balance: companyToken.treasury_balance
      }
    });

    return Response.json({
      success: true,
      data: {
        onchain_balance: onchainBalance,
        previous_balance: companyToken.treasury_balance,
        synced_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    return Response.json({
      error: error.message || 'Failed to sync treasury balance'
    }, { status: 500 });
  }
});