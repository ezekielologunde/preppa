import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, Plus } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { usePlannerMeals, useToggleMealDay, type PlannerMeal } from '@/lib/queries/meal-planner';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const BG = Palette.prepperBg;
const CARD = Palette.prepperCard;
const INK = '#FFFFFF';
const MUTED = '#6B7280';
const TEXT2 = '#9CA3AF';
const BORDER = '#1E2330';

// ── Day chip ──────────────────────────────────────────────────────────────────

function DayChip({ day, active, onPress }: { day: string; active: boolean; onPress: () => void }) {
  return (
    <MotiView
      animate={{ backgroundColor: active ? Palette.brand : CARD, borderColor: active ? Palette.brand : BORDER }}
      transition={{ type: 'timing', duration: 180 }}
      style={{ borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden', minWidth: 48 }}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={DAY_LABELS[day]}
        accessibilityState={{ selected: active }}
        style={{ paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : TEXT2 }}>
          {DAY_LABELS[day]}
        </Text>
      </PressableScale>
    </MotiView>
  );
}

// ── Meal row ──────────────────────────────────────────────────────────────────

type MealRowProps = {
  meal: PlannerMeal;
  day: string;
  onToggle: (meal: PlannerMeal, day: string) => void;
  isPending: boolean;
};

function MealRow({ meal, day, onToggle, isPending }: MealRowProps) {
  const isAvailable = meal.availableDays.includes(day);
  const dayLabel = DAY_LABELS[day] ?? day;

  return (
    <PressableScale
      onPress={() => { feedback.tap(); onToggle(meal, day); }}
      disabled={isPending}
      accessibilityRole="button"
      accessibilityLabel={isAvailable ? `Remove ${meal.name} from ${dayLabel}` : `Add ${meal.name} for ${dayLabel}`}
      style={{ backgroundColor: CARD, borderRadius: 12, padding: 14, gap: 8, opacity: isPending ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }} numberOfLines={1}>
            {meal.name}
          </Text>
          {meal.category ? (
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>
              {meal.category}
            </Text>
          ) : null}
        </View>
        <MotiView
          animate={{ backgroundColor: isAvailable ? '#D1FAE5' : '#1d2129', borderColor: isAvailable ? '#065F46' : BORDER }}
          transition={{ type: 'timing', duration: 200 }}
          style={{ borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isAvailable ? '#065F46' : TEXT2 }}>
              {isAvailable ? `✓ Available ${dayLabel}` : `+ Add for ${dayLabel}`}
            </Text>
          </View>
        </MotiView>
      </View>
    </PressableScale>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PrepperMealPlannerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application, isLoading: appLoading } = useMyPrepperApplication(user?.id);
  const prepperId = application?.id ?? '';

  const { data: meals, isLoading, isError } = usePlannerMeals(prepperId);
  const toggleDay = useToggleMealDay(prepperId);

  // Optimistic local day overrides: mealId → days[]
  const [localDays, setLocalDays] = useState<Record<string, string[]>>({});
  const [selectedDay, setSelectedDay] = useState<string>('monday');

  function getMealDays(meal: PlannerMeal): string[] {
    return localDays[meal.id] ?? meal.availableDays;
  }

  function handleToggle(meal: PlannerMeal, day: string) {
    const current = getMealDays(meal);
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setLocalDays((prev) => ({ ...prev, [meal.id]: next }));
    toggleDay.mutate(
      { mealId: meal.id, day, currentDays: current },
      {
        onSuccess: (serverDays) => {
          setLocalDays((prev) => ({ ...prev, [meal.id]: serverDays }));
          feedback.success();
        },
        onError: () => {
          // Revert optimistic update
          setLocalDays((prev) => ({ ...prev, [meal.id]: current }));
          feedback.error();
        },
      },
    );
  }

  const dayMeals = (meals ?? []).filter((m) => getMealDays(m).includes(selectedDay));
  const otherMeals = (meals ?? []).filter((m) => !getMealDays(m).includes(selectedDay));

  function goBack() { feedback.tap(); if (router.canGoBack()) router.back(); else router.replace('/prepper-hub'); }

  const isReady = !appLoading && !!prepperId;
  const dayLabel = DAY_LABELS[selectedDay] ?? selectedDay;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>
              meal planner
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: TEXT2, marginTop: 1 }}>
              set which days each meal is available
            </Text>
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.brand + '22', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarDays size={18} color={Palette.brand} />
          </View>
        </View>

        {/* Day selector */}
        <View style={{ paddingBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}>
            {DAYS.map((day) => (
              <DayChip key={day} day={day} active={selectedDay === day}
                onPress={() => { feedback.tap(); setSelectedDay(day); }} />
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        {!isReady || isLoading ? (
          <View style={{ gap: 10, paddingHorizontal: 16 }}>
            {[1, 2, 3, 4].map((n) => <Skeleton key={n} height={72} radius={12} />)}
          </View>
        ) : isError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.danger, textAlign: 'center' }}>
              Could not load meals. Pull down to retry.
            </Text>
          </View>
        ) : (
          <FlatList
            data={[...dayMeals, ...otherMeals]}
            keyExtractor={(m) => m.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 100 }}
            ListHeaderComponent={
              <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: TEXT2, marginBottom: 4 }}>
                  {dayMeals.length} meal{dayMeals.length !== 1 ? 's' : ''} available on {dayLabel}
                </Text>
              </MotiView>
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 }}>
                <CalendarDays size={36} color={MUTED} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: TEXT2 }}>No meals yet</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, textAlign: 'center', maxWidth: 240 }}>
                  Add your first meal to start planning your weekly schedule.
                </Text>
              </View>
            }
            renderItem={({ item: meal }) => (
              <MotiView from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}>
                <MealRow
                  meal={{ ...meal, availableDays: getMealDays(meal) }}
                  day={selectedDay}
                  onToggle={handleToggle}
                  isPending={toggleDay.isPending && toggleDay.variables?.mealId === meal.id}
                />
              </MotiView>
            )}
          />
        )}

        {/* Add meal FAB */}
        <View style={{ position: 'absolute', bottom: 32, right: 20 }}>
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/meal-editor' as any); }}
            accessibilityRole="button"
            accessibilityLabel="Add a new meal"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 20, paddingVertical: 14 }}>
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Add meal</Text>
          </PressableScale>
        </View>

        {/* Pending spinner overlay */}
        {toggleDay.isPending ? (
          <View style={{ position: 'absolute', top: 16, right: 16 }}>
            <ActivityIndicator color={Palette.brand} size="small" />
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
