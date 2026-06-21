/**
 * Supabase schema types (hand-written to match supabase/migrations/0001).
 * Covers the tables the app currently reads/writes. Extend as new screens land.
 * (Auto-gen via `supabase gen types` once CLI/cert access is sorted.)
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';
export type MealStatus = 'draft' | 'published' | 'paused' | 'archived';
export type FulfillmentType = 'delivery' | 'pickup' | 'meetup' | 'home_cook';
export type PrepperStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type UserStatus = 'active' | 'suspended' | 'deleted';
export type PlanFrequency = 'weekly' | 'biweekly' | 'monthly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type ExperienceKind = 'catering' | 'private_chef' | 'food_service' | 'cleaning' | 'class' | 'tasting' | 'other';
export type ExperienceStatus = 'open' | 'booked' | 'completed' | 'cancelled';
export type BidStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

export type PrepperBadgeKey =
  | 'first_order' | '100_meals' | '1000_meals' | 'five_star'
  | 'local_legend' | 'protein_king' | 'vegan_wizard' | 'heat_master' | 'family_fav';

export type CustomerBadgeKey =
  | 'first_order' | 'loyal_regular' | 'local_foodie'
  | 'family_provider' | 'macro_hunter' | 'early_supporter' | 'surprise_explorer';

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

/** Shape returned by the top_preppers_ranked() RPC. */
export type TopPrepperRankedRow = {
  id: string;
  display_name: string;
  verified: boolean;
  specialties: string[] | null;
  average_rating: number | string | null;
  total_reviews: number | null;
  from_price: number | string | null;
  image_url: string | null;
  score: number | string | null;
  rank: number;
};

/** Shape returned by preppers_near() RPC. */
export type PrepperNearRow = {
  id: string;
  display_name: string;
  city: string | null;
  avatar_url: string | null;
  tagline: string | null;
  distance_km: number;
};

/** Shape returned by admin_list_disputes(). */
export type AdminDisputeRow = {
  id: string;
  order_id: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  admin_note: string | null;
  created_at: string;
  reporter_name: string | null;
  order_total: number;
  order_status: string;
  prepper_name: string;
};

