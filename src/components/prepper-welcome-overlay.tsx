import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ChefHat, CheckCircle2, UtensilsCrossed } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyPrepperApplication } from '@/lib/queries/preppers';

const WELCOME_KEY = (uid: string) => `preppa.prepper.welcomed.v1.${uid}`;

const BULLETS = [
  'Publish meals customers can order instantly',
  'Set your kitchen hours & delivery settings',
  'Get paid directly through Preppa',
];

export function PrepperWelcomeOverlay({ userId }: { userId?: string | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: prepper } = useMyPrepperApplication(userId);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId || prepper?.status !== 'approved') return;
    AsyncStorage.getItem(WELCOME_KEY(userId))
      .then((val) => { if (val !== '1') setVisible(true); })
      .catch(() => {});
  }, [userId, prepper?.status]);

  async function dismiss() {
    feedback.tap();
    if (userId) await AsyncStorage.setItem(WELCOME_KEY(userId), '1').catch(() => {});
    setVisible(false);
  }

  async function goSetUp() {
    await dismiss();
    router.push('/dashboard');
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false}>
          <MotiView
            from={{ opacity: 0, translateY: 60 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            style={{
              backgroundColor: Palette.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 28,
              paddingBottom: Math.max(insets.bottom + 16, 32),
              alignItems: 'center',
              gap: 18,
            }}>

            {/* Icon */}
            <MotiView
              from={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, stiffness: 260, delay: 100 }}>
              <View style={{
                width: 88, height: 88, borderRadius: 44,
                backgroundColor: Palette.brand + '18',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <ChefHat size={44} color={Palette.brand} />
              </View>
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: Palette.success,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2.5, borderColor: Palette.surface,
              }}>
                <CheckCircle2 size={14} color="#fff" fill="#fff" />
              </View>
            </MotiView>

            {/* Headline */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 260, delay: 200 }}
              style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{
                fontFamily: Font.display, fontSize: 26, color: Palette.ink,
                letterSpacing: -0.6, textAlign: 'center',
              }}>
                Welcome to Preppa!
              </Text>
              <Text style={{
                fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary,
                textAlign: 'center', lineHeight: 22, maxWidth: 300,
              }}>
                Your kitchen is officially approved. Start adding meals and take orders from customers near you.
              </Text>
            </MotiView>

            {/* Bullets */}
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 260, delay: 320 }}
              style={{
                width: '100%', gap: 10,
                backgroundColor: Palette.canvas,
                borderRadius: 16, padding: 16,
              }}>
              {BULLETS.map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: Palette.brand + '22',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <UtensilsCrossed size={11} color={Palette.brand} />
                  </View>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.inkSoft, flex: 1 }}>
                    {line}
                  </Text>
                </View>
              ))}
            </MotiView>

            {/* CTAs */}
            <MotiView
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 240, delay: 400 }}
              style={{ width: '100%', gap: 10 }}>
              <PressableScale
                onPress={goSetUp}
                accessibilityRole="button"
                accessibilityLabel="Set up my kitchen"
                style={{
                  height: 54, borderRadius: Radius.pill,
                  backgroundColor: Palette.brand,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                  Set up my kitchen
                </Text>
              </PressableScale>
              <PressableScale
                onPress={dismiss}
                accessibilityRole="button"
                accessibilityLabel="Explore first"
                style={{ height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.textSecondary }}>
                  I'll explore first
                </Text>
              </PressableScale>
            </MotiView>

          </MotiView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
