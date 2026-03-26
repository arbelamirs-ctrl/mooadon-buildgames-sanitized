import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import confetti from 'canvas-confetti';

const WEBHOOK_URL = 'https://mooadon.base44.app/api/posWebhook';

export default function Step3TestLive({ posSystem, method, itEmail, companyId, configId, onConnected, alreadyConnected, onBack }) {
  const [testing, setTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(alreadyConnected || false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (alreadyConnected) setIsConnected(true);
  }, [alreadyConnected]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopying(true);
    toast.success('Copied!');
    setTimeout(() => setCopying(false), 2000);
  };

  const sendTestTransaction = async () => {
    setTesting(true);
    try {
      const response = await base44.functions.invoke('posWebhook', {
        company_id: companyId,
        external_transaction_id: `TEST-${Date.now()}`,
        amount: 49.90,
        currency: 'ILS',
        timestamp: new Date().toISOString(),
        customer_phone: '+972500000000',
        is_test: true,
      });
      if (response.data?.success !== false) {
        setIsConnected(true);
        onConnected();
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        toast.success('Connection verified! 🎉');
      } else {
        toast.error(response.data?.error || 'Test failed. Check your webhook config.');
      }
    } catch (error) {
      toast.error('Connection test failed. Please check your webhook URL configuration.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {onBack && (
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <h2 className="text-2xl font-bold text-white">Test & Go Live</h2>
      </div>
      <p className="text-gray-400 mb-6">
        {method === 'it_email'
          ? `Instructions were sent to ${itEmail || 'your IT team'}. Waiting for them to connect.`
          : 'Let\'s verify your connection is working.'}
      </p>

      {/* Status indicator */}
      <div className={`rounded-2xl p-8 text-center mb-6 border-2 ${isConnected ? 'bg-green-500/10 border-green-500/40' : 'bg-orange-500/10 border-orange-500/30'}`}>
        {isConnected ? (
          <>
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-green-400">You're live! 🎉</h3>
            <p className="text-green-500 mt-2">Connected! First event received.</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="w-16 h-16 bg-orange-500 rounded-full animate-ping absolute opacity-30" />
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center relative">
                <div className="w-5 h-5 bg-white rounded-full" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-orange-400">Waiting for first transaction...</h3>
            <p className="text-orange-500 text-sm mt-2">
              {method === 'it_email' ? "We'll notify you when your IT team connects." : 'Send a test transaction to verify.'}
            </p>
          </>
        )}
      </div>

      {/* Webhook URL */}
      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Webhook URL</p>
        <div className="flex gap-2">
          <code className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-green-400 text-sm font-mono truncate">{WEBHOOK_URL}</code>
          <button onClick={copyUrl} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
            {copying ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>

      {/* Connection details */}
      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Connection Details</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">POS System</span><span className="font-medium text-white">{posSystem}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Method</span><span className="font-medium text-white">{method === 'self' ? 'Self-configured' : method === 'it_email' ? 'Via IT team' : 'Square OAuth'}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Configured</span><span className="font-medium text-white">{new Date().toLocaleDateString()}</span></div>
        </div>
      </div>

      {/* Test button */}
      {!isConnected && (
        <Button
          onClick={sendTestTransaction}
          disabled={testing}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white mb-4"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '🚀 '}
          Send test transaction
        </Button>
      )}

      {/* Progress checklist */}
      <div className="bg-[#17171f] border border-[#2d2d3a] rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Setup Progress</p>
        <div className="space-y-2">
          {[
            { label: 'Mooadon account created', done: true },
            { label: 'Company configured', done: true },
            { label: 'POS connected', done: isConnected },
            { label: 'First real transaction received', done: isConnected },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className={item.done ? 'text-green-400' : 'text-gray-600'}>
                {item.done ? '☑' : '○'}
              </span>
              <span className={item.done ? 'text-gray-200' : 'text-gray-500'}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA after connected */}
      {isConnected && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to={createPageUrl('AgentDashboard')} className="flex-1">
            <Button className="w-full bg-teal-500 hover:bg-teal-600 text-white">
              Go to Dashboard
            </Button>
          </Link>
          <Link to={createPageUrl('AutomationRules')} className="flex-1">
            <Button variant="outline" className="w-full border-[#2d2d3a] text-gray-300 hover:text-white hover:border-gray-500">
              Configure reward rules
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}