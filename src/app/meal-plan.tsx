import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMySubscriptions } from '@/lib/queries/meal-plans';
import { useAuth } from '@/providers/auth-provider';

// ─── Types ───────────────────────────────────────────────────────────────────

type MealSlotType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

type FilledMealSlot = {
  type: MealSlotType;
  name: string;
  imageUri?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type EmptyMealSlot = { type: MealSlotType };

type MealSlot = FilledMealSlot | EmptyMealSlot;

function isFilled(slot: MealSlot): slot is FilledMealSlot {
  return 'name' in slot;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MEAL_TYPES: MealSlotType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/** Returns date numbers for the current week starting Monday. */
function getWeekDates(): number[] {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sun
  // JS getDay: 0=Sun,1=Mon…6=Sat → offset to Monday-first
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return WEEK_DAYS.map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    return d.getDate();
  });
}

/** 0 = Mon … 6 = Sun (week-local). */
function todayWeekIndex(): number {
  const dow = new Date().getDay();
  return dow === 0 ? 6 : dow - 1;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WeekStripSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 16 }}>
      {WEEK_DAYS.map((d) => (
        <Skeleton key={d} width={48} height={64} radius={14} style={{ flex: 1 }} />
      ))}
    </View>
  );
}

function MealSlotSkeleton({ index }: { index: number }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 240, delay: index * 60 }}>
      <Skeleton width="100%" height={80} radius={18} style={{ marginBottom: 12 }} />
    </MotiView>
  );
}

// ─── Day Bubble ───────────────────────────────────────────────────────────────

type DayBubbleProps = {
  abbr: (typeof WEEK_DAYS)[number];
  date: number;
  active: boolean;
  index: number;
  onPress: () => void;
};

function DayBubble({ abbr, date, active, index, onPress }: DayBubbleProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 200, delay: index * 50 }}
      style={{ flex: 1 }}>
      <PressableScale
        onPress={() => { feedback.tap(); onPress(); }}
        accessibilityRole="button"
        accessibilityLabel={`${abbr} ${date}`}
        accessibilityState={{ selected: active }}
        style={{
          height: 64,
          width: 48,
          borderRadius: 14,
          backgroundColor: active ? Palette.brand : Palette.surface,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}>
        <Text
          style={{
            fontFamily: Font.semibold,
            fontSize: 11,
            color: active ? '#fff' : Palette.textSecondary,
          }}>
          {abbr}
        </Text>
        <Text
          style={{
            fontFamily: Font.display,
            fontSize: 20,
            color: active ? '#fff' : Palette.ink,
            lineHeight: 24,
          }}>
          {date}
        </Text>
      </PressableScale>
    </MotiView>
  );
}

// ─── Macros Bar ───────────────────────────────────────────────────────────────

type MacroCol = { label: string; value: number; unit: string };

function MacroColumn({ label, value, unit, showDivider }: MacroCol & { showDivider: boolean }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {showDivider ? (
        <View style={{ width: 1, backgroundColor: Palette.border, marginRight: 12, alignSelf: 'stretch' }} />
      ) : null}
      <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink, lineHeight: 22 }}>
            {value}
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, marginBottom: 2 }}>
            {unit}
          </Text>
        </View>
        <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function MacrosBar({ slots }: { slots: MealSlot[] }) {
  const filled = slots.filter(isFilled);
  const totals = filled.reduce(
    (acc, s) => ({
      calories: acc.calories + s.calories,
      protein: acc.protein + s.protein,
      carbs: acc.carbs + s.carbs,
      fat: acc.fat + s.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const cols: MacroCol[] = [
    { label: 'Calories', value: totals.calories, unit: 'kcal' },
    { label: 'Protein',  value: totals.protein,  unit: 'g' },
    { label: 'Carbs',    value: totals.carbs,     unit: 'g' },
    { label: 'Fat',      value: totals.fat,        unit: 'g' },
  ];

  return (
    <View
      style={{
        backgroundColor: Palette.surface,
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 16,
      }}>
      {cols.map((col, i) => (
        <MacroColumn key={col.label} {...col} showDivider={i > 0} />
      ))}
    </View>
  );
}

// ─── Meal Slot Card ───────────────────────────────────────────────────────────

function MealSlotCard({ slot, index, onAddMeal }: { slot: MealSlot; index: number; onAddMeal: (type: MealSlotType) => void }) {
  if (isFilled(slot)) {
    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 200, delay: index * 60 }}
        style={{
          backgroundColor: Palette.surface,
          borderRadius: 18,
          padding: 16,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              fontFamily: Font.semibold,
              fontSize: 12,
              color: Palette.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}>
            {slot.type}
          </Text>
          <Text
            style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}
            numberOfLines={2}>
            {slot.name}
          </Text>
        </View>
        {slot.imageUri ? (
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              backgroundColor: Palette.chip,
              overflow: 'hidden',
              marginLeft: 12,
            }}
          />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              backgroundColor: Palette.brandTint,
              marginLeft: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22 }}>🍽</Text>
          </View>
        )}
      </MotiView>
    );
  }

  // Empty slot — dashed border
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 200, delay: index * 60 }}>
      <PressableScale
        onPress={() => { feedback.tap(); onAddMeal(slot.type); }}
        accessibilityRole="button"
        accessibilityLabel={`Add ${slot.type}`}
        style={{
          height: 72,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: Palette.border,
          borderStyle: 'dashed',
          marginBottom: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
        }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {slot.type}
        </Text>
        <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brand }}>
          Add meal +
        </Text>
      </PressableScale>
    </MotiView>
  );
}

