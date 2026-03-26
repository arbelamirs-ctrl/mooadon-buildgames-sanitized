import React from 'react';
import { AlertCircle, TrendingDown, Zap } from 'lucide-react';

export default function AIBudgetBar({ spend = 0, budget = 100, status = 'active', resetDate = null }) {
  const percentage = Math.min(100, (spend / budget) * 100);
  const isWarning = percentage >= 80 && percentage < 100;
  const isExceeded = percentage >= 100;
  const remaining = Math.max(0, budget - spend);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getBarColor = () => {
    if (isExceeded) return 'bg-red-500';
    if (isWarning) return 'bg-amber-500';
    return 'bg-teal-500';
  };

  const getTextColor = () => {
    if (isExceeded) return 'text-red-400';
    if (isWarning) return 'text-amber-400';
    return 'text-teal-400';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Zap className={`w-3.5 h-3.5 ${getTextColor()}`} />
          <span className="text-xs font-medium text-slate-300">AI Budget</span>
        </div>
        <span className={`text-xs font-semibold ${getTextColor()}`}>
          ${spend.toFixed(2)} / ${budget.toFixed(2)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Status message */}
      <div className="flex items-start justify-between gap-2 text-xs">
        <div>
          {isExceeded && (
            <div className="flex items-start gap-1 text-red-400">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Budget exceeded. Upgrade to continue AI features.</span>
            </div>
          )}
          {isWarning && (
            <div className="flex items-start gap-1 text-amber-400">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>${remaining.toFixed(2)} remaining this month</span>
            </div>
          )}
          {!isExceeded && !isWarning && (
            <div className="flex items-start gap-1 text-slate-400">
              <TrendingDown className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>${remaining.toFixed(2)} available</span>
            </div>
          )}
        </div>
        {resetDate && (
          <span className="text-slate-500 whitespace-nowrap">
            Resets {formatDate(resetDate)}
          </span>
        )}
      </div>
    </div>
  );
}