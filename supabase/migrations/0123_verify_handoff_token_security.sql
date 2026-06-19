BEGIN;

-- Revoke anon/PUBLIC execute on handoff verification RPCs.
-- verify_handoff_token(uuid) is the QR-scan path; verify_handoff(uuid, text) is
-- the PIN path. Both complete orders and must require an authenticated session.
REVOKE EXECUTE ON FUNCTION verify_handoff_token(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION verify_handoff(uuid, text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION verify_handoff_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_handoff(uuid, text) TO authenticated;

COMMIT;
