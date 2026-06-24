// Hand-written types grounded against the live Supabase schema.
// Extend manually as migrations are applied — never run supabase gen types.
// Last updated: migrations 027–030 (2026-06-23); RLS hardening, prepper applications, admin RBAC, fulfillment escrow

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ── Enums ─────────────────────────────────────────────────────────────────

export type ListingStatus =
  | 'draft'
  | 'reviewing'
  | 'published'
  | 'paused'
  | 'out_of_stock'
  | 'archived'
  | 'deleted';

export type KitchenStatus =
  | 'accepting_orders'
  | 'busy'
  | 'limited'
  | 'booked'
  | 'vacation'
  | 'offline'
  | 'emergency_pause';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'in_escrow'
  | 'released'
  | 'refunded'
  | 'failed';

// Migration 028
export type ApplicationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended';

// Migration 030 — matches the fulfillment_method DB enum
export type FulfillmentMethod = 'delivery' | 'meetup' | 'pickup';

// Migration 030 — matches the escrow_status DB enum
export type EscrowStatus =
  | 'held'
  | 'releasing'
  | 'released'
  | 'disputed'
  | 'refunded';

// ── Tables ────────────────────────────────────────────────────────────────

// Listing — see Sprint 11 section below for full type including admin columns

export type ListingPhoto = {
  id: string;
  listing_id: string;
  storage_path: string;
  display_order: number;
  created_at: string;
};

// Kitchen — see Sprint 11 section below for full type including verified_at/verified_by

export type KitchenCapacity = {
  id: string;
  kitchen_id: string;
  date: string;           // YYYY-MM-DD
  daily_limit: number;
  orders_accepted: number;
};

export type DomainEvent = {
  id: string;
  event_type: string;
  aggregate_type: 'listing' | 'order' | 'kitchen' | 'payment' | string;
  aggregate_id: string;
  actor_id: string | null;
  payload: Json;
  /** Starts at 1; bump when the payload shape changes so old processors can skip unknown versions */
  version: number;
  occurred_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  before_state: Json | null;
  after_state: Json | null;
  metadata: Json;
  created_at: string;
};

export type Order = {
  id: string;
  customer_id: string;
  kitchen_id: string;
  status: OrderStatus;
  total_pence: number;
  platform_fee_pence: number;
  delivery_address: Json | null;
  notes: string | null;
  // Migration 030: fulfillment + escrow columns
  fulfillment_method: FulfillmentMethod;
  verification_pin_hash: string | null;   // bcrypt; never expose to client
  pin_attempts: number;
  pin_locked_at: string | null;
  is_verified: boolean;
  verified_at: string | null;
  escrow_status: EscrowStatus;
  escrow_released_at: string | null;
  auto_release_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  listing_id: string;
  listing_name: string;   // snapshot at order time
  quantity: number;
  unit_pence: number;
  created_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  stripe_payment_intent_id: string | null;
  status: PaymentStatus;
  amount_pence: number;
  platform_fee_pence: number;
  prepper_payout_pence: number;
  currency: string;
  captured_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationType =
  | 'new_order'
  | 'order_update'
  | 'order_cancelled'
  | 'chat'
  | 'review'
  | 'new_follower'
  | 'listing_update'
  | 'capacity_warning'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Json;
  read: boolean;
  priority: NotificationPriority;
  created_at: string;
};

export type EventProcessingStatus =
  | 'processing'
  | 'success'
  | 'failed'
  | 'pending_retry'
  | 'dead_letter'
  | 'skipped';

export type EventProcessingLog = {
  id: string;
  event_id: string;
  event_type: string;
  status: EventProcessingStatus;
  /** Total completed attempts so far (1-indexed) */
  attempt_count: number;
  error: string | null;
  failure_reason: string | null;
  last_attempt_at: string | null;
  next_attempt_at: string | null;  // populated when status = 'pending_retry'
  processed_at: string | null;
  created_at: string;
};

export type SecurityEventSeverity = 'info' | 'warn' | 'critical';

export type SecurityEvent = {
  id: string;
  event_type: string;
  actor_id: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  payload: Json;
  severity: SecurityEventSeverity;
  occurred_at: string;
};

export type EventDeadLetter = {
  id: string;
  event_id: string;
  event_type: string;
  final_error: string;
  attempt_count: number;
  payload_snapshot: Json;
  failed_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  /** Tracks manual admin replays; capped at 3 (migration 016) */
  manual_replay_count: number;
};

