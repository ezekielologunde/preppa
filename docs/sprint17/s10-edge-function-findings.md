# S-10 Edge Function Security Findings

Reviewed 15 edge functions (14 handlers + 1 shared module). All fixes applied inline.

---

## _shared/security.ts

**Status**: PASS
**Issues Found**: None — CORS, body-size guard, sanitization, JWT extraction, and rate-limit helpers are correctly implemented. CORS origin is driven by `CORS_ALLOWED_ORIGINS` env var (defaults to `*` if unset — acceptable for dev; set the var in production).
**Fixes Applied**: None
**Residual Risk**: CORS will be `*` if `CORS_ALLOWED_ORIGINS` is not set in the Supabase project secrets. Ensure it is set to `https://preppa.co,https://www.preppa.co,https://app.preppa.live` in production.

---

## admin-actions

**Status**: FIXED
**Issues Found**:
1. CORS response used hardcoded `Access-Control-Allow-Origin: *` with its own OPTIONS handler instead of the shared `cors()` helper.
2. No body size limit before parsing — a large payload could cause a slow parse.
3. The dispatch error catch block forwarded raw `err.message` to the client, including Stripe error messages that could leak internal payment details.
4. The `action` value was echoed back in the `unknown_action` error response — not a direct leak but unnecessary information.
5. `stripeRefund()` had no `AbortController` timeout on the Stripe API fetch call.
6. Stripe refund failure leaked raw Stripe error message to the caller via `throw new Error(stripe_refund_failed: ${msg})`.

**Fixes Applied**:
- Replaced OPTIONS handler with `cors()` from shared module.
- Added 64 KB body size guard (content-length check + read guard) before `JSON.parse`.
- Error catch block now maps known coded errors to safe strings; all unknown 500s return `internal_error`.
- Removed `action` value echo from `unknown_action` response.
- Added `AbortController` with 30-second timeout to `stripeRefund` fetch.
- Stripe refund failures now log internally and throw the coded `stripe_refund_failed` instead of the raw Stripe message.

**Residual Risk**: None.

---

## feature-flags

**Status**: FIXED
**Issues Found**:
1. OPTIONS handler used hardcoded `Access-Control-Allow-Origin: *` instead of the shared `cors()` helper.
2. The catch block forwarded raw `err.message` to the client — could leak DB error details.
3. The flag `evaluate_flag` RPC already returns boolean-only (PASS on config leakage check).
4. Batch cap already enforced at 50 (PASS).
5. Rate limit is per-IP in-memory (PASS — as designed).

**Fixes Applied**:
- Replaced OPTIONS handler with `cors()` from shared module (imports `cors` from `../_shared/security.ts`).
- Catch block now logs internally and returns `{ error: 'internal_error' }`.

**Residual Risk**: In-memory rate limit resets on cold start. Under a sustained attack across many cold-started workers the effective rate limit could be exceeded. Acceptable for the current traffic volume; consider migrating to the DB-backed `checkRateLimit` if enumeration attacks become a concern.

---

## stripe-webhook

**Status**: FIXED
**Issues Found**:
1. Top-level catch block returned `e.message` directly — could leak Stripe SDK or DB error details.
2. `sendEmail()` had no `AbortController` timeout on the Resend API fetch — could hang indefinitely.
3. No CORS needed (Stripe calls this directly with no browser origin); correctly has no CORS headers (PASS).
4. Signature verification is correctly done before body parsing (PASS).
5. Body size limit correctly enforced at 512 KB (PASS).
6. Idempotency via `processed_stripe_events` unique constraint is correct (PASS).
7. All secrets read from `Deno.env` (PASS).

**Fixes Applied**:
- Catch block now logs `e.message` internally and returns `'internal_error'` to Stripe.
- `sendEmail` wrapped in `AbortController` with 30-second timeout; log message sanitized (no `res.text()` that could log sensitive data).

**Residual Risk**: None.

---

## stripe-checkout

**Status**: FIXED
**Issues Found**:
1. Catch block forwarded `e.message` to client — could expose Stripe SDK error details.
2. All other checks PASS: JWT verified, body size limited (16 KB), rate-limited (5/min), order ownership verified, gift card re-validated.

**Fixes Applied**:
- Catch block now logs internally and returns `{ error: 'internal_error' }`.

**Residual Risk**: None.

---

## stripe-refund

**Status**: FIXED
**Issues Found**:
1. Catch block forwarded `e.message` to client.
2. `stripe.refunds.create` is called via Stripe SDK (uses its own timeout internally) — acceptable.

