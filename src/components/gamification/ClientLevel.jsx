import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, TrendingUp } from 'lucide-react';

const LEVELS = [
  { level: 1, name: 'Bronze', minPoints: 0, maxPoints: 1000, color: 'from-amber-700 to-amber-500' },
  { level: 2, name: 'Silver', minPoints: 1001, maxPoints: 10000, color: 'from-slate-400 to-slate-300' },
  { level: 3, name: 'Gold', minPoints: 10001, maxPoints: Infinity, color: 'from-yellow-500 to-yellow-300' }
];

export default function ClientLevel({ client, pointsName = 'Points' }) {
  const totalPoints = client.total_earned || 0;
  
  const currentLevelData = LEVELS.find(l => 
    totalPoints >= l.minPoints && totalPoints < l.maxPoints
  ) || LEVELS[0];
  
  const nextLevelData = LEVELS[currentLevelData.level];
  
  const progressToNext = nextLevelData 
    ? ((totalPoints - currentLevelData.minPoints) / (nextLevelData.minPoints - currentLevelData.minPoints)) * 100
    : 100;

  return (
    <Card className="border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
      <CardHeader className="relative pb-2">
        <div className={`absolute inset-0 bg-gradient-to-r ${currentLevelData.color} opacity-10`} />
        <CardTitle className="flex items-center gap-2 text-white relative z-10">
          <Trophy className="w-5 h-5" />
         Customer level
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        {/* Current Level Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentLevelData.color} flex items-center justify-center shadow-lg`}>
              <span className="text-2xl font-bold text-white">{currentLevelData.level}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{currentLevelData.name}</p>
              <p className="text-sm text-slate-400">Level {currentLevelData.level}</p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-sm text-slate-400">Total accumulated</p>
            <p className="text-xl font-bold text-white">{totalPoints.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{pointsName}</p>
          </div>
        </div>

        {/* Progress Bar */}
        {nextLevelData && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Progress to the next level</span>
              <div className="flex items-center gap-1 text-emerald-400">
                <TrendingUp className="w-3 h-3" />
                <span className="font-medium">{Math.round(progressToNext)}%</span>
              </div>
            </div>
            <Progress 
              value={progressToNext} 
              className="h-2 bg-slate-800"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{currentLevelData.minPoints.toLocaleString()} {pointsName}</span>
              <span>{nextLevelData.minPoints.toLocaleString()} {pointsName}</span>
            </div>
          </div>
        )}

        {/* Next Level Preview */}
        {nextLevelData && (
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-slate-300">Next level: {nextLevelData.name}</span>
            </div>
            <p className="text-xs text-slate-400">
              more {(nextLevelData.minPoints - totalPoints).toLocaleString()} {pointsName}To the next level
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}