/** Shape returned by admin_marketplace_fit() — the repeat-purchase signal. */
export type MarketplaceFit = {
  buyers: number;
  repeat_buyers: number;
  repeat_buyer_rate: number | null;
  completed_orders: number;
  repeat_order_share: number | null;
  active_preppers_30d: number;
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
        Row: { id: string; email: string | null; phone: string | null; full_name: string | null; avatar_url: string | null; status: UserStatus; onboarding_completed_at: string | null; referral_code: string | null; referred_by: string | null } & Timestamps;
        Insert: { id: string; email?: string | null; full_name?: string | null; avatar_url?: string | null; onboarding_completed_at?: string | null; referral_code?: string | null; referred_by?: string | null };
        Update: Partial<{ full_name: string | null; avatar_url: string | null; phone: string | null; onboarding_completed_at: string | null; referral_code: string | null; referred_by: string | null }>;
        Relationships: [];
      };
      notification_preferences: {
        Row: { user_id: string; order_updates: boolean; new_followers: boolean; meal_drops: boolean; promotions: boolean; bid_updates: boolean; prepper_news: boolean; push_enabled: boolean; updated_at: string };
        Insert: { user_id: string; order_updates?: boolean; new_followers?: boolean; meal_drops?: boolean; promotions?: boolean; bid_updates?: boolean; prepper_news?: boolean; push_enabled?: boolean; updated_at?: string };
        Update: Partial<{ order_updates: boolean; new_followers: boolean; meal_drops: boolean; promotions: boolean; bid_updates: boolean; prepper_news: boolean; push_enabled: boolean }>;
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
        Row: { id: string; user_id: string; display_name: string; bio: string | null; tagline: string | null; cover_url: string | null; cuisine_type: string | null; verified: boolean; status: PrepperStatus; reviewed_by: string | null; reviewed_at: string | null; rejection_note: string | null; delivery_radius_km: number | null; specialties: string[] | null; certifications: string[]; accepting_orders: boolean; home_cook_available: boolean; application_documents: string[]; delivers: boolean; pickup: boolean; delivery_fee: number; delivery_min_order: number; delivery_days: number[] | null; delivery_window_start: string | null; delivery_window_end: string | null; city: string | null; state: string | null; lat: number | null; lng: number | null; stripe_account_id: string | null; stripe_account_status: string | null; cook_schedule: Json | null; is_featured: boolean; featured_at: string | null } & Timestamps;
        Insert: { user_id: string; display_name: string; bio?: string | null; tagline?: string | null; cover_url?: string | null; cuisine_type?: string | null; specialties?: string[] | null; certifications?: string[]; accepting_orders?: boolean; application_documents?: string[]; lat?: number | null; lng?: number | null; cook_schedule?: Json | null; is_featured?: boolean; featured_at?: string | null };
        Update: Partial<{ display_name: string; bio: string | null; tagline: string | null; cover_url: string | null; cuisine_type: string | null; avatar_url: string | null; specialties: string[] | null; certifications: string[]; accepting_orders: boolean; home_cook_available: boolean; delivers: boolean; pickup: boolean; delivery_fee: number; delivery_min_order: number; delivery_radius_km: number | null; delivery_days: number[] | null; delivery_window_start: string | null; delivery_window_end: string | null; city: string | null; state: string | null; lat: number | null; lng: number | null; cook_schedule: Json | null; is_featured: boolean; featured_at: string | null }>;
        Relationships: [];
      };
      order_disputes: {
        Row: { id: string; order_id: string; reporter_id: string; reason: string; status: 'open' | 'resolved' | 'dismissed'; admin_note: string | null; resolved_at: string | null } & Timestamps;
        Insert: { order_id: string; reporter_id: string; reason: string };
        Update: Partial<{ status: 'open' | 'resolved' | 'dismissed'; admin_note: string | null; resolved_at: string | null }>;
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
        Row: { id: string; prepper_id: string; category_id: number | null; title: string; description: string | null; base_price: number; prep_time_min: number | null; status: MealStatus; is_limited: boolean; limited_qty: number | null; drops_at: string | null; expires_at: string | null; allergens: string[]; ingredients: string[]; available_days: string[] | null; dietary_tags: string[] | null } & Timestamps & { updated_at: string };
        Insert: { prepper_id: string; title: string; base_price: number; category_id?: number | null; description?: string | null; prep_time_min?: number | null; status?: MealStatus; is_limited?: boolean; limited_qty?: number | null; drops_at?: string | null; expires_at?: string | null; allergens?: string[]; ingredients?: string[]; available_days?: string[] | null; dietary_tags?: string[] | null };
        Update: Partial<{ title: string; description: string | null; base_price: number; category_id: number | null; prep_time_min: number | null; status: MealStatus; is_limited: boolean; limited_qty: number | null; drops_at: string | null; expires_at: string | null; allergens: string[]; ingredients: string[]; available_days: string[] | null; dietary_tags: string[] | null }>;
        Relationships: [];
      };
      meal_images: {
        Row: { id: string; meal_id: string; url: string; order_index: number; alt_text: string | null };
        Insert: { meal_id: string; url: string; order_index?: number; alt_text?: string | null };
        Update: Partial<{ url: string; order_index: number; alt_text: string | null }>;
        Relationships: [];
      };
      meal_videos: {
        Row: { id: string; meal_id: string; video_url: string; duration_sec: number | null; thumbnail_url: string | null; created_at: string };
        Insert: { meal_id: string; video_url: string; duration_sec?: number | null; thumbnail_url?: string | null };
        Update: Partial<{ video_url: string; duration_sec: number | null; thumbnail_url: string | null }>;
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
        Row: { id: string; customer_id: string; prepper_id: string; status: OrderStatus; fulfillment_type: FulfillmentType; address_id: string | null; fulfillment_note: string | null; subtotal: number; tax: number; delivery_fee: number; service_fee: number; tip: number; total: number; scheduled_at: string | null; source: 'direct' | 'bid' | 'home_cook' | 'experience'; bid_id: string | null; gift_card_code: string | null; gift_card_amount: number } & Timestamps & { updated_at: string };
        Insert: never; // created only via create_order() / create_order_from_meal_bid() RPCs
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
        Row: { id: string; order_id: string; author_id: string; prepper_id: string; meal_id: string | null; rating: number; body: string | null; photos: string[]; prepper_reply: string | null; replied_at: string | null } & Timestamps;
        Insert: { order_id: string; author_id: string; prepper_id: string; rating: number; meal_id?: string | null; body?: string | null; photos?: string[] };
        Update: Partial<{ rating: number; body: string | null; photos: string[]; prepper_reply: string | null; replied_at: string | null }>;
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
        Insert: { user_id: string; line1: string; label?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null; is_default?: boolean };
        Update: Partial<{ label: string | null; line1: string; line2: string | null; city: string | null; state: string | null; postal_code: string | null; country: string | null; is_default: boolean }>;
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
        Insert: { prepper_id: string; name: string; price: number; description?: string | null; frequency?: PlanFrequency; meals_per_cycle?: number; serves?: number; image_url?: string | null; tags?: string[] | null; active?: boolean };
        Update: Partial<{ name: string; description: string | null; frequency: PlanFrequency; price: number; meals_per_cycle: number; serves: number; image_url: string | null; tags: string[] | null; active: boolean }>;
        Relationships: [];
      };
      subscriptions: {
        Row: { id: string; customer_id: string; prepper_id: string; plan_id: string | null; plan_name: string; frequency: string; next_billing_at: string | null; status: SubscriptionStatus; qty: number; delivery_day: string | null } & Timestamps;
        Insert: { customer_id: string; prepper_id: string; plan_name: string; frequency: string; plan_id?: string | null; next_billing_at?: string | null; qty?: number; delivery_day?: string | null };
        Update: Partial<{ plan_name: string; frequency: string; next_billing_at: string | null; status: SubscriptionStatus; qty: number; delivery_day: string | null }>;
        Relationships: [];
      };
      meal_requests: {
        Row: { id: string; customer_id: string; title: string; description: string | null; servings: number; budget_per_serving: number | null; cuisine: string | null; deadline: string | null; status: string } & Timestamps;
        Insert: { customer_id: string; title: string; description?: string | null; servings?: number; budget_per_serving?: number | null; cuisine?: string | null; deadline?: string | null };
        Update: Partial<{ title: string; description: string | null; servings: number; budget_per_serving: number | null; cuisine: string | null; deadline: string | null; status: string }>;
        Relationships: [];
      };
      meal_request_bids: {
        Row: { id: string; request_id: string; prepper_id: string; price_per_serving: number; note: string | null; status: 'pending' | 'accepted' | 'rejected' | 'paid' } & Timestamps;
        Insert: { request_id: string; prepper_id: string; price_per_serving: number; note?: string | null };
        Update: Partial<{ price_per_serving: number; note: string | null; status: 'pending' | 'accepted' | 'rejected' | 'paid' }>;
        Relationships: [];
      };
      customer_meal_plans: {
        Row: { id: string; customer_id: string; name: string; frequency: string; delivery_day: string; status: string; next_billing_at: string | null; stripe_subscription_id: string | null; updated_at: string } & Timestamps;
        Insert: { customer_id: string; name?: string; frequency?: string; delivery_day?: string; status?: string; next_billing_at?: string | null; stripe_subscription_id?: string | null };
        Update: Partial<{ name: string; frequency: string; delivery_day: string; status: string; next_billing_at: string | null; stripe_subscription_id: string | null }>;
        Relationships: [];
      };
      customer_meal_plan_items: {
        Row: { id: string; plan_id: string; meal_id: string; qty: number } & Timestamps;
        Insert: { plan_id: string; meal_id: string; qty?: number };
        Update: Partial<{ qty: number }>;
        Relationships: [];
      };
      home_cook_requests: {
        Row: { id: string; customer_id: string; prepper_id: string; requested_date: string; requested_time: string; address: string; guest_count: number; cuisine: string | null; menu_ideas: string | null; ingredient_budget: number; cooking_fee: number | null; travel_fee: number | null; status: string; order_id: string | null; conversation_id: string | null; updated_at: string } & Timestamps;
        Insert: { customer_id: string; prepper_id: string; requested_date: string; requested_time?: string; address: string; guest_count?: number; cuisine?: string | null; menu_ideas?: string | null; ingredient_budget: number };
        Update: Partial<{ requested_time: string; address: string; guest_count: number; cuisine: string | null; menu_ideas: string | null; ingredient_budget: number; cooking_fee: number | null; travel_fee: number | null; status: string; order_id: string | null; conversation_id: string | null }>;
        Relationships: [];
      };
      feed_posts: {
        Row: { id: string; prepper_id: string; caption: string | null; thumbnail_url: string | null; video_url: string | null; tags: string[] } & Timestamps;
        Insert: { prepper_id: string; caption?: string | null; thumbnail_url?: string | null; video_url?: string | null; tags?: string[] };
        Update: Partial<{ caption: string | null; thumbnail_url: string | null; video_url: string | null; tags: string[] }>;
        Relationships: [];
      };
      live_sessions: {
        Row: { id: string; prepper_id: string; title: string | null; started_at: string; ended_at: string | null; viewer_count: number; is_active: boolean };
        Insert: { prepper_id: string; title?: string | null; started_at?: string; ended_at?: string | null; viewer_count?: number };
        Update: Partial<{ title: string | null; ended_at: string | null; viewer_count: number }>;
        Relationships: [];
      };
      promo_codes: {
        Row: { id: string; code: string; description: string | null; discount_type: 'percent' | 'fixed'; discount_value: number; min_order_value: number; max_uses: number | null; uses_count: number; expires_at: string | null; active: boolean; created_at: string };
        Insert: { code: string; discount_type: 'percent' | 'fixed'; discount_value: number; description?: string | null; min_order_value?: number; max_uses?: number | null; expires_at?: string | null };
        Update: Partial<{ description: string | null; discount_type: 'percent' | 'fixed'; discount_value: number; min_order_value: number; max_uses: number | null; expires_at: string | null; active: boolean }>;
        Relationships: [];
      };
      saved_meals: {
        Row: { id: string; user_id: string; meal_id: string; created_at: string };
        Insert: { id?: string; user_id: string; meal_id: string; created_at?: string };
        Update: { id?: string; user_id?: string; meal_id?: string; created_at?: string };
        Relationships: [];
      };
      meal_stock: {
        Row: { id: string; meal_id: string; date: string; qty_total: number; qty_sold: number };
        Insert: { id?: string; meal_id: string; date?: string; qty_total?: number; qty_sold?: number };
        Update: Partial<{ qty_total: number; qty_sold: number }>;
        Relationships: [];
      };
      holiday_events: {
        Row: { id: string; key: string; name: string; emoji: string; date_str: string; description: string; color_hex: string; dishes: string[]; active: boolean; sort_order: number; created_at: string };
        Insert: { id?: string; key: string; name: string; emoji?: string; date_str: string; description: string; color_hex?: string; dishes?: string[]; active?: boolean; sort_order?: number; created_at?: string };
        Update: Partial<{ key: string; name: string; emoji: string; date_str: string; description: string; color_hex: string; dishes: string[]; active: boolean; sort_order: number }>;
        Relationships: [];
      };
      boosts: {
        Row: { id: string; prepper_id: string; meal_id: string | null; plan: string; amount_cents: number; starts_at: string; expires_at: string; status: 'active' | 'expired' | 'cancelled'; stripe_payment_intent_id: string | null } & Timestamps;
        Insert: { prepper_id: string; plan: string; amount_cents: number; expires_at: string; meal_id?: string | null; starts_at?: string; status?: 'active' | 'expired' | 'cancelled'; stripe_payment_intent_id?: string | null };
        Update: Partial<{ status: 'active' | 'expired' | 'cancelled'; stripe_payment_intent_id: string | null }>;
        Relationships: [];
      };
      push_tokens: {
        Row: { id: string; user_id: string; token: string; platform: 'ios' | 'android' | 'web'; updated_at: string };
        Insert: { id?: string; user_id: string; token: string; platform: 'ios' | 'android' | 'web'; updated_at?: string };
        Update: Partial<{ token: string; platform: 'ios' | 'android' | 'web'; updated_at: string }>;
        Relationships: [];
      };
      bid_messages: {
        Row: { id: string; bid_id: string; sender_id: string; body: string; created_at: string };
        Insert: { bid_id: string; sender_id: string; body: string };
        Update: never;
        Relationships: [];
      };
      order_messages: {
        Row: { id: string; order_id: string; sender_id: string | null; body: string; created_at: string };
        Insert: { order_id: string; sender_id?: string | null; body: string };
        Update: never;
        Relationships: [];
      };
      referral_codes: {
        Row: { id: string; user_id: string; code: string; uses_count: number; created_at: string };
        Insert: { user_id: string; code: string };
        Update: Partial<{ uses_count: number }>;
        Relationships: [];
      };
      referrals: {
        Row: { id: string; referrer_id: string; referred_id: string | null; code: string; status: 'pending' | 'completed' | 'paid'; credit_amount: number; created_at: string; completed_at: string | null };
        Insert: { referrer_id: string; code: string; referred_id?: string | null; status?: 'pending' | 'completed' | 'paid'; credit_amount?: number; completed_at?: string | null };
        Update: Partial<{ referred_id: string | null; status: 'pending' | 'completed' | 'paid'; credit_amount: number; completed_at: string | null }>;
        Relationships: [];
      };
      reward_points: {
        Row: { id: string; user_id: string; order_id: string | null; points: number; reason: string; created_at: string };
        Insert: { user_id: string; points: number; reason?: string; order_id?: string | null };
        Update: never;
        Relationships: [];
      };
      payout_requests: {
        Row: {
          id: string;
          prepper_id: string;
          amount: number;
          status: 'pending' | 'processing' | 'paid' | 'rejected';
          note: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          prepper_id: string;
          amount: number;
          status?: 'pending' | 'processing' | 'paid' | 'rejected';
          note?: string | null;
        };
        Update: Partial<{
          amount: number;
          status: 'pending' | 'processing' | 'paid' | 'rejected';
          note: string | null;
          processed_at: string | null;
        }>;
        Relationships: [];
      };
      gift_cards: {
        Row: { id: string; code: string; sender_id: string | null; recipient_email: string | null; amount: number; balance: number; message: string | null; redeemed_by: string | null; is_active: boolean; created_at: string; expires_at: string | null };
        Insert: { sender_id: string; code: string; amount: number; balance: number; recipient_email?: string | null; message?: string | null; expires_at?: string | null };
        Update: Partial<{ balance: number; redeemed_by: string | null; is_active: boolean }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_order: { Args: { p_fulfillment?: FulfillmentType; p_address_id?: string | null; p_note?: string | null; p_tip?: number; p_scheduled_at?: string | null; p_gift_card_code?: string | null; p_gift_card_amount?: number; p_idempotency_key?: string | null }; Returns: string };
      create_multi_kitchen_order: { Args: { p_orders: Json }; Returns: string[] };
      update_delivery_settings: { Args: { p_delivers: boolean; p_pickup: boolean; p_delivery_fee: number; p_delivery_min_order: number; p_delivery_radius_km: number | null; p_delivery_days: number[] | null; p_delivery_window_start: string | null; p_delivery_window_end: string | null }; Returns: undefined };
      advance_order: { Args: { p_order_id: string; p_next: OrderStatus }; Returns: undefined };
      cancel_order: { Args: { p_order_id: string }; Returns: undefined };
      verify_handoff: { Args: { p_order_id: string; p_pin: string }; Returns: Json };
      verify_handoff_token: { Args: { p_token: string }; Returns: Json };
      skip_subscription_delivery: { Args: { p_id: string }; Returns: Json };
      mark_notifications_read: { Args: { p_id?: string }; Returns: undefined };
      record_event: { Args: { p_event: string; p_props?: Json }; Returns: undefined };
      request_account_deletion: { Args: { p_reason?: string | null; p_note?: string | null }; Returns: undefined };
      export_my_data: { Args: Record<string, never>; Returns: Json };
      prepper_public_stats: { Args: { p_prepper: string }; Returns: Json };
      top_preppers_ranked: { Args: { p_limit?: number }; Returns: TopPrepperRankedRow[] };
      my_prepper_earnings: { Args: Record<string, never>; Returns: Json };
      admin_set_prepper_status: { Args: { p_prepper: string; p_status: PrepperStatus; p_note?: string | null }; Returns: undefined };
      admin_grant_role: { Args: { p_user: string; p_role: string }; Returns: undefined };
      admin_revoke_role: { Args: { p_user: string; p_role: string }; Returns: undefined };
      admin_set_feature_flag: { Args: { p_key: string; p_enabled: boolean }; Returns: undefined };
      admin_set_user_status: { Args: { p_user: string; p_status: UserStatus }; Returns: undefined };
      admin_prepper_earnings: { Args: Record<string, never>; Returns: PrepperEarningsRow[] };
      admin_platform_stats: { Args: Record<string, never>; Returns: PlatformStats };
      admin_marketplace_fit: { Args: Record<string, never>; Returns: MarketplaceFit };
      set_kitchen_availability: { Args: { p_open: boolean }; Returns: undefined };
      admin_verify_prepper: { Args: { p_prepper: string; p_verified: boolean }; Returns: undefined };
      admin_resolve_dispute: { Args: { p_dispute: string; p_resolution: string; p_note?: string | null }; Returns: undefined };
      admin_list_disputes: { Args: { p_status?: string }; Returns: AdminDisputeRow[] };
      prepper_badges: { Args: { p_prepper: string }; Returns: PrepperBadgeKey[] };
      customer_badges: { Args: { p_user: string }; Returns: CustomerBadgeKey[] };
      accept_experience_bid: { Args: { p_bid: string }; Returns: undefined };
      start_conversation: { Args: { p_other: string }; Returns: string };
      mark_conversation_read: { Args: { p_conversation: string }; Returns: undefined };
      admin_list_preppers: {
        Args: { p_status?: string };
        Returns: { id: string; display_name: string; bio: string | null; verified: boolean; status: string; rejection_note: string | null; created_at: string; user_full_name: string | null; user_email: string | null; user_phone: string | null }[];
      };
      create_order_from_meal_bid: { Args: { p_bid_id: string }; Returns: string };
      create_home_cook_request: {
        Args: { p_prepper_id: string; p_requested_date: string; p_requested_time: string; p_address: string; p_guest_count: number; p_cuisine?: string | null; p_menu_ideas?: string | null; p_ingredient_budget?: number };
        Returns: string;
      };
      propose_home_cook_terms: { Args: { p_request_id: string; p_cooking_fee: number; p_travel_fee: number }; Returns: undefined };
      confirm_home_cook_booking: { Args: { p_request_id: string }; Returns: string };
      cancel_home_cook_request: { Args: { p_request_id: string; p_reason?: string | null }; Returns: undefined };
      set_home_cook_payment_intent: { Args: { p_request_id: string; p_payment_intent_id: string }; Returns: undefined };
      get_or_create_referral_code: { Args: { uid: string }; Returns: string };
      preppers_near: { Args: { p_lat: number; p_lng: number; p_radius_km?: number }; Returns: PrepperNearRow[] };
      set_prepper_location: { Args: { p_lat: number; p_lng: number }; Returns: undefined };
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
