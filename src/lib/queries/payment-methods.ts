import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CardBrand } from '@/components/add-card-sheet';
import { supabase } from '@/lib/supabase';

export interface PaymentMethod {
  id: string;
  brand: CardBrand;
  last4: string;
  expMonth: string;
  expYear: string;
  isDefault: boolean;
}

type ListResponse = {
  pk: string;
  defaultId: string | null;
  paymentMethods: Array<{
    id: string;
    brand: string;
    last4: string;
    expMonth: string;
    expYear: string;
  }>;
};

function normalizeStripeBrand(brand: string): CardBrand {
  if (brand === 'visa') return 'visa';
  if (brand === 'mastercard') return 'mastercard';
  if (brand === 'amex') return 'amex';
  return 'other';
}

async function callPm(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('stripe-payment-methods', { body });
  if (error) throw error;
  return data;
}

export function usePaymentMethods() {
  return useQuery<{ methods: PaymentMethod[]; pk: string }>({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const res: ListResponse = await callPm({ action: 'list' });
      return {
        pk: res.pk,
        methods: res.paymentMethods.map((pm) => ({
          ...pm,
          brand: normalizeStripeBrand(pm.brand),
          isDefault: pm.id === res.defaultId,
        })),
      };
    },
  });
}

export function useDetachPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pmId: string) => callPm({ action: 'detach', pmId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  });
}

export function useSetDefaultPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pmId: string) => callPm({ action: 'set_default', pmId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  });
}