export type ListingStats = {
  listing_id: string;
  views: number;
  saves: number;
  orders_count: number;
  /** Always an integer in pence */
  revenue_pence: number;
  clicks: number;
  favorites: number;
  shares: number;
  cancellations: number;
  average_rating: number | null;
  updated_at: string;
  last_updated: string;
};

export type AnalyticsDaily = {
  id: string;
  prepper_id: string;
  date: string;           // YYYY-MM-DD
  orders_count: number;
  /** Always an integer in pence */
  revenue_pence: number;
  cancellations: number;
  new_customers: number;
};

// ── CQRS Projection Read Models ───────────────────────────────────────────

export type ProjectionEventLog = {
  event_id: string;
  projection_name: string;
  applied_at: string;
};

export type PrepperMetrics = {
  prepper_id: string;
  total_orders: number;
  total_revenue_pence: number;
  cancelled_orders: number;
  today_orders: number;
  today_revenue_pence: number;
  today_date: string | null;            // YYYY-MM-DD
  week_orders: number;
  week_revenue_pence: number;
  week_start_date: string | null;
  month_orders: number;
  month_revenue_pence: number;
  month_start_date: string | null;
  average_rating: number | null;
  completion_rate: number;
  last_order_at: string | null;
  last_updated: string;
};

export type CustomerMetrics = {
  customer_id: string;
  total_orders: number;
  lifetime_value_pence: number;
  average_order_pence: number;
  cancelled_orders: number;
  first_order_at: string | null;
  last_order_at: string | null;
  last_updated: string;
};

export type KitchenMetrics = {
  kitchen_id: string;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue_pence: number;
  average_prep_minutes: number | null;
  utilization_rate: number;
  last_order_at: string | null;
  last_updated: string;
};

export type PlatformMetrics = {
  id: 1;
  total_orders: number;
  total_revenue_pence: number;
  total_listings: number;
  active_listings: number;
  orders_today: number;
  revenue_today_pence: number;
  today_date: string | null;
  last_updated: string;
};

export type PlatformHealthMetrics = {
  id: 1;
  retry_queue_depth: number;
  dead_letter_count: number;
  critical_security_events_24h: number;
  unresolved_dead_letters: number;
  avg_event_processing_ms: number | null;
  orders_last_hour: number;
  payment_failures_24h: number;
  // Added by migration 025: count of 401/403 responses to event-processor in the last 5 min
  retry_auth_failures_5min: number;
  // Added by migration 026: timestamp of last manual admin invocation of check_projection_drift
  drift_check_last_admin_call_at: string | null;
  computed_at: string;
};

// ── Notification Preferences ──────────────────────────────────────────────

export type NotificationChannel = 'in_app' | 'push' | 'email';

export type NotificationPreference = {
  user_id: string;
  channel: NotificationChannel;
  notification_type: NotificationType;
  enabled: boolean;
  updated_at: string;
};

// ── Abuse Detection ───────────────────────────────────────────────────────

export type AbuseSignalType =
  | 'self_order_attempt'
  | 'rapid_review'
  | 'refund_abuse'
  | 'payment_fraud'
  | 'login_bruteforce'
  | 'address_mismatch'
  | 'promo_abuse'
  | 'account_sharing';

export type AbuseSignal = {
  id: string;
  user_id: string;
  signal_type: AbuseSignalType;
  /** Weight of this signal: 1–100 */
  score: number;
  payload: Json;
  emitted_at: string;
};

export type RiskScore = {
  user_id: string;
  /** Cumulative risk score. 0–499: normal · 500–799: review · 800+: frozen */
  score: number;
  signals_count: number;
  review_required_at: string | null;
  frozen_at: string | null;
  last_signal_at: string | null;
  last_updated: string;
};

// ── Object Storage Pipeline ───────────────────────────────────────────────

export type UploadPipelineStatus =
  | 'pending'
  | 'validating'
  | 'processing'
  | 'ready'
  | 'rejected'
  | 'quarantined';

export type VirusScanStatus = 'pending' | 'clean' | 'infected' | 'scan_failed';

