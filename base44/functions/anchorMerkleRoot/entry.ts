import { ethers } from "npm:ethers@6.12.1";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ABI = [
  "function anchor(bytes32 root, bytes32 sessionIdHash, uint8 kind) external",
];

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function normalizeBytes32Hex(maybeHex) {
  const hex = maybeHex.startsWith("0x") ? maybeHex : `0x${maybeHex}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Invalid merkle_root: expected 32-byte hex (0x + 64 hex chars)");
  }
  return hex.toLowerCase();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return json(401, { error: "Unauthorized" });

    const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "").split(",").map(e => e.trim().toLowerCase());
    const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase()) || user.role === 'admin' || user.role === 'super_admin';
    if (!isAdmin) return json(403, { error: "Forbidden: admin only" });

    const input = await req.json();
    const { merkle_root, session_id, kind } = input;

    if (!merkle_root || !session_id || !kind) {
      return json(400, { error: "Missing required fields: merkle_root, session_id, kind" });
    }
    if (kind !== "evidence" && kind !== "telemetry") {
      return json(400, { error: "Invalid kind. Use 'evidence' or 'telemetry'." });
    }

    const rpcUrl = Deno.env.get("FUJI_RPC_URL");
    const pk = Deno.env.get("GAS_WALLET_PRIVATE_KEY");
    const contractAddress = Deno.env.get("FUJI_ANCHOR_REGISTRY_ADDRESS");

    if (!rpcUrl || !pk || !contractAddress) {
      return json(500, { error: "Missing required environment variables" });
    }

    const root = normalizeBytes32Hex(merkle_root);
    const sessionIdHash = ethers.keccak256(ethers.toUtf8Bytes(session_id));
    const kindNum = kind === "evidence" ? 1 : 2;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(pk, provider);
    const contract = new ethers.Contract(contractAddress, ABI, wallet);

    const gasEstimate = await contract.anchor.estimateGas(root, sessionIdHash, kindNum);
    const tx = await contract.anchor(root, sessionIdHash, kindNum, {
      gasLimit: (gasEstimate * 120n) / 100n,
    });

    const receipt = await tx.wait();
    const tx_hash = receipt?.hash ?? tx.hash;

    return json(200, {
      ok: true,
      tx_hash,
      explorer_url: `https://testnet.snowtrace.io/tx/${tx_hash}`,
      chain: "fuji",
      contract_address: contractAddress,
      anchored_root: root,
      session_id_hash: sessionIdHash,
      kind,
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
});