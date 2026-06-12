import { useRouter } from 'expo-router';
import {
  AlertCircle,
  CakeSlice,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  Compass,
  Cookie,
  Flame,
  Heart,
  LayoutGrid,
  Leaf,
  MapPin,
  MoreHorizontal,
  Salad,
  Search,
  SlidersHorizontal,
  ShoppingBag,
  Sparkles,
  Sprout,
  UtensilsCrossed,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { feedback } from '@/lib/feedback';

import { CuisineCard } from '@/components/cuisine-card';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { cuisines, exploreCategories } from '@/constants/mock';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { useFeaturedMeals, useLimitedDrops } from '@/lib/queries/meals';
import { useKitchenTags, useTopPreppers } from '@/lib/queries/preppers';
import { usePersonalizedMeals } from '@/lib/queries/recommend';
import { useBreakpoint, usePagePadding } from '@/lib/layout';
import { useRankedPreppers } from '@/lib/match';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const ICONS: Record<string, LucideIcon> = {
  LayoutGrid, Coffee, Salad, UtensilsCrossed, Cookie, CakeSlice, Leaf, Sprout, MoreHorizontal,
};

const TRENDING = [
  'Nigerian Stew', 'Jerk Chicken', 'High-Protein', 'Vegan', 'Meal Prep', 'Keto',
];

const GOALS: { label: string; tag: string; Icon: LucideIcon; color: string }[] = [
  { label: 'Bulk Up',     tag: 'High-Protein',      Icon: Zap,    color: Palette.amber },
  { label: 'Cut & Lean',  tag: 'Low-Calorie',        Icon: Flame,  color: Palette.danger },
  { label: 'Keto',        tag: 'Keto',               Icon: Leaf,   color: '#8B5CF6' },
  { label: 'Plant-Based', tag: 'Vegan-Friendly',     Icon: Sprout, color: '#22C55E' },
  { label: 'Diabetic',    tag: 'Diabetic-Friendly',  Icon: Heart,  color: '#3B82F6' },
];

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3 }}>{title}</Text>
      {onSeeAll ? (
        <PressableScale onPress={() => { feedback.tap(); onSeeAll!(); }} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>see all</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const CITIES = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
  'Atlanta, GA', 'Washington, DC', 'Miami, FL', 'London, UK', 'Lagos, NG',
];

export default function ExploreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: preppers, isLoading: preppersLoading, isError: preppersError, refetch: refetchPreppers } = useTopPreppers();
  const { data: kitchenTags, refetch: refetchTags } = useKitchenTags();
  const { data: meals, isLoading: mealsLoading, isError: mealsError, refetch: refetchMeals } = useFeaturedMeals();
  const { data: drops, refetch: refetchDrops } = useLimitedDrops(6);
  const forYou = usePersonalizedMeals(meals ?? [], user?.id).slice(0, 6);
  const rankedPreppers = useRankedPreppers(preppers ?? [], user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState('New York, NY');
  const [locationOpen, setLocationOpen] = useState(false);
  const bp = useBreakpoint();
  const pad = usePagePadding();
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetchPreppers(), refetchTags(), refetchMeals(), refetchDrops()]); setRefreshing(false); }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 130 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6 }}>explore</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
                amazing meals from <Text style={{ fontFamily: Font.semibold, color: ORANGE }}>local preppers</Text>
              </Text>
            </View>
            <PressableScale
              onPress={() => { feedback.tap(); setLocationOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel={`Delivery location: ${location}. Tap to change.`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 9 }}>
              <MapPin size={14} color={ORANGE} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }} numberOfLines={1}>{location.split(',')[0]}</Text>
              <ChevronDown size={14} color={Palette.textSecondary} />
            </PressableScale>
          </View>

          {/* Search */}
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/search'); }}
            accessibilityRole="search"
            accessibilityLabel="Search meals, cuisines, or preppers"
            style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 8, backgroundColor: Palette.surface, borderRadius: 18, paddingHorizontal: 16, height: 46, gap: 10 }}>
            <Search size={20} color={MUTED} />
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 15, color: MUTED }}>search meals, cuisines, or preppers</Text>
            <SlidersHorizontal size={19} color={ORANGE} />
          </PressableScale>

          {/* Trending chips — quick-tap discovery below the search bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingTop: 10, paddingBottom: 2 }}>
            {TRENDING.map((term, i) => (
              <MotiView key={term} from={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 200, delay: i * 40 }}>
                <PressableScale
                  onPress={() => { feedback.tap(); router.push(`/search?q=${encodeURIComponent(term)}`); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${term}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 13, borderRadius: Radius.pill, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border }}>
                  <Search size={11} color={Palette.textMuted} />
                  <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.inkSoft }}>{term}</Text>
                </PressableScale>
              </MotiView>
            ))}
          </ScrollView>

          {/* Error banner — shown when primary data queries fail */}
          {(preppersError || mealsError) && !preppersLoading && !mealsLoading ? (
            <PressableScale onPress={handleRefresh} accessibilityRole="button" accessibilityLabel="Data failed to load. Tap to retry." style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 12, backgroundColor: Palette.danger + '14', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }}>
              <AlertCircle size={18} color={Palette.danger} />
              <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger }}>Couldn't load meals. Tap to retry.</Text>
            </PressableScale>
          ) : null}

          {/* Categories — horizontal scroll on phone, wrapping grid on tablet+ */}
          {(() => {
            const items = exploreCategories.map((c, i) => {
              const Icon = ICONS[c.icon] ?? MoreHorizontal;
              const active = i === 0;
              const onPress = () => { feedback.tap(); if (c.key === 'more') router.push('/category?key=all&label=all meals'); else router.push(`/category?key=${c.key}&label=${encodeURIComponent(c.label)}`); };
              return (
                <PressableScale key={c.key} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${c.label} meals`} style={{ alignItems: 'center', gap: 6, width: 58 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: active ? Palette.brandTint : Palette.surface, alignItems: 'center', justifyContent: 'center', borderWidth: active ? 1 : 0, borderColor: '#F8C9B0' }}>
                    <Icon size={22} color={c.color} />
                  </View>
                  <Text style={{ fontFamily: active ? Font.semibold : Font.medium, fontSize: 12, color: active ? ORANGE : Palette.inkSoft }}>{c.label}</Text>
                </PressableScale>
              );
            });
            return bp !== 'mobile'
              ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 14, paddingVertical: 14 }}>{items}</View>
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingVertical: 10 }}>{items}</ScrollView>;
          })()}

          {/* Cuisines */}
          <SectionHeader title="cuisines" onSeeAll={() => { feedback.tap(); router.push('/cuisine-explorer'); }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 20 }}>
            {cuisines.map((c) => (
              <CuisineCard key={c.id} cuisine={c} onPress={() => router.push(`/search?q=${encodeURIComponent(c.name)}`)} />
            ))}
          </ScrollView>

          {/* Find your kind of kitchen — identity/diet/cuisine discovery */}
          {kitchenTags && kitchenTags.length > 0 ? (
            <>
              <SectionHeader title="find your kind of kitchen" onSeeAll={() => router.push('/kitchens')} />
              {bp !== 'mobile' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 8, paddingBottom: 20 }}>
                  {kitchenTags.map((t) => (
                    <PressableScale key={t.tag} onPress={() => { feedback.tap(); router.push(`/kitchens?tag=${encodeURIComponent(t.tag)}`); }} accessibilityRole="button" accessibilityLabel={`${t.tag} kitchens`} style={{ paddingHorizontal: 16, height: 42, borderRadius: Radius.pill, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, ...Shadow.card }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{t.tag}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, fontVariant: ['tabular-nums'] }}>{t.count}</Text>
                    </PressableScale>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 20 }}>
                  {kitchenTags.map((t) => (
                    <PressableScale key={t.tag} onPress={() => { feedback.tap(); router.push(`/kitchens?tag=${encodeURIComponent(t.tag)}`); }} accessibilityRole="button" accessibilityLabel={`${t.tag} kitchens`} style={{ paddingHorizontal: 16, height: 42, borderRadius: Radius.pill, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, ...Shadow.card }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{t.tag}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, fontVariant: ['tabular-nums'] }}>{t.count}</Text>
                    </PressableScale>
                  ))}
                </ScrollView>
              )}
            </>
          ) : null}

          {/* Fitness goals — nutrition-focused kitchen discovery */}
          <View style={{ marginBottom: 10 }}>
            <SectionHeader title="shop by goal" onSeeAll={() => router.push('/kitchens')} />
            {bp !== 'mobile' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 14, paddingBottom: 20 }}>
                {GOALS.map((g) => (
                  <PressableScale key={g.tag} onPress={() => { feedback.tap(); router.push(`/kitchens?tag=${encodeURIComponent(g.tag)}`); }} accessibilityRole="button" accessibilityLabel={`${g.label} meal prep kitchens`} style={{ alignItems: 'center', gap: 8, width: 68 }}>
                    <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: g.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <g.Icon size={26} color={g.color} />
                    </View>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: INK, textAlign: 'center' }}>{g.label}</Text>
                  </PressableScale>
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 20 }}>
                {GOALS.map((g) => (
                  <PressableScale key={g.tag} onPress={() => { feedback.tap(); router.push(`/kitchens?tag=${encodeURIComponent(g.tag)}`); }} accessibilityRole="button" accessibilityLabel={`${g.label} meal prep kitchens`} style={{ alignItems: 'center', gap: 8, width: 68 }}>
                    <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: g.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <g.Icon size={26} color={g.color} />
                    </View>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: INK, textAlign: 'center' }}>{g.label}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Top kitchens — personalised ranking via match engine */}
          <SectionHeader title="top kitchens · for you" />
          {preppersLoading ? (
            <View style={{ paddingBottom: 20 }}><CardRowSkeleton count={3} width={210} /></View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 20 }}>
              {rankedPreppers.map((p, i) => (
                <MotiView key={p.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
                  <PrepperCard prepper={p} showRank />
                </MotiView>
              ))}
            </ScrollView>
          )}

          {/* Grocery concierge — ingredient kits banner */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
          <PressableScale onPress={() => { feedback.tap(); router.push('/grocery-concierge'); }} accessibilityRole="button" accessibilityLabel="Grocery concierge — ingredient kits"
            style={{ marginHorizontal: 20, backgroundColor: INK, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: Palette.brand + '22', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={21} color={Palette.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>grocery concierge</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Pre-portioned ingredient kits from local preppers</Text>
            </View>
            <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
          </PressableScale>
          </MotiView>

          {/* Limited drops — only shown when active drops exist */}
          {drops && drops.length > 0 ? (
            <>
              <SectionHeader title="limited drops" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 20 }}>
                {drops.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                    <MealCard meal={m} />
                  </MotiView>
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* Popular (live) */}
          <SectionHeader title="popular right now" onSeeAll={() => router.push('/category?key=all&label=popular')} />
          {mealsLoading ? (
            <View style={{ paddingBottom: 20 }}><CardRowSkeleton count={3} /></View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 20 }}>
              {(meals ?? []).map((m, i) => (
                <MotiView key={m.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                  <MealCard meal={m} />
                </MotiView>
              ))}
            </ScrollView>
          )}

          {/* For you — personalized ranking */}
          {forYou.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
              <SectionHeader title="for you" onSeeAll={() => router.push('/category?key=all&label=for+you')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 20 }}>
                {forYou.map((s, i) => (
                  <MotiView key={s.meal.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                    <View>
                      <MealCard meal={s.meal} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 2 }}>
                        <Sparkles size={11} color={ORANGE} />
                        <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary, flex: 1 }}>{s.reason}</Text>
                      </View>
                    </View>
                  </MotiView>
                ))}
              </ScrollView>
            </MotiView>
          ) : null}

          {/* Can't decide — flat brand-tint accent */}
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/surprise'); }}
            accessibilityRole="button"
            accessibilityLabel="Surprise me with a meal"
            style={{ marginHorizontal: 20 }}>
            <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Compass size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>can&apos;t decide?</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>let our chef assistant find the perfect meal</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: INK, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 9, gap: 5 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>surprise me</Text>
                <Sparkles size={13} color={ORANGE} />
              </View>
            </View>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>

      {/* Location picker overlay */}
      <Modal visible={locationOpen} transparent animationType="slide" onRequestClose={() => setLocationOpen(false)}>
        <Pressable onPress={() => setLocationOpen(false)} style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, ...(bp !== 'mobile' ? { maxWidth: 540, alignSelf: 'center', width: '100%' } : {}) }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginTop: 12, marginBottom: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 14 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.4 }}>your location</Text>
              <PressableScale onPress={() => { feedback.tap(); setLocationOpen(false); }} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={Palette.textSecondary} />
              </PressableScale>
            </View>
            {CITIES.map((city, i) => (
              <PressableScale
                key={city}
                onPress={() => { feedback.tap(); setLocation(city); setLocationOpen(false); }}
                accessibilityRole="button"
                accessibilityLabel={`Set location to ${city}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 15, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: location === city ? Palette.brandTint : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={16} color={location === city ? ORANGE : Palette.textMuted} />
                </View>
                <Text style={{ flex: 1, fontFamily: location === city ? Font.semibold : Font.medium, fontSize: 15, color: location === city ? ORANGE : INK }}>{city}</Text>
                {location === city ? <Check size={18} color={ORANGE} /> : null}
              </PressableScale>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
