import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Wallet, 
  Coins, 
  Sparkles, 
  Zap, 
  ArrowRight, 
  Check,
  Building2,
  Users,
  TrendingUp,
  Shield,
  Globe,
  Star,
  Gift,
  BarChart3,
  Target,
  Settings,
  Webhook
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Removed auto-redirect to allow button clicks to work properly

  const handleSignUp = async (method, mode = 'business') => {
    if (method === 'email' && !email) {
      toast.error('Please enter your email');
      return;
    }
    setLoading(true);
    
    try {
      // Check if already authenticated
      const user = await base44.auth.me();
      if (user) {
        // Already logged in - redirect based on mode
        const targetUrl = mode === 'admin' ? 'SuperAdminDashboard' : 'AgentDashboard';
        window.location.href = createPageUrl(targetUrl);
        return;
      }
    } catch (e) {
      // Not authenticated - proceed with login
    }
    
    const nextPage = mode === 'admin' ? 'SuperAdminDashboard' : 'OnboardingWizard';
    const nextUrl = window.location.origin + createPageUrl(nextPage);
    base44.auth.redirectToLogin(nextUrl);
  };

  const blockchainFeatures = [
    {
      icon: Coins,
      title: 'Real Tokens',
      description: 'Every reward is a real blockchain token with actual value, not fake points that expire.'
    },
    {
      icon: Shield,
      title: 'Smart Contracts',
      description: 'Automated reward distribution through transparent, immutable smart contracts.'
    },
    {
      icon: Globe,
      title: 'On-Chain Transparency',
      description: 'All transactions are recorded on the blockchain - fully transparent and verifiable.'
    },
    {
      icon: TrendingUp,
      title: 'Supported Networks',
      description: 'Built on Avalanche, compatible with Ethereum, Polygon, and other major chains.'
    }
  ];

  const posIntegrations = [
    { name: 'Priority ERP', icon: '📊' },
    { name: 'Worldline', icon: '🌍' },
    { name: 'Nets SmartPOS', icon: '💳' },
    { name: 'Zettle', icon: '📱' },
    { name: 'PAX', icon: '🏪' },
    { name: 'Ingenico', icon: '💰' },
    { name: 'Verifone', icon: '✅' },
    { name: 'Sunmi', icon: '☀️' },
    { name: 'SoftPOS', icon: '📲' },
    { name: 'SumUp', icon: '✨' },
    { name: 'myPOS', icon: '🏬' },
    { name: 'Loomis Pay', icon: '🔐' }
  ];

  const rewardTypes = [
    {
      icon: Sparkles,
      title: 'Smart Coupons',
      items: ['10% off next purchase', 'Buy One Get One', 'Birthday specials', 'First-time customer bonus']
    },
    {
      icon: Star,
      title: 'NFT Rewards',
      items: ['Exclusive member NFTs', 'Limited edition collectibles', 'VIP access tokens', 'Achievement badges']
    },
    {
      icon: Coins,
      title: 'Crypto Cashback',
      items: ['Instant token rewards', 'Real cryptocurrency', 'Trading on exchanges', 'Staking for more rewards']
    },
    {
      icon: TrendingUp,
      title: 'Loyalty Tiers',
      items: ['Bronze: 0-1000 points', 'Silver: 1000-5000 points', 'Gold: 5000+ points', 'VIP benefits & perks']
    }
  ];

  const steps = [
    {
      number: '01',
      icon: Zap,
      title: 'Connect Your POS',
      description: 'Integrate Mooadon with your existing point-of-sale system in minutes. No hardware changes needed.'
    },
    {
      number: '02',
      icon: Coins,
      title: 'Customers Earn Tokens',
      description: 'Every purchase automatically generates blockchain rewards. Real crypto tokens, not fake points.'
    },
    {
      number: '03',
      icon: Sparkles,
      title: 'Redeem for Real Rewards',
      description: 'Customers redeem tokens for discounts, crypto, NFTs, or exclusive perks. True ownership.'
    }
  ];

  const platformFeatures = [
    {
      icon: BarChart3,
      title: 'Business Dashboard',
      description: 'Real-time analytics and customer insights to track your loyalty program performance and ROI.'
    },
    {
      icon: Zap,
      title: 'Automation Rules',
      description: 'Auto-send SMS/Email triggered by events like purchases, milestones, or inactivity.'
    },
    {
      icon: Target,
      title: 'Customer Segmentation',
      description: 'VIP tiers and advanced targeting to personalize rewards and boost engagement.'
    },
    {
      icon: Wallet,
      title: 'Digital Wallet',
      description: 'Blockchain-powered customer wallets for storing and managing crypto rewards securely.'
    },
    {
      icon: TrendingUp,
      title: 'Smart Analytics',
      description: 'Track ROI, customer lifetime value, redemption rates, and key loyalty metrics.'
    },
    {
      icon: Webhook,
      title: 'API Integrations',
      description: 'Connect any POS or CRM system with our developer-friendly REST API and webhooks.'
    }
  ];

  const partners = [
    { name: 'Avalanche', logo: '⛰️' },
    { name: 'PAX', logo: '💳' },
    { name: 'Worldline', logo: '🌍' },
    { name: 'Zettle', logo: '📱' },
    { name: 'SumUp', logo: '✨' },
    { name: 'myPOS', logo: '🏪' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-600 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32">
          {/* Navigation */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-2">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6963639287e0e9f0e481bd78/473f66310_logo.png" 
                alt="Mooadon" 
                className="h-[120px] w-auto"
              />
            </div>
            <Button 
              onClick={() => handleSignUp('google', 'business')}
              variant="outline" 
              className="border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white"
            >
              Sign In
            </Button>
          </div>

          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="mb-6 bg-teal-500/20 text-teal-400 border-teal-500/30 px-4 py-1">
                <Sparkles className="w-3 h-3 mr-2" />
                New: Web3 Loyalty Platform
              </Badge>
                              <Badge className="mb-6 bg-red-500/20 text-red-400 border-red-500/30 px-4 py-1 ml-2">
                  <svg className="w-4 h-4 mr-2 inline" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#E84142"/><path d="M21.5 21H17.8L16 17.5L14.2 21H10.5L16 11L21.5 21Z" fill="white"/><path d="M12.5 21H9L11.75 16L12.5 21Z" fill="white"/></svg>
                  Built on Avalanche
                </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight"
            >
              Loyalty Meets
              <span className="block bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Blockchain
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl text-[#9ca3af] mb-8 max-w-2xl mx-auto"
            >
              Transform your loyalty program into real crypto rewards. Connect your digital wallet, 
              earn blockchain tokens, and unlock the future of customer rewards.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={() => handleSignUp('google', 'business')}
                  className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white px-8 py-6 text-lg"
                >
                  <Globe className="w-5 h-5 mr-2" />
                  Business Login
                </Button>
                <Button 
                  onClick={() => handleSignUp('google', 'admin')}
                  variant="outline"
                  className="border-teal-500/30 text-teal-400 hover:bg-teal-500/10 px-8 py-6 text-lg"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Admin Login
                </Button>
              </div>
              <a 
                 href="/about-project"
                 className="inline-flex items-center gap-2 px-8 py-6 text-lg font-semibold rounded-lg text-emerald-300 hover:text-emerald-200 transition-all"
                 style={{
                   border: '2px solid rgba(16, 185, 129, 0.6)',
                   backgroundColor: 'rgba(16, 185, 129, 0.1)',
                   boxShadow: '0 0 16px rgba(16, 185, 129, 0.4), inset 0 0 12px rgba(16, 185, 129, 0.1)',
                   animation: 'glow-pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                 }}
                 onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'}
                 onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
               >
                 <Sparkles className="w-5 h-5" />
                 About The Project
               </a>
            </motion.div>

             <style>{`
               @keyframes glow-pulse {
                 0%, 100% { box-shadow: 0 0 8px rgba(16, 185, 129, 0.3), inset 0 0 8px rgba(16, 185, 129, 0.1); }
                 50% { box-shadow: 0 0 16px rgba(16, 185, 129, 0.6), inset 0 0 12px rgba(16, 185, 129, 0.2); }
               }
             `}</style>

             <motion.p
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ duration: 0.5, delay: 0.4 }}
               className="text-sm text-[#9ca3af] mt-4"
             >
               🔒 No credit card required • Free to start
             </motion.p>
          </div>

          {/* Scroll to Explore */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 10, 0] }}
            transition={{ 
              opacity: { duration: 0.5, delay: 0.8 },
              y: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }}
            className="text-center mt-16"
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-[#9ca3af]">Scroll to explore</span>
              <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
            </div>
          </motion.div>
        </div>
      </section>



      {/* What is Mooadon */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-teal-500/20 text-teal-400 border-teal-500/30">
              About Mooadon
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              What is Mooadon?
            </h2>
            <div className="max-w-4xl mx-auto space-y-4">
              <p className="text-xl text-[#9ca3af] leading-relaxed">
                Mooadon is the world's first <span className="text-teal-400 font-semibold">Web3 loyalty platform</span> that revolutionizes customer rewards. 
                Unlike traditional loyalty programs with fake points that expire or lose value, Mooadon gives your customers <span className="text-teal-400 font-semibold">real blockchain tokens</span> with actual monetary value.
              </p>
              <p className="text-lg text-[#9ca3af] leading-relaxed">
                Every purchase automatically generates cryptocurrency tokens that are recorded on the blockchain and stored in the customer's personal digital wallet. 
                These tokens can be traded on exchanges, staked for passive income, redeemed for exclusive rewards, or converted to other cryptocurrencies. 
                <span className="text-white font-medium"> True ownership. Real value. Complete transparency.</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="bg-gradient-to-br from-[#1f2128] to-[#17171f] border-[#2d2d3a] hover:border-teal-500 transition-all">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-teal-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Digital Wallets</h3>
                <p className="text-[#9ca3af]">Every customer gets a personal crypto wallet. No apps to download, fully managed and secure.</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#1f2128] to-[#17171f] border-[#2d2d3a] hover:border-blue-500 transition-all">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Coins className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Real Rewards</h3>
                <p className="text-[#9ca3af]">Not fake points. Real blockchain tokens that can be traded, staked, or redeemed for actual value.</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#1f2128] to-[#17171f] border-[#2d2d3a] hover:border-purple-500 transition-all">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">True Ownership</h3>
                <p className="text-[#9ca3af]">Customers own their rewards. No expiration dates, no restrictions, completely transparent.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Blockchain Integration */}
      <section className="py-24 px-6 bg-[#1f2128]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-500/20 text-blue-400 border-blue-500/30">
              Blockchain Technology
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Built on Real Blockchain
            </h2>
            <div className="max-w-4xl mx-auto space-y-3">
              <p className="text-xl text-[#9ca3af]">
                Every reward is powered by <span className="text-blue-400 font-semibold">smart contracts</span> and recorded on-chain for complete transparency. 
                When a customer makes a purchase, our smart contracts automatically calculate and distribute tokens to their wallet within seconds.
              </p>
              <p className="text-lg text-[#9ca3af]">
                All transactions are permanently recorded on the Avalanche blockchain, making them transparent, verifiable, and immutable. 
                No company can take away rewards or change the rules retroactively. Built on Avalanche for lightning-fast transactions and minimal fees.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {blockchainFeatures.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-[#17171f] border-[#2d2d3a] h-full hover:border-blue-500 transition-all">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-[#9ca3af]">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Blockchain networks */}
          <div className="mt-12 text-center">
            <p className="text-sm text-[#9ca3af] mb-4">Supported Blockchain Networks</p>
            <div className="flex flex-wrap justify-center gap-4">
              {['Avalanche', 'Ethereum', 'Polygon', 'BSC', 'Base'].map((network) => (
                <Badge key={network} variant="outline" className="border-[#2d2d3a] text-white px-4 py-2">
                  {network}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* POS Integrations */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30">
              POS Integration
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Connect Any POS in Minutes
            </h2>
            <div className="max-w-4xl mx-auto space-y-3">
              <p className="text-xl text-[#9ca3af]">
                Seamless integration with all major point-of-sale systems worldwide. <span className="text-purple-400 font-semibold">No hardware changes required</span> — just connect via API and start rewarding customers instantly.
              </p>
              <p className="text-lg text-[#9ca3af]">
                Our universal API works with Priority ERP, Worldline SmartPOS, Nets, Zettle by PayPal, PAX, Ingenico, Verifone, Sunmi, and all major SoftPOS solutions. 
                Integration typically takes less than 15 minutes with our developer-friendly documentation. Support for custom POS systems available.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 mb-12">
            {posIntegrations.map((pos, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                viewport={{ once: true }}
              >
                <Card className="bg-[#1f2128] border-[#2d2d3a] hover:border-teal-500 transition-all cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl mb-2">{pos.icon}</div>
                    <p className="text-xs text-[#9ca3af] font-medium">{pos.name}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Card className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/30 max-w-2xl mx-auto">
              <CardContent className="p-8">
                <Zap className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">API-First Integration</h3>
                <p className="text-[#9ca3af]">
                  Don't see your POS? Our flexible API works with any system. Connect in under 15 minutes with our developer-friendly docs.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Rewards & Benefits */}
      <section className="py-24 px-6 bg-[#1f2128]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-teal-500/20 text-teal-400 border-teal-500/30">
              Rewards System
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Rewards & Benefits
            </h2>
            <div className="max-w-4xl mx-auto space-y-3">
              <p className="text-xl text-[#9ca3af]">
                Go beyond basic points with a comprehensive rewards ecosystem. Offer <span className="text-teal-400 font-semibold">Smart Coupons, NFT collectibles, crypto cashback, and tiered VIP benefits</span> that keep customers engaged and loyal.
              </p>
              <p className="text-lg text-[#9ca3af]">
                Our AI-powered system automatically personalizes offers based on customer behavior. From birthday bonuses to limited-edition NFTs, 
                create memorable experiences that turn one-time buyers into lifelong brand advocates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {rewardTypes.map((reward, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-[#17171f] border-[#2d2d3a] h-full hover:border-teal-500 transition-all">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center mb-4">
                      <reward.icon className="w-6 h-6 text-teal-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-4">{reward.title}</h3>
                    <ul className="space-y-2">
                      {reward.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#9ca3af]">
                           <Check className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                           <span>{item}</span>
                         </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30">
              Simple Process
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              How It Works
            </h2>
            <p className="text-xl text-[#9ca3af]">
              Get started with blockchain loyalty in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.2 }}
                viewport={{ once: true }}
                className="relative"
              >
                {idx < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-teal-500 via-cyan-400 to-transparent z-0"></div>
                )}
                <Card className="bg-gradient-to-br from-[#1f2128] to-[#17171f] border-[#2d2d3a] h-full relative z-10 hover:border-teal-500 transition-all">
                  <CardContent className="p-8 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 mb-6">
                      <step.icon className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-5xl font-bold text-teal-400 mb-4">{step.number}</div>
                    <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                    <p className="text-[#9ca3af]">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="py-24 px-6 bg-[#1f2128]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-teal-500/20 text-teal-400 border-teal-500/30">
              Platform Features
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-[#9ca3af] max-w-3xl mx-auto">
              Powerful tools and analytics to manage, automate, and optimize your loyalty program
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platformFeatures.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-[#17171f] border-[#2d2d3a] h-full hover:border-teal-500 transition-all">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-teal-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-[#9ca3af]">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Trusted by innovative businesses worldwide
            </h2>
            <div className="flex items-center justify-center gap-2 text-[#9ca3af] mb-8">
              <Users className="w-5 h-5" />
              <span>1000+ merchants</span>
              <span className="mx-2">•</span>
              <TrendingUp className="w-5 h-5" />
              <span>$5M+ in rewards distributed</span>
              <span className="mx-2">•</span>
              <Shield className="w-5 h-5" />
              <span>Bank-level security</span>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-8 items-center opacity-50">
            {partners.map((partner, idx) => (
              <div key={idx} className="text-center">
                <div className="text-4xl mb-2">{partner.logo}</div>
                <p className="text-sm text-[#9ca3af]">{partner.name}</p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {[
              { icon: Building2, label: 'Active Businesses', value: '1,000+' },
              { icon: Users, label: 'Happy Customers', value: '50,000+' },
              { icon: Coins, label: 'Tokens Distributed', value: '10M+' }
            ].map((stat, idx) => (
              <Card key={idx} className="bg-[#1f2128] border-[#2d2d3a]">
                <CardContent className="p-6 text-center">
                  <stat.icon className="w-8 h-8 text-teal-400 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                  <p className="text-sm text-[#9ca3af]">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-teal-500 to-cyan-600 border-0">
            <CardContent className="p-12 text-center">
              <h2 className="text-4xl font-bold text-white mb-4">
                Ready to transform your loyalty program?
              </h2>
              <p className="text-xl text-white/80 mb-8">
                Join thousands of businesses already using blockchain rewards
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
                <Input 
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white border-0 text-slate-900"
                />
                <Button 
                  onClick={() => handleSignUp('email')}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <p className="text-sm text-white/60 mt-4">
                No credit card required • Set up in minutes
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#2d2d3a]">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6963639287e0e9f0e481bd78/473f66310_logo.png" 
              alt="Mooadon" 
              className="h-24 w-auto"
            />
          </div>
          <p className="text-[#9ca3af] text-sm">
            © 2026 Mooadon. Built on blockchain, powered by innovation.
          </p>
        </div>
      </footer>
    </div>
  );
}