// Order status-change email. Called by the orders AFTER-UPDATE trigger (pg_net)
// whenever an order's status changes, so the customer is kept in the loop.
// verify_jwt = false; gated by a shared x-hook-secret the trigger reads from Vault.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const HOOK_SECRET = Deno.env.get('STATUS_HOOK_SECRET');
const SITE = Deno.env.get('SITE_URL') ?? 'https://app.preppa.live';
const FROM = 'Preppa <noreply@preppa.live>';
const LOGO = 'https://nfwfnnfbikjxwflpmsnu.supabase.co/storage/v1/object/public/brand/preppa-logo.png';

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;
const firstName = (full?: string | null) => (full ?? '').trim().split(/\s+/)[0] || '';
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

type Item = { qty: number; price: number; title: string };
type Payload = {
  order_id: string;
  subtotal: number; tip: number; delivery_fee: number; total: number;
  fulfillment: string; note: string | null;
  customer_email: string | null; customer_name: string | null;
  prepper_name: string | null; prepper_email: string | null;
  items: Item[];
};

function shell(heading: string, intro: string, p: Payload, note: string, cta?: { label: string; url: string }) {
  const lines = p.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;color:#1f2937">${esc(it.qty)}× ${esc(it.title)}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#1f2937">${money(it.price * it.qty)}</td></tr>`,
    )
    .join('');
  const ctaHtml = cta
    ? `<a href="${esc(cta.url)}" style="display:inline-block;margin-top:20px;background:#F15F22;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">${esc(cta.label)}</a>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0"><tr><td align="center">
    <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <tr><td style="background:linear-gradient(135deg,#FF814A,#F15F22,#D94F14);padding:24px 28px">
        <img src="${LOGO}" width="40" height="40" alt="Preppa" style="border-radius:10px;vertical-align:middle">
        <span style="color:#fff;font-size:20px;font-weight:700;margin-left:10px;vertical-align:middle">Preppa</span>
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 6px;font-size:20px;color:#111827">${esc(heading)}</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.5">${intro}</p>
        ${note}
        <table width="100%" style="margin-top:8px;border-top:1px solid #eef0f2;padding-top:10px">${lines}</table>
        <table width="100%" style="margin-top:10px;border-top:1px solid #eef0f2;padding-top:10px;font-size:14px">
          <tr><td style="padding:6px 0;color:#111827;font-weight:700;font-size:16px">Total</td><td style="padding:6px 0;text-align:right;color:#111827;font-weight:700;font-size:16px">${money(p.total)}</td></tr>
        </table>
        ${ctaHtml}
      </td></tr>
      <tr><td style="padding:18px 28px;background:#fafafa;color:#9ca3af;font-size:12px;text-align:center">
        Preppa — fresh meals from local kitchens · <a href="${SITE}" style="color:#9ca3af">app.preppa.live</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// Per-status customer copy. Returns null for statuses that shouldn't email.
function contentFor(status: string, p: Payload) {
  const prepper = p.prepper_name ?? 'Your prepper';
  const isPickup = p.fulfillment === 'pickup' || p.fulfillment === 'meetup';
  const orderCta = { label: 'View your order', url: `${SITE}/orders` };
  switch (status) {
    case 'confirmed':
      return { subject: `${prepper} accepted your order`, heading: 'Order accepted ✅',
        intro: `<b>${esc(prepper)}</b> accepted your order and is getting started.`, cta: orderCta };
    case 'preparing':
      return { subject: 'Your order is being prepared', heading: 'In the kitchen 👩‍🍳',
        intro: `<b>${esc(prepper)}</b> is preparing your order now.`, cta: orderCta };
    case 'ready':
      return isPickup
        ? { subject: 'Your order is ready for pickup', heading: 'Ready for pickup 🥡',
            intro: `Your order is ready. <b>${esc(prepper)}</b> will share the spot — check your order for details.`, cta: orderCta }
        : { subject: 'Your order is ready', heading: 'Ready & heading out 📦',
            intro: `<b>${esc(prepper)}</b> finished your order — it'll be on its way shortly.`, cta: orderCta };
    case 'out_for_delivery':
      return { subject: 'Your order is on the way', heading: 'On the way 🚗',
        intro: 'Your order is out for delivery and will arrive soon.', cta: orderCta };
    case 'completed':
      return { subject: 'Enjoy your meal — and leave a review', heading: 'Enjoy your meal! 🍽️',
        intro: `Your order is complete. We'd love your feedback — leave <b>${esc(prepper)}</b> a quick review.`,
        cta: { label: 'Leave a review', url: `${SITE}/orders` } };
    case 'cancelled':
      return { subject: 'Your order was cancelled', heading: 'Order cancelled',
        intro: 'Your order was cancelled. Any payment has been fully refunded to your original method.',
        cta: { label: 'Browse meals', url: SITE } };
    default:
      return null; // pending → covered by the payment receipt
  }
}

const MAX_HOOK_BYTES = 64 * 1024; // 64 KB — webhook payloads are small

Deno.serve(async (req) => {
  if (req.headers.get('x-hook-secret') !== HOOK_SECRET) {
    return new Response('forbidden', { status: 401 });
  }

  // Body size guard before parsing
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_HOOK_BYTES) {
    return new Response('payload_too_large', { status: 413 });
  }

  let orderId = '', status = '';
  try {
    const text = await req.text();
    if (text.length > MAX_HOOK_BYTES) return new Response('payload_too_large', { status: 413 });
    const b = JSON.parse(text);
    orderId = b.order_id ?? b.record?.id ?? '';
    status = b.status ?? b.record?.status ?? '';
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!orderId || !status) return new Response('missing order_id/status', { status: 400 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data } = await supabase.rpc('order_email_payload', { p_order_id: orderId });
  if (!data) return new Response('order not found', { status: 200 });
  const p = data as Payload;
  const content = contentFor(status, p);
  if (!content || !p.customer_email || !RESEND_KEY) return new Response('skip', { status: 200 });

  const fLabel = p.fulfillment === 'delivery' ? 'Delivery' : p.fulfillment === 'meetup' ? 'Meet up' : 'Pickup';
  const noteRow = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280">${esc(fLabel)}${p.note ? ' · ' + esc(p.note) : ''}</p>`;
  const greet = firstName(p.customer_name);
  const intro = `${greet ? 'Hi ' + esc(greet) + ' — ' : ''}${content.intro}`;
  const html = shell(content.heading, intro, p, noteRow, content.cta);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [p.customer_email], subject: content.subject, html }),
      signal: controller.signal,
    });
    if (!res.ok) console.error('[order-status-email] resend failed', res.status);
  } finally {
    clearTimeout(timer);
  }
  return new Response('ok', { status: 200 });
});
