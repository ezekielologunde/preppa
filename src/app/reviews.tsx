import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronLeft, MessageSquare, Sparkles, Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { useMyPrepperApplication, usePrepperProfile } from '@/lib/queries/preppers';
import { usePrepperReviews } from '@/lib/queries/reviews';
import { Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useState } from 'react';

const ORANGE = Palette.brand;
const INK = Palette.ink;

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} color={n <= Math.round(rating) ? Palette.amber : Palette.border} fill={n <= Math.round(rating) ? Palette.amber : 'none'} />
      ))}
    </View>
  );
}

function ratingLabel(avg: number): string {
  if (avg >= 4.8) return 'Outstanding';
  if (avg >= 4.5) return 'Excellent';
  if (avg >= 4.0) return 'Great';
  if (avg >= 3.5) return 'Good';
  return 'Improving';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ReviewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application } = useMyPrepperApplication(user?.id);
  const prepperId = application?.prepperId ?? application?.id;
  const { data: profile } = usePrepperProfile(prepperId);
  const { data: reviews, isLoading, refetch } = usePrepperReviews(prepperId, 50);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }

  const avg = reviews?.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews?.filter((r) => Math.round(r.rating) === n).length ?? 0,
  }));
  const maxCount = Math.max(...ratingCounts.map((r) => r.count), 1);

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>my reviews</Text>
        </View>

        {isLoading ? (
          <ListSkeleton count={4} rowHeight={80} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}>

            {/* Rating hero */}
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 20, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: Font.display, fontSize: 52, color: INK, letterSpacing: -2, fontVariant: ['tabular-nums'] }}>{avg > 0 ? avg.toFixed(1) : '—'}</Text>
                  <Stars rating={avg} size={18} />
                  <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textMuted }}>{reviews?.length ?? 0} review{reviews?.length !== 1 ? 's' : ''}</Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  {ratingCounts.map(({ n, count }, i) => (
                    <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textMuted, width: 8 }}>{n}</Text>
                      <View style={{ flex: 1, height: 6, backgroundColor: Palette.border, borderRadius: 3, overflow: 'hidden' }}>
                        <MotiView
                          from={{ width: '0%' }}
                          animate={{ width: `${(count / maxCount) * 100}%` }}
                          transition={{ type: 'timing', duration: 600, delay: 100 + i * 60 }}
                          style={{ height: 6, borderRadius: 3, backgroundColor: Palette.amber }}
                        />
                      </View>
                      <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textMuted, width: 16, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{count}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {avg > 0 ? (
                <View style={{ backgroundColor: Palette.brandTint, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={13} color={ORANGE} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>{ratingLabel(avg)}</Text>
                </View>
              ) : null}
            </View>
            </MotiView>

            {/* Response tip */}
            {reviews && reviews.length > 0 ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
              <View style={{ backgroundColor: INK, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <MessageSquare size={15} color={ORANGE} />
                </View>
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 }}>
                  Preppers who respond to reviews within 24 hours see <Text style={{ fontFamily: Font.semibold, color: '#fff' }}>38% more repeat orders.</Text> Even a short "thank you" counts.
                </Text>
              </View>
              </MotiView>
            ) : null}

            {/* Review list */}
            {!reviews || reviews.length === 0 ? (
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
              <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                <Star size={32} color={Palette.textMuted} />
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.textSecondary }}>no reviews yet</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, textAlign: 'center' }}>
                  Complete your first orders and customers will leave reviews here.
                </Text>
              </View>
              </MotiView>
            ) : (
              reviews.map((r, i) => (
                <MotiView key={r.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: 100 + i * 30 }}>
                <View style={{ backgroundColor: Palette.surface, borderRadius: 14, padding: 14, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Stars rating={r.rating} />
                    <View style={{ flex: 1 }} />
                    <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted }}>{relativeTime(r.created_at)}</Text>
                  </View>
                  {r.body ? (
                    <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20 }}>{r.body}</Text>
                  ) : (
                    <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, fontStyle: 'italic' }}>No written review</Text>
                  )}
                  {r.photos?.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 2 }}>
                      {r.photos.map((ph, pi) => (
                        <View key={pi} style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: Palette.canvas }}>
                          <Image source={ph} style={{ flex: 1 }} contentFit="cover" transition={200} />
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                  <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textMuted }}>— {r.author}</Text>
                </View>
                </MotiView>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