// ─── Subscribe CTA ────────────────────────────────────────────────────────────

function SubscribeCTA({ onPress }: { onPress: () => void }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 180, delay: 280 }}
      style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <LinearGradient
        colors={['#FFE9D6', '#FFDDBE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 20, padding: 20 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.4, marginBottom: 6 }}>
          Subscribe &amp; save 15%
        </Text>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#7c5a42', marginBottom: 16, lineHeight: 19 }}>
          Get freshly prepped meals delivered weekly and save on every order.
        </Text>
        <PressableScale
          onPress={() => { feedback.tap(); onPress(); }}
          accessibilityRole="button"
          accessibilityLabel="Explore plans"
          style={{
            height: 50,
            borderRadius: 14,
            backgroundColor: Palette.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
            Explore plans →
          </Text>
        </PressableScale>
      </LinearGradient>
    </MotiView>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MealPlanSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <WeekStripSkeleton />
      <Skeleton width="100%" height={68} radius={16} style={{ marginBottom: 16 }} />
      {MEAL_TYPES.map((t, i) => (
        <MealSlotSkeleton key={t} index={i} />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

/** Stub day-plan: all empty slots. Replace with real query when planner DB exists. */
function buildDaySlots(_dayIndex: number): MealSlot[] {
  return MEAL_TYPES.map((type) => ({ type }) satisfies EmptyMealSlot);
}

export default function MealPlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const weekDates = getWeekDates();
  const [activeDay, setActiveDay] = useState(todayWeekIndex());

  // Use subscription query to determine if user has an active plan.
  const { data: subs, isLoading } = useMySubscriptions(user?.id);
  const hasActiveSub = (subs ?? []).some((s) => s.status === 'active');

  const slots = buildDaySlots(activeDay);

  function handleAddMeal(_type: MealSlotType) {
    router.push('/meal-plans');
  }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/'); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 12,
            backgroundColor: Palette.canvas,
          }}>
          <PressableScale
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: Palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text
            style={{
              flex: 1,
              fontFamily: Font.display,
              fontSize: 26,
              color: Palette.ink,
              letterSpacing: -0.5,
            }}>
            Your meal plan
          </Text>
          <CalendarDays size={24} color={Palette.brand} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}>
          {isLoading ? (
            <MealPlanSkeleton />
          ) : (
            <>
              {/* Week strip */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 6,
                  paddingHorizontal: 20,
                  marginBottom: 16,
                }}>
                {WEEK_DAYS.map((abbr, i) => (
                  <DayBubble
                    key={abbr}
                    abbr={abbr}
                    date={weekDates[i] ?? i + 1}
                    active={activeDay === i}
                    index={i}
                    onPress={() => setActiveDay(i)}
                  />
                ))}
              </View>

              {/* Macros bar */}
              <MacrosBar slots={slots} />

              {/* Meal slot cards */}
              <View style={{ paddingHorizontal: 20 }}>
                {slots.map((slot, i) => (
                  <MealSlotCard
                    key={slot.type}
                    slot={slot}
                    index={i}
                    onAddMeal={handleAddMeal}
                  />
                ))}
              </View>

              {/* Subscribe CTA — only when no active subscription */}
              {!hasActiveSub ? (
                <SubscribeCTA onPress={() => { feedback.tap(); router.push('/meal-plans'); }} />
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
