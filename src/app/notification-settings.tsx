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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type ChannelId = 'push' | 'email' | 'sms';
type Channel = { id: ChannelId; label: string; desc: string; Icon: typeof Bell; color: string };

const CHANNELS: Channel[] = [
  { id: 'push', label: 'Push notifications', desc: 'Rush hours, new drops, order updates, and rewards on your device', Icon: Bell, color: Palette.brand },
  { id: 'email', label: 'Email', desc: 'Order status updates, weekly digest, and prepper recommendations', Icon: Mail, color: '#0891b2' },
  { id: 'sms', label: 'SMS', desc: 'Time-sensitive delivery alerts and order status texts', Icon: MessageSquare, color: '#16a34a' },
];

const DEFAULTS: Record<ChannelId, boolean> = { push: true, email: true, sms: false };

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<ChannelId, boolean>>(DEFAULTS);

  // Load the server-stored preferences (canonical, per-user, cross-device).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase
      .from('notification_preferences')
      .select('email,sms,push')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPrefs({ push: data.push, email: data.email, sms: data.sms });
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/settings'); } }

  async function toggle(id: ChannelId) {
    if (!user?.id) return;
    feedback.tap();
    const next = { ...prefs, [id]: !prefs[id] };
    setPrefs(next); // optimistic
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...next }, { onConflict: 'user_id' });
    if (error) {
      setPrefs((p) => ({ ...p, [id]: !next[id] })); // revert on failure
      feedback.error();
    }
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
                  disabled={!user?.id}
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
              Payment receipts are always sent. We respect quiet hours (10 pm – 7 am). To fully silence alerts, also use your device&apos;s system settings.
            </Text>
          </MotiView>

        </View>
      </SafeAreaView>
    </View>
  );
}
