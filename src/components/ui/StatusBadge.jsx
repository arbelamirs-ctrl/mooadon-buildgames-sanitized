import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  // Transaction status
  pending: { label: "waiting", className: "bg-amber-100 text-amber-700 border-amber-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  expired: { label: "Expired", className: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelled: { label: "cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
  
  // Company status
  active: { label: "active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  suspended: { label: "suspended", className: "bg-rose-100 text-rose-700 border-rose-200" },
  
  // SMS status
  sent: { label: "Sent", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  failed: { label: "failed", className: "bg-rose-100 text-rose-700 border-rose-200" },
  
  // Ledger types
  earn: { label: "accumulation", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  redeem: { label: "Redeem", className: "bg-purple-100 text-purple-700 border-purple-200" },
  transfer: { label: "transference", className: "bg-blue-100 text-blue-700 border-blue-200" },
  adjust: { label: "adjustment", className: "bg-amber-100 text-amber-700 border-amber-200" },
  expire: { label: "expiration", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { 
    label: status, 
    className: "bg-slate-100 text-slate-600 border-slate-200" 
  };
  
  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium border", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}