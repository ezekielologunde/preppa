import { Image } from 'expo-image';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ImageIcon, Play, Plus, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { DayPicker } from '@/components/day-picker';
import { DIETARY_TAGS } from '@/constants/dietary';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { captureAndUploadImageNative, pickAndUploadMultipleImages, pickAndUploadMultipleNative, pickAndUploadMultipleVideosNative } from '@/lib/upload';
import { useMealCategories, useSaveMeal, type MealDraft } from '@/lib/queries/my-meals';
import { useTodaySingleStock, useSetMealStock } from '@/lib/queries/stock';

const ORANGE = Palette.brand;
const CARD   = '#FFFFFF';
const BG     = Palette.canvas;
const INK    = Palette.ink;
const SUB    = Palette.textSecondary;
const BORDER = '#EDE9E4';

const DROP_DURATIONS = [
  { key: '24h', label: '24 hours', hours: 24 },
  { key: '3d', label: '3 days', hours: 72 },
  { key: '7d', label: '1 week', hours: 168 },
  { key: 'none', label: 'No end', hours: null },
] as const;

function dropChipFor(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'none';
  const h = (new Date(expiresAt).getTime() - Date.now()) / 3_600_000;
  if (h <= 36) return '24h';
  if (h <= 120) return '3d';
  return '7d';
}

const ALLERGEN_CHIPS = ['gluten', 'dairy', 'eggs', 'nuts', 'peanuts', 'soy', 'shellfish', 'fish', 'sesame'] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: SUB }}>{label}</Text>
      {children}
    </View>
  );
}

const inputStyle = {
  backgroundColor: BG,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: BORDER,
  paddingHorizontal: 14,
  height: 48,
  fontFamily: Font.body,
  fontSize: 14.5,
  color: INK,
} as const;

const EMPTY: MealDraft = {
  title: '',
  description: '',
  base_price: 0,
  prep_time_min: null,
  category_id: null,
  imageUrls: [],
  videoUrls: [],
  is_limited: false,
  allergens: [],
  ingredients: [],
  calories: null,
  available_days: [],
  dietary_tags: [],
};

interface Props {
  draft: MealDraft | null;
  setDraft: React.Dispatch<React.SetStateAction<MealDraft | null>>;
  prepperId?: string | null;
  userId?: string;
  save: ReturnType<typeof useSaveMeal>;
}

