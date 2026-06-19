// Stripe webhook — keeps Preppa DB in sync with Stripe.
// Handles one-time order payments AND subscription lifecycle events.
// Verifies signature, records outcomes, sends emails (orders only).
// Deploy with verify_jwt = false (Stripe sends no Supabase JWT).
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Max body size for inbound webhook events (Stripe events can be large with embedded data)
const MAX_WEBHOOK_BYTES = 512 * 1024; // 512 KB

// Exponential-backoff retry helper for transient Stripe/network failures
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error('withRetry: exhausted retries');
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const whsec = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const SITE = Deno.env.get('SITE_URL') ?? 'https://app.preppa.live';
const FROM = 'Preppa <noreply@preppa.live>';
const LOGO = 'https://nfwfnnfbikjxwflpmsnu.supabase.co/storage/v1/object/public/brand/preppa-logo.png';
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;
const firstName = (full?: string | null) => (full ?? '').trim().split(/\s+/)[0] || '';
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

type Item = { qty: number; price: number; title: string };
type Payload = {
  order_id: string;
  subtotal: number; tip: number; delivery_fee: number; total: number;
  fulfillment: string; note: string | null; handoff_pin: string | null;
  customer_email: string | null; customer_name: string | null;
  prepper_name: string | null; prepper_email: string | null;
  items: Item[];
};

const fulfillmentLabel = (f: string) =>
  f === 'delivery' ? 'Delivery' : f === 'pickup' ? 'Pickup' : f === 'meetup' ? 'Meet up' : f === 'home_cook' ? 'Home Cook' : f;

