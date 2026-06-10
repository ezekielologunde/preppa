// Stripe webhook → keeps payment state in sync with Stripe and sends receipts.
// Verifies the signature, records paid / refunded outcomes, then emails the
// customer a receipt and the prepper a new-order alert (exactly once).
// Deploy with verify_jwt = false (Stripe does not send a Supabase JWT).
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const whsec = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const SITE = Deno.env.get('SITE_URL') ?? 'https://app.preppa.live';
const FROM = 'Preppa <noreply@preppa.live>';
const LOGO = 'https://nfwfnnfbikjxwflpmsnu.supabase.co/storage/v1/object/public/brand/preppa-logo.png';
// Deno's edge runtime needs the Web Crypto provider for async signature checks.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;
const firstName = (full?: string | null) => (full ?? '').trim().split(/\s+/)[0] || 'there';
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

const fulfillmentLabel = (f: string) =>
  f === 'delivery' ? 'Delivery' : f === 'pickup' ? 'Pickup' : f === 'meetup' ? 'Meet up' : f;

// Shared branded shell. `rows` is pre-built HTML for the body.
function shell(heading: string, intro: string, p: Payload, rows: string, cta?: { label: string; url: string }) {
  const lines = p.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;color:#1f2937">${esc(it.qty)}× ${esc(it.title)}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#1f2937">${money(it.price * it.qty)}</td></tr>`,
    )
    .join('');
  const feeRow =
    Number(p.delivery_fee) > 0
      ? `<tr><td style="padding:2px 0;color:#6b7280">Delivery</td><td style="padding:2px 0;text-align:right;color:#6b7280">${money(p.delivery_fee)}</td></tr>`
      : '';
  const tipRow =
    Number(p.tip) > 0
      ? `<tr><td style="padding:2px 0;color:#6b7280">Tip</td><td style="padding:2px 0;text-align:right;color:#6b7280">${money(p.tip)}</td></tr>`
      : '';
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
        <p style="margin:0 0 18px;font-size:14px;color:#4b5563;line-height:1.5">${intro}</p>
        ${rows}
        <table width="100%" style="margin-top:14px;border-top:1px solid #eef0f2;padding-top:10px">${lines}</table>
        <table width="100%" style="margin-top:10px;border-top:1px solid #eef0f2;padding-top:10px;font-size:14px">
          <tr><td style="padding:2px 0;color:#6b7280">Subtotal</td><td style="padding:2px 0;text-align:right;color:#6b7280">${money(p.subtotal)}</td></tr>
          ${feeRow}${tipRow}
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

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) console.error('resend send failed', to, res.status, await res.text());
}

// Email both sides exactly once. Any failure here is swallowed — the webhook
// must still return 200 so Stripe doesn't retry a payment that was recorded.
async function sendOrderEmails(supabase: SupabaseClient, orderId: string) {
  const { data: claimed } = await supabase.rpc('claim_order_receipt', { p_order_id: orderId });
  if (!claimed) return; // already emailed (Stripe retry)

  const { data: p } = await supabase.rpc('order_email_payload', { p_order_id: orderId });
  if (!p) return;
  const payload = p as Payload;
  const fLabel = fulfillmentLabel(payload.fulfillment);
  const noteRow = payload.note
    ? `<p style="margin:0 0 10px;font-size:13px;color:#6b7280">${esc(fLabel)} · ${esc(payload.note)}</p>`
    : `<p style="margin:0 0 10px;font-size:13px;color:#6b7280">${esc(fLabel)}</p>`;

  const tasks: Promise<void>[] = [];
  if (payload.customer_email) {
    const html = shell(
      'Order confirmed 🎉',
      `Thanks ${esc(firstName(payload.customer_name))}! <b>${esc(payload.prepper_name ?? 'Your prepper')}</b> got your order and will confirm it shortly.`,
      payload,
      noteRow,
      { label: 'View your order', url: `${SITE}/orders` },
    );
    tasks.push(sendEmail(payload.customer_email, 'Your Preppa order is confirmed', html));
  }
  if (payload.prepper_email) {
    const html = shell(
      'New paid order',
      `<b>${esc(firstName(payload.customer_name))}</b> just paid for an order. Confirm it in your kitchen to get cooking.`,
      payload,
      noteRow,
      { label: 'Open my kitchen', url: `${SITE}/prepper-orders` },
    );
    tasks.push(sendEmail(payload.prepper_email, `New order · ${money(payload.total)}`, html));
  }
  await Promise.all(tasks);
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, whsec, undefined, cryptoProvider);
  } catch (e) {
    return new Response(`Bad signature: ${e instanceof Error ? e.message : 'error'}`, { status: 400 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = s.metadata?.order_id ?? s.client_reference_id ?? undefined;
        if (orderId && s.payment_status === 'paid') {
          await supabase.rpc('record_payment', {
            p_order_id: orderId,
            p_txn: String(s.payment_intent),
            p_status: 'succeeded',
            p_amount: (s.amount_total ?? 0) / 100,
          });
          try {
            await sendOrderEmails(supabase, orderId);
          } catch (e) {
            console.error('order email error', e instanceof Error ? e.message : e);
          }
        }
        break;
      }
      case 'charge.refunded': {
        const ch = event.data.object as Stripe.Charge;
        const { data: p } = await supabase
          .from('payments')
          .select('order_id')
          .eq('transaction_id', String(ch.payment_intent))
          .maybeSingle();
        if (p?.order_id) {
          await supabase.rpc('record_refund', {
            p_order_id: p.order_id,
            p_amount: (ch.amount_refunded ?? 0) / 100,
            p_reason: 'stripe refund',
          });
        }
        break;
      }
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'error', { status: 500 });
  }
});
