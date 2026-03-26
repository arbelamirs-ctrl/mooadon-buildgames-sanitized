import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Zap, Globe } from 'lucide-react';

/**
 * OnchainPilotToggle — admin-only toggle to enable/disable onchain minting per company.
 * Shows current network (fuji / mainnet) from AVAX_NETWORK env (read-only here).
 */
export default function OnchainPilotToggle({ company, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async (checked) => {
    setLoading(true);
    await base44.entities.Company.update(company.id, { onchain_enabled: checked });
    onUpdate?.({ ...company, onchain_enabled: checked });
    setLoading(false);
  };

  const network = company.onchain_network || 'fuji';
  const enabled = !!company.onchain_enabled;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#0f1420] border border-[#2a2f3e]">
      <div className="flex items-center gap-3">
        <Zap className={`w-4 h-4 ${enabled ? 'text-emerald-400' : 'text-gray-500'}`} />
        <div>
          <p className="text-sm text-white font-medium">Onchain Minting</p>
          <p className="text-xs text-gray-500">
            {enabled ? 'Active — tokens minted on-chain' : 'Disabled — off-chain only'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={`text-xs border-[#3a3f4e] ${network === 'mainnet' ? 'text-red-400' : 'text-yellow-400'}`}>
          <Globe className="w-3 h-3 mr-1" />
          {network === 'mainnet' ? 'Mainnet' : 'Fuji'}
        </Badge>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={loading}
          className={enabled ? 'data-[state=checked]:bg-emerald-500' : ''}
        />
      </div>
    </div>
  );
}