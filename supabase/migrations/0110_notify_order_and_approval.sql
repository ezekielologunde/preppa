-- 0110_notify_order_and_approval.sql
-- Wire up in-app notifications for:
--   1. Prepper approval / rejection (admin action)
--   2. New order placed (notify prepper)
--   3. Order status changes (notify customer)

-- ── 1. admin_set_prepper_status ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_prepper_status(
  p_prepper uuid,
  p_status  text,
  p_note    text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user uuid;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT user_id INTO v_user FROM prepper_profiles WHERE id = p_prepper;

  UPDATE prepper_profiles SET
    status         = p_status,
    verified       = (p_status = 'approved'),
    reviewed_by    = auth.uid(),
    reviewed_at    = now(),
    rejection_note = CASE WHEN p_status = 'rejected' THEN p_note ELSE null END
  WHERE id = p_prepper;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prepper not found'; END IF;

  IF p_status = 'approved' THEN
    PERFORM notify(v_user, 'approved',
      'You''re now a Preppa! 🎉',
      'Your kitchen is approved. Add your first meal and start taking orders.',
      jsonb_build_object('prepper_id', p_prepper));
  ELSIF p_status = 'rejected' THEN
    PERFORM notify(v_user, 'rejected',
      'Application update',
      COALESCE(p_note, 'Your prepper application was not approved at this time. Contact support for details.'),
      jsonb_build_object('prepper_id', p_prepper));
  END IF;
END;
$$;

-- ── 2. Notify prepper of new order ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_notify_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prepper_user uuid;
BEGIN
  SELECT user_id INTO v_prepper_user FROM prepper_profiles WHERE id = NEW.prepper_id;
  PERFORM notify(
    v_prepper_user,
    'order',
    'New order · $' || ROUND(COALESCE(NEW.total, 0)::numeric, 2)::text,
    'A customer just placed an order. Confirm it to get started.',
    jsonb_build_object('order_id', NEW.id, 'total', NEW.total)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_order ON orders;
CREATE TRIGGER notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_notify_new_order();

-- ── 3. Notify customer on order status change ────────────────────────────────
CREATE OR REPLACE FUNCTION trg_notify_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title text;
  v_body  text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN
      v_title := 'Order confirmed ✓';
      v_body  := 'Your prepper confirmed your order and is getting started.';
    WHEN 'preparing' THEN
      v_title := 'Your meal is being prepared';
      v_body  := 'Your prepper is cooking right now.';
    WHEN 'ready' THEN
      v_title := 'Order ready!';
      v_body  := 'Your meal is ready for pickup or handoff.';
    WHEN 'completed' THEN
      v_title := 'Order complete 🙌';
      v_body  := 'Enjoy your meal! Tap to leave a review.';
    WHEN 'cancelled' THEN
      v_title := 'Order cancelled';
      v_body  := 'Your order was cancelled. Check your payment for any refund.';
    ELSE
      RETURN NEW;
  END CASE;

  PERFORM notify(
    NEW.customer_id,
    'order',
    v_title,
    v_body,
    jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_order_status ON orders;
CREATE TRIGGER notify_order_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_notify_order_status();
