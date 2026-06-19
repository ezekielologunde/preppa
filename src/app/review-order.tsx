import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronLeft, Star, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Type } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useOrderForReview } from '@/lib/queries/orders';
import { useOrderReview, useSubmitOrderReview } from '@/lib/queries/reviews';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

// ── types ────────────────────────────────────────────────────────────────────

type PhotoItem = { localUri: string; publicUrl: string | null; uploading: boolean };

// ── helpers ──────────────────────────────────────────────────────────────────

async function uploadPhoto(localUri: string, userId: string): Promise<string> {
  const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const path = `${userId}/reviews/${Date.now()}.${ext}`;
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const { data, error } = await supabase.storage
    .from('meal-images')
    .upload(path, decode(base64), { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false });
  if (error) throw error;
  return supabase.storage.from('meal-images').getPublicUrl(data.path).data.publicUrl;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── sub-components ────────────────────────────────────────────────────────────

function Divider() {
  return <View style={{ height: 1, backgroundColor: Palette.border, marginVertical: 4 }} />;
}

function StarPicker({ rating, onChange }: { rating: number; onChange: (n: number) => void }) {
  const [lastTapped, setLastTapped] = useState(0);
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <PressableScale
          key={n}
          onPress={() => {
            feedback.impact();
            setLastTapped(n);
            onChange(n);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <MotiView
            key={`s${n}-${lastTapped === n ? lastTapped : 0}`}
            from={{ scale: lastTapped === n ? 0.8 : 1 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
            <Star
              size={32}
              color={n <= rating ? Palette.amber : Palette.border}
              fill={n <= rating ? Palette.amber : Palette.border}
            />
          </MotiView>
        </PressableScale>
      ))}
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function ReviewOrderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const orderQ = useOrderForReview(orderId ?? '');
  const existingQ = useOrderReview(orderId ?? '');
  const submit = useSubmitOrderReview();

  const order = orderQ.data;
  const existing = existingQ.data;

  // form state
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // derive the active meal id (auto-select when single item)
  const items = order?.items ?? [];
  const activeMealId = items.length === 1 ? (items[0]?.meal_id ?? null) : selectedMealId;

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/orders');
  }

  async function pickPhoto() {
    if (!user) return;
    if (photos.length >= 3) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    let idx = 0;
    setPhotos((prev) => {
      idx = prev.length;
      return [...prev, { localUri: uri, publicUrl: null, uploading: true }];
    });
    setPhotoErr(null);
    try {
      const url = await uploadPhoto(uri, user.id);
      setPhotos((prev) => prev.map((p, i) => (i === idx ? { ...p, publicUrl: url, uploading: false } : p)));
    } catch {
      setPhotos((prev) => prev.filter((_, i) => i !== idx));
      feedback.error();
      setPhotoErr('Photo upload failed. Try again.');
    }
  }

  function handleSubmit() {
    if (!user || !orderId || !order?.prepper) return;
    if (rating < 1) return;
    if (photos.some((p) => p.uploading)) {
      feedback.warning();
      Alert.alert('Please wait', 'Photos are still uploading.');
      return;
    }
    const prepperId = order.prepper.id;
    const mealId = activeMealId ?? items[0]?.meal_id ?? '';
    const photoUrls = photos.filter((p) => p.publicUrl).map((p) => p.publicUrl!);
    submit.mutate(
      { orderId, mealId, prepperId, rating, body, photos: photoUrls },
      {
        onSuccess: () => {
          feedback.success();
          if (router.canGoBack()) router.back();
          else router.replace('/orders');
        },
        onError: (e) => {
          feedback.error();
          Alert.alert('Could not submit', e instanceof Error ? e.message : 'Please try again.');
        },
      },
    );
  }

  // ── loading ──────────────────────────────────────────────────────────────────

  if (orderQ.isPending || existingQ.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={Palette.ink} />
            </PressableScale>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 }}>How was your order?</Text>
          </View>
          <ListSkeleton count={4} />
        </SafeAreaView>
      </View>
    );
  }

  // ── already reviewed (read-only banner) ──────────────────────────────────────

  if (existing) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={Palette.ink} />
            </PressableScale>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 }}>How was your order?</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
            <View style={{ backgroundColor: Palette.success + '14', borderWidth: 1, borderColor: Palette.success + '44', borderRadius: Radius.md, padding: 20, gap: 12 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.success }}>Review submitted</Text>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={20} color={n <= existing.rating ? Palette.amber : Palette.border} fill={n <= existing.rating ? Palette.amber : Palette.border} />
                ))}
              </View>
              {existing.body ? (
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.inkSoft, lineHeight: 21 }}>{existing.body}</Text>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ── review form ───────────────────────────────────────────────────────────────

  const prepper = order?.prepper ?? null;
  const orderDate = (order as any)?.created_at ? fmtDate((order as any).created_at) : '';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={Palette.ink} />
            </PressableScale>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 }}>How was your order?</Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 56 }}>

            {/* Prepper info */}
            {prepper ? (
              <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Avatar name={prepper.display_name} url={prepper.avatar_url} size={52} />
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: Type.body, color: Palette.ink }}>{prepper.display_name}</Text>
                    {orderDate ? <Text style={{ fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary }}>{orderDate}</Text> : null}
                  </View>
                </View>
              </MotiView>
            ) : null}

            <Divider />

            {/* Meal selector (only when multiple items) */}
            {items.length > 1 ? (
              <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
                <View style={{ gap: 12 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: Type.label, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Which meal are you reviewing?
                  </Text>
                  {items.map((it) => {
                    const isSelected = selectedMealId === it.meal_id;
                    return (
                      <PressableScale
                        key={it.meal_id}
                        onPress={() => { feedback.tap(); setSelectedMealId(it.meal_id); }}
                        accessibilityRole="radio"
                        accessibilityLabel={it.meal?.title ?? 'meal'}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          borderRadius: Radius.sm,
                          borderWidth: 1.5,
                          borderColor: isSelected ? Palette.brand : Palette.border,
                          backgroundColor: isSelected ? Palette.brandTint : Palette.surface,
                        }}>
                        {it.meal?.image ? (
                          <Image source={{ uri: it.meal.image }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" />
                        ) : (
                          <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: Palette.canvas }} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: Font.medium, fontSize: Type.body, color: Palette.ink }}>{it.meal?.title ?? 'Meal'}</Text>
                          {it.qty > 1 ? <Text style={{ fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary }}>x{it.qty}</Text> : null}
                        </View>
                        <View style={{
                          width: 20, height: 20, borderRadius: 10,
                          borderWidth: 2,
                          borderColor: isSelected ? Palette.brand : Palette.border,
                          backgroundColor: isSelected ? Palette.brand : Palette.surface,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} /> : null}
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              </MotiView>
            ) : null}

            {items.length > 1 ? <Divider /> : null}

            {/* Star rating */}
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
              <View style={{ gap: 10 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: Type.label, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Your rating
                </Text>
                <StarPicker rating={rating} onChange={setRating} />
              </View>
            </MotiView>

            <Divider />

            {/* Body text */}
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: Type.label, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Tell us more (optional)
                </Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Describe your experience..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  numberOfLines={5}
                  maxLength={500}
                  accessibilityLabel="Write your review"
                  style={{
                    minHeight: 110,
                    borderRadius: 16,
                    backgroundColor: Palette.surface,
                    borderWidth: 1,
                    borderColor: Palette.border,
                    padding: 14,
                    fontFamily: Font.body,
                    fontSize: Type.body,
                    color: Palette.ink,
                    textAlignVertical: 'top',
                  }}
                />
                <Text style={{ fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted, textAlign: 'right' }}>{body.length}/500</Text>
              </View>
            </MotiView>

            <Divider />

            {/* Photo upload */}
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
              <View style={{ gap: 10 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: Type.label, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Add photos
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  {photos.map((p, idx) => (
                    <View key={idx} style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: Palette.canvas }}>
                      <Image source={{ uri: p.localUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      {p.uploading && (
                        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                          <ActivityIndicator color="#fff" size="small" />
                        </View>
                      )}
                      <PressableScale
                        onPress={() => { feedback.tap(); setPhotos((prev) => prev.filter((_, i) => i !== idx)); }}
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo"
                        style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={10} color="#fff" />
                      </PressableScale>
                    </View>
                  ))}
                  {photos.length < 3 ? (
                    <PressableScale
                      onPress={() => { feedback.tap(); void pickPhoto(); }}
                      accessibilityRole="button"
                      accessibilityLabel="Add photo"
                      style={{
                        width: 56, height: 56, borderRadius: 12,
                        borderWidth: 1.5, borderColor: Palette.brand,
                        borderStyle: 'dashed',
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: Palette.brandTint,
                      }}>
                      <Camera size={20} color={Palette.brand} />
                    </PressableScale>
                  ) : null}
                </View>
                {photoErr ? <Text style={{ fontFamily: Font.medium, fontSize: Type.label, color: Palette.danger }}>{photoErr}</Text> : null}
              </View>
            </MotiView>

            {/* Submit */}
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 160 }}>
              <PressableScale
                onPress={() => { feedback.tap(); handleSubmit(); }}
                disabled={rating < 1 || submit.isPending}
                accessibilityRole="button"
                accessibilityLabel="Submit review"
                style={{
                  height: 54,
                  borderRadius: Radius.pill,
                  backgroundColor: rating < 1 ? Palette.textMuted : Palette.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: submit.isPending ? 0.75 : 1,
                  marginTop: 4,
                }}>
                {submit.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Submit review</Text>}
              </PressableScale>
            </MotiView>

          </ScrollView>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}
