import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  Lightbulb, Wand2, Megaphone, MessageSquare, Crown,
  Building2, BarChart3, BarChart4, Wrench, Shield,
  Store, ShoppingCart, Coins, Lock, Cpu, Settings,
  Zap, GitBranch, Users, Plug, Workflow, TrendingUp,
  Terminal, Receipt, Ticket, Share2, Gift, Wallet,
  User, ChevronDown, ChevronUp, FileText, Globe,
  Activity, Layers, Key, BarChart2, Database,
  RefreshCw, CreditCard, MapPin, BookOpen, AlertTriangle,
  LogOut, Webhook, Home, Search, Bell
} from "lucide-react";
import { createPageUrl } from "@/utils";

// ─── Route map ────────────────────────────────────────────────────────────────
const ROUTES = {
  "ai-insights":      "CustomerAIInsights",
  "ai-studio":        "BusinessAIStudio",
  "ai-campaigns":     "AICampaigns",
  "brand-voice":      "BrandVoiceSettings",
  "web3-hub":         "Web3Hub",
  "onchain":          "OnchainActivityDashboard",
  "avalanche":        "AvalancheCopilot",
  "token-mgmt":       "TokenManagement",
  "blockchain-tx":    "BlockchainTransactions",
  "admin-mint":       "AdminMintTool",
  "zeta":             "ZetaChainBridges",
  "companies":        "Companies",
  "super-dashboard":  "SuperAdminDashboard",
  "agent-dashboard":  "AgentDashboard",
  "company-repair":   "CompanyRepairTool",
  "setup-monitor":    "CompanySetupMonitor",
  "products-admin":   "ProductsAdmin",
  "store-admin":      "AdminStoreManagement",
  "mooadon-admin":    "MooadonAdmin",
  "migration":        "MigrationCenter",
  "permissions":      "UserPermissionsManagement",
  "ledger":           "LedgerEvents",
  "reward-queue":     "RewardQueueStatus",
  "onboarding":       "OnboardingWizard",
  "settings":         "CompanySettings",
  "branches":         "Branches",
  "clients":          "Clients",
  "connect-pos":      "POSConnect",
  "pos-hub":          "POSIntegrationHub",
  "connect-crm":      "ConnectCRM",
  "connect-channel":  "ConnectSalesChannel",
  "connect-wizard":   "ConnectWizard",
  "crm-status":       "CRMStatus",
  "api-docs":         "APIDocumentation",
  "api-onboarding":   "APIOnboarding",
  "webhooks":         "WebhookSettings",
  "zapier":           "ZapierIntegration",
  "integrations":     "IntegrationsDashboard",
  "pos-terminal":     "POSTerminal",
  "pos-wizard":       "OnlinePOSWizard",
  "transactions":     "Transactions",
  "tx-settlement":    "TransactionsAndSettlement",
  "store-orders":     "WalletStoreOrders",
  "payment-history":  "PaymentHistory",
  "settlement":       "SettlementDashboard",
  "cash-pool":        "CashPoolManagement",
  "spend-qr":         "SpendQRPage",
  "coupons":          "Coupons",
  "social":           "SocialMarketing",
  "automation":       "AutomationRules",
  "automation-set":   "AutomationSettings",
  "rewards":          "RewardsStore",
  "wallet-store":     "WalletStore",
  "roi":              "CampaignROI",
  "client-portal":    "ClientPortal",
  "client-wallet":    "ClientWalletPage",
  "wallet-mgmt":      "UserWalletManagement",
  "client-staking":   "ClientStaking",
  "claim-reward":     "ClaimReward",
};

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "ai", title: "AI Features", emoji: "✨",
    gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)",
    color: "#8b5cf6",
    items: [
      { id: "ai-insights",  label: "AI Insights",  icon: Lightbulb,     lockedFor: null },
      { id: "ai-studio",    label: "AI Studio",    icon: Wand2,         lockedFor: null },
      { id: "ai-campaigns", label: "Campaigns",    icon: Megaphone,     lockedFor: "pro" },
      { id: "brand-voice",  label: "Brand Voice",  icon: MessageSquare, lockedFor: "pro" },
    ],
  },
  {
    id: "web3", title: "Web3 & Blockchain", emoji: "⛓️",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    color: "#10b981",
    items: [
      { id: "web3-hub",      label: "Web3 Hub",   icon: Globe,    lockedFor: "pro" },
      { id: "onchain",       label: "Onchain",    icon: Activity, lockedFor: "pro" },
      { id: "avalanche",     label: "Avalanche",  icon: Layers,   lockedFor: "pro" },
      { id: "token-mgmt",    label: "Tokens",     icon: Coins,    lockedFor: "admin" },
      { id: "blockchain-tx", label: "Blockchain", icon: Cpu,      lockedFor: "admin" },
      { id: "admin-mint",    label: "Mint",       icon: Database, lockedFor: "admin" },
      { id: "zeta",          label: "ZetaChain",  icon: Share2,   lockedFor: "admin" },
    ],
  },
  {
    id: "admin", title: "Admin", emoji: "🛠",
    gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)",
    color: "#ef4444",
    items: [
      { id: "companies",       label: "Companies",   icon: Building2,     lockedFor: "admin" },
      { id: "super-dashboard", label: "Super Dash",  icon: BarChart3,     lockedFor: "admin" },
      { id: "agent-dashboard", label: "Agent Dash",  icon: BarChart4,     lockedFor: "admin" },
      { id: "company-repair",  label: "Repair",      icon: Wrench,        lockedFor: "admin" },
      { id: "setup-monitor",   label: "Monitor",     icon: Shield,        lockedFor: "admin" },
      { id: "products-admin",  label: "Products",    icon: Store,         lockedFor: "admin" },
      { id: "store-admin",     label: "Store Mgmt",  icon: ShoppingCart,  lockedFor: "admin" },
      { id: "mooadon-admin",   label: "System",      icon: Settings,      lockedFor: "admin" },
      { id: "migration",       label: "Migration",   icon: RefreshCw,     lockedFor: "admin" },
      { id: "permissions",     label: "Permissions", icon: Key,           lockedFor: "admin" },
      { id: "ledger",          label: "Ledger",      icon: BookOpen,      lockedFor: "admin" },
      { id: "reward-queue",    label: "Queue",       icon: AlertTriangle, lockedFor: "admin" },
    ],
  },
  {
    id: "setup", title: "Setup", emoji: "⚙️",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
    color: "#f59e0b",
    items: [
      { id: "onboarding",   label: "Getting Started", icon: Zap,       lockedFor: null },
      { id: "settings",     label: "Settings",        icon: Settings,  lockedFor: null },
      { id: "branches",     label: "Branches",        icon: GitBranch, lockedFor: null },
      { id: "clients",      label: "Clients",         icon: Users,     lockedFor: null },
      { id: "integrations", label: "Integrations",    icon: Layers,    lockedFor: null },
      { id: "api-docs",     label: "API Docs",        icon: FileText,  lockedFor: "pro" },
      { id: "webhooks",     label: "Webhooks",        icon: Webhook,   lockedFor: "pro" },
      { id: "zapier",       label: "Zapier",          icon: Zap,       lockedFor: "pro" },
    ],
  },
  {
    id: "operations", title: "Operations", emoji: "🏪",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)",
    color: "#3b82f6",
    items: [
      { id: "pos-terminal",    label: "POS",          icon: Terminal,     lockedFor: null },
      { id: "pos-wizard",      label: "POS Wizard",   icon: Wand2,        lockedFor: null },
      { id: "transactions",    label: "Transactions", icon: Receipt,      lockedFor: null },
      { id: "tx-settlement",   label: "TX Settle",    icon: CreditCard,   lockedFor: null },
      { id: "store-orders",    label: "Orders",       icon: ShoppingCart, lockedFor: null },
      { id: "payment-history", label: "Payments",     icon: BarChart2,    lockedFor: null },
      { id: "settlement",      label: "Settlement",   icon: FileText,     lockedFor: "pro" },
      { id: "cash-pool",       label: "Cash Pool",    icon: Database,     lockedFor: "admin" },
      { id: "spend-qr",        label: "Spend QR",     icon: MapPin,       lockedFor: null },
    ],
  },
  {
    id: "growth", title: "Growth", emoji: "🚀",
    gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)",
    color: "#ec4899",
    items: [
      { id: "coupons",        label: "Coupons",       icon: Ticket,     lockedFor: null },
      { id: "social",         label: "Social",        icon: Share2,     lockedFor: "pro" },
      { id: "automation",     label: "Automation",    icon: Zap,        lockedFor: "pro" },
      { id: "automation-set", label: "Auto Settings", icon: Settings,   lockedFor: "pro" },
      { id: "rewards",        label: "Rewards",       icon: Gift,       lockedFor: null },
      { id: "wallet-store",   label: "Wallet Store",  icon: Wallet,     lockedFor: null },
      { id: "roi",            label: "ROI",           icon: TrendingUp, lockedFor: "pro" },
    ],
  },
  {
    id: "clients-area", title: "Client Area", emoji: "👤",
    gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)",
    color: "#14b8a6",
    items: [
      { id: "client-portal",  label: "Portal",      icon: User,     lockedFor: null },
      { id: "client-wallet",  label: "Wallet",      icon: Wallet,   lockedFor: null },
      { id: "wallet-mgmt",    label: "Wallet Mgmt", icon: Database, lockedFor: "admin" },
      { id: "client-staking", label: "Staking",     icon: Layers,   lockedFor: "pro" },
      { id: "claim-reward",   label: "Claim",       icon: Gift,     lockedFor: null },
    ],
  },
];

