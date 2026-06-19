import { useRouter } from 'expo-router';
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import type { PrepperProfile } from '@/lib/queries/preppers';

type CheckItem = { label: string; done: boolean; route: string };

function healthItems(profile: PrepperProfile): CheckItem[] {
  return [
    { label: 'kitchen photo', done: !!profile.avatar, route: '/kitchen-settings' },
    { label: 'bio written', done: !!profile.bio && profile.bio.length > 0, route: '/kitchen-settings' },
    { label: 'cuisine specialties', done: profile.specialties.length > 0, route: '/kitchen-settings' },
    { label: 'city / location', done: !!profile.city, route: '/kitchen-settings' },
    { label: 'at least 1 meal listed', done: profile.meals.length > 0, route: '/meal-editor' },
    { label: 'delivery options set', done: profile.delivers || profile.pickup, route: '/delivery-settings' },
  ];
}

function scoreColor(pct: number): string {
  if (pct >= 85) return '#34d399';
  if (pct >= 60) return '#fbbf24';
  return Palette.brand;
}

export function ProfileHealthCard({ profile }: { profile: PrepperProfile }) {
  const router = useRouter();
  const items = healthItems(profile);
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  const color = scoreColor(pct);
  const missing = items.filter((i) => !i.done);

  return (
    <PressableScale
      onPress={() => { feedback.tap(); router.push('/kitchen-settings'); }}
      accessibilityRole="button"
      accessibilityLabel={`Profile health ${pct}%`}
      style={{
        marginHorizontal: 20,
        marginBottom: 16,
        backgroundColor: '#1a1f2c',
        borderRadius: 20,
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: color + '30',
      }}>
      {/* Score row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: '#fff' }}>profile health</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 1 }}>
            {pct >= 100 ? 'fully optimised' : `${missing.length} item${missing.length !== 1 ? 's' : ''} to complete`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 28, color, letterSpacing: -0.5 }}>{pct}%</Text>
          <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: Palette.textMuted }}>{done}/{items.length} done</Text>
        </View>
        <ChevronRight size={16} color={Palette.textMuted} />
      </View>

      {/* Progress bar */}
      <View style={{ height: 5, borderRadius: Radius.pill, backgroundColor: '#252a34', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: Radius.pill, backgroundColor: color }} />
      </View>

      {/* Quick wins — show only incomplete items */}
      {missing.length > 0 ? (
        <View style={{ gap: 6 }}>
          {missing.slice(0, 3).map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Circle size={14} color={Palette.textMuted} />
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted }}>add {item.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} color={color} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color }}>kitchen profile is complete 🎉</Text>
        </View>
      )}
    </PressableScale>
  );
}
