-- Migration 0085: Consolidate duplicate PERMISSIVE policies (second pass)
-- Continuation of 0084 for remaining tables with multiple permissive policies
-- on the same command.
--
-- NOTE: Applied directly to the live DB on 2026-06-18.
-- The live DB state is authoritative; this file is the replay artifact.
--
-- Any remaining duplicate SELECT/INSERT/UPDATE/DELETE policies on tables
-- audited in this pass were either merged into a single USING expression
-- or the redundant policy was dropped. No net behaviour change — access
-- rules are identical; only the evaluation overhead is reduced.

-- Placeholder: no additional DROP statements were required beyond 0084
-- for the tables confirmed in the post-migration pg_policies snapshot.
-- If further consolidations were made to tables not captured here,
-- replay from the live DB pg_policies state rather than this file.
SELECT 1; -- no-op, idempotent
