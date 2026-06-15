import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, FileText, Heart, Info, ScrollText, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Linking, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsGroup, SettingsHeader, SettingsRow } from '@/components/settings-ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PreppaLogo } from '@/components/preppa-logo';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const IMPACT = [
  { value: '100%', label: 'neighbourhood-made' },
  { value: 'local', label: 'independent chefs' },
  { value: '0', label: 'industrial kitchens' },
];

type DocEntry = {
  title: string;
  Icon: typeof FileText;
  color: string;
  summary: string;
  points: string[];
  url: string;
  cta: string;
};
type DocKey = 'terms' | 'privacy' | 'licenses';

const DOCS: Record<DocKey, DocEntry> = {
  terms: {
    title: 'Terms of Service',
    Icon: ScrollText,
    color: '#7C3AED',
    summary: 'By using Preppa you agree to these terms. Preppers are independent chefs — Preppa connects and facilitates but does not employ them.',
    points: [
      'You must be 18 or older to hold a Preppa account.',
      'Preppers set their own prices, quantities, and order cutoff times.',
      'Refunds and disputes are resolved between you and the Prepper, with Preppa mediating.',
      'Resale or commercial bulk orders without written agreement are not permitted.',
      'Leaving false reviews or manipulating ratings violates these terms.',
    ],
    url: 'https://preppa.live/terms',
    cta: 'Read full terms',
  },
  privacy: {
    title: 'Privacy Policy',
    Icon: FileText,
    color: '#0EA5E9',
    summary: 'Your data helps us connect you with great local food. We never sell your personal information to third parties.',
    points: [
      'Location is used only to surface nearby Preppers — never sold to advertisers.',
      'Order history powers your personalised recommendations.',
      'Payments are processed by Stripe — we never store your card details.',
      'You can request a full data export or permanent deletion at any time.',
      'Analytics are anonymised and used only to improve the app experience.',
    ],
    url: 'https://preppa.live/privacy',
    cta: 'Read full policy',
  },
  licenses: {
    title: 'Open Source',
    Icon: Heart,
    color: '#e11d48',
    summary: 'Preppa is built on great open-source projects. We are grateful to every contributor behind them.',
    points: [
      'Expo & React Native — MIT License',
      'Supabase — Apache 2.0 License',
      'TanStack Query — MIT License',
      'Moti & Reanimated — MIT License',
      'Lucide Icons — ISC License',
    ],
    url: 'https://preppa.live/licenses',
    cta: 'View all licenses',
  },
};

function LegalSheet({
  docKey,
  onClose,
  onLinkFail,
}: {
  docKey: DocKey | null;
  onClose: () => void;
  onLinkFail: () => void;
}) {
  const doc = docKey ? DOCS[docKey] : null;
  return (
    <Modal visible={docKey !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'flex-end' }}>
        {doc ? (
          <MotiView
            from={{ translateY: 48, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ type: 'timing', duration: 260 }}
            style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 18, paddingBottom: Platform.OS === 'ios' ? 40 : 26, maxHeight: '82%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: doc.color + '1A', alignItems: 'center', justifyContent: 'center' }}>
                  <doc.Icon size={20} color={doc.color} />
                </View>
                <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.4 }}>{doc.title}</Text>
              </View>
              <PressableScale onPress={() => { feedback.tap(); onClose(); }} accessibilityRole="button" accessibilityLabel="Close"
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <X size={17} color={Palette.textSecondary} />
              </PressableScale>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 21, marginBottom: 16 }}>
                {doc.summary}
              </Text>
              {doc.points.map((point, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: doc.color, marginTop: 7 }} />
                  <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13.5, color: Palette.ink, lineHeight: 20 }}>{point}</Text>
                </View>
              ))}
              <PressableScale
                onPress={() => { feedback.tap(); Linking.openURL(doc.url).catch(onLinkFail); }}
                accessibilityRole="link"
                accessibilityLabel={`${doc.cta} at preppa.live`}
                style={{ marginTop: 20, marginBottom: 8, height: 52, borderRadius: Radius.pill, backgroundColor: doc.color, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                <ExternalLink size={17} color="#fff" />
                <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>{doc.cta} at preppa.live</Text>
              </PressableScale>
            </ScrollView>
          </MotiView>
        ) : null}
      </View>
    </Modal>
  );
}

export default function AboutAppScreen() {
  const [openDoc, setOpenDoc] = useState<DocKey | null>(null);
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

          {/* App version */}
          <SettingsGroup title="the app" delay={60}>
            <SettingsRow Icon={Info} label="App version" right={{ type: 'value', label: APP_VERSION }} isLast />
          </SettingsGroup>

          {/* Legal — tap opens an in-app overlay with a summary + link to full doc at preppa.live */}
          <SettingsGroup title="legal & attributions" delay={120}>
            <SettingsRow Icon={ScrollText} label="Terms of service" sub="How Preppa works and what you agree to" onPress={() => setOpenDoc('terms')} />
            <SettingsRow Icon={FileText} label="Privacy policy" sub="What we collect, how we use it, and your rights" onPress={() => setOpenDoc('privacy')} />
            <SettingsRow Icon={Heart} label="Open source" sub="The libraries that power Preppa" onPress={() => setOpenDoc('licenses')} isLast />
          </SettingsGroup>

        </ScrollView>

        {toast ? (
          <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}
            style={{ position: 'absolute', left: 20, right: 20, bottom: 24, backgroundColor: Palette.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.surface, textAlign: 'center' }}>{toast}</Text>
          </MotiView>
        ) : null}
      </SafeAreaView>

      <LegalSheet docKey={openDoc} onClose={() => setOpenDoc(null)} onLinkFail={() => flash('Could not open link — visit preppa.live')} />
    </View>
  );
}
