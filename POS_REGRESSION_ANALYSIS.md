# POS Regression Analysis Report
**Date:** 2026-03-22
**Scope:** POSTerminal.jsx (frontend) + createPOSTransaction.ts (backend)

---

## Summary

After a thorough code review, I identified **8 bugs/issues** that could cause the POS to stop working.
Since no backup files ("mooadon - 2026-03-22T072427.367") were available for diff comparison, this analysis is based on code patterns that indicate recent changes (FIX comments, workarounds, defensive code).

---

## Critical Issues (Likely Cause of Regression)

### 1. GUARD CHECK ON `claimToken` IS DEAD CODE (createPOSTransaction.ts:305-308)
```typescript
// Line 290: claimToken is ALWAYS generated (Math.random)
const claimToken = Math.random().toString(36).substring(2, 15) + ...;

// Line 291-302: RewardIntent is created with claimToken

// Line 305: This guard can NEVER be false - claimToken was assigned above
if (!claimToken) {
  // DEAD CODE - will never execute
}
```
**Impact:** Low - but indicates sloppy recent edit.

### 2. `reward_type` DEFAULT MISMATCH (CRITICAL)
**Frontend (POSTerminal.jsx:368):** sends `reward_type: 'token'`
**Backend (createPOSTransaction.ts:414):** checks `if (reward_type === 'token')` for blockchain flow
**Backend (createPOSTransaction.ts:297):** also checks `!reward_type` for points calculation
**Backend (createPOSTransaction.ts:826):** else branch handles `'points'` or "any non-token type" as off-chain

**Problem:** The `reward_type` field controls TWO completely different flows:
- `'token'` → blockchain transfer (requires wallet, contract, gas)
- `'points'` / `undefined` → off-chain balance update only
- `'coupon'` → coupon creation

If the frontend was previously NOT sending `reward_type` (or sending `'points'`), transactions would go through the simple off-chain path. The addition of `reward_type: 'token'` on line 368 forces ALL transactions through the complex blockchain path, which can fail if:
- Client has no wallet → creates custodial wallet (extra API call that can fail)
- CompanyToken has no `contract_address` → **returns HTTP 400 error**
- Gas wallet has insufficient AVAX → blockchain tx fails
- RPC endpoint is down → blockchain tx fails

**This is the most likely regression cause.**

### 3. CompanyToken Selection Logic Change (createPOSTransaction.ts:135-138)
```typescript
// FIX comment indicates this was recently changed
const activeTokens = companyTokens.filter(t => t.is_active !== false && t.contract_address);
const companyToken = activeTokens.length > 0
  ? activeTokens[activeTokens.length - 1]   // newest active token
  : companyTokens[companyTokens.length - 1]; // newest overall
```
**Problem:** The "FIX" selects the **newest** token, not the first one. If a new CompanyToken was created without a `contract_address` (e.g., during token deployment), and there are no active tokens with contracts, the fallback picks the newest token which may lack `contract_address`. This causes a **400 error** at line 544-549.

### 4. Contract Address Parsing with `$` Separator (createPOSTransaction.ts:526)
```typescript
const tokenContractAddress = companyToken.contract_address
  ? (companyToken.contract_address.includes('$') ? companyToken.contract_address.split('$')[1] : companyToken.contract_address)
  : null;
```
**Problem:** This is a workaround for a data format issue. If `contract_address` contains a `$` prefix (e.g., `fuji$0xABC...`), it splits. If the data format changed to include `$` but the split logic was added after the old backup was made, this could cause transactions with the old format to fail.

### 5. `createCustodialWallet` Function Dependency (createPOSTransaction.ts:422-429)
When `reward_type === 'token'` and client has no wallet:
```typescript
const custodialResult = await base44.asServiceRole.functions.invoke('createCustodialWallet', { ... });
```
**Problem:** This calls an external function `createCustodialWallet`. If this function:
- Doesn't exist yet → throws error
- Was recently deployed with a bug → throws error
- Has rate limits → throws error

The error is caught and `client.wallet_address` is set to `null`, which causes the blockchain transfer to be SKIPPED entirely. The transaction still "succeeds" but with `blockchainSuccess = false`, meaning the response includes a `blockchain_warning` which the frontend might not handle well.

---

## Medium Issues

### 6. Frontend Response Handling (POSTerminal.jsx:374)
```javascript
if (result.data && result.data.success) {
  // success path
} else {
  const errorMessage = result.data?.error || 'Transaction failed';
  // shows error toast
}
```
**Problem:** When the backend returns `blockchain_success: false` with `success: true`, the frontend shows success. But the `blockchain_warning` field is never displayed to the user. If the old version was checking `blockchain_success` specifically, this could explain why transactions appear "broken" even though they technically succeed.

### 7. `AntiAbuseService` Call (createPOSTransaction.ts:263-286)
```typescript
const abuseCheckResponse = await base44.asServiceRole.functions.invoke('AntiAbuseService', { ... });
```
**Problem:** This calls another external function. If `AntiAbuseService`:
- Was recently added and doesn't exist → throws (caught, non-blocking)
- Was recently added and returns unexpected format → could block legitimate transactions
- Returns `blocked: true` for valid customers → returns HTTP 403

The catch block allows continuation, but if the function exists and returns malformed data (e.g., `abuseCheckResponse.data.success` is undefined), the `blocked` check might pass incorrectly.

### 8. `RewardQueueProcessor` Fire-and-Forget (createPOSTransaction.ts:371-373)
```typescript
base44.asServiceRole.functions.invoke('RewardQueueProcessor', {}).catch(err =>
  console.warn('⚠️ RewardQueueProcessor trigger failed (non-critical):', err.message)
);
```
**Problem:** This is fire-and-forget. If `RewardQueueProcessor` doesn't exist or errors, rewards are never actually processed. Combined with the async reward queue architecture (Step 11B), tokens may be "queued" but never delivered.

---

## Root Cause Hypothesis

**Most likely scenario:** The old backup (that worked) was using `reward_type: 'points'` or NOT sending `reward_type` at all. This meant transactions went through the simple **off-chain balance update** path (lines 826-860) which:
- Does NOT require blockchain
- Does NOT require wallet creation
- Does NOT require gas
- Does NOT call `createCustodialWallet`
- Simply updates the client's `current_balance` in the database

Someone then changed the frontend to send `reward_type: 'token'` (line 368), which forced ALL transactions through the **blockchain path**, which fails because:
1. `CompanyToken` might not have a `contract_address` deployed
2. `createCustodialWallet` function might not exist or work
3. Gas wallet might not have AVAX
4. Blockchain RPC might be unreliable

---

## Recommended Fixes

### Quick Fix (Restore Working Behavior)
Change `POSTerminal.jsx` line 368 from:
```javascript
reward_type: 'token',
```
To:
```javascript
reward_type: 'points',
```
This will bypass the blockchain path and use the simpler off-chain balance update.

### Proper Fix
1. Add a `reward_type` field to the Company or CompanyToken entity so each company can choose their reward method
2. Don't hardcode `reward_type` in the frontend
3. Add proper error handling in the frontend for `blockchain_warning`
4. Ensure `createCustodialWallet` and `RewardQueueProcessor` functions exist and work before enabling `reward_type: 'token'`