// ─── Tile Component ───────────────────────────────────────────────────────────
function Tile({ item, isLocked, onPress, accentColor }) {
  const [pressed, setPressed] = useState(false);
  const Icon = item.icon;

  return (
    <button
      onClick={() => !isLocked && onPress(item.id)}
      onPointerDown={() => !isLocked && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: "20px",
        border: isLocked
          ? "1px solid rgba(255,255,255,0.06)"
          : "1px solid rgba(255,255,255,0.1)",
        cursor: isLocked ? "not-allowed" : "pointer",
        background: isLocked
          ? "rgba(255,255,255,0.03)"
          : "rgba(255,255,255,0.07)",
        transform: pressed ? "scale(0.88)" : "scale(1)",
        transition: "transform 100ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "10px 6px 12px",
        overflow: "hidden",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: "14px",
        background: isLocked ? "rgba(255,255,255,0.05)" : `${accentColor}22`,
        border: `1.5px solid ${isLocked ? "rgba(255,255,255,0.08)" : accentColor + "55"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        boxShadow: isLocked ? "none" : `0 4px 12px ${accentColor}33`,
      }}>
        <Icon size={20} color={isLocked ? "rgba(255,255,255,0.2)" : accentColor} strokeWidth={1.8} />
      </div>

      <span style={{
        fontSize: "10px", fontWeight: 600,
        color: isLocked ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.85)",
        textAlign: "center", lineHeight: 1.3,
        wordBreak: "break-word", maxWidth: "100%",
        letterSpacing: "-0.01em",
      }}>
        {item.label}
      </span>

      {isLocked && (
        <div style={{
          position: "absolute", top: 7, right: 7,
          width: 16, height: 16, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Lock size={8} color="rgba(255,255,255,0.3)" strokeWidth={2.5} />
        </div>
      )}

      {isLocked && item.lockedFor !== "admin" && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(245,158,11,0.15)",
          borderTop: "1px solid rgba(245,158,11,0.2)",
          padding: "2px 0", textAlign: "center",
        }}>
          <span style={{ fontSize: "7px", fontWeight: 800, color: "#f59e0b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            PRO
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────
function CategorySection({ category, userRole, onPress }) {
  const [collapsed, setCollapsed] = useState(false);

  const isItemLocked = (item) =>
    (item.lockedFor === "admin" && userRole !== "admin") ||
    (item.lockedFor === "pro" && userRole === "free");

  const unlockedCount = category.items.filter(i => !isItemLocked(i)).length;

  return (
    <section style={{ marginBottom: "12px" }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: "100%", border: "none",
          borderRadius: collapsed ? "18px" : "18px 18px 0 0",
          background: category.gradient,
          padding: "14px 16px",
          display: "flex", alignItems: "center", gap: "10px",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          boxShadow: `0 4px 20px ${category.color}44`,
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "50%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)",
          borderRadius: "18px 18px 0 0", pointerEvents: "none",
        }} />
        <span style={{ fontSize: "18px", lineHeight: 1 }}>{category.emoji}</span>
        <span style={{
          flex: 1, textAlign: "left", fontSize: "15px", fontWeight: 700,
          color: "#fff", letterSpacing: "-0.02em", textShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}>
          {category.title}
        </span>
        <span style={{
          fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.7)",
          background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "2px 8px",
        }}>
          {unlockedCount}/{category.items.length}
        </span>
        <span style={{ color: "rgba(255,255,255,0.8)", display: "flex", marginLeft: 2 }}>
          {collapsed ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronUp size={16} strokeWidth={2.5} />}
        </span>
      </button>

      {!collapsed && (
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${category.color}33`,
          borderTop: "none", borderRadius: "0 0 18px 18px", padding: "12px",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            {category.items.map(item => (
              <Tile key={item.id} item={item} isLocked={isItemLocked(item)} onPress={onPress} accentColor={category.color} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MooadonTouchMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const userRole =
    user?.role === "admin" || user?.role === "super_admin" ? "admin" :
    user?.role === "business" ? "pro" : "free";

  const handlePress = (id) => {
    const page = ROUTES[id];
    if (page) navigate(createPageUrl(page));
  };

  const roleConfig = {
    admin: { label: "Admin",    color: "#a78bfa", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.3)" },
    pro:   { label: "Business", color: "#10b981", bg: "rgba(16,185,129,0.15)",  border: "rgba(16,185,129,0.3)"  },
    free:  { label: "Free",     color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.3)"  },
  };
  const role = roleConfig[userRole];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f0f18 0%, #13131f 40%, #0d1117 100%)",
      maxWidth: 640, margin: "0 auto",
      fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 300ms ease, transform 300ms ease",
    }}>

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(15,15,24,0.85)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: "12px",
          background: "linear-gradient(135deg, #10b981, #059669)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(16,185,129,0.4)", flexShrink: 0,
        }}>
          <span style={{ fontSize: "18px", fontWeight: 900, color: "#fff", letterSpacing: "-0.05em" }}>M</span>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.03em" }}>Mooadon</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: 1 }}>Trust Rail</div>
        </div>

        <div style={{
          fontSize: "11px", fontWeight: 700, color: role.color,
          background: role.bg, border: `1px solid ${role.border}`,
          borderRadius: "20px", padding: "4px 10px", letterSpacing: "0.02em",
        }}>
          {role.label}
        </div>

        <button
          onClick={() => navigate(createPageUrl("CompanySettings"))}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, #10b981, #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", border: "none",
            fontSize: "14px", fontWeight: 700, color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)", flexShrink: 0,
          }}
        >
          {(user?.full_name?.charAt(0) || user?.email?.charAt(0) || "?").toUpperCase()}
        </button>
      </header>

      {/* Welcome Banner */}
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(99,102,241,0.08) 100%)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: "20px", padding: "16px 18px",
          display: "flex", alignItems: "center", gap: "14px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -20, right: -20,
            width: 80, height: 80,
            background: "radial-gradient(circle, rgba(16,185,129,0.3), transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{
            width: 46, height: 46, borderRadius: "14px",
            background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: "22px" }}>👋</span>
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
              {greeting}, {firstName}
            </div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
              {userRole === "admin" ? "Full platform access" : userRole === "pro" ? "Business dashboard" : "Upgrade to unlock more"}
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <main style={{ padding: "12px 16px 100px" }}>
        {CATEGORIES.map((cat, i) => (
          <div key={cat.id} style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(16px)",
            transition: `opacity 350ms ease ${i * 60}ms, transform 350ms ease ${i * 60}ms`,
          }}>
            <CategorySection category={cat} userRole={userRole} onPress={handlePress} />
          </div>
        ))}
        <div style={{ textAlign: "center", paddingTop: "12px", fontSize: "11px", color: "rgba(255,255,255,0.12)", letterSpacing: "0.05em" }}>
          MOOADON · TRUST RAIL · 2026
        </div>
      </main>
    </div>
  );
}