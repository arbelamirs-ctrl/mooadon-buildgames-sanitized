import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendUp,
  compact,
  className 
}) {
  if (compact) {
    return (
      <Card className={cn(
        "bg-[#1f2128] border-[#2d2d3a] p-3",
        className
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#9ca3af] mb-1">{title}</p>
            <p className="text-xl font-bold text-white">{value}</p>
            {subtitle && (
              <p className="text-xs text-[#9ca3af] mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium mt-1",
                trendUp ? "text-[#10b981]" : "text-rose-500"
              )}>
                <span>{trendUp ? "↑" : "↓"}</span>
                <span>{trend}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-[#10b981]" />
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "relative overflow-hidden p-6 bg-white border-0 shadow-sm hover:shadow-md transition-shadow",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              trendUp ? "text-emerald-600" : "text-rose-600"
            )}>
              <span>{trendUp ? "↑" : "↓"}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <Icon className="w-6 h-6 text-white" />
          </div>
        )}
      </div>
    </Card>
  );
}