// stripe-connect-webhook — Connect/payout/dispute events on the CURRENT schema.
// Kept separate from the legacy stripe-webhook (which targets the dead pre-reset
// schema) and uses the dedicated Connect endpoint secret. Every handler:
//   • validates the signature (constructEventAsync)
//   • is idempotent (processed_stripe_events unique insert)
//   • writes an audit row (domain_events)
//   • updates projections (stripe_accounts / payouts via service-role RPCs)
//   • emits notifications where the prepper must be told
//
// Handled: account.updated, capability.updated, payout.created/paid/failed/canceled,
//          transfer.created, charge.refunded, charge.dispute.created/closed
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const CONNECT_WHSEC = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET') ?? '';
const MAX_BYTES = 1_000_000;

type DB = ReturnType<typeof createClient>;

// Resolve a connected account id → our prepper_id.
async function prepperForAccount(db: DB, accountId: string | null): Promise<string | null> {
  if (!accountId) return null;
  const { data } = await db.from('stripe_accounts').select('prepper_id').eq('stripe_account_id', accountId).maybeSingle();
  return (data?.prepper_id as string | undefined) ?? null;
}

// Append an audit/event row. The 037 trigger backfills aggregate columns.
async function emit(db: DB, eventType: string, payload: Record<string, unknown>): Promise<void> {
  await db.from('domain_events').insert({ event_type: eventType, payload });
}

async function notify(db: DB, userId: string, type: string, title: string, body: string, priority = 'normal'): Promise<void> {
  await db.from('notifications').insert({ user_id: userId, type, title, body, priority });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing Stripe-Signature header', { status: 400 });
  if (!CONNECT_WHSEC) return new Response('Webhook secret not configured', { status: 500 });

  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BYTES) return new Response('Payload too large', { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return new Response('Payload too large', { status: 413 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, CONNECT_WHSEC, undefined, cryptoProvider);
  } catch (e) {
    return new Response(`Bad signature: ${e instanceof Error ? e.message : 'error'}`, { status: 400 });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Idempotency: unique insert; duplicate delivery short-circuits.
  const { error: dupErr } = await db.from('processed_stripe_events').insert({ event_id: event.id, type: event.type });
  if (dupErr?.code === '23505') {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  const accountId = (event.account as string | undefined) ?? null;

  try {
    switch (event.type) {
      // ── Capture (platform charges): customer payment → funds in escrow ──
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id as string | undefined;
        if (orderId) {
          await db.rpc('record_payment_capture', { p_order_id: orderId, p_payment_intent_id: pi.id });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id as string | undefined;
        if (orderId) {
          await db.rpc('record_payment_failed', {
            p_order_id: orderId,
            p_reason:   pi.last_payment_error?.message ?? 'payment_failed',
          });
        }
        break;
      }

      case 'account.updated':
      case 'capability.updated': {
        const account = await stripe.accounts.retrieve(accountId!);
        const prepperId = (account.metadata?.prepper_id as string | undefined)
          ?? await prepperForAccount(db, account.id);
        if (!prepperId) break;
        const status =
          account.charges_enabled && account.payouts_enabled ? 'active'
          : account.requirements?.disabled_reason ? 'restricted'
          : account.details_submitted ? 'pending' : 'not_connected';
        await db.rpc('upsert_stripe_account', {
          p_prepper_id: prepperId,
          p_data: {
            stripe_account_id:           account.id,
            status,
            charges_enabled:             account.charges_enabled ?? false,
            payouts_enabled:             account.payouts_enabled ?? false,
            details_submitted:           account.details_submitted ?? false,
            disabled_reason:             account.requirements?.disabled_reason ?? null,
            requirements_due:            account.requirements?.currently_due ?? [],
            requirements_eventually_due: account.requirements?.eventually_due ?? [],
            country:                     account.country ?? null,
            business_type:               account.business_type ?? null,
            default_currency:            account.default_currency ?? 'gbp',
          },
        });
        await emit(db, 'prepper.stripe_updated', { user_id: prepperId, status, disabled_reason: account.requirements?.disabled_reason ?? null });
        if (status === 'active') {
          await notify(db, prepperId, 'account_status', 'Payouts enabled', 'Your account is verified — you can now receive payouts.', 'high');
        } else if (status === 'restricted') {
          await notify(db, prepperId, 'account_status', 'Action needed', 'Stripe needs more information before you can receive payouts.', 'high');
        }
        break;
      }

      case 'payout.created':
      case 'payout.paid':
      case 'payout.failed':
      case 'payout.canceled': {
        const payout = event.data.object as Stripe.Payout;
        const prepperId = await prepperForAccount(db, accountId);
        if (!prepperId) break;
        const status = event.type === 'payout.paid' ? 'paid'
          : event.type === 'payout.failed' ? 'failed'
          : event.type === 'payout.canceled' ? 'canceled'
          : payout.status === 'in_transit' ? 'in_transit' : 'pending';
        await db.rpc('record_payout', {
          p_prepper_id: prepperId,
          p_data: {
            stripe_payout_id: payout.id,
            amount_pence:     payout.amount,
            currency:         payout.currency,
            status,
            failure_code:     payout.failure_code ?? null,
            failure_message:  payout.failure_message ?? null,
            arrival_date:     payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
          },
        });
        await emit(db, `payout.${status}`, { user_id: prepperId, payout_id: payout.id, amount_pence: payout.amount });
        if (status === 'paid') {
          await notify(db, prepperId, 'payout', 'Payout sent', `£${(payout.amount / 100).toFixed(2)} is on its way to your bank.`, 'normal');
        } else if (status === 'failed') {
          await notify(db, prepperId, 'payout_failed', 'Payout failed', 'A payout failed — please check your bank details in Earnings.', 'high');
        }
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        await emit(db, 'transfer.created', {
          order_id: (transfer.metadata?.order_id as string | undefined) ?? null,
          transfer_id: transfer.id, amount_pence: transfer.amount,
        });
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await emit(db, 'payment.refunded', { charge_id: charge.id, payment_intent: String(charge.payment_intent ?? ''), amount_refunded: charge.amount_refunded });
        break;
      }

      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        const status = event.type === 'charge.dispute.closed' ? 'closed' : 'created';
        await emit(db, `payment.chargeback_${status}`, {
          dispute_id: dispute.id, charge_id: String(dispute.charge ?? ''),
          amount: dispute.amount, reason: dispute.reason, dispute_status: dispute.status,
        });
        break;
      }

      default:
        // Unhandled Connect event — acked so Stripe stops retrying.
        break;
    }
  } catch (e) {
    console.error(`[stripe-connect-webhook] ${event.type} ${event.id}:`, e instanceof Error ? e.message : e);
    // 500 → Stripe retries; the processed_stripe_events row was inserted, so on
    // retry the duplicate guard returns 200. Delete the lock so retry re-runs.
    await db.from('processed_stripe_events').delete().eq('event_id', event.id);
    return new Response('handler_error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
