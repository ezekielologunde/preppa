# Threat Model — Sprint 10 Parts 5 & 6: Object Storage Hardening + Chaos Testing

**Author:** Principal Security Engineer / Red Team Lead
**Date:** 2026-06-22
**Scope:** New `upload-pipeline` edge fn (`verify_jwt=true`), `media_objects`, `user_storage_quotas`, and the validation pipeline (extension → magic byte → MIME → size → quota → filename sanitize → SHA-256 dedup → EXIF strip → final move). Grounded against existing `event-processor`, `_shared/security.ts`, `domain_events`, `event_processing_log`, `event_dead_letters`.

---

## 1. Trust Boundaries

| # | Boundary | Direction | Trust assumption | Enforcement point |
|---|----------|-----------|------------------|-------------------|
| TB-1 | Mobile/web client → `upload-pipeline` edge fn | Untrusted → semi-trusted | JWT proves identity only; payload (sha256, content_type, size, path) is attacker-controlled | `verify_jwt=true` + `getUser()` + server-side re-derivation |
| TB-2 | Client → Supabase Storage `listing-photos` (direct upload) | Untrusted → storage | TODAY: zero server validation. Bytes land in public bucket before pipeline runs | Storage RLS policy on `temp/{uid}/` prefix; bucket made private |
| TB-3 | `upload-pipeline` (service role) → `media_objects` / `user_storage_quotas` | Privileged | Edge fn holds service role — bypasses all RLS. Single compromised fn = full tenant crossover | SECURITY DEFINER RPCs with explicit `WHERE owner_id = p_actor`, never raw service-role writes |
| TB-4 | `domain_events` → `pg_net` → `event-processor` (`verify_jwt=false`) | Internal | Only `pg_net` trigger should call it; in practice the URL is reachable | `WEBHOOK_SECRET` bearer check (already present, line ~160) |
| TB-5 | `pg_cron` → `dispatch_retry_events` / `refresh_platform_health` | Internal scheduler | Runs as `postgres`; no request context | Job code must be idempotent; lock/skip-if-running |
| TB-6 | Operator → dead-letter replay tooling | Trusted-but-fallible | Human can double-fire a replay | Replay must dedupe on `event_id` via `event_processing_log` unique constraint |
| TB-7 | Presigned download URL → public internet | Storage → anyone with URL | URL = bearer capability; leaks bypass RLS entirely | Short TTL, scoped object, private bucket |

**Key insight:** TB-2 is the gap. Until the bucket is private and a `temp/{uid}/` RLS policy exists, the pipeline is *advisory* — an attacker uploads directly and links the public URL, never calling `upload-pipeline`.

---

## 2. Attack Surface Inventory

| Entry point | Auth | Current protection | Residual gap |
|-------------|------|--------------------|--------------|
| `POST upload-pipeline` | JWT (`verify_jwt=true`) | `getUser()`, `readBody` size cap, CORS allowlist | Trusts client sha256/size/path unless re-derived |
| Direct PUT to `listing-photos` | Storage RLS | Bucket is **public** → world-readable; no MIME enforcement | Bypasses pipeline entirely (TB-2) |
| `event-processor` URL | `WEBHOOK_SECRET` | Bearer check, idempotency lock | `verify_jwt=false`; secret in header only |
| `confirm_media_ready` RPC | DB grant | SECURITY DEFINER (proposed) | Must NOT be `GRANT EXECUTE TO authenticated` |
| `reject_media` RPC | DB grant | SECURITY DEFINER (proposed) | Same |
| `begin_upload` RPC | `authenticated` | Issues temp path + quota reservation | TOCTOU on quota (see §4) |
| Presigned GET | URL capability | TTL | Enumeration of object keys (§3) |
| `pg_cron` jobs | none (internal) | scheduler | Overlap under load (§6) |

---

## 3. Storage Attack Scenarios

