/**
 * One-off cleanup: delete the 2 orphan BlockchainTransfer records
 * for the deleted ZARA client mystery wallet.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ORPHAN_IDS = [
  '69bcfa03c9a12d1427a59cda',
  '69bcf9ab8762ec8e63083c75'
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = [];

  for (const id of ORPHAN_IDS) {
    try {
      await base44.asServiceRole.entities.BlockchainTransfer.delete(id);
      results.push({ id, status: 'deleted' });
      console.log(`✅ Deleted BlockchainTransfer ${id}`);
    } catch (err) {
      results.push({ id, status: 'error', error: err.message });
      console.error(`❌ Failed to delete ${id}:`, err.message);
    }
  }

  return Response.json({ success: true, results });
});