import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, Type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { submitApplication, type SubmitStep } from '@/lib/application-pipeline';
import { LegalStep } from '@/components/apply-wizard/legal-step';
import { DocumentsStep } from '@/components/apply-wizard/documents-step';
import { ReviewStep } from '@/components/apply-wizard/review-step';

export type LocalPhoto = { id: string; uri: string };

export type ApplicationForm = {
  legalName: string;
  postcode: string;
  kitchenAddress: string;
  bio: string;
  experienceYears: string;
  specialties: string;
  insuranceAttested: boolean;
  contractorAttested: boolean;
  natashsLawAcknowledged: boolean;
  kitchenPhotos: LocalPhoto[];
  foodSafetyCertUri: string | null;
  certExpirationDate: string;
};

const STEPS = ['Legal', 'Documents', 'Review'] as const;

const INITIAL_FORM: ApplicationForm = {
  legalName: '', postcode: '', kitchenAddress: '', bio: '',
  experienceYears: '', specialties: '',
  insuranceAttested: false, contractorAttested: false, natashsLawAcknowledged: false,
  kitchenPhotos: [], foodSafetyCertUri: null, certExpirationDate: '',
};

const MAX_FORM_WIDTH = 560;

function validateStep(step: number, form: ApplicationForm): string | null {
  if (step === 0) {
    if (!form.legalName.trim())      return 'Please enter your full legal name.';
    if (!form.postcode.trim())       return 'Please enter your postcode.';
    if (!form.insuranceAttested)     return 'Please confirm your insurance declaration.';
    if (!form.contractorAttested)    return 'Please confirm your self-employment declaration.';
    if (!form.natashsLawAcknowledged) return 'Please acknowledge your Natasha\'s Law obligations.';
  }
  if (step === 1) {
    if (form.kitchenPhotos.length < 2) return 'Please add at least 2 kitchen photos.';
    if (form.foodSafetyCertUri && form.certExpirationDate) {
      if (form.certExpirationDate.length < 10) return 'Enter a valid certificate expiry date (DD/MM/YYYY).';
      const [dd, mm, yyyy] = form.certExpirationDate.split('/');
      const d = parseInt(dd, 10), mo = parseInt(mm, 10), y = parseInt(yyyy, 10);
      if (isNaN(d) || isNaN(mo) || isNaN(y) || mo < 1 || mo > 12 || d < 1 || d > 31) {
        return 'Enter a valid certificate expiry date (DD/MM/YYYY).';
      }
      if (new Date(y, mo - 1, d) <= new Date()) {
        return 'Certificate expiry date must be in the future.';
      }
    }
  }
  return null;
}

export default function ApplyScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ApplicationForm>(INITIAL_FORM);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<SubmitStep | null>(null);
  const [checking, setChecking] = useState(true);

  const progressAnim = useRef(new Animated.Value(1)).current;
  const trackWidth = Math.min(screenWidth, MAX_FORM_WIDTH) - Space.lg * 2;

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user]);

  // Check for existing application
  useEffect(() => {
    if (!user) return;
    supabase
      .from('prepper_applications')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) router.replace('/apply/pending');
        else setChecking(false);
      });
  }, [user]);

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

  function update<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrorMsg(null);
  }

  function goBack() {
    if (step === 0) { router.back(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrorMsg(null);
    setStep(s => s - 1);
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
      submit();
    }
  }

  async function submit() {
    if (!user) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSubmitStep(null);
    try {
      await submitApplication(form, user.id, s => setSubmitStep(s));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/apply/pending');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setErrorMsg(msg);
      setSubmitting(false);
      setSubmitStep(null);
    }
  }

  if (authLoading || !user || checking) return null;

  const isLast = step === STEPS.length - 1;

  function submitLabel() {
    if (!submitting) return isLast ? 'Submit Application' : 'Continue';
    if (submitStep?.stage === 'uploading-photos') {
      return `Uploading photo ${(submitStep.progress ?? 0) + 1}/${submitStep.total}…`;
    }
    if (submitStep?.stage === 'uploading-cert') return 'Uploading certificate…';
    return 'Submitting…';
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.formContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <ChevronLeft size={22} color={Palette.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Become a Prepper</Text>
          <Text style={styles.stepCounter}>Step {step + 1} of {STEPS.length}</Text>
        </View>

        {/* Progress */}
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

        {/* Error */}
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Step content */}
        <MotiView
          key={step}
          from={{ opacity: 0, translateX: 16 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 220 }}
          style={styles.content}
        >
          {step === 0 && <LegalStep form={form} update={update} />}
          {step === 1 && <DocumentsStep form={form} update={update} />}
          {step === 2 && <ReviewStep form={form} />}
        </MotiView>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} accessibilityRole="button">
            <Text style={styles.backButtonText}>{step === 0 ? 'Cancel' : 'Back'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goNext}
            style={[styles.nextButton, submitting && styles.nextButtonDisabled]}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={isLast ? 'Submit application' : 'Continue to next step'}
          >
            {submitting
              ? <ActivityIndicator color={Palette.surface} size="small" style={styles.spinner} />
              : null}
            <Text style={styles.nextButtonText}>{submitLabel()}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Palette.canvas },
  formContainer: { flex: 1, width: '100%', maxWidth: MAX_FORM_WIDTH, alignSelf: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Space.lg, paddingVertical: Space.md,
  },
  backBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.sm, backgroundColor: Palette.chip, marginRight: Space.md,
  },
  headerTitle:   { flex: 1, fontFamily: Font.heading, fontSize: Type.title, color: Palette.ink },
  stepCounter:   { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary },
  progressTrack: {
    height: 4, backgroundColor: Palette.border,
    marginHorizontal: Space.lg, borderRadius: Radius.pill, overflow: 'hidden',
  },
  progressFill:  { height: 4, backgroundColor: Palette.brand, borderRadius: Radius.pill },
  stepLabels: {
    flexDirection: 'row', paddingHorizontal: Space.lg,
    paddingTop: Space.sm, paddingBottom: 2, gap: Space.md,
  },
  stepLabel:      { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted },
  stepLabelActive: { fontFamily: Font.semibold, color: Palette.brand },
  errorBanner: {
    marginHorizontal: Space.lg, marginBottom: Space.sm,
    backgroundColor: Palette.dangerTint, borderRadius: Radius.sm,
    paddingHorizontal: Space.lg, paddingVertical: Space.sm,
    borderLeftWidth: 3, borderLeftColor: Palette.danger,
  },
  errorText:     { fontFamily: Font.medium, fontSize: Type.label, color: Palette.danger },
  content:       { flex: 1 },
  bottomBar: {
    flexDirection: 'row', gap: Space.md,
    paddingHorizontal: Space.lg, paddingVertical: Space.lg,
    borderTopWidth: 1, borderTopColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  backButton: {
    flex: 1, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border,
  },
  backButtonText: { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.inkSoft },
  nextButton: {
    flex: 2, height: 48, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.sm, backgroundColor: Palette.brand, gap: Space.sm,
  },
  nextButtonDisabled: { opacity: 0.6 },
  spinner:       { flexShrink: 0 },
  nextButtonText: { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.surface },
});
