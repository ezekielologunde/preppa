import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''

const MAX_ATTEMPTS = 5
// Exponential backoff in seconds: 30s, 2m, 10m, 1h, 4h
const BACKOFF_SECONDS = [30, 120, 600, 3600, 14400]

type DomainEvent = {
  id: string
  event_type: string
  aggregate_type: string
  aggregate_id: string
  actor_id: string | null
  payload: Record<string, unknown>
  occurred_at: string
  version?: number
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: DomainEvent | null
  old_record: DomainEvent | null
  // Present only on retries dispatched by dispatch_retry_events()
  attempt?: number
}

type DB = ReturnType<typeof createClient>

// ── Helpers ────────────────────────────────────────────────────────────────

async function isNotificationEnabled(
  db: DB,
  userId: string,
  notifType: string,
): Promise<boolean> {
  const { data } = await db
    .from('notification_preferences')
    .select('enabled')
    .eq('user_id', userId)
    .eq('channel', 'in_app')
    .eq('notification_type', notifType)
    .maybeSingle()
  return data?.enabled !== false  // opt-out model: absent row = enabled
}

// ── Handlers ──────────────────────────────────────────────────────────────

async function onOrderCreated(event: DomainEvent, db: DB): Promise<void> {
  const p = event.payload as {
    kitchen_id: string
    total_pence: number
    prepper_id?: string
    customer_id?: string
  }
  const { kitchen_id, total_pence } = p

  // Hydrate prepper_id from payload (new events) or JOIN (legacy events pre-006)
  let prepperId = p.prepper_id ?? null
  if (!prepperId) {
    const { data: kitchen } = await db
      .from('kitchens')
      .select('prepper_id')
      .eq('id', kitchen_id)
      .single()
    if (!kitchen) return
    prepperId = kitchen.prepper_id
  }
  const customerId = p.customer_id ?? event.actor_id ?? null

  if (await isNotificationEnabled(db, prepperId, 'new_order')) {
    await db.from('notifications').insert({
      user_id:  prepperId,
      type:     'new_order',
      title:    'New order',
      body:     `A new order for £${(total_pence / 100).toFixed(2)} just came in`,
      data:     { order_id: event.aggregate_id, kitchen_id },
      priority: 'high',
    })
  }

  const today = new Date().toISOString().split('T')[0]
  // Pass event.id so increment_kitchen_orders is idempotent (migration 009 FINDING-007)
  await db.rpc('increment_kitchen_orders', {
    p_kitchen_id: kitchen_id,
    p_date:       today,
    p_event_id:   event.id,
  })

  if (customerId) {
    const eventDate = new Date(event.occurred_at).toISOString().split('T')[0]
    await db.rpc('project_order_created', {
      p_event_id:    event.id,
      p_kitchen_id:  kitchen_id,
      p_prepper_id:  prepperId,
      p_customer_id: customerId,
      p_revenue:     total_pence,
      p_event_date:  eventDate,
    })
  }
}

async function onOrderStatusChanged(event: DomainEvent, db: DB): Promise<void> {
  const p = event.payload as {
    from: string
    to: string
    kitchen_id?: string
    prepper_id?: string
    customer_id?: string
  }
  const { to } = p

  const STATUS_MESSAGES: Record<string, string> = {
    confirmed:  'Your order has been confirmed',
    preparing:  'Your order is being prepared',
    ready:      'Your order is ready for collection',
    in_transit: 'Your order is on its way',
    delivered:  'Your order has been delivered',
    cancelled:  'Your order has been cancelled',
    refunded:   'Your refund is being processed',
  }

  const body = STATUS_MESSAGES[to]
  if (!body) return

  // Hydrate customer_id from payload (new events) or DB lookup (legacy)
  let customerId = p.customer_id ?? null
  if (!customerId) {
    const { data: order } = await db
      .from('orders')
      .select('customer_id')
      .eq('id', event.aggregate_id)
      .single()
    if (!order) return
    customerId = order.customer_id
  }

  const notifType = to === 'cancelled' ? 'order_cancelled' : 'order_update'
  if (await isNotificationEnabled(db, customerId, notifType)) {
    await db.from('notifications').insert({
      user_id:  customerId,
      type:     notifType,
      title:    'Order update',
      body,
      data:     { order_id: event.aggregate_id, status: to },
      priority: to === 'cancelled' ? 'high' : 'normal',
    })
  }

  // CQRS: project cancellation (requires all IDs — only new-format events have them in payload)
  if (to === 'cancelled' && p.prepper_id && p.customer_id && p.kitchen_id) {
    await db.rpc('project_order_cancelled', {
      p_event_id:    event.id,
      p_prepper_id:  p.prepper_id,
      p_customer_id: p.customer_id,
      p_kitchen_id:  p.kitchen_id,
    })
  }
}

