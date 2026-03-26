import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import CrossChainRedemptionWidget from '@/components/zetachain/CrossChainRedemption';
import { Coins, Loader2 } from 'lucide-react';

export default function CrossChainRedemptionPage() {
  const { primaryCompanyId } = useUserPermissions();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', primaryCompanyId],
    queryFn: () => base44.entities.Client.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId,
  });

  const client = clients[0] || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Coins className="w-5 h-5 text-indigo-400" />
          Cross-Chain Redemption
        </h1>
        <p className="text-sm text-[#9ca3af] mt-1">
          Redeem loyalty tokens directly to Bitcoin or Ethereum via ZetaChain
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      ) : (
        <CrossChainRedemptionWidget
          client={client}
          company={{ id: primaryCompanyId }}
        />
      )}
    </div>
  );
}