export function MealEditorForm({ draft, setDraft, prepperId, userId, save }: Props) {
  const { data: categories } = useMealCategories();

  const [priceText, setPriceText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [caloriesText, setCaloriesText] = useState('');
  const [stockText, setStockText] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(true);

  const { data: todayStock } = useTodaySingleStock(draft?.id);
  const setMealStock = useSetMealStock();

  useEffect(() => {
    if (todayStock != null) {
      setStockText(String(todayStock.qtyTotal));
    }
  }, [todayStock]);

  async function pickPhoto() {
    if (!prepperId || !userId) return;
    const current = draft?.imageUrls.length ?? 0;
    const remaining = 5 - current;
    if (remaining <= 0) { setFormErr('Max 5 photos per meal.'); return; }
    setFormErr(null);

    if (Platform.OS === 'web') {
      setUploading(true);
      try {
        const urls = await pickAndUploadMultipleImages('meal-images', userId, remaining);
        if (urls.length) {
          setDraft((d) => d && { ...d, imageUrls: [...d.imageUrls, ...urls].slice(0, 5) });
          feedback.success();
        }
      } catch (e) {
        feedback.error();
        setFormErr(e instanceof Error ? e.message : 'Could not upload the photo.');
      } finally {
        setUploading(false);
      }
      return;
    }

    const source = await new Promise<'camera' | 'library' | null>((resolve) => {
      Alert.alert('Add photo', 'Choose a source', [
        { text: 'Camera', onPress: () => resolve('camera') },
        { text: 'Photo Library', onPress: () => resolve('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
    if (!source) return;

    setUploading(true);
    try {
      if (source === 'camera') {
        const url = await captureAndUploadImageNative('meal-images', userId);
        if (url) {
          setDraft((d) => d && { ...d, imageUrls: [...d.imageUrls, url].slice(0, 5) });
          feedback.success();
        }
      } else {
        const urls = await pickAndUploadMultipleNative('meal-images', userId, remaining);
        if (urls.length) {
          setDraft((d) => d && { ...d, imageUrls: [...d.imageUrls, ...urls].slice(0, 5) });
          feedback.success();
        }
      }
    } catch (e) {
      feedback.error();
      setFormErr(e instanceof Error ? e.message : 'Could not upload the photo.');
    } finally {
      setUploading(false);
    }
  }

  async function pickVideo() {
    if (!prepperId || !userId) return;
    const current = draft?.videoUrls?.length ?? 0;
    const remaining = 3 - current;
    if (remaining <= 0) { setFormErr('Max 3 videos per meal.'); return; }
    setFormErr(null);
    setUploadingVideo(true);
    try {
      const urls = await pickAndUploadMultipleVideosNative('meal-videos', userId, remaining);
      if (urls.length) {
        setDraft((d) => d && { ...d, videoUrls: [...(d.videoUrls ?? []), ...urls].slice(0, 3) });
        feedback.success();
      }
    } catch (e) {
      feedback.error();
      setFormErr(e instanceof Error ? e.message : 'Could not upload the video.');
    } finally {
      setUploadingVideo(false);
    }
  }

  function movePhoto(from: number, direction: 'left' | 'right') {
    feedback.tap();
    const to = direction === 'left' ? from - 1 : from + 1;
    setDraft((d) => {
      if (!d) return d;
      const arr = [...d.imageUrls];
      [arr[from], arr[to]] = [arr[to], arr[from]];
      return { ...d, imageUrls: arr };
    });
  }

  function validate(): { price: number; prep: number | null; cal: number | null } | null {
    if (!draft) return null;
    const price = Number(priceText);
    if (draft.title.trim().length < 3) { setFormErr('Give the meal a name (3+ characters).'); return null; }
    if (!Number.isFinite(price) || price <= 0) { setFormErr('Set a price greater than $0.'); return null; }
    if (price > 500) { setFormErr('Price looks too high — max $500 per meal.'); return null; }
    const prep = timeText.trim() ? Number(timeText) : null;
    if (prep !== null && (!Number.isInteger(prep) || prep <= 0 || prep > 480)) { setFormErr('Prep time should be 1–480 minutes.'); return null; }
    const cal = caloriesText.trim() ? Number(caloriesText) : null;
    if (cal !== null && (!Number.isInteger(cal) || cal <= 0 || cal > 9999)) { setFormErr('Calories should be a number between 1–9999.'); return null; }
    setFormErr(null);
    return { price, prep, cal };
  }

  function saveStockIfSet(mealId: string) {
    const qty = stockText.trim() ? Number(stockText.trim()) : null;
    if (qty !== null && Number.isInteger(qty) && qty >= 0) {
      setMealStock.mutate({ mealId, qty });
    }
  }

  function submit() {
    const v = validate();
    if (!v || !draft) return;
    save.mutate(
      { ...draft, base_price: Math.round(v.price * 100) / 100, prep_time_min: v.prep, calories: v.cal },
      {
        onSuccess: (mealId) => { feedback.success(); saveStockIfSet(mealId); setDraft(null); },
        onError: (e) => { feedback.error(); setFormErr(e instanceof Error ? e.message : 'Could not save the meal.'); },
      },
    );
  }

  function submitAndAddAnother() {
    const v = validate();
    if (!v || !draft) return;
    const prevCategoryId = draft.category_id;
    save.mutate(
      { ...draft, base_price: Math.round(v.price * 100) / 100, prep_time_min: v.prep, calories: v.cal },
      {
        onSuccess: (mealId) => {
          feedback.success();
          saveStockIfSet(mealId);
          setDraft({ ...EMPTY, category_id: prevCategoryId, videoUrls: [] });
          setPriceText('');
          setTimeText('');
          setCaloriesText('');
          setStockText('');
          setFormErr(null);
        },
        onError: (e) => { feedback.error(); setFormErr(e instanceof Error ? e.message : 'Could not save the meal.'); },
      },
    );
  }

  if (!draft) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setDraft(null)}>
      <Pressable onPress={() => setDraft(null)} accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1, backgroundColor: 'rgba(26,23,20,0.5)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ backgroundColor: CARD, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: 22, paddingBottom: 30, gap: 14, alignSelf: 'center', width: '100%', maxWidth: 480, maxHeight: '92%' }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }}>{draft.id ? 'edit meal' : 'new meal'}</Text>

            <Field label="NAME">
              <TextInput value={draft.title} onChangeText={(t) => setDraft((d) => d && { ...d, title: t })} placeholder="e.g. Honey Garlic Salmon Bowl" placeholderTextColor={SUB} style={inputStyle} maxLength={80} accessibilityLabel="Meal name" />
            </Field>

            <Field label="PRICE ($)">
              <TextInput value={priceText} onChangeText={setPriceText} placeholder="14.99" placeholderTextColor={SUB} keyboardType="decimal-pad" style={inputStyle} maxLength={7} accessibilityLabel="Meal price in dollars" />
            </Field>

            <Field label="CATEGORY">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(categories ?? []).map((c) => {
                  const sel = draft.category_id === c.id;
                  return (
                    <MotiView key={c.id} animate={{ backgroundColor: sel ? ORANGE : '#F0EDEA' }} transition={{ type: 'timing', duration: 180 }} style={{ borderRadius: Radius.pill, overflow: 'hidden' }}>
                      <PressableScale onPress={() => { feedback.tap(); setDraft((d) => d && { ...d, category_id: sel ? null : c.id }); }} accessibilityRole="button" accessibilityLabel={`Category ${c.name}`} accessibilityState={{ selected: sel }} style={{ paddingHorizontal: 13, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: sel ? '#fff' : SUB }}>{c.name}</Text>
                      </PressableScale>
                    </MotiView>
                  );
                })}
              </View>
            </Field>

            <Field label="DESCRIPTION">
              <TextInput value={draft.description} onChangeText={(t) => setDraft((d) => d && { ...d, description: t })} placeholder="What makes this meal great?" placeholderTextColor={SUB} multiline style={[inputStyle, { height: 84, paddingTop: 12, textAlignVertical: 'top' }]} maxLength={500} accessibilityLabel="Meal description" />
            </Field>

            {/* PHOTOS */}
            <Field label={`PHOTOS (${draft.imageUrls.length}/5)`}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {draft.imageUrls.map((url, i) => (
                  <View key={`${url}-${i}`} style={{ position: 'relative' }}>
                    <Image source={url} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" accessibilityLabel={`Meal photo ${i + 1}`} />
                    {i === 0 ? (
                      <View style={{ position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: '#fff', letterSpacing: 0.2 }}>cover</Text>
                      </View>
                    ) : null}
                    <View style={{ position: 'absolute', bottom: 4, right: 4, flexDirection: 'row', gap: 3 }}>
                      {i > 0 ? (
                        <PressableScale onPress={() => movePhoto(i, 'left')} accessibilityRole="button" accessibilityLabel={`Move photo ${i + 1} left`} style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                          <ChevronLeft size={10} color="#fff" strokeWidth={2.5} />
                        </PressableScale>
                      ) : null}
                      {i < draft.imageUrls.length - 1 ? (
                        <PressableScale onPress={() => movePhoto(i, 'right')} accessibilityRole="button" accessibilityLabel={`Move photo ${i + 1} right`} style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                          <ChevronRight size={10} color="#fff" strokeWidth={2.5} />
                        </PressableScale>
                      ) : null}
                    </View>
                    <PressableScale onPress={() => { feedback.tap(); setDraft((d) => d && { ...d, imageUrls: d.imageUrls.filter((_, j) => j !== i) }); }} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
                      <X size={12} color="#fff" strokeWidth={3} />
                    </PressableScale>
                  </View>
                ))}
                {draft.imageUrls.length < 5 ? (
                  <PressableScale onPress={() => { feedback.tap(); void pickPhoto(); }} disabled={uploading} accessibilityRole="button" accessibilityLabel="Add photo" style={{ width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, backgroundColor: '#F0EDEA', alignItems: 'center', justifyContent: 'center', opacity: uploading ? 0.5 : 1 }}>
                    {uploading ? <ActivityIndicator color={ORANGE} size="small" /> : <Plus size={22} color={SUB} />}
                  </PressableScale>
                ) : null}
              </ScrollView>
              {formErr?.includes('permission') || formErr?.includes('URL') ? (
                <TextInput value={draft.imageUrls[0] ?? ''} onChangeText={(t) => setDraft((d) => d && { ...d, imageUrls: t ? [t] : [] })} placeholder="Or paste image URL as fallback" placeholderTextColor={SUB} autoCapitalize="none" maxLength={500} style={[inputStyle, { marginTop: 8 }]} accessibilityLabel="Paste image URL as fallback" />
              ) : null}
            </Field>

            {/* VIDEOS */}
            <Field label={`VIDEOS (${draft.videoUrls?.length ?? 0}/3)`}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {(draft.videoUrls ?? []).map((url, i) => (
                  <View key={`${url}-${i}`} style={{ position: 'relative' }}>
                    <View style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: '#F0EDEA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <Play size={24} color={SUB} fill={SUB} />
                      <Text style={{ fontFamily: Font.body, fontSize: 9, color: SUB, marginTop: 3 }}>video</Text>
                    </View>
                    <PressableScale onPress={() => { feedback.tap(); setDraft((d) => d && { ...d, videoUrls: (d.videoUrls ?? []).filter((_, j) => j !== i) }); }} accessibilityRole="button" accessibilityLabel={`Remove video ${i + 1}`} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
                      <X size={12} color="#fff" strokeWidth={3} />
                    </PressableScale>
                  </View>
                ))}
                {(draft.videoUrls?.length ?? 0) < 3 ? (
                  <PressableScale onPress={() => { feedback.tap(); void pickVideo(); }} disabled={uploadingVideo} accessibilityRole="button" accessibilityLabel="Add video" style={{ width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, backgroundColor: '#F0EDEA', alignItems: 'center', justifyContent: 'center', opacity: uploadingVideo ? 0.5 : 1 }}>
                    {uploadingVideo ? <ActivityIndicator color={ORANGE} size="small" /> : (
                      <View style={{ alignItems: 'center', gap: 3 }}>
                        <Play size={18} color={SUB} />
                        <Text style={{ fontFamily: Font.body, fontSize: 9, color: SUB }}>+ video</Text>
                      </View>
                    )}
                  </PressableScale>
                ) : null}
              </ScrollView>
            </Field>

            {/* Limited drop toggle */}
            <PressableScale onPress={() => { feedback.tap(); setDraft((d) => d && { ...d, is_limited: !d.is_limited, expires_at: d.is_limited ? null : d.expires_at }); }} accessibilityRole="switch" accessibilityState={{ checked: !!draft.is_limited }} accessibilityLabel="Mark as limited drop" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 13 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>Limited drop</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: SUB }}>Show a &quot;limited drop&quot; badge — builds scarcity &amp; hype</Text>
              </View>
              <MotiView animate={{ backgroundColor: draft.is_limited ? ORANGE : '#D1CBC5' }} transition={{ type: 'timing', duration: 200 }} style={{ width: 44, height: 26, borderRadius: 13, padding: 3, marginLeft: 12 }}>
                <MotiView animate={{ translateX: draft.is_limited ? 18 : 0 }} transition={{ type: 'timing', duration: 200 }} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
              </MotiView>
            </PressableScale>

            {draft.is_limited ? (
              <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }} style={{ gap: 6 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: SUB }}>Drop ends</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {DROP_DURATIONS.map((d) => {
                    const on = dropChipFor(draft.expires_at) === d.key;
                    return (
                      <MotiView key={d.key} animate={{ backgroundColor: on ? ORANGE + '26' : '#F0EDEA', borderColor: on ? ORANGE : BORDER }} transition={{ type: 'timing', duration: 180 }} style={{ flex: 1, height: 38, borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' }}>
                        <PressableScale onPress={() => { feedback.tap(); setDraft((dr) => dr && { ...dr, expires_at: d.hours ? new Date(Date.now() + d.hours * 3_600_000).toISOString() : null }); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Drop ends: ${d.label}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: on ? ORANGE : SUB }}>{d.label}</Text>
                        </PressableScale>
                      </MotiView>
                    );
                  })}
                </View>
              </MotiView>
            ) : null}

            {/* Nutritional details — collapsible */}
            <PressableScale onPress={() => { feedback.tap(); setNutritionOpen((v) => !v); }} accessibilityRole="button" accessibilityLabel={nutritionOpen ? 'Collapse nutritional details' : 'Expand nutritional details'} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 13 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>Nutritional details</Text>
              {nutritionOpen ? <ChevronUp size={18} color={SUB} /> : <ChevronDown size={18} color={SUB} />}
            </PressableScale>

            {nutritionOpen ? (
              <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }} style={{ gap: 14 }}>
                <Field label="THIS MEAL CONTAINS (allergens)">
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {ALLERGEN_CHIPS.map((a) => {
                      const sel = (draft.allergens ?? []).includes(a);
                      return (
                        <MotiView key={a} animate={{ backgroundColor: sel ? Palette.amber + '25' : '#F0EDEA', borderColor: sel ? Palette.amber : BORDER }} transition={{ type: 'timing', duration: 180 }} style={{ borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}>
                          <PressableScale onPress={() => { feedback.tap(); setDraft((d) => { if (!d) return d; const cur = d.allergens ?? []; return { ...d, allergens: sel ? cur.filter((x) => x !== a) : [...cur, a] }; }); }} accessibilityRole="checkbox" accessibilityState={{ checked: sel }} accessibilityLabel={`Allergen: ${a}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34 }}>
                            {sel ? <AlertTriangle size={12} color={Palette.amber} /> : null}
                            <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: sel ? Palette.amber : SUB }}>{a}</Text>
                          </PressableScale>
                        </MotiView>
                      );
                    })}
                  </View>
                </Field>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="READY IN (MIN)">
                      <TextInput value={timeText} onChangeText={setTimeText} placeholder="30" placeholderTextColor={SUB} keyboardType="number-pad" style={inputStyle} maxLength={3} accessibilityLabel="Ready time in minutes" />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="~CAL PER SERVING">
                      <TextInput value={caloriesText} onChangeText={setCaloriesText} placeholder="450" placeholderTextColor={SUB} keyboardType="number-pad" style={inputStyle} maxLength={4} accessibilityLabel="Approximate calories per serving" />
                    </Field>
                  </View>
                </View>
              </MotiView>
            ) : null}

            {/* Dietary tags */}
            <Field label="DIETARY TAGS">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DIETARY_TAGS.map((t) => {
                  const sel = (draft.dietary_tags ?? []).includes(t.key);
                  return (
                    <MotiView key={t.key} animate={{ backgroundColor: sel ? '#10B98126' : '#F0EDEA', borderColor: sel ? '#10B981' : BORDER }} transition={{ type: 'timing', duration: 180 }} style={{ borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}>
                      <PressableScale
                        onPress={() => { feedback.tap(); setDraft((d) => { if (!d) return d; const cur = d.dietary_tags ?? []; return { ...d, dietary_tags: sel ? cur.filter((x) => x !== t.key) : [...cur, t.key] }; }); }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: sel }}
                        accessibilityLabel={`Dietary tag: ${t.label}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: sel ? '#10B981' : SUB }}>{t.emoji} {t.label}</Text>
                      </PressableScale>
                    </MotiView>
                  );
                })}
              </View>
            </Field>

            {/* Availability days */}
            <DayPicker
              selected={draft.available_days ?? []}
              onChange={(days) => setDraft((d) => d && { ...d, available_days: days })}
            />

            {/* Today's stock */}
            <Field label="TODAY'S STOCK">
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: SUB, marginBottom: 4 }}>
                How many portions are you making today?{'\n'}Leave empty = unlimited
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TextInput
                  value={stockText}
                  onChangeText={setStockText}
                  placeholder="e.g. 50"
                  placeholderTextColor={SUB}
                  keyboardType="number-pad"
                  style={[inputStyle, { flex: 1 }]}
                  maxLength={4}
                  accessibilityLabel="Today's portion count"
                />
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: SUB }}>portions</Text>
              </View>
            </Field>

            {formErr ? <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger }}>{formErr}</Text> : null}

            {/* Primary CTA */}
            <PressableScale onPress={() => { feedback.tap(); submit(); }} disabled={save.isPending} accessibilityRole="button" accessibilityLabel="Save meal" style={{ height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: save.isPending ? 0.7 : 1 }}>
              {save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>{draft.id ? 'Save changes' : 'Create meal'}</Text>}
            </PressableScale>

            {/* Save & add another — new meals only */}
            {!draft.id ? (
              <PressableScale onPress={() => { feedback.tap(); submitAndAddAnother(); }} disabled={save.isPending} accessibilityRole="button" accessibilityLabel="Save and add another meal" style={{ height: 48, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: save.isPending ? 0.6 : 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14.5, color: ORANGE }}>Save &amp; add another</Text>
              </PressableScale>
            ) : null}

            {!draft.id ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: SUB, textAlign: 'center' }}>New meals start as drafts — publish when you&apos;re ready.</Text> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export { EMPTY };
export type { Props as MealEditorFormProps };
