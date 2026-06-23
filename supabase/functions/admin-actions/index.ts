import { createClient } from 'jsr:@supabase/supabase-js@2'
import { cors } from '../_shared/security.ts'

// Admin Actions edge function
// Handles admin operations that require external API calls (Stripe refunds, payouts)
// and provides a single authenticated gateway for all admin mutations.
//
// All requests must carry a valid admin JWT (app_metadata.role = 'admin').
// Audit trail is written by the DB RPCs themselves — not here.

const MAX_BODY_BYTES = 64 * 1024 // 64 KB — admin payloads are small

const ALLOWED_ACTIONS = new Set([
  'freeze_account', 'unfreeze_account', 'verify_prepper',
  'disable_listing', 'enable_listing', 'remove_media',
  'refund_order', 'release_escrow',
  'retry_event', 'replay_dead_letter',
  'resend_notification', 'clear_abuse_review',
  'replay_event', 'replay_range', 'rebuild_projection',
  'toggle_flag', 'kill_flag', 'set_rollout', 'add_flag_target',
  'resolve_alert',
])

interface ActionPayload {
  action: string
  [key: string]: unknown
}

interface RefundOpResult {
  operation_id:     string
  idempotency_key:  string
  amount_pence:     number
  stripe_refund_id: string | null
  status:           string
}

Deno.serve(async (req: Request) => {
  const corsResp = cors(req)
  if (corsResp) return corsResp

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  // Body size guard before any parsing
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413)
  }

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json({ error: 'missing_token' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } }
  )

  const serviceSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify admin identity: JWT auth first, then DB-authoritative role check
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return json({ error: 'unauthorized' }, 401)

  // DB check is authoritative — is_admin() queries user_roles, not just the JWT.
  // A revoked admin is denied here even if their JWT still claims admin.
  const { data: dbIsAdmin, error: roleErr } = await supabase.rpc('is_admin')
  if (roleErr || !dbIsAdmin) return json({ error: 'admin_required' }, 403)

  let body: ActionPayload
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)
    body = JSON.parse(text)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const { action, ...params } = body

  // ALLOWED_ACTIONS checked before any DB call
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return json({ error: 'unknown_action' }, 400)
  }

  try {
    const result = await dispatch(action, params, supabase, serviceSupabase)
    return json({ ok: true, result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[admin-actions] dispatch error:', msg)
    const status = msg.includes('not_found') ? 404
      : msg.includes('required') || msg.includes('invalid') ? 400
      : 500
    // Translate known coded errors to safe client messages; never expose raw internals
    const safeMsg = msg.startsWith('payment_not_found') ? 'payment_not_found'
      : msg.startsWith('payment_not_refundable') ? 'payment_not_refundable'
      : msg.startsWith('payment_not_in_escrow') ? 'payment_not_in_escrow'
      : msg.startsWith('already_refunded') ? 'already_refunded'
      : msg.startsWith('missing_param') ? msg
      : msg.startsWith('stripe_not_configured') ? 'stripe_not_configured'
      : msg.startsWith('stripe_refund_failed') ? 'stripe_refund_failed'
      : status === 500 ? 'internal_error'
      : msg
    return json({ ok: false, error: safeMsg }, status)
  }
})

