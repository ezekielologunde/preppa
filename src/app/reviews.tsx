import { useRouter } from 'expo-router';
import { ChevronLeft, MessageSquare, Send, Sparkles, Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { usePrepperReviews, useSubmitReply } from '@/lib/queries/reviews';
import { useAuth } from '@/providers/auth-provider';

const INK = Palette.ink;

type StarFilter = 'all' | 'low' | 'high';
const STAR_FILTERS: { key: StarFilter; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: Palette.brand },
  { key: 'low', label: '1–2★', color: '#ef4444' },
  { key: 'high', label: '4–5★', color: Palette.amber },
];

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

type ReviewCardProps = {
  r: { id: string; rating: number; body: string | null; author: string; created_at: string; photos: string[]; prepper_reply: string | null; replied_at: string | null };
  index: number;
};

function ReplyComposer({ reviewId, initialText, onDone }: { reviewId: string; initialText: string; onDone: () => void }) {
  const [draft, setDraft] = useState(initialText);
  const inputRef = useRef<TextInput>(null);
  const submit = useSubmitReply(reviewId);
  const MAX = 300;

  function handlePost() {
    if (!draft.trim() || submit.isPending) return;
    submit.mutate(draft, { onSuccess: onDone });
  }

  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted }}>your public response</Text>
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={(t) => setDraft(t.slice(0, MAX))}
        placeholder="Thank you for your kind words!"
        placeholderTextColor={Palette.textMuted}
        multiline
        autoFocus
        style={{ backgroundColor: Palette.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Font.body, fontSize: 13.5, color: INK, lineHeight: 20, minHeight: 72 }}
      />
      <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted, textAlign: 'right' }}>{draft.length}/{MAX}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PressableScale onPress={() => { feedback.tap(); onDone(); }} accessibilityRole="button"
          style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill, backgroundColor: Palette.canvas }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textMuted }}>Cancel</Text>
        </PressableScale>
        <TouchableOpacity onPress={handlePost} disabled={submit.isPending || !draft.trim()}
          accessibilityRole="button" accessibilityLabel="Post reply"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: submit.isPending || !draft.trim() ? Palette.border : Palette.brand, borderRadius: Radius.pill, paddingVertical: 9 }}>
          <Send size={13} color="#fff" />
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>{submit.isPending ? 'Posting…' : 'Post reply'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ReviewCard({ r, index }: ReviewCardProps) {
  const [composing, setComposing] = useState(false);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 240, delay: 100 + index * 45 }}
    >
      <View style={{ backgroundColor: Palette.surface, borderRadius: 14, padding: 14, gap: 10 }}>
        {/* Reviewer row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={r.author} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: INK }}>{r.author}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted }}>{relativeTime(r.created_at)}</Text>
          </View>
          <Stars rating={r.rating} size={13} />
        </View>

        {/* Review body */}
        {r.body ? (
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 21 }}>{r.body}</Text>
        ) : (
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, fontStyle: 'italic' }}>No written review</Text>
        )}

        {/* Reply section */}
        {composing ? (
          <ReplyComposer reviewId={r.id} initialText={r.prepper_reply ?? ''} onDone={() => setComposing(false)} />
        ) : r.prepper_reply ? (
          <View style={{ marginTop: 2, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: Palette.brand + '40', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textMuted }}>
                {'🍳 Kitchen\'s response'}
                {r.replied_at ? `  ${relativeTime(r.replied_at)}` : ''}
              </Text>
              <PressableScale onPress={() => { feedback.tap(); setComposing(true); }} accessibilityRole="button" accessibilityLabel="Edit reply">
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.brand }}>Edit reply</Text>
              </PressableScale>
            </View>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, lineHeight: 20, color: Palette.inkSoft }}>{r.prepper_reply}</Text>
          </View>
        ) : (
          <PressableScale onPress={() => { feedback.tap(); setComposing(true); }}
            accessibilityRole="button" accessibilityLabel="Reply to this review"
            style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Palette.canvas }}>
            <MessageSquare size={13} color={Palette.brand} />
            <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.brand }}>Reply to this review</Text>
          </PressableScale>
        )}
      </View>
    </MotiView>
  );
}

