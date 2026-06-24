-- ── 023 payment_operations ────────────────────────────────────────────────────
-- F-02: Crash-safe refund flow via DB-first state machine.
--
-- Problem: edge fn called Stripe THEN wrote DB. Crash between the two causes
-- the payment row to remain 'captured', so the next retry double-refunds.
--
-- Fix: DB write happens BEFORE Stripe call. Stripe idempotency key is stored
-- in the ledger row. Recovery worker detects stale pending ops and alerts.
-- Stripe's 24-hour idempotency window prevents duplicate charges on retry.

-- ── Ledger table ──────────────────────────────────────────────────────────────

CREATE TABLE public.payment_operations (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id             UUID        NOT NULL REFERENCES public.payments(id),
  operation_type         TEXT        NOT NULL
    CHECK (operation_type IN ('authorize','capture','refund','release','reversal','retry','failure')),
  initiated_by           UUID        REFERENCES auth.users(id),  -- NULL for system/cron ops
  initiated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                 TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  -- Stripe integration
  stripe_idempotency_key TEXT        UNIQUE,   -- prevents duplicate Stripe calls
  stripe_refund_id       TEXT,                 -- populated after Stripe responds
  stripe_transfer_id     TEXT,
  -- Amounts always derived from DB; never from caller
  amount_pence           INTEGER     NOT NULL,
  currency               TEXT        NOT NULL DEFAULT 'gbp',
  -- State transition timestamps
  completed_at           TIMESTAMPTZ,
  failed_at              TIMESTAMPTZ,
  failure_reason         TEXT,
  -- Metadata
  reason                 TEXT        NOT NULL,
  metadata               JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX payment_ops_payment_type_status_idx
  ON public.payment_operations (payment_id, operation_type, status);

CREATE INDEX payment_ops_idempotency_key_idx
  ON public.payment_operations (stripe_idempotency_key)
  WHERE stripe_idempotency_key IS NOT NULL;

-- Partial index: fast scan for the recovery worker
CREATE INDEX payment_ops_pending_initiated_idx
  ON public.payment_operations (status, initiated_at)
  WHERE status = 'pending';

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_operations ENABLE ROW LEVEL SECURITY;

-- No direct client access; admins may SELECT for reconciliation dashboards
CREATE POLICY payment_ops_admin_read ON public.payment_operations
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY payment_ops_service_role ON public.payment_operations
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── Append-only: block DELETE; UPDATE is allowed for status transitions ───────

CREATE TRIGGER payment_operations_no_delete
  BEFORE DELETE ON public.payment_operations
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- ── Internal: begin a refund operation (DB write BEFORE Stripe call) ──────────
-- Acquires FOR UPDATE on the payment row so concurrent calls serialize.
-- Returns existing pending/processing op on duplicate call (idempotent).

CREATE OR REPLACE FUNCTION public._begin_refund_operation(
  p_order_id UUID,
  p_reason   TEXT,
  p_admin_id UUID
)
RETURNS public.payment_operations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment  public.payments%ROWTYPE;
  v_op       public.payment_operations%ROWTYPE;
  v_idem_key TEXT;
BEGIN
  -- Lock payment row first — DB is source of truth
  SELECT * INTO v_payment FROM public.payments
  WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  IF v_payment.status NOT IN ('captured', 'in_escrow') THEN
    RAISE EXCEPTION 'payment_not_refundable: status=%', v_payment.status;
  END IF;

  -- Idempotency: return any in-flight or completed refund op for this payment
  SELECT * INTO v_op FROM public.payment_operations
  WHERE payment_id    = v_payment.id
    AND operation_type = 'refund'
    AND status IN ('pending', 'processing', 'completed');

  IF FOUND THEN
    IF v_op.status = 'completed' THEN
      RAISE EXCEPTION 'already_refunded: operation_id=%', v_op.id;
    END IF;
    -- Caller can use the existing idempotency key to retry Stripe safely
    RETURN v_op;
  END IF;

  v_idem_key := 'refund_' || p_order_id::TEXT;

  INSERT INTO public.payment_operations (
    payment_id, operation_type, initiated_by, status,
    stripe_idempotency_key, amount_pence, currency, reason
  ) VALUES (
    v_payment.id, 'refund', p_admin_id, 'pending',
    v_idem_key, v_payment.amount_pence, v_payment.currency, p_reason
  ) RETURNING * INTO v_op;

  RETURN v_op;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._begin_refund_operation(UUID, TEXT, UUID) FROM PUBLIC;

-- ── Internal: mark refund complete after Stripe confirms ──────────────────────

CREATE OR REPLACE FUNCTION public._complete_refund_operation(
  p_operation_id   UUID,
  p_stripe_refund_id TEXT,
  p_order_id       UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payment_operations SET
    status           = 'completed',
    stripe_refund_id = p_stripe_refund_id,
    completed_at     = NOW()
  WHERE id = p_operation_id
    AND status IN ('pending', 'processing');

  UPDATE public.payments SET
    status      = 'refunded',
    refunded_at = NOW(),
    updated_at  = NOW()
  WHERE order_id = p_order_id;

  UPDATE public.orders SET
    status     = 'refunded',
    updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._complete_refund_operation(UUID, TEXT, UUID) FROM PUBLIC;

-- ── Internal: mark refund failed after Stripe error ───────────────────────────
-- payments row is NOT touched — status stays 'captured', retry is safe.

CREATE OR REPLACE FUNCTION public._fail_refund_operation(
  p_operation_id UUID,
  p_reason       TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payment_operations SET
    status         = 'failed',
    failed_at      = NOW(),
    failure_reason = p_reason
  WHERE id = p_operation_id
    AND status IN ('pending', 'processing');
END;
$$;
REVOKE EXECUTE ON FUNCTION public._fail_refund_operation(UUID, TEXT) FROM PUBLIC;

-- ── Public: begin a refund — returns data for the edge fn to call Stripe ──────
-- Replaces the old admin_refund_order that did all work in one shot.
-- The edge fn calls Stripe AFTER this returns; then calls admin_complete_refund.

CREATE OR REPLACE FUNCTION public.admin_refund_order(
  p_order_id     UUID,
  p_reason       TEXT,
  p_operation_id UUID DEFAULT NULL   -- provided on retry so we skip re-creation
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op        public.payment_operations%ROWTYPE;
  v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  IF NOT public._consume_admin_quota('refund') THEN
    RAISE EXCEPTION 'refund_quota_exceeded: max % refunds per hour', public._admin_refund_cap();
  END IF;

  IF p_operation_id IS NOT NULL THEN
    -- Retry path: fetch existing operation under lock
    SELECT * INTO v_op FROM public.payment_operations
    WHERE id = p_operation_id AND operation_type = 'refund' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
  ELSE
    SELECT * INTO v_op
    FROM public._begin_refund_operation(p_order_id, p_reason, auth.uid());
  END IF;

  SELECT public._admin_record(
    'refund_order', 'order', p_order_id, p_reason,
    jsonb_build_object(
      'payment_id',      v_op.payment_id,
      'operation_id',    v_op.id,
      'amount_pence',    v_op.amount_pence,
      'idempotency_key', v_op.stripe_idempotency_key
    ),
    FALSE, 'payment.refund_initiated'
  ) INTO v_action_id;

  RETURN jsonb_build_object(
    'operation_id',    v_op.id,
    'idempotency_key', v_op.stripe_idempotency_key,
    'amount_pence',    v_op.amount_pence,
    'stripe_refund_id', v_op.stripe_refund_id,  -- non-null if already completed
    'status',          v_op.status
  );
END;
$$;
-- Replaces the old signature (UUID, TEXT) — old callers pass NULL for the new arg
GRANT EXECUTE ON FUNCTION public.admin_refund_order(UUID, TEXT, UUID) TO authenticated;

-- ── Public: edge fn calls this after Stripe confirms ─────────────────────────

CREATE OR REPLACE FUNCTION public.admin_complete_refund(
  p_operation_id     UUID,
  p_stripe_refund_id TEXT,
  p_order_id         UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  PERFORM public._complete_refund_operation(p_operation_id, p_stripe_refund_id, p_order_id);

  PERFORM public._admin_record(
    'complete_refund', 'order', p_order_id,
    'stripe refund confirmed',
    jsonb_build_object(
      'operation_id',      p_operation_id,
      'stripe_refund_id',  p_stripe_refund_id
    ),
    FALSE, 'payment.admin_refunded'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_complete_refund(UUID, TEXT, UUID) TO authenticated;

-- ── Public: edge fn calls this after Stripe returns an error ─────────────────

CREATE OR REPLACE FUNCTION public.admin_fail_refund(
  p_operation_id UUID,
  p_reason       TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  PERFORM public._fail_refund_operation(p_operation_id, p_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_fail_refund(UUID, TEXT) TO authenticated;

-- ── Recovery worker: pg_cron detects pending ops older than 10 minutes ────────
-- Transitions them to 'processing' and fires a critical security event so
-- the admin console or an automated webhook can trigger a retry.

CREATE OR REPLACE FUNCTION public.recover_stale_payment_operations()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op    public.payment_operations%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  FOR v_op IN
    SELECT * FROM public.payment_operations
    WHERE operation_type = 'refund'
      AND status         = 'pending'
      AND initiated_at   < NOW() - INTERVAL '10 minutes'
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.payment_operations
      SET status = 'processing'
    WHERE id = v_op.id;

    PERFORM public.emit_security_event(
      'stale_payment_operation_detected',
      v_op.initiated_by,
      NULL,
      'critical',
      jsonb_build_object(
        'operation_id',   v_op.id,
        'operation_type', v_op.operation_type,
        'age_minutes',    EXTRACT(EPOCH FROM (NOW() - v_op.initiated_at)) / 60
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recover_stale_payment_operations() FROM PUBLIC;

-- ── pg_cron: run recovery worker every 5 minutes ─────────────────────────────
-- Idempotent insert — skips if the job already exists.

INSERT INTO cron.job (schedule, command, nodename, nodeport, database, username)
SELECT
  '*/5 * * * *',
  'SELECT public.recover_stale_payment_operations()',
  'localhost',
  5432,
  current_database(),
  current_user
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job
  WHERE command LIKE '%recover_stale_payment_operations%'
);
