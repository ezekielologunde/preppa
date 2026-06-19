import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { markFtueComplete } from '@/app/_layout';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const TOTAL = 4;

function ProgressDots({ current }: { current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 20, paddingBottom: 8 }}>
      {Array.from({ length: TOTAL }, (_, i) => (
        <MotiView
          key={i}
          animate={{
            width: i === current ? 10 : 8,
            height: i === current ? 10 : 8,
            backgroundColor: i === current ? Palette.brand : Palette.border,
          }}
          transition={{ type: 'spring', damping: 16, stiffness: 200 }}
          style={{ borderRadius: 5 }}
        />
      ))}
    </View>
  );
}

export default function Step4Location() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ name?: string; dietary?: string; cuisines?: string }>();

  const name = params.name ?? '';
  const dietary = params.dietary ? params.dietary.split(',').filter(Boolean) : [];
  const cuisines = params.cuisines ? params.cuisines.split(',').filter(Boolean) : [];

  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleComplete() {
    if (!user) return;
    feedback.success();
    setSaving(true);

    try {
      // 1. Update display name on profile + auth metadata
      if (name) {
        await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
        await supabase.auth.updateUser({ data: { full_name: name } });
      }

      // 2. Save dietary, cuisines, and location to user metadata
      await supabase.auth.updateUser({
        data: {
          ...(dietary.length > 0 && { dietary }),
          ...(cuisines.length > 0 && { cuisines }),
          ...(location.trim() && { onboarding_city: location.trim() }),
        },
      });

      // 3. Mark onboarding complete (writes AsyncStorage + DB)
      await markFtueComplete(user.id);
    } catch {
      // Non-fatal — preferences and FTUE completion will persist from the
      // individual calls that succeeded; failing partially is acceptable.
    }

    setSaving(false);
    router.replace('/onboarding/welcome' as never);
  }

  async function handleSkip() {
    if (!user) return;
    feedback.tap();
    setSaving(true);
    try {
      if (name) {
        await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
        await supabase.auth.updateUser({ data: { full_name: name } });
      }
      if (dietary.length > 0 || cuisines.length > 0) {
        await supabase.auth.updateUser({
          data: {
            ...(dietary.length > 0 && { dietary }),
            ...(cuisines.length > 0 && { cuisines }),
          },
        });
      }
      await markFtueComplete(user.id);
    } catch {
      // Non-fatal
    }
    setSaving(false);
    router.replace('/onboarding/welcome' as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <ProgressDots current={3} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, paddingHorizontal: 24 }}>

          <MotiView
            from={{ opacity: 0, translateX: 40 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 160 }}
            style={{ flex: 1 }}>

            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 24 }}>
              <ChevronLeft size={22} color={Palette.inkSoft} strokeWidth={2} />
            </Pressable>

            <Text
              style={{
                fontFamily: Font.display,
                fontSize: 30,
                color: Palette.ink,
                letterSpacing: -0.8,
                lineHeight: 38,
                marginBottom: 6,
              }}>
              your area
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 21, marginBottom: 28 }}>
              We use this to surface local chefs and seasonal drops near you.
            </Text>

            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Lagos, NG · Chicago, IL · London, UK"
              placeholderTextColor={Palette.textMuted}
              maxLength={100}
              autoCapitalize="words"
              returnKeyType="done"
              accessibilityLabel="Your city or area"
              onSubmitEditing={handleComplete}
              style={{
                height: 54,
                borderRadius: 14,
                backgroundColor: Palette.surface,
                borderWidth: 1.5,
                borderColor: location ? Palette.brand : Palette.border,
                paddingHorizontal: 16,
                fontSize: 15,
                fontFamily: Font.body,
                color: Palette.ink,
                marginBottom: 24,
              }}
            />

            <PressableScale
              onPress={handleComplete}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Let's eat — complete setup"
              style={{
                height: 54,
                borderRadius: Radius.pill,
                backgroundColor: Palette.brand,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: saving ? 0.7 : 1,
                flexDirection: 'row',
                gap: 8,
                marginBottom: 12,
              }}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                  Let's eat
                </Text>
              )}
            </PressableScale>

            <PressableScale
              onPress={handleSkip}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Skip location"
              style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textMuted }}>Skip</Text>
            </PressableScale>
          </MotiView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