async function dispatch(
  action: string,
  params: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  serviceSupabase: ReturnType<typeof createClient>,
): Promise<unknown> {
  switch (action) {
    // ── Account ──────────────────────────────────────────────────────────────
    case 'freeze_account':
      return rpc(supabase, 'admin_freeze_account', {
        p_user_id: requireStr(params, 'user_id'),
        p_reason:  requireStr(params, 'reason'),
      })

    case 'unfreeze_account':
      return rpc(supabase, 'admin_unfreeze_account', {
        p_user_id: requireStr(params, 'user_id'),
        p_reason:  requireStr(params, 'reason'),
      })

    case 'clear_abuse_review':
      return rpc(supabase, 'admin_clear_abuse_review', {
        p_user_id: requireStr(params, 'user_id'),
        p_reason:  requireStr(params, 'reason'),
      })

    // ── Prepper ───────────────────────────────────────────────────────────────
    case 'verify_prepper':
      return rpc(supabase, 'admin_verify_prepper', {
        p_prepper_id: requireStr(params, 'prepper_id'),
        p_reason:     requireStr(params, 'reason'),
      })

    // ── Listings ──────────────────────────────────────────────────────────────
    case 'disable_listing':
      return rpc(supabase, 'admin_disable_listing', {
        p_listing_id: requireStr(params, 'listing_id'),
        p_reason:     requireStr(params, 'reason'),
      })

    case 'enable_listing':
      return rpc(supabase, 'admin_enable_listing', {
        p_listing_id: requireStr(params, 'listing_id'),
        p_reason:     requireStr(params, 'reason'),
      })

    // ── Media ─────────────────────────────────────────────────────────────────
    case 'remove_media':
      return rpc(supabase, 'admin_remove_media', {
        p_media_id: requireStr(params, 'media_id'),
        p_reason:   requireStr(params, 'reason'),
      })

    // ── Payments: DB-first state machine (F-02 crash-safe refund) ────────────
    //
    // Old flow: Stripe call → DB write. Crash between them = double refund.
    // New flow: DB write (pending op) → Stripe call → DB completion.
    //   Crash after step 1: recovery worker finds pending op after 10 min and
    //   fires a security event. Admin retries with the same operation_id.
    //   Stripe idempotency key prevents a second charge on retry.
    case 'refund_order': {
      const orderId     = requireStr(params, 'order_id')
      const reason      = requireStr(params, 'reason')
      const operationId = (params.operation_id as string | undefined) ?? null

      // Step 1: DB write FIRST — creates a 'pending' ledger row and locks the
      // payment. Returns immediately if the op is already completed (idempotent).
      const opData = await rpc(supabase, 'admin_refund_order', {
        p_order_id:     orderId,
        p_reason:       reason,
        p_operation_id: operationId,
      }) as RefundOpResult

      // Already completed on a previous attempt — no Stripe call needed
      if (opData.status === 'completed') {
        return { already_refunded: true, stripe_refund_id: opData.stripe_refund_id }
      }

      // Fetch only the Stripe payment intent id — amounts come from the ledger
      const { data: payment, error: pmtErr } = await serviceSupabase
        .from('payments')
        .select('stripe_payment_intent_id')
        .eq('order_id', orderId)
        .single()
      if (pmtErr || !payment) throw new Error('payment_not_found')

      if (!payment.stripe_payment_intent_id) {
        // Payment not yet captured externally — nothing to refund via Stripe yet
        return { operation_id: opData.operation_id, stripe_skipped: true }
      }

      // Step 2: Call Stripe AFTER DB op committed.
      //   The Idempotency-Key header lets Stripe de-duplicate on any retry.
      //   Amount comes from the DB ledger — never from the caller.
      try {
        const refundId = await stripeRefund(
          payment.stripe_payment_intent_id,
          opData.amount_pence,
          reason,
          opData.idempotency_key,
        )

        // Step 3a: mark op complete and set payments/orders to 'refunded'
        await rpc(supabase, 'admin_complete_refund', {
          p_operation_id:     opData.operation_id,
          p_stripe_refund_id: refundId,
          p_order_id:         orderId,
        })

        return { operation_id: opData.operation_id, stripe_refund_id: refundId }
      } catch (stripeErr: unknown) {
        const isTimeout = stripeErr instanceof Error && stripeErr.name === 'AbortError'

        if (isTimeout) {
          // CHAOS-03: HTTP response was lost — Stripe may have processed the refund.
          // Replay the same idempotency key: Stripe returns the cached refund object
          // if it completed, or an in-use error if still processing.
          // Either way, do NOT mark the operation failed.
          try {
            const existingId = await stripeCheckRefundExists(
              payment.stripe_payment_intent_id,
              opData.amount_pence,
              opData.idempotency_key,
              reason,
            )
            if (existingId) {
              await rpc(supabase, 'admin_complete_refund', {
                p_operation_id:     opData.operation_id,
                p_stripe_refund_id: existingId,
                p_order_id:         orderId,
              })
              return { operation_id: opData.operation_id, stripe_refund_id: existingId, recovered: true }
            }
          } catch {
            // Stripe verification failed — leave operation pending for recovery worker
          }
          // Operation stays 'pending'; recover_stale_payment_operations fires after 10 min
          return { operation_id: opData.operation_id, pending_stripe_verification: true }
        }

        // Non-timeout: Stripe rejected definitively — mark failed
        await rpc(supabase, 'admin_fail_refund', {
          p_operation_id: opData.operation_id,
          p_reason:       stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
        }).catch(() => { /* best-effort */ })
        throw stripeErr
      }
    }

    case 'release_escrow': {
      const orderId = requireStr(params, 'order_id')
      const reason  = requireStr(params, 'reason')

      // Stripe: trigger payout transfer to prepper's Connect account
      const { data: payment, error } = await serviceSupabase
        .from('payments')
        .select('id, stripe_payment_intent_id, prepper_payout_pence, status')
        .eq('order_id', orderId)
        .single()
      if (error || !payment) throw new Error('payment_not_found')
      if (payment.status !== 'in_escrow') {
        throw new Error(`payment_not_in_escrow: status=${payment.status}`)
      }

      // Resolve prepper's Stripe Connect account for this order
      const { data: orderRow } = await serviceSupabase
        .from('orders')
        .select('kitchen:kitchens(owner_id)')
        .eq('id', orderId)
        .single()
      const ownerId = Array.isArray(orderRow?.kitchen)
        ? (orderRow.kitchen[0] as { owner_id: string })?.owner_id
        : (orderRow?.kitchen as { owner_id: string } | null)?.owner_id
      const { data: pProfile } = await serviceSupabase
        .from('prepper_profiles')
        .select('stripe_account_id, stripe_account_status')
        .eq('user_id', ownerId ?? '')
        .single()
      if (!pProfile?.stripe_account_id || pProfile.stripe_account_status !== 'active') {
        throw new Error('prepper_connect_not_active')
      }

      const transferId = await stripeTransfer(
        payment.prepper_payout_pence, reason, pProfile.stripe_account_id,
      )
      console.log(`[release_escrow] transfer=${transferId} order=${orderId}`)

      return rpc(supabase, 'admin_release_escrow', {
        p_order_id: orderId,
        p_reason:   reason,
      })
    }

    // ── Events ────────────────────────────────────────────────────────────────
    case 'retry_event':
      return rpc(supabase, 'admin_retry_event', {
        p_event_id: requireStr(params, 'event_id'),
        p_reason:   requireStr(params, 'reason'),
      })

    case 'replay_dead_letter':
      return rpc(supabase, 'admin_replay_dead_letter', {
        p_dead_letter_id: requireStr(params, 'dead_letter_id'),
        p_reason:         requireStr(params, 'reason'),
      })

    case 'replay_event':
      return rpc(supabase, 'admin_replay_event', {
        p_event_id:   requireStr(params, 'event_id'),
        p_projection: (params.projection as string) ?? null,
        p_dry_run:    (params.dry_run as boolean) ?? false,
        p_reason:     requireStr(params, 'reason'),
      })

    case 'replay_range':
      return rpc(supabase, 'admin_replay_range', {
        p_from_time:  requireStr(params, 'from_time'),
        p_to_time:    requireStr(params, 'to_time'),
        p_projection: (params.projection as string) ?? null,
        p_dry_run:    (params.dry_run as boolean) ?? false,
        p_reason:     requireStr(params, 'reason'),
      })

    case 'rebuild_projection':
      return rpc(supabase, 'admin_rebuild_projection', {
        p_projection_name: requireStr(params, 'projection_name'),
        p_dry_run:         (params.dry_run as boolean) ?? false,
        p_reason:          requireStr(params, 'reason'),
      })

    // ── Notifications ─────────────────────────────────────────────────────────
    case 'resend_notification':
      return rpc(supabase, 'admin_resend_notification', {
        p_user_id: requireStr(params, 'user_id'),
        p_type:    requireStr(params, 'type'),
        p_title:   requireStr(params, 'title'),
        p_body:    requireStr(params, 'body'),
        p_reason:  requireStr(params, 'reason'),
        p_data:    (params.data as object) ?? {},
      })

    // ── Feature flags ─────────────────────────────────────────────────────────
    case 'toggle_flag':
      return rpc(supabase, 'admin_toggle_flag', {
        p_key:     requireStr(params, 'key'),
        p_enabled: params.enabled as boolean,
        p_reason:  requireStr(params, 'reason'),
      })

    case 'kill_flag':
      return rpc(supabase, 'admin_kill_flag', {
        p_key:    requireStr(params, 'key'),
        p_reason: requireStr(params, 'reason'),
      })

    case 'set_rollout':
      return rpc(supabase, 'admin_set_rollout', {
        p_key:    requireStr(params, 'key'),
        p_pct:    params.pct as number,
        p_reason: requireStr(params, 'reason'),
      })

    case 'add_flag_target':
      return rpc(supabase, 'admin_add_flag_target', {
        p_key:          requireStr(params, 'key'),
        p_target_type:  requireStr(params, 'target_type'),
        p_target_value: requireStr(params, 'target_value'),
        p_enabled:      (params.enabled as boolean) ?? true,
        p_reason:       requireStr(params, 'reason') ?? 'targeting',
      })

    // ── Alerts ────────────────────────────────────────────────────────────────
    case 'resolve_alert':
      return rpc(supabase, 'admin_resolve_alert', {
        p_alert_id: requireStr(params, 'alert_id'),
        p_reason:   requireStr(params, 'reason'),
      })

    default:
      throw new Error(`unhandled_action: ${action}`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function rpc(
  client: ReturnType<typeof createClient>,
  fn: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

function requireStr(params: Record<string, unknown>, key: string): string {
  const v = params[key]
  if (typeof v !== 'string' || !v) throw new Error(`missing_param: ${key}`)
  return v
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Returns the Stripe refund id on success; throws on failure.
// idempotencyKey is stored in the DB ledger before this is called — Stripe
// will return the same refund object if the key is replayed within 24 hours.
async function stripeRefund(
  paymentIntentId: string,
  amountPence: number,
  reason: string,
  idempotencyKey: string,
): Promise<string> {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('stripe_not_configured')

  const body = new URLSearchParams({
    payment_intent: paymentIntentId,
    amount:         String(amountPence),
    reason:         'requested_by_customer',
    metadata:       JSON.stringify({ admin_reason: reason.slice(0, 500) }),
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch('https://api.stripe.com/v1/refunds', {
      method:  'POST',
      headers: {
        Authorization:    `Bearer ${key}`,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    // Log Stripe detail internally; surface only coded error to caller
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    console.error('[admin-actions] stripe refund failed:', err?.error?.message, res.status)
    throw new Error('stripe_refund_failed')
  }

  const data = await res.json() as { id: string }
  return data.id
}

// CHAOS-03: Verify whether Stripe processed a refund after an HTTP timeout.
// Replays the original idempotency key — Stripe returns the cached response if
// the refund completed, or an idempotency_key_in_use error if still processing.
// Returns the Stripe refund ID on success, null if state is unknown.
async function stripeCheckRefundExists(
  paymentIntentId: string,
  amountPence: number,
  idempotencyKey: string,
  adminReason: string,
): Promise<string | null> {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return null

  const body = new URLSearchParams({
    payment_intent: paymentIntentId,
    amount:         String(amountPence),
    reason:         'requested_by_customer',
    metadata:       JSON.stringify({ admin_reason: adminReason.slice(0, 500) }),
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method:  'POST',
      headers: {
        Authorization:     `Bearer ${key}`,
        'Content-Type':    'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body,
      signal: controller.signal,
    })

    if (res.ok) {
      const data = await res.json() as { id: string }
      return data.id
    }

    const errData = await res.json().catch(() => ({})) as { error?: { code?: string } }
    console.error('[admin-actions] stripe verification:', errData?.error?.code, res.status)
    // idempotency_key_in_use = Stripe still processing; any other error = unknown state
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function stripeTransfer(
  amountPence: number,
  reason: string,
  connectAccountId: string,
): Promise<string> {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('stripe_not_configured')

  const body = new URLSearchParams({
    amount:      String(amountPence),
    currency:    'gbp',
    destination: connectAccountId,
    description: reason,
  })

  const res = await fetch('https://api.stripe.com/v1/transfers', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`stripe_transfer_failed: ${err.error?.message ?? res.status}`)
  }

  const transfer = await res.json() as { id: string }
  return transfer.id
}
