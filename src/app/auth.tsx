import { useLocalSearchParams, useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PreppaLogo } from '@/components/preppa-logo';
import { PressableScale } from '@/components/ui/pressable-scale';
import { AuthForm } from '@/components/auth/auth-form';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAuth } from '@/providers/auth-provider';

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
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [fieldError, setFieldError] = useState<'name' | 'email' | 'password' | null>(null);
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

  const fail = (text: string, field: 'name' | 'email' | 'password' | null = null) => {
    feedback.error(); shake(); setBusy(false); setMsg({ text, ok: false }); setFieldError(field);
  };

  const goCode = (next: Intent, text: string) => {
    feedback.success();
    setBusy(false);
    setIntent(next);
    setStep('code');
    setCode('');
    setFieldError(null);
    setMsg({ text, ok: true });
    setTimeout(() => codeRef.current?.focus(), 250);
  };

  async function submit() {
    setMsg(null);
    setFieldError(null);
    if (mode === 'signup' && name.trim().length < 2) return fail('Tell us your name.', 'name');
    if (!emailOk(email)) return fail('Enter a valid email.', 'email');
    if (password.length < 8) return fail('Password must be at least 8 characters.', 'password');
    setBusy(true);
    feedback.impact();
    if (mode === 'signup') {
      const { error, needsConfirmation } = await signUp(email.trim().toLowerCase(), password, name.trim());
      if (error) return fail(error);
      if (needsConfirmation) return goCode('signup', `We sent a 6-digit code to ${email.trim().toLowerCase()} to confirm your email.`);
      feedback.success();
      return; // AuthGate navigates to onboarding once session is set
    }
    const { error } = await signIn(email.trim().toLowerCase(), password);
    if (error) {
      const msg = /invalid login/i.test(error) ? 'Wrong email or password.'
        : /email.*(not confirmed|not verified)/i.test(error) ? 'Please confirm your email — check your inbox for the code we sent.'
        : error;
      return fail(msg);
    }
    feedback.success();
    // AuthGate detects the new session and navigates away from this screen
  }

  async function sendOtp() {
    setMsg(null);
    if (!emailOk(email)) return fail('Enter your email first.');
    setBusy(true);
    feedback.impact();
    const { error } = await sendCode(email.trim().toLowerCase(), mode === 'signup' ? name.trim() : undefined);
    if (error) return fail(error);
    goCode('signin-otp', `We sent a 6-digit sign-in code to ${email.trim().toLowerCase()}.`);
  }

  async function forgot() {
    setMsg(null);
    if (!emailOk(email)) return fail('Enter your email first, then tap reset.');
    setBusy(true);
    feedback.impact();
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
    feedback.impact();
    const type = intent === 'signup' ? 'signup' : intent === 'recovery' ? 'recovery' : 'email';
    const { error } = await verifyCode(email.trim().toLowerCase(), c, type);
    if (error) return fail(error);
    if (intent === 'recovery') {
      const up = await updatePassword(newPassword);
      if (up.error) return fail(up.error);
    }
    feedback.success();
    // AuthGate detects the verified session and navigates to the right destination
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
    if (error) feedback.error();
    setMsg(error ? { text: error, ok: false } : { text: 'New code sent.', ok: true });
  }

  const hasError = !!(msg && !msg.ok);

  const screenTitle = step === 'code'
    ? intent === 'recovery' ? 'reset password' : intent === 'signup' ? 'verify email' : 'enter code'
    : mode === 'signin' ? 'welcome back' : 'join preppa';

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, paddingHorizontal: 24 }}>

        {/* Wordmark + tagline */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260, delay: 60 }}
          style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 28 }}>
          <PreppaLogo size={64} glow={false} />
          <MotiView
            key={screenTitle}
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ alignItems: 'center', marginTop: 16, gap: 4 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 32, color: Palette.ink, letterSpacing: -0.5 }}>
              {screenTitle}
            </Text>
            {step === 'form' && (
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, letterSpacing: 0.2 }}>
                fresh. local. yours.
              </Text>
            )}
          </MotiView>
        </MotiView>

        {/* TODO: Social auth (Apple / Google) — coming soon */}

        {/* Form / Code step */}
        <Animated.View style={shakeStyle}>
          {step === 'form' ? (
            <AuthForm
              mode={mode}
              busy={busy}
              statusBlock={statusBlock}
              onSubmit={submit}
              onForgot={forgot}
              onSendOtp={sendOtp}
              msg={msg}
              fieldError={fieldError}
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
            />
          ) : (
            <MotiView
              key="code"
              from={{ opacity: 0, translateX: 20 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
              style={{ gap: 12 }}>
              <TextInput
                ref={codeRef}
                style={{
                  height: 64,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: hasError ? Palette.danger : Palette.border,
                  backgroundColor: Palette.surface,
                  textAlign: 'center',
                  fontSize: 30,
                  letterSpacing: 14,
                  fontFamily: Font.display,
                  color: Palette.ink,
                }}
                placeholder="••••••"
                placeholderTextColor={Palette.textMuted}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                editable={!busy}
                value={code}
                accessibilityLabel="6-digit verification code"
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, '').slice(0, 6);
                  setCode(digits);
                  if (digits.length === 6 && intent !== 'recovery') verify(digits);
                }}
              />

              {intent === 'recovery' && (
                <View style={{ height: 56, borderRadius: 16, borderWidth: 1, borderColor: hasError ? Palette.danger : Palette.border, backgroundColor: Palette.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                  <TextInput
                    placeholder="new password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    textContentType="newPassword"
                    maxLength={128}
                    editable={!busy}
                    placeholderTextColor={Palette.textMuted}
                    accessibilityLabel="New password"
                    style={{ flex: 1, fontSize: 16, fontFamily: Font.body, color: Palette.ink, height: 56 }}
                  />
                  <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={20} color={Palette.textSecondary} /> : <Eye size={20} color={Palette.textSecondary} />}
                  </Pressable>
                </View>
              )}

              {msg ? (
                <MotiView from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 160 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 14, color: msg.ok ? Palette.success : Palette.danger, textAlign: 'center' }}>
                    {msg.text}
                  </Text>
                </MotiView>
              ) : null}

              <PressableScale
                onPress={() => verify()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={intent === 'recovery' ? 'Reset and sign in' : 'Verify and continue'}
                style={{ height: 54, borderRadius: 14, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                      {intent === 'recovery' ? 'Reset & sign in' : 'Verify & continue'}
                    </Text>}
              </PressableScale>

              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8 }}>
                <Pressable
                  onPress={() => { feedback.tap(); setStep('form'); setCode(''); setMsg(null); }}
                  accessibilityRole="button"
                  accessibilityLabel="Back to form"
                  style={{ height: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.textSecondary }}>back</Text>
                </Pressable>
                <Pressable
                  onPress={resend}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Resend code"
                  style={{ height: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.brand }}>Resend code</Text>
                </Pressable>
              </View>
            </MotiView>
          )}
        </Animated.View>

        {/* Toggle signin / signup */}
        {step === 'form' && (
          <Pressable
            onPress={() => { feedback.tap(); setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }}
            style={{ alignItems: 'center', marginTop: 24 }}
            accessibilityRole="button"
            accessibilityLabel={mode === 'signin' ? 'Create account' : 'Sign in to existing account'}>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>
              {mode === 'signin' ? 'New here? ' : 'Already a member? '}
              <Text style={{ fontFamily: Font.heading, color: Palette.brand }}>
                {mode === 'signin' ? 'Create account' : 'Sign in'}
              </Text>
            </Text>
          </Pressable>
        )}

        {/* Legal links */}
        {step === 'form' && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 16, gap: 4 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
              By signing up, you agree to our
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/legal/terms' as never); }}
              accessibilityRole="link"
              accessibilityLabel="Terms of Service">
              <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.brand }}>
                Terms of Service
              </Text>
            </PressableScale>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
              and
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/legal/privacy' as never); }}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy">
              <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.brand }}>
                Privacy Policy.
              </Text>
            </PressableScale>
          </View>
        )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
