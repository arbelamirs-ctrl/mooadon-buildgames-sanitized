import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

// Map of known page names to their routes
const PAGE_LINKS = {
  'campaigns': 'AICampaigns',
  'ai campaigns': 'AICampaigns',
  'campaign': 'AICampaigns',
  'pos terminal': 'POSTerminal',
  'pos': 'POSTerminal',
  'clients': 'Clients',
  'transactions': 'TransactionsAndSettlement',
  'branches': 'Branches',
  'settings': 'CompanySettings',
  'rewards store': 'RewardsStore',
  'wallet store': 'WalletStore',
  'social marketing': 'SocialMarketing',
  'brand voice': 'BrandVoiceSettings',
  'automation': 'AutomationRules',
  'pos connect': 'POSConnect',
  'onboarding': 'OnboardingWizard',
  'dashboard': 'AgentDashboard',
  'web3': 'Web3Hub',
  'blockchain': 'BlockchainTransactions',
  'coupons': 'Coupons',
  'ai studio': 'BusinessAIStudio',
};

function renderMessageWithLinks(content) {
  const sortedKeys = Object.keys(PAGE_LINKS).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(${sortedKeys.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');
  const segments = content.split(pattern);
  return segments.map((seg, i) => {
    const lower = seg.toLowerCase();
    if (PAGE_LINKS[lower]) {
      return (
        <a key={i} href={createPageUrl(PAGE_LINKS[lower])} className="text-red-400 underline hover:text-red-300 font-medium">
          {seg}
        </a>
      );
    }
    return seg;
  });
}

export default function AvalancheAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your Avalanche blockchain assistant. Ask me anything about your loyalty tokens, transactions, or blockchain setup.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an Avalanche blockchain expert assistant for Mooadon, a loyalty platform. Answer concisely. User question: ${input}`,
        add_context_from_internet: false,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: typeof res === 'string' ? res : res?.response || 'Sorry, I could not process that.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-36 lg:bottom-20 right-4 lg:right-6 z-50 w-80 bg-[#1f2128] border border-[#2d2d3a] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '420px' }}>
          <div className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white">
            <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#E84142"/><path d="M21.5 21H17.8L16 17.5L14.2 21H10.5L16 11L21.5 21Z" fill="white"/><path d="M12.5 21H9L11.75 16L12.5 21Z" fill="white"/></svg>
            <span className="font-semibold text-sm">Avalanche Assistant</span>
            <button onClick={() => setOpen(false)} className="ml-auto hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${msg.role === 'user' ? 'bg-red-600 text-white' : 'bg-[#17171f] text-gray-200 border border-[#2d2d3a]'}`}>
                  {msg.role === 'assistant' ? renderMessageWithLinks(msg.content) : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl px-3 py-2">
                  <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-[#2d2d3a] flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about Avalanche..."
              className="flex-1 bg-[#17171f] border border-[#2d2d3a] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
            />
            <button onClick={sendMessage} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white rounded-lg p-1.5 transition-colors disabled:opacity-50">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Button — raised above bottom nav on mobile */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-32 lg:bottom-6 right-4 lg:right-6 z-50 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-red-600 shadow-lg flex items-center justify-center hover:bg-red-700 transition-colors"
      >
        {open
          ? <X className="w-6 h-6 text-white" />
          : <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#E84142"/><path d="M21.5 21H17.8L16 17.5L14.2 21H10.5L16 11L21.5 21Z" fill="white"/><path d="M12.5 21H9L11.75 16L12.5 21Z" fill="white"/></svg>
        }
      </button>
    </>
  );
}