import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { markFtueComplete } from '@/app/_layout';
import { ProgressDots } from '@/components/onboarding/progress-dots';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

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
    if (!user) {
      router.replace('/auth?mode=signin');
      return;
    }
    feedback.success();
    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];
      if (name) {
        tasks.push(Promise.resolve(supabase.from('profiles').update({ full_name: name }).eq('id', user.id)));
        tasks.push(supabase.auth.updateUser({ data: { full_name: name } }));
      }
      const meta: Record<string, unknown> = {};
      if (dietary.length > 0) meta.dietary = dietary;
      if (cuisines.length > 0) meta.cuisines = cuisines;
      if (location.trim()) meta.onboarding_city = location.trim();
      if (Object.keys(meta).length > 0) tasks.push(supabase.auth.updateUser({ data: meta }));
      await Promise.allSettled(tasks);
      markFtueComplete(user.id);
    } catch {
      // non-fatal
    }
    setSaving(false);
    router.replace('/onboarding/welcome' as never);
  }

  async function handleSkip() {
    if (!user) {
      router.replace('/auth?mode=signin');
      return;
    }
    feedback.tap();
    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];
      if (name) {
        tasks.push(Promise.resolve(supabase.from('profiles').update({ full_name: name }).eq('id', user.id)));
        tasks.push(supabase.auth.updateUser({ data: { full_name: name } }));
      }
      const meta: Record<string, unknown> = {};
      if (dietary.length > 0) meta.dietary = dietary;
      if (cuisines.length > 0) meta.cuisines = cuisines;
      if (Object.keys(meta).length > 0) tasks.push(supabase.auth.updateUser({ data: meta }));
      if (tasks.length > 0) await Promise.allSettled(tasks);
      markFtueComplete(user.id);
    } catch {
      // non-fatal
    }
    setSaving(false);
    router.replace('/onboarding/welcome' as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <ProgressDots total={4} current={4} />

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
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 24 }}>
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
              where are you?
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
