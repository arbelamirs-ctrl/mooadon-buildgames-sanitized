import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConnectSalesChannel from './ConnectSalesChannel';
import POSIntegrationHub from './POSIntegrationHub';

export default function POSConnect() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'quick';

  const setTab = (t) => setSearchParams({ tab: t });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">POS Connect</h1>
        <p className="text-sm text-slate-400 mt-1">Connect your point-of-sale system to start issuing rewards.</p>
      </div>
      <div className="flex gap-1 bg-[#17171f] border border-[#2d2d3a] rounded-lg p-1 w-fit">
        {[
          { id: 'quick', label: 'Quick Connect' },
          { id: 'details', label: 'Integration Details' },
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
      {tab === 'quick' && <ConnectSalesChannel />}
      {tab === 'details' && <POSIntegrationHub />}
    </div>
  );
}