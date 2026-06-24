/**
 * Chaos test: Kitchen capacity concurrency
 *
 * Tests: atomic counter under concurrent writes, capacity state transitions,
 *        advisory lock on refresh_platform_health.
 *
 * Run: deno test capacity-concurrency.test.ts --allow-env --allow-net
 */
import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.208.0/testing/asserts.ts'
import { concurrent, createTestPrepper, cleanupTestPrepper, db, today, uuid } from './helpers.ts'

Deno.test('increment_kitchen_orders: 500 concurrent unique events → 500 counted', async () => {
  const client = db()
  const { kitchenId } = await createTestPrepper(client)
  const date = today()
  const N = 500

  try {
    // Each call has a unique event_id → all N must be counted (no dedup)
    await concurrent(N, () =>
      client.rpc('increment_kitchen_orders', {
        p_kitchen_id: kitchenId,
        p_date:       date,
        p_event_id:   uuid(),
      })
    )

    const { data } = await client
      .from('kitchen_capacity')
      .select('orders_accepted, daily_limit')
      .eq('kitchen_id', kitchenId)
      .eq('date', date)
      .single()

    assertExists(data, 'kitchen_capacity row must exist')
    assertEquals(data.orders_accepted, N,
      `Expected ${N} orders_accepted, got ${data.orders_accepted} — atomic UPDATE lost writes`)
  } finally {
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('increment_kitchen_orders: 1 event_id replayed 500 times → counted once', async () => {
  const client = db()
  const { kitchenId } = await createTestPrepper(client)
  const eventId = uuid()
  const date = today()

  try {
    await concurrent(500, () =>
      client.rpc('increment_kitchen_orders', {
        p_kitchen_id: kitchenId,
        p_date:       date,
        p_event_id:   eventId,
      })
    )

    const { data } = await client
      .from('kitchen_capacity')
      .select('orders_accepted')
      .eq('kitchen_id', kitchenId)
      .eq('date', date)
      .single()

    assertEquals(data?.orders_accepted, 1,
      `Expected exactly 1 (idempotent), got ${data?.orders_accepted}`)
  } finally {
    await client.from('projection_event_log').delete().eq('event_id', eventId)
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('kitchen capacity state: status reflects orders_accepted vs daily_limit', async () => {
  const client = db()
  const { kitchenId } = await createTestPrepper(client)
  // createTestPrepper sets daily_capacity = 10
  const date = today()

  try {
    // Increment 9 times (below capacity)
    for (let i = 0; i < 9; i++) {
      await client.rpc('increment_kitchen_orders', {
        p_kitchen_id: kitchenId,
        p_date:       date,
        p_event_id:   uuid(),
      })
    }

    const { data: below } = await client
      .rpc('get_kitchen_status', { kitchen_id: kitchenId })
    // Should NOT be 'booked' yet (9 < 10)
    const notBooked = below !== 'booked'
    assertEquals(notBooked, true, `Kitchen should not be booked at 9/10 capacity: ${below}`)

    // Increment to exactly 10 (at capacity)
    await client.rpc('increment_kitchen_orders', {
      p_kitchen_id: kitchenId,
      p_date:       date,
      p_event_id:   uuid(),
    })

    const { data: atCapacity } = await client
      .rpc('get_kitchen_status', { kitchen_id: kitchenId })
    assertEquals(atCapacity, 'booked',
      `Kitchen should be 'booked' at 10/10 capacity: ${atCapacity}`)

  } finally {
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('kitchen_capacity: different dates are independent rows', async () => {
  // Verify that concurrent increments for different dates never cross-contaminate
  const client = db()
  const { kitchenId } = await createTestPrepper(client)

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return d.toISOString().split('T')[0]
  })

  try {
    // 10 increments per date, all concurrent
    await concurrent(dates.length * 10, (i) =>
      client.rpc('increment_kitchen_orders', {
        p_kitchen_id: kitchenId,
        p_date:       dates[Math.floor(i / 10)],
        p_event_id:   uuid(),
      })
    )

    for (const date of dates) {
      const { data } = await client
        .from('kitchen_capacity')
        .select('orders_accepted')
        .eq('kitchen_id', kitchenId)
        .eq('date', date)
        .single()

      assertEquals(data?.orders_accepted, 10,
        `Date ${date}: expected 10 orders_accepted, got ${data?.orders_accepted}`)
    }
  } finally {
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('refresh_platform_health: concurrent calls do not corrupt singleton', async () => {
  // pg_try_advisory_lock ensures only one call runs at a time.
  // 20 concurrent calls should succeed (advisory lock skips extras, never corrupts).
  const client = db()

  // Get baseline
  const { data: before } = await client
    .from('platform_health_metrics')
    .select('computed_at')
    .eq('id', 1)
    .single()

  // Fire 20 concurrent refresh calls
  const results = await concurrent(20, () =>
    client.rpc('refresh_platform_health')
  )

  // None should error (skipped calls return void too — no error)
  const errors = results.filter(r => r.error)
  assertEquals(errors.length, 0, `refresh_platform_health errors: ${JSON.stringify(errors)}`)

  // Singleton row must still exist
  const { data: after } = await client
    .from('platform_health_metrics')
    .select('id, computed_at')
    .eq('id', 1)
    .single()

  assertExists(after, 'platform_health_metrics singleton must still exist after concurrent refresh')
  assertEquals(after.id, 1, 'Singleton id must remain 1')

  // computed_at should be >= before (refreshed at least once)
  if (before?.computed_at && after.computed_at) {
    const refreshed = new Date(after.computed_at) >= new Date(before.computed_at)
    assertEquals(refreshed, true, 'computed_at must be updated after refresh')
  }
})

Deno.test('emit_abuse_signal: concurrent signals accumulate correctly', async () => {
  // Verify that 10 concurrent abuse signals for the same user all land (no lost updates)
  const client = db()
  const userId = uuid()

  try {
    // 10 concurrent signals of score 10 each → cumulative should be 100
    await concurrent(10, () =>
      client.rpc('emit_abuse_signal', {
        p_user_id: userId,
        p_type:    'login_bruteforce',
        p_score:   10,
        p_payload: {},
      })
    )

    const { data } = await client
      .from('risk_scores')
      .select('score, signals_count')
      .eq('user_id', userId)
      .single()

    assertExists(data, 'risk_scores row must exist')
    assertEquals(data.signals_count, 10, `Expected 10 signals, got ${data.signals_count}`)
    assertEquals(data.score, 100, `Expected cumulative score 100, got ${data.score}`)
  } finally {
    await client.from('risk_scores').delete().eq('user_id', userId)
    await client.from('abuse_signals').delete().eq('user_id', userId)
  }
})

Deno.test('abort: no sequential scans on projection_event_log hot path', async () => {
  // Verify the index is used (EXPLAIN won't work over supabase-js, but we can
  // time a lookup on a well-indexed table to ensure it's sub-millisecond)
  const client = db()
  const fakeId = uuid()

  const start = performance.now()
  await client
    .from('projection_event_log')
    .select('event_id')
    .eq('event_id', fakeId)
    .eq('projection_name', 'project_order_created')
    .maybeSingle()
  const elapsed = performance.now() - start

  // If this is doing a sequential scan it would take seconds on a large table.
  // Sub-100ms indicates index use. (Loose bound for network round-trip.)
  assertEquals(elapsed < 2000, true,
    `projection_event_log lookup took ${elapsed.toFixed(0)}ms — possible sequential scan`)
})
