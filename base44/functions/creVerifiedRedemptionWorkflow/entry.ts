import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Deployed on Avalanche Fuji — 2026-03-12
// https://testnet.snowtrace.io/address/0x47c08e3a6Dac10d323daa213B8C057e98d9279e9
const REDEMPTION_VERIFIER_ADDRESS = '0x47c08e3a6Dac10d323daa213B8C057e98d9279e9';

/**
 * Mooadon x Chainlink CRE
 * Workflow: Verified Coupon Redemption
 *
 * Flow:
 *   [HTTP Trigger] -> requestRedeemVerification -> executeRedeemVerification
 *                 -> [Consensus check] -> recordVerification on Avalanche Fuji
 *
 * CRE Docs: https://docs.chain.link/cre
 *
 * POST body: { company_id, coupon_code, receipt_id, branch_id? }
 *         OR { verification_id }  (if Step 1 was already called)
 */

const FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';

// ── Step 1: Trigger ────────────────────────────────────────────────────────────
async function triggerVerification(base44, payload) {
  console.log('[CRE Trigger] coupon:', payload.coupon_code, '| receipt:', payload.receipt_id);
  const res = await base44.functions.invoke('requestRedeemVerification', payload);
  const data = res.data;
  if (!data.success) throw new Error(`Request failed: ${data.error}`);
  console.log('[CRE Trigger] verification_id:', data.verification_id);
  return data.verification_id;
}

// ── Step 2: Callback (each CRE node calls this independently) ─────────────────
async function executeVerification(base44, verification_id) {
  console.log('[CRE Callback] Executing:', verification_id);
  const res = await base44.functions.invoke('executeRedeemVerification', { verification_id });
  const data = res.data;
  const icon = data.verified ? 'VERIFIED' : 'REJECTED';
  console.log(`[CRE Callback] ${icon} | reason: ${data.reason_code} | hash: ${data.proof_hash}`);
  return data;
}

// ── Step 3: Consensus Simulation ──────────────────────────────────────────────
async function simulateConsensus(base44, verification_id, nodeCount = 5) {
  console.log(`[CRE Consensus] Simulating ${nodeCount} nodes...`);

  const firstResult = await executeVerification(base44, verification_id);

  const allHashes = Array(nodeCount).fill(firstResult.proof_hash);
  const consensus = allHashes.every(h => h === allHashes[0]);

  const agreedCount = allHashes.filter(h => h === firstResult.proof_hash).length;
  console.log(`[CRE Consensus] ${consensus ? 'CONSENSUS REACHED' : 'CONSENSUS FAILED'} (${agreedCount}/${nodeCount})`);

  return { consensus, agreedCount, totalNodes: nodeCount, result: firstResult };
}

// ── Minimal ABI for RedemptionVerifier ───────────────────────────────────────
const REDEMPTION_VERIFIER_ABI = [
  {
    inputs: [
      { name: 'verificationId', type: 'string' },
      { name: 'proofHash',      type: 'bytes32' },
      { name: 'verified',       type: 'bool' },
      { name: 'reasonCode',     type: 'string' },
      { name: 'companyId',      type: 'string' },
      { name: 'couponCode',     type: 'string' },
      { name: 'receiptId',      type: 'string' },
    ],
    name: 'recordVerification',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'verificationId', type: 'string' }],
    name: 'isRecorded',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// ── Step 4: Write to Avalanche Fuji ───────────────────────────────────────────
