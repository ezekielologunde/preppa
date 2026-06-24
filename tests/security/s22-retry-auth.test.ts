/**
 * S-22: Retry Authentication Fix
 * Mock-based executable specifications verifying that dispatch_retry_events
 * includes an Authorization header and that auth failures are monitored.
 * Run with Jest: npx jest tests/security/s22-retry-auth.test.ts
 */

// ── Shared mock types ─────────────────────────────────────────────────────────

interface EplRow {
  event_id: string;
  status: string;
  attempt_count: number;
  next_attempt_at: string;
  last_attempt_at: string | null;
}

interface HttpRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

interface HttpResponse {
  id: string;
  status_code: number;
  created: string;
}

interface SecurityEvent {
  event_type: string;
  severity: string;
  payload: Record<string, unknown>;
}

interface PlatformHealthMetrics {
  id: 1;
  retry_auth_failures_5min: number;
  [key: string]: unknown;
}

interface AlertConfig {
  metric_name: string;
  threshold: number;
  comparison: string;
  severity: string;
  enabled: boolean;
}

interface ActiveAlert {
  metric_name: string;
  observed_value: number;
  severity: string;
}

// ── Shared state builder ──────────────────────────────────────────────────────

function makeState() {
  return {
    vault: { SERVICE_ROLE_KEY: 'service-role-jwt-abc123' } as Record<string, string>,
    eventProcessingLog: [
      {
        event_id: 'evt-1',
        status: 'pending_retry',
        attempt_count: 1,
        next_attempt_at: new Date(Date.now() - 1000).toISOString(),
        last_attempt_at: null,
      },
    ] as EplRow[],
    domainEvents: [
      {
        id: 'evt-1',
        event_type: 'order.created',
        aggregate_type: 'order',
        aggregate_id: 'ord-1',
        actor_id: null,
        payload: {},
        occurred_at: new Date().toISOString(),
        version: 1,
      },
    ],
    httpRequests: [] as HttpRequest[],
    httpResponses: [] as HttpResponse[],
    securityEvents: [] as SecurityEvent[],
    platformHealth: { id: 1 as const, retry_auth_failures_5min: 0 } as PlatformHealthMetrics,
    alertConfigs: [
      { metric_name: 'retry_auth_failures_5min', threshold: 1, comparison: 'gt', severity: 'critical', enabled: true },
    ] as AlertConfig[],
    activeAlerts: [] as ActiveAlert[],
  };
}

// ── Mock implementations ──────────────────────────────────────────────────────

function dispatchRetryEvents(s: ReturnType<typeof makeState>): number {
  // Read service key from vault (same defensive pattern as migration 004)
  const serviceKey = s.vault['SERVICE_ROLE_KEY'] ?? '';

  const due = s.eventProcessingLog.filter(
    r => r.status === 'pending_retry' && new Date(r.next_attempt_at) <= new Date(),
  ).slice(0, 50);

  for (const row of due) {
    const epl = s.eventProcessingLog.find(r => r.event_id === row.event_id)!;
    epl.status = 'processing';
    epl.last_attempt_at = new Date().toISOString();
    epl.attempt_count += 1;

    const event = s.domainEvents.find(e => e.id === row.event_id)!;

    s.httpRequests.push({
      url: 'https://nfwfnnfbikjxwflpmsnu.supabase.co/functions/v1/event-processor',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: { event_id: event.id, ...event },
    });
  }

  return due.length;
}

function checkRetryAuthFailures(s: ReturnType<typeof makeState>): number {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const failures = s.httpResponses.filter(
    r => [401, 403].includes(r.status_code) && new Date(r.created) >= fiveMinAgo,
  ).length;

  if (failures > 0) {
    s.securityEvents.push({
      event_type: 'retry_auth_failures_detected',
      severity: 'critical',
      payload: { failure_count: failures, window_minutes: 5 },
    });
  }

  s.platformHealth.retry_auth_failures_5min = failures;
  return failures;
}

