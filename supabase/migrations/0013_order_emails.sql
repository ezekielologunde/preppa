-- ============================================================================
-- 0013 — Transactional order emails.
-- The webhook (service_role) sends a customer receipt + a prepper new-order
-- alert when a payment succeeds. Two helpers, both service-role only:
--   • claim_order_receipt(order) — atomic exactly-once guard so Stripe webhook
--     retries don't send duplicate emails.
--   • order_email_payload(order) — one JSON blob with everything the templates
--     need (customer/prepper email + name, items, totals, fulfillment).
-- ============================================================================

-- When the receipt was sent (null = not yet). Drives exactly-once delivery.
alter table payments add column if not exists receipt_sent_at timestamptz;

-- Atomically claim the right to send this order's receipt. Returns true to
-- exactly one caller; later retries get false and skip sending.
create or replace function claim_order_receipt(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update payments set receipt_sent_at = now()
    where order_id = p_order_id and receipt_sent_at is null;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

-- Everything the email templates need for one order, as a single JSON object.
create or replace function order_email_payload(p_order_id uuid)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'order_id',       o.id,
    'subtotal',       o.subtotal,
    'tip',            o.tip,
    'delivery_fee',   o.delivery_fee,
    'total',          o.total,
    'fulfillment',    o.fulfillment_type,
    'note',           o.fulfillment_note,
    'customer_email', cust.email,
    'customer_name',  cust.full_name,
    'prepper_name',   pp.display_name,
    'prepper_email',  prep.email,
    'items', coalesce(
      (select json_agg(json_build_object('qty', oi.quantity, 'price', oi.unit_price, 'title', m.title)
              order by m.title)
         from order_items oi join meals m on m.id = oi.meal_id
        where oi.order_id = o.id), '[]'::json)
  )
  from orders o
  join profiles cust on cust.id = o.customer_id
  left join prepper_profiles pp on pp.id = o.prepper_id
  left join profiles prep on prep.id = pp.user_id
  where o.id = p_order_id;
$$;

revoke all on function claim_order_receipt(uuid) from public, anon, authenticated;
revoke all on function order_email_payload(uuid) from public, anon, authenticated;
grant execute on function claim_order_receipt(uuid) to service_role;
grant execute on function order_email_payload(uuid) to service_role;
