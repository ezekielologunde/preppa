# Security Incident (Active Attack)

**Severity**: Critical
**Affects**: Platform integrity, user data confidentiality, admin control plane
**MTTR Target**: Containment in 10 minutes; full investigation 24–72 hours

---

## Detection

### Automated Signals
- `active_alerts` fires `security_events` alert (critical severity threshold breached)
- `security_events WHERE severity = 'critical'` count growing
- Unusual spike in `admin_action_log` entries for a single `admin_id`
- Auth events: multiple failed JWT attempts, unusual IP geolocation patterns
- `platform_health_metrics.security_event_count_1h` above baseline

### Manual Checks
```sql
-- Critical security events in last hour
SELECT
  id,
  event_type,
  severity,
  actor_id,
  target_id,
  metadata,
  occurred_at
FROM security_events
WHERE severity = 'critical'
  AND occurred_at > NOW() - INTERVAL '1 hour'
ORDER BY occurred_at DESC;

-- Admin actions in last hour — look for anomalies
SELECT
  admin_id,
  action_type,
  target_id,
  target_type,
  metadata,
  created_at
FROM admin_action_log
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Unusual auth patterns (many failed logins for one user)
SELECT
  user_id,
  action,
  ip_address,
  COUNT(*) AS attempts,
  MAX(created_at) AS last_attempt
FROM auth.audit_log_entries
WHERE created_at > NOW() - INTERVAL '30 minutes'
GROUP BY user_id, action, ip_address
HAVING COUNT(*) > 10
ORDER BY attempts DESC;

-- RLS bypass check: rows visible without proper auth context
-- (Run this from Supabase SQL editor as the postgres role)
SELECT COUNT(*) FROM orders; -- Should be high
SET LOCAL role = anon;
SELECT COUNT(*) FROM orders; -- Should be 0 if RLS is enforcing
RESET role;
```

---

## Immediate Containment (< 5 minutes)

**Containment is time-critical. Execute these steps in order without pausing for investigation.**

1. **Pause all admin actions** — this stops any admin RPC from executing, including any that an attacker may control:
   ```sql
   SELECT admin_pause_all_actions('security_incident_[YYYY-MM-DD]');
   ```

2. **If a specific admin account is compromised** — invalidate their session immediately:
   - Supabase dashboard → Authentication → Users → find the admin user → click "Send password reset" OR
   - Supabase dashboard → Authentication → Users → Ban user temporarily
   ```sql
   -- Record the admin's UUID for audit
   SELECT id, email, created_at FROM auth.users
   WHERE email = '[compromised_admin_email]';
   ```

3. **If RLS bypass is suspected** (an unauthenticated actor is reading/writing rows) — kill API access:
   ```sql
   UPDATE feature_flags
   SET kill_switch = TRUE, updated_at = NOW()
   WHERE flag_key = 'api_access';
   ```
   This is a nuclear option — it disables all API access. Use only if RLS bypass is confirmed.

4. **Do not delete any logs** — every row in `admin_action_log`, `security_events`, `audit_logs` is evidence.

5. **Alert team immediately** — do not handle a security incident alone. Notify engineering lead and legal/compliance.

6. **Isolate the attack vector** — do not attempt to fix the vulnerability while the attacker may still be active.

---

## Impact Assessment

| Scenario | Data at Risk | User Impact |
|----------|-------------|-------------|
| Admin credential compromise | Admin action log, user PII | Admin actions taken by attacker |
| RLS bypass | Orders, payments, user PII | Unauthorized data read |
| Brute-force login | Single account | That user's order/payment history |
| Injection in API | Depends on injection point | Potential bulk data access |
| Insider threat | All data accessible to that admin | Scope matches their access |

**Regulatory consideration**: If user PII (name, email, address) was accessed without authorization, this may trigger GDPR/data breach notification requirements within 72 hours.

---

## Recovery Procedure

### Phase 1 — Scope the breach (0–2 hours)

