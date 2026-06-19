/**
 * KitchenReviews — review cards for the public kitchen profile.
 * Shows up to `limit` reviews with prepper replies and a "see all" link.
 */
import { Image } from 'expo-image';
import { MessageSquare, Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import type { ReviewCard } from '@/lib/queries/reviews';

interface KitchenReviewsProps {
  reviews: ReviewCard[];
  total: number;
  onSeeAll: () => void;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Star size={13} color={Palette.amber} fill={Palette.amber} />
      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.ink }}>{rating}</Text>
    </View>
  );
}

export function KitchenReviews({ reviews, total, onSeeAll }: KitchenReviewsProps) {
  if (!reviews.length) return null;

  return (
    <View style={{ marginTop: 24 }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 10 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink, letterSpacing: -0.3 }}>
          reviews{total > 0 ? ` (${total})` : ''}
        </Text>
        {total > reviews.length ? (
          <PressableScale onPress={onSeeAll} accessibilityRole="button" accessibilityLabel="See all reviews">
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.brand }}>see all →</Text>
          </PressableScale>
        ) : null}
      </View>

      <View style={{ gap: 10, marginHorizontal: 16 }}>
        {reviews.map((r, i) => (
          <MotiView
            key={r.id}
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
            <View style={{
              backgroundColor: Palette.surface,
              borderRadius: Radius.md,
              padding: 14,
              gap: 8,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
            }}>
              {/* Author + rating */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Avatar name={r.author} size={32} />
                <Text style={{ flex: 1, fontFamily: Font.heading, fontSize: 13.5, color: Palette.ink }}>{r.author}</Text>
                <StarRow rating={r.rating} />
              </View>

              {/* Review body */}
              {r.body ? (
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>
                  &ldquo;{r.body}&rdquo;
                </Text>
              ) : null}

              {/* Review photos */}
              {r.photos?.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 2 }}>
                  {r.photos.map((ph, pi) => (
                    <View key={pi} style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: Palette.canvas }}>
                      <Image source={ph} style={{ flex: 1 }} contentFit="cover" transition={200} />
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {/* Prepper reply */}
              {r.prepper_reply ? (
                <View style={{
                  backgroundColor: Palette.brandTint,
                  borderRadius: 12,
                  padding: 10,
                  gap: 4,
                  borderLeftWidth: 2.5,
                  borderLeftColor: Palette.brand,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <MessageSquare size={11} color={Palette.brand} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.brand }}>Kitchen reply</Text>
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.inkSoft, lineHeight: 18 }}>
                    {r.prepper_reply}
                  </Text>
                </View>
              ) : null}
            </View>
          </MotiView>
        ))}
      </View>
    </View>
  );
}
