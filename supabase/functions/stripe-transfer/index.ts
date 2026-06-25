// stripe-transfer — releases escrow to a prepper's Connect account.
// Invoked internally by the event-processor on escrow.auto_releasing /
// dispute.resolved (prepper-favourable). DB-first via payment_operations (023):
//   1. _begin_release_operation  — locks the order/payment, gates on verified
//      fulfilment + payouts_enabled, writes a 'release' op BEFORE any Stripe call
//   2. stripe.transfers.create   — idempotency key from the op (safe on retry)
//   3. _complete_release_operation / _fail_release_operation
//
// No payout occurs before verified fulfilment — that gate lives in the RPC, not here.
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Internal-only: caller must present the service-role key (event-processor does).
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (bearer !== SERVICE_KEY) return new Response('Unauthorized', { status: 401 });

  let order_id: string | undefined;
  try {
    ({ order_id } = await req.json() as { order_id?: string });
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!order_id) return new Response('Missing order_id', { status: 400 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_KEY);

  // 1. DB-first: create (or fetch idempotent) release operation.
  const { data: op, error: beginErr } = await supabase.rpc('_begin_release_operation', { p_order_id: order_id });
  if (beginErr) {
    // already_released / not_verified / payouts_not_enabled — non-retryable vs retryable
    const msg = beginErr.message ?? 'begin_release_failed';
    if (msg.includes('already_released')) {
      return new Response(JSON.stringify({ status: 'already_released' }), { status: 200 });
    }
    return new Response(`begin_release: ${msg}`, { status: 422 });
  }

  const operation = op as {
    id: string;
    stripe_idempotency_key: string;
    amount_pence: number;
    currency: string;
    stripe_transfer_id: string | null;
    metadata: { stripe_account_id?: string; prepper_id?: string };
  };

  // Already completed on a previous run.
  if (operation.stripe_transfer_id) {
    return new Response(JSON.stringify({ status: 'already_transferred', transfer_id: operation.stripe_transfer_id }), { status: 200 });
  }

  const destination = operation.metadata?.stripe_account_id;
  if (!destination) {
    await supabase.rpc('_fail_release_operation', { p_operation_id: operation.id, p_reason: 'missing_destination_account' });
    return new Response('Missing destination account', { status: 422 });
  }

  // 2. Stripe transfer (idempotent on the op key — safe to retry).
  try {
    const transfer = await stripe.transfers.create(
      {
        amount:         operation.amount_pence,
        currency:       operation.currency,
        destination,
        transfer_group: order_id,
        metadata:       { order_id, operation_id: operation.id, prepper_id: operation.metadata.prepper_id ?? '' },
      },
      { idempotencyKey: operation.stripe_idempotency_key },
    );

    // 3a. Mark complete (escrow → released, payment → released).
    const { error: completeErr } = await supabase.rpc('_complete_release_operation', {
      p_operation_id:      operation.id,
      p_stripe_transfer_id: transfer.id,
      p_order_id:          order_id,
    });
    if (completeErr) {
      console.error('[stripe-transfer] complete RPC failed:', completeErr.message);
      // Transfer succeeded but DB write failed — recovery worker reconciles the stale op.
      return new Response('complete_release_failed', { status: 500 });
    }

    return new Response(JSON.stringify({ status: 'released', transfer_id: transfer.id }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // 3b. Stripe error — mark the op failed; payment/order untouched so retry is safe.
    const msg = e instanceof Error ? e.message : 'stripe_transfer_error';
    await supabase.rpc('_fail_release_operation', { p_operation_id: operation.id, p_reason: msg });
    console.error('[stripe-transfer] transfer error:', msg);
    return new Response(`transfer_failed: ${msg}`, { status: 502 });
  }
});
