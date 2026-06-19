import { Eye, EyeOff } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

export type AuthMode = 'signin' | 'signup';

export interface AuthFormProps {
  mode: AuthMode;
  busy: boolean;
  statusBlock: string | null | undefined;
  onSubmit: () => void;
  onForgot: () => void;
  onSendOtp: () => void;
  msg: { text: string; ok: boolean } | null;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
}

// ── Focused input border animation ─────────────────────────────────────────
function AnimatedInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  rightSlot,
  editable = true,
  hasError = false,
  ...rest
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  rightSlot?: React.ReactNode;
  editable?: boolean;
  hasError?: boolean;
  [key: string]: unknown;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = hasError
    ? Palette.danger
    : focused
    ? Palette.brand
    : Palette.border;

  return (
    <View
      style={{
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor,
        backgroundColor: Palette.surface,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
      }}>
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Palette.textMuted}
        secureTextEntry={secureTextEntry}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          fontSize: 16,
          fontFamily: Font.body,
          color: Palette.ink,
          height: 56,
        }}
      />
      {rightSlot}
    </View>
  );
}

export function AuthForm({
  mode,
  busy,
  statusBlock,
  onSubmit,
  onForgot,
  onSendOtp,
  msg,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
}: AuthFormProps) {
  const [showPw, setShowPw] = useState(false);
  const hasError = !!(msg && !msg.ok);

  return (
    <MotiView
      key={`form-${mode}`}
      from={{ opacity: 0, translateX: 20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 260 }}
      style={{ gap: 12 }}>

      {statusBlock ? (
        <View style={{
          backgroundColor: '#FEF2F2',
          borderColor: '#FECACA',
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
        }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.danger, marginBottom: 4 }}>
            {statusBlock === 'deleted' ? 'Account deleted' : 'Account suspended'}
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.inkSoft, lineHeight: 19 }}>
            {statusBlock === 'deleted'
              ? 'This account is scheduled for deletion. Contact support@preppa.live within 30 days to restore it.'
              : 'This account is suspended. Contact support@preppa.live for help.'}
          </Text>
        </View>
      ) : null}

      {mode === 'signup' && (
        <AnimatedInput
          placeholder="full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          textContentType="name"
          maxLength={80}
          editable={!busy}
          hasError={hasError}
          accessibilityLabel="Full name"
        />
      )}

      <AnimatedInput
        placeholder="you@email.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        maxLength={254}
        editable={!busy}
        hasError={hasError}
        accessibilityLabel="Email address"
      />

      <AnimatedInput
        placeholder="password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        textContentType={mode === 'signup' ? 'newPassword' : 'password'}
        maxLength={128}
        onSubmitEditing={onSubmit}
        returnKeyType={mode === 'signup' ? 'next' : 'go'}
        editable={!busy}
        hasError={hasError}
        accessibilityLabel="Password"
        rightSlot={
          <Pressable
            onPress={() => setShowPw((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
            {showPw
              ? <EyeOff size={20} color={Palette.textSecondary} />
              : <Eye size={20} color={Palette.textSecondary} />}
          </Pressable>
        }
      />

      {msg ? (
        <MotiView
          from={{ opacity: 0, translateY: 4 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 160 }}>
          <Text style={{
            fontFamily: Font.medium,
            fontSize: 13.5,
            color: msg.ok ? Palette.success : Palette.danger,
            paddingHorizontal: 2,
          }}>
            {msg.text}
          </Text>
        </MotiView>
      ) : null}

      <PressableScale
        onPress={onSubmit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={mode === 'signup' ? 'Create account' : 'Sign in'}
        style={{
          height: 54,
          borderRadius: 14,
          backgroundColor: Palette.brand,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
          opacity: busy ? 0.7 : 1,
        }}>
        {busy
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Text>}
      </PressableScale>

      {mode === 'signin' && (
        <Pressable
          onPress={onForgot}
          disabled={busy}
          style={{ alignItems: 'center', paddingVertical: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Forgot password">
          <Text style={{
            fontFamily: Font.medium,
            fontSize: 13.5,
            color: Palette.textSecondary,
          }}>
            Forgot password?
          </Text>
        </Pressable>
      )}

      <PressableScale
        onPress={onSendOtp}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Email me a sign-in code instead"
        style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.textSecondary }}>
          Email me a sign-in code{' '}
          <Text style={{ fontFamily: Font.heading, color: Palette.brand }}>instead</Text>
        </Text>
      </PressableScale>
    </MotiView>
  );
}
