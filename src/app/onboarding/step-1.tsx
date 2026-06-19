import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

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

export default function Step1Name() {
  const router = useRouter();
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);

  function handleContinue() {
    feedback.tap();
    router.push({ pathname: '/onboarding/step-2', params: { name: name.trim() } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <ProgressDots current={0} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, paddingHorizontal: 24 }}>

          <MotiView
            from={{ opacity: 0, translateX: 40 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 160 }}
            style={{ flex: 1, justifyContent: 'center', gap: 0 }}>

            <Text
              style={{
                fontFamily: Font.display,
                fontSize: 34,
                color: Palette.ink,
                letterSpacing: -1,
                lineHeight: 42,
                marginBottom: 10,
              }}>
              {'hey, what should\nwe call you?'}
            </Text>

            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 15,
                color: Palette.textSecondary,
                lineHeight: 23,
                marginBottom: 32,
              }}>
              Your first name is how chefs and the community will know you.
            </Text>

            <TextInput
              ref={inputRef}
              value={name}
              onChangeText={setName}
              placeholder="First name"
              placeholderTextColor={Palette.textMuted}
              maxLength={50}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              accessibilityLabel="First name"
              onSubmitEditing={handleContinue}
              style={{
                height: 54,
                borderRadius: 14,
                backgroundColor: Palette.surface,
                borderWidth: 1.5,
                borderColor: name ? Palette.brand : Palette.border,
                paddingHorizontal: 16,
                fontSize: 17,
                fontFamily: Font.body,
                color: Palette.ink,
                marginBottom: 16,
              }}
            />

            <PressableScale
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              style={{
                height: 54,
                borderRadius: Radius.pill,
                backgroundColor: name.trim() ? Palette.brand : Palette.divider,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{
                  fontFamily: Font.heading,
                  fontSize: 16,
                  color: name.trim() ? '#fff' : Palette.textMuted,
                }}>
                Continue
              </Text>
            </PressableScale>

            <PressableScale
              onPress={() => {
                feedback.tap();
                router.push({ pathname: '/onboarding/step-2', params: { name: '' } });
              }}
              accessibilityRole="button"
              accessibilityLabel="Skip name"
              style={{ height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textMuted }}>
                Skip for now
              </Text>
            </PressableScale>
          </MotiView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
