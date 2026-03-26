import { createPublicClient, http } from 'npm:viem@2.7.0';
import { avalancheFuji } from 'npm:viem@2.7.0/chains';

const DMD_CONTRACT = '0x4D4e59Fc92337F99E6F7CFB54b3142213BABfE03';

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];

Deno.serve(async (req) => {
  const rpcUrl = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) });

  const totalSupply = await publicClient.readContract({ address: DMD_CONTRACT, abi: ERC20_ABI, functionName: 'totalSupply' });

  // Check gas wallet
  const gasWallet = '0xFA9b000dF91BfAC4925151070018aE8A13C52a38';
  const gasBal = await publicClient.readContract({ address: DMD_CONTRACT, abi: ERC20_ABI, functionName: 'balanceOf', args: [gasWallet] });

  // Scan in 2000-block windows around the known deployment date (Feb 23, 2026)
  // Fuji block time ~2s, so Feb 23 ≈ block 52,800,000 (approx)
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const allTransfers = [];

  // Try multiple windows - Feb 23 to Mar 1 approx blocks
  const windows = [
    [52400000n, 52402000n],
    [52600000n, 52602000n],
    [52700000n, 52702000n],
    [52800000n, 52802000n],
    [52900000n, 52902000n],
    [53000000n, 53002000n],
  ];

  for (const [from, to] of windows) {
    try {
      const logs = await publicClient.getLogs({ address: DMD_CONTRACT, topics: [TRANSFER_TOPIC], fromBlock: from, toBlock: to });
      for (const l of logs) {
        allTransfers.push({
          from: '0x' + (l.topics[1] || '').slice(26),
          to: '0x' + (l.topics[2] || '').slice(26),
          value_dmd: (Number(BigInt(l.data)) / 1e18).toFixed(2),
          block: l.blockNumber?.toString()
        });
      }
    } catch (e) {
      // skip failed chunk
    }
  }

  // Also check the contract itself as a holder and a few other addresses
  const extraAddresses = [
    DMD_CONTRACT,
    '0x699c0fcc39be6fed84f0bfe3', // entity id (not a wallet)
  ].filter(a => a.startsWith('0x') && a.length === 42);

  const extraBalances = [];
  for (const addr of extraAddresses) {
    try {
      const bal = await publicClient.readContract({ address: DMD_CONTRACT, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] });
      extraBalances.push({ address: addr, balance_dmd: (Number(bal) / 1e18).toFixed(2) });
    } catch (e) { /* skip */ }
  }

  return Response.json({
    total_supply_dmd: (Number(totalSupply) / 1e18).toFixed(2),
    gas_wallet_balance: (Number(gasBal) / 1e18).toFixed(2),
    transfer_history: allTransfers,
    extra_balances: extraBalances,
    note: 'If transfer_history empty, try Snowtrace: https://testnet.snowtrace.io/address/0x4D4e59Fc92337F99E6F7CFB54b3142213BABfE03#tokentxns'
  });
});