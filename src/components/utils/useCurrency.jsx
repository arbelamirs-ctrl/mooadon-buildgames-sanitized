import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const CURRENCY_MAP = {
  ILS: { symbol: '₪', locale: 'he-IL' },
  USD: { symbol: '$', locale: 'en-US' },
  EUR: { symbol: '€', locale: 'de-DE' },
};

export function useCurrency(companyId) {
  const { data: company } = useQuery({
    queryKey: ['company-currency', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const list = await base44.entities.Company.filter({ id: companyId });
      return list[0] || null;
    },
    enabled: !!companyId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const curr = CURRENCY_MAP[company?.pos_currency] || CURRENCY_MAP['ILS'];

  const format = (amount, options = {}) => {
    const num = parseFloat(amount) || 0;
    const { compact = false, decimals = 0 } = options;
    if (compact && num >= 1000) {
      return `${curr.symbol}${(num / 1000).toFixed(1)}k`;
    }
    return `${curr.symbol}${num.toLocaleString(curr.locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  return { symbol: curr.symbol, code: company?.pos_currency || 'ILS', format };
}

export function getCurrencySymbol(code) {
  return CURRENCY_MAP[code]?.symbol || '₪';
}