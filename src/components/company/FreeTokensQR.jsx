// src/components/company/FreeTokensQR.jsx  –  MOBILE-FIRST
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Gift, Download, Copy, CheckCircle2, Printer, Store, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

export default function FreeTokensQR({ companyId, company }) {
  const [bonusAmount, setBonusAmount] = useState(company?.welcome_bonus_points || 50);
  const [copied, setCopied] = useState(false);

  const claimURL = useMemo(() => {
    const base = window.location.origin;
    const params = new URLSearchParams({
      company: companyId,
      campaign: 'welcome_qr',
      bonus: bonusAmount.toString(),
    });
    return `${base}/ClientOnboarding?${params.toString()}`;
  }, [companyId, bonusAmount]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(claimURL);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('free-tokens-qr');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 1024; canvas.height = 1024;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 112, 112, 800, 800);
      const link = document.createElement('a');
      link.download = `${company?.name || 'mooadon'}-free-tokens-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('QR downloaded!');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const svg = document.getElementById('free-tokens-qr');
    if (!svg || !printWindow) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const companyName = company?.name || 'Mooadon';
    const pointsName = company?.points_name || 'points';
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><title>QR - ${companyName}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;background:white;}
      .container{text-align:center;padding:40px;border:3px solid #10b981;border-radius:24px;max-width:400px;}
      .title{font-size:28px;font-weight:800;color:#111;margin-bottom:8px;}
      .subtitle{font-size:18px;color:#10b981;font-weight:600;margin-bottom:24px;}
      .qr{margin:24px 0;}.cta{font-size:16px;color:#666;margin-top:16px;}.brand{font-size:14px;color:#999;margin-top:24px;}</style></head>
      <body><div class="container"><div class="title">${companyName}</div>
      <div class="subtitle">${bonusAmount} ${pointsName} FREE!</div>
      <div class="qr">${svgData}</div>
      <div class="cta">Scan the QR to join and get your bonus</div>
      <div class="brand">Powered by Mooadon</div></div></body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-3 p-3 sm:p-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-white text-sm sm:text-base">
          <Gift className="w-5 h-5 text-emerald-400 shrink-0" />
          Free Tokens QR
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Growth Tool</Badge>
        </CardTitle>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Print this QR at the register or on flyers. New customers scan, sign up, and get free tokens instantly.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 p-3 sm:p-4 pt-0">
        {/* Bonus amount */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="space-y-1 w-full sm:w-auto">
            <Label className="text-xs sm:text-sm text-slate-300">
              Bonus ({company?.points_name || 'points'})
            </Label>
            <Input type="number" min={1} max={10000} value={bonusAmount}
              onChange={(e) => setBonusAmount(parseInt(e.target.value) || 50)}
              className="w-full sm:w-32 bg-slate-950 border-slate-800 text-white focus:border-emerald-500 h-10" dir="ltr" />
          </div>
          <p className="text-xs text-slate-500 pb-1">
            Each new customer gets {bonusAmount} {company?.points_name || 'points'}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
            <QRCode
              id="free-tokens-qr"
              value={claimURL}
              size={150}
              className="w-[150px] sm:w-[200px] h-auto"
              level="H"
              fgColor="#0f172a"
              bgColor="#ffffff"
            />
          </div>
        </div>

        {/* Branding preview */}
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-white flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            {bonusAmount} {company?.points_name || 'points'} FREE
          </p>
          <p className="text-xs text-slate-400">Scan to join {company?.name || 'our'} loyalty program</p>
        </div>

        {/* Link + copy */}
        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-slate-400 truncate" dir="ltr">{claimURL}</code>
            <Button size="sm" variant="outline" onClick={handleCopy}
              className="border-slate-700 text-slate-300 hover:text-white shrink-0 h-9 min-w-[36px]">
              {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button onClick={handleDownloadQR} variant="outline"
            className="border-slate-700 text-slate-300 hover:text-white h-10">
            <Download className="w-4 h-4 mr-2" />
            Download PNG
          </Button>
          <Button onClick={handlePrint} className="bg-emerald-500 hover:bg-emerald-600 text-white h-10">
            <Printer className="w-4 h-4 mr-2" />
            Print Poster
          </Button>
        </div>

        {/* Tips */}
        <div className="bg-slate-950/30 rounded-lg p-3 sm:p-4 border border-slate-800">
          <h4 className="text-xs text-slate-500 uppercase tracking-wide mb-3">Where to put this QR</h4>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
            {[
              [Store, 'Next to the cash register / POS terminal'],
              [Gift, 'On flyers, business cards and packaging'],
              [Sparkles, 'Social media posts and stories'],
              [QrCode, 'Restaurant menus and table stands'],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-start gap-2">
                <Icon className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}