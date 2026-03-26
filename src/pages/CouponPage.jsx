import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Gift, Clock, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const COOLDOWN_MS = 20 * 60 * 1000;

function getVisitorId() {
  let vid = localStorage.getItem('_campaign_vid');
  if (!vid) {
    vid = 'v_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem('_campaign_vid', vid);
  }
  return vid;
}

function isCooledDown(key) {
  const last = parseInt(localStorage.getItem(key) || '0', 10);
  return Date.now() - last > COOLDOWN_MS;
}

function markAction(key) {
  localStorage.setItem(key, String(Date.now()));
}

function buildShareUrl(baseUrl, platform, campaignId, variant) {
  const u = new URL(baseUrl);
  u.searchParams.set('utm_source', platform);
  u.searchParams.set('utm_campaign', campaignId);
  u.searchParams.set('utm_variant', variant);
  return u.toString();
}

const REASON_LABELS = {
  verified: 'Redemption verified successfully',
  expired: 'This coupon has expired',
  duplicate_receipt: 'This receipt was already used',
  max_redemptions_reached: 'Coupon has reached its redemption limit',
  min_amount_not_met: 'Minimum purchase amount not met',
  wrong_branch: 'Coupon not valid at this location',
  coupon_not_found: 'Coupon not found',
  coupon_inactive: 'Coupon is no longer active',
  company_not_found: 'Business not found'
};

function VerificationStatus({ status, reasonCode, proofHash, verificationId }) {
  if (!status) return null;

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
        <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
        <p className="text-amber-300 text-xs">Verifying your redemption...</p>
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
          <p className="text-teal-300 text-sm font-semibold">Redemption Verified ✓</p>
        </div>
        <p className="text-slate-400 text-xs">{REASON_LABELS.verified}</p>
        {proofHash && (
          <div className="bg-slate-900/50 rounded p-2 mt-1">
            <p className="text-slate-500 text-xs mb-0.5">On-chain proof hash</p>
            <p className="text-teal-500/70 text-xs font-mono break-all">{proofHash}</p>
          </div>
        )}
        {verificationId && (
          <p className="text-slate-600 text-xs">ID: {verificationId}</p>
        )}
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-1">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm font-semibold">Verification Failed</p>
        </div>
        <p className="text-slate-400 text-xs">{REASON_LABELS[reasonCode] || reasonCode}</p>
      </div>
    );
  }

  return null;
}

