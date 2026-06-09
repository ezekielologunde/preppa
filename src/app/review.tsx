import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, Star } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useSubmitReview } from '@/lib/queries/reviews';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

export default function ReviewScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { orderId, prepperId, mealId, prepper } = useLocalSearchParams<{ orderId?: string; prepperId?: string; mealId?: string; prepper?: string }>();
  const submit = useSubmitReview();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/orders');
  }

  function send() {
    if (!user || !orderId || !prepperId || rating < 1) return;
    setErr(null);
    submit.mutate(
      { orderId, authorId: user.id, prepperId, mealId: mealId || null, rating, body },
      { onSuccess: () => setDone(true), onError: (e) => setErr(e instanceof Error ? e.message : 'Could not submit review.') },
    );
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: Palette.success + '1F', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={36} color={Palette.success} strokeWidth={3} />
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, textAlign: 'center' }}>Thanks for the review!</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>
            Your feedback helps {prepper ?? 'the prepper'} and other customers.
          </Text>
          <PressableScale onPress={() => router.replace('/orders')} accessibilityRole="button" accessibilityLabel="Back to orders" style={{ marginTop: 6, paddingHorizontal: 24, height: 52, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Back to orders</Text>
          </PressableScale>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>leave a review</Text>
        </View>

        <View style={{ padding: 24, gap: 20 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center' }}>
            How was your order from {prepper ?? 'this prepper'}?
          </Text>

          {/* Star picker */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <PressableScale key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} style={{ padding: 4 }}>
                <Star size={40} color={n <= rating ? '#fbbf24' : Palette.border} fill={n <= rating ? '#fbbf24' : 'transparent'} />
              </PressableScale>
            ))}
          </View>

          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Share a few words (optional)"
            placeholderTextColor={Palette.textMuted}
            multiline
            style={{ minHeight: 120, borderRadius: Radius.md, backgroundColor: Palette.canvas, padding: 16, fontFamily: Font.body, fontSize: 15, color: INK, textAlignVertical: 'top' }}
          />

          {err ? <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#ef4444', textAlign: 'center' }}>{err}</Text> : null}

          <PressableScale
            onPress={send}
            disabled={rating < 1 || submit.isPending}
            accessibilityRole="button"
            accessibilityLabel="Submit review"
            style={{ height: 54, borderRadius: 16, backgroundColor: rating < 1 ? Palette.textMuted : ORANGE, alignItems: 'center', justifyContent: 'center', opacity: submit.isPending ? 0.7 : 1 }}>
            {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Submit review</Text>}
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}
