import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Transactions from './Transactions';
import SettlementDashboard from './SettlementDashboard';

export default function TransactionsAndSettlement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'transactions';

  const setTab = (t) => setSearchParams({ tab: t });

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-[#17171f] border border-[#2d2d3a] rounded-lg p-1 w-fit">
        {[
          { id: 'transactions', label: 'Transactions' },
          { id: 'settlement', label: 'Settlement' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'transactions' && <Transactions />}
      {tab === 'settlement' && <SettlementDashboard />}
    </div>
  );
}