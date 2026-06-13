import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ImageIcon, Plus, UtensilsCrossed, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { pickAndUploadImage, uploadSupported } from '@/lib/upload';
import { useMealCategories, useMyMeals, useSaveMeal, useSetMealStatus, type MealDraft, type MyMeal } from '@/lib/queries/my-meals';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';
import type { MealStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const CARD = Palette.prepperCard;
const BG = Palette.prepperBg;
const money = (n: number) => `$${n.toFixed(2)}`;

const STATUS_STYLE: Record<MealStatus, { label: string; color: string }> = {
  published: { label: 'live', color: Palette.success },
  draft: { label: 'draft', color: Palette.textMuted },
  paused: { label: 'paused', color: Palette.amber },
  archived: { label: 'archived', color: Palette.textSecondary },
};

const EMPTY: MealDraft = { title: '', description: '', base_price: 0, prep_time_min: null, category_id: null, imageUrls: [], is_limited: false };

const DROP_DURATIONS = [
  { key: '24h', label: '24 hours', hours: 24 },
  { key: '3d', label: '3 days', hours: 72 },
  { key: '7d', label: '1 week', hours: 168 },
  { key: 'none', label: 'No end', hours: null },
] as const;

/** Which duration chip matches a stored expiry (closest bucket). */
function dropChipFor(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'none';
  const h = (new Date(expiresAt).getTime() - Date.now()) / 3_600_000;
  if (h <= 36) return '24h';
  if (h <= 120) return '3d';
  return '7d';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.textMuted }}>{label}</Text>
      {children}
    </View>
  );
}

const inputStyle = {
  backgroundColor: '#1d2129',
  borderRadius: 12,
  paddingHorizontal: 14,
  height: 48,
  fontFamily: Font.body,
  fontSize: 14.5,
  color: '#fff',
} as const;