export default function CouponPage() {
  const [campaign, setCampaign] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [redeemIntent, setRedeemIntent] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [verificationReason, setVerificationReason] = useState(null);
  const [proofHash, setProofHash] = useState(null);
  const [verificationId, setVerificationId] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code') || window.location.pathname.split('/').pop();
  const utmSource = urlParams.get('utm_source') || 'direct';
  const visitorId = getVisitorId();

  useEffect(() => {
    if (!code) { setLoading(false); return; }
    const load = async () => {
      try {
        let campaigns = await base44.entities.CouponCampaign.filter({ coupon_code: code });
        let variant = 'a';
        if (!campaigns.length) {
          campaigns = await base44.entities.CouponCampaign.filter({ coupon_code_b: code });
          variant = 'b';
        }
        if (!campaigns.length) { setLoading(false); return; }
        const c = campaigns[0];
        setCampaign({ ...c, _variant: variant });

        const companies = await base44.entities.Company.filter({ id: c.company_id });
        if (companies.length) setCompany(companies[0]);

        const viewKey = `_view_${c.id}_${visitorId}`;
        if (isCooledDown(viewKey)) {
          markAction(viewKey);
          const viewUpdate = variant === 'b'
            ? { views_b: (c.views_b || 0) + 1, views: (c.views || 0) + 1 }
            : { views_a: (c.views_a || 0) + 1, views: (c.views || 0) + 1 };
          await base44.entities.CouponCampaign.update(c.id, viewUpdate);
          base44.entities.AuditLog.create({
            company_id: c.company_id, action: 'coupon_view',
            entity_type: 'CouponCampaign', entity_id: c.id,
            details: { code, visitor_id: visitorId, utm_source: utmSource, variant }
          }).catch(() => {});
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [code]);

  const handleCopy = async () => {
    const displayCode = campaign._variant === 'b' ? campaign.coupon_code_b : campaign.coupon_code;
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Coupon code copied!');
    const copyKey = `_copy_${campaign.id}_${visitorId}`;
    if (isCooledDown(copyKey)) {
      markAction(copyKey);
      const v = campaign._variant || 'a';
      const copyUpdate = v === 'b'
        ? { copies_b: (campaign.copies_b || 0) + 1, copies: (campaign.copies || 0) + 1 }
        : { copies_a: (campaign.copies_a || 0) + 1, copies: (campaign.copies || 0) + 1 };
      await base44.entities.CouponCampaign.update(campaign.id, copyUpdate);
      base44.entities.AuditLog.create({
        company_id: campaign.company_id, action: 'coupon_copy',
        entity_type: 'CouponCampaign', entity_id: campaign.id,
        details: { code, visitor_id: visitorId, utm_source: utmSource, variant: v }
      }).catch(() => {});
    }
  };

  const handleRedeemIntent = async () => {
    setRedeemIntent(true);
    await base44.entities.CouponCampaign.update(campaign.id, {
      redeem_intents: (campaign.redeem_intents || 0) + 1
    });
    base44.entities.AuditLog.create({
      company_id: campaign.company_id, action: 'coupon_redeem_intent',
      entity_type: 'CouponCampaign', entity_id: campaign.id,
      details: { code, visitor_id: visitorId, utm_source: utmSource, variant: campaign._variant || 'a' }
    }).catch(() => {});
  };

  const handleSubmitForVerification = async () => {
    if (!campaign) return;
    setVerifying(true);
    setVerificationStatus('pending');

    try {
      const requestRes = await base44.functions.invoke('requestRedeemVerification', {
        company_id: campaign.company_id,
        coupon_code: code,
        receipt_id: `REC-${Date.now()}-${visitorId}`,
        branch_id: null
      });
      const requestData = requestRes.data;

      if (!requestData.success) {
        setVerificationStatus('rejected');
        setVerificationReason(requestData.reason_code || 'unknown');
        toast.error(requestData.error || 'Verification request failed');
        return;
      }

      const vid = requestData.verification_id;
      setVerificationId(vid);

      const execRes = await base44.functions.invoke('executeRedeemVerification', {
        verification_id: vid
      });
      const execData = execRes.data;

      setVerificationStatus(execData.verified ? 'verified' : 'rejected');
      setVerificationReason(execData.reason_code);
      setProofHash(execData.proof_hash);

      if (execData.verified) {
        toast.success('Redemption verified on-chain!');
      } else {
        toast.error(REASON_LABELS[execData.reason_code] || 'Verification failed');
      }
    } catch (err) {
      console.error(err);
      setVerificationStatus('rejected');
      setVerificationReason('unknown');
      toast.error('Verification error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const shareOnPlatform = (platform) => {
    const v = campaign?._variant || 'a';
    const text = {
      fb: v === 'b' ? campaign?.fb_copy_b : (campaign?.fb_copy_a || campaign?.fb_copy),
      x: v === 'b' ? campaign?.x_copy_b : (campaign?.x_copy_a || campaign?.x_copy),
      linkedin: v === 'b' ? campaign?.linkedin_copy_b : (campaign?.linkedin_copy_a || campaign?.linkedin_copy)
    }[platform] || campaign?.cta || '';
    const basePageUrl = `${window.location.origin}/CouponPage?code=${code}`;
    const taggedUrl = buildShareUrl(basePageUrl, platform, campaign.id, v);
    const shareUrls = {
      fb: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(taggedUrl)}&quote=${encodeURIComponent(text)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text + ' ' + taggedUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(taggedUrl)}`
    };
    base44.entities.AuditLog.create({
      company_id: campaign.company_id, action: 'coupon_share',
      entity_type: 'CouponCampaign', entity_id: campaign.id,
      details: { platform, utm_source: platform, utm_campaign: campaign.id, utm_variant: v, visitor_id: visitorId }
    }).catch(() => {});
    if (shareUrls[platform]) window.open(shareUrls[platform], '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Gift className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Coupon not found</h1>
          <p className="text-slate-400">This coupon code doesn't exist or has expired.</p>
        </div>
      </div>
    );
  }

  const isExpired = campaign.expires_at && new Date(campaign.expires_at) < new Date();
  const displayCode = campaign._variant === 'b' ? campaign.coupon_code_b : campaign.coupon_code;
  const isVerified = verificationStatus === 'verified';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          {company?.logo_url && (
            <img src={company.logo_url} alt={company.name} className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
          )}
          <h2 className="text-xl font-bold text-white">{company?.name || 'Special Offer'}</h2>
          <p className="text-slate-400 text-sm mt-1">Exclusive Offer</p>
        </div>

        {/* Product */}
        <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">{campaign.product_name}</h1>
          {campaign.cta && <p className="text-teal-400 font-medium">{campaign.cta}</p>}
        </div>

        {/* Coupon Code */}
        <div className={`border-2 border-dashed rounded-xl p-6 text-center ${
          isExpired ? 'border-red-500/50 bg-red-500/5'
          : isVerified ? 'border-teal-500/80 bg-teal-500/10'
          : 'border-teal-500/50 bg-teal-500/5'
        }`}>
          {isExpired && <Badge className="bg-red-500/20 text-red-400 mb-3">Expired</Badge>}
          {isVerified && <Badge className="bg-teal-500/20 text-teal-400 mb-3">Verified ✓</Badge>}
          <p className="text-slate-400 text-sm mb-2">Your Coupon Code</p>
          <div className="text-3xl font-black tracking-widest text-white font-mono">{displayCode}</div>
          {campaign.expires_at && !isExpired && (
            <div className="flex items-center justify-center gap-1 mt-3 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              Expires {format(new Date(campaign.expires_at), 'MMM d, yyyy')}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isExpired && !isVerified && (
          <div className="flex gap-3">
            <Button onClick={handleCopy} className="flex-1 bg-teal-500 hover:bg-teal-600 gap-2">
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
            {!redeemIntent ? (
              <Button onClick={handleRedeemIntent} className="flex-1 bg-purple-500 hover:bg-purple-600 gap-2">
                <Gift className="w-4 h-4" />
                Redeem
              </Button>
            ) : (
              <div className="flex-1 bg-[#1f2128] border border-[#2d2d3a] rounded-md p-3 text-center">
                <p className="text-teal-400 text-xs font-medium">Show this code at the counter!</p>
                <p className="text-slate-500 text-xs mt-0.5">Staff will verify &amp; apply discount</p>
              </div>
            )}
          </div>
        )}

        {/* Verified Redemption Button */}
        {redeemIntent && !verificationStatus && !isExpired && (
          <Button
            onClick={handleSubmitForVerification}
            disabled={verifying}
            className="w-full bg-amber-500 hover:bg-amber-600 gap-2"
          >
            {verifying
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              : <><CheckCircle2 className="w-4 h-4" /> Submit for Verified Redemption</>
            }
          </Button>
        )}

        {/* Verification Status */}
        <VerificationStatus
          status={verificationStatus}
          reasonCode={verificationReason}
          proofHash={proofHash}
          verificationId={verificationId}
        />

        {/* Redeem intent notice */}
        {redeemIntent && !verificationStatus && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-300 text-xs">
              This is a <strong>redeem intent</strong> — tap "Submit for Verified Redemption" to create an on-chain proof.
            </p>
          </div>
        )}

        {/* Social Share */}
        <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-3 text-center">Share this offer</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => shareOnPlatform('fb')} className="w-10 h-10 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 flex items-center justify-center text-blue-400 font-bold text-sm transition-colors">f</button>
            <button onClick={() => shareOnPlatform('x')} className="w-10 h-10 rounded-lg bg-slate-600/20 hover:bg-slate-600/40 flex items-center justify-center text-white font-bold text-sm transition-colors">𝕏</button>
            <button onClick={() => shareOnPlatform('linkedin')} className="w-10 h-10 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 flex items-center justify-center text-blue-300 font-bold text-sm transition-colors">in</button>
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}
              className="w-10 h-10 rounded-lg bg-teal-500/20 hover:bg-teal-500/40 flex items-center justify-center text-teal-400 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {campaign.hashtags && (
          <p className="text-center text-teal-500/60 text-xs">{campaign.hashtags.split(',').map(h => h.trim()).join(' ')}</p>
        )}
      </div>
    </div>
  );
}