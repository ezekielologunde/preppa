import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { FileText, Heart, Info, ScrollText } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsGroup, SettingsHeader, SettingsRow } from '@/components/settings-ui';
import { PreppaLogo } from '@/components/preppa-logo';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const IMPACT = [
  { value: '100%', label: 'neighbourhood-made' },
  { value: 'local', label: 'independent chefs' },
  { value: '0', label: 'industrial kitchens' },
];

export default function AboutAppScreen() {
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 2200); };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SettingsHeader title="about preppa" subtitle="Real food from real local Preppas near you." />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40, gap: 20 }}>
          {/* Mission hero */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}
            style={{ marginHorizontal: 20 }}>
            <LinearGradient colors={['#FFE9D6', '#FFDABE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 22, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <PreppaLogo size={44} glow />
                <View>
                  <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.5 }}>our mission</Text>
                  <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: '#9A5B33' }}>cooked by your neighbours</Text>
                </View>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#7C5A42', lineHeight: 21 }}>
                Preppa puts real, local food back at the center of the neighbourhood. Every meal is cooked
                by a Prepper near you — supporting independent culinary creators, shortening the distance
                from kitchen to table, and keeping food spending in the community.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {IMPACT.map((s) => (
                  <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 2 }}>
                    <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.brand, letterSpacing: -0.4 }}>{s.value}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 10.5, color: '#7C5A42' }}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </MotiView>

          {/* App */}
          <SettingsGroup title="the app" delay={60}>
            <SettingsRow Icon={Info} label="App version" right={{ type: 'value', label: APP_VERSION }} onPress={() => {}} isLast />
          </SettingsGroup>

          {/* Legal */}
          <SettingsGroup title="legal & attributions" delay={120}>
            <SettingsRow Icon={ScrollText} label="Terms of service" onPress={() => Linking.openURL('https://preppa.live/terms').catch(() => flash('Could not open link'))} />
            <SettingsRow Icon={FileText} label="Privacy policy" onPress={() => Linking.openURL('https://preppa.live/privacy').catch(() => flash('Could not open link'))} />
            <SettingsRow Icon={Heart} label="Open source attributions" sub="The libraries that power Preppa" onPress={() => Linking.openURL('https://preppa.live/licenses').catch(() => flash('Could not open link'))} isLast />
          </SettingsGroup>
        </ScrollView>

        {toast ? (
          <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}
            style={{ position: 'absolute', left: 20, right: 20, bottom: 24, backgroundColor: Palette.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.surface, textAlign: 'center' }}>{toast}</Text>
          </MotiView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