function MealRow({ meal, busy, onEdit, onSetStatus }: { meal: MyMeal; busy: boolean; onEdit: () => void; onSetStatus: (s: MealStatus) => void }) {
  const st = STATUS_STYLE[meal.status];
  const isLive = meal.status === 'published';
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 18, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      {meal.image ? (
        <Image source={meal.image} style={{ width: 58, height: 58, borderRadius: 13 }} contentFit="cover" accessibilityLabel={meal.title} />
      ) : (
        <View style={{ width: 58, height: 58, borderRadius: 13, backgroundColor: '#1d2129', alignItems: 'center', justifyContent: 'center' }}>
          <ImageIcon size={22} color="#5b6170" />
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: '#fff' }} numberOfLines={1}>{meal.title}</Text>
        <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textMuted, fontVariant: ['tabular-nums'] }}>{money(meal.base_price)}{meal.prep_time_min ? ` · ${meal.prep_time_min} min` : ''}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.color }} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: st.color }}>{st.label}</Text>
        </View>
      </View>
      <View style={{ gap: 6, alignItems: 'flex-end' }}>
        <PressableScale onPress={() => { feedback.tap(); onEdit(); }} accessibilityRole="button" accessibilityLabel={`Edit ${meal.title}`} hitSlop={6} style={{ paddingHorizontal: 12, height: 32, borderRadius: 10, borderWidth: 1, borderColor: '#3f4451', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.textMuted }}>Edit</Text>
        </PressableScale>
        <PressableScale
          onPress={() => { feedback.tap(); onSetStatus(isLive ? 'paused' : 'published'); }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={isLive ? `Pause ${meal.title}` : `Publish ${meal.title}`}
          hitSlop={6}
          style={{ paddingHorizontal: 12, height: 32, borderRadius: 10, backgroundColor: isLive ? '#252a34' : ORANGE, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: isLive ? Palette.textMuted : '#fff' }}>{isLive ? 'Pause' : 'Publish'}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

export default function MealEditorScreen() {
  const router = useRouter();
  const { drop } = useLocalSearchParams<{ drop?: string }>();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const prepperId = prepper?.id;
  const { data: meals, isLoading } = useMyMeals(prepperId);
  const { data: categories } = useMealCategories();
  const save = useSaveMeal(prepperId);
  const setStatus = useSetMealStatus();

  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [priceText, setPriceText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (drop === '1') {
      setDraft((d) => ({ ...EMPTY, is_limited: true }));
      setPriceText('');
      setTimeText('');
      setFormErr(null);
    }
  }, [drop]);

  async function pickPhoto() {
    if (!prepperId || !user?.id) return;
    if ((draft?.imageUrls.length ?? 0) >= 5) { setFormErr('Max 5 photos per meal.'); return; }
    setFormErr(null);
    setUploading(true);
    try {
      const url = await pickAndUploadImage('meal-images', user.id);
      if (url) { setDraft((d) => d && { ...d, imageUrls: [...d.imageUrls, url] }); feedback.success(); }
    } catch (e) {
      feedback.error();
      setFormErr(e instanceof Error ? e.message : 'Could not upload the photo.');
    } finally {
      setUploading(false);
    }
  }

  function openCreate() {
    setDraft({ ...EMPTY });
    setPriceText('');
    setTimeText('');
    setFormErr(null);
  }
  function openEdit(m: MyMeal) {
    setDraft({ id: m.id, title: m.title, description: m.description ?? '', base_price: m.base_price, prep_time_min: m.prep_time_min, category_id: m.category_id, imageUrls: m.images, is_limited: m.is_limited, expires_at: m.expires_at });
    setPriceText(String(m.base_price));
    setTimeText(m.prep_time_min ? String(m.prep_time_min) : '');
    setFormErr(null);
  }

  function submit() {
    if (!draft) return;
    const price = Number(priceText);
    if (draft.title.trim().length < 3) return setFormErr('Give the meal a name (3+ characters).');
    if (!Number.isFinite(price) || price <= 0) return setFormErr('Set a price greater than $0.');
    if (price > 500) return setFormErr('Price looks too high — max $500 per meal.');
    const prep = timeText.trim() ? Number(timeText) : null;
    if (prep !== null && (!Number.isInteger(prep) || prep <= 0 || prep > 480)) return setFormErr('Prep time should be 1–480 minutes.');
    setFormErr(null);
    save.mutate(
      { ...draft, base_price: Math.round(price * 100) / 100, prep_time_min: prep },
      {
        onSuccess: () => { feedback.success(); setDraft(null); },
        onError: (e) => { feedback.error(); setFormErr(e instanceof Error ? e.message : 'Could not save the meal.'); },
      },
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6 }}>my menu</Text>
          <PressableScale onPress={() => { feedback.tap(); openCreate(); }} accessibilityRole="button" accessibilityLabel="Add a new meal" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 13, backgroundColor: ORANGE }}>
            <Plus size={17} color="#fff" strokeWidth={2.6} />
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>New meal</Text>
          </PressableScale>
        </View>

        {!prepperId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <UtensilsCrossed size={28} color="#5b6170" />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>Approved preppers manage their menu here.</Text>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
        ) : !meals?.length ? (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <UtensilsCrossed size={28} color="#5b6170" />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Your menu is empty</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center', maxWidth: 280 }}>Add your first meal and publish it — customers see live meals instantly.</Text>
            <PressableScale onPress={() => { feedback.tap(); openCreate(); }} accessibilityRole="button" accessibilityLabel="Add your first meal" style={{ marginTop: 4, paddingHorizontal: 20, height: 48, borderRadius: 13, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Add your first meal</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, marginBottom: 4 }}>
              {meals.filter((m) => m.status === 'published').length} live · {meals.length} total
            </Text>
            {meals.map((m, i) => (
              <MotiView key={m.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                <MealRow meal={m} busy={setStatus.isPending} onEdit={() => openEdit(m)} onSetStatus={(s) => setStatus.mutate({ id: m.id, status: s })} />
              </MotiView>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Create / edit sheet */}
      <Modal visible={!!draft} transparent animationType="fade" onRequestClose={() => setDraft(null)}>
        <Pressable onPress={() => setDraft(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: CARD, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: 22, paddingBottom: 30, gap: 14, alignSelf: 'center', width: '100%', maxWidth: 480, maxHeight: '92%' }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>{draft?.id ? 'edit meal' : 'new meal'}</Text>
              <Field label="NAME">
                <TextInput value={draft?.title ?? ''} onChangeText={(t) => setDraft((d) => d && { ...d, title: t })} placeholder="e.g. Honey Garlic Salmon Bowl" placeholderTextColor="#4b5563" style={inputStyle} maxLength={80} />
              </Field>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="PRICE ($)">
                    <TextInput value={priceText} onChangeText={setPriceText} placeholder="14.99" placeholderTextColor="#4b5563" keyboardType="decimal-pad" style={inputStyle} maxLength={7} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="PREP TIME (MIN)">
                    <TextInput value={timeText} onChangeText={setTimeText} placeholder="30" placeholderTextColor="#4b5563" keyboardType="number-pad" style={inputStyle} maxLength={3} />
                  </Field>
                </View>
              </View>
              <Field label="CATEGORY">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(categories ?? []).map((c) => {
                    const sel = draft?.category_id === c.id;
                    return (
                      <MotiView
                        key={c.id}
                        animate={{ backgroundColor: sel ? ORANGE : '#1d2129' }}
                        transition={{ type: 'timing', duration: 180 }}
                        style={{ borderRadius: Radius.pill, overflow: 'hidden' }}>
                        <PressableScale
                          onPress={() => { feedback.tap(); setDraft((d) => d && { ...d, category_id: sel ? null : c.id }); }}
                          accessibilityRole="button"
                          accessibilityLabel={`Category ${c.name}`}
                          accessibilityState={{ selected: sel }}
                          style={{ paddingHorizontal: 13, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: sel ? '#fff' : Palette.textMuted }}>{c.name}</Text>
                        </PressableScale>
                      </MotiView>
                    );
                  })}
                </View>
              </Field>
              <Field label="DESCRIPTION">
                <TextInput value={draft?.description ?? ''} onChangeText={(t) => setDraft((d) => d && { ...d, description: t })} placeholder="What makes this meal great?" placeholderTextColor="#4b5563" multiline style={[inputStyle, { height: 84, paddingTop: 12, textAlignVertical: 'top' }]} maxLength={500} />
              </Field>
              <Field label={`PHOTOS (${draft?.imageUrls.length ?? 0}/5)`}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {(draft?.imageUrls ?? []).map((url, i) => (
                    <View key={`${url}-${i}`} style={{ position: 'relative' }}>
                      <Image source={url} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" accessibilityLabel={`Meal photo ${i + 1}`} />
                      <PressableScale
                        onPress={() => { feedback.tap(); setDraft((d) => d && { ...d, imageUrls: d.imageUrls.filter((_, j) => j !== i) }); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove photo ${i + 1}`}
                        style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={12} color="#fff" strokeWidth={3} />
                      </PressableScale>
                    </View>
                  ))}
                  {(draft?.imageUrls.length ?? 0) < 5 && uploadSupported ? (
                    <PressableScale onPress={() => { feedback.tap(); pickPhoto(); }} disabled={uploading} accessibilityRole="button" accessibilityLabel="Add photo" style={{ width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderColor: '#3f4451', alignItems: 'center', justifyContent: 'center', opacity: uploading ? 0.5 : 1 }}>
                      {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Plus size={22} color="#5b6170" />}
                    </PressableScale>
                  ) : null}
                  {(draft?.imageUrls.length ?? 0) < 5 && !uploadSupported ? (
                    <TextInput value={draft?.imageUrls[0] ?? ''} onChangeText={(t) => setDraft((d) => d && { ...d, imageUrls: t ? [t] : [] })} placeholder="Paste image URL" placeholderTextColor="#4b5563" autoCapitalize="none" style={[inputStyle, { minWidth: 200 }]} />
                  ) : null}
                </ScrollView>
              </Field>
              {/* Limited drop toggle */}
              <PressableScale
                onPress={() => { feedback.tap(); setDraft((d) => d && { ...d, is_limited: !d.is_limited, expires_at: d.is_limited ? null : d.expires_at }); }}
                accessibilityRole="switch"
                accessibilityState={{ checked: !!draft?.is_limited }}
                accessibilityLabel="Mark as limited drop"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1d2129', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Limited drop</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>Show a &quot;limited drop&quot; badge — builds scarcity & hype</Text>
                </View>
                <MotiView
                  animate={{ backgroundColor: draft?.is_limited ? ORANGE : '#374151' }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={{ width: 44, height: 26, borderRadius: 13, padding: 3, marginLeft: 12 }}>
                  <MotiView
                    animate={{ translateX: draft?.is_limited ? 18 : 0 }}
                    transition={{ type: 'timing', duration: 200 }}
                    style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }}
                  />
                </MotiView>
              </PressableScale>
              {draft?.is_limited ? (
                <MotiView
                  from={{ opacity: 0, translateY: -6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 220 }}
                  style={{ gap: 6 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.textMuted }}>Drop ends</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {DROP_DURATIONS.map((d) => {
                      const on = dropChipFor(draft?.expires_at) === d.key;
                      return (
                        <MotiView
                          key={d.key}
                          animate={{
                            backgroundColor: on ? ORANGE + '26' : '#1d2129',
                            borderColor: on ? ORANGE : '#1d2129',
                          }}
                          transition={{ type: 'timing', duration: 180 }}
                          style={{ flex: 1, height: 38, borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' }}>
                          <PressableScale
                            onPress={() => {
                              feedback.tap();
                              setDraft((dr) => dr && {
                                ...dr,
                                expires_at: d.hours ? new Date(Date.now() + d.hours * 3_600_000).toISOString() : null,
                              });
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={`Drop ends: ${d.label}`}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: on ? ORANGE : Palette.textMuted }}>{d.label}</Text>
                          </PressableScale>
                        </MotiView>
                      );
                    })}
                  </View>
                </MotiView>
              ) : null}

              {formErr ? <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#fca5a5' }}>{formErr}</Text> : null}
              <PressableScale onPress={() => { feedback.tap(); submit(); }} disabled={save.isPending} accessibilityRole="button" accessibilityLabel="Save meal" style={{ height: 52, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: save.isPending ? 0.7 : 1 }}>
                {save.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>{draft?.id ? 'Save changes' : 'Create meal'}</Text>}
              </PressableScale>
              {!draft?.id ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, textAlign: 'center' }}>New meals start as drafts — publish when you&apos;re ready.</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
