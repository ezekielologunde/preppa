/**
 * Chaos test: CQRS projection correctness
 *
 * Verifies that replaying a full event history produces deterministic results:
 * - total_orders, total_revenue_pence are exactly sum of all events
 * - completion_rate is correctly computed after cancellations
 * - Self-resetting today/week/month buckets work correctly under replay
 *
 * Run: deno test projection-correctness.test.ts --allow-env --allow-net
 */
import {
  assertEquals,
  assertAlmostEquals,
  assertExists,
} from 'https://deno.land/std@0.208.0/testing/asserts.ts'
import { createTestPrepper, cleanupTestPrepper, db, today, uuid } from './helpers.ts'

function pastDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

Deno.test('project_order_created: running totals match sum of all events', async () => {
  const client = db()
  const { userId: prepperId, kitchenId } = await createTestPrepper(client)
  const customerId = uuid()
  const events = Array.from({ length: 10 }, () => ({
    eventId:  uuid(),
    revenue:  Math.floor(Math.random() * 5000) + 500,
    date:     pastDate(Math.floor(Math.random() * 30)),
  }))

  try {
    await client.from('prepper_metrics').upsert({ prepper_id: prepperId }, { onConflict: 'prepper_id' })
    await client.from('customer_metrics').upsert({ customer_id: customerId }, { onConflict: 'customer_id' })
    await client.from('kitchen_metrics').upsert({ kitchen_id: kitchenId }, { onConflict: 'kitchen_id' })

    // Apply all 10 events
    for (const ev of events) {
      const { error } = await client.rpc('project_order_created', {
        p_event_id:    ev.eventId,
        p_kitchen_id:  kitchenId,
        p_prepper_id:  prepperId,
        p_customer_id: customerId,
        p_revenue:     ev.revenue,
        p_event_date:  ev.date,
      })
      if (error) throw new Error(`project_order_created failed: ${error.message}`)
    }

    const expectedRevenue = events.reduce((sum, e) => sum + e.revenue, 0)

    const { data: metrics } = await client
      .from('prepper_metrics')
      .select('total_orders, total_revenue_pence')
      .eq('prepper_id', prepperId)
      .single()

    assertExists(metrics)
    assertEquals(metrics.total_orders, 10)
    assertEquals(metrics.total_revenue_pence, expectedRevenue)

    // Replay all events (duplicate submission) — totals must NOT change
    for (const ev of events) {
      await client.rpc('project_order_created', {
        p_event_id:    ev.eventId,
        p_kitchen_id:  kitchenId,
        p_prepper_id:  prepperId,
        p_customer_id: customerId,
        p_revenue:     ev.revenue,
        p_event_date:  ev.date,
      })
    }

    const { data: after } = await client
      .from('prepper_metrics')
      .select('total_orders, total_revenue_pence')
      .eq('prepper_id', prepperId)
      .single()

    assertEquals(after?.total_orders, 10, 'Replay must not double-count orders')
    assertEquals(after?.total_revenue_pence, expectedRevenue, 'Replay must not double-count revenue')

  } finally {
    await client.from('projection_event_log').delete().in('event_id', events.map(e => e.eventId))
    await client.from('prepper_metrics').delete().eq('prepper_id', prepperId)
    await client.from('customer_metrics').delete().eq('customer_id', customerId)
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('project_order_cancelled: completion_rate = (total - cancelled) / total', async () => {
  const client = db()
  const { userId: prepperId, kitchenId } = await createTestPrepper(client)
  const customerId = uuid()

  const createEvents = Array.from({ length: 5 }, () => ({ eventId: uuid(), revenue: 1000 }))
  const cancelEvents = [{ eventId: uuid() }]

  try {
    await client.from('prepper_metrics').upsert({ prepper_id: prepperId }, { onConflict: 'prepper_id' })
    await client.from('customer_metrics').upsert({ customer_id: customerId }, { onConflict: 'customer_id' })
    await client.from('kitchen_metrics').upsert({ kitchen_id: kitchenId }, { onConflict: 'kitchen_id' })

    // Place 5 orders
    for (const ev of createEvents) {
      await client.rpc('project_order_created', {
        p_event_id:    ev.eventId,
        p_kitchen_id:  kitchenId,
        p_prepper_id:  prepperId,
        p_customer_id: customerId,
        p_revenue:     ev.revenue,
        p_event_date:  today(),
      })
    }

    // Cancel 1 order
    for (const ev of cancelEvents) {
      const { error } = await client.rpc('project_order_cancelled', {
        p_event_id:    ev.eventId,
        p_prepper_id:  prepperId,
        p_customer_id: customerId,
        p_kitchen_id:  kitchenId,
      })
      if (error) throw new Error(`project_order_cancelled failed: ${error.message}`)
    }

    const { data } = await client
      .from('prepper_metrics')
      .select('total_orders, cancelled_orders, completion_rate')
      .eq('prepper_id', prepperId)
      .single()

    assertExists(data)
    assertEquals(data.total_orders, 5)
    assertEquals(data.cancelled_orders, 1)
    // completion_rate = (5 - 1) / 5 = 0.80
    assertAlmostEquals(data.completion_rate, 0.8, 0.001,
      `Expected completion_rate 0.8, got ${data.completion_rate}`)

  } finally {
    const allEventIds = [...createEvents, ...cancelEvents].map(e => e.eventId)
    await client.from('projection_event_log').delete().in('event_id', allEventIds)
    await client.from('prepper_metrics').delete().eq('prepper_id', prepperId)
    await client.from('customer_metrics').delete().eq('customer_id', customerId)
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('project_order_created: today bucket resets when date changes', async () => {
  // Simulate an event from 3 days ago — it should increment total_* but NOT today_*
  const client = db()
  const { userId: prepperId, kitchenId } = await createTestPrepper(client)
  const customerId = uuid()
  const historicEventId = uuid()
  const todayEventId = uuid()

  try {
    await client.from('prepper_metrics').upsert({ prepper_id: prepperId }, { onConflict: 'prepper_id' })
    await client.from('customer_metrics').upsert({ customer_id: customerId }, { onConflict: 'customer_id' })
    await client.from('kitchen_metrics').upsert({ kitchen_id: kitchenId }, { onConflict: 'kitchen_id' })

    // Historical event (3 days ago) — should only advance total_*
    await client.rpc('project_order_created', {
      p_event_id:    historicEventId,
      p_kitchen_id:  kitchenId,
      p_prepper_id:  prepperId,
      p_customer_id: customerId,
      p_revenue:     2000,
      p_event_date:  pastDate(3),  // 3 days ago
    })

    const { data: afterHistoric } = await client
      .from('prepper_metrics')
      .select('total_orders, today_orders, today_date')
      .eq('prepper_id', prepperId)
      .single()

    assertExists(afterHistoric)
    assertEquals(afterHistoric.total_orders, 1, 'Historic event must increment total_orders')
    assertEquals(afterHistoric.today_orders, 0, 'Historic event must NOT increment today_orders')

    // Today event — should advance both total_* and today_*
    await client.rpc('project_order_created', {
      p_event_id:    todayEventId,
      p_kitchen_id:  kitchenId,
      p_prepper_id:  prepperId,
      p_customer_id: customerId,
      p_revenue:     1500,
      p_event_date:  today(),
    })

    const { data: afterToday } = await client
      .from('prepper_metrics')
      .select('total_orders, today_orders, total_revenue_pence, today_revenue_pence')
      .eq('prepper_id', prepperId)
      .single()

    assertExists(afterToday)
    assertEquals(afterToday.total_orders, 2, 'total_orders must include both events')
    assertEquals(afterToday.today_orders, 1, 'today_orders must include only today event')
    assertEquals(afterToday.total_revenue_pence, 3500, 'total_revenue must sum both events')
    assertEquals(afterToday.today_revenue_pence, 1500, 'today_revenue must only include today event')

  } finally {
    await client.from('projection_event_log').delete().in('event_id', [historicEventId, todayEventId])
    await client.from('prepper_metrics').delete().eq('prepper_id', prepperId)
    await client.from('customer_metrics').delete().eq('customer_id', customerId)
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('full event replay produces deterministic totals', async () => {
  // Apply N events, then replay all N — totals must match exactly.
  const client = db()
  const { userId: prepperId, kitchenId } = await createTestPrepper(client)
  const customerId = uuid()

  const N = 20
  const events = Array.from({ length: N }, () => ({
    eventId: uuid(),
    revenue: 750,
    date:    today(),
  }))

  try {
    await client.from('prepper_metrics').upsert({ prepper_id: prepperId }, { onConflict: 'prepper_id' })
    await client.from('customer_metrics').upsert({ customer_id: customerId }, { onConflict: 'customer_id' })
    await client.from('kitchen_metrics').upsert({ kitchen_id: kitchenId }, { onConflict: 'kitchen_id' })

    // First pass
    for (const ev of events) {
      await client.rpc('project_order_created', {
        p_event_id: ev.eventId, p_kitchen_id: kitchenId, p_prepper_id: prepperId,
        p_customer_id: customerId, p_revenue: ev.revenue, p_event_date: ev.date,
      })
    }

    const { data: firstPass } = await client
      .from('prepper_metrics')
      .select('total_orders, total_revenue_pence')
      .eq('prepper_id', prepperId)
      .single()

    // Second pass (full replay)
    for (const ev of events) {
      await client.rpc('project_order_created', {
        p_event_id: ev.eventId, p_kitchen_id: kitchenId, p_prepper_id: prepperId,
        p_customer_id: customerId, p_revenue: ev.revenue, p_event_date: ev.date,
      })
    }

    const { data: secondPass } = await client
      .from('prepper_metrics')
      .select('total_orders, total_revenue_pence')
      .eq('prepper_id', prepperId)
      .single()

    assertEquals(secondPass?.total_orders, firstPass?.total_orders,
      'total_orders must be deterministic under replay')
    assertEquals(secondPass?.total_revenue_pence, firstPass?.total_revenue_pence,
      'total_revenue_pence must be deterministic under replay')
    assertEquals(firstPass?.total_orders, N, `Expected ${N} orders, got ${firstPass?.total_orders}`)

  } finally {
    await client.from('projection_event_log').delete().in('event_id', events.map(e => e.eventId))
    await client.from('prepper_metrics').delete().eq('prepper_id', prepperId)
    await client.from('customer_metrics').delete().eq('customer_id', customerId)
    await cleanupTestPrepper(client, kitchenId)
  }
})