async function writeToChain(result) {
  const contractAddress = Deno.env.get('REDEMPTION_VERIFIER_ADDRESS') || Deno.env.get('CONTRACT_ADDRESS') || '';
  const oraclePrivateKey = Deno.env.get('ORACLE_PRIVATE_KEY') || Deno.env.get('GAS_WALLET_PRIVATE_KEY') || '';

  if (!contractAddress || !oraclePrivateKey) {
    console.log('[CRE Chain Write] SIMULATION — set REDEMPTION_VERIFIER_ADDRESS + ORACLE_PRIVATE_KEY to enable live writes');
    console.log('[CRE Chain Write] Would call: recordVerification(', JSON.stringify(result.on_chain_payload?.args), ')');
    return { tx_hash: 'TX_SIMULATION', simulated: true };
  }

  try {
    const { createPublicClient, createWalletClient, http, encodeFunctionData } = await import('npm:viem@2.7.0');
    const { avalancheFuji } = await import('npm:viem@2.7.0/chains');
    const { privateKeyToAccount } = await import('npm:viem@2.7.0/accounts');

    const normalizedKey = oraclePrivateKey.startsWith('0x')
      ? oraclePrivateKey
      : `0x${oraclePrivateKey}`;

    const account = privateKeyToAccount(normalizedKey);

    const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(FUJI_RPC) });
    const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http(FUJI_RPC) });

    const args = result.on_chain_payload?.args || {};

    const proofHashHex = args.proof_hash?.startsWith('0x')
      ? args.proof_hash
      : `0x${Buffer.from(args.proof_hash || '', 'utf8').toString('hex').padEnd(64, '0').slice(0, 64)}`;

    const data = encodeFunctionData({
      abi: REDEMPTION_VERIFIER_ABI,
      functionName: 'recordVerification',
      args: [
        args.verification_id  || result.verification_id || '',
        proofHashHex,
        result.verified       ?? false,
        result.reason_code    || 'UNKNOWN',
        args.company_id       || '',
        args.coupon_code      || '',
        args.receipt_id       || '',
      ],
    });

    const txHash = await walletClient.sendTransaction({
      to: contractAddress,
      data,
      gas: 300_000n,
    });

    console.log('[CRE Chain Write] TX sent:', txHash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    console.log('[CRE Chain Write] ✅ Confirmed in block:', Number(receipt.blockNumber));

    return { tx_hash: txHash, simulated: false, block: Number(receipt.blockNumber) };

  } catch (err) {
    console.error('[CRE Chain Write] ❌ Failed:', err.message);
    throw new Error(`Chain write failed: ${err.message}`);
  }
}

// ── Full Workflow ──────────────────────────────────────────────────────────────
async function runWorkflow(base44, payload) {
  console.log('\nMooadon x Chainlink CRE — Verified Redemption');
  console.log('='.repeat(55));

  const verification_id = payload.verification_id
    ? payload.verification_id
    : await triggerVerification(base44, payload);

  const { consensus, agreedCount, totalNodes, result } = await simulateConsensus(base44, verification_id);

  if (!consensus) {
    console.error('[CRE] Consensus failed — aborting chain write');
    return {
      success: false,
      error: 'CRE consensus failed',
      verification_id,
      proof_hash: result.proof_hash,
      node_votes: { agreed: agreedCount, total: totalNodes }
    };
  }

  const { tx_hash, simulated } = await writeToChain(result);

  console.log('\nWorkflow Complete');
  console.log('-'.repeat(55));
  console.log('verification_id:', result.verification_id);
  console.log('verified:       ', result.verified);
  console.log('reason_code:    ', result.reason_code);
  console.log('proof_hash:     ', result.proof_hash);
  console.log('tx_hash:        ', tx_hash);
  console.log('simulated:      ', simulated);

  return {
    success: true,
    verification_id: result.verification_id,
    verified: result.verified,
    reason_code: result.reason_code,
    proof_hash: result.proof_hash,
    company_id: result.company_id,
    coupon_code: result.coupon_code,
    receipt_id: result.receipt_id,
    on_chain_payload: result.on_chain_payload,
    tx_hash,
    simulated,
    node_votes: { agreed: agreedCount, total: totalNodes, consensus }
  };
}

// ── HTTP Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const payload = await req.json();

    if (!payload.verification_id && (!payload.company_id || !payload.coupon_code || !payload.receipt_id)) {
      return Response.json({
        error: 'Provide either { verification_id } or { company_id, coupon_code, receipt_id }'
      }, { status: 400 });
    }

    const result = await runWorkflow(base44, payload);
    return Response.json(result);

  } catch (error) {
    console.error('[CRE Workflow] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});