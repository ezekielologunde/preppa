import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Play, Star } from 'lucide-react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import type { ReviewCard as Review } from '@/lib/queries/reviews';

export function MealVideoStrip({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <View style={{ gap: 8, marginBottom: 4 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3 }}>cooking videos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {urls.map((url, idx) => (
          <PressableScale
            key={idx}
            onPress={() => { feedback.tap(); void Linking.openURL(url); }}
            accessibilityRole="button"
            accessibilityLabel={`Play cooking video ${idx + 1}`}
            style={{ width: 140, height: 100, borderRadius: 12, backgroundColor: Palette.prepperBg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={18} color="#fff" fill="#fff" />
            </View>
            <Text style={{ fontFamily: Font.body, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>tap to play</Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

export function MealReviewList({ reviews, allReviews, onToggleAll }: { reviews: Review[]; allReviews: boolean; onToggleAll: () => void }) {
  if (!reviews.length) return null;
  const shown = allReviews ? reviews : reviews.slice(0, 4);
  return (
    <View>
      <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3, marginBottom: 8 }}>reviews ({reviews.length})</Text>
      {shown.map((rv, i) => (
        <MotiView key={rv.id} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}
          style={{ paddingVertical: 11, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: Palette.divider, gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.ink }}>{rv.author}</Text>
            <View style={{ flexDirection: 'row', gap: 1 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={12} color={Palette.amber} fill={n <= rv.rating ? Palette.amber : 'transparent'} />
              ))}
            </View>
          </View>
          {rv.body ? <Text style={{ fontFamily: Font.body, fontSize: 13.5, lineHeight: 20, color: Palette.inkSoft }}>{rv.body}</Text> : null}
          {rv.prepper_reply ? (
            <View style={{ marginTop: 4, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: Palette.brand + '30' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textSecondary, marginBottom: 2 }}>Kitchen response</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, lineHeight: 18, color: Palette.inkSoft }}>{rv.prepper_reply}</Text>
            </View>
          ) : null}
          {rv.photos?.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 2 }}>
              {rv.photos.map((ph, pi) => (
                <View key={pi} style={{ width: 68, height: 68, borderRadius: 10, overflow: 'hidden', backgroundColor: Palette.canvas }}>
                  <Image source={ph} style={{ flex: 1 }} contentFit="cover" transition={200} />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </MotiView>
      ))}
      {reviews.length > 4 ? (
        <PressableScale onPress={() => { feedback.tap(); onToggleAll(); }} accessibilityRole="button" accessibilityLabel={allReviews ? 'Show fewer reviews' : `See all ${reviews.length} reviews`} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.brand }}>
            {allReviews ? 'show fewer' : `see all ${reviews.length} reviews`}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
