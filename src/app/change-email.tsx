import { useRouter } from 'expo-router';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

const inputStyle = {
  fontFamily: Font.body,
  fontSize: 15,
  color: Palette.ink,
  backgroundColor: Palette.surface,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderWidth: 1,
  borderColor: Palette.border,
  minHeight: 44,
} as const;

export default function ChangeEmailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goBack() { feedback.tap(); try { router.back(); } catch { router.replace('/settings'); } }

  async function handleSubmit() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address');
      feedback.error();
      return;
    }
    if (trimmed === user?.email) {
      setError('This is already your current email');
      feedback.warning();
      return;
    }
    setSaving(true);
    const { error: updateErr } = await supabase.auth.updateUser({ email: trimmed });
    setSaving(false);
    if (updateErr) {
      setError(updateErr.message);
      feedback.error();
      return;
    }
    feedback.success();
    setDone(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.6 }}>change email</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 130 }}>
            {done ? (
              <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
              <View style={{ backgroundColor: '#DCFCE7', borderRadius: Radius.lg, padding: 20, alignItems: 'center', gap: 10 }}>
                <Mail size={28} color='#16a34a' />
                <Text style={{ fontFamily: Font.heading, fontSize: 17, color: '#14532d', textAlign: 'center' }}>Confirmation sent</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: '#166534', textAlign: 'center', lineHeight: 20 }}>
                  We sent a confirmation link to {email.trim().toLowerCase()}. Click the link to complete the change.
                </Text>
                <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Done" style={{ marginTop: 4, paddingHorizontal: 24, height: 44, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>done</Text>
                </PressableScale>
              </View>
              </MotiView>
            ) : (
              <>
                {user?.email ? (
                  <View style={{ backgroundColor: Palette.surface, borderRadius: 12, padding: 14, gap: 4 }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textMuted }}>current email</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.ink }}>{user.email}</Text>
                  </View>
                ) : null}

                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary }}>new email address</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter new email"
                    placeholderTextColor={Palette.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="New email address"
                    style={inputStyle}
                  />
                </View>

                {error ? (
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.danger }}>{error}</Text>
                ) : null}

                <View style={{ backgroundColor: Palette.surface, borderRadius: 12, padding: 14, gap: 4 }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>
                    A confirmation email will be sent to your new address. Your email won't change until you confirm the link.
                  </Text>
                </View>

                <PressableScale
                  onPress={handleSubmit}
                  disabled={saving || !email.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send confirmation"
                  accessibilityState={{ disabled: saving || !email.trim() }}
                  style={{ height: 52, borderRadius: Radius.sm, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', opacity: saving || !email.trim() ? 0.6 : 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>{saving ? 'sending…' : 'send confirmation'}</Text>
                </PressableScale>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
