import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function SquareIntegration({ companyId }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    loadConnectionStatus();
  }, [companyId]);

  const loadConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await base44.functions.invoke('squareOAuth', {
        action: 'status',
        company_id: companyId
      });

      if (response.data.connected) {
        setConnection(response.data.connection);
      } else {
        setConnection(null);
      }
    } catch (error) {
      console.error('Error loading status:', error);
      toast.error('Failed to load Square connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      
      // Step 1: Initiate OAuth flow
      const response = await base44.functions.invoke('squareOAuth', {
        action: 'initiate',
        company_id: companyId
      });

      if (response.data.success) {
        // Redirect to Square authorization page
        window.location.href = response.data.authorization_url;
      } else {
        toast.error('Failed to initiate Square connection');
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect to Square');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Square? This will stop automatic token awards.')) {
      return;
    }

    try {
      setLoading(true);
      
      const response = await base44.functions.invoke('squareOAuth', {
        action: 'disconnect',
        company_id: companyId
      });

      if (response.data.success) {
        toast.success('Square disconnected successfully');
        setConnection(null);
      } else {
        toast.error('Failed to disconnect Square');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect Square');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      toast.info('Syncing transactions from Square...', { duration: 3000 });
      
      const response = await base44.functions.invoke('squareSync', {
        company_id: companyId,
        days: 30
      });

      if (response.data.success) {
        const { results } = response.data;
        toast.success(
          `Sync complete! Synced: ${results.synced}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
          { duration: 5000 }
        );
        loadConnectionStatus();
      } else {
        toast.error('Failed to sync transactions');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1f2128] border-[#2d2d3a]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.01 8.54C6.23 4.92 10.5 3 14.5 3c5.5 0 9.96 4.5 9.96 10s-4.46 10-9.96 10c-4 0-8.27-1.92-10.49-5.54L1.5 15l2.51-2.46z"/>
              </svg>
              Square POS Integration
            </CardTitle>
            <CardDescription className="text-[#9ca3af] mt-1">
              Connect your Square account to automatically award loyalty tokens
            </CardDescription>
          </div>
          {connection && (
            <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!connection ? (
          // Not connected state
          <div className="space-y-4">
            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Benefits</h4>
              <ul className="space-y-2 text-sm text-[#9ca3af]">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                  <span>Automatically award tokens for Square payments</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                  <span>Real-time webhook notifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                  <span>Sync historical transactions (up to 30 days)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                  <span>Secure OAuth 2.0 authentication</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect Square
                </>
              )}
            </Button>

            <p className="text-xs text-[#9ca3af] text-center">
              You'll be redirected to Square to authorize access
            </p>
          </div>
        ) : (
          // Connected state
          <div className="space-y-4">
            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#9ca3af]">Merchant Name</p>
                  <p className="text-sm text-white font-medium mt-1">{connection.merchant_name}</p>
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af]">Environment</p>
                  <p className="text-sm text-white font-medium mt-1">
                    {connection.environment === 'production' ? 'Production' : 'Sandbox'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af]">Merchant ID</p>
                  <p className="text-sm text-white font-mono mt-1">{connection.merchant_id}</p>
                </div>
                <div>
                  <p className="text-xs text-[#9ca3af]">Last Synced</p>
                  <p className="text-sm text-white font-medium mt-1">
                    {connection.last_synced 
                      ? new Date(connection.last_synced).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3">
              <p className="text-sm text-teal-400">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Square is connected! Payments will automatically award loyalty tokens.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSync}
                disabled={syncing}
                variant="outline"
                className="flex-1 border-[#2d2d3a] text-white"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Transactions
                  </>
                )}
              </Button>

              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>

            <p className="text-xs text-[#9ca3af]">
              Tip: Click "Sync Transactions" to import historical payments from the last 30 days
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}