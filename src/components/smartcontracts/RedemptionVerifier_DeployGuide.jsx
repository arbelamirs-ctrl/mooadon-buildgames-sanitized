# RedemptionVerifier — Deploy Guide (Avalanche Fuji Testnet)
# ─────────────────────────────────────────────────────────────────────────────

## Prerequisites

1. MetaMask with Fuji Testnet configured:
   - Network: Avalanche Fuji C-Chain
   - RPC: https://api.avax-test.network/ext/bc/C/rpc
   - Chain ID: 43113
   - Symbol: AVAX

2. Wallet: 0xFA9b000dF91BfAC4925151070018aE8A13C52a38
   - Needs ~0.05 AVAX for deployment gas
   - Faucet: https://faucet.avax.network (use code "avalanche")

---

## Step 1 — Open Remix IDE

Go to: https://remix.ethereum.org

---

## Step 2 — Create the file

In the File Explorer (left sidebar):
1. Click the "+" icon next to "contracts/"
2. Name it: RedemptionVerifier.sol
3. Paste the full contents of RedemptionVerifier.sol

---

## Step 3 — Compile

1. Click the "Solidity Compiler" tab (left sidebar, looks like <S>)
2. Settings:
   - Compiler version: 0.8.19
   - Language: Solidity
   - EVM Version: paris
   - ✅ Enable optimization: YES, runs: 200
3. Click "Compile RedemptionVerifier.sol"
4. ✅ Should show green checkmark with no errors

---

## Step 4 — Connect MetaMask to Fuji

1. In MetaMask: switch to "Avalanche Fuji C-Chain"
2. In Remix: click "Deploy & Run Transactions" tab (rocket icon)
3. Environment: select "Injected Provider - MetaMask"
4. MetaMask popup will appear — approve connection
5. Confirm account shows: 0xFA9b000dF91BfAC4925151070018aE8A13C52a38

---

## Step 5 — Deploy

1. Contract dropdown: select "RedemptionVerifier"
2. In the constructor field "_owner":
   Enter: 0xFA9b000dF91BfAC4925151070018aE8A13C52a38
3. Click "Deploy"
4. MetaMask popup: review gas — click "Confirm"
5. Wait ~3 seconds for Fuji confirmation

---

## Step 6 — Record contract address

After deployment:
1. In Remix "Deployed Contracts" section, copy the contract address
   Format: 0x...  (42 chars)
2. Save it — you'll need it in the next steps

Example format: 0xABC123...DEF456

---

## Step 7 — Verify on Snowtrace (optional but recommended)

1. Go to: https://testnet.snowtrace.io
2. Search your contract address
3. Click "Verify and Publish"
4. Settings:
   - Compiler: v0.8.19
   - Optimization: Yes, 200 runs
   - License: MIT
5. Paste the source code

---

## Step 8 — Update Base44 Secrets

Add this secret in Base44 Settings → Secrets:
  REDEMPTION_VERIFIER_ADDRESS = <your deployed address>

---

## Step 9 — Update creVerifiedRedemptionWorkflow.js

The function already reads:
  Deno.env.get('REDEMPTION_VERIFIER_ADDRESS')

Just add the secret in Step 8 — no code changes needed.

---

## Test the deployment

Call from Remix "Deployed Contracts" panel:
1. isRecorded("test-id") → should return false ✅
2. totalVerifications → should return 0 ✅
3. owner → should return 0xFA9b000dF91BfAC4925151070018aE8A13C52a38 ✅

---

## ABI (for backend integration)

Minimal ABI used by creVerifiedRedemptionWorkflow.js:

```json
[
  {
    "inputs": [
      {"name": "verificationId", "type": "string"},
      {"name": "proofHash",      "type": "bytes32"},
      {"name": "verified",       "type": "bool"},
      {"name": "reasonCode",     "type": "string"},
      {"name": "companyId",      "type": "string"},
      {"name": "couponCode",     "type": "string"},
      {"name": "receiptId",      "type": "string"}
    ],
    "name": "recordVerification",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "verificationId", "type": "string"}],
    "name": "getVerification",
    "outputs": [
      {"name": "proofHash",  "type": "bytes32"},
      {"name": "verified",   "type": "bool"},
      {"name": "reasonCode", "type": "string"},
      {"name": "timestamp",  "type": "uint256"},
      {"name": "companyId",  "type": "string"},
      {"name": "couponCode", "type": "string"},
      {"name": "receiptId",  "type": "string"},
      {"name": "exists",     "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "verificationId", "type": "string"}],
    "name": "isRecorded",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true,  "name": "verificationId", "type": "string"},
      {"indexed": true,  "name": "companyId",       "type": "string"},
      {"indexed": false, "name": "proofHash",        "type": "bytes32"},
      {"indexed": false, "name": "verified",         "type": "bool"},
      {"indexed": false, "name": "reasonCode",       "type": "string"},
      {"indexed": false, "name": "timestamp",        "type": "uint256"}
    ],
    "name": "VerificationRecorded",
    "type": "event"
  }
]
``