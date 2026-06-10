/**
 * Supabase schema types (hand-written to match supabase/migrations/0001).
 * Covers the tables the app currently reads/writes. Extend as new screens land.
 * (Auto-gen via `supabase gen types` once CLI/cert access is sorted.)
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';
export type MealStatus = 'draft' | 'published' | 'paused' | 'archived';
export type FulfillmentType = 'delivery' | 'pickup' | 'meetup';
export type PrepperStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type UserStatus = 'active' | 'suspended' | 'deleted';
export type PlanFrequency = 'weekly' | 'biweekly' | 'monthly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type ExperienceKind = 'catering' | 'private_chef' | 'food_service' | 'cleaning' | 'class' | 'tasting' | 'other';
export type ExperienceStatus = 'open' | 'booked' | 'completed' | 'cancelled';
export type BidStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

/** Row shape returned by the admin_prepper_earnings() RPC. */
export type PrepperEarningsRow = {
  prepper_id: string;
  display_name: string;
  status: PrepperStatus;
  verified: boolean;
  total_orders: number;
  completed_orders: number;
  gross_sales: number;
  completed_sales: number;
  avg_order: number;
  rating: number;
  last_order_at: string | null;
};

/** Shape returned by the admin_platform_stats() RPC. */
export type PlatformStats = {
  total_users: number;
  total_preppers: number;
  pending_preppers: number;
  approved_preppers: number;
  total_orders: number;
  orders_today: number;
  gmv: number;
  gmv_today: number;
  open_orders: number;
};

