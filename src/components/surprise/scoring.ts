import type { Meal } from '@/components/meal-card';

// ─── Keyword Maps ─────────────────────────────────────────────────────────────

export const DIETARY_KEYWORDS: Record<string, string[]> = {
  Vegan: ['vegan', 'plant-based', 'plant based'],
  Vegetarian: ['vegetarian', 'veggie', 'vegan'],
  Pescatarian: ['fish', 'salmon', 'tuna', 'shrimp', 'seafood', 'pescatarian'],
  Halal: ['halal'],
  Kosher: ['kosher'],
  'Gluten-free': ['gluten-free', 'gluten free', 'gf'],
  'Dairy-free': ['dairy-free', 'dairy free', 'non-dairy'],
  Keto: ['keto', 'low-carb', 'low carb'],
  Paleo: ['paleo'],
  'No pork': ['chicken', 'beef', 'lamb', 'fish', 'turkey', 'seafood'],
};

export const SPICE_KEYWORDS: Record<string, string[]> = {
  None: ['mild', 'no spice', 'plain'],
  Mild: ['mild', 'lightly spiced'],
  Medium: ['medium', 'seasoned', 'flavour'],
  Hot: ['spicy', 'hot', 'pepper', 'chilli', 'jalapeño'],
  'Extra hot': ['extra hot', 'very spicy', 'fire', 'scotch bonnet'],
};

export const ALLERGY_KEYWORDS: Record<string, string[]> = {
  Peanuts: ['peanut', 'peanuts', 'groundnut'],
  'Tree nuts': ['almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'nut'],
  Dairy: ['cheese', 'milk', 'cream', 'butter', 'yogurt', 'dairy', 'ricotta', 'parmesan', 'mozzarella'],
  Eggs: ['egg', 'eggs', 'omelette', 'frittata'],
  Fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'bass', 'snapper'],
  Shellfish: ['shrimp', 'prawn', 'lobster', 'crab', 'scallop', 'shellfish', 'oyster', 'clam'],
  Wheat: ['wheat', 'bread', 'pasta', 'noodle', 'flour', 'dough', 'gluten'],
  Soy: ['soy', 'tofu', 'edamame', 'tempeh'],
  Sesame: ['sesame', 'tahini'],
};

export const CUISINE_KEYWORDS: Record<string, string[]> = {
  Nigerian: ['jollof', 'suya', 'egusi', 'plantain', 'pepper soup', 'moin moin', 'puff puff'],
  Mexican: ['taco', 'burrito', 'quesadilla', 'enchilada'],
  Italian: ['pasta', 'pizza', 'risotto', 'carbonara', 'lasagna'],
  Japanese: ['ramen', 'sushi', 'miso', 'teriyaki', 'katsu'],
  Vietnamese: ['pho', 'banh mi', 'vietnamese'],
  Indian: ['curry', 'biryani', 'butter chicken', 'dhal', 'tikka'],
  Caribbean: ['jerk', 'oxtail', 'roti', 'caribbean'],
  Ethiopian: ['injera', 'tibs', 'kitfo', 'ethiopian'],
  American: ['burger', 'bbq', 'wings', 'mac', 'grilled'],
  Mediterranean: ['shakshuka', 'falafel', 'hummus', 'mezze'],
  Asian: ['rice', 'noodle', 'stir fry', 'dumplings'],
  Healthy: ['salad', 'bowl', 'smoothie', 'wrap', 'quinoa'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function mealText(meal: Meal): string {
  return [meal.title, meal.category ?? '', meal.badge?.label ?? ''].join(' ').toLowerCase();
}

export function isAllergyMatch(text: string, allergy: string): boolean {
  const keywords = ALLERGY_KEYWORDS[allergy] ?? [allergy.toLowerCase()];
  return keywords.some((kw) => text.includes(kw));
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a meal against user prefs.
 * Returns null if the meal should be hard-excluded (allergy overlap).
 */
export function scoreMeal(
  meal: Meal,
  dietary: string[],
  allergies: string[],
  spice: string,
  cuisines: string[],
  orderedPreppers: Set<string>,
): { score: number; reason: string } | null {
  const text = mealText(meal);

  for (const allergy of allergies) {
    if (isAllergyMatch(text, allergy)) return null;
  }

  let score = 0;
  let reason = '';

  for (const pref of dietary) {
    const keywords = DIETARY_KEYWORDS[pref] ?? [pref.toLowerCase()];
    if (keywords.some((kw) => text.includes(kw))) {
      score += 2;
      if (!reason) reason = `matches your ${pref.toLowerCase()} diet`;
    }
  }

  if (spice) {
    const spiceKws = SPICE_KEYWORDS[spice] ?? [];
    if (spiceKws.some((kw) => text.includes(kw))) {
      score += 1;
      if (!reason) reason = `${spice.toLowerCase()} spice level`;
    }
  }

  for (const cuisine of cuisines) {
    const keywords = CUISINE_KEYWORDS[cuisine] ?? [cuisine.toLowerCase()];
    if (keywords.some((kw) => text.includes(kw))) {
      score += 1.5;
      if (!reason) reason = `matches your ${cuisine} preference`;
      break;
    }
  }

  if (orderedPreppers.has(meal.prepper)) {
    score += 2;
    if (!reason) reason = `from ${meal.prepper}, who you've ordered from before`;
  }

  return { score, reason };
}

// ─── Pick ─────────────────────────────────────────────────────────────────────

export interface PickResult {
  meals: Meal[];
  reasons: Map<string, string>;
  personalized: boolean;
}

/**
 * Pick top N meals from the pool using personalized scoring.
 * Falls back to random shuffle when the user has no set preferences.
 */
export function pickMeals(
  pool: Meal[],
  dietary: string[],
  allergies: string[],
  spice: string,
  cuisines: string[],
  orderedPreppers: Set<string>,
  count: number,
): PickResult {
  const hasPrefs =
    dietary.length > 0 || allergies.length > 0 || cuisines.length > 0 || orderedPreppers.size > 0;

  if (!hasPrefs) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return { meals: shuffled.slice(0, Math.min(count, shuffled.length)), reasons: new Map(), personalized: false };
  }

  const scored: Array<{ meal: Meal; score: number; reason: string }> = [];
  for (const meal of pool) {
    const result = scoreMeal(meal, dietary, allergies, spice, cuisines, orderedPreppers);
    if (result !== null) scored.push({ meal, score: result.score, reason: result.reason });
  }

  if (!scored.length) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return { meals: shuffled.slice(0, Math.min(count, shuffled.length)), reasons: new Map(), personalized: false };
  }

  // +0.5 variety bonus per unique prepper
  const seen = new Set<string>();
  const withVariety = scored.map(({ meal, score, reason }) => {
    const variety = seen.has(meal.prepper) ? 0 : 0.5;
    seen.add(meal.prepper);
    return { meal, score: score + variety, reason };
  });

  // Sort descending; random tiebreaker so "Try again" gives different results
  withVariety.sort((a, b) => b.score - a.score + (Math.random() * 0.4 - 0.2));

  const top = withVariety.slice(0, Math.min(count, withVariety.length));
  const reasons = new Map(top.map(({ meal, reason }) => [meal.id, reason]));

  return { meals: top.map((x) => x.meal), reasons, personalized: true };
}
