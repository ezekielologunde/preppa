-- ── 015 admin_dashboard_api ───────────────────────────────────────────────────
-- Composite admin_get_dashboard RPC returns the full Operations Control Plane
-- snapshot in a single call. All sub-queries read from projection tables or
-- health singletons — NO expensive transactional queries, NO full table scans.

CREATE OR REPLACE FUNCTION public.admin_get_dashboard()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT jsonb_build_object(

    -- Platform health singleton (updated every minute by pg_cron)
    'platform_health', (
      SELECT row_to_json(h) FROM public.platform_health_metrics h WHERE id = 1
    ),

    -- Platform metrics singleton
    'platform_metrics', (
      SELECT row_to_json(m) FROM public.platform_metrics m WHERE id = 1
    ),

    -- Latest observability snapshot
    'latest_snapshot', (
      SELECT row_to_json(s)
      FROM public.metrics_snapshots s
      ORDER BY snapped_at DESC LIMIT 1
    ),

    -- Open alerts
    'open_alerts', (
      SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.triggered_at DESC), '[]')
      FROM public.active_alerts a WHERE a.resolved_at IS NULL
    ),

    -- Live orders by status (from orders table — indexed, not a full scan)
    'orders_by_status', (
      SELECT jsonb_object_agg(status, cnt)
      FROM (
        SELECT status::TEXT, COUNT(*) AS cnt
        FROM public.orders
        WHERE status IN ('pending','confirmed','preparing','ready','in_transit')
        GROUP BY status
      ) t
    ),

    -- Kitchen status distribution
    'kitchen_status_counts', (
      SELECT jsonb_object_agg(
        COALESCE(status_override::TEXT, 'auto_computed'),
        cnt
      )
      FROM (
        SELECT status_override, COUNT(*) AS cnt
        FROM public.kitchens
        GROUP BY status_override
      ) t
    ),

    -- Dead letter queue (top 20 unresolved, newest first)
    'dead_letter_queue', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',         d.id,
          'event_id',   d.event_id,
          'event_type', d.event_type,
          'final_error', d.final_error,
          'attempt_count', d.attempt_count,
          'failed_at',  d.failed_at
        ) ORDER BY d.failed_at DESC
      ), '[]')
      FROM public.event_dead_letters d
      WHERE d.resolved_at IS NULL
      LIMIT 20
    ),

    -- Retry queue depth breakdown by retry count
    'retry_queue', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'event_id',      epl.event_id,
          'event_type',    epl.event_type,
          'attempt_count', epl.attempt_count,
          'next_attempt_at', epl.next_attempt_at
        ) ORDER BY epl.next_attempt_at ASC
      ), '[]')
      FROM public.event_processing_log epl
      WHERE epl.status = 'pending_retry'
      LIMIT 50
    ),

    -- Projection lag (from latest snapshot)
    'projection_health', (
      SELECT jsonb_build_object(
        'p50_lag_ms', s.p50_projection_lag_ms,
        'p95_lag_ms', s.p95_projection_lag_ms,
        'event_throughput_per_min', s.event_throughput_per_min,
        'snapped_at', s.snapped_at
      )
      FROM public.metrics_snapshots s
      ORDER BY snapped_at DESC LIMIT 1
    ),

    -- Recent payments requiring attention (escrow + failed)
    'payments_attention', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',           p.id,
          'order_id',     p.order_id,
          'status',       p.status,
          'amount_pence', p.amount_pence,
          'created_at',   p.created_at
        ) ORDER BY p.created_at DESC
      ), '[]')
      FROM public.payments p
      WHERE p.status IN ('in_escrow', 'failed')
      LIMIT 50
    ),

    -- Escrow summary
    'escrow_summary', (
      SELECT jsonb_build_object(
        'count',       COUNT(*),
        'total_pence', SUM(amount_pence)
      )
      FROM public.payments WHERE status = 'in_escrow'
    ),

    -- Unread notification queue depth
    'notification_queue', (
      SELECT jsonb_build_object(
        'unread_count', COUNT(*),
        'oldest_unread', MIN(created_at)
      )
      FROM public.notifications WHERE NOT read
    ),

    -- Storage pipeline status
    'storage_status', (
      SELECT jsonb_build_object(
        'pending',     COUNT(*) FILTER (WHERE pipeline_status = 'pending'),
        'validating',  COUNT(*) FILTER (WHERE pipeline_status = 'validating'),
        'processing',  COUNT(*) FILTER (WHERE pipeline_status = 'processing'),
        'quarantined', COUNT(*) FILTER (WHERE pipeline_status = 'quarantined')
      )
      FROM public.media_objects
      WHERE pipeline_status NOT IN ('ready', 'rejected')
    ),

    -- Recent critical security events (last 24h)
    'security_events', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',          se.id,
          'event_type',  se.event_type,
          'actor_id',    se.actor_id,
          'severity',    se.severity,
          'occurred_at', se.occurred_at
        ) ORDER BY se.occurred_at DESC
      ), '[]')
      FROM public.security_events se
      WHERE se.severity IN ('warn', 'critical')
        AND se.occurred_at >= NOW() - INTERVAL '24 hours'
      LIMIT 100
    ),

    -- Accounts under review (risk_score >= 500)
    'abuse_review_queue', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'user_id',            rs.user_id,
          'score',              rs.score,
          'signals_count',      rs.signals_count,
          'review_required_at', rs.review_required_at,
          'frozen_at',          rs.frozen_at
        ) ORDER BY rs.score DESC
      ), '[]')
      FROM public.risk_scores rs
      WHERE rs.review_required_at IS NOT NULL
      LIMIT 50
    ),

    -- Frozen accounts
    'frozen_accounts', (
      SELECT COUNT(*) FROM public.risk_scores WHERE frozen_at IS NOT NULL
    ),

    -- Feature flags overview
    'feature_flags', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',                  ff.id,
          'key',                 ff.key,
          'name',                ff.name,
          'enabled',             ff.enabled,
          'global_rollout_pct',  ff.global_rollout_pct,
          'kill_switch',         ff.kill_switch,
          'expires_at',          ff.expires_at
        ) ORDER BY ff.created_at DESC
      ), '[]')
      FROM public.feature_flags ff
      WHERE ff.deleted_at IS NULL
    ),

    -- Recent audit activity (last 50 entries)
    'recent_audit', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',           al.id,
          'actor_id',     al.actor_id,
          'action',       al.action,
          'resource_type', al.resource_type,
          'resource_id',  al.resource_id,
          'created_at',   al.created_at
        ) ORDER BY al.created_at DESC
      ), '[]')
      FROM public.audit_logs al
      ORDER BY al.created_at DESC
      LIMIT 50
    ),

    -- Recent admin actions (last 50)
    'recent_admin_actions', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',           aal.id,
          'admin_id',     aal.admin_id,
          'action_type',  aal.action_type,
          'target_type',  aal.target_type,
          'target_id',    aal.target_id,
          'reason',       aal.reason,
          'reversible',   aal.reversible,
          'reversed_at',  aal.reversed_at,
          'created_at',   aal.created_at
        ) ORDER BY aal.created_at DESC
      ), '[]')
      FROM public.admin_action_log aal
      ORDER BY aal.created_at DESC
      LIMIT 50
    ),

    'generated_at', NOW()

  ) INTO v_result;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard() TO authenticated;

