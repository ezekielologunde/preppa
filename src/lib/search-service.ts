import { supabase } from '@/lib/supabase';
import type { Listing } from '@/types/database.types';

export type ListingWithCover = Listing & {
  cover_url: string | null;
};

export type SearchFilters = {
  query?: string;
  dietaryTags?: string[];
  allergenFree?: string[];
  serviceTypes?: ('pickup' | 'delivery')[];
  maxPricePence?: number;
  useCases?: string[];
};

const LISTING_FIELDS = `
  id, prepper_id, kitchen_id, status,
  name, tagline, description,
  price_pence, servings, daily_portions,
  service_types, available_days,
  use_cases, dietary_tags, allergens,
  published_at,
  listing_photos ( storage_path, display_order )
`;

const BUCKET = 'listing-photos';

function coverUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function attachCover(row: Record<string, unknown>): ListingWithCover {
  const photos = (row.listing_photos as { storage_path: string; display_order: number }[] | null) ?? [];
  const sorted = [...photos].sort((a, b) => a.display_order - b.display_order);
  return {
    ...(row as unknown as Listing),
    cover_url: sorted[0] ? coverUrl(sorted[0].storage_path) : null,
  };
}

/**
 * Full-text + filter search over published listings.
 * Uses Postgres weighted tsvector (name A, tagline+dietary B, description C).
 */
export async function searchListings(
  filters: SearchFilters,
  limit = 20,
  offset = 0,
): Promise<ListingWithCover[]> {
  let q = supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .eq('status', 'published')
    .is('deleted_at', null)
    .limit(limit)
    .range(offset, offset + limit - 1);

  if (filters.query?.trim()) {
    q = q.textSearch('search_vector', filters.query.trim(), {
      type: 'websearch',
      config: 'english',
    });
  }

  if (filters.dietaryTags?.length) {
    // Listing must contain ALL selected dietary tags (AND semantics)
    q = q.contains('dietary_tags', filters.dietaryTags);
  }

  if (filters.allergenFree?.length) {
    // Exclude listings that contain any of the given allergens
    q = q.not('allergens', 'ov', `{${filters.allergenFree.join(',')}}`);
  }

  if (filters.serviceTypes?.length) {
    q = q.overlaps('service_types', filters.serviceTypes);
  }

  if (filters.maxPricePence) {
    q = q.lte('price_pence', filters.maxPricePence);
  }

  if (filters.useCases?.length) {
    q = q.overlaps('use_cases', filters.useCases);
  }

  if (!filters.query?.trim()) {
    // Without a text query, sort newest first
    q = q.order('published_at', { ascending: false });
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => attachCover(r as Record<string, unknown>));
}

/** Fetch a single published listing by ID. */
export async function getListingById(id: string): Promise<ListingWithCover | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .eq('id', id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return attachCover(data as Record<string, unknown>);
}

/** All published listings for a given kitchen (customer-facing). */
export async function getKitchenListings(kitchenId: string): Promise<ListingWithCover[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .eq('kitchen_id', kitchenId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => attachCover(r as Record<string, unknown>));
}

/** Prepper's own listings — all statuses (for My Kitchen dashboard). */
export async function getMyListings(): Promise<ListingWithCover[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => attachCover(r as Record<string, unknown>));
}
