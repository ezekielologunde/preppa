/**
 * Shared types and select strings for meals queries.
 * Extracted from meals.ts to keep that file under 500 lines.
 */

export type MealDetail = {
  id: string; title: string; description: string | null; price: number; time: string;
  prepperId: string; prepperUserId: string | null; prepper: string;
  prepperVerified: boolean; prepperBio: string | null; prepperCity: string | null;
  prepperDelivers: boolean; prepperPickup: boolean;
  prepperDeliveryFee: number; prepperDeliveryRadius: number | null;
  rating: number; reviews: number; images: string[]; videoUrls: string[];
  nutrition: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null;
  isLimited: boolean; expiresAt: string | null;
  allergens: string[]; ingredients: string[];
  availableDays: string[] | null; dietaryTags: string[] | null;
};

export type TrendingMeal = import('@/components/meal-card').Meal & { orderCount: number };

export type SearchFilters = {
  categoryId?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
};

export type SurpriseFilters = {
  maxPrice?: number;
  tags?: string[];
  categoryKey?: string | null;
};

export const DETAIL_SELECT =
  'id,title,description,base_price,prep_time_min,is_limited,expires_at,allergens,ingredients,available_days,dietary_tags,' +
  'prepper:prepper_profiles(id,user_id,display_name,verified,bio,city,delivers,pickup,delivery_fee,delivery_radius_km,rating:prepper_rating_summary(average_rating,total_reviews)),' +
  'images:meal_images(url,order_index),' +
  'videos:meal_videos(url,order_index),' +
  'nutrition:nutrition_profiles(calories,protein,carbs,fat)';
