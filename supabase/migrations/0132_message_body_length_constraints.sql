-- Migration 0132: Enforce body length limits on all message tables at the DB level.
-- Client-side .slice() is defense-in-depth; these CHECK constraints are the
-- authoritative server-side boundary.

BEGIN;

-- order_messages: 2000 chars (chat between order parties)
ALTER TABLE order_messages
  ADD CONSTRAINT order_messages_body_length
    CHECK (char_length(body) > 0 AND char_length(body) <= 2000);

-- messages (DMs): 2000 chars
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_body_length;
ALTER TABLE messages
  ADD CONSTRAINT messages_body_length
    CHECK (body IS NULL OR char_length(body) <= 2000);

-- bid_messages: raise from 500 → 2000 to allow real negotiation text
ALTER TABLE bid_messages
  DROP CONSTRAINT IF EXISTS bid_messages_body_check;
ALTER TABLE bid_messages
  ADD CONSTRAINT bid_messages_body_length
    CHECK (char_length(body) > 0 AND char_length(body) <= 2000);

COMMIT;