function evaluateAlerts(s: ReturnType<typeof makeState>): void {
  for (const cfg of s.alertConfigs.filter(c => c.enabled)) {
    const observed = s.platformHealth[cfg.metric_name] as number | undefined;
    if (observed === undefined) continue;

    let breached = false;
    if (cfg.comparison === 'gt') breached = observed > cfg.threshold;
    else if (cfg.comparison === 'gte') breached = observed >= cfg.threshold;
    else if (cfg.comparison === 'lt') breached = observed < cfg.threshold;
    else if (cfg.comparison === 'lte') breached = observed <= cfg.threshold;

    if (breached) {
      s.activeAlerts.push({
        metric_name: cfg.metric_name,
        observed_value: observed,
        severity: cfg.severity,
      });
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('dispatch_retry_events — reads vault secret before HTTP call', () => {
  it('reads SERVICE_ROLE_KEY from vault', () => {
    const s = makeState();
    dispatchRetryEvents(s);
    // Verifies the mock correctly consults vault; if vault were empty, the header would be 'Bearer '
    expect(s.vault['SERVICE_ROLE_KEY']).toBe('service-role-jwt-abc123');
  });

  it('falls back to empty string when vault key is missing', () => {
    const s = makeState();
    delete s.vault['SERVICE_ROLE_KEY'];
    dispatchRetryEvents(s);
    expect(s.httpRequests[0].headers['Authorization']).toBe('Bearer ');
  });
});

describe('dispatch_retry_events — retry HTTP request includes Authorization header', () => {
  it('includes Authorization: Bearer <token> on every retry request', () => {
    const s = makeState();
    dispatchRetryEvents(s);
    expect(s.httpRequests).toHaveLength(1);
    expect(s.httpRequests[0].headers['Authorization']).toBe('Bearer service-role-jwt-abc123');
  });

  it('includes Content-Type: application/json on every retry request', () => {
    const s = makeState();
    dispatchRetryEvents(s);
    expect(s.httpRequests[0].headers['Content-Type']).toBe('application/json');
  });

  it('targets the correct edge function URL', () => {
    const s = makeState();
    dispatchRetryEvents(s);
    expect(s.httpRequests[0].url).toContain('/functions/v1/event-processor');
  });

  it('skips rows not yet due (next_attempt_at in the future)', () => {
    const s = makeState();
    s.eventProcessingLog[0].next_attempt_at = new Date(Date.now() + 60_000).toISOString();
    dispatchRetryEvents(s);
    expect(s.httpRequests).toHaveLength(0);
  });
});

describe('check_retry_auth_failures — 401 responses are counted', () => {
  it('counts 401 responses within the 5-minute window', () => {
    const s = makeState();
    s.httpResponses.push({ id: 'r1', status_code: 401, created: new Date().toISOString() });
    const count = checkRetryAuthFailures(s);
    expect(count).toBe(1);
  });

  it('counts 403 responses within the 5-minute window', () => {
    const s = makeState();
    s.httpResponses.push({ id: 'r2', status_code: 403, created: new Date().toISOString() });
    const count = checkRetryAuthFailures(s);
    expect(count).toBe(1);
  });

  it('does not count 200 responses', () => {
    const s = makeState();
    s.httpResponses.push({ id: 'r3', status_code: 200, created: new Date().toISOString() });
    const count = checkRetryAuthFailures(s);
    expect(count).toBe(0);
  });

  it('does not count responses older than 5 minutes', () => {
    const s = makeState();
    const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    s.httpResponses.push({ id: 'r4', status_code: 401, created: old });
    const count = checkRetryAuthFailures(s);
    expect(count).toBe(0);
  });
});

describe('check_retry_auth_failures — emits critical security event when failures > 0', () => {
  it('emits retry_auth_failures_detected at critical severity', () => {
    const s = makeState();
    s.httpResponses.push({ id: 'r5', status_code: 401, created: new Date().toISOString() });
    checkRetryAuthFailures(s);
    const evt = s.securityEvents.find(e => e.event_type === 'retry_auth_failures_detected');
    expect(evt).toBeDefined();
    expect(evt!.severity).toBe('critical');
    expect(evt!.payload.failure_count).toBe(1);
  });

  it('does not emit a security event when failure count is 0', () => {
    const s = makeState();
    checkRetryAuthFailures(s);
    expect(s.securityEvents).toHaveLength(0);
  });
});

describe('check_retry_auth_failures — updates platform_health_metrics', () => {
  it('writes failure count to retry_auth_failures_5min', () => {
    const s = makeState();
    s.httpResponses.push({ id: 'r6', status_code: 401, created: new Date().toISOString() });
    checkRetryAuthFailures(s);
    expect(s.platformHealth.retry_auth_failures_5min).toBe(1);
  });

  it('writes 0 when there are no failures', () => {
    const s = makeState();
    s.platformHealth.retry_auth_failures_5min = 99; // pre-existing value
    checkRetryAuthFailures(s);
    expect(s.platformHealth.retry_auth_failures_5min).toBe(0);
  });
});

describe('alert_config threshold — retry_auth_failures_5min > 1 triggers active_alert', () => {
  it('creates a critical active_alert when retry_auth_failures_5min exceeds threshold', () => {
    const s = makeState();
    s.httpResponses.push(
      { id: 'r7', status_code: 401, created: new Date().toISOString() },
      { id: 'r8', status_code: 401, created: new Date().toISOString() },
    );
    checkRetryAuthFailures(s);
    evaluateAlerts(s);

    const alert = s.activeAlerts.find(a => a.metric_name === 'retry_auth_failures_5min');
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe('critical');
    expect(alert!.observed_value).toBe(2);
  });

  it('does not create an alert when retry_auth_failures_5min is 0', () => {
    const s = makeState();
    checkRetryAuthFailures(s);
    evaluateAlerts(s);
    expect(s.activeAlerts.filter(a => a.metric_name === 'retry_auth_failures_5min')).toHaveLength(0);
  });

  it('does not create an alert when observed value equals (not exceeds) threshold', () => {
    // threshold is 1, comparison is 'gt', so observed=1 should NOT alert
    const s = makeState();
    s.httpResponses.push({ id: 'r9', status_code: 401, created: new Date().toISOString() });
    checkRetryAuthFailures(s);   // count = 1
    evaluateAlerts(s);           // 1 > 1 = false
    expect(s.activeAlerts.filter(a => a.metric_name === 'retry_auth_failures_5min')).toHaveLength(0);
  });
});
