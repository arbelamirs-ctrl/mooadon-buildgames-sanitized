import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scan, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function RedemptionScanner({ companyId, onRedemptionSuccess }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRedeem = async () => {
    if (!code.trim()) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await base44.functions.invoke('redeemBenefit', {
        redemption_code: code.trim(),
        company_id: companyId
      });
      
      if (response.data.success) {
        setResult({
          success: true,
          distribution: response.data.distribution,
          benefit: response.data.benefit
        });
        toast.success('✅ Benefit redeemed successfully!');
        setCode('');
        if (onRedemptionSuccess) onRedemptionSuccess(response.data);
      } else {
        throw new Error(response.data.error || 'Redemption failed');
      }
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
      toast.error(error.message || 'Redemption failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-[#1f2128] border-[#2d2d3a]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Scan className="w-5 h-5" />
          Redeem Coupon/Reward
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter redemption code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && handleRedeem()}
            className="bg-[#17171f] border-[#2d2d3a] text-white uppercase"
          />
          <Button 
            onClick={handleRedeem}
            disabled={loading || !code.trim()}
            className="bg-teal-500 hover:bg-teal-600"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Redeem'
            )}
          </Button>
        </div>

        {result && (
          <div className={`p-4 rounded-lg border ${
            result.success 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {result.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Redeemed Successfully</span>
                </div>
                <div className="text-white text-sm">
                  <div>Type: <Badge>{result.distribution.benefit_type}</Badge></div>
                  {result.benefit && (
                    <>
                      <div className="mt-1">Name: {result.benefit.title || result.benefit.name}</div>
                      {result.benefit.discount_value && (
                        <div>Discount: {result.benefit.discount_value}{result.benefit.discount_type === 'percentage' ? '%' : ' NIS'}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-5 h-5" />
                <span>{result.error}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}