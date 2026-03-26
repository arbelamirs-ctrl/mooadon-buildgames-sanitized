/**
 * Company & Token Audit Script
 * 
 * Purpose: Get REAL state of every company before any refactor
 * 
 * Checks:
 * 1. Company.onchain_network
 * 2. CompanyToken.chain
 * 3. Contract addresses
 * 4. Treasury wallets
 * 5. On-chain balances (tokens + AVAX)
 * 6. Mismatches between DB and reality
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createPublicClient, http, formatEther, formatUnits } from 'npm:viem@2.7.0';
import { avalancheFuji, avalanche } from 'npm:viem@2.7.0/chains';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view'
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const base44 = createClientFromRequest(req);
    
    // Admin check
    const user = await base44.auth.me().catch(() => null);
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Starting Company Audit...');

    // Fetch all companies
    const companies = await base44.asServiceRole.entities.Company.list('-created_date');
    console.log(`📋 Found ${companies.length} companies to audit`);

    const results = [];

    // Wallets to check
    const OWNER_WALLET = Deno.env.get('OWNER_WALLET_ADDRESS') || '';
    const GAS_WALLET_KEY = Deno.env.get('GAS_WALLET_PRIVATE_KEY') || '';
    let GAS_WALLET = '';
    
    if (GAS_WALLET_KEY) {
      const { privateKeyToAddress } = await import('npm:viem@2.7.0/accounts');
      const key = GAS_WALLET_KEY.startsWith('0x') ? GAS_WALLET_KEY : `0x${GAS_WALLET_KEY}`;
      GAS_WALLET = privateKeyToAddress(key);
    }

    // RPC clients
    const fujiRpc = Deno.env.get('FUJI_RPC_URL') || 'https://api.avax-test.network/ext/bc/C/rpc';
    const mainnetRpc = Deno.env.get('MAINNET_RPC_URL') || 'https://api.avax.network/ext/bc/C/rpc';
    
    const fujiClient = createPublicClient({ chain: avalancheFuji, transport: http(fujiRpc) });
    const mainnetClient = createPublicClient({ chain: avalanche, transport: http(mainnetRpc) });

    for (const company of companies) {
      console.log(`\n🏢 Auditing: ${company.name} (${company.client_number || 'no client#'})`);
      
      const result = {
        company_id: company.id,
        company_name: company.name,
        client_number: company.client_number || 'N/A',
        db_network: company.onchain_network || 'not_set',
        db_token_chain: 'N/A',
        contract_address: 'N/A',
        treasury_wallet: 'N/A',
        fuji_treasury_token_balance: '0',
        fuji_treasury_avax_balance: '0',
        fuji_owner_token_balance: '0',
        fuji_owner_avax_balance: '0',
        fuji_gas_token_balance: '0',
        fuji_gas_avax_balance: '0',
        mainnet_treasury_token_balance: null,
        mainnet_treasury_avax_balance: null,
        who_holds_supply: 'unknown',
        who_has_gas: 'none',
        network_mismatch: false,
        status: 'OK',
        issues: []
      };

      try {
        // Get company token
        const companyTokens = await base44.asServiceRole.entities.CompanyToken.filter({ 
          company_id: company.id 
        });
        
        if (companyTokens.length === 0) {
          result.status = 'ERROR';
          result.issues.push('No CompanyToken found');
          results.push(result);
          continue;
        }

        // Get active token (prefer active with contract_address)
        const activeTokens = companyTokens.filter(t => t.is_active !== false && t.contract_address);
        const companyToken = activeTokens.length > 0
          ? activeTokens[activeTokens.length - 1]
          : companyTokens[companyTokens.length - 1];

        result.db_token_chain = companyToken.chain || 'not_set';
        result.contract_address = companyToken.contract_address || 'N/A';
        result.treasury_wallet = companyToken.treasury_wallet || 'N/A';

        if (!companyToken.contract_address) {
          result.status = 'ERROR';
          result.issues.push('No contract_address in CompanyToken');
          results.push(result);
          continue;
        }

        const contractAddress = companyToken.contract_address.includes('$')
          ? companyToken.contract_address.split('$')[1]
          : companyToken.contract_address;

        // Check network mismatch
        if (result.db_network !== result.db_token_chain) {
          result.network_mismatch = true;
          result.issues.push(`Network mismatch: company.onchain_network=${result.db_network}, token.chain=${result.db_token_chain}`);
        }

        // === FUJI CHECKS ===
        console.log('  📡 Checking Fuji balances...');
        
        // Treasury wallet on Fuji
        if (companyToken.treasury_wallet) {
          try {
            const tokenBal = await fujiClient.readContract({
              address: contractAddress,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [companyToken.treasury_wallet]
            });
            result.fuji_treasury_token_balance = formatUnits(tokenBal, 18);

            const avaxBal = await fujiClient.getBalance({ address: companyToken.treasury_wallet });
            result.fuji_treasury_avax_balance = formatEther(avaxBal);
          } catch (err) {
            result.issues.push(`Fuji treasury check failed: ${err.message}`);
          }
        }

        // OWNER wallet on Fuji
        if (OWNER_WALLET) {
          try {
            const tokenBal = await fujiClient.readContract({
              address: contractAddress,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [OWNER_WALLET]
            });
            result.fuji_owner_token_balance = formatUnits(tokenBal, 18);

            const avaxBal = await fujiClient.getBalance({ address: OWNER_WALLET });
            result.fuji_owner_avax_balance = formatEther(avaxBal);
          } catch (err) {
            result.issues.push(`Fuji owner check failed: ${err.message}`);
          }
        }

        // GAS wallet on Fuji
        if (GAS_WALLET) {
          try {
            const tokenBal = await fujiClient.readContract({
              address: contractAddress,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [GAS_WALLET]
            });
            result.fuji_gas_token_balance = formatUnits(tokenBal, 18);

            const avaxBal = await fujiClient.getBalance({ address: GAS_WALLET });
            result.fuji_gas_avax_balance = formatEther(avaxBal);
          } catch (err) {
            result.issues.push(`Fuji gas wallet check failed: ${err.message}`);
          }
        }

        // === MAINNET CHECKS (only if DB says mainnet) ===
        if (result.db_network === 'mainnet' || result.db_network === 'avalanche') {
          console.log('  📡 Checking Mainnet balances...');
          
          if (companyToken.treasury_wallet) {
            try {
              const tokenBal = await mainnetClient.readContract({
                address: contractAddress,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [companyToken.treasury_wallet]
              });
              result.mainnet_treasury_token_balance = formatUnits(tokenBal, 18);

              const avaxBal = await mainnetClient.getBalance({ address: companyToken.treasury_wallet });
              result.mainnet_treasury_avax_balance = formatEther(avaxBal);
            } catch (err) {
              result.issues.push(`Mainnet treasury check failed: ${err.message}`);
            }
          }
        }

        // === ANALYSIS ===
        const fujiBalances = {
          treasury: parseFloat(result.fuji_treasury_token_balance),
          owner: parseFloat(result.fuji_owner_token_balance),
          gas: parseFloat(result.fuji_gas_token_balance)
        };

        const fujiGas = {
          treasury: parseFloat(result.fuji_treasury_avax_balance),
          owner: parseFloat(result.fuji_owner_avax_balance),
          gas: parseFloat(result.fuji_gas_avax_balance)
        };

        // Who holds supply?
        const maxBalance = Math.max(fujiBalances.treasury, fujiBalances.owner, fujiBalances.gas);
        if (maxBalance === 0) {
          result.who_holds_supply = 'NONE - supply missing!';
          result.status = 'ERROR';
          result.issues.push('No wallet holds token supply on Fuji');
        } else if (fujiBalances.treasury === maxBalance) {
          result.who_holds_supply = 'treasury';
        } else if (fujiBalances.owner === maxBalance) {
          result.who_holds_supply = 'OWNER (not treasury!)';
          result.issues.push('OWNER wallet holds supply instead of treasury');
        } else if (fujiBalances.gas === maxBalance) {
          result.who_holds_supply = 'GAS (not treasury!)';
          result.issues.push('GAS wallet holds supply instead of treasury');
        }

        // Who has gas?
        const walletsWithGas = [];
        if (fujiGas.treasury > 0.01) walletsWithGas.push('treasury');
        if (fujiGas.owner > 0.01) walletsWithGas.push('owner');
        if (fujiGas.gas > 0.01) walletsWithGas.push('gas');

        if (walletsWithGas.length === 0) {
          result.who_has_gas = 'NONE - no AVAX!';
          result.status = 'ERROR';
          result.issues.push('No wallet has AVAX for gas on Fuji');
        } else if (walletsWithGas.length > 1) {
          result.who_has_gas = walletsWithGas.join('+');
        } else {
          result.who_has_gas = walletsWithGas[0];
        }

        // Final status
        if (result.issues.length > 0 && result.status === 'OK') {
          result.status = 'MISMATCH';
        }

      } catch (error) {
        result.status = 'ERROR';
        result.issues.push(`Audit failed: ${error.message}`);
        console.error(`  ❌ Error: ${error.message}`);
      }

      results.push(result);
    }

    // Generate summary
    const summary = {
      total_companies: results.length,
      ok: results.filter(r => r.status === 'OK').length,
      mismatch: results.filter(r => r.status === 'MISMATCH').length,
      error: results.filter(r => r.status === 'ERROR').length,
      network_mismatches: results.filter(r => r.network_mismatch).length,
      companies_on_fuji: results.filter(r => r.db_network === 'fuji').length,
      companies_on_mainnet: results.filter(r => r.db_network === 'mainnet' || r.db_network === 'avalanche').length,
      companies_undefined: results.filter(r => !r.db_network || r.db_network === 'not_set').length
    };

    console.log('\n📊 === AUDIT SUMMARY ===');
    console.log(`Total: ${summary.total_companies}`);
    console.log(`✅ OK: ${summary.ok}`);
    console.log(`⚠️ Mismatch: ${summary.mismatch}`);
    console.log(`❌ Error: ${summary.error}`);
    console.log(`\n🌐 Network Distribution:`);
    console.log(`  Fuji: ${summary.companies_on_fuji}`);
    console.log(`  Mainnet: ${summary.companies_on_mainnet}`);
    console.log(`  Undefined: ${summary.companies_undefined}`);
    console.log(`\n🔴 Network Mismatches: ${summary.network_mismatches}`);

    return Response.json({
      success: true,
      summary,
      results,
      timestamp: new Date().toISOString(),
      wallets_checked: {
        owner: OWNER_WALLET,
        gas: GAS_WALLET
      }
    });

  } catch (error) {
    console.error('❌ Audit error:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});