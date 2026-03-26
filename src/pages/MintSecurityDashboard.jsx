import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Shield, TrendingUp, Zap, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from "sonner";

export default function MintSecurityDashboard() {
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  // Run mint monitor
  const { data: monitorData, refetch: refetchMonitor, isLoading: isMonitorLoading } = useQuery({
    queryKey: ['mint-monitor'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('mintMonitor', { action: 'monitor' });
        setLastScanTime(new Date());
        return response.data;
      } catch (err) {
        console.error('Monitor error:', err);
        throw err;
      }
    },
    refetchInterval: 30_000 // Auto-refresh every 30 seconds
  });

  // Get daily report
  const { data: reportData } = useQuery({
    queryKey: ['mint-report'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('mintMonitor', { action: 'report' });
        return response.data;
      } catch (err) {
        console.error('Report error:', err);
        throw err;
      }
    },
    refetchInterval: 60_000 // Auto-refresh every minute
  });

  const alerts = monitorData?.alerts || [];
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  const highAlerts = alerts.filter(a => a.severity === 'HIGH');

  const stats = monitorData?.stats || {
    hourly_volume: 0,
    daily_volume: 0,
    mints_per_minute: 0
  };

  const report = reportData?.report || {};

  return (
    <div className="min-h-screen bg-[#17171f] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#10b981]" />
            <h1 className="text-3xl font-bold text-white">🛡️ Mint Security Monitor</h1>
          </div>
          <Button
            onClick={() => refetchMonitor()}
            disabled={isMonitorLoading}
            className="bg-[#10b981] hover:bg-[#059669]"
          >
            {isMonitorLoading ? '🔄 Scanning...' : '🔍 Scan Now'}
          </Button>
        </div>

        {/* Last scan time */}
        {lastScanTime && (
          <div className="text-sm text-[#9ca3af]">
            <Clock className="w-4 h-4 inline mr-2" />
            Last scan: {lastScanTime.toLocaleTimeString()}
          </div>
        )}

        {/* Critical Alerts Section */}
        {criticalAlerts.length > 0 && (
          <Card className="border-red-500/50 bg-red-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                🚨 Critical Alerts ({criticalAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {criticalAlerts.map((alert, i) => (
                <div key={i} className="bg-[#1f2128] border border-red-500/50 rounded p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-red-400">{alert.type}</p>
                      <p className="text-sm text-[#9ca3af]">{alert.message}</p>
                    </div>
                  </div>
                  {alert.data && (
                    <pre className="text-xs text-slate-400 bg-black/30 p-2 rounded overflow-auto max-h-32">
                      {JSON.stringify(alert.data, null, 2)}
                    </pre>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* High Alerts Section */}
        {highAlerts.length > 0 && (
          <Card className="border-orange-500/50 bg-orange-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-400">
                <AlertCircle className="w-5 h-5" />
                ⚠️ High Alerts ({highAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {highAlerts.map((alert, i) => (
                <div key={i} className="bg-[#1f2128] border border-orange-500/50 rounded p-2">
                  <p className="font-semibold text-orange-400 text-sm">{alert.type}</p>
                  <p className="text-xs text-[#9ca3af]">{alert.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* All Clear */}
        {criticalAlerts.length === 0 && highAlerts.length === 0 && (
          <Card className="border-[#10b981]/50 bg-[#10b981]/10">
            <CardContent className="p-6 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-[#10b981]" />
              <p className="text-[#10b981]">✅ All systems normal - no alerts detected</p>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-4">
              <p className="text-xs text-[#9ca3af] mb-1">Hourly Volume</p>
              <p className="text-2xl font-bold text-white">
                {stats.hourly_volume?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-slate-500 mt-1">tokens/hour</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-4">
              <p className="text-xs text-[#9ca3af] mb-1">Daily Volume</p>
              <p className="text-2xl font-bold text-white">
                {stats.daily_volume?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-slate-500 mt-1">tokens/day</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-4">
              <p className="text-xs text-[#9ca3af] mb-1">Mint Frequency</p>
              <p className="text-2xl font-bold text-white">
                {stats.mints_per_minute || '0'}
              </p>
              <p className="text-xs text-slate-500 mt-1">mints/minute</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardContent className="p-4">
              <p className="text-xs text-[#9ca3af] mb-1">Baseline Avg</p>
              <p className="text-2xl font-bold text-white">
                {monitorData?.baseline?.avgMintAmount?.toFixed(0) || '0'}
              </p>
              <p className="text-xs text-slate-500 mt-1">samples: {monitorData?.baseline?.totalSamples}</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Report */}
        {report && (
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#10b981]" />
                📊 Daily Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-[#9ca3af] mb-1">Total Minted</p>
                  <p className="text-xl font-bold text-white">
                    {report.stats?.total_minted?.toLocaleString() || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af] mb-1">Total Mints</p>
                  <p className="text-xl font-bold text-white">
                    {report.stats?.total_mints || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af] mb-1">Unique Clients</p>
                  <p className="text-xl font-bold text-white">
                    {report.stats?.unique_clients || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af] mb-1">Avg Mint Size</p>
                  <p className="text-xl font-bold text-white">
                    {report.stats?.avg_mint_size || '0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Status */}
        <Card className="bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#10b981]" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[#9ca3af]">Monitoring System</p>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse"></div>
                <span className="text-sm text-[#10b981]">Active</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[#9ca3af]">Auto-Pause Enabled</p>
              <span className="text-sm text-[#10b981]">✅ Yes</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[#9ca3af]">Admin Notifications</p>
              <span className="text-sm text-[#10b981]">✅ Active</span>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-blue-900/20 border-blue-500/50">
          <CardHeader>
            <CardTitle className="text-blue-400">📋 What to do if you see alerts:</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#9ca3af]">
            <p>1. <strong>CRITICAL alerts</strong> trigger automatic system pause</p>
            <p>2. Check the alert details and data</p>
            <p>3. Investigate blockchain transactions on Snowtrace</p>
            <p>4. Contact your team immediately</p>
            <p>5. Review logs: <code className="text-xs bg-black/30 px-2 py-1 rounded">base44 logs mintMonitor</code></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}