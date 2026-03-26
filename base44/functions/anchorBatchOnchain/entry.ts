import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.12.1';

const ABI = [
  "function anchor(bytes32 root, bytes32 sessionIdHash, uint8 kind) external",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Auth
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Parse body
    const { batch_id } = await req.json();
    if (!batch_id) {
      return Response.json({ success: false, error: 'Missing required field: batch_id' }, { status: 400 });
    }

    // 3. Load ReceiptBatch
    const batches = await base44.asServiceRole.entities.ReceiptBatch.filter({ id: batch_id });
    if (!batches || batches.length === 0) {
      return Response.json({ success: false, error: 'ReceiptBatch not found' }, { status: 404 });
    }
    const batch = batches[0];

    // 4. Guards
    if (batch.status === 'confirmed') {
      return Response.json({
        success: true, duplicate: true, batch_id,
        tx_hash: batch.tx_hash, chain_id: batch.chain_id,
        explorer_url: batch.explorer_url, status: 'confirmed'
      });
    }
    if (!batch.root_hash) {
      return Response.json({ success: false, error: 'Batch has no root_hash, cannot anchor' }, { status: 400 });
    }

    // 5. Setup blockchain
    const rpcUrl = Deno.env.get('FUJI_RPC_URL') || Deno.env.get('AVALANCHE_RPC');
    const pk = Deno.env.get('GAS_WALLET_PRIVATE_KEY');
    const contractAddress = Deno.env.get('FUJI_ANCHOR_REGISTRY_ADDRESS');

    if (!rpcUrl || !pk || !contractAddress) {
      throw new Error('Missing required env vars: FUJI_RPC_URL, GAS_WALLET_PRIVATE_KEY, FUJI_ANCHOR_REGISTRY_ADDRESS');
    }

    // 6. Normalize root_hash to bytes32
    const root = batch.root_hash.startsWith('0x') ? batch.root_hash : `0x${batch.root_hash}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
      throw new Error(`Invalid root_hash format: ${batch.root_hash}`);
    }

    const sessionIdHash = ethers.keccak256(ethers.toUtf8Bytes(batch_id));
    const kindNum = 1; // evidence

    // 7. Send TX to AnchorRegistry contract
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(pk, provider);
    const contract = new ethers.Contract(contractAddress, ABI, wallet);

    console.log('[anchorBatchOnchain] Anchoring root:', root, 'for batch:', batch_id);

    const gasEstimate = await contract.anchor.estimateGas(root, sessionIdHash, kindNum);
    const tx = await contract.anchor(root, sessionIdHash, kindNum, {
      gasLimit: (gasEstimate * 120n) / 100n,
    });
    const receipt = await tx.wait();
    const tx_hash = receipt?.hash ?? tx.hash;

    console.log('[anchorBatchOnchain] TX confirmed:', tx_hash);

    // 8. Derive explorer URL
    const moodEnv = Deno.env.get('MOOD_ENV') || 'dev';
    const isProd = moodEnv === 'prod';
    const chain_id = isProd ? '43114' : '43113';
    const explorer_url = `${isProd ? 'https://snowtrace.io' : 'https://testnet.snowtrace.io'}/tx/${tx_hash}`;

    // 9. Update ReceiptBatch
    await base44.asServiceRole.entities.ReceiptBatch.update(batch_id, {
      tx_hash, chain_id, explorer_url, status: 'pending'
    });

    return Response.json({
      success: true, batch_id, tx_hash, chain_id, explorer_url,
      anchored_root: root, contract_address: contractAddress
    });

  } catch (error) {
    console.error('[anchorBatchOnchain] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});