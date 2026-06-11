-- Add Stripe customer ID to profiles so payment methods can be attached.
alter table profiles add column if not exists stripe_customer_id text unique;
