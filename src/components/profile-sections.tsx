import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck, ChevronRight, Crown, Gift, Moon, type LucideIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { toggleDarkMode } from '@/lib/theme-mode';

// ─── StatChip ────────────────────────────────────────────────────────────────

export function StatChip({ value, label, Icon, color, onPress, index = 0 }: {
  value: number; label: string; Icon: LucideIcon; color: string; onPress: () => void; index?: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12, scale: 0.94 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 220, mass: 0.8, delay: 40 + index * 55 }}
      style={{ flex: 1 }}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${value} ${label}`}
        style={{
          backgroundColor: Palette.surface,
          borderRadius: 16,
          paddingHorizontal: 8,
          paddingVertical: 16,
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: color + '1A',
        }}>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: color + '55' }} />
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </View>
        <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5, lineHeight: 26 }}>{value}</Text>
        <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary }}>{label}</Text>
      </PressableScale>
    </MotiView>
  );
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

export type RowItem = {
  label: string;
  sub?: string;
  Icon: LucideIcon;
  accent?: boolean;
  onPress: () => void;
};

export function SectionCard({ rows }: { rows: RowItem[] }) {
  return (
    <View style={{ backgroundColor: Palette.surface, borderRadius: 20 }}>
      {rows.map((row, i) => (
        <PressableScale key={row.label} onPress={row.onPress} accessibilityRole="button"
          accessibilityLabel={row.sub ? `${row.label}, ${row.sub}` : row.label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.chip }}>
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: row.accent ? Palette.brandTint : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
            <row.Icon size={17} color={row.accent ? Palette.brand : Palette.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: row.accent ? Palette.brand : Palette.ink }}>{row.label}</Text>
            {row.sub ? <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, marginTop: 1 }}>{row.sub}</Text> : null}
          </View>
          <ChevronRight size={15} color={Palette.textSecondary} />
        </PressableScale>
      ))}
    </View>
  );
}

// ─── DarkModeRow ─────────────────────────────────────────────────────────────

export function DarkModeRow({ dark }: { dark: boolean }) {
  return (
    <PressableScale onPress={() => { feedback.tap(); toggleDarkMode(); }} accessibilityRole="switch"
      accessibilityState={{ checked: dark }} accessibilityLabel="Dark mode"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Palette.chip }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Moon size={17} color={Palette.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>dark mode</Text>
        <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, marginTop: 1 }}>{dark ? 'on' : 'off'}</Text>
      </View>
      <MotiView animate={{ backgroundColor: dark ? Palette.brand : Palette.border }} transition={{ type: 'timing', duration: 200 }}
        style={{ width: 40, height: 24, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 3 }}>
        <MotiView animate={{ translateX: dark ? 16 : 0 }} transition={{ type: 'spring', damping: 14, stiffness: 200 }}
          style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: Palette.surface }} />
      </MotiView>
    </PressableScale>
  );
}

// ─── DarkCard ────────────────────────────────────────────────────────────────

export function DarkCard({ Icon, title, sub, onPress, accessibilityLabel }: {
  Icon: LucideIcon; title: string; sub: string; onPress: () => void; accessibilityLabel: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: Palette.surface, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: Palette.brand + '2E', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={Palette.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{title}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>{sub}</Text>
      </View>
      <ChevronRight size={18} color={Palette.textSecondary} />
    </PressableScale>
  );
}

// ─── MealPlansSection ────────────────────────────────────────────────────────

type PlanSub = {
  id: string;
  plan_name: string;
  status: string;
  next_billing_at?: string | null;
  prepper?: { display_name?: string | null } | null;
};

export function MealPlansSection({ subs, onViewAll, onPress }: {
  subs: PlanSub[] | undefined;
  onViewAll: () => void;
  onPress: () => void;
}) {
  return (
    <View style={{ marginHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3 }}>meal plans</Text>
        <PressableScale onPress={onViewAll} accessibilityRole="button" accessibilityLabel="View all meal plans">
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brand }}>view all</Text>
        </PressableScale>
      </View>

      {subs && subs.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {subs.map((s, i) => {
              const badge = s.status === 'active'
                ? { bg: Palette.success + '1A', fg: Palette.success }
                : s.status === 'paused'
                ? { bg: Palette.amber + '1A', fg: Palette.amber }
                : { bg: Palette.chip, fg: Palette.textSecondary };
              const next = s.next_billing_at ? new Date(s.next_billing_at) : null;
              const nextLabel = next && !isNaN(next.getTime())
                ? next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : null;
              return (
                <MotiView key={s.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                <PressableScale onPress={onPress} accessibilityRole="button"
                  accessibilityLabel={`${s.plan_name}, ${s.status}`}
                  style={{ width: 220, backgroundColor: Palette.surface, borderRadius: 18, padding: 14, gap: 8 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarCheck size={22} color={Palette.brand} />
                  </View>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }} numberOfLines={1}>{s.plan_name}</Text>
                  {s.prepper?.display_name ? (
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>by {s.prepper.display_name}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ paddingHorizontal: 9, height: 22, borderRadius: Radius.pill, backgroundColor: badge.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: badge.fg, textTransform: 'capitalize' }}>{s.status}</Text>
                    </View>
                    {nextLabel ? <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary }}>next {nextLabel}</Text> : null}
                  </View>
                </PressableScale>
                </MotiView>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Discover meal plans"
          style={{ backgroundColor: Palette.surface, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <CalendarCheck size={22} color={Palette.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>Subscribe & save</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>Weekly meal plans from your favorite kitchens, on repeat.</Text>
          </View>
          <ChevronRight size={18} color={Palette.textSecondary} />
        </PressableScale>
      )}
    </View>
  );
}

// ─── RewardsCard ─────────────────────────────────────────────────────────────

type RewardsData = { points: number; tier: { name: string; color: string }; nextTier: unknown; toNext: number; progress: number };

export function RewardsCard({ rewards, isLoading, onPress }: { rewards: RewardsData; isLoading?: boolean; onPress: () => void }) {
  if (isLoading) {
    return (
      <View style={{ marginHorizontal: 20 }}>
        <Skeleton width="100%" height={120} radius={22} />
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="View your rewards"
      style={{ marginHorizontal: 20 }}>
      <LinearGradient colors={['#FFE9D6', '#FFDDBE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#7c5a42' }}>your balance</Text>
          <Text style={{ fontFamily: Font.display, fontSize: 28, color: Palette.brand, letterSpacing: -0.5 }}>
            {rewards.points.toLocaleString()}{' '}<Text style={{ fontSize: 15 }}>pts</Text>
          </Text>
          <Text style={{ fontFamily: Font.medium, fontSize: 12, color: '#7c5a42', marginTop: 2 }}>
            ${(rewards.points * 0.01).toFixed(2)} in rewards ›
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <Crown size={15} color={rewards.tier.color} />
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>{rewards.tier.name.toLowerCase()} member</Text>
            {rewards.nextTier ? (
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#7c5a42' }}>· {Math.round(rewards.toNext * 10).toLocaleString()} pts to go</Text>
            ) : (
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#7c5a42' }}>· top tier</Text>
            )}
          </View>
          <View style={{ height: 7, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)', marginTop: 8, overflow: 'hidden' }}>
            <MotiView
              from={{ width: '0%' }}
              animate={{ width: `${Math.round(rewards.progress * 100)}%` }}
              transition={{ type: 'timing', duration: 700, delay: 200 }}
              style={{ height: 7, borderRadius: 4, backgroundColor: Palette.brand }}
            />
          </View>
        </View>
        <Gift size={56} color="#d97706" />
      </LinearGradient>
    </PressableScale>
  );
}
