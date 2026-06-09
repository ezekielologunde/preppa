import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PreppaLogo } from '@/components/preppa-logo';
import { Font } from '@/constants/fonts';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = '#f15f22';
const INK = '#111827';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { sendCode, verifyCode } = useAuth();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const codeRef = useRef<TextInput>(null);

  // Treat as a returning user only when explicitly signing in (skips the name field).
  const returning = params.mode === 'signin';

  async function send() {
    setMsg(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg({ text: 'Enter a valid email.', ok: false });
    if (!returning && name.trim().length < 2) return setMsg({ text: 'Tell us your name.', ok: false });

    setBusy(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await sendCode(email.trim().toLowerCase(), returning ? undefined : name.trim());
    setBusy(false);
    if (error) return setMsg({ text: error, ok: false });
    setStep('code');
    setMsg({ text: `We sent a 6-digit code to ${email.trim().toLowerCase()}.`, ok: true });
    setTimeout(() => codeRef.current?.focus(), 250);
  }

  async function verify(value?: string) {
    const c = (value ?? code).replace(/\D/g, '').slice(0, 6);
    setMsg(null);
    if (c.length !== 6) return setMsg({ text: 'Enter the 6-digit code.', ok: false });
    setBusy(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await verifyCode(email.trim().toLowerCase(), c);
    if (error) {
      setBusy(false);
      return setMsg({ text: error, ok: false });
    }
    router.replace('/');
  }

  async function resend() {
    setMsg(null);
    setBusy(true);
    const { error } = await sendCode(email.trim().toLowerCase(), returning ? undefined : name.trim());
    setBusy(false);
    setMsg(error ? { text: error, ok: false } : { text: 'New code sent.', ok: true });
  }

  const input = {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F4F4F6',
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Font.body,
    color: INK,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        <Pressable onPress={() => router.replace('/')} style={{ alignSelf: 'flex-end', paddingVertical: 12 }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 14, color: '#9ca3af' }}>continue as guest →</Text>
        </Pressable>

        <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 28, gap: 16 }}>
          <PreppaLogo size={72} glow />
          <Text style={{ fontFamily: Font.display, fontSize: 30, color: INK, letterSpacing: -0.8 }}>
            {step === 'code' ? 'enter your code' : returning ? 'welcome back' : 'join preppa'}
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: '#6b7280', textAlign: 'center', maxWidth: 290 }}>
            {step === 'code'
              ? `Check your email for the 6-digit code.`
              : returning
                ? 'Enter your email and we’ll send a sign-in code.'
                : 'Real food from real local Preppas. Enter your email to start.'}
          </Text>
        </View>

        {step === 'email' ? (
          <View style={{ gap: 12 }}>
            {!returning ? (
              <TextInput style={input} placeholder="full name" placeholderTextColor="#9ca3af" autoCapitalize="words" value={name} onChangeText={setName} />
            ) : null}
            <TextInput
              style={input}
              placeholder="you@email.com"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            {msg ? <Text style={{ fontFamily: Font.medium, fontSize: 14, color: msg.ok ? '#16a34a' : '#ef4444', paddingHorizontal: 4 }}>{msg.text}</Text> : null}
            <Pressable onPress={send} disabled={busy} style={{ height: 54, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Send code</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <TextInput
              ref={codeRef}
              style={[input, { textAlign: 'center', fontSize: 30, letterSpacing: 14, fontFamily: Font.display, height: 64 }]}
              placeholder="••••••"
              placeholderTextColor="#d1d5db"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              value={code}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, '').slice(0, 6);
                setCode(digits);
                if (digits.length === 6) verify(digits);
              }}
            />
            {msg ? <Text style={{ fontFamily: Font.medium, fontSize: 14, color: msg.ok ? '#16a34a' : '#ef4444', paddingHorizontal: 4, textAlign: 'center' }}>{msg.text}</Text> : null}
            <Pressable onPress={() => verify()} disabled={busy} style={{ height: 54, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Verify & continue</Text>}
            </Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8 }}>
              <Pressable onPress={() => { setStep('email'); setCode(''); setMsg(null); }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 14, color: '#6b7280' }}>← change email</Text>
              </Pressable>
              <Pressable onPress={resend} disabled={busy}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: ORANGE }}>Resend code</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'email' ? (
          <Pressable onPress={() => router.setParams({ mode: returning ? 'signup' : 'signin' })} style={{ alignItems: 'center', marginTop: 24 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#6b7280' }}>
              {returning ? 'New here? ' : 'Already a member? '}
              <Text style={{ fontFamily: Font.heading, color: ORANGE }}>{returning ? 'Create account' : 'Sign in'}</Text>
            </Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
