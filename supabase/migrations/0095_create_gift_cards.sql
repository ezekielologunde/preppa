-- Migration 0095: Create gift_cards table
-- Supports purchasing and redeeming gift card codes with a balance ledger.

CREATE TABLE IF NOT EXISTS gift_cards (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code            text        NOT NULL UNIQUE,
  sender_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text,
  amount          numeric     NOT NULL,
  balance         numeric     NOT NULL,
  message         text,
  redeemed_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz
);

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can create" ON gift_cards;
CREATE POLICY "authenticated users can create" ON gift_cards
  FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL) AND (sender_id = auth.uid()));

DROP POLICY IF EXISTS "senders see own cards" ON gift_cards;
CREATE POLICY "senders see own cards" ON gift_cards
  FOR SELECT
  USING ((sender_id = auth.uid()) OR (redeemed_by = auth.uid()));

-- NOTE: gift_cards_redeem UPDATE policy has a known gap (see RLS patterns doc):
-- with_check allows redeemed_by = auth.uid() which lets any auth user
-- claim any active card. Review before adding high-value card support.
DROP POLICY IF EXISTS gift_cards_redeem ON gift_cards;
CREATE POLICY gift_cards_redeem ON gift_cards
  FOR UPDATE
  USING ((auth.uid() IS NOT NULL) AND (is_active = true) AND (balance > 0))
  WITH CHECK ((auth.uid() IS NOT NULL) AND ((redeemed_by IS NULL) OR (redeemed_by = auth.uid())));
