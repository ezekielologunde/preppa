-- Migration 0093: Create meal_stock table
-- Tracks per-meal daily quantity (total vs sold) for inventory management.

CREATE TABLE IF NOT EXISTS meal_stock (
  id        uuid    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id   uuid    NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  date      date    NOT NULL DEFAULT CURRENT_DATE,
  qty_total integer NOT NULL DEFAULT 0,
  qty_sold  integer NOT NULL DEFAULT 0,
  UNIQUE (meal_id, date)
);

ALTER TABLE meal_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read meal stock" ON meal_stock;
CREATE POLICY "anyone can read meal stock" ON meal_stock
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "preppers manage own meal stock" ON meal_stock;
CREATE POLICY "preppers manage own meal stock" ON meal_stock
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meals
    WHERE meals.id = meal_stock.meal_id
      AND meals.prepper_id = auth.uid()
  ));
