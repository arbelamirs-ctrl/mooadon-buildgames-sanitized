import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, User } from 'lucide-react';

export default function CashierLogin({ onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleNumPad = (num) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      // Auto-login when 4 digits entered
      if (newPin.length === 4) {
        // Simple PIN verification (in production, verify against user records)
        if (newPin === '1234') {
          onLogin({ name: 'Cashier', pin: newPin });
        } else {
          setError('Invalid PIN');
          setTimeout(() => {
            setPin('');
            setError('');
          }, 2000);
        }
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#17171f] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="text-center pb-6">
          <div className="w-20 h-20 bg-[#10b981] rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">Cashier Login</CardTitle>
          <p className="text-[#9ca3af] text-sm mt-2">Enter your 4-digit PIN</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center ${
                  pin.length > i
                    ? 'bg-[#10b981] border-[#10b981]'
                    : 'bg-[#17171f] border-[#2d2d3a]'
                }`}
              >
                {pin.length > i && (
                  <div className="w-3 h-3 bg-white rounded-full" />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
              <p className="text-red-400 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                onClick={() => handleNumPad(num)}
                className="h-16 text-2xl font-bold bg-[#17171f] hover:bg-[#2d2d3a] border border-[#2d2d3a] text-white"
              >
                {num}
              </Button>
            ))}
            <div />
            <Button
              onClick={() => handleNumPad(0)}
              className="h-16 text-2xl font-bold bg-[#17171f] hover:bg-[#2d2d3a] border border-[#2d2d3a] text-white"
            >
              0
            </Button>
            <Button
              onClick={handleClear}
              className="h-16 text-lg font-medium bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400"
            >
              Clear
            </Button>
          </div>

          <div className="text-center text-xs text-[#9ca3af] pt-4">
            Default PIN: 1234
          </div>
        </CardContent>
      </Card>
    </div>
  );
}