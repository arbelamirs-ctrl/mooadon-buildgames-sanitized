import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.9.0';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id } = await req.json();
    
    if (!order_id) {
      return Response.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // Get order
    const order = await base44.asServiceRole.entities.Purchase.get(order_id);
    
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'completed') {
      return Response.json({ error: 'Order already paid' }, { status: 400 });
    }

    // Get client
    const client = await base44.asServiceRole.entities.Client.get(order.client_id);
    
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!client.encryptedPrivateKey) {
      // No custodial wallet - deduct balance only (off-chain redemption)
      console.warn('⚠️ Client has no custodial wallet - processing as off-chain redemption');
      
      await base44.asServiceRole.entities.Purchase.update(order_id, {
        status: 'completed',
        metadata: { off_chain: true, confirmed_at: new Date().toISOString() }
      });

      await base44.asServiceRole.entities.LedgerEvent.create({
        company_id: order.company_id,
        client_id: order.client_id,
        type: 'redeem',
        points: -order.tokens_spent,
        balance_before: client.current_balance,
        balance_after: client.current_balance - order.tokens_spent,
        source: 'client',
        description: `Purchase (off-chain): ${order.product_name}`
      });

      return Response.json({
        success: true,
        tx_hash: null,
        off_chain: true,
        order: { id: order_id, status: 'completed', product_name: order.product_name, tokens_spent: order.tokens_spent }
      });
    }

    // Get company
    const company = await base44.asServiceRole.entities.Company.get(order.company_id);

    // FIX: Use CompanyToken.contract_address (not company.token_contract which doesn't exist)
    const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ company_id: order.company_id });
    const companyToken = companyTokens.length > 0 ? companyTokens[companyTokens.length - 1] : null;
    const tokenContractAddress = companyToken?.contract_address || Deno.env.get('TOKEN_CONTRACT');
    const treasuryAddress = company?.blockchain_wallet_address || companyToken?.treasury_address;

    if (!tokenContractAddress || !treasuryAddress) {
      return Response.json({ error: 'Company blockchain not configured' }, { status: 400 });
    }

    // Setup blockchain connection
    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Decrypt client private key
    const decryptPrivateKey = (encrypted) => {
      const encryptionKey = Deno.env.get('OWNER_PRIVATE_KEY') || '';
      const decrypted = encrypted.split('').map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ encryptionKey.charCodeAt(i % encryptionKey.length))
      ).join('');
      return decrypted;
    };

    const clientPrivateKey = decryptPrivateKey(client.encryptedPrivateKey);
    const clientWallet = new ethers.Wallet(clientPrivateKey, provider);
    
    // Create contract instance
    const tokenContract = new ethers.Contract(tokenContractAddress, ERC20_ABI, clientWallet);
    
    // Convert tokens to wei (assuming 18 decimals)
    const amount = ethers.parseUnits(order.tokens_spent.toString(), 18);
    
    // Execute transfer to company treasury
    const tx = await tokenContract.transfer(treasuryAddress, amount);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    if (!receipt?.hash) {
      throw new Error('Transaction failed');
    }

    // Update order with tx hash
    await base44.asServiceRole.entities.Purchase.update(order_id, {
      status: 'completed',
      metadata: {
        tx_hash: receipt.hash,
        block_number: receipt.blockNumber,
        confirmed_at: new Date().toISOString()
      }
    });

    // Create ledger event
    await base44.asServiceRole.entities.LedgerEvent.create({
      company_id: order.company_id,
      client_id: order.client_id,
      type: 'redeem',
      points: -order.tokens_spent,
      balance_before: client.current_balance,
      balance_after: client.current_balance - order.tokens_spent,
      source: 'client',
      description: `Purchase: ${order.product_name}`,
      metadata: {
        order_id: order_id,
        tx_hash: receipt.hash
      }
    });

    const explorerUrl = `https://testnet.snowtrace.io/tx/${receipt.hash}`;

    return Response.json({
      success: true,
      tx_hash: receipt.hash,
      explorer_url: explorerUrl,
      order: {
        id: order_id,
        status: 'completed',
        product_name: order.product_name,
        tokens_spent: order.tokens_spent
      }
    });

  } catch (error) {
    console.error('Payment error:', error);
    return Response.json({ 
      error: error.message || 'Payment failed',
      details: error.toString()
    }, { status: 500 });
  }
});