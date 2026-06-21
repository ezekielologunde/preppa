import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 28, color: Palette.ink, textAlign: 'center' }}>
          Preppa
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={Palette.textSecondary}
          style={{ height: 50, borderRadius: 12, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 16, fontFamily: Font.body, fontSize: 15, color: Palette.ink, backgroundColor: Palette.surface }}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          placeholderTextColor={Palette.textSecondary}
          style={{ height: 50, borderRadius: 12, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 16, fontFamily: Font.body, fontSize: 15, color: Palette.ink, backgroundColor: Palette.surface }}
        />
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={{ height: 50, borderRadius: 12, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 16, color: '#fff' }}>
            {loading ? 'Loading…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.brand }}>
            {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
