import { useLocalSearchParams, useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PreppaLogo } from '@/components/preppa-logo';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type Mode = 'signin' | 'signup';
// What an in-progress 6-digit code is for.
type Intent = 'signup' | 'signin-otp' | 'recovery';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { signIn, signUp, sendCode, verifyCode, resetPassword, updatePassword } = useAuth();

  const [mode, setMode] = useState<Mode>(params.mode === 'signin' ? 'signin' : 'signup');
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [intent, setIntent] = useState<Intent>('signup');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const codeRef = useRef<TextInput>(null);

  const tap = () => feedback.impact();
  const fail = (text: string) => {
    feedback.error();
    setBusy(false);
    setMsg({ text, ok: false });
  };
  const goCode = (next: Intent, text: string) => {
    feedback.success();
    setBusy(false);
    setIntent(next);
    setStep('code');
    setCode('');
    setMsg({ text, ok: true });
    setTimeout(() => codeRef.current?.focus(), 250);
  };

  // Primary submit on the first screen: password sign-in or password sign-up.
  async function submit() {
    setMsg(null);
    if (mode === 'signup' && name.trim().length < 2) return setMsg({ text: 'Tell us your name.', ok: false });
    if (!emailOk(email)) return setMsg({ text: 'Enter a valid email.', ok: false });
    if (password.length < 8) return setMsg({ text: 'Password must be at least 8 characters.', ok: false });

    setBusy(true);
    tap();
    if (mode === 'signup') {
      const { error, needsConfirmation } = await signUp(email.trim().toLowerCase(), password, name.trim());
      if (error) return fail(error);
      if (needsConfirmation) return goCode('signup', `We sent a 6-digit code to ${email.trim().toLowerCase()} to confirm your email.`);
      feedback.success();
      return router.replace('/'); // confirmation disabled — straight in
    }
    const { error } = await signIn(email.trim().toLowerCase(), password);
    if (error) return fail(/invalid login/i.test(error) ? 'Wrong email or password. Forgot it, or use a sign-in code below.' : error);
    feedback.success();
    router.replace('/');
  }

  // Fallback for accounts created passwordless: email a one-time sign-in code.
  async function sendOtp() {
    setMsg(null);
    if (!emailOk(email)) return setMsg({ text: 'Enter your email first.', ok: false });
    setBusy(true);
    tap();
    const { error } = await sendCode(email.trim().toLowerCase(), mode === 'signup' ? name.trim() : undefined);
    if (error) return fail(error);
    goCode('signin-otp', `We sent a 6-digit sign-in code to ${email.trim().toLowerCase()}.`);
  }

  async function forgot() {
    setMsg(null);
    if (!emailOk(email)) return setMsg({ text: 'Enter your email first, then tap reset.', ok: false });
    setBusy(true);
    tap();
    const { error } = await resetPassword(email.trim().toLowerCase());
    if (error) return fail(error);
    goCode('recovery', `We sent a reset code to ${email.trim().toLowerCase()}. Enter it and choose a new password.`);
  }

  async function verify(value?: string) {
    const c = (value ?? code).replace(/\D/g, '').slice(0, 6);
    setMsg(null);
    if (c.length !== 6) return setMsg({ text: 'Enter the 6-digit code.', ok: false });
    if (intent === 'recovery' && newPassword.length < 8) return setMsg({ text: 'Choose a password (8+ characters).', ok: false });

    setBusy(true);
    tap();
    const type = intent === 'signup' ? 'signup' : intent === 'recovery' ? 'recovery' : 'email';
    const { error } = await verifyCode(email.trim().toLowerCase(), c, type);
    if (error) return fail(error);
    if (intent === 'recovery') {
      const up = await updatePassword(newPassword);
      if (up.error) return fail(up.error);
    }
    feedback.success();
    router.replace('/');
  }

  async function resend() {
    setMsg(null);
    setBusy(true);
    const send =
      intent === 'recovery'
        ? resetPassword(email.trim().toLowerCase())
        : intent === 'signup'
          ? signUp(email.trim().toLowerCase(), password, name.trim()).then((r) => ({ error: r.error }))
          : sendCode(email.trim().toLowerCase());
    const { error } = await send;
    setBusy(false);
    setMsg(error ? { text: error, ok: false } : { text: 'New code sent.', ok: true });
  }

  const input = {
    height: 54,
    borderRadius: 16,
    backgroundColor: Palette.canvas,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Font.body,
    color: INK,
  } as const;

  const title =
    step === 'code'
      ? intent === 'recovery'
        ? 'reset password'
        : intent === 'signup'
          ? 'verify your email'
          : 'enter your code'
      : mode === 'signin'
        ? 'welcome back'
        : 'join preppa';

  const subtitle =
    step === 'code'
      ? intent === 'recovery'
        ? 'Enter the code and a new password.'
        : 'Check your email for the 6-digit code.'
      : mode === 'signin'
        ? 'Sign in with your email and password.'
        : 'Real food from real local Preppas. Create your account.';

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Soft brand glow drifting behind the form */}
      <MotiView
        from={{ translateY: -18, opacity: 0.7 }}
        animate={{ translateY: 14, opacity: 1 }}
        transition={{ type: 'timing', duration: 4800, loop: true, repeatReverse: true }}
        pointerEvents="none"
        style={{ position: 'absolute', top: -120, alignSelf: 'center', width: 420, height: 420, borderRadius: 210, experimental_backgroundImage: 'radial-gradient(circle, rgba(241,95,34,0.16), transparent 70%)' }}
      />
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        <Pressable onPress={() => router.replace('/')} style={{ alignSelf: 'flex-end', paddingVertical: 12 }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.textMuted }}>continue as guest →</Text>
        </Pressable>

        <MotiView
          from={{ opacity: 0, translateY: 18, scale: 0.96 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 140 }}
          style={{ alignItems: 'center', marginTop: 12, marginBottom: 28, gap: 16 }}>
          <PreppaLogo size={72} glow />
          <MotiView
            key={title}
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 220 }}
            style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 30, color: INK, letterSpacing: -0.8 }}>{title}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', maxWidth: 300 }}>{subtitle}</Text>
          </MotiView>
        </MotiView>

        {step === 'form' ? (
          <MotiView
            key={`form-${mode}`}
            from={{ opacity: 0, translateX: 22 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 17, stiffness: 170 }}
            style={{ gap: 12 }}>
            {mode === 'signup' ? (
              <TextInput style={input} placeholder="full name" placeholderTextColor={Palette.textMuted} autoCapitalize="words" textContentType="name" value={name} onChangeText={setName} />
            ) : null}
            <TextInput
              style={input}
              placeholder="you@email.com"
              placeholderTextColor={Palette.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <View style={{ justifyContent: 'center' }}>
              <TextInput
                style={[input, { paddingRight: 52 }]}
                placeholder="password"
                placeholderTextColor={Palette.textMuted}
                autoCapitalize="none"
                secureTextEntry={!showPw}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                returnKeyType={mode === 'signup' ? 'next' : 'go'}
              />
              <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} style={{ position: 'absolute', right: 16 }} accessibilityRole="button" accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff size={20} color={Palette.textMuted} /> : <Eye size={20} color={Palette.textMuted} />}
              </Pressable>
            </View>

            {mode === 'signin' ? (
              <Pressable onPress={forgot} disabled={busy} style={{ alignSelf: 'flex-end' }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.textSecondary }}>Forgot password?</Text>
              </Pressable>
            ) : null}

            {msg ? (
              <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 180 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 14, color: msg.ok ? Palette.success : Palette.danger, paddingHorizontal: 4 }}>{msg.text}</Text>
              </MotiView>
            ) : null}

            <PressableScale onPress={submit} disabled={busy} accessibilityRole="button" accessibilityLabel={mode === 'signup' ? 'Create account' : 'Sign in'} style={{ height: 54, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>}
            </PressableScale>

            <Pressable onPress={sendOtp} disabled={busy} style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.textSecondary }}>
                Email me a sign-in code <Text style={{ fontFamily: Font.heading, color: ORANGE }}>instead</Text>
              </Text>
            </Pressable>
          </MotiView>
        ) : (
          <MotiView
            key="code"
            from={{ opacity: 0, translateX: 22 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 17, stiffness: 170 }}
            style={{ gap: 12 }}>
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
                if (digits.length === 6 && intent !== 'recovery') verify(digits);
              }}
            />
            {intent === 'recovery' ? (
              <View style={{ justifyContent: 'center' }}>
                <TextInput
                  style={[input, { paddingRight: 52 }]}
                  placeholder="new password"
                  placeholderTextColor={Palette.textMuted}
                  autoCapitalize="none"
                  secureTextEntry={!showPw}
                  textContentType="newPassword"
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} style={{ position: 'absolute', right: 16 }} accessibilityRole="button" accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={20} color={Palette.textMuted} /> : <Eye size={20} color={Palette.textMuted} />}
                </Pressable>
              </View>
            ) : null}

            {msg ? (
              <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 180 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 14, color: msg.ok ? Palette.success : Palette.danger, paddingHorizontal: 4, textAlign: 'center' }}>{msg.text}</Text>
              </MotiView>
            ) : null}

            <PressableScale onPress={() => verify()} disabled={busy} accessibilityRole="button" accessibilityLabel={intent === 'recovery' ? 'Reset and sign in' : 'Verify and continue'} style={{ height: 54, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{intent === 'recovery' ? 'Reset & sign in' : 'Verify & continue'}</Text>}
            </PressableScale>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8 }}>
              <Pressable onPress={() => { setStep('form'); setCode(''); setMsg(null); }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.textSecondary }}>← back</Text>
              </Pressable>
              <Pressable onPress={resend} disabled={busy}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: ORANGE }}>Resend code</Text>
              </Pressable>
            </View>
          </MotiView>
        )}

        {step === 'form' ? (
          <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }} style={{ alignItems: 'center', marginTop: 18 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>
              {mode === 'signin' ? 'New here? ' : 'Already a member? '}
              <Text style={{ fontFamily: Font.heading, color: ORANGE }}>{mode === 'signin' ? 'Create account' : 'Sign in'}</Text>
            </Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
