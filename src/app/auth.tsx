import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  LinearTransition,
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  withRepeat,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Flame, Eye, EyeOff, Mail, Lock, User, ShieldCheck } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, Type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

// ── CUSTOM FLOATING LABEL INPUT COMPONENT ──
interface FloatingLabelInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  icon: React.ReactNode;
}

function FloatingLabelInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  icon,
}: FloatingLabelInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const animatedFocus = useSharedValue(value ? 1 : 0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    animatedFocus.value = withTiming(isFocused || value ? 1 : 0, {
      duration: 200,
    });
  }, [isFocused, value, animatedFocus]);

  const labelStyle = useAnimatedStyle(() => {
    const translateY = interpolate(animatedFocus.value, [0, 1], [0, -18]);
    const translateX = interpolate(animatedFocus.value, [0, 1], [0, -8]);
    const scale = interpolate(animatedFocus.value, [0, 1], [1, 0.82]);
    const labelColor = interpolateColor(
      animatedFocus.value,
      [0, 1],
      [Palette.textSecondary, Palette.brand]
    );

    return {
      transform: [{ translateY }, { translateX }, { scale }],
      color: labelColor,
    };
  });

  const isSecure = secureTextEntry && !showPassword;

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={stylesInput.container}>
      <View style={[stylesInput.inputWrapper, isFocused && stylesInput.inputWrapperFocused]}>
        <View style={stylesInput.iconWrapper}>
          {icon}
        </View>
        <Animated.Text style={[stylesInput.label, labelStyle]}>
          {label}
        </Animated.Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={stylesInput.textInput}
          placeholder=""
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              setShowPassword(!showPassword);
            }}
            style={stylesInput.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff size={20} color={Palette.textSecondary} />
            ) : (
              <Eye size={20} color={Palette.textSecondary} />
            )}
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const stylesInput = StyleSheet.create({
  container: {
    marginVertical: Space.sm,
    width: '100%',
  },
  inputWrapper: {
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    position: 'relative',
  },
  inputWrapperFocused: {
    borderColor: Palette.brand,
    shadowColor: Palette.brand,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  iconWrapper: {
    marginRight: Space.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
  },
  label: {
    position: 'absolute',
    left: 48,
    fontFamily: Font.body,
    fontSize: Type.body,
    backgroundColor: Palette.surface,
    paddingHorizontal: 4,
    zIndex: 1,
    pointerEvents: 'none',
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontFamily: Font.body,
    fontSize: Type.body,
    color: Palette.ink,
    paddingTop: 12,
    paddingBottom: 2,
  },
  eyeButton: {
    padding: Space.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});


// ── MAIN AUTH SCREEN OVERHAUL ──
export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { width } = useWindowDimensions();

  // Mode & form states
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Reanimated pulse animation state
  const buttonPulse = useSharedValue(0.5);

  useEffect(() => {
    if (loading) {
      buttonPulse.value = withRepeat(
        withTiming(1, { duration: 650 }),
        -1,
        true
      );
    } else {
      buttonPulse.value = 1;
    }
  }, [loading, buttonPulse]);

  const animatedButtonStyle = useAnimatedStyle(() => {
    if (!loading) return { transform: [{ scale: 1 }], opacity: 1 };
    return {
      opacity: interpolate(buttonPulse.value, [0.5, 1], [0.8, 1]),
      transform: [{ scale: interpolate(buttonPulse.value, [0.5, 1], [0.98, 1.02]) }],
    };
  });

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing details', 'Enter your email and password to continue.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      Alert.alert('Missing details', 'Please enter your full name.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match. Please verify your typing.');
      return;
    }

    // Trigger haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(trimmedEmail, password);
      setLoading(false);
      if (error) {
        Alert.alert("Couldn't sign in", error);
      }
    } else {
      const { error, needsConfirmation } = await signUp(trimmedEmail, password, fullName.trim());
      setLoading(false);
      if (error) {
        Alert.alert("Couldn't create account", error);
        return;
      }
      if (needsConfirmation) {
        Alert.alert(
          'Confirm your email',
          `We've sent a confirmation link to ${trimmedEmail}. Tap it, then sign in.`,
          [{ text: 'OK', onPress: () => setMode('signin') }]
        );
      }
    }
  }

  const handleSocialSignIn = (provider: 'google' | 'apple') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Alert.alert(
      `${provider.charAt(0).toUpperCase() + provider.slice(1)} Auth`,
      `This would trigger Supabase OAuth with ${provider} in a production environment.`
    );
  };

  const toggleMode = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setMode(mode === 'signin' ? 'signup' : 'signin');
  };

  const isDesktopOrTablet = width > 480;

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, isDesktopOrTablet ? styles.cardDesktop : styles.cardMobile]}>
            {/* Header / Logo */}
            <View style={styles.header}>
              <View style={styles.logoWell}>
                <Flame size={28} color={Palette.brand} />
              </View>
              <Text style={styles.brandTitle}>Preppa</Text>
              <Text style={styles.headerSubtitle}>
                {mode === 'signin' ? 'Welcome back! Let’s get you cooking.' : 'Create an account to start meal prepping.'}
              </Text>
            </View>

            {/* Inputs Container with Layout Transitions */}
            <Animated.View layout={LinearTransition.springify().damping(15)} style={styles.formContainer}>
              {mode === 'signup' && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(150)}
                >
                  <FloatingLabelInput
                    label="Full Name"
                    value={fullName}
                    onChangeText={setFullName}
                    icon={<User size={20} color={Palette.textSecondary} />}
                    autoCapitalize="words"
                  />
                </Animated.View>
              )}

              <FloatingLabelInput
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon={<Mail size={20} color={Palette.textSecondary} />}
              />

              <FloatingLabelInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                icon={<Lock size={20} color={Palette.textSecondary} />}
              />

              {mode === 'signup' && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(150)}
                >
                  <FloatingLabelInput
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    icon={<ShieldCheck size={20} color={Palette.textSecondary} />}
                  />
                </Animated.View>
              )}
            </Animated.View>

            {/* CTA Button with pulse animation */}
            <Animated.View style={animatedButtonStyle}>
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.submitBtn,
                  loading && styles.submitBtnDisabled,
                  !loading && pressed && styles.submitBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Create account'}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Palette.surface} style={styles.spinner} />
                    <Text style={styles.submitBtnText}>Authenticating...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitBtnText}>
                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  </Text>
                )}
              </Pressable>
            </Animated.View>

            {/* Switch Mode Button */}
            <Pressable
              onPress={toggleMode}
              style={({ pressed }) => [styles.switchBtn, pressed && styles.switchBtnPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.switchBtnText}>
                {mode === 'signin' ? "No account? Sign up" : 'Have an account? Sign in'}
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Authentication */}
            <View style={styles.socialRow}>
              <Pressable
                onPress={() => handleSocialSignIn('google')}
                style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
              >
                <View style={styles.socialBtnContent}>
                  <Text style={styles.socialBtnText}>Google</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handleSocialSignIn('apple')}
                style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Apple"
              >
                <View style={styles.socialBtnContent}>
                  <Text style={styles.socialBtnText}>Apple</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    alignSelf: 'center',
  },
  cardDesktop: {
    maxWidth: 480,
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    padding: Space.xl * 1.5,
    marginVertical: Space.xl,
    borderWidth: 1,
    borderColor: Palette.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardMobile: {
    backgroundColor: 'transparent',
    padding: Space.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Space.xl,
  },
  logoWell: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Palette.brandTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Space.md,
  },
  brandTitle: {
    fontFamily: Font.display,
    fontSize: Type.displayLg,
    color: Palette.ink,
    marginBottom: Space.xs,
  },
  headerSubtitle: {
    fontFamily: Font.body,
    fontSize: Type.body,
    color: Palette.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Space.md,
  },
  formContainer: {
    width: '100%',
    marginBottom: Space.lg,
    gap: Space.xs,
  },
  submitBtn: {
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: Palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.brand,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginTop: Space.sm,
  },
  submitBtnPressed: {
    backgroundColor: Palette.brandPressed,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: Font.semibold,
    fontSize: Type.body,
    color: Palette.surface,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: Space.md,
  },
  switchBtn: {
    alignItems: 'center',
    marginTop: Space.lg,
    paddingVertical: Space.xs,
  },
  switchBtnPressed: {
    opacity: 0.7,
  },
  switchBtnText: {
    fontFamily: Font.medium,
    fontSize: Type.label,
    color: Palette.brand,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Space.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Palette.border,
  },
  dividerText: {
    fontFamily: Font.body,
    fontSize: Type.micro,
    color: Palette.textSecondary,
    marginHorizontal: Space.md,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Space.md,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialBtnPressed: {
    backgroundColor: Palette.chip,
    borderColor: Palette.divider,
  },
  socialBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialBtnText: {
    fontFamily: Font.medium,
    fontSize: Type.label,
    color: Palette.ink,
  },
});