-- Thin helpers for scoped dashboard sections (for tab-specific refreshes)

CREATE OR REPLACE FUNCTION public.admin_get_prepper_health(p_limit INTEGER DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'prepper_id',        pm.prepper_id,
        'total_orders',      pm.total_orders,
        'total_revenue_pence', pm.total_revenue_pence,
        'cancelled_orders',  pm.cancelled_orders,
        'completion_rate',   pm.completion_rate,
        'average_rating',    pm.average_rating,
        'last_order_at',     pm.last_order_at,
        'kitchen_verified',  k.verified_at IS NOT NULL,
        'health_score',      k.health_score
      ) ORDER BY pm.total_orders DESC
    ), '[]')
    FROM public.prepper_metrics pm
    JOIN public.kitchens k ON k.prepper_id = pm.prepper_id
    LIMIT p_limit
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_prepper_health(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_customer_health(p_limit INTEGER DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'customer_id',           cm.customer_id,
        'total_orders',          cm.total_orders,
        'lifetime_value_pence',  cm.lifetime_value_pence,
        'cancelled_orders',      cm.cancelled_orders,
        'first_order_at',        cm.first_order_at,
        'last_order_at',         cm.last_order_at,
        'risk_score',            rs.score,
        'frozen',                rs.frozen_at IS NOT NULL
      ) ORDER BY cm.lifetime_value_pence DESC
    ), '[]')
    FROM public.customer_metrics cm
    LEFT JOIN public.risk_scores rs ON rs.user_id = cm.customer_id
    LIMIT p_limit
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_customer_health(INTEGER) TO authenticated;
