import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Share2, Facebook, Twitter, Instagram, MessageCircle,
  Copy, CheckCircle, Clock, Ticket, Users, Gift, QrCode,
  Megaphone, Send
} from 'lucide-react';
import { format } from 'date-fns';

// Platform config
const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: 'bg-blue-600 hover:bg-blue-700', textColor: 'text-blue-400', Icon: Facebook },
  { id: 'instagram', label: 'Instagram', color: 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700', textColor: 'text-pink-400', Icon: Instagram },
  { id: 'twitter', label: 'Twitter/X', color: 'bg-slate-900 hover:bg-slate-800 border border-slate-600', textColor: 'text-slate-300', Icon: Twitter },
  { id: 'whatsapp', label: 'WhatsApp', color: 'bg-green-600 hover:bg-green-700', textColor: 'text-green-400', Icon: MessageCircle },
];

function buildPostText(coupon, company) {
  const expiry = coupon.expires_at ? format(new Date(coupon.expires_at), 'MMM d, yyyy') : null;
  const code = coupon.coupon_code;
  const discount = coupon.discount_value
    ? (coupon.discount_type === 'tokens' ? `${coupon.discount_value} tokens` : `${coupon.discount_value}% off`)
    : 'a special discount';
  const productLine = coupon.product_name ? ` on ${coupon.product_name}` : '';
  const expiryLine = expiry ? ` Valid until ${expiry}.` : '';
  return `🎁 Special Offer${productLine}! Use code ${code} to get ${discount} at ${company?.name || 'our store'}!${expiryLine} Share with friends! #loyalty #rewards`;
}

