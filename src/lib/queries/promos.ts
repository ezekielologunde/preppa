import { supabase } from '@/lib/supabase';

export type PromoResult = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_value: number;
};

export async function validatePromoCode(code: string, orderTotal: number): Promise<PromoResult | null> {
  const { data } = await supabase
    .from('promo_codes')
    .select('id,code,description,discount_type,discount_value,min_order_value,expires_at,uses_count,max_uses')
    .eq('code', code.trim().toUpperCase().slice(0, 50))
    .eq('active', true)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  if (data.max_uses !== null && data.uses_count >= data.max_uses) return null;
  if (orderTotal < data.min_order_value) return null;
  return data as PromoResult;
}

export function computeDiscount(promo: PromoResult, subtotal: number): number {
  if (promo.discount_type === 'percent') return Math.round((subtotal * promo.discount_value) / 100 * 100) / 100;
  return Math.min(promo.discount_value, subtotal);
}