```sql
-- All actions taken by the suspected actor
SELECT * FROM admin_action_log
WHERE admin_id = '[suspected_admin_id]'
ORDER BY created_at DESC;

-- All data accessed (audit log)
SELECT * FROM audit_logs
WHERE actor_id = '[suspected_id]'
  AND created_at > '[breach_start_estimate]'
ORDER BY created_at;

-- Security events attributed to the actor
SELECT * FROM security_events
WHERE actor_id = '[suspected_id]'
ORDER BY occurred_at DESC;

-- Check if any feature flags were modified
SELECT * FROM admin_action_log
WHERE action_type = 'feature_flag_update'
  AND created_at > '[breach_start_estimate]';
```

### Phase 2 — Remediate the vulnerability
- If compromised credential: force password reset for the admin, rotate Supabase service role key if exposed
- If RLS policy gap: apply a migration to close the gap before restoring API access
- If injection: fix the vulnerable RPC/edge function and redeploy

### Phase 3 — Restore operations
```sql
-- Re-enable API access (if it was killed)
UPDATE feature_flags
SET kill_switch = FALSE, updated_at = NOW()
WHERE flag_key = 'api_access';

-- Resume admin actions only after vulnerability is patched
SELECT admin_resume_all_actions('security_incident_resolved_[YYYY-MM-DD]');
```

### Phase 4 — Verify remediation
```sql
-- Confirm no new critical security events
SELECT COUNT(*) FROM security_events
WHERE severity = 'critical'
  AND occurred_at > NOW() - INTERVAL '30 minutes';
-- Expected: 0

-- Confirm RLS is enforcing correctly
SET LOCAL role = anon;
SELECT COUNT(*) FROM orders; -- Must be 0
SELECT COUNT(*) FROM payments; -- Must be 0
RESET role;
```

### Phase 5 — Preserve evidence
```sql
-- Export a snapshot of all security events from the incident window
SELECT * FROM security_events
WHERE occurred_at BETWEEN '[breach_start]' AND NOW()
ORDER BY occurred_at;
-- Copy this output to a secure document outside the DB
```

---

## Verification

```sql
-- 1. No new critical security events
SELECT COUNT(*) FROM security_events
WHERE severity = 'critical'
  AND occurred_at > NOW() - INTERVAL '30 minutes';
-- Expected: 0

-- 2. Admin actions resumed and logging correctly
SELECT COUNT(*) FROM admin_action_log
WHERE created_at > NOW() - INTERVAL '10 minutes';
-- Non-zero if admins are active post-recovery

-- 3. Compromised account locked
SELECT banned_until, deleted_at FROM auth.users
WHERE id = '[compromised_admin_id]';

-- 4. RLS enforcing (run as anon)
SET LOCAL role = anon;
SELECT COUNT(*) FROM orders;  -- Must be 0
RESET role;

-- 5. Security alert resolved
SELECT alert_name, resolved_at FROM active_alerts
WHERE alert_name = 'security_events';
```

---

## Communication Template

**Do not communicate externally until legal/compliance has reviewed. Internal only during investigation.**

**If breach confirmed and user data was accessed:**
> **[Preppa Security Notice]**
> We recently detected unauthorized access to our systems. We have taken immediate steps to secure the platform.
>
> We are investigating the scope and will notify affected users directly via email within [X] hours with specific details about what information may have been accessed and the steps we are taking.
>
> If you have questions, contact [security@preppa.com].

---

## Postmortem Questions

1. What was the initial attack vector — credential compromise, injection, RLS gap, or insider threat?
2. What is the precise time window of unauthorized access, and what data was read or modified?
3. Were any admin actions taken by the attacker that had real-world side effects (e.g., account suspensions, payment releases)?
4. Does this incident trigger a regulatory notification requirement (GDPR Article 33 — 72-hour clock)?
5. What detection gaps allowed the attack to proceed unnoticed — and for how long?
6. Should the `is_admin()` check be supplemented with MFA enforcement for all admin RPCs?
7. Do we need to rotate all service role keys, JWTs, and Stripe API keys as a precaution?
