-- Add optional scheduled delivery date to orders
alter table orders add column if not exists scheduled_at timestamptz;
comment on column orders.scheduled_at is 'Requested delivery/pickup date-time for pre-orders. Null means ASAP.';
