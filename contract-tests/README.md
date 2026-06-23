# Contract Tests

Schema and auth contract tests for every Supabase Edge Function.

Run against a local Supabase instance:

```bash
supabase start
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<local-anon-key> \
TEST_USER_JWT=<jwt-for-test-customer> \
TEST_PREPPER_JWT=<jwt-for-test-prepper> \
TEST_ADMIN_JWT=<jwt-for-test-admin> \
deno test contract-tests/ --allow-net --allow-env
```

Each file tests:
1. Auth guard — unauthenticated requests are rejected
2. Schema validation — missing/malformed fields return 400
3. Response shape — success responses have expected structure