function nextDelivery(day: string): string {
  const MAP: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const target = MAP[day] ?? 1;
  const now = new Date();
  const diff = (target - now.getDay() + 7) % 7 || 7;
  const d = new Date(now);
  d.setDate(now.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function shell(heading: string, intro: string, p: Payload, rows: string, cta?: { label: string; url: string }) {
  const lines = p.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;color:#1f2937">${esc(it.qty)}× ${esc(it.title)}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#1f2937">${money(it.price * it.qty)}</td></tr>`,
    )
    .join('');
  const feeRow = Number(p.delivery_fee) > 0
    ? `<tr><td style="padding:2px 0;color:#6b7280">Delivery</td><td style="padding:2px 0;text-align:right;color:#6b7280">${money(p.delivery_fee)}</td></tr>` : '';
  const tipRow = Number(p.tip) > 0
    ? `<tr><td style="padding:2px 0;color:#6b7280">Tip</td><td style="padding:2px 0;text-align:right;color:#6b7280">${money(p.tip)}</td></tr>` : '';
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

async function sendOrderEmails(supabase: SupabaseClient, orderId: string) {
  const { data: claimed } = await supabase.rpc('claim_order_receipt', { p_order_id: orderId });
  if (!claimed) return;
  const { data: p } = await supabase.rpc('order_email_payload', { p_order_id: orderId });
  if (!p) return;
  const payload = p as Payload;
  const fLabel = fulfillmentLabel(payload.fulfillment);
  const noteRow = payload.note
    ? `<p style="margin:0 0 10px;font-size:13px;color:#6b7280">${esc(fLabel)} · ${esc(payload.note)}</p>`
    : `<p style="margin:0 0 10px;font-size:13px;color:#6b7280">${esc(fLabel)}</p>`;
  const custFirst = firstName(payload.customer_name);
  const isPickup = payload.fulfillment === 'pickup' || payload.fulfillment === 'meetup';
  const codeRow = isPickup && payload.handoff_pin
    ? `<div style="margin:0 0 12px;background:#FDEDE4;border-radius:12px;padding:12px 14px"><span style="font-size:12.5px;color:#9a3412">Your ${esc(fulfillmentLabel(payload.fulfillment).toLowerCase())} code — show it when you collect</span><div style="font-size:30px;letter-spacing:8px;font-weight:700;color:#F15F22;margin-top:4px">${esc(payload.handoff_pin)}</div></div>`
    : '';
  const tasks: Promise<void>[] = [];
  if (payload.customer_email) {
    const html = shell(
      'Order confirmed 🎉',
      `Thanks${custFirst ? ' ' + esc(custFirst) : ''}! <b>${esc(payload.prepper_name ?? 'Your prepper')}</b> got your order and will confirm it shortly.`,
      payload, codeRow + noteRow,
      { label: 'View your order', url: `${SITE}/orders` },
    );
    tasks.push(sendEmail(payload.customer_email, 'Your Preppa order is confirmed', html));
  }
  if (payload.prepper_email) {
    const html = shell(
      'New paid order',
      `<b>${custFirst ? esc(custFirst) : 'A customer'}</b> just paid for an order. Confirm it in your kitchen to get cooking.`,
      payload, noteRow,
      { label: 'Open my kitchen', url: `${SITE}/prepper-orders` },
    );
    tasks.push(sendEmail(payload.prepper_email, `New order · ${money(payload.total)}`, html));
  }
  await Promise.all(tasks);
}

// Provision access after subscription checkout completes.
async function provisionSubscription(
  supabase: SupabaseClient,
  meta: Record<string, string>,
  subId: string | null,
) {
  if (meta.type === 'prepper_pro' && meta.prepper_id) {
    await supabase.from('prepper_memberships').upsert({
      prepper_id: meta.prepper_id,
      tier: 'pro',
      billing_period: meta.period ?? 'monthly',
      stripe_subscription_id: subId,
      status: 'active',
    }, { onConflict: 'prepper_id' });

  } else if (meta.type === 'customer_plus' && meta.user_id) {
    await supabase.from('customer_memberships').upsert({
      customer_id: meta.user_id,
      tier: 'plus',
      billing_period: meta.period ?? 'monthly',
      stripe_subscription_id: subId,
      status: 'active',
    }, { onConflict: 'customer_id' });

  } else if (meta.type === 'customer_connect' && meta.user_id) {
    await supabase.from('customer_memberships').upsert({
      customer_id: meta.user_id,
      tier: 'connect',
      billing_period: meta.period ?? 'monthly',
      stripe_subscription_id: subId,
      status: 'active',
    }, { onConflict: 'customer_id' });

  } else if (meta.type === 'meal_plan' && meta.plan_id && meta.customer_id) {
    // Idempotent: skip if already provisioned with this Stripe subscription
    const { data: dup } = await supabase.from('subscriptions')
      .select('id').eq('stripe_subscription_id', subId!).maybeSingle();
    if (!dup) {
      await supabase.from('subscriptions').insert({
        customer_id: meta.customer_id,
        prepper_id:  meta.prepper_id ?? '',
        plan_id:     meta.plan_id,
        plan_name:   meta.plan_name ?? '',
        frequency:   meta.frequency ?? 'weekly',
        qty:         Number(meta.qty) || 1,
        delivery_day: meta.delivery_day ?? 'mon',
        next_billing_at: nextDelivery(meta.delivery_day ?? 'mon'),
        stripe_subscription_id: subId,
        status: 'active',
      });
    }

  } else if (meta.type === 'custom_plan' && meta.plan_id && meta.customer_id) {
    await supabase.from('customer_meal_plans')
      .update({ stripe_subscription_id: subId, status: 'active' })
      .eq('id', meta.plan_id).eq('customer_id', meta.customer_id);
  }
}

// Sync subscription status changes (renewals, pauses, reactivations).
async function syncSubscriptionStatus(supabase: SupabaseClient, sub: Stripe.Subscription) {
  const meta = sub.metadata ?? {};
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
  const isActive = sub.status === 'active' || sub.status === 'trialing';
  const memberStatus = isActive ? 'active' : sub.status === 'past_due' ? 'past_due' : 'cancelled';
  const planStatus   = isActive ? 'active' : 'paused';

  if (meta.type === 'prepper_pro') {
    await supabase.from('prepper_memberships')
      .update({ status: memberStatus, current_period_end: periodEnd })
      .eq('stripe_subscription_id', sub.id);
  } else if (meta.type === 'customer_plus' || meta.type === 'customer_connect') {
    await supabase.from('customer_memberships')
      .update({ status: memberStatus, current_period_end: periodEnd })
      .eq('stripe_subscription_id', sub.id);
  } else if (meta.type === 'meal_plan') {
    await supabase.from('subscriptions')
      .update({ status: planStatus, next_billing_at: periodEnd })
      .eq('stripe_subscription_id', sub.id);
  } else if (meta.type === 'custom_plan') {
    await supabase.from('customer_meal_plans')
      .update({ status: planStatus, next_billing_at: periodEnd })
      .eq('stripe_subscription_id', sub.id);
  }
}

// Cancel access when subscription ends.
async function cancelSubscription(supabase: SupabaseClient, sub: Stripe.Subscription) {
  const meta = sub.metadata ?? {};
  if (meta.type === 'prepper_pro') {
    await supabase.from('prepper_memberships').update({ status: 'cancelled' }).eq('stripe_subscription_id', sub.id);
  } else if (meta.type === 'customer_plus' || meta.type === 'customer_connect') {
    await supabase.from('customer_memberships').update({ status: 'cancelled' }).eq('stripe_subscription_id', sub.id);
  } else if (meta.type === 'meal_plan') {
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('stripe_subscription_id', sub.id);
  } else if (meta.type === 'custom_plan') {
    await supabase.from('customer_meal_plans').update({ status: 'cancelled' }).eq('stripe_subscription_id', sub.id);
  }
}

Deno.serve(async (req) => {
  // Verify signature header is present before reading the (potentially large) body
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return new Response('Missing Stripe-Signature header', { status: 400 });
  }

  // Enforce body size limit to prevent DOS via oversized payloads
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_WEBHOOK_BYTES) {
    return new Response(`Payload too large (max ${MAX_WEBHOOK_BYTES} bytes)`, { status: 413 });
  }
  const body = await req.text();
  if (body.length > MAX_WEBHOOK_BYTES) {
    return new Response('Payload too large', { status: 413 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, whsec, undefined, cryptoProvider);
  } catch (e) {
    return new Response(`Bad signature: ${e instanceof Error ? e.message : 'error'}`, { status: 400 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { error: dupErr } = await supabase
    .from('processed_stripe_events')
    .insert({ event_id: event.id });
  if (dupErr?.code === '23505') {
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (dupErr) console.error('[webhook] idempotency insert failed:', dupErr.message);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;

        if (s.mode === 'subscription') {
          const subId = typeof s.subscription === 'string' ? s.subscription : null;
          await provisionSubscription(supabase, s.metadata ?? {}, subId);
          break;
        }

        // ── bid_payment: customer paid an accepted meal-request bid ────────
        if (s.metadata?.type === 'bid_payment' && s.payment_status === 'paid') {
          const { bid_id, request_id } = s.metadata ?? {};
          if (bid_id) {
            // Mark the winning bid as paid (requires 0076_bid_status_paid migration)
            await supabase.from('meal_request_bids')
              .update({ status: 'paid' })
              .eq('id', bid_id);
            // Mark the meal request fulfilled
            if (request_id) {
              await supabase.from('meal_requests')
                .update({ status: 'fulfilled' })
                .eq('id', request_id);
            }
            // Find the order created by create_order_from_meal_bid (bid_id stamped in 0078)
            const { data: orderRow } = await supabase
              .from('orders')
              .select('id, prepper_id, total')
              .eq('bid_id', bid_id)
              .maybeSingle();
            if (orderRow) {
              // Record the Stripe payment against the order
              await supabase.rpc('record_payment', {
                p_order_id: orderRow.id,
                p_txn: String(s.payment_intent),
                p_status: 'succeeded',
                p_amount: (s.amount_total ?? 0) / 100,
              });
              // Notify the prepper — they need to start prepping
              const { data: prepperProfile } = await supabase
                .from('prepper_profiles')
                .select('user_id')
                .eq('id', orderRow.prepper_id)
                .maybeSingle();
              if (prepperProfile?.user_id) {
                const { data: customerProfile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', s.metadata?.user_id ?? '')
                  .maybeSingle();
                const custName = firstName(customerProfile?.full_name) || 'A customer';
                await supabase.from('notifications').insert({
                  user_id: prepperProfile.user_id,
                  type: 'order_update',
                  title: 'Bid payment received!',
                  body: `${custName} paid for their request. Check your orders to start prepping.`,
                  data: { type: 'order_update', order_id: orderRow.id },
                });
              }
            }
            console.log('bid_payment fulfilled', { bid_id, request_id, order_id: orderRow?.id, pi: s.payment_intent });
          }
          break;
        }

        // ── boost: record payment_intent_id on the boost row ───────────────
        if (s.metadata?.type === 'boost' && s.payment_status === 'paid') {
          const { prepper_id, plan } = s.metadata ?? {};
          if (prepper_id && s.payment_intent) {
            // Update the most recent active boost for this prepper+plan that still has no PI recorded
            await supabase.from('boosts')
              .update({ stripe_payment_intent_id: String(s.payment_intent) })
              .eq('prepper_id', prepper_id)
              .eq('plan', plan ?? '')
              .eq('status', 'active')
              .is('stripe_payment_intent_id', null)
              .order('created_at', { ascending: false })
              .limit(1);
            console.log('boost stripe_payment_intent_id recorded', { prepper_id, plan, pi: s.payment_intent });
          }
          break;
        }

        // ── one-time order payment ──────────────────────────────────────────
        const orderId = s.metadata?.order_id ?? s.client_reference_id ?? undefined;
        if (orderId && s.payment_status === 'paid') {
          await supabase.rpc('record_payment', {
            p_order_id: orderId,
            p_txn: String(s.payment_intent),
            p_status: 'succeeded',
            p_amount: (s.amount_total ?? 0) / 100,
          });
          let stripeFee: number | null = null;
          try {
            const pi = await withRetry(() =>
              stripe.paymentIntents.retrieve(String(s.payment_intent), {
                expand: ['latest_charge.balance_transaction'],
              })
            );
            const charge = pi.latest_charge as Stripe.Charge | null;
            const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
            if (bt && typeof bt.fee === 'number') stripeFee = bt.fee / 100;
          } catch (e) {
            console.error('balance txn fetch failed after retries (estimating fee)', e instanceof Error ? e.message : e);
          }
          await supabase.rpc('apply_payment_fees', { p_order_id: orderId, p_stripe_fee: stripeFee });
          try {
            const { data: gcRow } = await supabase
              .from('orders')
              .select('gift_card_code, gift_card_amount, customer_id')
              .eq('id', orderId)
              .single();
            if (gcRow?.gift_card_code && Number(gcRow.gift_card_amount) > 0) {
              const gcAmount = Number(gcRow.gift_card_amount);
              const { data: card } = await supabase
                .from('gift_cards')
                .select('id, balance, redeemed_by, is_active, expires_at')
                .eq('code', gcRow.gift_card_code)
                .single();
              const expired = card?.expires_at && new Date(card.expires_at) < new Date();
              if (card && card.is_active && card.balance > 0 && !expired) {
                const newBalance = Math.max(0, card.balance - gcAmount);
                // Atomic: .eq('balance', card.balance) is an optimistic lock —
                // concurrent redemptions return 0 rows instead of double-spending.
                const { data: updated } = await supabase
                  .from('gift_cards')
                  .update({
                    balance: newBalance,
                    redeemed_by: card.redeemed_by ?? gcRow.customer_id,
                    is_active: newBalance > 0,
                  })
                  .eq('id', card.id)
                  .eq('balance', card.balance)
                  .select('id');
                if (!updated?.length) {
                  console.warn('gift card balance changed concurrently — skipping', gcRow.gift_card_code);
                }
              }
            }
          } catch (e) {
            console.error('gift card redemption error', e instanceof Error ? e.message : e);
          }
          try { await sendOrderEmails(supabase, orderId); } catch (e) {
            console.error('order email error', e instanceof Error ? e.message : e);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionStatus(supabase, sub);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await cancelSubscription(supabase, sub);
        break;
      }

      case 'charge.refunded': {
        const ch = event.data.object as Stripe.Charge;
        const { data: p } = await supabase
          .from('payments').select('order_id').eq('transaction_id', String(ch.payment_intent)).maybeSingle();
        if (p?.order_id) {
          await supabase.rpc('record_refund', {
            p_order_id: p.order_id,
            p_amount: (ch.amount_refunded ?? 0) / 100,
            p_reason: 'stripe refund',
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        if (typeof inv.subscription === 'string') {
          const sub = await stripe.subscriptions.retrieve(inv.subscription);
          await syncSubscriptionStatus(supabase, sub);
        }
        break;
      }
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'error', { status: 500 });
  }
});
