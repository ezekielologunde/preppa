/**
 * Chaos test: Event idempotency
 *
 * Verifies that sending the same event_id N times to project_order_created
 * results in exactly 1 projection update — no duplicate increments.
 *
 * Run: deno test event-idempotency.test.ts --allow-env --allow-net
 */
import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/testing/asserts.ts'
import { concurrent, createTestPrepper, cleanupTestPrepper, db, today, uuid } from './helpers.ts'

Deno.test('project_order_created: 100 duplicate events → exactly 1 projection update', async () => {
  const client   = db()
  const eventId  = uuid()
  const customerId = uuid()
  const revenue  = 1500  // £15.00
  const eventDate = today()

  const { userId: prepperId, kitchenId } = await createTestPrepper(client)

  try {
    // Seed baseline rows
    await client.from('prepper_metrics').upsert({ prepper_id: prepperId }, { onConflict: 'prepper_id' })
    await client.from('customer_metrics').upsert({ customer_id: customerId }, { onConflict: 'customer_id' })
    await client.from('kitchen_metrics').upsert({ kitchen_id: kitchenId }, { onConflict: 'kitchen_id' })

    const { data: baseline } = await client
      .from('prepper_metrics')
      .select('total_orders, total_revenue_pence')
      .eq('prepper_id', prepperId)
      .single()

    const baseOrders  = baseline?.total_orders ?? 0
    const baseRevenue = baseline?.total_revenue_pence ?? 0

    // Fire 100 concurrent duplicate calls
    const results = await concurrent(100, () =>
      client.rpc('project_order_created', {
        p_event_id:    eventId,
        p_kitchen_id:  kitchenId,
        p_prepper_id:  prepperId,
        p_customer_id: customerId,
        p_revenue:     revenue,
        p_event_date:  eventDate,
      })
    )

    const errors = results.filter(r => r.error)
    // Some calls will get 23505 unique_violation on projection_event_log — that's expected
    // None should return unexpected errors
    const unexpectedErrors = errors.filter(r => r.error!.code !== '23505')
    assertEquals(unexpectedErrors.length, 0, `Unexpected errors: ${JSON.stringify(unexpectedErrors)}`)

    // Verify idempotency log has exactly 1 entry for this event
    const { count: logCount } = await client
      .from('projection_event_log')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('projection_name', 'project_order_created')

    assertEquals(logCount, 1, `Expected 1 projection log entry, got ${logCount}`)

    // Verify prepper_metrics incremented exactly once
    const { data: after } = await client
      .from('prepper_metrics')
      .select('total_orders, total_revenue_pence')
      .eq('prepper_id', prepperId)
      .single()

    assertExists(after, 'prepper_metrics row must exist')
    assertEquals(after.total_orders, baseOrders + 1, 'total_orders must increment exactly once')
    assertEquals(after.total_revenue_pence, baseRevenue + revenue, 'revenue must increment exactly once')

  } finally {
    // Cleanup
    await client.from('projection_event_log').delete().eq('event_id', eventId)
    await client.from('prepper_metrics').delete().eq('prepper_id', prepperId)
    await client.from('customer_metrics').delete().eq('customer_id', customerId)
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('increment_kitchen_orders: 100 concurrent calls → no lost updates', async () => {
  const client = db()
  const { kitchenId } = await createTestPrepper(client)
  const date = today()

  try {
    // Seed an event_id per call so each is unique (tests counter atomicity, not idempotency)
    await concurrent(100, (i) =>
      client.rpc('increment_kitchen_orders', {
        p_kitchen_id: kitchenId,
        p_date:       date,
        p_event_id:   uuid(),  // unique per call → all 100 must be counted
      })
    )

    const { data } = await client
      .from('kitchen_capacity')
      .select('orders_accepted')
      .eq('kitchen_id', kitchenId)
      .eq('date', date)
      .single()

    assertEquals(data?.orders_accepted, 100, `Expected 100 increments, got ${data?.orders_accepted}`)
  } finally {
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('increment_kitchen_orders: same event_id 50 times → counted exactly once', async () => {
  const client = db()
  const { kitchenId } = await createTestPrepper(client)
  const eventId = uuid()
  const date = today()

  try {
    await concurrent(50, () =>
      client.rpc('increment_kitchen_orders', {
        p_kitchen_id: kitchenId,
        p_date:       date,
        p_event_id:   eventId,  // same event_id → idempotent
      })
    )

    const { data } = await client
      .from('kitchen_capacity')
      .select('orders_accepted')
      .eq('kitchen_id', kitchenId)
      .eq('date', date)
      .single()

    assertEquals(data?.orders_accepted, 1, `Expected exactly 1 increment, got ${data?.orders_accepted}`)
  } finally {
    await client.from('projection_event_log').delete().eq('event_id', eventId)
    await cleanupTestPrepper(client, kitchenId)
  }
})

Deno.test('project_order_cancelled: 50 duplicate cancel events → cancellation counted once', async () => {
  const client = db()
  const eventId = uuid()
  const customerId = uuid()

  const { userId: prepperId, kitchenId } = await createTestPrepper(client)

  try {
    await client.from('prepper_metrics').upsert({ prepper_id: prepperId }, { onConflict: 'prepper_id' })
    await client.from('customer_metrics').upsert({ customer_id: customerId }, { onConflict: 'customer_id' })
    await client.from('kitchen_metrics').upsert({ kitchen_id: kitchenId }, { onConflict: 'kitchen_id' })

    // First establish an order (so cancelled_orders starts from 0)
    const createEvent = uuid()
    await client.rpc('project_order_created', {
      p_event_id:    createEvent,
      p_kitchen_id:  kitchenId,
      p_prepper_id:  prepperId,
      p_customer_id: customerId,
      p_revenue:     1000,
      p_event_date:  today(),
    })

    // Fire 50 duplicate cancel events
    await concurrent(50, () =>
      client.rpc('project_order_cancelled', {
        p_event_id:    eventId,
        p_prepper_id:  prepperId,
        p_customer_id: customerId,
        p_kitchen_id:  kitchenId,
      })
    )

    const { data } = await client
      .from('prepper_metrics')
      .select('cancelled_orders')
      .eq('prepper_id', prepperId)
      .single()

    assertEquals(data?.cancelled_orders, 1, `Expected 1 cancellation, got ${data?.cancelled_orders}`)
  } finally {
    await client.from('projection_event_log')
      .delete()
      .in('event_id', [eventId])
    await client.from('prepper_metrics').delete().eq('prepper_id', prepperId)
    await client.from('customer_metrics').delete().eq('customer_id', customerId)
    await cleanupTestPrepper(client, kitchenId)
  }
})
