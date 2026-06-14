// Static presentation data for the Explore tab, split out to keep the screen
// component lean. Pure data only — no React, no side effects.

export const SEARCH_PLACEHOLDERS = [
  'Craving homemade Italian?',
  'Find high-protein keto meals nearby…',
  'Search chefs or specific dishes…',
  'What sounds good tonight?',
  'Halal meal prep near you?',
];

export const CITIES = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
  'Atlanta, GA', 'Washington, DC', 'Miami, FL', 'London, UK', 'Lagos, NG',
];

export type QuickFilter = { key: string; label: string };
export const QUICK_FILTERS: QuickFilter[] = [
  { key: 'vegan',         label: 'Vegan' },
  { key: 'keto',          label: 'Keto' },
  { key: 'gluten-free',   label: 'Gluten-free' },
  { key: 'halal',         label: 'Halal' },
  { key: 'under-600-cal', label: 'Under 600 cal' },
  { key: 'open-now',      label: 'Open now' },
  { key: 'next-day',      label: 'Next-day' },
  { key: 'top-rated',     label: 'Top rated' },
  { key: 'near-me',       label: 'Within 3 mi' },
];

// Keys that map directly into the dietary filter array.
export const QUICK_DIETARY = new Set(['vegan', 'keto', 'gluten-free', 'halal']);

export type CuisineItem = { id: string; name: string; meals: number; image: string };
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=60`;
export const CUISINES: CuisineItem[] = [
  { id: 'c1', name: 'italian',       meals: 128, image: img('photo-1473093295043-cdd812d0e601') },
  { id: 'c2', name: 'nigerian',      meals: 94,  image: img('photo-1604329760661-e71dc83f8f26') },
  { id: 'c3', name: 'caribbean',     meals: 67,  image: img('photo-1559339352-11d035aa65de') },
  { id: 'c4', name: 'asian',         meals: 110, image: img('photo-1504674900247-0877df9cc836') },
  { id: 'c5', name: 'mediterranean', meals: 82,  image: img('photo-1544025162-d76694265947') },
  { id: 'c6', name: 'american',      meals: 75,  image: img('photo-1568901346375-23c9450c58cd') },
];