async function onListingStatusChanged(event: DomainEvent, db: DB): Promise<void> {
  const { to } = event.payload as { from: string; to: string }
  if (to !== 'published') return

  await db.from('listing_stats').upsert(
    { listing_id: event.aggregate_id },
    { onConflict: 'listing_id', ignoreDuplicates: true },
  )
}

// ── Router ────────────────────────────────────────────────────────────────

type Handler = (event: DomainEvent, db: DB) => Promise<void>

const HANDLERS: Record<string, Handler> = {
  'order.created':          onOrderCreated,
  'order.status_changed':   onOrderStatusChanged,
  'listing.status_changed': onListingStatusChanged,
}

// ── Retry / Dead Letter ───────────────────────────────────────────────────

async function scheduleRetryOrDeadLetter(
  event: DomainEvent,
  db: DB,
  attempt: number,
  errorMsg: string,
): Promise<void> {
  const now = new Date().toISOString()

  if (attempt >= MAX_ATTEMPTS) {
    await db.from('event_dead_letters').insert({
      event_id:         event.id,
      event_type:       event.event_type,
      final_error:      errorMsg,
      attempt_count:    attempt,
      payload_snapshot: event.payload,
    })
    await db
      .from('event_processing_log')
      .update({ status: 'dead_letter', failure_reason: errorMsg, last_attempt_at: now, processed_at: now })
      .eq('event_id', event.id)
  } else {
    const backoffMs = (BACKOFF_SECONDS[attempt - 1] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]) * 1000
    const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString()
    await db
      .from('event_processing_log')
      .update({
        status:          'pending_retry',
        attempt_count:   attempt,
        failure_reason:  errorMsg,
        last_attempt_at: now,
        next_attempt_at: nextAttemptAt,
      })
      .eq('event_id', event.id)
  }
}

// ── Entrypoint ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (WEBHOOK_SECRET) {
    const secret = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (secret !== WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 })
  }

  const webhook = await req.json() as WebhookPayload
  if (webhook.type !== 'INSERT' || webhook.table !== 'domain_events' || !webhook.record) {
    return new Response('Ignored', { status: 200 })
  }

  const event   = webhook.record
  const attempt = webhook.attempt ?? 1  // 1 = first run; 2+ = retry from dispatch_retry_events
  const isRetry = attempt > 1

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  if (!isRetry) {
    // First attempt: INSERT idempotency lock.
    // Unique constraint on event_id means concurrent calls self-evict on 23505.
    const { error: lockError } = await db.from('event_processing_log').insert({
      event_id:        event.id,
      event_type:      event.event_type,
      status:          'processing',
      attempt_count:   1,
      last_attempt_at: new Date().toISOString(),
    })
    if (lockError) {
      if (lockError.code === '23505') return new Response('Already processing', { status: 200 })
      console.error('[event-processor] lock insert failed:', lockError.message)
      return new Response('internal_error', { status: 500 })
    }
  }

  const handler = HANDLERS[event.event_type]
  let finalStatus = handler ? 'success' : 'skipped'
  let errorMsg: string | null = null

  if (handler) {
    try {
      await handler(event, db)
    } catch (err) {
      finalStatus = 'failed'
      errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[event-processor] attempt=${attempt} ${event.event_type} ${event.id}:`, err)
    }
  }

  if (finalStatus === 'failed') {
    await scheduleRetryOrDeadLetter(event, db, attempt, errorMsg!)
  } else {
    const now = new Date().toISOString()
    await db
      .from('event_processing_log')
      .update({ status: finalStatus, attempt_count: attempt, processed_at: now, last_attempt_at: now })
      .eq('event_id', event.id)
  }

  return new Response(
    JSON.stringify({ status: finalStatus, event_type: event.event_type, attempt }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
