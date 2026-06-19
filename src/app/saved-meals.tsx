import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Bookmark, ChevronLeft, ChevronRight, Clock, Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { type SavedMealItem, useSavedMeals, useUnsaveMeal } from '@/lib/queries/saved-meals';
import { useAuth } from '@/providers/auth-provider';

// ─── Filter chips ──────────────────────────────────────────────────────────────
type FilterKey = 'all' | 'week' | 'oldest';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'week', label: 'This week' },
  { key: 'oldest', label: 'Oldest first' },
];

// ─── Individual saved-meal card ────────────────────────────────────────────────
function SavedCard({ item, width, onUnsave }: { item: SavedMealItem; width: number; onUnsave: () => void }) {
  const router = useRouter();
  const imgW = Math.floor(width);
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 220 }}
      style={{ width, backgroundColor: Palette.surface, borderRadius: 20, overflow: 'hidden', ...Shadow.card }}>
      {/* Meal image */}
      <PressableScale
        onPress={() => { feedback.tap(); router.push(`/meal?id=${item.id}`); }}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.title}`}
        style={{ width: imgW, height: 120 }}>
        <Image
          source={{ uri: imgUrl(item.images[0], imgW * 2) }}
          style={{ width: imgW, height: 120 }}
          contentFit="cover"
          transition={180}
        />
      </PressableScale>

      {/* Card body */}
      <View style={{ padding: 12, gap: 4 }}>
        {/* Title */}
        <Text numberOfLines={1} style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }}>
          {item.title}
        </Text>

        {/* Prepper */}
        <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>
          {item.prepper}
        </Text>

        {/* Price */}
        <Text style={{ fontFamily: Font.display, fontSize: 16, color: Palette.brand, letterSpacing: -0.3 }}>
          ${item.price.toFixed(2)}
        </Text>

        {/* Rating + time row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {item.rating > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Star size={11} color={Palette.amber} fill={Palette.amber} />
              <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textMuted }}>
                {item.rating.toFixed(1)}
              </Text>
            </View>
          ) : null}
          {item.time ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Clock size={11} color={Palette.textMuted} />
              <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted }}>{item.time}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {/* Unsave */}
          <PressableScale
            onPress={onUnsave}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.title} from saved`}
            style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: Palette.chip,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Bookmark size={16} color={Palette.brand} fill={Palette.brand} />
          </PressableScale>

          {/* View meal */}
          <PressableScale
            onPress={() => { feedback.tap(); router.push(`/meal?id=${item.id}`); }}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${item.title}`}
            style={{
              flex: 1, height: 36, borderRadius: 10,
              backgroundColor: Palette.brandTint,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brandPressed }}>view meal</Text>
            <ChevronRight size={13} color={Palette.brandPressed} />
          </PressableScale>
        </View>
      </View>
    </MotiView>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  const router = useRouter();
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 280 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 22,
        backgroundColor: Palette.brandTint,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Bookmark size={32} color={Palette.brand} />
      </View>
      <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink, letterSpacing: -0.4 }}>
        no saved meals yet
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
        Tap the bookmark icon on any meal to save it here.
      </Text>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/(tabs)/explore'); }}
        accessibilityRole="button"
        accessibilityLabel="Browse meals"
        style={{ marginTop: 6, backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>browse meals</Text>
      </PressableScale>
    </MotiView>
  );
}

// ─── Loading skeleton grid ─────────────────────────────────────────────────────
function LoadingGrid({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingTop: 8 }}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} width={cardWidth} height={250} radius={20} />
      ))}
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function SavedMealsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useSavedMeals(user?.id);
  const unsave = useUnsaveMeal(user?.id);

  const contentWidth = useContentWidth();
  const cardWidth = gridCardWidth(contentWidth, 16);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'week') {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return data.filter((m) => new Date(m.savedAt).getTime() >= cutoff);
    }
    if (filter === 'oldest') return [...data].reverse();
    return data;
  }, [data, filter]);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function handleUnsave(mealId: string, title: string) {
    feedback.tap();
    unsave.mutate(mealId, {
      onError: () => {
        // Silent — the item will reappear on next refetch.
      },
    });
    void title; // accessed for a11y label in SavedCard
  }

  const count = data?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>

          <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.7, flex: 1 }}>
            saved meals
          </Text>

          {count > 0 ? (
            <View style={{ backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, minWidth: 28, alignItems: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>{count}</Text>
            </View>
          ) : null}
        </View>

        {/* Filter chips */}
        {(data?.length ?? 0) > 0 ? (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <MotiView
                  key={f.key}
                  animate={{ backgroundColor: on ? Palette.brand : Palette.surface }}
                  transition={{ type: 'timing', duration: 160 }}
                  style={{ borderRadius: Radius.pill, overflow: 'hidden' }}>
                  <PressableScale
                    onPress={() => { feedback.tap(); setFilter(f.key); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={f.label}
                    style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? '#fff' : Palette.inkSoft }}>
                      {f.label}
                    </Text>
                  </PressableScale>
                </MotiView>
              );
            })}
          </View>
        ) : null}

        {/* Content */}
        {isLoading ? (
          <LoadingGrid cardWidth={cardWidth} />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 220 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>nothing here</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted }}>no saves in this time range</Text>
          </MotiView>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.savedId}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80, gap: 12 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Palette.brand}
                colors={[Palette.brand]}
              />
            }
            renderItem={({ item }) => (
              <SavedCard
                item={item}
                width={cardWidth}
                onUnsave={() => handleUnsave(item.id, item.title)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
