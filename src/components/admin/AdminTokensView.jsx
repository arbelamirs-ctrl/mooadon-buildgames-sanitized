import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';

const ADMIN_TREASURY = '0xFA9b000dF91BfAC4925151070018aE8A13C52a38';

export default function AdminTokensView() {
  const { data: allTokens = [], isLoading } = useQuery({
    queryKey: ['all-company-tokens'],
    queryFn: () => base44.entities.CompanyToken.list('-created_date'),
    staleTime: 30_000
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ['all-companies-for-tokens'],
    queryFn: () => base44.entities.Company.list(),
    staleTime: 60_000
  });

  const companyMap = new Map(allCompanies.map(c => [c.id, c]));

  const adminTokens = allTokens.filter(t => 
    t.treasury_wallet?.toLowerCase() === ADMIN_TREASURY.toLowerCase()
  );

  if (isLoading) {
    return (
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin Token Holdings */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-400" />
            Mooadon Admin Token Holdings
          </CardTitle>
          <p className="text-xs text-purple-300 mt-1">
            Treasury: {ADMIN_TREASURY.slice(0, 10)}...{ADMIN_TREASURY.slice(-8)}
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {adminTokens.length === 0 ? (
            <p className="text-slate-400 text-sm">No tokens in admin treasury</p>
          ) : (
            <div className="space-y-2">
              {adminTokens.map(token => {
                const company = companyMap.get(token.company_id);
                return (
                  <div key={token.id} className="flex items-center justify-between p-3 bg-[#17171f] rounded-lg border border-purple-500/20">
                    <div>
                      <span className="text-white font-semibold">{token.token_symbol}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        {token.token_name || company?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-teal-400 font-mono text-sm">
                          {(token.treasury_balance || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(token.distributed_tokens || 0).toLocaleString()} distributed
                        </p>
                      </div>
                      {token.contract_address ? (
                        <a href={`https://testnet.snowtrace.io/token/${token.contract_address}`} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" title="No contract deployed" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <a href={`https://testnet.snowtrace.io/address/${ADMIN_TREASURY}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300">
            <ExternalLink className="w-3 h-3" />
            View Admin Treasury on Snowtrace
          </a>
        </CardContent>
      </Card>

      {/* All Company Tokens Overview */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
            <Coins className="w-4 h-4 text-teal-400" />
            All Company Tokens ({allTokens.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {allTokens.map(token => {
              const company = companyMap.get(token.company_id);
              const hasContract = !!token.contract_address;
              return (
                <div key={token.id} className={`flex items-center justify-between p-2 rounded-lg ${hasContract ? 'bg-[#17171f]' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{token.token_symbol}</span>
                    <span className="text-slate-500 text-xs">{company?.name || 'Unknown Company'}</span>
                    {!hasContract && (
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">No Contract</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-teal-400 font-mono text-xs">
                      {(token.treasury_balance || 0).toLocaleString()}
                    </span>
                    {hasContract && (
                      <a href={`https://testnet.snowtrace.io/token/${token.contract_address}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 text-slate-400 hover:text-teal-400" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[#2d2d3a] grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{allTokens.length}</p>
              <p className="text-xs text-slate-500">Total Tokens</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-teal-400">{allTokens.filter(t => t.contract_address).length}</p>
              <p className="text-xs text-slate-500">Deployed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{allTokens.filter(t => !t.contract_address).length}</p>
              <p className="text-xs text-slate-500">Not Deployed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}