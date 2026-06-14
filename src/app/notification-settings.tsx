import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, Mail, MessageSquare } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Channel = { id: string; label: string; desc: string; Icon: typeof Bell; color: string };

const CHANNELS: Channel[] = [
  { id: 'push', label: 'Push notifications', desc: 'Rush hours, new drops, order updates, and rewards on your device', Icon: Bell, color: Palette.brand },
  { id: 'email', label: 'Email', desc: 'Weekly digest, order receipts, and prepper recommendations', Icon: Mail, color: '#0891b2' },
  { id: 'sms', label: 'SMS', desc: 'Time-sensitive delivery alerts and order status texts', Icon: MessageSquare, color: '#16a34a' },
];

const STORAGE_KEY = 'notification_prefs';
const DEFAULTS: Record<string, boolean> = { push: true, email: true, sms: false };

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        // Migrate: only carry over keys that exist in the new channel model
        const next: Record<string, boolean> = { ...DEFAULTS };
        for (const ch of CHANNELS) { if (typeof saved[ch.id] === 'boolean') next[ch.id] = saved[ch.id]; }
        setPrefs(next);
      } catch {}
    });
  }, []);

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/settings'); } }

  function toggle(id: string) {
    feedback.tap();
    setPrefs((p) => {
      const next = { ...p, [id]: !p[id] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.6 }}>notifications</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>
              Choose how Preppa reaches you
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 14 }}>

          {/* Channel toggles */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}
            style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden' }}>
            {CHANNELS.map(({ id, label, desc, Icon, color }, i) => (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: color + '1A', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }}>{label}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2, lineHeight: 17 }}>{desc}</Text>
                </View>
                <Switch
                  value={prefs[id]}
                  onValueChange={() => toggle(id)}
                  trackColor={{ false: Palette.border, true: Palette.brand }}
                  thumbColor="#fff"
                  ios_backgroundColor={Palette.border}
                  accessibilityLabel={`Toggle ${label}`}
                />
              </View>
            ))}
          </MotiView>

          {/* Footer note */}
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 300, delay: 200 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 }}>
              We respect quiet hours (10 pm – 7 am). To fully silence all alerts, use your device's system settings.
            </Text>
          </MotiView>

        </View>
      </SafeAreaView>
    </View>
  );
}
