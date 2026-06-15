import { useLocalSearchParams, useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PreppaLogo } from '@/components/preppa-logo';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type Mode = 'signin' | 'signup';
type Intent = 'signup' | 'signin-otp' | 'recovery';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { signIn, signUp, sendCode, verifyCode, resetPassword, updatePassword, statusBlock } = useAuth();

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

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  function shake() {
    shakeX.value = withSequence(
      withSpring(-10, { damping: 3, stiffness: 500 }),
      withSpring(9, { damping: 3, stiffness: 500 }),
      withSpring(-5, { damping: 4, stiffness: 500 }),
      withSpring(0, { damping: 8, stiffness: 400 }),
    );
  }

  const tap = () => feedback.impact();
  const fail = (text: string) => {
    feedback.error();
    shake();
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

  async function submit() {
    setMsg(null);
    if (mode === 'signup' && name.trim().length < 2) return fail('Tell us your name.');
    if (!emailOk(email)) return fail('Enter a valid email.');
    if (password.length < 8) return fail('Password must be at least 8 characters.');
    setBusy(true);
    tap();
    if (mode === 'signup') {
      const { error, needsConfirmation } = await signUp(email.trim().toLowerCase(), password, name.trim());
      if (error) return fail(error);
      if (needsConfirmation) return goCode('signup', `We sent a 6-digit code to ${email.trim().toLowerCase()} to confirm your email.`);
      feedback.success();
      return router.replace('/onboarding-flow' as never);
    }
    const { error } = await signIn(email.trim().toLowerCase(), password);
    if (error) return fail(/invalid login/i.test(error) ? 'Wrong email or password.' : error);
    feedback.success();
    router.replace('/');
  }

  async function sendOtp() {
    setMsg(null);
    if (!emailOk(email)) return fail('Enter your email first.');
    setBusy(true);
    tap();
    const { error } = await sendCode(email.trim().toLowerCase(), mode === 'signup' ? name.trim() : undefined);
    if (error) return fail(error);
    goCode('signin-otp', `We sent a 6-digit sign-in code to ${email.trim().toLowerCase()}.`);
  }

  async function forgot() {
    setMsg(null);
    if (!emailOk(email)) return fail('Enter your email first, then tap reset.');
    setBusy(true);
    tap();
    const { error } = await resetPassword(email.trim().toLowerCase());
    if (error) return fail(error);
    goCode('recovery', `We sent a reset code to ${email.trim().toLowerCase()}.`);
  }

  async function verify(value?: string) {
    const c = (value ?? code).replace(/\D/g, '').slice(0, 6);
    setMsg(null);
    if (c.length !== 6) return fail('Enter the 6-digit code.');
    if (intent === 'recovery' && newPassword.length < 8) return fail('Choose a password (8+ characters).');
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
    router.replace((intent === 'signup' ? '/onboarding-flow' : '/') as never);
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Font.body,
    color: '#fff',
  } as const;

  const errorInput = msg && !msg.ok ? { borderColor: Palette.danger + '80' } : {};

  const title = step === 'code'
    ? intent === 'recovery' ? 'reset password' : intent === 'signup' ? 'verify email' : 'enter code'
    : mode === 'signin' ? 'welcome back' : 'join preppa';

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0604' }}>
      {/* Ambient brand glow */}
      <MotiView from={{ opacity: 0.6, translateY: -10 }} animate={{ opacity: 1, translateY: 14 }}
        transition={{ type: 'timing', duration: 5000, loop: true, repeatReverse: true }}
        pointerEvents="none"
        style={{ position: 'absolute', top: -140, alignSelf: 'center', width: 440, height: 440, borderRadius: 220,
          experimental_backgroundImage: 'radial-gradient(circle, rgba(232,97,26,0.2), transparent 70%)' }} />

      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        {/* Logo — slides down from splash position */}
        <MotiView from={{ opacity: 0, translateY: -24 }} animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 130, delay: 80 }}
          style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 20 }}>
          <PreppaLogo size={72} glow />
          <MotiView key={title} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }} style={{ alignItems: 'center', gap: 6, marginTop: 14 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 28, color: '#fff', letterSpacing: -0.8 }}>{title}</Text>
            {step === 'form' ? (
              <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 280 }}>
                {mode === 'signin' ? 'sign in to your account' : 'real food from real local preppas'}
              </Text>
            ) : null}
          </MotiView>
        </MotiView>

        {/* Social OAuth buttons — shown on form step only */}
        {step === 'form' ? (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 260, delay: 120 }}
            style={{ gap: 10, marginBottom: 18 }}>
            <PressableScale onPress={() => { feedback.tap(); setMsg({ text: 'Apple Sign In launching soon — use email for now.', ok: true }); }}
              style={{ height: 52, borderRadius: Radius.pill, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Text style={{ fontSize: 20, color: '#fff', lineHeight: 24 }}></Text>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Continue with Apple</Text>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); setMsg({ text: 'Google Sign In launching soon — use email for now.', ok: true }); }}
              style={{ height: 52, borderRadius: Radius.pill, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Text style={{ fontSize: 18, lineHeight: 22 }}>G</Text>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#111' }}>Continue with Google</Text>
            </PressableScale>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>or with email</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            </View>
          </MotiView>
        ) : null}

        {/* Form */}
        <Animated.View style={shakeStyle}>
          {step === 'form' ? (
            <MotiView key={`form-${mode}`} from={{ opacity: 0, translateX: 22 }} animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'spring', damping: 17, stiffness: 170 }} style={{ gap: 12 }}>
              {statusBlock ? (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)', borderWidth: 1, borderRadius: 14, padding: 14 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff', marginBottom: 4 }}>
                    {statusBlock === 'deleted' ? 'Account deleted' : 'Account suspended'}
                  </Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 19 }}>
                    {statusBlock === 'deleted'
                      ? 'This account is scheduled for deletion. Contact support@preppa.live within 30 days to restore it.'
                      : 'This account is suspended. Contact support@preppa.live for help.'}
                  </Text>
                </View>
              ) : null}
              {mode === 'signup' ? (
                <TextInput style={[input, errorInput]} placeholder="full name" placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="words" textContentType="name" maxLength={80} value={name} onChangeText={setName}
                  editable={!busy} />
              ) : null}
              <TextInput style={[input, errorInput]} placeholder="you@email.com" placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="none" autoComplete="email" textContentType="emailAddress" keyboardType="email-address"
                maxLength={254} value={email} onChangeText={setEmail} editable={!busy} />
              <View style={{ justifyContent: 'center' }}>
                <TextInput style={[input, errorInput, { paddingRight: 52 }]} placeholder="password"
                  placeholderTextColor="rgba(255,255,255,0.3)" autoCapitalize="none" secureTextEntry={!showPw}
                  textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                  maxLength={128} value={password} onChangeText={setPassword} onSubmitEditing={submit}
                  returnKeyType={mode === 'signup' ? 'next' : 'go'} editable={!busy} />
                <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} style={{ position: 'absolute', right: 16 }}
                  accessibilityRole="button" accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={20} color="rgba(255,255,255,0.4)" /> : <Eye size={20} color="rgba(255,255,255,0.4)" />}
                </Pressable>
              </View>
              {mode === 'signin' ? (
                <Pressable onPress={forgot} disabled={busy} style={{ alignSelf: 'flex-end' }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: 'rgba(255,255,255,0.45)' }}>Forgot password?</Text>
                </Pressable>
              ) : null}
              {msg ? (
                <MotiView from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 160 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: msg.ok ? Palette.success : Palette.danger, paddingHorizontal: 2 }}>{msg.text}</Text>
                </MotiView>
              ) : null}
              <PressableScale onPress={submit} disabled={busy} accessibilityRole="button"
                accessibilityLabel={mode === 'signup' ? 'Create account' : 'Sign in'}
                style={{ height: 54, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>}
              </PressableScale>
              <PressableScale onPress={sendOtp} disabled={busy} style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
                  Email me a sign-in code <Text style={{ fontFamily: Font.heading, color: ORANGE }}>instead</Text>
                </Text>
              </PressableScale>
            </MotiView>
          ) : (
            <MotiView key="code" from={{ opacity: 0, translateX: 22 }} animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'spring', damping: 17, stiffness: 170 }} style={{ gap: 12 }}>
              <TextInput ref={codeRef}
                style={[input, errorInput, { textAlign: 'center', fontSize: 30, letterSpacing: 14, fontFamily: Font.display, height: 64 }]}
                placeholder="••••••" placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6}
                editable={!busy} value={code}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, '').slice(0, 6);
                  setCode(digits);
                  if (digits.length === 6 && intent !== 'recovery') verify(digits);
                }} />
              {intent === 'recovery' ? (
                <View style={{ justifyContent: 'center' }}>
                  <TextInput style={[input, errorInput, { paddingRight: 52 }]} placeholder="new password"
                    placeholderTextColor="rgba(255,255,255,0.3)" autoCapitalize="none" secureTextEntry={!showPw}
                    textContentType="newPassword" maxLength={128} value={newPassword} onChangeText={setNewPassword}
                    editable={!busy} />
                  <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} style={{ position: 'absolute', right: 16 }}>
                    {showPw ? <EyeOff size={20} color="rgba(255,255,255,0.4)" /> : <Eye size={20} color="rgba(255,255,255,0.4)" />}
                  </Pressable>
                </View>
              ) : null}
              {msg ? (
                <MotiView from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 160 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 14, color: msg.ok ? Palette.success : Palette.danger, textAlign: 'center' }}>{msg.text}</Text>
                </MotiView>
              ) : null}
              <PressableScale onPress={() => verify()} disabled={busy} accessibilityRole="button"
                style={{ height: 54, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{intent === 'recovery' ? 'Reset & sign in' : 'Verify & continue'}</Text>}
              </PressableScale>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8 }}>
                <Pressable onPress={() => { feedback.tap(); setStep('form'); setCode(''); setMsg(null); }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>← back</Text>
                </Pressable>
                <Pressable onPress={resend} disabled={busy}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: ORANGE }}>Resend code</Text>
                </Pressable>
              </View>
            </MotiView>
          )}
        </Animated.View>

        {step === 'form' ? (
          <Pressable onPress={() => { feedback.tap(); setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }}
            style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
              {mode === 'signin' ? 'New here? ' : 'Already a member? '}
              <Text style={{ fontFamily: Font.heading, color: ORANGE }}>{mode === 'signin' ? 'Create account' : 'Sign in'}</Text>
            </Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
