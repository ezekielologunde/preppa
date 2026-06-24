-- ── 004 event_processor_webhook ───────────────────────────────────────────────
-- pg_net webhook dispatch on every domain_events INSERT.
-- Requires pg_net extension (pre-installed on Supabase).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.dispatch_to_event_processor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service_role_key TEXT;
  v_event_processor_url TEXT :=
    'https://nfwfnnfbikjxwflpmsnu.supabase.co/functions/v1/event-processor';
BEGIN
  -- Read the service-role key from vault (set once via Supabase dashboard).
  -- Falls back to empty string so the trigger never hard-errors.
  BEGIN
    SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'SERVICE_ROLE_KEY'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_role_key := '';
  END;

  PERFORM net.http_post(
    url     := v_event_processor_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
    ),
    body    := jsonb_build_object(
      'event_id',      NEW.id,
      'event_type',    NEW.event_type,
      'aggregate_type', NEW.aggregate_type,
      'aggregate_id',  NEW.aggregate_id,
      'actor_id',      NEW.actor_id,
      'payload',       NEW.payload,
      'version',       NEW.version,
      'occurred_at',   NEW.occurred_at
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_domain_event_insert
  AFTER INSERT ON public.domain_events
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_to_event_processor();