export default function ReviewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application } = useMyPrepperApplication(user?.id);
  const prepperId = application?.id;
  const { data: reviews, isLoading, isError, refetch } = usePrepperReviews(prepperId, 50);
  const [refreshing, setRefreshing] = useState(false);
  const [starFilter, setStarFilter] = useState<StarFilter>('all');

  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }
  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }

  const avg = reviews?.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews?.filter((r) => Math.round(r.rating) === n).length ?? 0 }));
  const maxCount = Math.max(...ratingCounts.map((r) => r.count), 1);
  const filteredReviews = starFilter === 'all'
    ? (reviews ?? [])
    : starFilter === 'low'
      ? (reviews ?? []).filter((r) => Math.round(r.rating) <= 2)
      : (reviews ?? []).filter((r) => Math.round(r.rating) >= 4);

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>reviews</Text>
          {reviews && reviews.length > 0 ? (
            <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Star size={11} color={Palette.brand} fill={Palette.brand} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brand }}>{reviews.length}</Text>
            </View>
          ) : null}
        </View>

        {isLoading ? (
          <ListSkeleton count={4} rowHeight={80} />
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Star size={28} color={Palette.textMuted} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load reviews</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading reviews"
              style={{ marginTop: 6, backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
            contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}>

            {/* Rating summary card */}
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
              <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 20, gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontFamily: Font.display, fontSize: 48, color: Palette.brand, letterSpacing: -2, fontVariant: ['tabular-nums'] }}>{avg > 0 ? avg.toFixed(1) : '—'}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted }}>out of 5</Text>
                    <Stars rating={avg} size={16} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK, marginTop: 2 }}>{reviews?.length ?? 0} review{reviews?.length !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    {ratingCounts.map(({ n, count }, i) => (
                      <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textMuted, width: 8 }}>{n}</Text>
                        <View style={{ flex: 1, height: 6, backgroundColor: Palette.border, borderRadius: 3, overflow: 'hidden' }}>
                          <MotiView
                            from={{ width: '0%' }}
                            animate={{ width: `${(count / maxCount) * 100}%` }}
                            transition={{ type: 'timing', duration: 600, delay: 100 + i * 60 }}
                            style={{ height: 6, borderRadius: 3, backgroundColor: Palette.brand }}
                          />
                        </View>
                        <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textMuted, width: 16, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                {avg > 0 ? (
                  <View style={{ backgroundColor: Palette.brandTint, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} color={Palette.brand} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>{ratingLabel(avg)}</Text>
                  </View>
                ) : null}
              </View>
            </MotiView>

            {/* Star filter chips */}
            {reviews && reviews.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {STAR_FILTERS.map(({ key, label, color }) => {
                  const active = starFilter === key;
                  return (
                    <PressableScale key={key} onPress={() => { feedback.tap(); setStarFilter(key); }}
                      accessibilityRole="button" accessibilityState={{ selected: active }}
                      style={{ backgroundColor: active ? color : Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: active ? '#fff' : Palette.textMuted }}>{label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}

            {/* Response tip */}
            {reviews && reviews.length > 0 ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
                <View style={{ backgroundColor: INK, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: Palette.brand + '22', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <MessageSquare size={15} color={Palette.brand} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 }}>
                    Preppers who respond to reviews within 24 hours see{' '}
                    <Text style={{ fontFamily: Font.semibold, color: '#fff' }}>38% more repeat orders.</Text>
                    {' '}Even a short "thank you" counts.
                  </Text>
                </View>
              </MotiView>
            ) : null}

            {/* Review list / empty state */}
            {!reviews || reviews.length === 0 ? (
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
                <View style={{ alignItems: 'center', paddingVertical: 48, gap: 14 }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={36} color={Palette.brand} fill={Palette.brand} />
                  </View>
                  <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK }}>No reviews yet</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 21 }}>
                    Complete your first preorders to get reviews
                  </Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>Great reviews = more preorders</Text>
                </View>
              </MotiView>
            ) : filteredReviews.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
                <Star size={28} color={Palette.textMuted} />
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>
                  no {starFilter === 'low' ? '1–2★' : '4–5★'} reviews
                </Text>
              </View>
            ) : (
              prepperId ? filteredReviews.map((r, i) => (
                <ReviewCard key={r.id} r={r} index={i} />
              )) : null
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
