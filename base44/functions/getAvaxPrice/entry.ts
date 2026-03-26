import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.10.0';

const CHAINLINK_ABI = [
  { inputs: [], name: 'latestRoundData', outputs: [{ name: 'roundId', type: 'uint80' }, { name: 'answer', type: 'int256' }, { name: 'startedAt', type: 'uint256' }, { name: 'updatedAt', type: 'uint256' }, { name: 'answeredInRound', type: 'uint80' }], stateMutability: 'view', type: 'function' }
];

const CONTRACTS = {
  mainnet: { address: '0x0A77230d17318075983913bC2145DB16C7366156', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
  fuji: { address: '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD', rpc: 'https://api.avax-test.network/ext/bc/C/rpc' }
};

const PRICE_CACHE = { price_usd: null, timestamp: null, source: null, fx_rate: null, fx_timestamp: null };
const CACHE_DURATION = 60000;
const FX_CACHE_DURATION = 3600000; // 1 hour
const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

async function fetchFromChainlink(network) {
  const config = CONTRACTS[network];
  const provider = new ethers.JsonRpcProvider(config.rpc);
  const contract = new ethers.Contract(config.address, CHAINLINK_ABI, provider);
  const data = await contract.latestRoundData();
  const priceUsd = Number(data.answer) / 1e8;
  return { price_usd: priceUsd, last_updated: new Date(Number(data.updatedAt) * 1000).toISOString() };
}

async function fetchFromCoinGecko() {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd');
  const data = await res.json();
  return { price_usd: data['avalanche-2'].usd, last_updated: new Date().toISOString() };
}

async function fetchFxRateUsdIls() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!res.ok) throw new Error('FX API error');
    const data = await res.json();
    return { fx_rate: data.rates.ILS, fx_source: 'exchangerate-api' };
  } catch (err) {
    console.warn('FX API failed, using fallback rate 3.7:', err.message);
    return { fx_rate: 3.7, fx_source: 'fallback' };
  }
}

async function getPriceFromNetwork(network) {
  let isStale = false;
  try {
    const data = await fetchFromChainlink(network);
    const now = Date.now();
    const updatedAt = new Date(data.last_updated).getTime();
    
    // Check if Chainlink data is fresh
    if (now - updatedAt > STALE_THRESHOLD) {
      console.warn(`Chainlink data stale (${Math.floor((now - updatedAt) / 1000)}s old), falling back to CoinGecko`);
      isStale = true;
      throw new Error('Chainlink data is stale');
    }
    
    return { ...data, source: 'chainlink', is_stale: false };
  } catch (err) {
    console.warn(`Chainlink failed for ${network}, trying CoinGecko:`, err.message);
    try {
      const data = await fetchFromCoinGecko();
      return { ...data, source: 'coingecko', is_stale: isStale };
    } catch (fallbackErr) {
      throw new Error(`All price sources failed: ${fallbackErr.message}`);
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id } = await req.json();
    if (!company_id) return Response.json({ error: 'company_id required' }, { status: 400 });

    // Check FX rate cache
    let fxData = { fx_rate: 3.7, fx_source: 'fallback' };
    if (!PRICE_CACHE.fx_timestamp || Date.now() - PRICE_CACHE.fx_timestamp > FX_CACHE_DURATION) {
      fxData = await fetchFxRateUsdIls();
      PRICE_CACHE.fx_rate = fxData.fx_rate;
      PRICE_CACHE.fx_timestamp = Date.now();
    } else {
      fxData = { fx_rate: PRICE_CACHE.fx_rate, fx_source: PRICE_CACHE.fx_source };
    }

    // Check price cache
    if (PRICE_CACHE.timestamp && Date.now() - PRICE_CACHE.timestamp < CACHE_DURATION) {
      const result = { ...PRICE_CACHE, price_ils: PRICE_CACHE.price_usd * fxData.fx_rate, ...fxData, cached: true };
      return Response.json(result);
    }

    // Fetch company to detect network
    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    const company = companies[0];
    const isTestnet = !company || company.wallet_chain === 'avalanche_fuji' || Deno.env.get('MOOD_ENV') !== 'production';
    const network = isTestnet ? 'fuji' : 'mainnet';

    // Get price
    const priceData = await getPriceFromNetwork(network);
    const priceIls = priceData.price_usd * fxData.fx_rate;
    const result = { ...priceData, price_ils: priceIls, ...fxData };

    // Save to cache
    Object.assign(PRICE_CACHE, priceData);
    PRICE_CACHE.timestamp = Date.now();

    // Save to PriceHistory with dedup by minute
    if (company_id) {
      const minuteKey = new Date(priceData.last_updated).toISOString().slice(0, 16);
      const existing = await base44.asServiceRole.entities.PriceHistory.filter({
        company_id,
        minute_key: minuteKey,
        network
      });

      const deduped = existing.length > 0;
      console.log('[getAvaxPrice] REFRESH', {
        company_id,
        source: priceData.source,
        is_stale: priceData.is_stale || false,
        fx_source: fxData.fx_source,
        fx_rate: fxData.fx_rate,
        minute_key: minuteKey,
        network,
        price_usd: priceData.price_usd,
        price_ils: priceIls,
        deduped
      });

      if (!deduped) {
        base44.asServiceRole.entities.PriceHistory.create({
          company_id,
          timestamp: priceData.last_updated,
          minute_key: minuteKey,
          price_usd: priceData.price_usd,
          price_ils: priceIls,
          fx_rate_usd_ils: fxData.fx_rate,
          fx_source: fxData.fx_source,
          source: priceData.source,
          network,
          is_stale: priceData.is_stale || false
        }).catch(err => console.error('Failed to save price history:', err));
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error('[getAvaxPrice]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});