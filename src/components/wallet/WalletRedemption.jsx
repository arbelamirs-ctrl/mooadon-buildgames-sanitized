import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import WalletAuthButton from './WalletAuthButton';
import { Coins, ArrowRight } from 'lucide-react';

/**
 * Example usage of WalletAuthButton for redeeming points
 */
export default function WalletRedemption({ companyId, client }) {
  const [redeemAmount, setRedeemAmount] = useState('');

  const handleRedemptionSuccess = (result) => {
    console.log('Redemption successful:', result);
    setRedeemAmount('');
    // Refresh client data
    window.location.reload();
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Coins className="w-5 h-5" />
          Wallet-Based Redemption
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            🔐 <strong>No SMS needed!</strong> Sign with your wallet to redeem points securely.
          </p>
        </div>

        {client && (
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-600">Available Balance</p>
            <p className="text-3xl font-bold text-slate-900">
              {(client.current_balance || 0).toLocaleString()} points
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Amount to Redeem</Label>
          <Input
            type="number"
            value={redeemAmount}
            onChange={(e) => setRedeemAmount(e.target.value)}
            placeholder="Enter points amount"
            className="text-lg h-12"
          />
        </div>

        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-700">You will redeem:</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-amber-600">
                {redeemAmount || 0}
              </span>
              <ArrowRight className="w-5 h-5 text-slate-400" />
              <span className="text-lg text-slate-600">points</span>
            </div>
          </div>
        </div>

        <WalletAuthButton
          actionType="redeem_points"
          actionData={{
            amount: parseInt(redeemAmount) || 0,
            reward_id: null
          }}
          companyId={companyId}
          onSuccess={handleRedemptionSuccess}
        >
          <Coins className="w-4 h-4 mr-2" />
          Sign & Redeem Points
        </WalletAuthButton>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-600 text-center">
            💡 Your signature proves wallet ownership without any gas fees
          </p>
        </div>
      </CardContent>
    </Card>
  );
}