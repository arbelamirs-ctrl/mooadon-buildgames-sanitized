import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const POS_SYSTEMS = [
  // ── Global ──────────────────────────────────────────────────────
  { id: 'Square',       label: 'Square',        tagline: 'Most popular for retail & food',    color: 'bg-gray-800',    emoji: '⬛', supportsOAuth: true },
  { id: 'Lightspeed',   label: 'Lightspeed',    tagline: 'Great for retail & restaurants',    color: 'bg-blue-600',    emoji: '⚡' },
  { id: 'Shopify POS',  label: 'Shopify POS',   tagline: 'Perfect for omnichannel retail',    color: 'bg-purple-600',  emoji: '🛍️' },
  { id: 'Revel Systems',label: 'Revel Systems', tagline: 'iPad-based enterprise POS',         color: 'bg-orange-500',  emoji: '🔶' },
  { id: 'Clover',       label: 'Clover',        tagline: 'Flexible & customizable POS',       color: 'bg-emerald-700', emoji: '🍀' },
  { id: 'Toast',        label: 'Toast',         tagline: 'Built for restaurants',             color: 'bg-red-600',     emoji: '🍞' },
  { id: 'SumUp',        label: 'SumUp',         tagline: 'Simple mobile payments',            color: 'bg-blue-900',    emoji: '💳' },
  // ── Israeli Gateways ────────────────────────────────────────────
  { id: 'Tranzila',     label: 'Tranzila',      tagline: 'ישראל — POS & online clearing',     color: 'bg-blue-700',    emoji: '🇮🇱', israeliGateway: true },
  { id: 'CreditGuard',  label: 'CreditGuard',   tagline: 'ישראל — Caspit / Hyp terminals',   color: 'bg-indigo-700',  emoji: '🏪', israeliGateway: true },
  { id: 'Cardcom',      label: 'Cardcom',       tagline: 'ישראל — ecommerce + invoices',      color: 'bg-cyan-700',    emoji: '🇮🇱', israeliGateway: true },
  { id: 'Pelecard',     label: 'Pelecard',      tagline: 'ישראל — veteran POS gateway',       color: 'bg-teal-700',    emoji: '🇮🇱', israeliGateway: true },
  { id: 'PayPlus',      label: 'PayPlus',       tagline: 'ישראל — Shopify & online',          color: 'bg-violet-700',  emoji: '🇮🇱', israeliGateway: true },
  { id: 'PayMe',        label: 'PayMe',         tagline: 'ישראל — mobile & API payments',     color: 'bg-pink-700',    emoji: '🇮🇱', israeliGateway: true },
  // ── Fallback ────────────────────────────────────────────────────
  { id: 'Other',        label: 'Other',         tagline: 'Any system via webhook',            color: 'bg-gray-600',    emoji: '🔌' },
];

export default function Step1ChoosePOS({ onNext }) {
  const [selected, setSelected] = useState(null);

  const selectedPOS = POS_SYSTEMS.find(p => p.id === selected);

  const globalSystems  = POS_SYSTEMS.filter(p => !p.israeliGateway && p.id !== 'Other');
  const israeliSystems = POS_SYSTEMS.filter(p => p.israeliGateway);
  const otherSystem    = POS_SYSTEMS.filter(p => p.id === 'Other');

  const CardGrid = ({ items }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {items.map(pos => (
        <button
          key={pos.id}
          onClick={() => setSelected(pos.id)}
          className={`relative p-4 rounded-xl border-2 text-left transition-all ${
            selected === pos.id
              ? 'border-teal-500 bg-teal-500/10'
              : 'border-[#2d2d3a] bg-[#17171f] hover:border-teal-500/50'
          }`}
        >
          {selected === pos.id && (
            <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-teal-400" />
          )}
          <div className={`w-10 h-10 rounded-xl ${pos.color} flex items-center justify-center text-xl mb-3`}>
            {pos.emoji}
          </div>
          <div className="font-semibold text-white text-sm">{pos.label}</div>
          <div className="text-gray-400 text-xs mt-0.5">{pos.tagline}</div>
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">What POS system do you use?</h2>
      <p className="text-gray-400 mb-6">We'll set up the integration automatically based on your choice.</p>

      {/* Global POS */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Global POS Systems</p>
      <CardGrid items={globalSystems} />

      {/* Israeli Gateways */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 mt-2">🇮🇱 Israeli Payment Gateways</p>
      <CardGrid items={israeliSystems} />

      {/* Other */}
      <CardGrid items={otherSystem} />

      {/* Selection hint */}
      {selectedPOS && (
        <div className={`rounded-xl p-4 mb-6 ${
          selectedPOS.supportsOAuth
            ? 'bg-teal-500/10 border border-teal-500/30'
            : selectedPOS.israeliGateway
            ? 'bg-blue-500/10 border border-blue-500/30'
            : 'bg-cyan-500/10 border border-cyan-500/30'
        }`}>
          <p className="text-sm font-medium text-gray-200">
            {selectedPOS.supportsOAuth
              ? `✨ Great choice! We support ${selectedPOS.label} via direct OAuth — just click "Connect with Square" and it's done in seconds.`
              : selectedPOS.israeliGateway
              ? `🇮🇱 ${selectedPOS.label} connects via webhook. We'll give you the exact setup instructions for your gateway.`
              : `✅ We support ${selectedPOS.label} via webhook integration. It takes about 5 minutes to set up.`}
          </p>
        </div>
      )}

      <Button
        onClick={() => onNext(selected)}
        disabled={!selected}
        className="bg-teal-500 hover:bg-teal-600 text-white px-6"
      >
        Next: Setup Method <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}