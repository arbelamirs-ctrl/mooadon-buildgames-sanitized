import React, { useState } from 'react';
import Transactions from './Transactions';
import SettlementDashboard from './SettlementDashboard';

export default function TransactionsAndSettlement() {
  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(params.get('tab') || 'transactions');

  return (
    <div>
      <div className="flex gap-2 p-4 pb-0">
        {[
          { key: 'transactions', label: 'Transactions' },
          { key: 'settlement', label: 'Settlement' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[#1f2128] text-white border border-b-0 border-[#2d2d3a]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'transactions' ? <Transactions /> : <SettlementDashboard />}
    </div>
  );
}