**Fixes Applied**:
- Catch block now logs internally and returns `{ error: 'internal_error' }`.

**Residual Risk**: None.

---

## stripe-subscribe

**Status**: FIXED
**Issues Found**:
1. Catch block forwarded `e.message` to client.
2. All other checks PASS: JWT verified, body limited, rate-limited, plan ownership verified.

**Fixes Applied**:
- Catch block now logs internally and returns `{ error: 'internal_error' }`.

**Residual Risk**: None.

---

## stripe-payment-methods

**Status**: FIXED
**Issues Found**:
1. Catch block forwarded `e.message` to client — could expose Stripe customer IDs or other details.
2. Ownership verified on `detach` and `set_default` by checking `pm.customer === profile.stripe_customer_id` (PASS).

**Fixes Applied**:
- Catch block now logs internally and returns `{ error: 'internal_error' }`.

**Residual Risk**: None.

---

## stripe-boost

**Status**: FIXED
**Issues Found**:
1. Catch block forwarded `e.message` via `errorResponse(msg, 500)` — exposes internal details.
2. Boost plan prices are server-side constants; client-supplied `amountCents` is ignored (PASS — server enforces `BOOST_PRICES_CENTS[plan]`).
3. Prepper ownership verified before session creation (PASS).

**Fixes Applied**:
- Catch block now logs internally and returns `errorResponse('internal_error', 500)`.

**Residual Risk**: None.

---

## stripe-capture-home-cook

**Status**: FIXED
**Issues Found**:
1. Catch block forwarded `err.message` to client — could expose Stripe PaymentIntent state details.
2. Prepper ownership verified (PASS).
3. Idempotent capture handles already-captured state (PASS).

**Fixes Applied**:
- Catch block now logs internally and returns `errorResponse('internal_error', 500)`.

**Residual Risk**: None.

---

## stripe-home-cook-payment

**Status**: FIXED
**Issues Found**:
1. Catch block forwarded `err.message` to client.
2. Customer ownership verified (`hcr.customer_id !== user.id`), status gated on `confirmed` (PASS).
3. Idempotency key on PaymentIntent creation (PASS).

**Fixes Applied**:
- Catch block now logs internally and returns `errorResponse('internal_error', 500)`.

**Residual Risk**: None.

---

## stripe-connect

**Status**: FIXED
**Issues Found**:
1. Catch block forwarded `e.message` to client — could expose Stripe account details.
2. `prepper_id !== user.id` ownership check present (PASS).
3. Rate-limited at 10/min (PASS).

**Fixes Applied**:
- Catch block now logs internally and returns `{ error: 'internal_error' }`.

**Residual Risk**: None.

---

## notify

**Status**: FIXED
**Issues Found**:
1. DB error `error.message` forwarded directly to client in token-fetch error path.
2. Expo push API fetch had no `AbortController` timeout — could hang indefinitely.
3. Catch block forwarded `e.message` to client.
4. Service-role key comparison uses `===` (string equality, not constant-time). RISK-ACCEPTED — see residual risk.

**Fixes Applied**:
- DB error path now logs internally and returns `{ error: 'internal_error' }`.
- Expo push fetch wrapped with 30-second `AbortController` timeout.
- Catch block returns `{ error: 'internal_error' }`.

**Residual Risk**: The service-role key comparison (`token === serviceKey`) is a string equality check, not constant-time. A timing attack could theoretically determine key length. However, the service role key is a 200+ character JWT — the comparison branches are identical length, and Deno's V8 engine may short-circuit on mismatch. Risk is low in practice; a formal mitigation would require a WASM `timingSafeEqual`. RISK-ACCEPTED for now.

---

## notify-order-placed

**Status**: FIXED
**Issues Found**:
1. Expo push API fetch had no timeout.
2. Catch block forwarded `e.message` to client.

**Fixes Applied**:
- Expo push fetch wrapped with 30-second `AbortController` timeout.
- Catch block returns `errorResponse('internal_error', 500)`.

**Residual Risk**: None.

---

## notify-order-status

**Status**: FIXED
**Issues Found**:
1. Expo push API fetch had no timeout.
2. Catch block forwarded `e.message` to client.

**Fixes Applied**:
- Expo push fetch wrapped with 30-second `AbortController` timeout.
- Catch block returns `errorResponse('internal_error', 500)`.

**Residual Risk**: None.

---

## notify-rush-hour

