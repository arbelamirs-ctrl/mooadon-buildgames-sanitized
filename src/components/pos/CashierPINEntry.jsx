import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function CashierPINEntry({ 
  company_id, 
  branch_id, 
  terminal_id, 
  onSessionStart 
}) {
  const [cashier_name, setCashier_name] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePINKeypad = (digit) => {
    if (pin.length < 8) {
      setPin(pin + String(digit));
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (!cashier_name.trim()) {
      toast.error('Please enter cashier name');
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      toast.error('PIN must be 4-8 digits');
      return;
    }

    setLoading(true);
    try {
      const result = await base44.functions.invoke('startCashierSession', {
        company_id,
        branch_id,
        terminal_id,
        cashier_name: cashier_name.trim(),
        pin
      });

      if (result.data.success) {
        toast.success(`Welcome, ${result.data.cashier_name}!`);
        onSessionStart({
          cashier_session_id: result.data.cashier_session_id,
          session_token: result.data.session_token,
          cashier_name: result.data.cashier_name
        });
      } else {
        toast.error(result.data.error || 'Failed to start session');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-3 sm:p-4">
      <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
        <CardContent className="p-4 sm:p-8">
          <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-teal-500/20 rounded-full mx-auto mb-4 sm:mb-6">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" />
          </div>
          
          <h1 className="text-xl sm:text-2xl font-bold text-white text-center mb-4 sm:mb-6">
            Cashier Login
          </h1>

          {/* Cashier Name */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-xs sm:text-sm text-slate-400 mb-1.5 sm:mb-2">Cashier Name</label>
            <input
              type="text"
              value={cashier_name}
              onChange={(e) => setCashier_name(e.target.value)}
              placeholder="Enter name"
              disabled={loading}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-[#17171f] border border-[#2d2d3a] rounded-lg text-white text-sm placeholder-slate-500 focus:border-teal-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* PIN Display */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-xs sm:text-sm text-slate-400 mb-1.5 sm:mb-2">PIN (4-8 digits)</label>
            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3 sm:p-4 text-center">
              <div className="text-3xl sm:text-4xl tracking-widest text-teal-400 font-mono">
                {'•'.repeat(pin.length)}
              </div>
            </div>
          </div>

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-4 sm:mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                onClick={() => handlePINKeypad(digit)}
                disabled={loading}
                className="bg-[#17171f] hover:bg-[#2d2d3a] border border-[#2d2d3a] rounded-lg py-2 sm:py-3 text-white font-semibold text-base sm:text-lg disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={() => handlePINKeypad(0)}
              disabled={loading}
              className="col-span-2 bg-[#17171f] hover:bg-[#2d2d3a] border border-[#2d2d3a] rounded-lg py-2 sm:py-3 text-white font-semibold text-base sm:text-lg disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              disabled={loading || pin.length === 0}
              className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg py-2 sm:py-3 text-red-400 font-semibold disabled:opacity-50"
            >
              ←
            </button>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !cashier_name.trim() || pin.length < 4}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 sm:py-3 text-sm sm:text-base"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                Starting Session...
              </>
            ) : (
              'Start Session'
            )}
          </Button>

          <p className="text-xs text-slate-500 text-center mt-3 sm:mt-4">
            PIN is hashed and never logged
          </p>
        </CardContent>
      </Card>
    </div>
  );
}