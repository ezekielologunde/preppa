import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Check, ChevronLeft, Star, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useSubmitReview } from '@/lib/queries/reviews';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type PhotoItem = { localUri: string; publicUrl: string | null; uploading: boolean };

async function uploadReviewPhoto(localUri: string, userId: string): Promise<string> {
  const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const path = `${userId}/reviews/${Date.now()}.${ext}`;
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const { data, error } = await supabase.storage
    .from('meal-images')
    .upload(path, decode(base64), { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('meal-images').getPublicUrl(data.path);
  return publicUrl;
}

const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

const ORANGE = Palette.brand;
const INK = Palette.ink;

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
const QUICK_PHRASES: Record<number, string[]> = {
  1: ['Arrived late', 'Wrong preorder', 'Not as described'],
  2: ['Below expectations', 'Portion was small', 'Needs improvement'],
  3: ['Pretty good', 'As expected', 'Would try again'],
  4: ['Really enjoyed it', 'Fresh and tasty', 'Good portions'],
  5: ['Absolutely delicious!', 'Perfect portions', 'Will have it again!', 'Exceeded expectations'],
};

export default function ReviewScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { orderId, prepperId, mealId, prepper } = useLocalSearchParams<{ orderId?: string; prepperId?: string; mealId?: string; prepper?: string }>();
  const submit = useSubmitReview();
  const [rating, setRating] = useState(0);
  const [tapped, setTapped] = useState(0); // tracks which star was last tapped for bounce
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: false });
    if (result.canceled || !result.assets[0] || !user) return;
    const uri = result.assets[0].uri;
    let idx = 0;
    setPhotos((prev) => { idx = prev.length; return [...prev, { localUri: uri, publicUrl: null, uploading: true }]; });
    try {
      const url = await uploadReviewPhoto(uri, user.id);
      setPhotos((prev) => prev.map((p, i) => i === idx ? { ...p, publicUrl: url, uploading: false } : p));
    } catch {
      setPhotos((prev) => prev.filter((_, i) => i !== idx));
      feedback.error();
      setErr('Photo upload failed. Try again.');
    }
  }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/orders'); }
  }

  function send() {
    if (!user || !orderId || !prepperId || rating < 1) return;
    if (photos.some((p) => p.uploading)) { feedback.warning(); return setErr('Please wait for photos to finish uploading.'); }
    setErr(null);
    const photoUrls = photos.filter((p) => p.publicUrl).map((p) => p.publicUrl!);
    submit.mutate(
      { orderId, authorId: user.id, prepperId, mealId: mealId || null, rating, body: cleanBlock(body).trim(), photos: photoUrls },
      { onSuccess: () => { feedback.success(); setDone(true); }, onError: (e) => { feedback.error(); setErr(e instanceof Error ? e.message : 'Could not submit review.'); } },
    );
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <MotiView from={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 180 }}>
            <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: Palette.success + '1F', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={36} color={Palette.success} strokeWidth={3} />
            </View>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, textAlign: 'center' }}>Thanks for the review!</Text>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>
              Your feedback helps {prepper ?? 'the prepper'} and other customers.
            </Text>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
            <PressableScale onPress={() => { feedback.tap(); router.replace('/orders'); }} accessibilityRole="button" accessibilityLabel="Back to preorders" style={{ marginTop: 6, paddingHorizontal: 24, height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Back to preorders</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>leave a review</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 48 }}>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center' }}>
              How was your preorder from {prepper ?? 'this prepper'}?
            </Text>
          </MotiView>

          {/* Star picker + rating label */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <PressableScale key={n} onPress={() => { feedback.tap(); setRating(n); setTapped(n); }} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} style={{ padding: 4 }}>
                    <MotiView
                      key={`star-${n}-${tapped === n ? tapped : 0}`}
                      from={{ scale: tapped === n ? 1.2 : 1 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 10, stiffness: 300 }}>
                      <Star size={32} color={n <= rating ? Palette.brand : Palette.chip} fill={n <= rating ? Palette.brand : Palette.chip} />
                    </MotiView>
                  </PressableScale>
                ))}
              </View>
              {rating > 0 ? (
                <MotiView from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 180 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brand }}>{RATING_LABELS[rating]}</Text>
                </MotiView>
              ) : null}
            </View>
          </MotiView>

          {/* Quick-phrase chips */}
          {rating > 0 && !body ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {(QUICK_PHRASES[rating] ?? []).map((phrase) => (
                  <PressableScale key={phrase} onPress={() => { feedback.tap(); setBody(phrase); }} accessibilityRole="button" accessibilityLabel={phrase}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Palette.canvas, borderWidth: 1, borderColor: Palette.border }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>{phrase}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </MotiView>
          ) : null}

          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 180 }}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Share a few words (optional)"
              placeholderTextColor={Palette.textMuted}
              multiline
              maxLength={1000}
              accessibilityLabel="Write your review"
              style={{ minHeight: 120, borderRadius: Radius.md, backgroundColor: Palette.canvas, padding: 16, fontFamily: Font.body, fontSize: 15, color: INK, textAlignVertical: 'top' }}
            />
          </MotiView>

          {/* Photo attachments */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 220 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary }}>Add photos (optional · up to 5)</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {photos.map((p, idx) => (
                  <View key={idx} style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', backgroundColor: Palette.canvas }}>
                    <Image source={{ uri: p.localUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    {p.uploading && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator color="#fff" size="small" />
                      </View>
                    )}
                    <PressableScale onPress={() => { feedback.tap(); setPhotos((prev) => prev.filter((_, i) => i !== idx)); }}
                      accessibilityRole="button" accessibilityLabel="Remove photo"
                      style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={11} color="#fff" />
                    </PressableScale>
                  </View>
                ))}
                {photos.length < 5 && (
                  <PressableScale onPress={() => { feedback.tap(); void pickPhoto(); }}
                    accessibilityRole="button" accessibilityLabel="Add photo"
                    style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.canvas, gap: 4 }}>
                    <Camera size={18} color={Palette.textSecondary} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 10, color: Palette.textSecondary }}>Add photo</Text>
                  </PressableScale>
                )}
              </View>
            </View>
          </MotiView>

          {err ? <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger, textAlign: 'center' }}>{err}</Text> : null}

          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 240 }}>
            <PressableScale
              onPress={() => { feedback.tap(); send(); }}
              disabled={rating < 1 || submit.isPending}
              accessibilityRole="button"
              accessibilityLabel="Submit review"
              style={{ height: 54, borderRadius: Radius.pill, backgroundColor: rating < 1 ? Palette.textMuted : ORANGE, alignItems: 'center', justifyContent: 'center', opacity: submit.isPending ? 0.7 : 1 }}>
              {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Submit review</Text>}
            </PressableScale>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </View>
    </KeyboardAvoidingView>
  );
}