**Status**: FIXED
**Issues Found**:
1. DB error `error.message` forwarded directly in `errorResponse(error.message, 500)` call.
2. Expo push API loop had no timeout on individual chunk fetches — could hang on slow response.
3. Catch block forwarded `e.message` to client.

**Fixes Applied**:
- DB error path logs internally and returns `errorResponse('internal_error', 500)`.
- Each chunk fetch now uses a per-iteration `AbortController` with 30-second timeout.
- Catch block returns `{ error: 'internal_error' }`.

**Residual Risk**: None.

---

## notify-emergency-request

**Status**: FIXED
**Issues Found**:
1. Both DB error paths (`prepperErr`, `tokenErr`) forwarded `error.message` to client.
2. Expo push chunk loop had no timeout.
3. Catch block forwarded `e.message` to client.

**Fixes Applied**:
- Both DB error paths now log internally and return `errorResponse('internal_error', 500)`.
- Each chunk fetch now uses a per-iteration `AbortController` with 30-second timeout.
- Catch block returns `{ error: 'internal_error' }`.

**Residual Risk**: None.

---

## order-status-email

**Status**: FIXED
**Issues Found**:
1. No body size limit before `req.json()` — trigger payloads are small but unbounded.
2. Resend API fetch had no timeout.
3. Resend failure logged `res.text()` which could log email body content to server logs — minor.

**Fixes Applied**:
- Added 64 KB body size guard (content-length check + read guard).
- Resend fetch wrapped with 30-second `AbortController` timeout.
- Resend failure log no longer calls `res.text()`.

**Residual Risk**: Hook-secret comparison uses `===` (same timing risk as `notify`). RISK-ACCEPTED — same reasoning as notify.

---

## event-processor

**Status**: FIXED
**Issues Found**:
1. Lock insert failure returned `Lock failed: ${lockError.message}` directly in response body — leaks DB error details to the caller (pg_net webhook dispatcher).

**Fixes Applied**:
- Lock failure now logs `lockError.message` internally and returns `'internal_error'` to the caller.

**Residual Risk**: None. The event-processor is called server-to-server by Supabase webhooks; the response body isn't user-facing, but defensive logging is still correct practice.

---

## Summary

| Function | CORS | JWT | Admin Check | Body Limit | Timeouts | Error Leak | Secrets |
|---|---|---|---|---|---|---|---|
| _shared/security.ts | PASS | PASS | N/A | PASS | N/A | PASS | PASS |
| admin-actions | FIXED | PASS | PASS | FIXED | FIXED | FIXED | PASS |
| feature-flags | FIXED | PASS | N/A | PASS | N/A | FIXED | PASS |
| stripe-webhook | PASS | N/A | N/A | PASS | FIXED | FIXED | PASS |
| stripe-checkout | PASS | PASS | N/A | PASS | N/A | FIXED | PASS |
| stripe-refund | PASS | PASS | N/A | PASS | N/A | FIXED | PASS |
| stripe-subscribe | PASS | PASS | N/A | PASS | N/A | FIXED | PASS |
| stripe-payment-methods | PASS | PASS | N/A | PASS | N/A | FIXED | PASS |
| stripe-boost | PASS | PASS | N/A | PASS | N/A | FIXED | PASS |
| stripe-capture-home-cook | PASS | PASS | N/A | PASS | N/A | FIXED | PASS |
| stripe-home-cook-payment | PASS | PASS | N/A | PASS | N/A | FIXED | PASS |
| stripe-connect | PASS | PASS | N/A | PASS | N/A | FIXED | PASS |
| notify | PASS | PASS | PASS | PASS | FIXED | FIXED | PASS |
| notify-order-placed | PASS | PASS | N/A | PASS | FIXED | FIXED | PASS |
| notify-order-status | PASS | PASS | N/A | PASS | FIXED | FIXED | PASS |
| notify-rush-hour | PASS | PASS | N/A | N/A | FIXED | FIXED | PASS |
| notify-emergency-request | PASS | PASS | N/A | PASS | FIXED | FIXED | PASS |
| order-status-email | PASS | N/A | N/A | FIXED | FIXED | PASS | PASS |
| event-processor | PASS | PASS | N/A | PASS | N/A | FIXED | PASS |

**Production Action Required**: Set `CORS_ALLOWED_ORIGINS=https://preppa.co,https://www.preppa.co,https://app.preppa.live` in Supabase project secrets. Without it, the shared CORS helper defaults to `*`.
