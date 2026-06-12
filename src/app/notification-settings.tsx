import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, Crown, Flame, Gift, Leaf, Sparkles, Star, Tag, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type Category = { id: string; label: string; desc: string; Icon: typeof Bell; color: string; defaultOn: boolean };

const CATEGORIES: Category[] = [
  { id: 'rush', label: 'rush hour alerts', desc: 'Notified when lunch (11–2) or dinner (4–8) rush begins nearby', Icon: Flame, color: '#dc2626', defaultOn: true },
  { id: 'weekly', label: 'weekly digest', desc: 'Sunday summary: top kitchens, trending cuisines, and your week', Icon: Sparkles, color: '#8b5cf6', defaultOn: true },
  { id: 'holiday', label: 'holiday & cultural specials', desc: 'Limited meals for upcoming holidays and cultural celebrations', Icon: Gift, color: ORANGE, defaultOn: true },
  { id: 'seasonal', label: 'seasonal drops', desc: 'Harvest specials, ingredient kits, and food events near you', Icon: Leaf, color: '#ca8a04', defaultOn: true },
  { id: 'rewards', label: 'rewards milestones', desc: 'When you unlock perks or approach your next reward tier', Icon: Crown, color: Palette.amber, defaultOn: true },
  { id: 'new_prepper', label: 'new local preppers', desc: 'When a verified prepper near you joins the platform', Icon: Star, color: Palette.success, defaultOn: false },
  { id: 'promo', label: 'promotions & deals', desc: 'Flash sales, loyalty vouchers, and prepper discount codes', Icon: Tag, color: '#0891b2', defaultOn: false },
  { id: 'boost', label: 'listing performance', desc: 'Prepper-only: impressions and orders from your active boosts', Icon: Zap, color: '#d97706', defaultOn: false },
];

const MARKETING_NOTE = "Rush hour and holiday alerts fire at most once per window, so you never get spammed. We'll always respect your quiet hours (10 pm – 7 am).";

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultOn]))
  );

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/settings'); } }
  function toggle(id: string) { feedback.tap(); setPrefs((p) => ({ ...p, [id]: !p[id] })); }

  const activeCount = Object.values(prefs).filter(Boolean).length;
  const allIds = CATEGORIES.map((c) => c.id);
  function enableAll() { feedback.tap(); setPrefs(Object.fromEntries(allIds.map((id) => [id, true]))); }
  function disableAll() { feedback.tap(); setPrefs(Object.fromEntries(allIds.map((id) => [id, false]))); }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>notifications</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>{activeCount} of {CATEGORIES.length} active</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={enableAll} accessibilityRole="button" accessibilityLabel="Enable all notifications"
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: activeCount === CATEGORIES.length ? Palette.chip : Palette.brandTint }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: activeCount === CATEGORIES.length ? Palette.textMuted : ORANGE }}>all on</Text>
            </PressableScale>
            <PressableScale onPress={disableAll} accessibilityRole="button" accessibilityLabel="Disable all notifications"
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: activeCount === 0 ? Palette.chip : Palette.surface }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: activeCount === 0 ? Palette.textMuted : Palette.textSecondary }}>all off</Text>
            </PressableScale>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 100 }}>

          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}>
          <View style={{ backgroundColor: INK, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <Bell size={15} color={ORANGE} />
            </View>
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 }}>{MARKETING_NOTE}</Text>
          </View>
          </MotiView>

          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden' }}>
            {CATEGORIES.map(({ id, label, desc, Icon, color }, i) => (
              <MotiView key={id} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: 60 + i * 35 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: INK }}>{label}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2, lineHeight: 16 }}>{desc}</Text>
                </View>
                <Switch
                  value={prefs[id]}
                  onValueChange={() => toggle(id)}
                  trackColor={{ false: Palette.border, true: ORANGE }}
                  thumbColor="#fff"
                  ios_backgroundColor={Palette.border}
                  accessibilityLabel={`Toggle ${label}`}
                />
              </View>
              </MotiView>
            ))}
          </View>

          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 340 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 }}>
            Preferences are saved automatically. To fully disable all notifications, use your device's system settings.
          </Text>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
