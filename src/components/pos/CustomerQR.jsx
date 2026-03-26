import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, QrCode } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerQR({ phone, companyId }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef(null);

  const generateQR = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('generateCustomerQR', {
        phone,
        company_id: companyId
      });
      if (result.data?.success) {
        setQrData(result.data);
        setSecondsLeft(60);
      } else {
        toast.error('Failed to generate QR');
      }
    } catch {
      toast.error('Failed to generate QR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phone && companyId) generateQR();
  }, [phone, companyId]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qrData]);

  // Auto-refresh when expired
  useEffect(() => {
    if (secondsLeft === 0 && qrData) {
      generateQR();
    }
  }, [secondsLeft]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <Card className="bg-white/10 backdrop-blur border-white/20">
      <CardContent className="p-6 text-center">
        <div className="flex items-center gap-2 justify-center mb-4">
          <QrCode className="w-5 h-5 text-white" />
          <h3 className="text-white font-semibold">Show this QR at checkout</h3>
        </div>

        {qrData?.qr_url && (
          <div className="bg-white rounded-xl p-4 inline-block mb-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData.qr_url)}`}
              alt="Customer QR Code"
              className="w-44 h-44"
            />
          </div>
        )}

        {secondsLeft > 0 ? (
          <p className="text-white/60 text-sm">Valid for <span className="text-teal-400 font-bold">{secondsLeft}s</span></p>
        ) : (
          <p className="text-amber-400 text-sm">Expired — regenerating...</p>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={generateQR}
          disabled={loading}
          className="mt-3 text-white/60 hover:text-white"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}