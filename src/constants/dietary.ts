import { Palette } from '@/constants/theme';

export const DIETARY_TAGS = [
  { key: 'halal',        label: 'Halal',        emoji: '\u{1F319}' },
  { key: 'vegan',        label: 'Vegan',        emoji: '\u{1F331}' },
  { key: 'vegetarian',   label: 'Vegetarian',   emoji: '\u{1F966}' },
  { key: 'gluten-free',  label: 'Gluten-free',  emoji: '\u{1F33E}' },
  { key: 'dairy-free',   label: 'Dairy-free',   emoji: '\u{1F95B}' },
  { key: 'nut-free',     label: 'Nut-free',     emoji: '\u{1F95C}' },
  { key: 'low-carb',     label: 'Low-carb',     emoji: '\u{1F4CA}' },
  { key: 'high-protein', label: 'High-protein', emoji: '\u{1F4AA}' },
] as const;

export const ALLERGENS = [
  { key: 'nuts',      label: 'Nuts',      emoji: '\u{1F95C}' },
  { key: 'dairy',     label: 'Dairy',     emoji: '\u{1F9C0}' },
  { key: 'gluten',    label: 'Gluten',    emoji: '\u{1F33E}' },
  { key: 'shellfish', label: 'Shellfish', emoji: '\u{1F990}' },
  { key: 'eggs',      label: 'Eggs',      emoji: '\u{1F95A}' },
  { key: 'soy',       label: 'Soy',       emoji: '\u{1FAD8}' },
  { key: 'fish',      label: 'Fish',      emoji: '\u{1F41F}' },
] as const;

export type DietaryTagKey = typeof DIETARY_TAGS[number]['key'];
export type AllergenKey = typeof ALLERGENS[number]['key'];

/** Color for a dietary tag key. */
export function dietaryTagColor(key: string): string {
  if (key === 'halal') return '#10B981';
  if (key === 'vegan' || key === 'vegetarian') return Palette.leafGreen;
  if (key === 'gluten-free' || key === 'dairy-free' || key === 'nut-free') return '#3B82F6';
  return '#8B5CF6';
}