export type MediaObject = {
  id: string;
  uploader_id: string;
  original_filename: string;
  storage_bucket: string;
  storage_path: string | null;
  detected_mime: string | null;
  /** SHA-256 hex; NULL until server-computed by upload-pipeline edge function */
  sha256: string | null;
  filesize: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  pipeline_status: UploadPipelineStatus;
  virus_status: VirusScanStatus;
  rejection_reason: string | null;
  exif_stripped: boolean;
  reencoded: boolean;
  uploaded_at: string;
  validated_at: string | null;
  ready_at: string | null;
};

export type UserStorageQuota = {
  user_id: string;
  /** Bytes charged atomically at begin_upload; refunded on rejection/expiry */
  used_bytes: number;
  quota_bytes: number;
  last_updated: string;
};

// ── Sprint 11 / Migration 016: Red-team hardening ────────────────────────

export type AdminActionQuota = {
  admin_id: string;
  /** date_trunc('hour', NOW()) — rolling 1-hour window */
  window_start: string;
  /** Max 20 per hour (migration 016) */
  refunds_this_hour: number;
  /** Max 30 per hour (migration 016) */
  releases_this_hour: number;
};

// ── Sprint 11: Operations Control Plane ──────────────────────────────────

export type AdminActionLog = {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  reason: string;
  metadata: Json;
  domain_event_id: string | null;
  reversible: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  created_at: string;
};

export type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  global_rollout_pct: number;
  min_app_version: string | null;
  expires_at: string | null;
  kill_switch: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
  deleted_at: string | null;
};

export type FeatureFlagTarget = {
  id: string;
  flag_id: string;
  target_type: 'user' | 'prepper' | 'country' | 'city' | 'postcode' | 'user_cohort' | 'prepper_cohort';
  target_value: string;
  enabled: boolean;
  created_at: string;
  created_by: string;
};

export type FeatureFlagAudit = {
  id: string;
  flag_id: string;
  admin_id: string;
  action: string;
  before_state: Json | null;
  after_state: Json;
  reason: string;
  created_at: string;
};

export type MetricsSnapshot = {
  id: string;
  retry_queue_depth: number;
  dead_letter_count: number;
  unresolved_dead_letters: number;
  avg_event_processing_ms: number | null;
  critical_security_events_24h: number;
  orders_last_hour: number;
  payment_failures_24h: number;
  p50_api_ms: number | null;
  p95_api_ms: number | null;
  p99_api_ms: number | null;
  p50_db_ms: number | null;
  p95_db_ms: number | null;
  p50_projection_lag_ms: number | null;
  p95_projection_lag_ms: number | null;
  event_throughput_per_min: number | null;
  notification_queue_depth: number | null;
  storage_objects_pending: number | null;
  storage_objects_quarantined: number | null;
  active_users_last_hour: number | null;
  active_kitchens_last_hour: number | null;
  active_orders_now: number | null;
  snapped_at: string;
};

export type AlertConfig = {
  id: string;
  metric_name: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'gte' | 'lte';
  severity: SecurityEventSeverity;
  enabled: boolean;
  cooldown_mins: number;
  created_by: string | null;
  updated_at: string;
};

export type ActiveAlert = {
  id: string;
  config_id: string;
  metric_name: string;
  threshold: number;
  observed_value: number;
  severity: SecurityEventSeverity;
  triggered_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  snapshot_id: string | null;
};

export type ReplaySessionType = 'single_event' | 'event_range' | 'projection_rebuild' | 'full_rebuild';
export type ReplaySessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dry_run_complete';

