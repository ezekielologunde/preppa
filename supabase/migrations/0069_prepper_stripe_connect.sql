-- Add Stripe Connect account ID to prepper profiles for direct payouts
alter table prepper_profiles add column if not exists stripe_account_id text;
alter table prepper_profiles add column if not exists stripe_account_status text default 'not_connected' check (stripe_account_status in ('not_connected', 'pending', 'active', 'restricted'));
comment on column prepper_profiles.stripe_account_id is 'Stripe Connect Express account ID for direct payout disbursement';
comment on column prepper_profiles.stripe_account_status is 'Status of the Stripe Connect account onboarding';
