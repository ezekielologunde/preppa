import { useRouter } from 'expo-router';
import { BadgeCheck, ChevronLeft, ChevronRight, Heart, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { QuickAddButton } from '@/components/home-feed';
import { MealCard } from '@/components/meal-card';
import { CardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useFavoriteKeys } from '@/lib/favorites';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { useMealsByIds } from '@/lib/queries/meals';
import { usePrepperProfile } from '@/lib/queries/preppers';

const ORANGE = Palette.brand;
const INK = Palette.ink;

function PrepperByIdRow({ id }: { id: string }) {
  const router = useRouter();
  const { data: p, isLoading } = usePrepperProfile(id);
  if (isLoading) return <Skeleton width="100%" height={70} radius={16} />;
  if (!p) return null;
  return (
    <PressableScale onPress={() => { feedback.tap(); router.push(`/prepper?id=${id}`); }} accessibilityRole="button" accessibilityLabel={`View ${p.name}'s kitchen`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Palette.surface, borderRadius: 16, padding: 12 }}>
      <Avatar name={p.name} url={p.avatar ?? undefined} size={46} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{p.name}</Text>
          {p.verified ? <BadgeCheck size={14} color={ORANGE} fill={ORANGE} stroke="#fff" /> : null}
        </View>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>
          {p.city ? `${p.city} · ` : ''}{p.specialties.slice(0, 2).join(', ')}
        </Text>
      </View>
      <ChevronRight size={16} color={Palette.textMuted} />
    </PressableScale>
  );
}

export default function FavoritesScreen() {
  const router = useRouter();
  const allKeys = useFavoriteKeys();
  const mealIds = allKeys.filter((k) => k.startsWith('meal:')).map((k) => k.replace('meal:', ''));
  const prepperIds = allKeys.filter((k) => k.startsWith('prepper:')).map((k) => k.replace('prepper:', ''));
  const [tab, setTab] = useState<'meals' | 'kitchens'>('meals');
  const CARD_W = gridCardWidth(useContentWidth());
  const { data: favMeals, isLoading: mealsLoading, isError: mealsError, refetch: refetchMeals } = useMealsByIds(mealIds);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefreshMeals() { setRefreshing(true); await refetchMeals(); setRefreshing(false); }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.7, flex: 1 }}>favorites</Text>
        </View>

        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: Palette.surface, borderRadius: Radius.pill, padding: 4, gap: 4 }}>
          {(['meals', 'kitchens'] as const).map((t) => {
            const on = tab === t;
            const count = t === 'meals' ? mealIds.length : prepperIds.length;
            return (
              <MotiView
                key={t}
                animate={{ backgroundColor: on ? Palette.brand : 'transparent' }}
                transition={{ type: 'timing', duration: 200 }}
                style={{ flex: 1, borderRadius: Radius.pill, overflow: 'hidden' }}>
                <PressableScale
                  onPress={() => { feedback.tap(); setTab(t); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${t} tab, ${count} items`}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36 }}>
                  {t === 'meals' ? <Heart size={14} color={on ? '#fff' : Palette.textSecondary} fill={on ? '#fff' : 'transparent'} /> : <Users size={14} color={on ? '#fff' : Palette.textSecondary} />}
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: on ? '#fff' : Palette.inkSoft }}>
                    {t} {count > 0 ? `(${count})` : ''}
                  </Text>
                </PressableScale>
              </MotiView>
            );
          })}
        </View>

        {tab === 'meals' && mealsError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.danger + '1A', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={28} color={Palette.danger} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load favorites</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
              Check your connection and try again.
            </Text>
            <PressableScale onPress={() => { feedback.tap(); void refetchMeals(); }} accessibilityRole="button" accessibilityLabel="Retry loading favorites"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : tab === 'meals' && mealIds.length === 0 ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.danger + '1A', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={28} color={Palette.danger} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK }}>no favorites yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
              Tap the heart on any meal to save it here for quick access.
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/explore'); }}
              accessibilityRole="button"
              accessibilityLabel="Browse meals"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>browse meals</Text>
            </PressableScale>
          </MotiView>
        ) : tab === 'meals' ? (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefreshMeals} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {mealsLoading
              ? mealIds.map((id) => <CardSkeleton key={id} width={CARD_W} />)
              : (favMeals ?? []).map((meal, i) => (
                  <MotiView key={meal.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 210, delay: i * 25 }}>
                    <View style={{ position: 'relative' }}>
                      <MealCard meal={{ ...meal, image: meal.images?.[0] ?? '' }} width={CARD_W} />
                      <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                        <QuickAddButton meal={{ ...meal, image: meal.images?.[0] ?? '' }} />
                      </View>
                    </View>
                  </MotiView>
                ))}
          </ScrollView>
        ) : prepperIds.length === 0 ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={28} color="#8b5cf6" />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK }}>no kitchens followed</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
              Follow a kitchen on the prepper page to keep it here.
            </Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/explore'); }} accessibilityRole="button" accessibilityLabel="Discover kitchens"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>discover kitchens</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 10 }}>
            {prepperIds.map((id, i) => (
              <MotiView key={id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
                <PrepperByIdRow id={id} />
              </MotiView>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
