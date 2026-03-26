import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Zap,
  Phone,
  QrCode,
  Loader2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { offlineQueue } from './OfflineQueueManager';

export default function FastCheckout({ companyId, branchId, cashier, onLogout }) {
  const [step, setStep] = useState('identify');
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [txnId, setTxnId] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) syncOfflineQueue();
  }, [isOnline]);

  const syncOfflineQueue = async () => {
    const pending = offlineQueue.getPendingTransactions();
    if (pending.length === 0) return;
    for (const txn of pending) {
      try {
        await base44.functions.invoke('createPOSTransaction', {
          phone: txn.phone,
          amount: txn.amount,
          order_id: txn.order_id,
          company_id: companyId,
          branch_id: branchId,
          offline_id: txn.id
        });
        offlineQueue.markAsSynced(txn.id);
        toast.success('Synced: ' + txn.phone);
      } catch (error) {
        offlineQueue.markAsFailed(txn.id, error);
      }
    }
  };

  const identifyCustomer = async () => {
    if (!phone.trim()) { toast.error('Enter phone number'); return; }
    setIsLoading(true);
    try {
      const clients = await base44.entities.Client.filter({ company_id: companyId, phone: phone.trim() });
      if (clients.length === 0) {
        const newClient = await base44.entities.Client.create({
          company_id: companyId, phone: phone.trim(), current_balance: 0, total_earned: 0, total_redeemed: 0
        });
        setCustomer(newClient);
      } else {
        setCustomer(clients[0]);
      }
      setStep('confirm');
    } catch (error) {
      toast.error('Error looking up customer');
    } finally {
      setIsLoading(false);
    }
  };

  const completeTransaction = async () => {
    if (!customer) return;
    setStep('processing');
    setIsLoading(true);
    try {
      const orderId = 'ORD-' + Date.now();
      if (!isOnline) {
        const txnId = offlineQueue.addToQueue({ phone: customer.phone, amount: 0, order_id: orderId, cashier_id: cashier?.pin });
        setTxnId(txnId);
        setStep('success');
        toast.success('Saved offline - will sync when online');
        setTimeout(resetCheckout, 2000);
        return;
      }
      // FIX: reward_type:'points' skips blockchain for amount=0 grants
      await base44.functions.invoke('createPOSTransaction', {
        phone: customer.phone,
        amount: 0,
        order_id: orderId,
        company_id: companyId,
        branch_id: branchId,
        reward_type: 'points'
      });
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setStep('success');
      setTxnId(orderId);
    } catch (error) {
      const txnId = offlineQueue.addToQueue({ phone: customer.phone, amount: 0, order_id: 'ORD-' + Date.now(), cashier_id: cashier?.pin });
      setTxnId(txnId);
      setStep('success');
      toast.warning('Saved to offline queue - will retry automatically');
    } finally {
      setIsLoading(false);
    }
  };

  const resetCheckout = () => { setPhone(''); setCustomer(null); setStep('identify'); setTxnId(null); };

  return (
    <div className="min-h-screen bg-[#17171f] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-6 bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4">
        <div>
          <h1 className="text-xl font-bold text-white">{cashier?.name}</h1>
          <p className="text-xs text-[#9ca3af]">Fast Checkout</p>
        </div>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/30 rounded px-3 py-1">
              <Clock className="w-3 h-3 text-yellow-500" />
              <span className="text-xs text-yellow-500 font-medium">Offline Mode</span>
            </div>
          )}
          <Button onClick={onLogout} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm h-8">
            Logout
          </Button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
          <CardContent className="p-8 space-y-6">

            {step === 'identify' && (
              <>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-1">Identify Customer</h2>
                  <p className="text-xs text-[#9ca3af]">Phone number or scan QR/NFC</p>
                </div>
                <Input
                  type="tel"
                  placeholder="+972 50 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && identifyCustomer()}
                  className="text-lg h-14 bg-[#17171f] border-[#2d2d3a] text-white text-center"
                  dir="ltr"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={identifyCustomer} disabled={isLoading || !phone.trim()} className="h-12 text-base bg-[#10b981] hover:bg-[#059669]">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Look up'}
                  </Button>
                  <Button variant="outline" className="h-12 border-[#2d2d3a] gap-2">
                    <QrCode className="w-5 h-5" />
                    Scan
                  </Button>
                </div>
              </>
            )}

            {step === 'confirm' && customer && (
              <>
                <div className="text-center">
                  <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-teal-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white mb-2">Grant Reward</h2>
                </div>
                <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#9ca3af]">Customer:</span>
                    <span className="text-white font-semibold">{customer.phone}</span>
                  </div>
                  <div className="h-px bg-[#2d2d3a]" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#9ca3af]">Balance:</span>
                    <span className="text-lg font-bold text-[#10b981]">{(customer.current_balance || 0).toLocaleString()}</span>
                  </div>
                  {customer.full_name && (
                    <>
                      <div className="h-px bg-[#2d2d3a]" />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#9ca3af]">Name:</span>
                        <span className="text-white font-medium">{customer.full_name}</span>
                      </div>
                    </>
                  )}
                </div>
                <Button onClick={completeTransaction} disabled={isLoading} className="w-full h-16 text-lg font-bold bg-[#10b981] hover:bg-[#059669]">
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Zap className="w-6 h-6 mr-2" />Grant Reward Now</>}
                </Button>
                <Button onClick={() => { setPhone(''); setStep('identify'); setCustomer(null); }} variant="outline" className="w-full border-[#2d2d3a]">
                  Cancel
                </Button>
              </>
            )}

            {step === 'processing' && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Clock className="w-8 h-8 text-yellow-500" />
                </div>
                <h2 className="text-xl font-bold text-white">Processing...</h2>
                <p className="text-sm text-[#9ca3af]">Granting reward to {customer?.phone}</p>
              </div>
            )}

            {step === 'success' && (
              <>
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">{isOnline ? 'Reward Sent' : 'Saved Offline'}</h2>
                  <p className="text-sm text-[#9ca3af]">{customer?.phone}</p>
                  <p className="text-xs text-[#9ca3af]">ID: {txnId}</p>
                </div>
                <Button onClick={resetCheckout} className="w-full h-12 bg-[#10b981] hover:bg-[#059669]">Next Customer</Button>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}