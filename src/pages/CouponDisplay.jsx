import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Copy, CheckCircle, Sparkles, Calendar, AlertCircle } from 'lucide-react';
import { toast } from "sonner";
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

export default function CouponDisplay() {
  const urlParams = new URLSearchParams(window.location.search);
  const couponCode = urlParams.get('coupon_code');
  const couponRef = useRef(null);

  const { data: coupon, isLoading } = useQuery({
    queryKey: ['coupon', couponCode],
    queryFn: async () => {
      if (!couponCode) return null;
      const normalizedCode = couponCode.toUpperCase();
      const coupons = await base44.asServiceRole.entities.Coupon.filter({ coupon_code: normalizedCode });
      return coupons.length > 0 ? coupons[0] : null;
    },
    enabled: !!couponCode
  });

  const { data: company } = useQuery({
    queryKey: ['company', coupon?.company_id],
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: coupon.company_id });
      return companies[0];
    },
    enabled: !!coupon?.company_id
  });

  const handleSaveImage = async () => {
    if (!couponRef.current) return;
    
    try {
      const canvas = await html2canvas(couponRef.current, {
        backgroundColor: '#ffffff',
        scale: 2
      });
      
      const link = document.createElement('a');
      link.download = `coupon-${couponCode}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      toast.success('Coupon saved as image!');
    } catch (error) {
      toast.error('Failed to save coupon');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(couponCode);
    toast.success('Coupon code copied!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Coupon Not Found</h2>
            <p className="text-slate-600">
              The coupon code you're looking for doesn't exist or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = new Date() > new Date(coupon.expires_at);
  const isUsed = coupon.status === 'used' || coupon.times_used >= coupon.max_uses;
  const primaryColor = company?.primary_color || '#9333ea';
  const companyUrl = company?.app_base_url || window.location.origin;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${companyUrl}/CouponDisplay?coupon_code=${couponCode}`)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={handleSaveImage}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Save as Image
          </Button>
          <Button
            onClick={handleCopyCode}
            variant="outline"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Code
          </Button>
        </div>

        {/* Coupon Card */}
        <Card 
          ref={couponRef}
          className="overflow-hidden shadow-2xl"
          style={{ 
            borderColor: primaryColor,
            borderWidth: '3px'
          }}
        >
          {/* Header with Company Info */}
          <div 
            className="p-6 text-white text-center"
            style={{ backgroundColor: primaryColor }}
          >
            {company?.logo_url && (
              <img 
                src={company.logo_url} 
                alt={company.name}
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-white p-2 object-contain"
              />
            )}
            <h1 className="text-2xl font-bold">{company?.name || 'Store Name'}</h1>
          </div>

          <CardContent className="p-8 space-y-6 bg-white">
            {/* Status Badges */}
            {(isExpired || isUsed) && (
              <div className="flex justify-center gap-2">
                {isExpired && (
                  <div className="bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-medium">
                    Expired
                  </div>
                )}
                {isUsed && (
                  <div className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-sm font-medium">
                    Already Used
                  </div>
                )}
              </div>
            )}

            {/* Main Message */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-8 h-8" style={{ color: primaryColor }} />
                <h2 className="text-3xl font-bold text-slate-900">
                  You Received a Discount Coupon!
                </h2>
                <Sparkles className="w-8 h-8" style={{ color: primaryColor }} />
              </div>
              
              {/* Discount Amount */}
              <div 
                className="inline-block px-8 py-4 rounded-2xl text-white text-center"
                style={{ backgroundColor: primaryColor }}
              >
                <div className="text-5xl font-bold">
                  {coupon.discount_type === 'percentage' 
                    ? `${coupon.discount_value}% OFF`
                    : `₪${coupon.discount_value} OFF`
                  }
                </div>
              </div>
            </div>

            {/* Coupon Code */}
            <div className="text-center space-y-2">
              <p className="text-slate-600 font-medium">Coupon Code</p>
              <div 
                className="text-3xl font-mono font-bold tracking-wider py-3 px-6 rounded-lg inline-block"
                style={{ 
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor 
                }}
              >
                {couponCode}
              </div>
            </div>

            {/* QR Code */}
            <div className="text-center space-y-3">
              <div className="bg-slate-50 p-6 rounded-2xl inline-block">
                <img 
                  src={qrCodeUrl}
                  alt="Coupon QR Code"
                  className="w-[300px] h-[300px] mx-auto"
                />
              </div>
              <div 
                className="flex items-start gap-3 p-4 rounded-lg text-left max-w-md mx-auto"
                style={{ 
                  backgroundColor: `${primaryColor}10`,
                  borderLeft: `4px solid ${primaryColor}`
                }}
              >
                <CheckCircle className="w-5 h-5 mt-0.5" style={{ color: primaryColor }} />
                <p className="text-sm text-slate-700">
                  <strong>Show this QR code at the register</strong> to redeem your coupon and get your discount!
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Expires on:</span>
                </div>
                <span className="font-semibold text-slate-900">
                  {format(new Date(coupon.expires_at), 'MMM dd, yyyy')}
                </span>
              </div>
              
              {coupon.min_purchase_amount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Minimum purchase:</span>
                  <span className="font-semibold text-slate-900">
                    ₪{coupon.min_purchase_amount}
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Usage:</span>
                <span className="font-semibold text-slate-900">
                  {coupon.times_used} / {coupon.max_uses} time{coupon.max_uses > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Footer Message */}
            <div className="text-center pt-4">
              <p className="text-xs text-slate-500">
                Save this coupon to your phone and show it when making your next purchase
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-3">How to Use Your Coupon</h3>
            <ol className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="font-bold text-blue-600">1.</span>
                <span>Save this page or take a screenshot of the coupon</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-blue-600">2.</span>
                <span>Show the QR code or coupon code to the cashier at checkout</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-blue-600">3.</span>
                <span>Enjoy your discount on your next purchase!</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}