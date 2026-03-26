import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function KitePaymentModal({
  isOpen,
  onClose,
  quotaData,
  companyId,
  onPaymentSuccess,
  onPaymentCancel,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!quotaData || quotaData.withinQuota) {
    return null;
  }

  const handlePayWithKite = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Redirect to Kite payment URL
      if (quotaData.paymentUrl) {
        window.location.href = quotaData.paymentUrl;
      } else {
        setError('Payment URL not available');
      }
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1f2128] border-[#2d2d3a] max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            Daily Quota Reached
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quota Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Today's Usage</span>
                <span className="text-white font-medium">
                  {quotaData.usedToday}/{quotaData.quotaLimit}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min((quotaData.usedToday / quotaData.quotaLimit) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Price Info */}
          <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Cost per generation</span>
              <span className="text-teal-400 font-semibold">
                ${quotaData.estimatedCost.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* CTA */}
          <div className="space-y-2 pt-2">
            <Button
              onClick={handlePayWithKite}
              disabled={isLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting to Kite...
                </>
              ) : (
                'Pay with Kite & Continue'
              )}
            </Button>
            <Button
              onClick={onClose}
              disabled={isLoading}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
          </div>

          {/* Info */}
          <p className="text-xs text-slate-500 text-center">
            You'll be redirected to Kite's secure payment page.
            <br />
            Upon successful payment, generation will start automatically.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}