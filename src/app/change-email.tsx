import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  backgroundColor: Palette.canvas,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderWidth: 1,
  borderColor: Palette.border,
  minHeight: 44,
} as const;

export default function ChangeEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/settings'); } }

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
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <Pressable style={{ flex: 1 }} onPress={goBack} accessibilityLabel="Dismiss" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <MotiView
          from={{ translateY: 320 }}
          animate={{ translateY: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginBottom: 20 }} />

          <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5, marginBottom: 20 }}>change email</Text>

          {done ? (
            <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18 }}>
              <View style={{ backgroundColor: Palette.success + '1A', borderRadius: Radius.lg, padding: 20, alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Mail size={28} color={Palette.success} />
                <Text style={{ fontFamily: Font.heading, fontSize: 17, color: '#14532d', textAlign: 'center' }}>Confirmation sent</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: '#166534', textAlign: 'center', lineHeight: 20 }}>
                  We sent a link to {email.trim().toLowerCase()}. Tap it to confirm your new email.
                </Text>
                <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Done" style={{ marginTop: 4, paddingHorizontal: 24, height: 44, borderRadius: 12, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>done</Text>
                </PressableScale>
              </View>
            </MotiView>
          ) : (
            <View style={{ gap: 14 }}>
              {user?.email ? (
                <View style={{ backgroundColor: Palette.canvas, borderRadius: 12, padding: 12, gap: 3 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.textMuted }}>current email</Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.ink }}>{user.email}</Text>
                </View>
              ) : null}

              <View style={{ gap: 6 }}>
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

              {error ? <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.danger }}>{error}</Text> : null}

              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, lineHeight: 18 }}>
                A confirmation link will be sent to your new address. Your email won&apos;t change until you confirm.
              </Text>

              <PressableScale
                onPress={handleSubmit}
                disabled={saving || !email.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send confirmation"
                accessibilityState={{ disabled: saving || !email.trim() }}
                style={{ height: 52, borderRadius: Radius.sm, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', opacity: saving || !email.trim() ? 0.6 : 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>{saving ? 'sending…' : 'send confirmation'}</Text>
              </PressableScale>
            </View>
          )}
        </MotiView>
      </KeyboardAvoidingView>
    </View>
  );
}
