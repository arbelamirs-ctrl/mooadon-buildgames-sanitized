import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Trophy, 
  TrendingUp, 
  Star, 
  Medal,
  Crown,
  Zap
} from 'lucide-react';

export default function Leaderboard({ companyId, currentClientId, pointsName = 'points' }) {
  const [selectedTab, setSelectedTab] = useState('points');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['leaderboard-clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const sortedByPoints = [...clients]
    .sort((a, b) => (b.total_earned || 0) - (a.total_earned || 0))
    .slice(0, 10);

  const sortedByBalance = [...clients]
    .sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0))
    .slice(0, 10);

  const getMedalIcon = (rank) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-slate-500 font-bold">{rank}</span>;
  };

  const LeaderboardList = ({ data, valueKey, label }) => (
    <div className="space-y-2">
      {data.map((client, index) => {
        const isCurrentClient = client.id === currentClientId;
        const rank = index + 1;
        
        return (
          <div
            key={client.id}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
              isCurrentClient 
                ? 'bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-2 border-indigo-500' 
                : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {/* Rank */}
            <div className="w-8 h-8 flex items-center justify-center">
              {getMedalIcon(rank)}
            </div>

            {/* Client Info */}
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${isCurrentClient ? 'text-indigo-300' : 'text-white'}`}>
                {client.full_name || client.phone}
              </p>
              <p className="text-xs text-slate-400">{client.phone}</p>
            </div>

            {/* Points */}
            <div className="text-left">
              <p className={`text-lg font-bold ${isCurrentClient ? 'text-indigo-300' : 'text-white'}`}>
                {(client[valueKey] || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>

            {isCurrentClient && (
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/50">
                you
              </Badge>
            )}
          </div>
        );
      })}

      {data.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No data yet</p>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="w-5 h-5" />
           Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Trophy className="w-5 h-5" />
         Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2 bg-slate-800">
            <TabsTrigger value="points" className="data-[state=active]:bg-indigo-600">
              <TrendingUp className="w-4 h-4 ml-2" />
              Total points
            </TabsTrigger>
            <TabsTrigger value="balance" className="data-[state=active]:bg-purple-600">
              <Zap className="w-4 h-4 ml-2" />
              Current balance 
            </TabsTrigger>
          </TabsList>

          <TabsContent value="points" className="mt-4">
            <LeaderboardList 
              data={sortedByPoints} 
              valueKey="total_earned" 
              label={`${pointsName} Accumulated`}
            />
          </TabsContent>

          <TabsContent value="balance" className="mt-4">
            <LeaderboardList 
              data={sortedByBalance} 
              valueKey="current_balance" 
              label={`${pointsName} Available`}
            />
          </TabsContent>
        </Tabs>

        {/* Current Client Position (if not in top 10) */}
        {currentClientId && !sortedByPoints.find(c => c.id === currentClientId) && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-400 mb-2"> Your location :</p>
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-sm text-slate-300">
                place #{sortedByPoints.findIndex(c => c.id === currentClientId) + 1} of {clients.length}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}