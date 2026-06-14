import {
  Award,
  BadgeCheck,
  Crown,
  Flame,
  Heart,
  Leaf,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import type { CustomerBadgeKey, PrepperBadgeKey } from '@/types/database.types';

type BadgeMeta = { label: string; Icon: LucideIcon; color: string; bg: string; description: string };

const PREPPER_META: Record<PrepperBadgeKey, BadgeMeta> = {
  first_order:   { label: 'First Order',    Icon: Sparkles,   color: Palette.amber, bg: Palette.amber + '1A', description: 'Received their first order' },
  '100_meals':   { label: '100 Meals',       Icon: Award,      color: '#6366f1', bg: '#eef2ff', description: '100+ orders completed' },
  '1000_meals':  { label: '1,000 Meals',     Icon: Crown,      color: '#8b5cf6', bg: '#f5f3ff', description: '1,000+ orders completed' },
  five_star:     { label: '5-Star Chef',     Icon: Star,       color: Palette.amber, bg: '#fffbeb', description: '4.8+ rating, 10+ reviews' },
  local_legend:  { label: 'Local Legend',    Icon: Trophy,     color: '#d97706', bg: Palette.amber + '1A', description: '50+ unique customers' },
  protein_king:  { label: 'Protein King',    Icon: Zap,        color: Palette.danger, bg: '#fef2f2', description: 'High-protein specialist' },
  vegan_wizard:  { label: 'Vegan Wizard',    Icon: Leaf,       color: '#22c55e', bg: '#f0fdf4', description: 'Vegan-friendly specialist' },
  heat_master:   { label: 'Heat Master',     Icon: Flame,      color: '#f97316', bg: '#fff7ed', description: 'Spicy food specialist' },
  family_fav:    { label: 'Family Fav',      Icon: Heart,      color: '#3b82f6', bg: '#eff6ff', description: 'Family meals specialist' },
};

const CUSTOMER_META: Record<CustomerBadgeKey, BadgeMeta> = {
  first_order:      { label: 'First Order',      Icon: Sparkles,    color: Palette.amber, bg: Palette.amber + '1A', description: 'Placed their first order' },
  loyal_regular:    { label: 'Loyal Regular',    Icon: BadgeCheck,  color: Palette.brand, bg: Palette.brandTint, description: '3+ orders from the same chef' },
  local_foodie:     { label: 'Local Foodie',     Icon: TrendingUp,  color: '#22c55e', bg: '#f0fdf4', description: 'Ordered from 3+ kitchens' },
  family_provider:  { label: 'Family Provider',  Icon: Heart,       color: '#3b82f6', bg: '#eff6ff', description: '5+ completed orders' },
  macro_hunter:     { label: 'Macro Hunter',     Icon: Zap,         color: Palette.danger, bg: '#fef2f2', description: 'Orders high-protein meals' },
  early_supporter:  { label: 'Early Supporter',  Icon: Star,        color: '#8b5cf6', bg: '#f5f3ff', description: 'Here since the beginning' },
  surprise_explorer:{ label: 'Surprise Explorer',Icon: ShieldCheck, color: '#06b6d4', bg: '#ecfeff', description: 'Used Surprise Me mode' },
};

function BadgePill({ meta, index }: { meta: BadgeMeta; index: number }) {
  const Icon = meta.Icon;
  return (
    <MotiView
      from={{ opacity: 0, translateY: 6, scale: 0.95 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'timing', duration: 240, delay: index * 40 }}
      accessibilityRole="text"
      accessibilityLabel={`${meta.label}: ${meta.description}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: meta.bg, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Icon size={13} color={meta.color} />
      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: meta.color }}>{meta.label}</Text>
    </MotiView>
  );
}

export function PrepperBadgeShelf({ badges }: { badges: PrepperBadgeKey[] }) {
  if (!badges.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 0, paddingVertical: 2 }}>
      {badges.map((key, i) => {
        const meta = PREPPER_META[key];
        return meta ? <BadgePill key={key} meta={meta} index={i} /> : null;
      })}
    </ScrollView>
  );
}

export function CustomerBadgeShelf({ badges }: { badges: CustomerBadgeKey[] }) {
  if (!badges.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 0, paddingVertical: 2 }}>
      {badges.map((key, i) => {
        const meta = CUSTOMER_META[key as CustomerBadgeKey];
        return meta ? <BadgePill key={key} meta={meta} index={i} /> : null;
      })}
    </ScrollView>
  );
}
