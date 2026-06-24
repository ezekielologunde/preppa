import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Font } from '@/constants/fonts';
import { publishListing, type PublishStep } from '@/lib/listing-pipeline';
import { Palette, Radius, Space, Type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { BasicsStep } from '@/components/listing-wizard/basics-step';
import { TypeStep } from '@/components/listing-wizard/type-step';
import { AvailabilityStep } from '@/components/listing-wizard/availability-step';
import { DietStep } from '@/components/listing-wizard/diet-step';
import { PhotosStep } from '@/components/listing-wizard/photos-step';
import { PreviewStep } from '@/components/listing-wizard/preview-step';

export type LocalPhoto = { id: string; uri: string };

export type ListingForm = {
  name: string;
  tagline: string;
  price: string;
  servings: string;
  description: string;
  useCases: string[];
  serviceTypes: ('pickup' | 'delivery')[];
  availableDays: number[];
  dailyPortions: string;
  dietaryTags: string[];
  allergens: string[];
  photos: LocalPhoto[];
};

const STEPS = ['Details', 'Type', 'Availability', 'Diet', 'Photos', 'Preview'] as const;

const INITIAL_FORM: ListingForm = {
  name: '',
  tagline: '',
  price: '',
  servings: '',
  description: '',
  useCases: [],
  serviceTypes: ['pickup'],
  availableDays: [1, 2, 3, 4, 5],
  dailyPortions: '',
  dietaryTags: [],
  allergens: [],
  photos: [],
};

const DRAFT_KEY = '@preppa/listing-wizard-v1';

function validateStep(step: number, form: ListingForm): string | null {
  if (step === 0) {
    if (!form.name.trim()) return 'Please enter a meal name.';
    const price = parseFloat(form.price);
    if (!form.price.trim() || isNaN(price) || price <= 0) return 'Enter a price greater than £0.';
    const servings = parseInt(form.servings, 10);
    if (!form.servings.trim() || isNaN(servings) || servings < 1) return 'Enter the number of servings (at least 1).';
    return null;
  }
  if (step === 1) {
    return form.useCases.length === 0 ? 'Select at least one listing type to continue.' : null;
  }
  return null;
}

export default function CreateListingScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ListingForm>(INITIAL_FORM);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState<PublishStep | null>(null);

  const progressAnim = useRef(new Animated.Value(1)).current;
  const trackWidth = screenWidth - Space.lg * 2;

  // Restore draft on mount
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY)
      .then(saved => { if (saved) { try { setForm(JSON.parse(saved)); } catch {} } })
      .catch(() => {});
  }, []);

  // Auto-save draft on every change
  useEffect(() => {
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(form)).catch(() => {});
    setErrorMsg(null);
  }, [form]);

  // Auth gate — redirect to auth if no session
  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step + 1,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, STEPS.length],
    outputRange: [0, trackWidth],
  });

  function update<K extends keyof ListingForm>(key: K, value: ListingForm[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function goBack() {
    if (step === 0) {
      router.back();
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setErrorMsg(null);
      setStep(s => s - 1);
    }
  }

  function goNext() {
    const err = validateStep(step, form);
    if (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setErrorMsg(err);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrorMsg(null);
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      publish();
    }
  }

  async function publish() {
    setPublishing(true);
    setErrorMsg(null);
    setPublishStep(null);
    try {
      await publishListing(form, user!.id, (step) => setPublishStep(step));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.removeItem(DRAFT_KEY);
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setErrorMsg(msg);
      setPublishing(false);
      setPublishStep(null);
    }
  }

  if (authLoading || !user) return null;

  const isLast = step === STEPS.length - 1;
  const stepProps = { form, update };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
          <ChevronLeft size={22} color={Palette.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create a listing</Text>
        <Text style={styles.stepCounter}>Step {step + 1} of {STEPS.length}</Text>
      </View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.stepLabels}>
        {STEPS.map((label, i) => (
          <Text key={label} style={[styles.stepLabel, i === step && styles.stepLabelActive]}>
            {label}
          </Text>
        ))}
      </View>

      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <MotiView
        key={step}
        from={{ opacity: 0, translateX: 16 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 220 }}
        style={styles.content}
      >
        {step === 0 && <BasicsStep {...stepProps} />}
        {step === 1 && <TypeStep {...stepProps} />}
        {step === 2 && <AvailabilityStep {...stepProps} />}
        {step === 3 && <DietStep {...stepProps} />}
        {step === 4 && <PhotosStep {...stepProps} />}
        {step === 5 && <PreviewStep {...stepProps} />}
      </MotiView>

      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={goBack} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backButtonText}>{step === 0 ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={goNext}
          style={[styles.nextButton, publishing && styles.nextButtonDisabled]}
          disabled={publishing}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Publish listing' : 'Continue to next step'}
        >
          {publishing ? (
            <>
              <ActivityIndicator color={Palette.surface} size="small" style={styles.btnSpinner} />
              <Text style={styles.nextButtonText}>
                {publishStep?.stage === 'uploading'
                  ? `Uploading ${publishStep.progress + 1}/${publishStep.total}…`
                  : publishStep?.stage === 'saving'
                  ? 'Saving…'
                  : 'Publishing…'}
              </Text>
            </>
          ) : (
            <Text style={styles.nextButtonText}>{isLast ? 'Publish' : 'Continue'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Palette.chip,
    marginRight: Space.md,
  },
  headerTitle: { flex: 1, fontFamily: Font.heading, fontSize: Type.title, color: Palette.ink },
  stepCounter: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary },
  progressTrack: {
    height: 4,
    backgroundColor: Palette.border,
    marginHorizontal: Space.lg,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: Palette.brand, borderRadius: Radius.pill },
  stepLabels: {
    flexDirection: 'row',
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    paddingBottom: Space.xs ?? 4,
    gap: Space.md,
    flexWrap: 'wrap',
  },
  stepLabel: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted },
  stepLabelActive: { fontFamily: Font.semibold, color: Palette.brand },
  errorBanner: {
    marginHorizontal: Space.lg,
    marginBottom: Space.sm,
    backgroundColor: Palette.dangerTint,
    borderRadius: Radius.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderLeftWidth: 3,
    borderLeftColor: Palette.danger,
  },
  errorText: { fontFamily: Font.medium, fontSize: Type.label, color: Palette.danger },
  content: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.lg,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  backButton: {
    flex: 1, height: 48,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  backButtonText: { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.inkSoft },
  nextButton: {
    flex: 2, height: 48,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Palette.brand,
    gap: Space.sm,
  },
  btnSpinner: { flexShrink: 0 },
  nextButtonDisabled: { opacity: 0.6 },
  nextButtonText: { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.surface },
});
