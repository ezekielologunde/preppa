// "Trending in your area" tags for the search overlay. Each tag pairs a
// display hashtag with the underlying query string that actually drives the
// search index, so tapping a hashtag yields real results (not a literal "#…").

export type TrendingTag = { tag: string; query: string };

const BASE: TrendingTag[] = [
  { tag: 'jollof rice',    query: 'jollof rice' },
  { tag: 'meal prep',      query: 'meal prep' },
  { tag: 'vegan bowls',    query: 'vegan bowls' },
  { tag: 'grilled chicken', query: 'grilled chicken' },
  { tag: 'stir fry',       query: 'stir fry' },
  { tag: 'smoothie bowls', query: 'smoothie bowls' },
];

// A few cities get a localized flavour at the front of the list; everywhere
// else falls back to the base set. Keyed by the city token before the comma.
const BY_CITY: Record<string, TrendingTag[]> = {
  'Lagos': [{ tag: '#JollofWars', query: 'jollof' }, { tag: '#SuyaNights', query: 'suya' }],
  'Houston': [{ tag: '#TexBBQ', query: 'bbq' }, { tag: '#GulfSeafood', query: 'seafood' }],
  'Los Angeles': [{ tag: '#PlantBasedLA', query: 'plant based' }, { tag: '#TacoTuesday', query: 'taco' }],
  'New York': [{ tag: '#DeskLunch', query: 'lunch bowl' }, { tag: '#HalalCart', query: 'halal' }],
};

/** Trending tags for a location string like "New York, NY" (city-aware). */
export function trendingForArea(location?: string | null): TrendingTag[] {
  const city = (location ?? '').split(',')[0].trim();
  const local = BY_CITY[city] ?? [];
  // Local tags first, then base — de-duplicated by query, capped at 7.
  const seen = new Set<string>();
  const out: TrendingTag[] = [];
  for (const t of [...local, ...BASE]) {
    if (seen.has(t.query)) continue;
    seen.add(t.query);
    out.push(t);
    if (out.length >= 7) break;
  }
  return out;
}
