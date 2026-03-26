/**
 * mintMonitor.ts - Real-time Mint Monitoring System
 * 
 * Prevents Resolv-style exploits by monitoring mint activity in real-time
 * and triggering alerts/pauses when suspicious patterns detected.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Configuration
const MONITORING_CONFIG = {
  MAX_SINGLE_MINT: 100_000,
  MAX_HOURLY_MINT: 1_000_000,
  MAX_DAILY_MINT: 5_000_000,
  MAX_MINTS_PER_MINUTE: 10,
  VELOCITY_WINDOW_MS: 60_000,
  NORMAL_MINT_MULTIPLIER: 3,
  MIN_SAMPLES_FOR_BASELINE: 100,
  MIN_COLLATERAL_RATIO: 100,
  WARN_COLLATERAL_RATIO: 110,
  AUTO_PAUSE_ENABLED: true,
  NOTIFY_ADMIN_ON_ALERT: true
};

interface AlertEvent {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  message: string;
  data: any;
  timestamp: number;
  auto_paused?: boolean;
}

let baselineStats = {
  avgMintAmount: 0,
  totalSamples: 0,
  sumAmounts: 0
};

// Main monitoring function
async function monitorMintActivity(base44: any) {
  console.log('🔍 Starting mint activity scan...');
  
  const now = Date.now();
  const oneHourAgo = new Date(now - 3600_000).toISOString();
  const oneDayAgo = new Date(now - 86_400_000).toISOString();
  
  try {
    // Get recent mints
    const recentEvents = await base44.asServiceRole.entities.LedgerEvent.filter({
      type: 'earn',
      created_date_gte: oneHourAgo
    });
    
    const recentTransfers = await base44.asServiceRole.entities.BlockchainTransfer.filter({
      created_date_gte: oneHourAgo,
      status: 'confirmed'
    });
    
    console.log(`📊 Found ${recentEvents.length} ledger events`);
    
    const alerts: AlertEvent[] = [];
    
    // Check 1: Single large mint
    for (const event of recentEvents) {
      if (event.points > MONITORING_CONFIG.MAX_SINGLE_MINT) {
        alerts.push({
          severity: 'HIGH',
          type: 'LARGE_SINGLE_MINT',
          message: `Abnormally large mint: ${event.points} tokens`,
          data: {
            event_id: event.id,
            amount: event.points,
            client_id: event.client_id,
            company_id: event.company_id
          },
          timestamp: now
        });
      }
    }
    
    // Check 2: Hourly volume
    const hourlyVolume = recentEvents
      .filter(e => new Date(e.created_date).getTime() > Date.now() - 3600_000)
      .reduce((sum, e) => sum + (e.points || 0), 0);
    
    if (hourlyVolume > MONITORING_CONFIG.MAX_HOURLY_MINT) {
      alerts.push({
        severity: 'CRITICAL',
        type: 'HOURLY_LIMIT_EXCEEDED',
        message: `Hourly mint volume exceeded: ${hourlyVolume} tokens`,
        data: { hourlyVolume, limit: MONITORING_CONFIG.MAX_HOURLY_MINT },
        timestamp: now
      });
    }
    
    // Check 3: Daily volume
    const dailyEvents = await base44.asServiceRole.entities.LedgerEvent.filter({
      type: 'earn',
      created_date_gte: oneDayAgo
    });
    const dailyVolume = dailyEvents.reduce((sum, e) => sum + (e.points || 0), 0);
    
    if (dailyVolume > MONITORING_CONFIG.MAX_DAILY_MINT) {
      alerts.push({
        severity: 'CRITICAL',
        type: 'DAILY_LIMIT_EXCEEDED',
        message: `Daily mint volume exceeded: ${dailyVolume} tokens`,
        data: { dailyVolume, limit: MONITORING_CONFIG.MAX_DAILY_MINT },
        timestamp: now
      });
    }
    
    // Check 4: Mint velocity
    const recentMinuteEvents = recentEvents.filter(
      e => new Date(e.created_date).getTime() > now - MONITORING_CONFIG.VELOCITY_WINDOW_MS
    );
    
    if (recentMinuteEvents.length > MONITORING_CONFIG.MAX_MINTS_PER_MINUTE) {
      alerts.push({
        severity: 'HIGH',
        type: 'HIGH_MINT_VELOCITY',
        message: `High mint frequency: ${recentMinuteEvents.length} mints/minute`,
        data: { 
          count: recentMinuteEvents.length, 
          limit: MONITORING_CONFIG.MAX_MINTS_PER_MINUTE 
        },
        timestamp: now
      });
    }
    
    // Check 5: Collateral ratios
    const companies = await base44.asServiceRole.entities.Company.filter({
      onchain_enabled: true
    });
    
    for (const company of companies) {
      const tokens = await base44.asServiceRole.entities.CompanyToken.filter({
        company_id: company.id,
        is_active: true
      });
      
      for (const token of tokens) {
        if (!token.contract_address) continue;
        
        const distributed = token.distributed_tokens || 0;
        const treasury = token.treasury_balance || 0;
        const ratio = distributed > 0 ? (treasury / distributed) * 100 : 100;
        
        if (ratio < MONITORING_CONFIG.MIN_COLLATERAL_RATIO) {
          alerts.push({
            severity: 'CRITICAL',
            type: 'INSUFFICIENT_COLLATERAL',
            message: `Company ${company.name} has ${ratio.toFixed(1)}% collateral`,
            data: {
              company_id: company.id,
              company_name: company.name,
              token_symbol: token.token_symbol,
              ratio: ratio.toFixed(2)
            },
            timestamp: now
          });
        }
      }
    }
    
    // Check 6: Unbacked mints
    const suspiciousTxs = await base44.asServiceRole.entities.Transaction.filter({
      status: 'completed',
      created_date_gte: oneHourAgo
    });
    
    const unbacked = suspiciousTxs.filter(
      tx => !tx.blockchain_tx_hash || tx.blockchain_tx_hash.trim() === ''
    );
    
    if (unbacked.length > 0) {
      alerts.push({
        severity: 'CRITICAL',
        type: 'UNBACKED_MINTS_DETECTED',
        message: `Found ${unbacked.length} transactions without blockchain proof`,
        data: {
          count: unbacked.length,
          transactions: unbacked.map(tx => ({
            id: tx.id,
            amount: tx.amount,
            tokens: tx.tokens_expected
          }))
        },
        timestamp: now
      });
    }
    
    // Update baseline
    for (const event of recentEvents) {
      baselineStats.sumAmounts += event.points || 0;
      baselineStats.totalSamples++;
    }
    if (baselineStats.totalSamples > 0) {
      baselineStats.avgMintAmount = baselineStats.sumAmounts / baselineStats.totalSamples;
    }
    
    // Store alerts
    for (const alert of alerts) {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          company_id: alert.data?.company_id || 'system',
          action: 'security_alert',
          entity_type: 'MintMonitoring',
          entity_id: `alert_${now}`,
          performed_by: 'monitoring_system',
          details: {
            severity: alert.severity,
            type: alert.type,
            message: alert.message,
            data: alert.data
          }
        });
      } catch (err) {
        console.error('Failed to log alert:', err.message);
      }
      
      // Auto-pause on critical
      if (alert.severity === 'CRITICAL' && MONITORING_CONFIG.AUTO_PAUSE_ENABLED) {
        console.error('🛑 CRITICAL ALERT - Auto-pausing system');
        
        if (alert.data?.company_id) {
          try {
            await base44.asServiceRole.entities.Company.update(alert.data.company_id, {
              onchain_enabled: false,
              emergency_paused: true,
              emergency_pause_reason: alert.message,
              emergency_paused_at: new Date().toISOString()
            });
          } catch (err) {
            console.error('Failed to pause company:', err.message);
          }
        }
      }
      
      // Notify admin
      if (MONITORING_CONFIG.NOTIFY_ADMIN_ON_ALERT && 
          (alert.severity === 'HIGH' || alert.severity === 'CRITICAL')) {
        try {
          const adminPhone = Deno.env.get('ADMIN_ALERT_PHONE');
          if (adminPhone) {
            const message = `🚨 MOOADON SECURITY ALERT\n\nSeverity: ${alert.severity}\nType: ${alert.type}\n\n${alert.message}\n\nTime: ${new Date(alert.timestamp).toLocaleString()}`;
            
            await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
              phone: adminPhone,
              message,
              company_id: 'system'
            });
          }
        } catch (err) {
          console.error('Failed to notify admin:', err.message);
        }
      }
    }
    
    return {
      success: true,
      alerts: alerts.slice(-10),
      baseline: baselineStats,
      stats: {
        hourly_volume: hourlyVolume,
        daily_volume: dailyVolume,
        mints_per_minute: recentMinuteEvents.length
      }
    };
    
  } catch (error) {
    console.error('❌ Monitoring error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generateDailyReport(base44: any) {
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
  
  const dailyEvents = await base44.asServiceRole.entities.LedgerEvent.filter({
    type: 'earn',
    created_date_gte: oneDayAgo
  });
  
  const totalMinted = dailyEvents.reduce((sum, e) => sum + (e.points || 0), 0);
  const uniqueClients = new Set(dailyEvents.map(e => e.client_id)).size;
  const avgMintSize = dailyEvents.length > 0 ? totalMinted / dailyEvents.length : 0;
  
  const report = {
    date: new Date().toISOString().split('T')[0],
    stats: {
      total_minted: totalMinted,
      total_mints: dailyEvents.length,
      unique_clients: uniqueClients,
      avg_mint_size: avgMintSize.toFixed(2)
    },
    baseline: {
      avg_amount: baselineStats.avgMintAmount.toFixed(2),
      total_samples: baselineStats.totalSamples
    }
  };
  
  return report;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    // Auth check
    const serviceToken = Deno.env.get('INTERNAL_SERVICE_TOKEN');
    const authHeader = req.headers.get('authorization') || '';
    const isServiceCall = serviceToken && authHeader === `Bearer ${serviceToken}`;
    
    if (!isServiceCall) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'monitor';
    
    switch (action) {
      case 'monitor':
        return Response.json(await monitorMintActivity(base44));
        
      case 'report':
        const report = await generateDailyReport(base44);
        return Response.json({ success: true, report });
        
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ mintMonitor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});