import { useRouter } from 'expo-router';
import { ChevronLeft, Eye, Flame, Sparkles, Star, TrendingUp, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type BoostPlan = {
  id: string;
  name: string;
  desc: string;
  Icon: typeof Zap;
  color: string;
  perks: string[];
  impressions: string;
};

const BOOST_PLANS: BoostPlan[] = [
  {
    id: 'search',
    name: 'featured in search',
    desc: 'Appear at the top of search results for your cuisine and city',
    Icon: TrendingUp,
    color: ORANGE,
    perks: ['Top 3 search placement', 'Orange "featured" badge', 'Priority in cuisine filters'],
    impressions: '800–1,400 views',
  },
  {
    id: 'rush',
    name: 'rush hour priority',
    desc: 'Pinned to the top of the specials feed during lunch and dinner rush',
    Icon: Flame,
    color: Palette.danger,
    perks: ['Rush hour specials placement', 'Push notification to local buyers', 'Live-now indicator on your listing'],
    impressions: '600–1,000 views',
  },
  {
    id: 'spotlight',
    name: 'new customer spotlight',
    desc: 'Shown to users who have never ordered from you before',
    Icon: Star,
    color: '#8b5cf6',
    perks: ['New-buyer discovery feed', '"Try them" editorial placement', '10% first-order promo badge'],
    impressions: '500–900 views',
  },
];

const DURATIONS = [
  { label: '24 hours', price: 5, multiplier: 1 },
  { label: '3 days', price: 12, multiplier: 1.4, tag: 'popular' },
  { label: '1 week', price: 25, multiplier: 2.2, tag: 'best value' },
];

export default function BoostScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState<string>('search');
  const [duration, setDuration] = useState(1);
  const [activated, setActivated] = useState(false);

  const selectedPlan = BOOST_PLANS.find((p) => p.id === plan) ?? BOOST_PLANS[0];
  const selectedDuration = DURATIONS[duration];
  const estimatedViews = selectedPlan.impressions;

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/prepper-hub'); } }

  function handleActivate() {
    feedback.success();
    setActivated(true);
  }

  if (activated) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
          </View>
          <MotiView from={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 300 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: selectedPlan.color, alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={32} color="#fff" />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6, textAlign: 'center' }}>boost activated</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 21 }}>
              Your listing is now boosted for {selectedDuration.label}. You can expect {estimatedViews} over this period.
            </Text>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Back to kitchen hub" style={{ paddingHorizontal: 24, height: 48, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>back to kitchen hub</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>boost listing</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>reach more buyers, faster</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.brandTint, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
            <Sparkles size={12} color={ORANGE} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: ORANGE }}>promo</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 130 }}>

          {/* Boost type selector */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textSecondary, marginBottom: 10 }}>choose boost type</Text>
          <View style={{ gap: 10 }}>
            {BOOST_PLANS.map(({ id, name, desc, Icon, color, perks, impressions }) => {
              const active = plan === id;
              return (
                <PressableScale key={id} onPress={() => { feedback.tap(); setPlan(id); }} accessibilityRole="button" accessibilityLabel={`${name} boost`}
                  style={{ backgroundColor: Palette.surface, borderRadius: 16, padding: 14, gap: 10, borderWidth: active ? 1.5 : 1, borderColor: active ? color : Palette.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={17} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 14, color: active ? color : INK }}>{name}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>{desc}</Text>
                    </View>
                  </View>
                  {active ? (
                    <View style={{ gap: 6 }}>
                      {perks.map((p) => (
                        <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
                          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, flex: 1 }}>{p}</Text>
                        </View>
                      ))}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Eye size={13} color={Palette.textMuted} />
                        <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textMuted }}>est. {impressions} per period</Text>
                      </View>
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
          </MotiView>

          {/* Duration */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textSecondary, marginBottom: 10 }}>boost duration</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {DURATIONS.map(({ label, price, tag }, i) => (
              <PressableScale key={label} onPress={() => { feedback.tap(); setDuration(i); }} accessibilityRole="button" accessibilityLabel={`${label} for $${price}`}
                style={{ flex: 1, backgroundColor: duration === i ? ORANGE : Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: duration === i ? 0 : 1, borderColor: Palette.border }}>
                {tag ? <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: duration === i ? '#fff' : ORANGE, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontFamily: Font.semibold, fontSize: 9, color: duration === i ? ORANGE : '#fff' }}>{tag}</Text></View> : null}
                <Text style={{ fontFamily: Font.heading, fontSize: 17, color: duration === i ? '#fff' : INK }}>${price}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: duration === i ? 'rgba(255,255,255,0.85)' : Palette.textSecondary }}>{label}</Text>
              </PressableScale>
            ))}
          </View>
          </MotiView>

          {/* Summary & CTA */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 160 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, gap: 8, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>boost type</Text>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>{selectedPlan.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>duration</Text>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>{selectedDuration.label}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>est. impressions</Text>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>{estimatedViews}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: Palette.divider, marginVertical: 4 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>total</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: ORANGE, letterSpacing: -0.5 }}>${selectedDuration.price}</Text>
            </View>
          </View>
          <PressableScale onPress={handleActivate} accessibilityRole="button" accessibilityLabel="Activate boost"
            style={{ height: 54, borderRadius: Radius.sm, backgroundColor: selectedPlan.color, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}>
            <Zap size={18} color="#fff" />
            <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>activate boost · ${selectedDuration.price}</Text>
          </PressableScale>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
