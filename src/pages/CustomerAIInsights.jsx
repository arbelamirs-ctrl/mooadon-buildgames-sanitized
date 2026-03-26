import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Brain, Search, Loader2, TrendingDown, Star, Users, Eye, Zap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const SEGMENT_LABELS = {
  new: { label: 'New', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  active: { label: 'Active', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  vip: { label: 'VIP', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  churn_risk: { label: 'Churn Risk', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  dormant: { label: 'Dormant', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  birthday_window: { label: 'Birthday', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  token_heavy: { label: 'Token Heavy', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  coupon_abuser: { label: 'Coupon Abuser', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
};

function buildRadarData(client) {
  const balance = Math.min((client.current_balance || 0) / 10, 100);
  const earned = Math.min((client.total_earned || 0) / 20, 100);
  const redeemed = Math.min((client.total_redeemed || 0) / 10, 100);
  const churnSafe = Math.max(0, 100 - (client.churn_score || 0));
  const level = client.level === 'Gold' ? 100 : client.level === 'Silver' ? 60 : 25;
  const hasWallet = client.wallet_address || client.hasWallet ? 80 : 20;

  return [
    { subject: 'Balance', value: balance },
    { subject: 'Earned', value: earned },
    { subject: 'Redeemed', value: redeemed },
    { subject: 'Loyalty', value: churnSafe },
    { subject: 'Level', value: level },
    { subject: 'Web3', value: hasWallet },
  ];
}

function ChurnGauge({ score }) {
  const color = score > 70 ? '#ef4444' : score > 40 ? '#f59e0b' : '#10b981';
  const label = score > 70 ? 'High Risk' : score > 40 ? 'Medium' : 'Healthy';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#2d2d3a" strokeWidth="6" />
          <circle
            cx="32" cy="32" r="26"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${(score / 100) * 163.4} 163.4`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-xs" style={{ color }}>{label}</span>
    </div>
  );
}

function ClientAICard({ client }) {
  const radarData = useMemo(() => buildRadarData(client), [client]);
  const seg = SEGMENT_LABELS[client.segment] || { label: client.segment || 'Unknown', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };

  return (
    <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4 flex flex-col gap-3 hover:border-[#10b981]/40 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {client.full_name?.charAt(0) || client.phone?.charAt(0) || '?'}
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{client.full_name || client.phone}</p>
            <p className="text-slate-400 text-xs">{client.phone}</p>
          </div>
        </div>
        <Badge className={`text-[10px] border ${seg.color} shrink-0`}>{seg.label}</Badge>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#17171f] rounded-lg py-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Balance</p>
          <p className="text-sm font-bold text-yellow-400">{(client.current_balance || 0).toLocaleString()}</p>
        </div>
        <div className="bg-[#17171f] rounded-lg py-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Earned</p>
          <p className="text-sm font-bold text-green-400">{(client.total_earned || 0).toLocaleString()}</p>
        </div>
        <div className="bg-[#17171f] rounded-lg py-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Level</p>
          <p className="text-sm font-bold text-blue-400">{client.level || 'Bronze'}</p>
        </div>
      </div>

      {/* Radar + Churn */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <PolarGrid stroke="#2d2d3a" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 9 }} />
              <Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
              <Tooltip
                contentStyle={{ background: '#1f2128', border: '1px solid #2d2d3a', borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [`${Math.round(v)}%`]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Churn</p>
          <ChurnGauge score={client.churn_score || 0} />
        </div>
      </div>

      {/* Recommended offer */}
      {client.recommended_offer && (
        <div className="bg-[#17171f] rounded-lg px-3 py-2 flex items-start gap-2">
          <Zap className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-300 leading-tight">{client.recommended_offer.replace(/_/g, ' ')}</p>
        </div>
      )}

      {/* Footer */}
      <Link to={createPageUrl('ClientDetails') + `?id=${client.id}`}>
        <Button variant="ghost" size="sm" className="w-full text-xs text-slate-400 hover:text-white border border-[#2d2d3a] hover:border-[#10b981]/40 h-7">
          <Eye className="w-3 h-3 mr-1" /> View Profile
        </Button>
      </Link>
    </div>
  );
}

export default function CustomerAIInsights() {
  const { primaryCompanyId } = useUserPermissions();
  const [search, setSearch] = useState('');
  const [segFilter, setSegFilter] = useState('all');
  const [running, setRunning] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-ai', primaryCompanyId],
    queryFn: () => primaryCompanyId
      ? base44.entities.Client.filter({ company_id: primaryCompanyId }, '-last_ai_analysis_at', 100)
      : [],
    enabled: !!primaryCompanyId,
    staleTime: 60_000,
  });

  const runSegmentation = async () => {
    setRunning(true);
    try {
      await base44.functions.invoke('segmentationEngine', { company_id: primaryCompanyId, mode: 'full' });
      toast.success('AI analysis completed!');
    } catch (e) {
      toast.error('Analysis failed: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchSearch = !search ||
        (c.full_name && c.full_name.toLowerCase().includes(search.toLowerCase())) ||
        (c.phone && c.phone.includes(search));
      const matchSeg = segFilter === 'all' || c.segment === segFilter;
      return matchSearch && matchSeg;
    });
  }, [clients, search, segFilter]);

  const analyzed = clients.filter(c => c.segment).length;
  const churnRisk = clients.filter(c => c.segment === 'churn_risk').length;
  const vips = clients.filter(c => c.segment === 'vip').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-[#10b981]" />
            Customer AI Insights
          </h1>
          <p className="text-slate-400 text-sm mt-1">{analyzed} / {clients.length} clients analyzed</p>
        </div>
        <Button
          onClick={runSegmentation}
          disabled={running || !primaryCompanyId}
          className="bg-[#10b981] hover:bg-[#059669] text-white gap-2"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run AI Analysis
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1f2128] border border-[#2d2d3a] rounded-xl p-4 text-center">
          <Users className="w-5 h-5 text-[#10b981] mx-auto mb-1" />
          <p className="text-2xl font-bold text-white">{analyzed}</p>
          <p className="text-xs text-slate-400">Analyzed</p>
        </div>
        <div className="bg-[#1f2128] border border-red-500/20 rounded-xl p-4 text-center">
          <TrendingDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-400">{churnRisk}</p>
          <p className="text-xs text-slate-400">Churn Risk</p>
        </div>
        <div className="bg-[#1f2128] border border-yellow-500/20 rounded-xl p-4 text-center">
          <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-yellow-400">{vips}</p>
          <p className="text-xs text-slate-400">VIP</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[#1f2128] border-[#2d2d3a] text-white"
          />
        </div>
        <Select value={segFilter} onValueChange={setSegFilter}>
          <SelectTrigger className="w-40 bg-[#1f2128] border-[#2d2d3a] text-white">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            {Object.entries(SEGMENT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No clients found. Run AI Analysis to generate insights.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(client => (
            <ClientAICard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}