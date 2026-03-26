import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Coins, Fuel, Send, Wallet, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

const C = {
  bg: "#0f0f18",
  card: "#1a1a27",
  border: "rgba(255,255,255,0.07)",
  green: "#10b981",
  muted: "rgba(255,255,255,0.4)",
  white: "#ffffff",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
};

export default function CompanyTokensTable({ companies }) {
  const [refreshKey, setRefreshKey] = useState(0);

  // Load all company tokens from DB
  const { data: allTokens = [] } = useQuery({
    queryKey: ['all-company-tokens', refreshKey],
    queryFn: () => base44.entities.CompanyToken.list('-created_date', 100),
    staleTime: 30_000,
  });

  // Load on-chain stats for all companies at once
  const { data: chainStats, isLoading: chainLoading, refetch } = useQuery({
    queryKey: ['chain-stats-all', refreshKey],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkAllContractBalances', {});
      return res?.data || {};
    },
    staleTime: 60_000,
  });

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    refetch();
  };

  // Build a map: companyId -> token
  const tokenByCompany = {};
  allTokens.forEach(t => {
    if (t.is_primary || !tokenByCompany[t.company_id]) {
      tokenByCompany[t.company_id] = t;
    }
  });

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: "20px",
      padding: "16px",
      marginTop: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: C.white }}>
          🔗 Token Status — All Companies
        </div>
        <button
          onClick={handleRefresh}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: "12px", color: C.green,
            background: `${C.green}15`, border: `1px solid ${C.green}33`,
            borderRadius: "8px", padding: "5px 10px", cursor: "pointer",
          }}
        >
          <RefreshCw size={12} style={chainLoading ? { animation: "spin 1s linear infinite" } : {}} />
          Refresh
        </button>
      </div>

      {/* Gas wallet summary */}
      {chainStats?.gas_avax != null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: `${C.amber}10`, border: `1px solid ${C.amber}30`,
          borderRadius: "12px", padding: "10px 14px", marginBottom: 14,
        }}>
          <Fuel size={16} color={C.amber} />
          <span style={{ fontSize: "13px", color: C.amber, fontWeight: 600 }}>
            Shared Gas Wallet: {chainStats.gas_avax} AVAX
          </span>
          <span style={{ fontSize: "11px", color: C.muted, marginLeft: 4 }}>
            0xFA9b...52a38
          </span>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Company", "Symbol", "Tokens Sent", "Treasury Left", "Contract"].map(h => (
                <th key={h} style={{ padding: "8px 10px", color: C.muted, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.filter(c => c.onchain_enabled).map(company => {
              const token = tokenByCompany[company.id];
              const stats = chainStats?.companies?.[company.id];
              const contractOk = stats?.contract_ok;

              return (
                <tr key={company.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  {/* Company */}
                  <td style={{ padding: "10px 10px", color: C.white, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {company.name}
                    <div style={{ fontSize: "10px", color: C.muted }}>{company.client_number}</div>
                  </td>

                  {/* Symbol */}
                  <td style={{ padding: "10px 10px" }}>
                    {token ? (
                      <span style={{
                        fontSize: "11px", fontWeight: 700, color: C.green,
                        background: `${C.green}15`, border: `1px solid ${C.green}33`,
                        borderRadius: "6px", padding: "2px 7px",
                      }}>
                        {token.token_symbol}
                      </span>
                    ) : (
                      <span style={{ color: C.muted, fontSize: "11px" }}>—</span>
                    )}
                  </td>

                  {/* Tokens Sent */}
                  <td style={{ padding: "10px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Send size={13} color={C.blue} />
                      <span style={{ color: C.white, fontWeight: 600 }}>
                        {token ? (token.distributed_tokens || 0).toLocaleString() : '—'}
                      </span>
                    </div>
                  </td>

                  {/* Treasury Left */}
                  <td style={{ padding: "10px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Wallet size={13} color={C.green} />
                      <span style={{ color: C.white, fontWeight: 600 }}>
                        {stats?.treasury_balance != null
                          ? Number(stats.treasury_balance).toLocaleString(undefined, { maximumFractionDigits: 0 })
                          : token
                            ? (token.treasury_balance || token.total_supply || 0).toLocaleString()
                            : '—'}
                      </span>
                    </div>
                  </td>

                  {/* Contract Status */}
                  <td style={{ padding: "10px 10px" }}>
                    {stats ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {contractOk
                          ? <CheckCircle size={13} color={C.green} />
                          : <AlertTriangle size={13} color={C.red} />}
                        <span style={{ fontSize: "10px", color: contractOk ? C.green : C.red, fontWeight: 600 }}>
                          {contractOk ? 'OK' : 'DEAD'}
                        </span>
                        {token?.contract_address && (
                          <a
                            href={`https://testnet.snowtrace.io/address/${token.contract_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: "10px", color: C.muted, marginLeft: 4 }}
                          >
                            {token.contract_address.slice(0, 6)}…{token.contract_address.slice(-4)}
                          </a>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: C.muted }}>
                        {chainLoading ? '⏳' : token?.contract_address
                          ? `${token.contract_address.slice(0, 6)}…${token.contract_address.slice(-4)}`
                          : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}