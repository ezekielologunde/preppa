import type { Meal } from '@/components/meal-card';
import { Palette } from '@/constants/theme';

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=60`;

// Restrained badge system: brand orange for promotional, success green for positive status.
const BRAND = Palette.brand;
const STATUS = Palette.success;

export const recommendedMeals: Meal[] = [
  { id: '1', title: 'Honey Garlic Salmon', prepper: "kelsi's kitchen", rating: 4.8, reviews: 128, price: 14.99, time: '30–40 min', image: img('photo-1467003909585-2f8a72700288'), badge: { label: 'popular', color: BRAND } },
  { id: '2', title: 'Creamy Jerk Pasta', prepper: 'island bites', rating: 4.9, reviews: 96, price: 13.49, time: '25–35 min', image: img('photo-1473093295043-cdd812d0e601'), badge: { label: 'new', color: STATUS } },
  { id: '3', title: 'Wellness Bowl', prepper: 'green plates', rating: 4.7, reviews: 52, price: 12.49, time: '20–30 min', image: img('photo-1512621776951-a57141f2eefd'), badge: { label: 'healthy', color: STATUS } },
  { id: '4', title: 'Jerk Chicken Bowl', prepper: 'spice haus', rating: 4.9, reviews: 74, price: 13.99, time: '20–30 min', image: img('photo-1546069901-ba9599a7e63c'), badge: { label: 'trending', color: BRAND } },
];

export const popularMeals: Meal[] = [
  { id: 'p1', title: 'Honey Garlic Salmon Bowl', prepper: 'chef kelsey', rating: 4.9, reviews: 128, price: 14.99, time: '30–40 min', image: img('photo-1467003909585-2f8a72700288'), badge: { label: 'trending', color: BRAND } },
  { id: 'p2', title: 'Creamy Jerk Pasta', prepper: 'island bites', rating: 4.8, reviews: 96, price: 13.49, time: '25–35 min', image: img('photo-1473093295043-cdd812d0e601'), badge: { label: 'popular', color: BRAND } },
  { id: 'p3', title: 'Jerk Chicken Bowl', prepper: 'spice haus', rating: 4.9, reviews: 74, price: 13.99, time: '20–30 min', image: img('photo-1546069901-ba9599a7e63c'), badge: { label: 'fast selling', color: BRAND } },
  { id: 'p4', title: 'Vegan Buddha Bowl', prepper: 'green plates', rating: 4.7, reviews: 52, price: 12.49, time: '20–30 min', image: img('photo-1512621776951-a57141f2eefd'), badge: { label: 'new', color: STATUS } },
];

export const orderAgain = { title: 'Jerk Chicken Bowl', prepper: 'spice haus', price: 13.99, date: 'may 8', image: img('photo-1546069901-ba9599a7e63c') };

export const categories = [
  { key: 'breakfast', label: 'breakfast', icon: 'Coffee', color: '#f59e0b' },
  { key: 'lunch', label: 'lunch', icon: 'Salad', color: '#22c55e' },
  { key: 'dinner', label: 'dinner', icon: 'UtensilsCrossed', color: '#f15f22' },
  { key: 'healthy', label: 'healthy', icon: 'Leaf', color: '#16a34a' },
  { key: 'vegan', label: 'vegan', icon: 'Sprout', color: '#8b5cf6' },
  { key: 'more', label: 'more', icon: 'MoreHorizontal', color: '#6b7280' },
] as const;

export const exploreCategories = [
  { key: 'all', label: 'all', icon: 'LayoutGrid', color: '#f15f22' },
  { key: 'breakfast', label: 'breakfast', icon: 'Coffee', color: '#f59e0b' },
  { key: 'lunch', label: 'lunch', icon: 'Salad', color: '#22c55e' },
  { key: 'dinner', label: 'dinner', icon: 'UtensilsCrossed', color: '#f15f22' },
  { key: 'snacks', label: 'snacks', icon: 'Cookie', color: '#d97706' },
  { key: 'desserts', label: 'desserts', icon: 'CakeSlice', color: '#ec4899' },
  { key: 'more', label: 'more', icon: 'MoreHorizontal', color: '#6b7280' },
] as const;

export type Cuisine = { id: string; name: string; meals: number; image: string };
export const cuisines: Cuisine[] = [
  { id: 'c1', name: 'italian', meals: 128, image: img('photo-1473093295043-cdd812d0e601') },
  { id: 'c2', name: 'mexican', meals: 156, image: img('photo-1565299624946-b28f40a0ae38') },
  { id: 'c3', name: 'asian', meals: 142, image: img('photo-1512058564366-18510be2db19') },
  { id: 'c4', name: 'mediterranean', meals: 98, image: img('photo-1540189549336-e6e99c3679fe') },
  { id: 'c5', name: 'indian', meals: 87, image: img('photo-1585937421612-70a008356fbe') },
];

export type Prepper = {
  id: string;
  name: string;
  verified: boolean;
  rating: number;
  reviews: number;
  location: string;
  options: string;
  from: number;
  image: string;
  badge: { label: string; color: string; icon: string };
};
// --- Experiences (primary product): curated bookable food experiences ---
export type ExperienceType = { key: string; label: string; icon: string; blurb: string };
export const experienceTypes: ExperienceType[] = [
  { key: 'catering', label: 'Catering', icon: 'UtensilsCrossed', blurb: 'Feed your event' },
  { key: 'private_chef', label: 'Private chef', icon: 'ChefHat', blurb: 'Cooked at home' },
  { key: 'class', label: 'Cooking class', icon: 'GraduationCap', blurb: 'Learn hands-on' },
  { key: 'tasting', label: 'Tasting', icon: 'Wine', blurb: 'Curated menus' },
];

export type Experience = {
  id: string;
  title: string;
  host: string;
  type: string;
  rating: number;
  reviews: number;
  from: number;
  per: string;
  location: string;
  image: string;
};
export const featuredExperiences: Experience[] = [
  { id: 'e1', title: 'Private Caribbean Feast', host: 'Chef Kelsey', type: 'private_chef', rating: 4.9, reviews: 42, from: 65, per: 'per guest', location: 'Harlem, NY', image: img('photo-1555939594-58d7cb561ad1') },
  { id: 'e2', title: 'Hands-on Pasta Class', host: 'Island Bites', type: 'class', rating: 4.8, reviews: 38, from: 45, per: 'per seat', location: 'Brooklyn, NY', image: img('photo-1556910103-1c02745aae4d') },
  { id: 'e3', title: 'Event Catering — up to 50', host: 'Spice Haus', type: 'catering', rating: 4.9, reviews: 27, from: 18, per: 'per head', location: 'Queens, NY', image: img('photo-1414235077428-338989a2e8c0') },
  { id: 'e4', title: 'West-African Tasting Menu', host: 'Green Plates', type: 'tasting', rating: 5.0, reviews: 19, from: 80, per: 'per guest', location: 'Manhattan, NY', image: img('photo-1559339352-11d035aa65de') },
];

export const preppers: Prepper[] = [
  { id: 'pr1', name: 'Chef Kelsey', verified: true, rating: 4.9, reviews: 128, location: 'Harlem, NY', options: 'delivers · pickup', from: 12, image: img('photo-1583394293214-28a5b0f5a5b8'), badge: { label: 'top rated', color: STATUS, icon: 'Trophy' } },
  { id: 'pr2', name: 'Island Bites', verified: true, rating: 4.8, reviews: 96, location: 'Queens, NY', options: 'delivers · cook at home', from: 10, image: img('photo-1577219491135-ce391730fb2c'), badge: { label: 'fast responder', color: STATUS, icon: 'Zap' } },
  { id: 'pr3', name: 'Spice Haus', verified: true, rating: 4.9, reviews: 74, location: 'Brooklyn, NY', options: 'delivers · pickup', from: 11, image: img('photo-1607631568010-a87245c0daf8'), badge: { label: 'new', color: BRAND, icon: 'Sparkles' } },
];
