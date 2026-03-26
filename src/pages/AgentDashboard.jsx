import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { useApiQuery } from '@/components/api/useApiQuery';
import {
  Users, Receipt, TrendingUp, ArrowRight, Zap,
  AlertTriangle, Coins, Gift, Ticket, Share2,
  ChevronRight, Activity, Building2, BarChart3,
  Loader2, Copy, ExternalLink, CheckCircle, Fuel, Send, Wallet
} from 'lucide-react';
import CompanyTokensTable from '@/components/admin/CompanyTokensTable';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth } from 'date-fns';
import NoPhoneWarningBanner from '@/components/pos/NoPhoneWarningBanner';
import { getEffectiveTier, isTrialExpired, trialDaysLeft } from '@/components/plans/featureFlags';
import UpgradeModal from '@/components/plans/UpgradeModal';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      "#0f0f18",
  card:    "#1a1a27",
  border:  "rgba(255,255,255,0.07)",
  green:   "#10b981",
  muted:   "rgba(255,255,255,0.4)",
  white:   "#ffffff",
  purple:  "#8b5cf6",
  amber:   "#f59e0b",
  red:     "#ef4444",
  blue:    "#3b82f6",
};

// ─── Quick Action Button ───────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, to, color = C.green, badge }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Link
      to={createPageUrl(to)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: "8px",
        padding: "14px 8px",
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "18px",
        textDecoration: "none",
        transform: pressed ? "scale(0.92)" : "scale(1)",
        transition: "transform 100ms cubic-bezier(0.34,1.56,0.64,1)",
        WebkitTapHighlightColor: "transparent",
        position: "relative",
        flex: 1,
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: "14px",
        background: `${color}18`,
        border: `1.5px solid ${color}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 4px 16px ${color}22`,
      }}>
        <Icon size={22} color={color} strokeWidth={1.8} />
      </div>
      <span style={{
        fontSize: "11px", fontWeight: 600,
        color: "rgba(255,255,255,0.75)",
        textAlign: "center", lineHeight: 1.3,
      }}>
        {label}
      </span>
      {badge && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 8, height: 8, borderRadius: "50%",
          background: C.red,
          boxShadow: `0 0 6px ${C.red}`,
        }} />
      )}
    </Link>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = C.green, icon: Icon }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: "18px",
      padding: "16px",
      display: "flex", alignItems: "center", gap: "14px",
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: "14px",
        background: `${color}15`,
        border: `1px solid ${color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={20} color={color} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "22px", fontWeight: 800, color: C.white, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
          {value}
        </div>
        <div style={{ fontSize: "12px", color: C.muted, marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: "11px", color: color, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────
function TxRow({ tx, fmt }) {
  const isCompleted = tx.status === 'completed';
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "12px 0",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: "12px",
        background: isCompleted ? `${C.green}15` : `${C.amber}15`,
        border: `1px solid ${isCompleted ? C.green + "33" : C.amber + "33"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Receipt size={16} color={isCompleted ? C.green : C.amber} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: C.white }}>
          {fmt(parseFloat(tx.amount) || 0)}
        </div>
        <div style={{ fontSize: "11px", color: C.muted, marginTop: 1 }}>
          {tx.client_phone || 'Unknown'} · {tx.tokens_earned ? `+${tx.tokens_earned} pts` : ''}
        </div>
      </div>
      <div style={{
        fontSize: "10px", fontWeight: 700,
        color: isCompleted ? C.green : C.amber,
        background: isCompleted ? `${C.green}15` : `${C.amber}15`,
        border: `1px solid ${isCompleted ? C.green + "33" : C.amber + "33"}`,
        borderRadius: "8px",
        padding: "3px 8px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        {tx.status}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function AgentDashboard() {
  const { user, primaryCompanyId, isSystemAdmin, loading: permissionsLoading } = useUserPermissions();
  const [currency, setCurrencyState] = useState(() => localStorage.getItem('dashboard_currency') || 'ILS');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const setCurrency = (c) => { localStorage.setItem('dashboard_currency', c); setCurrencyState(c); };

  const CURRENCIES = [
    { symbol: '₪', code: 'ILS' },
    { symbol: '$', code: 'USD', rate: 0.27 },
    { symbol: '€', code: 'EUR', rate: 0.25 },
  ];

  const fmt = (amountILS) => {
    const cur = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    const val = cur.rate ? amountILS * cur.rate : amountILS;
    return `${cur.symbol}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: company, isLoading: companyLoading } = useApiQuery({
    queryKey: ['company', primaryCompanyId, user?.email],
    queryFn: async () => {
      if (primaryCompanyId) {
        const cs = await base44.entities.Company.filter({ id: primaryCompanyId });
        if (cs.length > 0) return cs[0];
      }
      if (user?.email) {
        const cs = await base44.entities.Company.filter({ created_by: user.email });
        if (cs.length > 0) return cs[0];
      }
      return null;
    },
    enabled: !!user && !isSystemAdmin,
    showErrorToast: false
  });

  const companyId = company?.id;

  const { data: clients = [] } = useApiQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId,
    showErrorToast: false
  });

  const { data: transactions = [] } = useApiQuery({
    queryKey: ['transactions', companyId],
    queryFn: () => base44.entities.Transaction.filter({ company_id: companyId }),
    enabled: !!companyId,
    showErrorToast: false
  });

  const { data: companyToken } = useApiQuery({
    queryKey: ['companyToken', companyId],
    queryFn: async () => {
      const tokens = await base44.entities.CompanyToken.filter({ company_id: companyId });
      return tokens.find(t => t.is_primary) || tokens[0];
    },
    enabled: !!companyId,
    showErrorToast: false
  });

  const { data: chainStats } = useApiQuery({
    queryKey: ['chainStats', companyId, companyToken?.contract_address],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkContractBalances', { company_id: companyId });
      return res?.data || null;
    },
    enabled: !!companyId && !!companyToken?.contract_address,
    refetchInterval: 120_000,
    showErrorToast: false
  });

  // ── Admin view ────────────────────────────────────────────────────────────
  const { data: adminChainStats } = useApiQuery({
    queryKey: ['adminChainStats'],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkContractBalances', {});
      return res?.data || null;
    },
    enabled: isSystemAdmin,
    refetchInterval: 120_000,
    showErrorToast: false
  });

  const { data: allCompanies = [] } = useApiQuery({
    queryKey: ['all-companies'],
    queryFn: () => base44.entities.Company.list('-created_date'),
    enabled: isSystemAdmin,
    showErrorToast: false
  });
  const { data: allClients = [] } = useApiQuery({
    queryKey: ['all-clients'],
    queryFn: () => base44.entities.Client.list('-created_date'),
    enabled: isSystemAdmin,
    showErrorToast: false
  });
  const { data: allTransactions = [] } = useApiQuery({
    queryKey: ['all-transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 1000),
    enabled: isSystemAdmin,
    showErrorToast: false
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const now = new Date();
  const monthTx = transactions.filter(t => {
    if (!t.created_date) return false;
    const d = new Date(t.created_date);
    return d >= startOfMonth(now) && d <= endOfMonth(now);
  });
  const monthRevenue = monthTx.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const activeClients = clients.filter(c => (c.current_balance || 0) > 0).length;
  const recentTx = [...transactions].sort((a,b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  const showOnboarding = company && !company.onboarding_completed && (company.onboarding_step || 0) < 9;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (permissionsLoading || companyLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "14px",
            background: `${C.green}20`,
            border: `1px solid ${C.green}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            <Loader2 size={22} color={C.green} style={{ animation: "spin 1s linear infinite" }} />
          </div>
          <div style={{ fontSize: "13px", color: C.muted }}>Loading...</div>
        </div>
        <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  // ── Admin view ────────────────────────────────────────────────────────────
  if (isSystemAdmin) {
    return (
      <div style={{
        fontFamily: "-apple-system,'SF Pro Display',BlinkMacSystemFont,sans-serif",
        maxWidth: 640, margin: "0 auto", padding: "16px",
        opacity: mounted ? 1 : 0, transition: "opacity 300ms ease",
      }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: C.white, letterSpacing: "-0.03em", margin: 0 }}>
            Platform Overview
          </h1>
          <p style={{ fontSize: "13px", color: C.muted, marginTop: 4 }}>System Admin</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <StatCard label="Businesses" value={allCompanies.length} icon={Building2} color={C.purple} />
          <StatCard label="Total Clients" value={allClients.length} icon={Users} color={C.blue} />
          <StatCard label="Transactions" value={allTransactions.length} icon={Receipt} color={C.green} />
          <StatCard label="Gas Wallet" value={adminChainStats?.gas_avax != null ? `${adminChainStats.gas_avax} AVAX` : '—'} icon={Fuel} color={C.amber} />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "Companies", to: "Companies", icon: Building2, color: C.purple },
            { label: "Clients", to: "Clients", icon: Users, color: C.blue },
            { label: "Transactions", to: "TransactionsAndSettlement", icon: Receipt, color: C.green },
            { label: "Blockchain", to: "BlockchainTransactions", icon: Coins, color: C.amber },
          ].map(a => (
            <QuickAction key={a.to} icon={a.icon} label={a.label} to={a.to} color={a.color} />
          ))}
        </div>

        <CompanyTokensTable companies={allCompanies} />
      </div>
    );
  }

  // ── Business view ─────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";

  const trialExpired = company ? isTrialExpired(company) : false;
  const daysLeft = company ? trialDaysLeft(company) : 0;
  const effectiveTier = getEffectiveTier(company);

  return (
    <div style={{
      fontFamily: "-apple-system,'SF Pro Display',BlinkMacSystemFont,sans-serif",
      maxWidth: 640, margin: "0 auto", padding: "0 0 32px",
      opacity: mounted ? 1 : 0, transition: "opacity 300ms ease",
    }}>

      {/* Trial expired modal */}
      {trialExpired && (
        <UpgradeModal
          isTrialExpired={true}
          companyId={companyId}
          currentTier="basic"
          onClose={() => {}}
        />
      )}

      {/* Trial banner */}
      {!trialExpired && effectiveTier === 'trial' && daysLeft <= 3 && (
        <div style={{
          background: "rgba(245,158,11,0.12)",
          border: "1px solid rgba(245,158,11,0.3)",
          padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: "13px",
        }}>
          <span>⏳</span>
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>
            {daysLeft === 0 ? "Trial ends today!" : `${daysLeft} days left in your trial`}
          </span>
          <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: "auto", fontSize: "11px" }}>
            Choose a plan before it expires
          </span>
        </div>
      )}

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(99,102,241,0.08) 100%)",
        borderBottom: `1px solid ${C.border}`,
        padding: "20px 16px 24px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Glow */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 160, height: 160,
          background: "radial-gradient(circle, rgba(16,185,129,0.2), transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: "13px", color: C.muted, marginBottom: 4 }}>{greeting} 👋</div>
            <h1 style={{ fontSize: "26px", fontWeight: 800, color: C.white, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.1 }}>
              {company?.name || firstName}
            </h1>
          </div>

          {/* Currency selector */}
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {CURRENCIES.map(c => (
              <button key={c.code} onClick={() => setCurrency(c.code)} style={{
                fontSize: "12px", fontWeight: 700,
                color: currency === c.code ? C.green : C.muted,
                background: currency === c.code ? `${C.green}18` : "transparent",
                border: `1px solid ${currency === c.code ? C.green + "44" : "transparent"}`,
                borderRadius: "8px", padding: "4px 8px",
                cursor: "pointer", WebkitTapHighlightColor: "transparent",
              }}>{c.symbol}</button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "This Month", value: fmt(monthRevenue), color: C.green },
            { label: "Active Clients", value: activeClients.toLocaleString(), color: C.blue },
            { label: "Total Tx", value: transactions.length.toLocaleString(), color: C.purple },
          ].map(s => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid rgba(255,255,255,0.08)`,
              borderRadius: "14px",
              padding: "12px 10px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "20px", fontWeight: 800, color: C.white, letterSpacing: "-0.03em" }}>{s.value}</div>
              <div style={{ fontSize: "10px", color: C.muted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>

        {/* ── Onboarding Alert ──────────────────────────────────────────── */}
        {showOnboarding && (
          <Link to={createPageUrl('OnboardingWizard')} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: `${C.amber}12`,
            border: `1px solid ${C.amber}33`,
            borderRadius: "16px",
            padding: "14px 16px",
            textDecoration: "none",
            marginBottom: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "12px",
              background: `${C.amber}20`, border: `1px solid ${C.amber}44`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <AlertTriangle size={18} color={C.amber} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: C.amber }}>Complete Setup</div>
              <div style={{ fontSize: "12px", color: `${C.amber}99`, marginTop: 2 }}>Finish registration to unlock all features</div>
            </div>
            <ChevronRight size={16} color={C.amber} />
          </Link>
        )}

        {/* ── NoPhone Warning ───────────────────────────────────────────── */}
        <NoPhoneWarningBanner companyId={companyId} />

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Quick Actions
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <QuickAction icon={Receipt} label="POS" to="POSTerminal" color={C.green} />
            <QuickAction icon={Users} label="Clients" to="Clients" color={C.blue} />
            <QuickAction icon={Ticket} label="Coupons" to="Coupons" color={C.purple} />
            <QuickAction icon={Share2} label="Marketing" to="SocialMarketing" color={C.amber} />
          </div>
        </div>

        {/* ── Token Card ────────────────────────────────────────────────── */}
        {companyToken && (
          <>
            <div style={{
              background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))",
              border: `1px solid ${C.green}33`,
              borderRadius: "20px",
              padding: "16px",
              marginBottom: 10,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: "15px",
                background: `${C.green}20`, border: `1.5px solid ${C.green}44`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                boxShadow: `0 4px 20px ${C.green}33`,
              }}>
                <Coins size={24} color={C.green} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "22px", fontWeight: 800, color: C.white, letterSpacing: "-0.03em" }}>
                  {(companyToken.total_supply || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: "12px", color: C.muted, marginTop: 2 }}>
                  {companyToken.token_symbol || 'LYL'} tokens · {(companyToken.distributed_tokens || 0).toLocaleString()} in circulation
                </div>
              </div>
              {company?.onchain_enabled && (
                <div style={{
                  fontSize: "10px", fontWeight: 700,
                  color: C.green,
                  background: `${C.green}15`,
                  border: `1px solid ${C.green}33`,
                  borderRadius: "8px", padding: "4px 8px",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  ⛓ Live
                </div>
              )}
            </div>

            {/* ── Gas & Token Stats ─────────────────────────────────────── */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8, marginBottom: 16,
            }}>
              {/* Gas Balance */}
              <div style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: "14px", padding: "12px 10px", textAlign: "center",
              }}>
                <Fuel size={16} color={C.amber} style={{ margin: "0 auto 6px" }} />
                <div style={{ fontSize: "14px", fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>
                  {chainStats?.gas_avax != null ? `${parseFloat(chainStats.gas_avax).toFixed(3)}` : '—'}
                </div>
                <div style={{ fontSize: "9px", color: C.muted, marginTop: 2 }}>Platform Gas</div>
              </div>

              {/* Treasury balance (tokens left) */}
              <div style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: "14px", padding: "12px 10px", textAlign: "center",
              }}>
                <Wallet size={16} color={C.blue} style={{ margin: "0 auto 6px" }} />
                <div style={{ fontSize: "14px", fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>
                  {chainStats?.treasury_balance != null
                    ? Number(chainStats.treasury_balance).toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : (companyToken.treasury_balance || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: "9px", color: C.muted, marginTop: 2 }}>Treasury Left</div>
              </div>

              {/* Distributed / Sent */}
              <div style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: "14px", padding: "12px 10px", textAlign: "center",
              }}>
                <Send size={16} color={C.purple} style={{ margin: "0 auto 6px" }} />
                <div style={{ fontSize: "14px", fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>
                  {(companyToken.distributed_tokens || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: "9px", color: C.muted, marginTop: 2 }}>Tokens Sent</div>
              </div>
            </div>
          </>
        )}

        {/* ── Recent Transactions ───────────────────────────────────────── */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "20px",
          padding: "16px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: C.white }}>Recent Activity</div>
            <Link to={createPageUrl('TransactionsAndSettlement')} style={{
              fontSize: "12px", color: C.green, textDecoration: "none",
              display: "flex", alignItems: "center", gap: 3,
            }}>
              See all <ChevronRight size={12} />
            </Link>
          </div>

          {recentTx.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Receipt size={32} color="rgba(255,255,255,0.1)" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: "13px", color: C.muted }}>No transactions yet</div>
              <Link to={createPageUrl('POSTerminal')} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                marginTop: 12, padding: "8px 16px",
                background: `${C.green}20`, border: `1px solid ${C.green}44`,
                borderRadius: "10px", textDecoration: "none",
                fontSize: "13px", fontWeight: 600, color: C.green,
              }}>
                Open POS <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div>
              {recentTx.map((tx) => (
                <TxRow key={tx.id} tx={tx} fmt={fmt} />
              ))}
            </div>
          )}
        </div>

        {/* ── Share / Grow ──────────────────────────────────────────────── */}
        <Link to={createPageUrl('Coupons')} style={{
          display: "flex", alignItems: "center", gap: 14,
          background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.08))",
          border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: "20px",
          padding: "16px",
          textDecoration: "none",
        }}>
          <div style={{
            width: 50, height: 50, borderRadius: "15px",
            background: "rgba(139,92,246,0.2)",
            border: "1.5px solid rgba(139,92,246,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 4px 20px rgba(139,92,246,0.3)",
          }}>
            <Gift size={24} color={C.purple} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: C.white }}>Create a Coupon</div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
              Share with followers · Get a magic link in seconds
            </div>
          </div>
          <ChevronRight size={18} color="rgba(139,92,246,0.6)" />
        </Link>

      </div>
    </div>
  );
}