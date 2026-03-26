import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function AvaxPriceTicker({ companyId, showDetail = false }) {
  const [previousPrice, setPreviousPrice] = useState(null);
  const [direction, setDirection] = useState('neutral');

  const { data: priceData, isLoading, refetch } = useQuery({
    queryKey: ['avaxPrice', companyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAvaxPrice', { company_id: companyId });
      return res.data;
    },
    enabled: !!companyId,
    refetchInterval: 60000,
    staleTime: 60000,
  });

  useEffect(() => {
    if (priceData && previousPrice) {
      if (priceData.price_usd > previousPrice) setDirection('up');
      else if (priceData.price_usd < previousPrice) setDirection('down');
      else setDirection('neutral');
    }
    if (priceData) setPreviousPrice(priceData.price_usd);
  }, [priceData]);

  if (isLoading || !priceData) return null;

  const colorClass = direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-slate-400';
  const statusDot = priceData.source === 'chainlink' ? 'bg-green-500' : 'bg-yellow-500';
  const secondsAgo = Math.floor((Date.now() - new Date(priceData.last_updated).getTime()) / 1000);

  if (showDetail) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusDot} ${priceData.source === 'chainlink' ? 'animate-pulse' : ''}`} />
          <span className="text-xs text-slate-400">{priceData.source === 'chainlink' ? 'Live' : 'Fallback'}</span>
        </div>
        <div className={`text-xl font-bold ${colorClass}`}>
          ${priceData.price_usd.toFixed(2)}
        </div>
        <div className="text-sm text-slate-400">
          ₪{priceData.price_ils.toFixed(2)}
        </div>
        <div className="text-xs text-slate-500">
          Updated {secondsAgo}s ago
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-300">
      <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
      <span className={colorClass}>
        AVAX ${priceData.price_usd.toFixed(2)}
      </span>
      <span className="text-slate-500">({secondsAgo}s)</span>
    </div>
  );
}