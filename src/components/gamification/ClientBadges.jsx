import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Award, 
  Zap, 
  Heart, 
  Star, 
  Flame, 
  Gift, 
  Target,
  Calendar,
  ShoppingBag,
  Crown
} from 'lucide-react';

const BADGE_DEFINITIONS = [
  {
    id: 'first_purchase',
    name: 'First purchase',
    description: 'You made your first purchase.',
    icon: ShoppingBag,
    color: 'from-blue-500 to-cyan-400',
    check: (client, transactions) => transactions.length > 0
  },
  {
    id: 'loyal_customer',
    name: 'Loyal customer',
    description: '10+ Transactions',
    icon: Heart,
    color: 'from-pink-500 to-rose-400',
    check: (client, transactions) => transactions.length >= 10
  },
  {
    id: 'big_spender',
    name: 'Big buyer',
    description: ' You have accumulated 5,000 + points ',
    icon: Crown,
    color: 'from-yellow-500 to-amber-400',
    check: (client) => (client.total_earned || 0) >= 5000
  },
  {
    id: 'early_bird',
    name: 'Early effort',
    description: '  You joined in the first two weeks.',
    icon: Star,
    color: 'from-indigo-500 to-purple-400',
    check: (client) => {
      const created = new Date(client.created_date);
      const now = new Date();
      const daysSince = (now - created) / (1000 * 60 * 60 * 24);
      return daysSince <= 14;
    }
  },
  {
    id: 'active_user',
    name: 'Active user',
    description: 'Activity in the last 7 days',
    icon: Zap,
    color: 'from-orange-500 to-yellow-400',
    check: (client) => {
      if (!client.last_activity) return false;
      const lastActivity = new Date(client.last_activity);
      const now = new Date();
      const daysSince = (now - lastActivity) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    }
  },
  {
    id: 'streak_master',
    name: 'streak_master',
    description: 'Transactions in 3 consecutive weeks',
    icon: Flame,
    color: 'from-red-500 to-orange-400',
    check: (client, transactions) => {
      // Simple check: 3+ transactions
      return transactions.length >= 3;
    }
  },
  {
    id: 'points_collector',
    name: ' Points collector',
    description: 'Current balance 1,000+',
    icon: Gift,
    color: 'from-emerald-500 to-teal-400',
    check: (client) => (client.current_balance || 0) >= 1000
  },
  {
    id: 'high_achiever',
    name: 'Someone else',
    description: '  You have reached the golden level.',
    icon: Target,
    color: 'from-purple-500 to-pink-400',
    check: (client) => (client.total_earned || 0) >= 5000
  }
];

export default function ClientBadges({ client, transactions = [] }) {
  const earnedBadges = BADGE_DEFINITIONS.filter(badge => 
    badge.check(client, transactions)
  );

  const lockedBadges = BADGE_DEFINITIONS.filter(badge => 
    !badge.check(client, transactions)
  );

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Award className="w-5 h-5" />
         Achievements and badges ({earnedBadges.length}/{BADGE_DEFINITIONS.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Earned Badges */}
          {earnedBadges.map(badge => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.id}
                className={`relative group bg-gradient-to-br ${badge.color} rounded-xl p-4 shadow-lg hover:scale-105 transition-transform`}
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <Icon className="w-8 h-8 text-white" />
                  <p className="text-xs font-bold text-white">{badge.name}</p>
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-950 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {badge.description}
                </div>
              </div>
            );
          })}

          {/* Locked Badges */}
          {lockedBadges.map(badge => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.id}
                className="relative group bg-slate-800 rounded-xl p-4 border-2 border-dashed border-slate-700 opacity-50 hover:opacity-70 transition-opacity"
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <Icon className="w-8 h-8 text-slate-600" />
                  <p className="text-xs font-bold text-slate-500">{badge.name}</p>
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-950 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  🔒 {badge.description}
                </div>
              </div>
            );
          })}
        </div>

        {earnedBadges.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>  No achievements yet </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}