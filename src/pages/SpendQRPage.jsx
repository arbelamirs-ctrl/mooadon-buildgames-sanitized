import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  QrCode, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Wallet,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function SpendQRPage() {
  const [clientPhone, setClientPhone] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [currentSession, setCurrentSession] = useState(null);
  const [showInput, setShowInput] = useState(true);
  const [timeLeft, setTimeLeft] = useState(300);

  // Fetch user's company
  const { data: userCompany } = useQuery({
    queryKey: ['userCompany'],
    queryFn: async () => {
      try {
        const user = await base44.auth.me();
        const perms = await base44.entities.UserPermission.filter({
          user_id: user.id,
          is_active: true
        });
        if (perms.length > 0) {
          const companies = await base44.entities.Company.filter({ id: perms[0].company_id });
          const branches = await base44.entities.Branch.filter({ company_id: perms[0].company_id });
          return { company: companies[0], branch: branches[0], company_id: perms[0].company_id };
        }
      } catch (e) {
        console.log('Not authenticated');
      }
      return null;
    }
  });

  // Generate QR code
  const generateQRMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('generateSpendQR', data);
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to generate QR');
      }
      return response.data;
    },
    onSuccess: (data) => {
      setCurrentSession(data);
      setShowInput(false);
      setTimeLeft(300);
      toast.success('QR code generated!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate QR');
    }
  });

  // Poll session status
  const { data: sessionStatus } = useQuery({
    queryKey: ['spendSession', currentSession?.session_id],
    queryFn: async () => {
      const sessions = await base44.entities.SpendSession.filter({
        id: currentSession.session_id
      });
      return sessions[0] || null;
    },
    enabled: !!currentSession?.session_id,
    refetchInterval: 2000 // Poll every 2 seconds
  });

  // Timer countdown
  useEffect(() => {
    if (!currentSession) return;

    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setCurrentSession(null);
          toast.error('QR code expired');
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSession]);

  // Auto-populate from user company if available
  useEffect(() => {
    if (userCompany?.company_id && userCompany?.branch) {
      setCompanyId(userCompany.company_id);
      setBranchId(userCompany.branch.id);
    }
  }, [userCompany]);

  const handleGenerateQR = () => {
    if (!clientPhone.trim()) {
      toast.error('Enter customer phone number');
      return;
    }
    if (!companyId || !branchId) {
      toast.error('Company and branch information required');
      return;
    }

    generateQRMutation.mutate({
      client_phone: clientPhone.trim(),
      company_id: companyId,
      branch_id: branchId
    });
  };

  const handleNewQR = () => {
    setCurrentSession(null);
    setShowInput(true);
    setClientPhone('');
    setTimeLeft(300);
  };

  // Get client balance
  const { data: clientBalance } = useQuery({
    queryKey: ['clientBalance', clientPhone, companyId],
    queryFn: async () => {
      if (!clientPhone || !companyId) return null;
      const clients = await base44.entities.Client.filter({
        company_id: companyId,
        phone: clientPhone
      });
      return clients[0] || null;
    },
    enabled: !!clientPhone && !!companyId && showInput
  });

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const expirationPercent = (timeLeft / 300) * 100;

  if (currentSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="bg-gradient-to-r from-[#10b981] to-[#0891b2] text-white text-center p-6">
            <CardTitle className="flex items-center justify-center gap-2">
              <QrCode className="w-6 h-6" />
              Payment QR Code
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            {/* Status Badge */}
            <div className="text-center">
              {sessionStatus?.status === 'pending' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-amber-400">Waiting for scan...</span>
                </div>
              )}
              {sessionStatus?.status === 'authorized' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/30">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  <span className="text-sm text-[#10b981]">Authorized</span>
                </div>
              )}
              {sessionStatus?.status === 'captured' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/30">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  <span className="text-sm text-[#10b981]">Captured</span>
                </div>
              )}
            </div>

            {/* QR Code Display */}
            <div className="bg-white p-4 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <QrCode className="w-32 h-32 text-slate-800 mx-auto" />
                <p className="text-xs text-slate-500 mt-2 font-mono break-all">
                  {currentSession.qr_token.substring(0, 16)}...
                </p>
              </div>
            </div>

            {/* Timer */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#9ca3af]">Expires in:</span>
                <span className={`font-mono font-semibold ${expirationPercent > 25 ? 'text-[#10b981]' : 'text-orange-500'}`}>
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>
              <div className="w-full bg-[#2d2d3a] rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${expirationPercent > 25 ? 'bg-[#10b981]' : 'bg-orange-500'}`}
                  style={{ width: `${expirationPercent}%` }}
                />
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 space-y-2">
              <div className="text-xs text-[#9ca3af]">Customer</div>
              <div className="flex items-center gap-2 text-white">
                <Wallet className="w-4 h-4 text-[#10b981]" />
                <span className="font-mono text-sm">{clientPhone}</span>
              </div>
              {clientBalance && (
                <div className="text-xs text-[#9ca3af] mt-2">
                  Current Balance: <span className="text-[#10b981] font-semibold">{clientBalance.current_balance || 0}</span> tokens
                </div>
              )}
            </div>

            {/* Action Button */}
            <Button
              onClick={handleNewQR}
              variant="outline"
              className="w-full border-[#2d2d3a] text-[#9ca3af] hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate New QR
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardHeader className="bg-gradient-to-r from-[#10b981] to-[#0891b2] text-white text-center p-6">
            <CardTitle className="flex items-center justify-center gap-2">
              <Wallet className="w-6 h-6" />
              Token Payment
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            <p className="text-[#9ca3af] text-sm">
              Generate a payment QR code to accept token payments at your store.
            </p>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Customer Phone
              </label>
              <Input
                type="tel"
                placeholder="+972 50 123 4567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="bg-[#17171f] border-[#2d2d3a] text-white"
                disabled={generateQRMutation.isPending}
              />
            </div>

            {userCompany && (
              <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 space-y-2 text-sm">
                <div>
                  <span className="text-[#9ca3af]">Company: </span>
                  <span className="text-white font-medium">{userCompany.company?.name}</span>
                </div>
                <div>
                  <span className="text-[#9ca3af]">Branch: </span>
                  <span className="text-white font-medium">{userCompany.branch?.name}</span>
                </div>
              </div>
            )}

            {clientBalance && (
              <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg p-3">
                <p className="text-xs text-[#10b981]">
                  Customer Balance: <span className="font-bold">{clientBalance.current_balance || 0}</span> tokens
                </p>
              </div>
            )}

            <Button
              onClick={handleGenerateQR}
              disabled={!clientPhone.trim() || generateQRMutation.isPending}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white h-11"
            >
              {generateQRMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Generate Payment QR
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}