type Timestamps = { created_at: string };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string | null; phone: string | null; full_name: string | null; avatar_url: string | null; status: UserStatus } & Timestamps;
        Insert: { id: string; email?: string | null; full_name?: string | null; avatar_url?: string | null };
        Update: Partial<{ full_name: string | null; avatar_url: string | null; phone: string | null }>;
        Relationships: [];
      };
      roles: {
        Row: { id: number; key: string };
        Insert: { key: string };
        Update: Partial<{ key: string }>;
        Relationships: [];
      };
      user_roles: {
        Row: { user_id: string; role_id: number } & Timestamps;
        Insert: { user_id: string; role_id: number };
        Update: never;
        Relationships: [];
      };
      feature_flags: {
        Row: { key: string; label: string; description: string | null; category: string; enabled: boolean; updated_at: string; updated_by: string | null };
        Insert: never; // seeded by migration; toggled via admin_set_feature_flag()
        Update: never; // mutated via admin_set_feature_flag() RPC
        Relationships: [];
      };
      prepper_profiles: {
        Row: { id: string; user_id: string; display_name: string; bio: string | null; verified: boolean; status: PrepperStatus; reviewed_by: string | null; reviewed_at: string | null; rejection_note: string | null; delivery_radius_km: number | null; specialties: string[] | null } & Timestamps;
        Insert: { user_id: string; display_name: string; bio?: string | null; specialties?: string[] | null };
        Update: Partial<{ display_name: string; bio: string | null; specialties: string[] | null }>;
        Relationships: [];
      };
      prepper_rating_summary: {
        Row: { prepper_id: string; average_rating: number; total_reviews: number; five_star: number; updated_at: string };
        Insert: { prepper_id: string; average_rating?: number; total_reviews?: number; five_star?: number };
        Update: Partial<{ average_rating: number; total_reviews: number; five_star: number }>;
        Relationships: [];
      };
      meal_categories: {
        Row: { id: number; key: string; name: string };
        Insert: { key: string; name: string };
        Update: Partial<{ key: string; name: string }>;
        Relationships: [];
      };
      meals: {
        Row: { id: string; prepper_id: string; category_id: number | null; title: string; description: string | null; base_price: number; prep_time_min: number | null; status: MealStatus } & Timestamps & { updated_at: string };
        Insert: { prepper_id: string; title: string; base_price: number; category_id?: number | null; description?: string | null; prep_time_min?: number | null; status?: MealStatus };
        Update: Partial<{ title: string; description: string | null; base_price: number; category_id: number | null; prep_time_min: number | null; status: MealStatus }>;
        Relationships: [];
      };
      meal_images: {
        Row: { id: string; meal_id: string; url: string; order_index: number; alt_text: string | null };
        Insert: { meal_id: string; url: string; order_index?: number; alt_text?: string | null };
        Update: Partial<{ url: string; order_index: number; alt_text: string | null }>;
        Relationships: [];
      };
      meal_variants: {
        Row: { id: string; meal_id: string; name: string; price_delta: number; is_default: boolean };
        Insert: { meal_id: string; name: string; price_delta?: number; is_default?: boolean };
        Update: Partial<{ name: string; price_delta: number; is_default: boolean }>;
        Relationships: [];
      };
      carts: {
        Row: { id: string; user_id: string } & Timestamps & { updated_at: string };
        Insert: { user_id: string };
        Update: Partial<{ user_id: string }>;
        Relationships: [];
      };
      cart_items: {
        Row: { id: string; cart_id: string; meal_id: string; variant_id: string | null; quantity: number; price_snapshot: number } & Timestamps;
        Insert: { cart_id: string; meal_id: string; quantity: number; price_snapshot: number; variant_id?: string | null };
        Update: Partial<{ quantity: number; variant_id: string | null }>;
        Relationships: [];
      };
      orders: {
        Row: { id: string; customer_id: string; prepper_id: string; status: OrderStatus; fulfillment_type: FulfillmentType; address_id: string | null; fulfillment_note: string | null; subtotal: number; tax: number; delivery_fee: number; service_fee: number; tip: number; total: number } & Timestamps & { updated_at: string };
        Insert: never; // created only via create_order() RPC
        Update: never; // mutated only via advance_order()/cancel_order() RPCs
        Relationships: [];
      };
      order_items: {
        Row: { id: string; order_id: string; meal_id: string; variant_id: string | null; quantity: number; unit_price: number; total: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reviews: {
        Row: { id: string; order_id: string; author_id: string; prepper_id: string; meal_id: string | null; rating: number; body: string | null } & Timestamps;
        Insert: { order_id: string; author_id: string; prepper_id: string; rating: number; meal_id?: string | null; body?: string | null };
        Update: Partial<{ rating: number; body: string | null }>;
        Relationships: [];
      };
      follows: {
        Row: { id: string; follower_id: string; prepper_id: string } & Timestamps;
        Insert: { follower_id: string; prepper_id: string };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: { id: string; user_id: string; type: string; title: string; body: string | null; data: Json | null; read: boolean } & Timestamps;
        Insert: { user_id: string; type: string; title: string; body?: string | null; data?: Json | null };
        Update: Partial<{ read: boolean }>;
        Relationships: [];
      };
      conversations: {
        Row: { id: string } & Timestamps;
        Insert: never; // created via start_conversation() RPC
        Update: never;
        Relationships: [];
      };
      conversation_participants: {
        Row: { conversation_id: string; user_id: string; last_read_at: string | null };
        Insert: never; // created via start_conversation() RPC
        Update: Partial<{ last_read_at: string | null }>;
        Relationships: [];
      };
      messages: {
        Row: { id: string; conversation_id: string; sender_id: string; body: string | null; attachment_url: string | null } & Timestamps;
        Insert: { conversation_id: string; sender_id: string; body?: string | null; attachment_url?: string | null };
        Update: never;
        Relationships: [];
      };
      addresses: {
        Row: { id: string; user_id: string; label: string | null; line1: string; line2: string | null; city: string | null; state: string | null; postal_code: string | null; country: string | null; lat: number | null; lng: number | null; is_default: boolean } & Timestamps;
        Insert: { user_id: string; line1: string; label?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; is_default?: boolean };
        Update: Partial<{ label: string | null; line1: string; line2: string | null; city: string | null; state: string | null; postal_code: string | null; is_default: boolean }>;
        Relationships: [];
      };
      experience_requests: {
        Row: { id: string; customer_id: string; kind: ExperienceKind; title: string; details: string | null; guests: number | null; budget: number | null; event_date: string | null; location: string | null; status: ExperienceStatus } & Timestamps & { updated_at: string };
        Insert: { customer_id: string; title: string; kind?: ExperienceKind; details?: string | null; guests?: number | null; budget?: number | null; event_date?: string | null; location?: string | null };
        Update: Partial<{ title: string; details: string | null; guests: number | null; budget: number | null; event_date: string | null; location: string | null; status: ExperienceStatus }>;
        Relationships: [];
      };
      experience_bids: {
        Row: { id: string; request_id: string; prepper_id: string; amount: number; message: string | null; status: BidStatus } & Timestamps;
        Insert: { request_id: string; prepper_id: string; amount: number; message?: string | null };
        Update: Partial<{ amount: number; message: string | null; status: BidStatus }>;
        Relationships: [];
      };
      meal_plans: {
        Row: { id: string; prepper_id: string; name: string; description: string | null; frequency: PlanFrequency; price: number; meals_per_cycle: number; serves: number; image_url: string | null; tags: string[] | null; active: boolean } & Timestamps & { updated_at: string };
        Insert: { prepper_id: string; name: string; price: number; description?: string | null; frequency?: PlanFrequency; meals_per_cycle?: number; serves?: number; image_url?: string | null; tags?: string[] | null };
        Update: Partial<{ name: string; description: string | null; frequency: PlanFrequency; price: number; meals_per_cycle: number; serves: number; image_url: string | null; tags: string[] | null; active: boolean }>;
        Relationships: [];
      };
      subscriptions: {
        Row: { id: string; customer_id: string; prepper_id: string; plan_id: string | null; plan_name: string; frequency: string; next_billing_at: string | null; status: SubscriptionStatus; qty: number; delivery_day: string | null } & Timestamps;
        Insert: { customer_id: string; prepper_id: string; plan_name: string; frequency: string; plan_id?: string | null; next_billing_at?: string | null; qty?: number; delivery_day?: string | null };
        Update: Partial<{ plan_name: string; frequency: string; next_billing_at: string | null; status: SubscriptionStatus; qty: number; delivery_day: string | null }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_order: { Args: { p_fulfillment?: FulfillmentType; p_address_id?: string | null; p_note?: string | null; p_tip?: number }; Returns: string };
      advance_order: { Args: { p_order_id: string; p_next: OrderStatus }; Returns: undefined };
      cancel_order: { Args: { p_order_id: string }; Returns: undefined };
      verify_handoff: { Args: { p_order_id: string; p_pin: string }; Returns: Json };
      verify_handoff_token: { Args: { p_token: string }; Returns: Json };
      skip_subscription_delivery: { Args: { p_id: string }; Returns: Json };
      my_prepper_earnings: { Args: Record<string, never>; Returns: Json };
      admin_set_prepper_status: { Args: { p_prepper: string; p_status: PrepperStatus; p_note?: string | null }; Returns: undefined };
      admin_grant_role: { Args: { p_user: string; p_role: string }; Returns: undefined };
      admin_revoke_role: { Args: { p_user: string; p_role: string }; Returns: undefined };
      admin_set_feature_flag: { Args: { p_key: string; p_enabled: boolean }; Returns: undefined };
      admin_set_user_status: { Args: { p_user: string; p_status: UserStatus }; Returns: undefined };
      admin_prepper_earnings: { Args: Record<string, never>; Returns: PrepperEarningsRow[] };
      admin_platform_stats: { Args: Record<string, never>; Returns: PlatformStats };
      accept_experience_bid: { Args: { p_bid: string }; Returns: undefined };
      start_conversation: { Args: { p_other: string }; Returns: string };
      mark_conversation_read: { Args: { p_conversation: string }; Returns: undefined };
    };
    Enums: {
      order_status: OrderStatus;
      meal_status: MealStatus;
      fulfillment_type: FulfillmentType;
      prepper_status: PrepperStatus;
      user_status: UserStatus;
      experience_kind: ExperienceKind;
      experience_status: ExperienceStatus;
      bid_status: BidStatus;
      plan_frequency: PlanFrequency;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
