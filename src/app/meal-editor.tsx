import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ImageIcon, Plus, UtensilsCrossed } from 'lucide-react-native';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealEditorForm, EMPTY } from '@/components/meal-editor-form';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyMeals, useSaveMeal, useSetMealStatus, type MealDraft, type MyMeal } from '@/lib/queries/my-meals';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';
import type { MealStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const CARD   = Palette.surface;
const BG     = Palette.canvas;
const INK    = Palette.ink;
const SUB    = Palette.textSecondary;
const BORDER = Palette.border;
const money  = (n: number) => `$${n.toFixed(2)}`;

const STATUS_STYLE: Record<MealStatus, { label: string; color: string }> = {
  published: { label: 'live',     color: Palette.success },
  draft:     { label: 'draft',    color: SUB },
  paused:    { label: 'paused',   color: Palette.amber },
  archived:  { label: 'archived', color: SUB },
};

function MealRow({ meal, busy, onEdit, onSetStatus }: { meal: MyMeal; busy: boolean; onEdit: () => void; onSetStatus: (s: MealStatus) => void }) {
  const st = STATUS_STYLE[meal.status];
  const isLive = meal.status === 'published';
  const isArchived = meal.status === 'archived';
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 18, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center', opacity: isArchived ? 0.55 : 1 }}>
      {meal.image ? (
        <Image source={meal.image} style={{ width: 58, height: 58, borderRadius: 13 }} contentFit="cover" accessibilityLabel={meal.title} />
      ) : (
        <View style={{ width: 58, height: 58, borderRadius: 13, backgroundColor: '#F0EDEA', alignItems: 'center', justifyContent: 'center' }}>
          <ImageIcon size={22} color={SUB} />
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }} numberOfLines={1}>{meal.title}</Text>
        <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: SUB, fontVariant: ['tabular-nums'] }}>{money(meal.base_price)}{meal.prep_time_min ? ` · ${meal.prep_time_min} min` : ''}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.color }} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: st.color }}>{st.label}</Text>
        </View>
      </View>
      <View style={{ gap: 6, alignItems: 'flex-end' }}>
        <PressableScale onPress={() => { feedback.tap(); onEdit(); }} accessibilityRole="button" accessibilityLabel={`Edit ${meal.title}`} hitSlop={6}
          style={{ paddingHorizontal: 12, height: 32, borderRadius: 10, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: SUB }}>Edit</Text>
        </PressableScale>
        {isArchived ? (
          <PressableScale onPress={() => { feedback.tap(); onSetStatus('draft'); }} disabled={busy} accessibilityRole="button" accessibilityLabel={`Restore ${meal.title} to draft`} hitSlop={6}
            style={{ paddingHorizontal: 12, height: 32, borderRadius: 10, backgroundColor: '#F0EDEA', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: SUB }}>Restore</Text>
          </PressableScale>
        ) : isLive ? (
          <PressableScale onPress={() => { feedback.tap(); onSetStatus('paused'); }} disabled={busy} accessibilityRole="button" accessibilityLabel={`Pause ${meal.title}`} hitSlop={6}
            style={{ paddingHorizontal: 12, height: 32, borderRadius: 10, backgroundColor: '#F0EDEA', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: SUB }}>Pause</Text>
          </PressableScale>
        ) : (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={() => { feedback.tap(); onSetStatus('published'); }} disabled={busy} accessibilityRole="button" accessibilityLabel={`Publish ${meal.title}`} hitSlop={6}
              style={{ paddingHorizontal: 10, height: 32, borderRadius: 10, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff' }}>Publish</Text>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); onSetStatus('archived'); }} disabled={busy} accessibilityRole="button" accessibilityLabel={`Archive ${meal.title}`} hitSlop={6}
              style={{ paddingHorizontal: 10, height: 32, borderRadius: 10, backgroundColor: '#F0EDEA', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: SUB }}>Archive</Text>
            </PressableScale>
          </View>
        )}
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
  const { data: meals, isLoading, isError, refetch } = useMyMeals(prepperId);
  const save = useSaveMeal(prepperId);
  const setStatus = useSetMealStatus();

  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);

  useEffect(() => {
    if (drop === '1') {
      setDraft({ ...EMPTY, is_limited: true });
    }
  }, [drop]);

  function openCreate() {
    setDraft({ ...EMPTY });
  }

  function openEdit(m: MyMeal) {
    setDraft({
      id: m.id,
      title: m.title,
      description: m.description ?? '',
      base_price: m.base_price,
      prep_time_min: m.prep_time_min,
      category_id: m.category_id,
      imageUrls: m.images,
      videoUrls: m.videoUrls ?? [],
      is_limited: m.is_limited,
      expires_at: m.expires_at,
      allergens: m.allergens ?? [],
      ingredients: m.ingredients ?? [],
      calories: null,
      available_days: m.available_days ?? [],
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>my menu</Text>
          <PressableScale onPress={() => { feedback.tap(); openCreate(); }} accessibilityRole="button" accessibilityLabel="Add a new meal"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: Radius.pill, backgroundColor: ORANGE }}>
            <Plus size={17} color="#fff" strokeWidth={2.6} />
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>New meal</Text>
          </PressableScale>
        </View>

        {!prepperId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <UtensilsCrossed size={28} color={SUB} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: SUB, textAlign: 'center' }}>Approved preppers manage their menu here.</Text>
          </View>
        ) : isLoading ? (
          <View style={{ padding: 20, gap: 12 }}>
            {[0, 1, 2, 3].map(i => <Skeleton key={i} width="100%" height={72} radius={16} />)}
          </View>
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: Palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
              <UtensilsCrossed size={28} color={SUB} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn&apos;t load your menu</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: SUB, textAlign: 'center', maxWidth: 280 }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading menu"
              style={{ marginTop: 4, paddingHorizontal: 20, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : !meals?.length ? (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: Palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
              <UtensilsCrossed size={28} color={SUB} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Your menu is empty</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: SUB, textAlign: 'center', maxWidth: 280 }}>Add your first meal and publish it — customers see live meals instantly.</Text>
            <PressableScale onPress={() => { feedback.tap(); openCreate(); }} accessibilityRole="button" accessibilityLabel="Add your first meal"
              style={{ marginTop: 4, paddingHorizontal: 20, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Add your first meal</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
            {statusErr ? (
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger, marginBottom: 4 }}>{statusErr}</Text>
            ) : null}
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: SUB, marginBottom: 4 }}>
              {(() => {
                const live = meals.filter((m) => m.status === 'published').length;
                const archived = meals.filter((m) => m.status === 'archived').length;
                const active = meals.length - archived;
                return `${live} live · ${active} active${archived > 0 ? ` · ${archived} archived` : ''}`;
              })()}
            </Text>
            {meals.map((m, i) => (
              <MotiView key={m.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                <MealRow meal={m} busy={setStatus.isPending} onEdit={() => openEdit(m)} onSetStatus={(s) => { setStatusErr(null); setStatus.mutate({ id: m.id, status: s }, { onError: () => { feedback.error(); setStatusErr('Could not update meal status. Please try again.'); } }); }} />
              </MotiView>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      <MealEditorForm
        draft={draft}
        setDraft={setDraft}
        prepperId={prepperId}
        userId={user?.id}
        save={save}
      />
    </View>
  );
}
