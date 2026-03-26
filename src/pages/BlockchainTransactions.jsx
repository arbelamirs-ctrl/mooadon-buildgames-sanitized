import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ExternalLink, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function BlockchainTransactions() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: ledgerEvents = [], isLoading } = useQuery({
    queryKey: ['blockchain-ledger'],
    queryFn: () => base44.entities.LedgerEvent.list('-created_date', 200),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 500),
  });

  const getCompanyName = (companyId) => {
    return companies.find(c => c.id === companyId)?.name || 'Unknown';
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.full_name || client?.email || clientId?.slice(0, 8);
  };

  let filtered = ledgerEvents.filter(e => 
    e.metadata?.tx_hash || 
    e.description?.includes('token') ||
    e.description?.includes('MLT') ||
    e.type === 'redeem'
  );

  if (search) {
    filtered = filtered.filter(e =>
      e.metadata?.tx_hash?.toLowerCase().includes(search.toLowerCase()) ||
      getCompanyName(e.company_id).toLowerCase().includes(search.toLowerCase()) ||
      getClientName(e.client_id).toLowerCase().includes(search.toLowerCase())
    );
  }

  if (typeFilter !== 'all') {
    filtered = filtered.filter(e => e.type === typeFilter);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Blockchain Transactions</h1>
        <p className="text-sm text-[#9ca3af] mt-1">All transactions on Avalanche Fuji</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <p className="text-xs text-[#9ca3af]">Total Transactions</p>
          <p className="text-xl font-semibold text-white">{filtered.length}</p>
        </Card>
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <p className="text-xs text-[#9ca3af]">Token Conversions</p>
          <p className="text-xl font-semibold text-purple-400">
            {filtered.filter(e => e.type === 'redeem').length}
          </p>
        </Card>
        <Card className="bg-[#1f2128] border-[#2d2d3a] p-3">
          <p className="text-xs text-[#9ca3af]">Points Earned</p>
          <p className="text-xl font-semibold text-emerald-400">
            {filtered.filter(e => e.type === 'earn').length}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search by TX hash, Company or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-[#1f2128] border-[#2d2d3a] text-white"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 bg-[#1f2128] border-[#2d2d3a] text-white">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="earn">Earned</SelectItem>
            <SelectItem value="redeem">Redeemed</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transactions List */}
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800">
            {filtered.map((event) => (
              <div key={event.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    event.type === 'earn' ? 'bg-emerald-900/30' :
                    event.type === 'redeem' ? 'bg-purple-900/30' :
                    'bg-slate-800'
                  }`}>
                    {event.type === 'earn' ? (
                      <ArrowDownRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="w-6 h-6 text-purple-400" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-white">
                            {event.type === 'redeem' ? 'Token Conversion' : 
                             event.type === 'earn' ? 'Points Earned' : event.type}
                          </p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            event.type === 'earn' ? 'bg-emerald-900/30 text-emerald-400' :
                            event.type === 'redeem' ? 'bg-purple-900/30 text-purple-400' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {event.type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-2">{event.description}</p>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>🏢 {getCompanyName(event.company_id)}</span>
                          <span>👤 {getClientName(event.client_id)}</span>
                          <span>
                           {(event.points || 0) > 0 ? '+' : ''}{(event.points || 0)} Stars
                          </span>
                          {event.metadata?.tokens_received && (
                            <span className="text-purple-400">
                              +{event.metadata.tokens_received} MLT
                            </span>
                          )}
                        </div>

                        {/* Transaction Hash */}
                        {event.metadata?.tx_hash && (
                          <div className="mt-2 flex items-center gap-2">
                            <code className="text-xs text-yellow-400 bg-slate-800 px-2 py-1 rounded">
                              {event.metadata.tx_hash.slice(0, 10)}...{event.metadata.tx_hash.slice(-8)}
                            </code>
                            <a
                              href={`https://testnet.snowtrace.io/tx/${event.metadata.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-yellow-400 hover:text-yellow-300"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Date */}
                      <div className="text-left text-xs text-slate-500">
                        <p>{format(new Date(event.created_date), 'dd/MM/yy')}</p>
                        <p>{format(new Date(event.created_date), 'HH:mm')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#9ca3af] text-sm">No transactions found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}