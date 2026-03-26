import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import OnboardingGuard from '@/components/auth/OnboardingGuard';
import {
  Building2,
  LayoutDashboard,
  Users,
  Brain,
  Store,
  Receipt,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronDown,
  Coins,
  Webhook,
  Zap,
  Sparkles,
  Star,
  MessageSquare,
  DollarSign,
  ShoppingBag,
  Package,
  ClipboardList,
  Share2,
  TrendingUp,
  Lock,
  ChevronRight,
  Globe,
  Cpu,
  Wand2,
  Trash2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from '@/components/i18n/useI18n';
import { ADMIN_EMAILS, isSystemAdmin } from '@/components/constants/adminConfig';
import LanguageSelector from '@/components/i18n/LanguageSelector';
import CompanySelector from '@/components/company/CompanySelector';
import AvalancheAssistantWidget from '@/components/AvalancheAssistantWidget';
import AvaxPriceTicker from '@/components/AvaxPriceTicker';
import { useQuery } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import UpgradeModal from '@/components/plans/UpgradeModal';
import { PLAN_LABELS } from '@/components/plans/featureFlags';

// Pages that don't need layout
const PUBLIC_PAGES = ['ClientPortal', 'ClaimReward', 'CouponDisplay', 'ClientOnboarding'];

export default function Layout({ children, currentPageName }) {
  const { t, dir, setLanguage } = useI18n();
  const { user, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (user?.language) {
      setLanguage(user.language);
    }
  }, [user, setLanguage]);

  if (PUBLIC_PAGES.includes(currentPageName) || currentPageName === 'Login' || currentPageName === 'LandingPage') {
    return <>{children}</>;
  }

  return (
    <>
      <OnboardingGuard>
        {user ? (
          <LayoutShell user={user} currentPageName={currentPageName} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} t={t} dir={dir}>
            {children}
          </LayoutShell>
        ) : (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10b981]"></div>
          </div>
        )}
      </OnboardingGuard>
      {user && <AvalancheAssistantWidget />}
    </>
  );
}

// Tier order for comparisons
const TIER_ORDER = { basic: 0, advanced: 1, pro: 2 };

function getEffectiveTier(company) {
  if (!company) return 'basic';
  const status = company.plan_status || 'active';
  if (status === 'past_due' || status === 'canceled') return 'basic';
  return company.plan_tier || 'basic';
}

function SectionLabel({ label }) {
  return (
    <div className="px-3 pt-4 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest select-none">
      {label}
    </div>
  );
}

