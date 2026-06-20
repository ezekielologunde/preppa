import { useRouter } from 'expo-router';
import { ChefHat, ChevronLeft, MapPin, Search, Star, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useRef, useState } from 'react';
import {
  FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { type FollowedKitchen, useFollowingList, useUnfollowKitchen } from '@/lib/queries/follows';
import { useAuth } from '@/providers/auth-provider';

// ─── Kitchen row ──────────────────────────────────────────────────────────────

type RowState = 'idle' | 'unfollowing' | 'done';

function KitchenRow({ item, onUnfollow }: { item: FollowedKitchen; onUnfollow: (id: string) => void }) {
  const router = useRouter();
  const [state, setState] = useState<RowState>('idle');

  function handleUnfollow() {
    feedback.tap();
    setState('unfollowing');
    setTimeout(() => {
      onUnfollow(item.prepperId);
      setState('done');
    }, 320);
  }

  return (
    <MotiView
      animate={{ opacity: state === 'done' ? 0 : 1, scaleY: state === 'done' ? 0 : 1 }}
      transition={{ type: 'timing', duration: 260 }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { feedback.tap(); router.push(`/prepper?id=${item.prepperId}` as never); }}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.displayName} kitchen`}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: Palette.surface,
          marginHorizontal: 16, marginBottom: 10,
          borderRadius: 16, ...Shadow.card,
        }}
      >
        {/* Avatar */}
        <Avatar name={item.displayName} url={item.avatarUrl} size={52} />

        {/* Info */}
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.ink }}>
            {item.displayName}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {item.city ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MapPin size={11} color={Palette.textSecondary} />
                <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary }}>
                  {item.city}
                </Text>
              </View>
            ) : null}
            {item.rating > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Star size={11} color={Palette.amber} fill={Palette.amber} />
                <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary }}>
                  {item.rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
            {item.mealCount > 0 ? (
              <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary }}>
                {item.mealCount} meal{item.mealCount !== 1 ? 's' : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Unfollow button */}
        <PressableScale
          onPress={handleUnfollow}
          accessibilityRole="button"
          accessibilityLabel={`Unfollow ${item.displayName}`}
          disabled={state !== 'idle'}
          style={{
            height: 28, borderRadius: Radius.pill,
            paddingHorizontal: 12,
            borderWidth: 1.5,
            borderColor: state === 'unfollowing' ? Palette.success : Palette.brand,
            backgroundColor: state === 'unfollowing' ? Palette.success + '15' : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{
            fontFamily: Font.semibold, fontSize: 12,
            color: state === 'unfollowing' ? Palette.success : Palette.brand,
          }}>
            {state === 'unfollowing' ? 'done' : 'unfollow'}
          </Text>
        </PressableScale>
      </TouchableOpacity>
    </MotiView>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: Palette.surface,
      marginHorizontal: 16, marginBottom: 10,
      borderRadius: 16,
    }}>
      <Skeleton width={52} height={52} radius={26} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width={130} height={14} radius={6} />
        <Skeleton width={90} height={11} radius={5} />
      </View>
      <Skeleton width={70} height={28} radius={Radius.pill} />
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  const router = useRouter();
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 280 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}
    >
      <View style={{
        width: 64, height: 64, borderRadius: 20,
        backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center',
      }}>
        {filtered ? <Search size={28} color={Palette.brand} /> : <ChefHat size={28} color={Palette.brand} />}
      </View>
      <Text style={{ fontFamily: Font.heading, fontSize: 17, color: Palette.ink }}>
        {filtered ? 'no results' : "you're not following any kitchens"}
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
        {filtered
          ? 'Try a different name.'
          : 'Discover great kitchens and tap "Follow" on their page.'}
      </Text>
      {!filtered ? (
        <PressableScale
          onPress={() => { feedback.tap(); router.push('/(tabs)/explore' as never); }}
          accessibilityRole="button"
          accessibilityLabel="Browse kitchens"
          style={{ marginTop: 6, backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>browse kitchens</Text>
        </PressableScale>
      ) : null}
    </MotiView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FollowingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const { data, isLoading, isError, refetch } = useFollowingList(user?.id);
  const unfollow = useUnfollowKitchen(user?.id);

  const count = data?.length ?? 0;
  const showSearch = count >= 5 || query.length > 0;

  const filtered = query.trim()
    ? (data ?? []).filter((k) => k.displayName.toLowerCase().includes(query.toLowerCase().trim()))
    : (data ?? []);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function handleUnfollow(prepperId: string) {
    feedback.success();
    unfollow.mutate(prepperId);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)/profile' as never); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>

          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.7 }}>
              following
            </Text>
            {!isLoading ? (
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>
                {count > 0 ? `${count} kitchen${count !== 1 ? 's' : ''}` : 'no kitchens followed yet'}
              </Text>
            ) : null}
          </View>

          {count > 0 ? (
            <View style={{ backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, minWidth: 28, alignItems: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>{count}</Text>
            </View>
          ) : null}
        </View>

        {/* Search bar — only visible when count >= 5 */}
        {showSearch ? (
          <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              marginHorizontal: 16, marginBottom: 12,
              backgroundColor: Palette.surface, borderRadius: 12, paddingHorizontal: 12,
              borderWidth: 1, borderColor: Palette.border,
            }}>
              <Search size={16} color={Palette.textSecondary} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Search kitchens…"
                placeholderTextColor={Palette.textSecondary}
                style={{ flex: 1, height: 40, fontFamily: Font.body, fontSize: 14, color: Palette.ink }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <PressableScale onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Users size={16} color={Palette.textSecondary} />
                </PressableScale>
              ) : null}
            </View>
          </MotiView>
        ) : null}

        {/* Content */}
        {isLoading ? (
          <View style={{ paddingTop: 4 }}>
            {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </View>
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={28} color={Palette.brand} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>couldn't load kitchens</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
              Check your connection and try again.
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); void refetch(); }}
              accessibilityRole="button"
              accessibilityLabel="Retry"
              style={{ marginTop: 6, backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : count === 0 ? (
          <EmptyState filtered={false} />
        ) : filtered.length === 0 ? (
          <EmptyState filtered />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.prepperId}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Palette.brand}
                colors={[Palette.brand]}
              />
            }
            renderItem={({ item, index }) => (
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 220, delay: index * 30 }}
              >
                <KitchenRow item={item} onUnfollow={handleUnfollow} />
              </MotiView>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
