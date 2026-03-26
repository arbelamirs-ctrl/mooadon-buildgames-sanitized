import React from 'react';
import { Button } from "@/components/ui/button";
import { Delete } from 'lucide-react';

export default function AmountKeypad({ amount, onAmountChange, onCharge, disabled, chargeButtonText, currencySymbol = '$' }) {
  const handleNumber = (num) => {
    const currentStr = String(amount || '');
    const newAmount = currentStr + num;
    onAmountChange(newAmount);
  };

  const handleDecimal = () => {
    const currentStr = String(amount || '');
    if (!currentStr.includes('.')) {
      onAmountChange(currentStr + '.');
    }
  };

  const handleBackspace = () => {
    const currentStr = String(amount || '');
    onAmountChange(currentStr.slice(0, -1));
  };

  const handleClear = () => {
    onAmountChange('');
  };

  const displayAmount = amount || '0';

  return (
    <div className="space-y-4">
      {/* Amount Display */}
      <div className="bg-[#17171f] border-2 border-[#2d2d3a] rounded-xl p-6 text-center">
        <div className="text-sm text-[#9ca3af] mb-2">Amount</div>
        <div className="text-5xl font-bold text-white">
          {currencySymbol}{displayAmount}
        </div>
      </div>

      {/* Number Pad */}
      <div className="grid grid-cols-3 gap-3">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
          <button
            key={num}
            onClick={() => handleNumber(String(num))}
            className="h-16 text-2xl font-bold bg-[#2d2d3a] hover:bg-[#3d3d4a] border border-[#3d3d4a] text-white rounded-md transition-colors disabled:opacity-50"
          >
            {num}
          </button>
        ))}
        
        <button
          onClick={handleDecimal}
          className="h-16 text-2xl font-bold bg-[#2d2d3a] hover:bg-[#3d3d4a] border border-[#3d3d4a] text-white rounded-md transition-colors disabled:opacity-50"
        >
          .
        </button>
        
        <button
          onClick={() => handleNumber('0')}
          className="h-16 text-2xl font-bold bg-[#2d2d3a] hover:bg-[#3d3d4a] border border-[#3d3d4a] text-white rounded-md transition-colors disabled:opacity-50"
        >
          0
        </button>
        
        <button
          onClick={handleBackspace}
          className="h-16 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Quick Amount Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {[5, 10, 20, 50].map((quickAmount) => (
          <button
            key={quickAmount}
            onClick={() => onAmountChange(String(quickAmount))}
            className="h-12 bg-[#1f2128] hover:bg-[#2d2d3a] border border-[#2d2d3a] text-white rounded-md transition-colors font-medium disabled:opacity-50"
          >
            {currencySymbol}{quickAmount}
          </button>
        ))}
      </div>

      {/* Clear and Charge Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleClear}
          className="h-14 text-lg bg-[#2d2d3a] hover:bg-[#3d3d4a] border border-[#3d3d4a] text-white rounded-md transition-colors font-medium disabled:opacity-50"
        >
          Clear
        </button>
        <button
          onClick={onCharge}
          disabled={disabled || !amount || parseFloat(amount) === 0}
          className="h-14 text-lg font-bold bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {chargeButtonText || `Charge ${currencySymbol}${displayAmount}`}
        </button>
      </div>
    </div>
  );
}