function NavItem({ item, isActive, onClick, effectiveTier, onUpgradeClick }) {
  const tierNeeded = item.minTier ? TIER_ORDER[item.minTier] : 0;
  const userTier = TIER_ORDER[effectiveTier] ?? 0;
  const locked = tierNeeded > userTier;

  if (locked) {
    return (
      <button
        onClick={() => onUpgradeClick?.(item.minTier)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 cursor-pointer hover:bg-[#17171f] w-full group relative"
        title={`Upgrade to ${item.minTier} to unlock`}
      >
        <item.icon className="w-4 h-4 text-slate-600" />
        <span className="font-medium flex-1 text-left">{item.name}</span>
        <Lock className="w-3 h-3 text-slate-600 ml-auto" />
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-[#17171f] border border-[#2d2d3a] text-slate-300 text-xs rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          Upgrade to {item.minTier} to unlock
        </div>
      </button>
    );
  }

  return (
    <Link
      to={createPageUrl(item.page)}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
        isActive
          ? 'bg-[#10b981] text-white'
          : 'text-[#9ca3af] hover:bg-[#17171f] hover:text-white'
      }`}
    >
      <item.icon className="w-4 h-4" />
      <span className="font-medium">{item.name}</span>
    </Link>
  );
}

function LayoutShell({ user, currentPageName, mobileOpen, setMobileOpen, t, dir, children }) {
  const isAdmin = isSystemAdmin(user);
  const [web3Open, setWeb3Open] = useState(false);
  const { primaryCompanyId, allCompanies, adminCompanyId } = useUserPermissions();

  const { data: company } = useQuery({
    queryKey: ['company-plan', primaryCompanyId],
    queryFn: async () => {
      if (!primaryCompanyId) return null;
      const cs = await base44.entities.Company.filter({ id: primaryCompanyId });
      return cs[0] || null;
    },
    enabled: !!primaryCompanyId,
    staleTime: 60_000,
  });

  const effectiveTier = isAdmin ? 'pro' : getEffectiveTier(company);
  const [upgradeModal, setUpgradeModal] = useState(null);
  const handleUpgradeClick = (requiredTier) => setUpgradeModal({ requiredTier });

  const SECTIONS = [
    {
      label: 'Setup',
      items: [
        { name: 'Getting Started', page: 'OnboardingWizard', icon: Zap },
        { name: 'Settings', page: 'CompanySettings', icon: Settings },
        { name: 'Branches', page: 'Branches', icon: Store },
        { name: 'Clients', page: 'Clients', icon: Users },
        { name: 'Integrations', page: 'IntegrationsDashboard', icon: Zap },
      ]
    },
    {
      label: 'Operations',
      items: [
        { name: 'POS Terminal', page: 'POSTerminal', icon: Receipt },
        { name: 'Transactions', page: 'TransactionsAndSettlement', icon: ClipboardList },
        { name: 'Store Orders', page: 'WalletStoreOrders', icon: Package, minTier: 'advanced' },
      ]
    },
    {
      label: 'Growth',
      items: [
        { name: 'Coupons', page: 'Coupons', icon: Sparkles },
        { name: 'Social Marketing', page: 'SocialMarketing', icon: Share2 },
        { name: 'Automation', page: 'AutomationRules', icon: Zap, minTier: 'advanced' },
        { name: 'Rewards Store', page: 'RewardsStore', icon: ShoppingBag, minTier: 'advanced' },
        { name: 'Wallet Store', page: 'WalletStore', icon: Store, minTier: 'advanced' },
      ]
    },
    {
      label: 'AI Features',
      items: [
        { name: 'AI Insights', page: 'CustomerAIInsights', icon: Brain, minTier: 'advanced' },
        { name: 'AI Studio', page: 'BusinessAIStudio', icon: Wand2, minTier: 'pro' },
        { name: 'AI Campaigns', page: 'AICampaigns', icon: Sparkles, minTier: 'pro' },
        { name: 'Brand Voice', page: 'BrandVoiceSettings', icon: MessageSquare, minTier: 'pro' },
      ]
    },
  ];

  const WEB3_ITEMS = [
    { name: 'Web3 Hub', page: 'Web3Hub', icon: Globe },
    { name: 'Cross-Chain', page: 'CrossChainRedemption', icon: Zap },
  ];

  const ADMIN_SECTION = isAdmin ? {
    label: 'Admin',
    items: [
      { name: 'Companies', page: 'Companies', icon: Building2 },
      { name: 'Super Dashboard', page: 'SuperAdminDashboard', icon: LayoutDashboard },
      { name: 'Agent Dashboard', page: 'AgentDashboard', icon: LayoutDashboard },
      { name: 'Company Repair', page: 'CompanyRepairTool', icon: Shield },
        { name: 'Setup Monitor', page: 'CompanySetupMonitor', icon: Shield },
        { name: 'Mint Security', page: 'MintSecurityDashboard', icon: Shield },
        { name: 'Stalled Txns', page: 'StalledTransactionsCleanup', icon: Trash2 },
      { name: 'Products Admin', page: 'ProductsAdmin', icon: Package },
      { name: 'Store Admin', page: 'AdminStoreManagement', icon: ShoppingBag },
      { name: 'Admin Mint', page: 'AdminMintTool', icon: Coins },
      { name: 'Token Mgmt', page: 'TokenManagement', icon: Coins },
      { name: 'Blockchain TX', page: 'BlockchainTransactions', icon: BookOpen },
      { name: 'Mooadon Admin', page: 'MooadonAdmin', icon: Sparkles },
    ]
  } : null;

  const NavContent = ({ onNavigate }) => (
    <nav className="space-y-0.5">
      <NavItem
        item={{ name: t('nav.dashboard'), page: isAdmin ? 'SuperAdminDashboard' : 'AgentDashboard', icon: LayoutDashboard }}
        isActive={currentPageName === (isAdmin ? 'SuperAdminDashboard' : 'AgentDashboard')}
        onClick={onNavigate}
        effectiveTier={effectiveTier}
        onUpgradeClick={handleUpgradeClick}
      />

      {SECTIONS.map((section) => (
        <div key={section.label}>
          <SectionLabel label={section.label} />
          {section.items.map((item) => (
            <NavItem
              key={item.page}
              item={item}
              isActive={currentPageName === item.page}
              onClick={onNavigate}
              effectiveTier={effectiveTier}
              onUpgradeClick={handleUpgradeClick}
            />
          ))}
        </div>
      ))}

      <div>
        <SectionLabel label="Web3" />
        <button
          onClick={() => setWeb3Open(v => !v)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-[#17171f] transition-colors"
        >
          <Globe className="w-4 h-4" />
          <span className="font-medium flex-1 text-left">Advanced (Pro)</span>
          <ChevronRight className={`w-3 h-3 transition-transform ${web3Open ? 'rotate-90' : ''}`} />
        </button>
        {web3Open && (
          <div className="ml-2 border-l border-[#2d2d3a] pl-2 mt-0.5 space-y-0.5">
            {WEB3_ITEMS.map((item) => (
              <NavItem
                key={item.page}
                item={{ ...item, minTier: 'pro' }}
                isActive={currentPageName === item.page}
                onClick={onNavigate}
                effectiveTier={effectiveTier}
                onUpgradeClick={handleUpgradeClick}
              />
            ))}
          </div>
        )}
      </div>

      {ADMIN_SECTION && (
        <div>
          <SectionLabel label={ADMIN_SECTION.label} />
          {ADMIN_SECTION.items.map((item) => (
            <NavItem
              key={item.page}
              item={item}
              isActive={currentPageName === item.page}
              onClick={onNavigate}
              effectiveTier="pro"
              onUpgradeClick={handleUpgradeClick}
            />
          ))}
        </div>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-950" dir={dir}>
      {upgradeModal && (
        <UpgradeModal
          currentTier={effectiveTier}
          requiredTier={upgradeModal.requiredTier}
          companyId={primaryCompanyId}
          onClose={() => setUpgradeModal(null)}
        />
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
      `}</style>

      {/* Desktop Sidebar */}
       <aside className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:flex lg:w-64 lg:flex-col">
         <div className="flex grow flex-col gap-y-2 overflow-y-auto bg-[#1f2128] border-l border-[#2d2d3a] px-3 py-5">
           <div className="space-y-2 mb-3">
             <div className="flex items-center gap-2 px-2">
               <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                 <img
                   src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6963639287e0e9f0e481bd78/e3fad8c78_logo.png"
                   alt="Mooadon"
                   className="w-10 h-10 object-contain"
                 />
               </div>
               <div>
                 <h1 className="text-sm font-semibold text-white">Mooadon</h1>
                 <p className="text-xs text-teal-400">Rewards. Verified.</p>
               </div>
             </div>
             {primaryCompanyId && <div className="px-2"><AvaxPriceTicker companyId={primaryCompanyId} /></div>}
           </div>

           <NavContent onNavigate={() => {}} />

          {!isAdmin && (
            <div
              className="mx-2 mt-1 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2d2d3a] bg-[#17171f] cursor-pointer hover:border-amber-500/40 transition-colors"
              onClick={() => effectiveTier !== 'pro' && handleUpgradeClick(effectiveTier === 'basic' ? 'advanced' : 'pro')}
              title={effectiveTier !== 'pro' ? 'Click to upgrade' : ''}
            >
              <div className={`w-2 h-2 rounded-full ${effectiveTier === 'pro' ? 'bg-purple-400' : effectiveTier === 'advanced' ? 'bg-blue-400' : 'bg-slate-500'}`} />
              <span className="text-xs text-slate-400 flex-1">Plan: <span className={effectiveTier === 'pro' ? 'text-purple-300 font-semibold' : effectiveTier === 'advanced' ? 'text-blue-300 font-semibold' : 'text-slate-300 font-semibold'}>{PLAN_LABELS[effectiveTier] || effectiveTier}</span></span>
              {effectiveTier !== 'pro' && <Zap className="w-3 h-3 text-amber-400" />}
            </div>
          )}

          {isAdmin && (
            <div className="pb-2 pt-2 space-y-2">
              {allCompanies?.length > 0 && (
                <div className="px-2">
                  <div className="text-xs uppercase text-slate-500 font-semibold mb-1">Selected Company</div>
                  <div className="text-sm text-white font-medium truncate">
                    {allCompanies.find(c => c.id === adminCompanyId)?.name || 'Select company'}
                  </div>
                </div>
              )}
              <CompanySelector />
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-slate-800 space-y-2">
            <LanguageSelector />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-[#17171f] transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white text-xs">
                      {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-medium text-white">{user.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-[#1f2128] border-[#2d2d3a]">
                <DropdownMenuItem className="gap-2 text-white text-xs">
                  <Shield className="w-3 h-3" />
                  {isAdmin ? 'System Admin' : `Plan: ${PLAN_LABELS[effectiveTier] || effectiveTier}`}
                </DropdownMenuItem>
                {!isAdmin && effectiveTier !== 'pro' && (
                  <DropdownMenuItem
                    className="gap-2 text-amber-400 hover:bg-[#17171f] text-xs"
                    onClick={() => handleUpgradeClick(effectiveTier === 'basic' ? 'advanced' : 'pro')}
                  >
                    <Zap className="w-3 h-3" />
                    Upgrade Plan
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-[#2d2d3a]" />
                <DropdownMenuItem
                  className="gap-2 text-[#10b981] hover:bg-[#17171f] text-xs"
                  onClick={() => base44.auth.logout()}
                >
                  <LogOut className="w-3 h-3" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 bg-[#17171f] border-b border-[#2d2d3a] px-3 py-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6963639287e0e9f0e481bd78/e3fad8c78_logo.png"
              alt="Mooadon"
              className="w-8 h-8 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="font-semibold text-white text-sm">Mooadon</h1>
        </div>
        {isAdmin && (
          <div className="flex-1 max-w-[140px]">
            <CompanySelector />
          </div>
        )}
        {/* Avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white text-xs font-bold flex-shrink-0">
              {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#1f2128] border-[#2d2d3a]">
            <DropdownMenuItem className="gap-2 text-white text-xs">
              <Shield className="w-3 h-3" />
              {isAdmin ? 'System Admin' : `Plan: ${PLAN_LABELS[effectiveTier] || effectiveTier}`}
            </DropdownMenuItem>
            {!isAdmin && effectiveTier !== 'pro' && (
              <DropdownMenuItem
                className="gap-2 text-amber-400 hover:bg-[#17171f] text-xs"
                onClick={() => handleUpgradeClick(effectiveTier === 'basic' ? 'advanced' : 'pro')}
              >
                <Zap className="w-3 h-3" />
                Upgrade Plan
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-[#2d2d3a]" />
            <DropdownMenuItem
              className="gap-2 text-[#10b981] hover:bg-[#17171f] text-xs"
              onClick={() => base44.auth.logout()}
            >
              <LogOut className="w-3 h-3" />
              {t('nav.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hamburger → full sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-300 h-8 w-8 flex-shrink-0">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0 bg-[#1f2128] border-[#2d2d3a] overflow-y-auto">
            <div className="flex items-center gap-2 p-4 border-b border-[#2d2d3a]">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6963639287e0e9f0e481bd78/e3fad8c78_logo.png"
                alt="Mooadon"
                className="w-10 h-10 rounded-lg object-contain"
              />
              <div>
                <h1 className="text-sm font-semibold text-white">Mooadon</h1>
                <p className="text-xs text-teal-400">All Pages</p>
              </div>
            </div>
            <div className="p-3">
              <NavContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile Bottom Navigation — 2 rows */}
      <MobileBottomNav
        currentPageName={currentPageName}
        isAdmin={isAdmin}
        effectiveTier={effectiveTier}
        onUpgradeClick={handleUpgradeClick}
        onMoreClick={() => setMobileOpen(true)}
        t={t}
      />

      {/* Main Content */}
      <main className={currentPageName === 'POSTerminal' || currentPageName === 'MooadonTouchMenu' ? '' : 'lg:pr-64'}>
        <div className={currentPageName === 'POSTerminal' || currentPageName === 'MooadonTouchMenu' ? 'pb-36 lg:pb-16' : 'p-3 lg:p-6 pb-36 lg:pb-16'}>
          {children}
        </div>
        {/* Powered by Footer — desktop only */}
        <div className="hidden lg:flex fixed bottom-0 left-0 right-0 lg:right-64 bg-[#1a1a2e]/90 backdrop-blur-sm border-t border-[#2d2d3a] py-1.5 px-3 items-center justify-center gap-1.5 text-xs text-gray-400 z-40 flex-wrap">
          <a href="https://base44.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#FF6B35"/><rect x="15" y="58" width="70" height="4" fill="white"/><rect x="15" y="68" width="70" height="4" fill="white"/><rect x="15" y="78" width="70" height="4" fill="white"/></svg>
            <span className="font-medium">Base44</span>
          </a>
          <span>|</span>
          <a href="https://avax.network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#E84142"/><path d="M21.5 21H17.8L16 17.5L14.2 21H10.5L16 11L21.5 21Z" fill="white"/><path d="M12.5 21H9L11.75 16L12.5 21Z" fill="white"/></svg>
            <span className="font-medium text-red-400">Avalanche</span>
          </a>
          <span>|</span>
          <span className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded whitespace-nowrap">Demo (Fuji)</span>
        </div>
      </main>
    </div>
  );
}

LayoutShell.displayName = 'LayoutShell';

// ── Mobile Bottom Navigation — 2 rows ─────────────────────────────────────────
function MobileBottomNav({ currentPageName, isAdmin, effectiveTier, onUpgradeClick, onMoreClick, t }) {
  const ROW1 = isAdmin
    ? [
        { name: 'Home',      page: 'SuperAdminDashboard',          icon: LayoutDashboard },
        { name: 'Companies', page: 'Companies',                   icon: Building2 },
        { name: 'POS',       page: 'POSTerminal',                 icon: Receipt },
        { name: 'Txns',      page: 'TransactionsAndSettlement',   icon: ClipboardList },
        { name: 'More',      page: null,                          icon: Menu, action: 'more' },
      ]
    : [
        { name: 'Home',      page: 'AgentDashboard',            icon: LayoutDashboard },
        { name: 'POS',       page: 'POSTerminal',               icon: Receipt },
        { name: 'Clients',   page: 'Clients',                   icon: Users },
        { name: 'Store',     page: 'WalletStore',               icon: ShoppingBag },
        { name: 'More',      page: null,                        icon: Menu, action: 'more' },
      ];

  const ROW2 = [
    { name: 'AI Studio',  page: 'BusinessAIStudio',      icon: Wand2 },
    { name: 'Coupons',    page: 'Coupons',               icon: Sparkles },
    { name: 'Social',     page: 'SocialMarketing',       icon: Share2 },
    { name: 'Tokens',     page: 'TokenManagement',       icon: Coins },
    { name: 'Connect',    page: 'IntegrationsDashboard', icon: Zap },
  ];

  const NavBtn = ({ item }) => {
    const isActive = currentPageName === item.page;
    const Icon = item.icon;
    if (item.action === 'more') {
      return (
        <button onClick={onMoreClick} style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: "3px", padding: "4px 2px",
          background: "none", border: "none", cursor: "pointer",
          WebkitTapHighlightColor: "transparent", flex: 1,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "11px",
            background: "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={17} color="rgba(255,255,255,0.4)" />
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{item.name}</span>
        </button>
      );
    }
    return (
      <Link to={createPageUrl(item.page)} style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: "3px", padding: "4px 2px",
        textDecoration: "none", WebkitTapHighlightColor: "transparent", flex: 1,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "11px",
          background: isActive ? "#10b981" : "rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 150ms ease",
          boxShadow: isActive ? "0 3px 12px rgba(16,185,129,0.4)" : "none",
        }}>
          <Icon size={17} color={isActive ? "#fff" : "rgba(255,255,255,0.4)"} />
        </div>
        <span style={{
          fontSize: "9px", fontWeight: 600,
          color: isActive ? "#10b981" : "rgba(255,255,255,0.3)",
        }}>{item.name}</span>
      </Link>
    );
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50" style={{
      background: "rgba(13,13,20,0.96)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      paddingBottom: "env(safe-area-inset-bottom, 6px)",
    }}>
      {/* Row 1 — primary */}
      <div style={{ display: "flex", padding: "6px 4px 2px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {ROW1.map(item => <NavBtn key={item.page || 'more'} item={item} />)}
      </div>
      {/* Row 2 — secondary */}
      <div style={{ display: "flex", padding: "2px 4px 4px" }}>
        {ROW2.map(item => <NavBtn key={item.page} item={item} />)}
      </div>
    </div>
  );
}