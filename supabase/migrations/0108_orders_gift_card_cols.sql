-- Add gift card tracking columns to orders.
-- gift_card_code: the code applied at checkout (null if no gift card used)
-- gift_card_amount: the portion of the order covered by the gift card

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS gift_card_code   text,
  ADD COLUMN IF NOT EXISTS gift_card_amount numeric(10,2) NOT NULL DEFAULT 0;
