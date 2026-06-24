import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, TouchTarget, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Text style={styles.title}>Preppa</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={Palette.textSecondary}
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          placeholderTextColor={Palette.textSecondary}
          style={styles.input}
        />
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Create account'}
        >
          <Text style={styles.submitBtnText}>
            {loading ? 'Loading…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={styles.switchBtn}
          accessibilityRole="button"
        >
          <Text style={styles.switchBtnText}>
            {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  inner: { flex: 1, justifyContent: 'center', padding: Space.xl, gap: Space.lg },
  title: { fontFamily: Font.display, fontSize: Type.displayLg, color: Palette.ink, textAlign: 'center' },
  input: {
    height: TouchTarget,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Space.lg,
    fontFamily: Font.body,
    fontSize: Type.body,
    color: Palette.ink,
    backgroundColor: Palette.surface,
  },
  submitBtn: {
    height: TouchTarget,
    borderRadius: Radius.md,
    backgroundColor: Palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.surface },
  switchBtn: { alignItems: 'center' },
  switchBtnText: { fontFamily: Font.body, fontSize: Type.label, color: Palette.brand },
});
