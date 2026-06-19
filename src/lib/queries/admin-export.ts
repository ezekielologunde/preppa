import { supabase } from '@/lib/supabase';

export async function exportPlatformRevenue(days = 30): Promise<string> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from('orders')
    .select('id, created_at, total, status, prepper_id, prepper:prepper_profiles(display_name)')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as any[];
  const gmv = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const fee = gmv * 0.15;

  const header = 'Date,Order ID,Kitchen,Amount,Platform Fee (15%),Status\n';
  const lines = rows.map((r) => {
    const prepper = Array.isArray(r.prepper) ? r.prepper[0] : r.prepper;
    return [
      new Date(r.created_at).toLocaleDateString(),
      r.id.slice(0, 8),
      (prepper?.display_name ?? 'Unknown').replace(/,/g, ' '),
      (r.total ?? 0).toFixed(2),
      ((r.total ?? 0) * 0.15).toFixed(2),
      r.status,
    ].join(',');
  });

  const summary =
    `\n\nSummary,,,,\nTotal GMV,${gmv.toFixed(2)},,,\nPlatform Revenue (15%),${fee.toFixed(2)},,,\n`;
  return header + lines.join('\n') + summary;
}

export async function exportOrdersList(days = 30): Promise<string> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from('orders')
    .select(`
      id, created_at, status, total, fulfillment_type,
      prepper:prepper_profiles(display_name),
      customer:profiles!orders_customer_id_fkey(full_name)
    `)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as any[];
  const header = 'Date,Order ID,Customer,Kitchen,Total,Status,Fulfillment\n';
  const lines = rows.map((r) => {
    const prepper = Array.isArray(r.prepper) ? r.prepper[0] : r.prepper;
    const customer = Array.isArray(r.customer) ? r.customer[0] : r.customer;
    return [
      new Date(r.created_at).toLocaleDateString(),
      r.id.slice(0, 8),
      (customer?.full_name ?? 'Unknown').replace(/,/g, ' '),
      (prepper?.display_name ?? 'Unknown').replace(/,/g, ' '),
      (r.total ?? 0).toFixed(2),
      r.status,
      r.fulfillment_type ?? 'pickup',
    ].join(',');
  });
  return header + lines.join('\n');
}

export async function exportPreppersSummary(): Promise<string> {
  const { data } = await supabase
    .from('prepper_profiles')
    .select('id, display_name, city, rating, total_orders, status, created_at, is_featured')
    .order('total_orders', { ascending: false });

  const rows = (data ?? []) as any[];
  const header = 'Kitchen,City,Rating,Total Orders,Status,Featured,Joined\n';
  const lines = rows.map((r) =>
    [
      (r.display_name ?? '').replace(/,/g, ' '),
      r.city ?? '',
      r.rating?.toFixed(1) ?? '',
      r.total_orders ?? 0,
      r.status,
      r.is_featured ? 'Yes' : 'No',
      new Date(r.created_at).toLocaleDateString(),
    ].join(','),
  );
  return header + lines.join('\n');
}
