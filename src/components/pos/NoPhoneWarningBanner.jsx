/**
 * NoPhoneWarningBanner
 *
 * Shows a warning if the merchant has configured phone-based identification
 * but recent webhook events have arrived without customer_phone.
 *
 * Props:
 *   companyId: string
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, X } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function NoPhoneWarningBanner({ companyId }) {
  const [dismissed, setDismissed] = useState(false);

  const { data: configs = [] } = useQuery({
    queryKey: ['salesChannelConfig', companyId],
    queryFn: () => base44.entities.SalesChannelConfig.filter({ company_id: companyId }),
    enabled: !!companyId,
    staleTime: 60_000
  });

  const config = configs[0];

  // Only show if:
  // 1. merchant uses phone-based ID
  // 2. they have a webhook configured
  // 3. there are recent logs missing customer_phone (check WebhookLog for MISSING_CUSTOMER_IDENTIFIER errors)
  const { data: errorLogs = [] } = useQuery({
    queryKey: ['webhookErrorLogs', companyId],
    queryFn: async () => {
      // Fetch the last 20 webhook logs and look for MISSING_CUSTOMER_IDENTIFIER
      const logs = await base44.entities.WebhookLog.filter(
        { company_id: companyId },
        '-created_date',
        20
      );
      return logs.filter(l =>
        l.response_body?.code === 'MISSING_CUSTOMER_IDENTIFIER' ||
        l.error_message?.includes('MISSING_CUSTOMER_IDENTIFIER')
      );
    },
    enabled: !!companyId && config?.customer_identifier_mode === 'phone' && config?.webhook_enabled,
    staleTime: 30_000
  });

  if (
    dismissed ||
    !config ||
    config.customer_identifier_mode !== 'phone' ||
    !config.webhook_enabled ||
    errorLogs.length === 0
  ) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-400">
          POS events missing customer phone
        </p>
        <p className="text-xs text-amber-400/80 mt-1">
          Your POS events do not include <code className="font-mono">customer_phone</code>.
          Rewards cannot be issued automatically.
          Ask your POS provider to include <code className="font-mono">customer_phone</code> in the payload,
          or switch to QR mode.
        </p>
        <div className="flex gap-2 mt-2">
          <a
            href={createPageUrl('ConnectSalesChannel')}
            className="text-xs text-amber-400 underline hover:text-amber-300"
          >
            Update settings ->
          </a>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400/60 hover:text-amber-400 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}