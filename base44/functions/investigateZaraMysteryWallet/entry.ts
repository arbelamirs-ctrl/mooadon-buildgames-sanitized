/**
 * investigateZaraMysteryWallet.js
 *
 * Security investigation for wallet 0x3465a4eD99C23A081B41e62f99273A5a05e3d695
 * which received 40 ZAR tokens from OWNER wallet on Mar 22 but has NO
 * surviving Client record (the client was deleted).
 *
 * Findings from DB scan:
 *   - Client ID: 699f8b7e09e66edc024a2543 — DELETED (404)
 *   - Company: ZARA (698e34c870359a1a7a3f7049)
 *   - BlockchainTransfer records: 2 found (20+20 = 40 ZAR), both confirmed
 *   - The encryptedPrivateKey was stored on the deleted Client record — now LOST
 *   - Tokens at 0x3465a4eD99C23A081B41e62f99273A5a05e3d695 are permanently inaccessible
 *
 * This function:
 *   1. Confirms full DB state of the mystery wallet
 *   2. Queries BlockchainTransfer records for the full transfer history
 *   3. Checks if wallet appears anywhere else in the DB
 *   4. Returns a structured security report
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const MYSTERY_WALLET = '0x3465a4eD99C23A081B41e62f99273A5a05e3d695';
const MYSTERY_CLIENT_ID = '699f8b7e09e66edc024a2543';
const ZARA_COMPANY_ID = '698e34c870359a1a7a3f7049';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  console.log('[investigateZaraMysteryWallet] Started');

  const report = {
    wallet: MYSTERY_WALLET,
    investigation_date: new Date().toISOString(),
    summary: {},
    blockchain_transfers: [],
    client_status: null,
    company: null,
    other_references: {},
    verdict: null,
    recommendation: null,
  };

  // 1. Check if deleted client still exists
  const clientCheck = await base44.asServiceRole.entities.Client.filter({ id: MYSTERY_CLIENT_ID }).catch(() => []);
  report.client_status = clientCheck.length > 0
    ? { found: true, data: clientCheck[0] }
    : { found: false, message: 'Client record DELETED — encryptedPrivateKey is LOST' };

  // 2. Get all BlockchainTransfer records for this wallet
  const transfers = await base44.asServiceRole.entities.BlockchainTransfer.filter({
    to_address: MYSTERY_WALLET
  });
  report.blockchain_transfers = transfers.map(t => ({
    id: t.id,
    amount: t.amount,
    tx_hash: t.tx_hash,
    from_address: t.from_address,
    chain: t.chain,
    status: t.status,
    created_date: t.created_date,
    company_id: t.company_id,
    client_id: t.client_id,
  }));
  const totalTransferred = transfers.reduce((sum, t) => sum + (t.amount || 0), 0);

  // 3. Check company
  const companies = await base44.asServiceRole.entities.Company.filter({ id: ZARA_COMPANY_ID }).catch(() => []);
  report.company = companies.length > 0
    ? { id: companies[0].id, name: companies[0].name, token_contract: companies[0].token_contract }
    : { found: false };

  // 4. Check LedgerEvents linked to deleted client
  const ledgerEvents = await base44.asServiceRole.entities.LedgerEvent.filter({
    client_id: MYSTERY_CLIENT_ID
  }).catch(() => []);
  report.other_references.ledger_events = ledgerEvents.length;
  report.other_references.ledger_event_ids = ledgerEvents.map(l => l.id);

  // 5. Transactions linked to deleted client
  const transactions = await base44.asServiceRole.entities.Transaction.filter({
    client_id: MYSTERY_CLIENT_ID
  }).catch(() => []);
  report.other_references.transaction_count = transactions.length;
  report.other_references.transaction_ids = transactions.map(t => t.id);

  // 6. Build summary
  report.summary = {
    wallet_address: MYSTERY_WALLET,
    client_id: MYSTERY_CLIENT_ID,
    client_deleted: clientCheck.length === 0,
    private_key_recoverable: false,
    company_name: companies[0]?.name || 'ZARA',
    total_tokens_in_wallet: totalTransferred,
    transfer_count_in_db: transfers.length,
    note_snowtrace_shows_3_transfers: 'DB only has 2 BlockchainTransfer records — 1 may have been created by a different code path (e.g. claimRewardIntent)',
  };

  report.verdict = clientCheck.length === 0
    ? '⚠️ CONFIRMED: Client record deleted. encryptedPrivateKey is PERMANENTLY LOST. The ~40 ZAR tokens at this wallet are inaccessible and effectively burned.'
    : '✅ Client record still exists — private key may be recoverable.';

  report.recommendation = clientCheck.length === 0
    ? [
        'The 40 ZAR tokens at 0x3465a4eD99C23A081B41e62f99273A5a05e3d695 are permanently inaccessible.',
        'No action needed — tokens remain on Fuji testnet (not mainnet) and have no real value.',
        'ACTION: Delete the 2 BlockchainTransfer records pointing to this wallet to clean up DB.',
        'ACTION: Add a safeguard in cleanup_duplicate_clients to export/archive private keys BEFORE deleting client records.',
        'ACTION: Add a pre-deletion check: never delete a Client with onchain_balance > 0 without admin confirmation.',
      ]
    : ['Client still exists — check if encryptedPrivateKey field is populated and wallet can be recovered.'];

  console.log(`[investigateZaraMysteryWallet] Verdict: ${report.verdict}`);
  return Response.json(report);
});