export default function SocialMarketing() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ['company', primaryCompanyId],
    queryFn: async () => {
      const res = await base44.entities.Company.filter({ id: primaryCompanyId });
      return res[0];
    },
    enabled: !!primaryCompanyId
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ['coupon-campaigns', primaryCompanyId],
    queryFn: () => base44.entities.CouponCampaign.filter({ company_id: primaryCompanyId }, '-created_date', 50),
    enabled: !!primaryCompanyId
  });

  const { data: socialPosts = [] } = useQuery({
    queryKey: ['social-posts', primaryCompanyId],
    queryFn: () => base44.entities.SocialPost.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const { data: referralCampaigns = [] } = useQuery({
    queryKey: ['referral-campaign', primaryCompanyId],
    queryFn: () => base44.entities.ReferralCampaign.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const referralCampaign = referralCampaigns[0];

  // Post Composer State
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [postText, setPostText] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);

  // Referral State
  const [pointsPerReferral, setPointsPerReferral] = useState(50);
  const [referralMessage, setReferralMessage] = useState('');
  const [campaignActive, setCampaignActive] = useState(false);

  useEffect(() => {
    if (referralCampaign) {
      setPointsPerReferral(referralCampaign.points_per_referral ?? 50);
      setCampaignActive(referralCampaign.is_active ?? false);
      setReferralMessage(referralCampaign.referral_message || defaultReferralMessage());
    } else if (company) {
      setReferralMessage(defaultReferralMessage());
    }
  }, [referralCampaign, company]);

  function defaultReferralMessage() {
    return `Join ${company?.name || 'our'} loyalty program and we both earn rewards! Sign up here: mooadon.base44.app/join/${primaryCompanyId} — Enter my phone number when you sign up!`;
  }

  const referralUrl = `mooadon.base44.app/join/${primaryCompanyId}`;

  const saveSocialPostMutation = useMutation({
    mutationFn: (data) => base44.entities.SocialPost.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-posts', primaryCompanyId] })
  });

  const saveReferralMutation = useMutation({
    mutationFn: (data) => referralCampaign
      ? base44.entities.ReferralCampaign.update(referralCampaign.id, data)
      : base44.entities.ReferralCampaign.create({ company_id: primaryCompanyId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-campaign', primaryCompanyId] });
      toast.success('Campaign settings saved!');
    }
  });

  const handleSelectCoupon = (coupon) => {
    setSelectedCoupon(coupon);
    setPostText(buildPostText(coupon, company));
  };

  const togglePlatform = (platformId) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId) ? prev.filter(p => p !== platformId) : [...prev, platformId]
    );
  };

  const handlePost = async () => {
    if (!postText.trim()) { toast.error('Please write a post first.'); return; }
    if (selectedPlatforms.length === 0) { toast.error('Please select at least one platform.'); return; }

    for (const platformId of selectedPlatforms) {
      const encoded = encodeURIComponent(postText);
      if (platformId === 'facebook') {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=mooadon.base44.app&quote=${encoded}`, '_blank');
        toast.success('Opening Facebook...');
      } else if (platformId === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank');
        toast.success('Opening Twitter/X...');
      } else if (platformId === 'whatsapp') {
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
        toast.success('Opening WhatsApp...');
      } else if (platformId === 'instagram') {
        await navigator.clipboard.writeText(postText);
        toast.success('Text copied! Open Instagram and paste into your post.');
      }

      // Log the post
      saveSocialPostMutation.mutate({
        company_id: primaryCompanyId,
        coupon_id: selectedCoupon?.id || '',
        coupon_name: selectedCoupon?.name || '',
        platform: platformId,
        post_text: postText,
        posted_at: new Date().toISOString(),
        status: 'shared'
      });
    }
  };

  const copyToClipboard = (text, msg = 'Copied!') => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  const platformConfig = (id) => PLATFORMS.find(p => p.id === id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Social Marketing</h1>
          <p className="text-sm text-slate-400">Grow your business on social media</p>
        </div>
      </div>

      <Tabs defaultValue="post">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="post" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-slate-400">
            <Share2 className="w-4 h-4 mr-2" />
            Post Content
          </TabsTrigger>
          <TabsTrigger value="referral" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white text-slate-400">
            <Users className="w-4 h-4 mr-2" />
            Referral Program
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: POST CONTENT ===== */}
        <TabsContent value="post" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* LEFT: Coupon Selector */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="p-4 border-b border-slate-700">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-teal-400" />
                  Select a Coupon to Promote
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {coupons.length === 0 ? (
                  <p className="text-slate-400 text-sm">No campaigns found. Create a campaign in AI Campaigns first.</p>
                ) : coupons.map(coupon => (
                  <div
                    key={coupon.id}
                    onClick={() => handleSelectCoupon(coupon)}
                    className={`cursor-pointer p-3 rounded-lg border transition-all ${
                      selectedCoupon?.id === coupon.id
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-slate-700 bg-slate-900 hover:border-teal-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium">{coupon.product_name || 'Campaign'}</span>
                      <Badge className={`border-0 text-xs ${coupon.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {coupon.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-teal-400 font-mono">A: {coupon.coupon_code}</span>
                      {coupon.coupon_code_b && <span className="text-xs text-purple-400 font-mono">B: {coupon.coupon_code_b}</span>}
                      {coupon.expires_at && (
                        <span className="text-xs text-slate-500">· Exp {format(new Date(coupon.expires_at), 'MMM d')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* RIGHT: Post Composer */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="p-4 border-b border-slate-700">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Send className="w-4 h-4 text-teal-400" />
                  Post Composer
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Textarea */}
                <div>
                  <textarea
                    value={postText}
                    onChange={e => setPostText(e.target.value)}
                    placeholder="Select a coupon above or write your post here..."
                    rows={6}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                  />
                  <p className="text-xs text-slate-500 text-right mt-1">{postText.length} characters</p>
                </div>

                {/* Platform Selector */}
                <div>
                  <p className="text-xs text-slate-400 mb-2 font-medium">Select Platforms</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORMS.map(({ id, label, Icon, textColor }) => (
                      <button
                        key={id}
                        onClick={() => togglePlatform(id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                          selectedPlatforms.includes(id)
                            ? 'border-teal-500 bg-teal-500/10 text-white'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${selectedPlatforms.includes(id) ? 'text-teal-400' : textColor}`} />
                        {label}
                        {selectedPlatforms.includes(id) && <CheckCircle className="w-3.5 h-3.5 ml-auto text-teal-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Post Button */}
                <Button
                  onClick={handlePost}
                  disabled={!postText.trim() || selectedPlatforms.length === 0}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Post to Selected Platforms ({selectedPlatforms.length})
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Post History */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="p-4 border-b border-slate-700">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Post History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {socialPosts.length === 0 ? (
                <p className="text-slate-400 text-sm">No posts yet. Start sharing to see your history here.</p>
              ) : (
                <div className="space-y-3">
                  {[...socialPosts].sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at)).map(post => {
                    const pc = platformConfig(post.platform);
                    const Icon = pc?.Icon || Share2;
                    return (
                      <div key={post.id} className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${pc?.textColor || 'text-slate-400'} bg-slate-800`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white text-xs font-medium capitalize">{post.platform}</span>
                            {post.coupon_name && <span className="text-slate-400 text-xs">· {post.coupon_name}</span>}
                            <Badge className="bg-teal-500/20 text-teal-400 border-0 text-xs ml-auto">{post.status}</Badge>
                          </div>
                          <p className="text-slate-400 text-xs truncate">{post.post_text}</p>
                          <p className="text-slate-600 text-xs mt-1">
                            {post.posted_at ? format(new Date(post.posted_at), 'MMM d, yyyy HH:mm') : '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB 2: REFERRAL PROGRAM ===== */}
        <TabsContent value="referral" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Campaign Settings */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Gift className="w-4 h-4 text-teal-400" />
                    Earn Points by Referring Friends
                  </CardTitle>
                  <Switch
                    checked={campaignActive}
                    onCheckedChange={setCampaignActive}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Customers earn points for every new customer they refer who signs up.
                </p>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Points per referral */}
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">Points per Referral</label>
                  <Input
                    type="number"
                    value={pointsPerReferral}
                    onChange={e => setPointsPerReferral(Number(e.target.value))}
                    className="bg-slate-900 border-slate-700 text-white w-32"
                    min={1}
                  />
                </div>

                {/* Referral message */}
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1.5">Referral Message Template</label>
                  <textarea
                    value={referralMessage}
                    onChange={e => setReferralMessage(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>

                {/* Share buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(referralMessage)}`, '_blank')}
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" />
                    Share via WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={() => copyToClipboard(referralMessage, 'Message copied!')}
                  >
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy Message
                  </Button>
                </div>

                <Button
                  onClick={() => saveReferralMutation.mutate({
                    is_active: campaignActive,
                    points_per_referral: pointsPerReferral,
                    referral_message: referralMessage
                  })}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Save Campaign Settings
                </Button>
              </CardContent>
            </Card>

            {/* Referral Link & QR */}
            <div className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="p-4 border-b border-slate-700">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-teal-400" />
                    Your Referral Link
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 bg-slate-900 rounded-lg border border-slate-700 px-3 py-2">
                    <span className="text-teal-400 text-sm flex-1 truncate">{referralUrl}</span>
                    <button onClick={() => copyToClipboard(`https://${referralUrl}`, 'Link copied!')}>
                      <Copy className="w-4 h-4 text-slate-400 hover:text-white transition-colors" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://${referralUrl}&bgcolor=1e293b&color=ffffff`}
                      alt="QR Code"
                      className="w-28 h-28 rounded-lg border border-slate-700"
                    />
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Scan to join your loyalty program</p>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white w-full"
                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join our loyalty program! ${referralUrl}`)}`, '_blank')}
                      >
                        <MessageCircle className="w-4 h-4 mr-1.5" />
                        Share on WhatsApp
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Referral Stats */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="p-4 border-b border-slate-700">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-400" />
                    Referral Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                      <p className="text-xs text-slate-400">Total Referrals</p>
                      <p className="text-2xl font-bold text-white mt-1">{referralCampaign?.total_referrals || 0}</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                      <p className="text-xs text-slate-400">Points Awarded</p>
                      <p className="text-2xl font-bold text-teal-400 mt-1">{referralCampaign?.total_points_awarded || 0}</p>
                    </div>
                  </div>
                  <div className="mt-3 bg-slate-900 rounded-lg p-3 border border-slate-700">
                    <p className="text-xs text-slate-400">Campaign Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${campaignActive ? 'bg-teal-400' : 'bg-slate-500'}`} />
                      <span className="text-white text-sm font-medium">{campaignActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}