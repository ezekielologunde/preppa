# ADR 001: Supabase as backend-as-a-service

**Status**: Accepted (2024)
**Context**: We need auth, DB, real-time, and serverless functions for a two-sided marketplace MVP.
**Decision**: Use Supabase (hosted PostgreSQL + PostgREST + Deno edge functions).
**Rationale**: Reduces ops burden at startup stage; RLS provides multi-tenant security out of the box; JS/TS edge functions share types with frontend; generous free tier.
**Trade-offs**: Vendor lock-in to Supabase; service_role key bypasses RLS (mitigated by edge functions using JWT where possible); limited compute for heavy processing.
**Alternatives rejected**: Custom Node.js API (higher ops cost); Firebase (document DB less suited for relational marketplace data).