export type ReplaySession = {
  id: string;
  initiated_by: string;
  replay_type: ReplaySessionType;
  target_event_id: string | null;
  from_occurred_at: string | null;
  to_occurred_at: string | null;
  projection_name: string | null;
  dry_run: boolean;
  status: ReplaySessionStatus;
  events_scanned: number;
  events_replayed: number;
  events_skipped: number;
  errors: number;
  error_details: Json[];
  reason: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type ReplayEventLog = {
  id: string;
  session_id: string;
  event_id: string;
  event_type: string;
  projection_name: string | null;
  result: 'replayed' | 'skipped' | 'error';
  error_detail: string | null;
  processed_at: string;
};

// ── Extend existing types with Sprint 11 columns ──────────────────────────

export type Kitchen = {
  id: string;
  prepper_id: string;
  display_name: string | null;
  bio: string | null;
  status_override: KitchenStatus | null;
  vacation_until: string | null;
  daily_capacity: number;
  business_hours: Json[];
  health_score: number;
  verified_at: string | null;       // Sprint 11: admin verification
  verified_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Listing = {
  id: string;
  prepper_id: string;
  kitchen_id: string | null;
  status: ListingStatus;
  name: string;
  tagline: string | null;
  description: string | null;
  price_pence: number;
  servings: number;
  daily_portions: number | null;
  service_types: ('pickup' | 'delivery')[];
  available_days: number[];
  use_cases: string[];
  dietary_tags: string[];
  allergens: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  admin_disabled_at: string | null;  // Sprint 11: admin disable
  admin_disabled_by: string | null;
  admin_disabled_reason: string | null;
};

// ── Insert helpers ────────────────────────────────────────────────────────

export type ListingInsert = Omit<
  Listing,
  'id' | 'created_at' | 'updated_at' | 'published_at' | 'archived_at' | 'deleted_at'
> & {
  id?: string;
  status?: ListingStatus;
};

export type OrderInsert = Omit<Order, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  status?: OrderStatus;
};

// ── Fulfillment Types ──────────────────────────────────────────────────────

export type FulfillmentType = 'pickup' | 'delivery' | 'meetup' | 'home_cook';

// ── Authorization / Roles (Migration 022) ─────────────────────────────────

export type AppRole = 'admin' | 'moderator' | 'support' | 'finance';

export type UserRole = {
  id: string;
  user_id: string;
  role: AppRole;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
};

export type RoleAudit = {
  id: string;
  actor_id: string;
  target_user_id: string;
  action: 'grant' | 'revoke';
  role: AppRole;
  reason: string | null;
  created_at: string;
};

// ── Payment Operations (Migration 023) ────────────────────────────────────

export type PaymentOperationType = 'refund' | 'release' | 'capture' | 'dispute' | 'chargeback' | 'adjustment';
export type PaymentOperationStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export type PaymentOperation = {
  id: string;
  order_id: string;
  payment_id: string;
  operation_type: PaymentOperationType;
  status: PaymentOperationStatus;
  amount_pence: number;
  initiated_by: string | null;
  stripe_refund_id: string | null;
  idempotency_key: string | null;
  error: string | null;
  metadata: Json;
  created_at: string;
  completed_at: string | null;
};

// ── Notification Infrastructure ────────────────────────────────────────────

export type NotificationSendLog = {
  id: string;
  notification_id: string;
  channel: NotificationChannel;
  sent_at: string;
  success: boolean;
  error: string | null;
  provider_message_id: string | null;
};

export type NotificationDedup = {
  id: string;
  dedup_key: string;
  created_at: string;
  expires_at: string;
};

// ── Feature Flag Rate Limiting ─────────────────────────────────────────────

export type FlagEvalRateLimit = {
  id: string;
  user_id: string;
  flag_key: string;
  eval_count: number;
  window_start: string;
  last_eval_at: string;
};

// ── Admin Infrastructure ───────────────────────────────────────────────────

export type AdminOperationLock = {
  id: string;
  lock_key: string;
  held_by: string;
  acquired_at: string;
  expires_at: string;
  metadata: Json;
};

export type AdminDeadletterDrain = {
  id: string;
  event_dead_letter_id: string;
  drained_by: string;
  drain_reason: string;
  replay_session_id: string | null;
  drained_at: string;
};

// ── Prepper Applications (Migration 028) ──────────────────────────────────────

export type PrepperApplication = {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  legal_name: string;
  postcode: string;
  kitchen_address: string | null;
  kitchen_photos: string[];
  food_safety_cert_url: string | null;
  cert_expiration_date: string | null;
  cert_reminder_sent_at: string | null;
  bio: string | null;
  experience_years: number | null;
  specialties: string[];
  insurance_attested: boolean;
  insurance_attested_at: string | null;
  contractor_attested: boolean;
  contractor_attested_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  // internal_notes is admin-only and not surfaced to the client layer
  created_at: string;
  updated_at: string;
};

export type PrepperApplicationInsert = {
  user_id: string;
  legal_name: string;
  postcode: string;
  kitchen_address?: string;
  kitchen_photos?: string[];
  food_safety_cert_url?: string;
  cert_expiration_date?: string;
  bio?: string;
  experience_years?: number;
  specialties?: string[];
  insurance_attested: true;    // literal true — RLS blocks false
  insurance_attested_at: string;
  contractor_attested: true;   // literal true — RLS blocks false
  contractor_attested_at: string;
  submitted_at?: string;
};