| Attack | Severity | Pipeline bypass / weakness | Mitigation |
|--------|----------|----------------------------|------------|
| **ZIP bomb** (low-ratio archive, decompresses to GBs) | High | Magic-byte + MIME pass if wrapped as polyglot; pipeline never decompresses, but downstream thumbnailer/AV that *does* OOMs | Reject any file whose magic bytes match `PK\x03\x04` regardless of extension. Cap decompression in AV/thumbnail step (`max-ratio`, `max-output-bytes`). Run image decode in memory-bounded worker. |
| **Polyglot JPEG+ZIP** (valid JPEG header, ZIP central directory appended) | High | Passes magic-byte (`FF D8 FF`), MIME sniff (`image/jpeg`), and even EXIF strip — but the trailing ZIP survives | EXIF/metadata strip must **re-encode** the image (decode→re-encode), not just rewrite headers. Re-encoding discards all trailing bytes. Verify output size sanity. |
| **JPEG w/ PHP/JS in comment (`FFFE`) segment** | Medium | Magic byte + MIME pass; comment payload is inert as image but executes if served by a misconfigured host or rendered as HTML | Re-encode strips `COM`/`APPn` segments. Serve from storage with `Content-Disposition: attachment` style and fixed `Content-Type` from server-derived MIME, never client MIME. CSP `default-src 'none'` on the storage origin. |
| **Double extension `evil.php.jpg`** | Medium | Extension check sees `.jpg` and passes | Sanitize to a server-generated filename: `{media_id}.{ext}` where `ext` is derived from **detected MIME**, not the supplied name. Discard the original filename entirely from the storage path. |
| **HEIC w/ invalid dimensions in metadata** | Medium | Magic/MIME pass; bogus `width×height` causes integer-overflow / huge alloc in decoder ("decompression bomb") | Validate declared dimensions against hard caps (e.g. ≤ 12000×12000, ≤ 100 MP) **before** decode. Use a decoder with pixel-count limits. Reject if declared ≠ actual after decode. |
| **PNG script in `iTXt` chunk** | Medium | Magic (`89 50 4E 47`) + MIME pass; `iTXt`/`tEXt`/`zTXt` carries payload | Re-encode PNG (decode→re-encode) drops ancillary chunks. Allowlist only `IHDR/IDAT/IEND/PLTE/tRNS`. |
| **SVG with JavaScript** (`<script>`, `onload=`) | High | `image/svg+xml` is **not** in the allowlist — but a renamed `.svg` → `.png` could slip if MIME is trusted | Allowlist is jpeg/png/webp/heic/heif **only**; SVG is never accepted. Reject magic-byte `<?xml`/`<svg`. Confirm server-derived MIME ∉ {svg, xml, html}. |
| **HTML disguised as image** | High | If only extension is checked, `page.jpg` containing `<html>` served from public bucket → stored XSS | Magic-byte gate: file must start with a known image signature. Server sets `Content-Type` from detection. Storage origin isolated from app origin (no shared cookies). `X-Content-Type-Options: nosniff`. |
| **Null-byte filename `file.jpg\0.php`** | Medium | C-string truncation in downstream tooling treats it as `.php` | Reject any filename/path containing `\0` (and control chars `\x00-\x1F`). Never use client filename for storage path. |
| **Unicode RTLO spoofing** (`U+202E`, e.g. `gpj.exe` rendered as `exe.jpg`) | Low | Tricks human reviewers / moderation UI | Strip/reject bidi controls `U+202A–202E, U+2066–2069` in stored display name. Storage path is ASCII `{media_id}.{ext}` only. |
| **Path traversal `../../../etc/passwd`** | High | Client-supplied `storage_path` escapes the prefix | Never accept client path. Server constructs `final/{owner_id}/{media_id}.{ext}`. Reject any input containing `..`, leading `/`, or `%2e%2e`. Validate `owner_id == auth.uid()`. |
| **Oversized payload / Content-Length spoof** | Medium | Client lies about size to pass quota; real bytes are larger | Do not trust client `size`. After upload, read **actual** object size from Storage metadata before crediting quota and before move. `readBody` caps the JSON envelope, not the object. |
| **Client-supplied SHA-256 mismatch** | High | Dedup keyed on client hash → attacker claims a known-good hash to alias another user's file, or poisons dedup | **Server recomputes SHA-256** from the uploaded bytes. Client hash is advisory for early-exit only; final `media_objects.sha256` is server-derived. Dedup row references content, ownership row references actor. |
| **Quota bypass via concurrent uploads (TOCTOU)** | High | Two parallel `begin_upload` both read `used < limit`, both reserve | See §4. Atomic `UPDATE ... WHERE used + size <= limit RETURNING` or `SELECT FOR UPDATE`. The existing `checkRateLimit` (count-then-insert) has the identical bug — do not copy it. |
| **Presigned URL abuse** (download w/o pipeline / share temp object) | Medium | Public bucket → any object URL is permanently world-readable | Make bucket **private**; serve via short-TTL signed URLs scoped per object. Temp objects in `temp/{uid}/` deleted after move/expiry. |
| **Storage enumeration** (guess other users' paths) | Medium | If paths are sequential/guessable and bucket public, scrape all media | Private bucket + RLS prefix policy. Paths use unguessable `media_id` (UUID/ULID), not sequential ints. List operations denied to clients. |

---

## 4. Race Condition Analysis

**R-1 Concurrent quota check (quota = 1 slot left).**
Two `begin_upload` calls read `used_bytes` simultaneously, both see room, both reserve → quota overrun.
*Fix:* single atomic statement inside the RPC:
```sql
UPDATE user_storage_quotas
   SET used_bytes = used_bytes + p_size, updated_at = now()
 WHERE user_id = p_actor AND used_bytes + p_size <= quota_bytes
RETURNING used_bytes;
-- 0 rows ⇒ over quota, reject. No SELECT-then-UPDATE.
```
Reserve on `begin_upload`, release on `reject_media`/expiry. Never gate quota in the edge fn (non-transactional).

**R-2 TOCTOU: temp file deleted between upload and validate.**
`begin_upload` → client uploads → another process (expiry sweep, user delete) removes the temp object → validate reads nothing.
*Fix:* validation fetches object + metadata in one read and treats missing-object as a hard `reject_media('temp_missing')`, releasing the reservation. Expiry sweep must skip objects whose `media_objects.pipeline_status='validating'` (status guard, not just age).

**R-3 Duplicate SHA-256 INSERT race.**
Two workers both see "no existing sha256", both INSERT the content row → duplicate or partial-unique violation.
*Fix:* `UNIQUE(sha256)` on the content table + `INSERT ... ON CONFLICT (sha256) DO NOTHING RETURNING id`; if no row returned, `SELECT` the existing id. Ownership/reference is a separate `media_objects` row, so dedup never blocks a second legitimate owner. Mirrors the `event_processing_log` 23505-self-evict pattern already in `event-processor`.

---

## 5. Privilege Escalation Analysis

**P-1 Can a client call `confirm_media_ready` directly?**
Risk: client marks its own un-scanned file `ready`, skipping AV/EXIF.
*Required:* `REVOKE EXECUTE ON confirm_media_ready FROM authenticated, anon;` Only the service-role edge fn (or an internal `postgres`-owned trigger) may call it. RLS on `media_objects` must forbid client UPDATE of `pipeline_status`/`virus_status`.

**P-2 Can a client bypass `reject_media`?**
A client cannot *force* acceptance, but could retry `begin_upload` to leak reservations (quota DoS on self). Reservation must auto-expire (TTL sweep) and `reject_media` must be the only path that flips status away from `validating`, owned by service role.

**P-3 Service-role leak → cross-tenant.**
The edge fn key bypasses RLS (TB-3). A leaked key reads/writes **all** tenants' media + quotas.
*Mitigation:* keep all writes behind SECURITY DEFINER RPCs that take `p_actor` and filter `WHERE owner_id = p_actor`; the edge fn passes `user.id` from the verified JWT, never a client-supplied id. Rotate `SUPABASE_SERVICE_ROLE_KEY`; never ship it to clients; scope edge-fn secrets per function.

**P-4 SECURITY DEFINER `search_path`.**
`seed.sql` currently shows **0** `SET search_path` clauses. A DEFINER function without a pinned path is hijackable via a malicious object in a writable schema on the resolution path.
*Required for every new RPC* (`begin_upload`, `confirm_media_ready`, `reject_media`, `reserve_quota`):
```sql
CREATE FUNCTION ... SECURITY DEFINER SET search_path = public, pg_temp AS $$ ... $$;
```
Also heed the known `my_prepper_id()` NULL-bypass note (memory: RPC registry) — any quota/ownership helper that returns NULL must fail **closed**, never match-all.

---

## 6. Event / Chaos Failure Modes

| Scenario | What breaks | Failure mode | Recoverable? |
|----------|-------------|--------------|--------------|
| 100 duplicate `domain_events` → projection | Same event fan-out 100× | `event_processing_log` UNIQUE(event_id) → 99 self-evict with 23505 → 200 "Already processing". Handlers must also be idempotent (e.g. `listing_stats` upsert `ignoreDuplicates`). `increment_kitchen_orders` is **not** idempotent → over-counts. | Yes for keyed handlers; **No** for counters unless they key on event_id. **FINDING-007.** |
| Network timeout in edge fn after Storage upload but before `media_objects` UPDATE | DB says `validating`, Storage has bytes | Orphan: reserved quota + stranded temp object. | Yes — TTL sweep reconciles `validating` rows older than N min → `reject_media` + quota release + temp delete. |
| Processor crash after quota increment but before `confirm_media_ready` | Quota charged, media not confirmed | Quota leak (user loses space for a file that never went live). | Yes — reconciliation: any `validating` row past TTL releases its reservation. Quota increment and status flip must be in **one** transaction (RPC), not two edge-fn calls. **FINDING-005.** |
| `pg_cron refresh_platform_health` fires under 10k concurrent orders | Heavy aggregate vs OLTP write load | Lock contention / long-running scan starves order writes; if it's a non-concurrent MV refresh it takes an `ACCESS EXCLUSIVE` lock. | Yes — `REFRESH MATERIALIZED VIEW CONCURRENTLY` + advisory lock skip-if-running + off-peak schedule. **FINDING-008.** |
| Operator replays a dead letter twice | `event_dead_letters` row re-dispatched 2× | If replay re-inserts into `event_processing_log`: 23505 on 2nd → safe. If replay path **bypasses** the lock (direct handler call), double-applies non-idempotent handlers. | Conditional — safe only if replay routes through the same INSERT-lock entrypoint. **FINDING-006.** |

---

## 7. Security Findings

> Severity | Component | Description | PoC | Mitigation | Regression Test

**FINDING-001 — Critical — `listing-photos` bucket + direct upload (TB-2).**
Bucket is public and clients upload directly with no server validation, so the pipeline is bypassable: upload `xss.jpg` (HTML body) directly, reference its public URL on a listing.
*PoC:* `curl -X PUT .../listing-photos/temp/me/x.jpg --data-binary @page.html` then load the public URL → HTML/JS served.
*Mitigation:* set bucket private; Storage RLS allows client writes only to `temp/{auth.uid()}/*`; final `final/*` writable by service role only; reads via signed URLs; `listing_photos.url` must reference a `media_objects` row in status `ready`.
*Test:* attempt direct PUT to `final/`; assert 403. Assert public GET of any object returns 400 (bucket private).

**FINDING-002 — High — Client-supplied SHA-256 trusted for dedup.**
Trusting client hash lets an attacker alias a victim's content or poison dedup (`§3`).
*PoC:* call `confirm_media_ready` with a known victim sha256 + attacker bytes.
*Mitigation:* recompute SHA-256 server-side from actual bytes; persist server value in `media_objects.sha256`; client hash advisory only.
*Test:* upload bytes whose real hash ≠ claimed hash → assert reject + stored hash equals recomputed.

**FINDING-003 — High — Metadata strip that does not re-encode (polyglot survival).**
Header-only EXIF strip leaves appended ZIP/script bytes (`§3` polyglot, PNG iTXt).
*PoC:* `cat valid.jpg payload.zip > poly.jpg`; pipeline accepts; trailing ZIP intact.
*Mitigation:* decode→re-encode for every accepted image; verify no trailing bytes after re-encode; cap output size.
*Test:* feed JPEG+ZIP polyglot; assert stored object contains no `PK\x03\x04` and size ≈ re-encoded size.

**FINDING-004 — High — Quota TOCTOU (R-1).**
Concurrent uploads overrun quota.
*PoC:* fire 5 `begin_upload` in parallel with quota = 1 slot → all succeed.
*Mitigation:* atomic conditional `UPDATE ... WHERE used+size<=limit RETURNING` inside the RPC (not edge-fn gating).
*Test:* 50 concurrent reservations against 10-slot quota → exactly 10 succeed.

**FINDING-005 — High — Quota increment and status flip in two separate steps.**
Crash between them leaks quota / strands media (`§6`).
*Mitigation:* single SECURITY DEFINER RPC does increment + status flip transactionally; TTL reconciliation sweep for `validating` orphans.
*Test:* kill processor between steps (fault inject); reconciliation restores quota within TTL.

**FINDING-006 — Medium — Dead-letter replay can double-apply non-idempotent handlers (R, §6).**
*Mitigation:* replay must enter through the `event_processing_log` INSERT-lock entrypoint; never call handlers directly.
*Test:* replay same dead letter twice; assert handler side-effects applied once.

**FINDING-007 — Medium — Non-idempotent projection handlers (`increment_kitchen_orders`).**
Duplicate/replayed `order.created` over-counts daily orders.
*Mitigation:* key counters on `event_id` (insert-once ledger) or guard with `ON CONFLICT DO NOTHING` keyed by `(kitchen_id,date,event_id)`.
*Test:* deliver same `order.created` 100×; assert count increments by 1.

**FINDING-008 — Medium — `pg_cron` heavy refresh contends with OLTP (§6).**
*Mitigation:* `REFRESH MATERIALIZED VIEW CONCURRENTLY` + `pg_try_advisory_lock` skip-if-running + off-peak.
*Test:* run refresh under simulated load; assert order-write p99 within budget and no overlap.

**FINDING-009 — Medium — Privileged RPCs may be `EXECUTE`-able by `authenticated` (P-1/P-2).**
*Mitigation:* `REVOKE EXECUTE ... FROM authenticated, anon` on `confirm_media_ready`, `reject_media`; service-role only.
*Test:* call each as an authenticated JWT (anon key) → assert permission denied.

**FINDING-010 — Medium — New SECURITY DEFINER RPCs lack `SET search_path` (P-4).**
`seed.sql` shows 0 pinned paths.
*Mitigation:* `SET search_path = public, pg_temp` on every new DEFINER fn; helpers fail-closed on NULL owner.
*Test:* static check greps every `SECURITY DEFINER` for a matching `SET search_path`.

**FINDING-011 — Medium — Server-derived MIME / `Content-Type` not enforced on serve (§3 HTML/SVG).**
*Mitigation:* set storage `Content-Type` from detected magic bytes; `X-Content-Type-Options: nosniff`; reject svg/xml/html signatures; isolate storage origin from app origin.
*Test:* upload HTML-as-`.jpg`; assert reject; assert served `Content-Type` never `text/html`.

**FINDING-012 — Low — Filename injection (null byte / traversal / RTLO, §3).**
*Mitigation:* storage path = `final/{owner_id}/{media_id}.{ext}`, ASCII only; reject `\0`, `..`, control + bidi chars.
*Test:* submit `file.jpg\0.php`, `../../x`, RTLO name → all rejected; stored path matches canonical regex.

**FINDING-013 — Low — Decompression / dimension bomb (HEIC/ZIP, §3).**
*Mitigation:* hard caps on declared+actual dimensions and pixel count before decode; bounded-memory decode worker; reject `PK` magic.
*Test:* upload 100000×100000 HEIC header → reject before decode; ZIP-magic file → reject.

---

## 8. Performance Findings

| Hot path | Issue | Action |
|----------|-------|--------|
| Dedup lookup on every upload | Seq scan on content table without index | `UNIQUE`/btree index on `sha256` (also enforces R-3 atomicity). |
| Quota read/update per upload | Row-level contention; full-table scan if unindexed | PK/unique on `user_storage_quotas.user_id`; the atomic `UPDATE ... WHERE` uses it; HOT-update friendly. |
| Reconciliation sweep for orphaned `validating` rows | Full scan of `media_objects` by status+age | Partial index: `(pipeline_status, created_at) WHERE pipeline_status='validating'`. |
| `event_processing_log` lookups (retry/idempotency) | High-frequency by `event_id`/`status`/`next_attempt_at` | Confirm `UNIQUE(event_id)` + index `(status, next_attempt_at)` for `dispatch_retry_events`. |
| Retry amplification | 5 attempts × backoff; a poison batch (e.g. 100 dup events) multiplies edge-fn invocations and Storage reads | Idempotency short-circuit returns 200 *before* handler work; cap concurrent `pg_net` dispatch; dead-letter fast for non-retryable errors (validation rejects are terminal, not retried). |
| EXIF re-encode CPU | Decode/re-encode is the pipeline's most expensive step | Bound per-request CPU/mem; reject oversized dimensions *before* decode (FINDING-013) so cost is gated up front. |

---

## 9. Residual Risks (accept + document)

- **R9-1 AV is signature-based.** `virus_status` catches known malware; a novel polyglot whose payload is inert-as-image but weaponized by a *future* downstream consumer is not detectable here. Re-encode is the real defense; AV is defense-in-depth. *Accepted.*
- **R9-2 Presigned URL forwarding.** A legitimately issued signed URL can be reshared within its TTL. Minimize TTL; cannot prevent voluntary sharing. *Accepted.*
- **R9-3 `event-processor` uses `verify_jwt=false` + shared `WEBHOOK_SECRET`.** Header-secret, not per-message signature. If the secret leaks, events can be forged. Mitigated by network egress + secret rotation; full HMAC-per-event is a future hardening. *Accepted for Sprint 10.*
- **R9-4 Quota reservation leak window.** Crash-orphaned reservations are reclaimed only at TTL expiry, so a user may transiently see reduced quota. *Accepted* given reconciliation bounds it.
- **R9-5 Storage-side image-decode 0-days** in the re-encode library are outside our control; mitigated by bounded-memory worker + dimension caps. *Accepted.*

---

## 10. Production Readiness Assessment

| Gate | Status | Rationale |
|------|--------|-----------|
| G1 — No client bypass of pipeline | **FAIL** | Bucket public + direct upload (FINDING-001) makes pipeline advisory. Blocker. |
| G2 — Server-derived integrity (sha256, size, MIME) | **FAIL** | Client values trusted unless FINDING-002/011 implemented. |
| G3 — Polyglot / embedded-payload defense | **FAIL** | Requires re-encode (FINDING-003); header-strip insufficient. |
| G4 — Quota correctness under concurrency | **FAIL** | TOCTOU (FINDING-004) until atomic UPDATE lands. |
| G5 — Privileged RPC isolation (DEFINER + search_path + grants) | **FAIL** | FINDING-009/010 must ship; `seed.sql` shows 0 pinned paths today. |
| G6 — Event idempotency end-to-end | **PARTIAL** | Lock pattern solid for keyed handlers; counters non-idempotent (FINDING-007); replay path needs lock entry (FINDING-006). |
| G7 — Chaos recoverability (orphans, crashes) | **PARTIAL** | Reconciliation sweep + transactional RPC required (FINDING-005). |
| G8 — `pg_cron` under load | **FAIL** | Non-concurrent refresh contends with OLTP (FINDING-008). |
| G9 — Performance indexes present | **FAIL** | sha256/quota/status/retry indexes not yet defined (§8). |

**Overall: NOT PRODUCTION READY.** Ship-blockers: FINDING-001, -002, -003, -004, -005, -009, -010. Recommended before launch: -006, -007, -008, and §8 indexes. Re-run this model after fixes; G1–G5 must move to PASS before enabling client uploads.
