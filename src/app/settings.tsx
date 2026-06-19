import { useRouter } from 'expo-router';
import { ChevronRight, Info, LifeBuoy, Settings2, ShieldCheck, SlidersHorizontal, type LucideIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsHeader } from '@/components/settings-ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

type Bucket = {
  key: string;
  title: string;
  sub: string;
  Icon: LucideIcon;
  tint: string;
  route: '/settings-account' | '/settings-help' | '/settings-about' | '/settings-privacy' | '/settings-app';
};

const BUCKETS: Bucket[] = [
  {
    key: 'account',
    title: 'Personalization & Logistics',
    sub: 'Profile, delivery addresses, payment & invoicing',
    Icon: SlidersHorizontal,
    tint: Palette.brand,
    route: '/settings-account',
  },
  {
    key: 'help',
    title: 'Help & Knowledge Center',
    sub: 'FAQs, message your chef, contact Preppa support',
    Icon: LifeBuoy,
    tint: '#16A34A',
    route: '/settings-help',
  },
  {
    key: 'about',
    title: 'App Identity & Community',
    sub: 'Our mission, version, terms & attributions',
    Icon: Info,
    tint: '#7C3AED',
    route: '/settings-about',
  },
  {
    key: 'privacy',
    title: 'Privacy, Security & Account',
    sub: 'Notifications, security, delete account',
    Icon: ShieldCheck,
    tint: '#0EA5E9',
    route: '/settings-privacy',
  },
  {
    key: 'app',
    title: 'App Preferences',
    sub: 'Haptics, display, privacy toggles & cached data',
    Icon: Settings2,
    tint: Palette.brand,
    route: '/settings-app',
  },
];

function BucketCard({ bucket, index }: { bucket: Bucket; index: number }) {
  const router = useRouter();
  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay: index * 60 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push(bucket.route as never); }}
        accessibilityRole="button"
        accessibilityLabel={`${bucket.title}. ${bucket.sub}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Palette.surface, borderRadius: 22, padding: 18, ...Shadow.card }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: bucket.tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <bucket.Icon size={24} color={bucket.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink, letterSpacing: -0.2 }}>{bucket.title}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, marginTop: 3, lineHeight: 17 }}>{bucket.sub}</Text>
        </View>
        <ChevronRight size={20} color={Palette.textSecondary} />
      </PressableScale>
    </MotiView>
  );
}

export default function SettingsHubScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SettingsHeader title="settings & support" subtitle="Everything that keeps your food coming, in five simple places." />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 14, ...(Platform.OS === 'web' ? { maxWidth: 640, alignSelf: 'center', width: '100%' } : {}) }}>
          {BUCKETS.map((b, i) => (
            <BucketCard key={b.key} bucket={b} index={i} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
