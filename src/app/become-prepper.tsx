import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Award, Box, Camera, ChefHat, ChevronLeft, Clock, ExternalLink,
  FileText, Lock, ShieldCheck, ShieldX, Sparkles, TrendingUp, Users,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useApplyAsPrepper, useMyPrepperApplication } from '@/lib/queries/preppers';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { useAuth } from '@/providers/auth-provider';
import { PrepperTermsModal } from '@/components/prepper-terms-modal';
import { CertificationsStep, DocState, emptyDoc } from '@/components/prepper-application/certifications-step';
import { DocUploadGrid, UploadItem } from '@/components/prepper-application/doc-upload-grid';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const DRAFT_KEY = (uid: string) => `preppa.prepper-draft.v1.${uid}`;

const SPECIALTIES = ['Comfort food', 'Healthy', 'Vegan', 'Desserts', 'Caribbean', 'Asian', 'Mexican', 'Mediterranean', 'Halal', 'Keto'];
const CERT_RESOURCES = [
  { label: 'ServSafe Food Handler', url: 'https://www.servsafe.com/food-handler' },
  { label: 'State Food Safety', url: 'https://www.statefoodsafety.com' },
  { label: 'NRFSP Certification', url: 'https://www.nrfsp.com' },
];

const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, '');
const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

function SectionCard({ step, title, icon, children, delay = 0 }: {
  step: string; title: string; icon: React.ReactNode; children: React.ReactNode; delay?: number;
}) {
  return (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay }}
      style={{ backgroundColor: Palette.surface, borderRadius: 24, padding: 20, marginBottom: 14, ...Shadow.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: ORANGE, letterSpacing: 1.2, textTransform: 'uppercase' }}>{step}</Text>
          <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, letterSpacing: -0.3 }}>{title}</Text>
        </View>
      </View>
      {children}
    </MotiView>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>{children}</View>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BecomePrepperScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const signupsOpen = useFeatureEnabled('prepper_signups');
  const requireGovtId = useFeatureEnabled('require_govt_id');
  const requireFoodSafety = useFeatureEnabled('require_food_safety');
  const requireKitchenPhotos = useFeatureEnabled('require_kitchen_photos');
  const requireFridgePhotos = useFeatureEnabled('require_fridge_photos');
  const { data: application, isLoading, isError, refetch } = useMyPrepperApplication(user?.id);
  const apply = useApplyAsPrepper();

  const [name, setName] = useState((user?.user_metadata?.full_name as string) ?? '');
  const [bio, setBio] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [idDocs, setIdDocs] = useState<UploadItem[]>([]);
  const [certDocs, setCertDocs] = useState<UploadItem[]>([]);
  const [kitchenDocs, setKitchenDocs] = useState<UploadItem[]>([]);
  const [fridgeDocs, setFridgeDocs] = useState<UploadItem[]>([]);
  const [foodHandler, setFoodHandler] = useState<DocState>(emptyDoc());
  const [insurance, setInsurance] = useState<DocState>(emptyDoc());
  const [bizLicense, setBizLicense] = useState<DocState>(emptyDoc());
  const [showTerms, setShowTerms] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft on mount
  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(DRAFT_KEY(user.id)).then((saved) => {
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.name) setName(draft.name);
        if (draft.bio) setBio(draft.bio);
        if (draft.picked) setPicked(draft.picked);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Auto-save draft with debounce
  useEffect(() => {
    if (!user?.id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(DRAFT_KEY(user.id), JSON.stringify({ name, bio, picked }))
        .then(() => { setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2000); })
        .catch(() => {});
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [name, bio, picked, user?.id]);

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }
  function toggle(s: string) { setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s])); }
  function validate(): string | null {
    if (name.trim().length < 2) return 'Enter your kitchen or chef name.';
    if ([...idDocs, ...certDocs, ...kitchenDocs, ...fridgeDocs].some((d) => d.uploading))
      return 'Please wait for all uploads to finish.';
    if ([foodHandler, insurance, bizLicense].some((d) => d.uploading))
      return 'Please wait for document uploads to finish.';
    if (requireGovtId && !idDocs.some((d) => d.storagePath))
      return 'Government ID is required — upload at least one photo.';
    if (requireFoodSafety && !certDocs.some((d) => d.storagePath))
      return 'Food safety certificate is required — upload at least one photo.';
    if (requireKitchenPhotos && !kitchenDocs.some((d) => d.storagePath))
      return 'Kitchen photos are required — upload at least one photo.';
    if (requireFridgePhotos && !fridgeDocs.some((d) => d.storagePath))
      return 'Fridge/equipment photo is required — upload at least one photo.';
    return null;
  }
  function submit() {
    if (!user) return router.push('/auth?mode=signup');
    const photoDocs = [...idDocs, ...certDocs, ...kitchenDocs, ...fridgeDocs].filter((d) => d.storagePath).map((d) => d.storagePath!);
    const certDocs2 = [foodHandler.url, insurance.url, bizLicense.url].filter((u): u is string => !!u);
    const docs = [...photoDocs, ...certDocs2];
    apply.mutate(
      { displayName: cleanLine(name).trim(), bio: cleanBlock(bio).trim(), specialties: picked, applicationDocuments: docs },
      { onSuccess: () => { feedback.success(); setShowTerms(false); if (user?.id) { AsyncStorage.removeItem(DRAFT_KEY(user.id)).catch(() => {}); } }, onError: (e) => { feedback.error(); setShowTerms(false); setErr(e instanceof Error ? e.message : 'Something went wrong.'); } },
    );
  }
  function handleReview() {
    setErr(null);
    if (!user) return router.push('/auth?mode=signup');
    const e = validate();
    if (e) { feedback.error(); setErr(e); return; }
    feedback.tap();
    setShowTerms(true);
  }

  const backBtn = (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={22} color={INK} />
      </PressableScale>
      {draftSaved ? (
        <Text style={{ fontSize: 11, color: Palette.textSecondary, fontFamily: Font.body }}>Draft saved</Text>
      ) : null}
    </View>
  );

  if (isLoading) return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView style={{ flex: 1 }}>{backBtn}<ListSkeleton count={4} rowHeight={60} /></SafeAreaView>
    </View>
  );

  if (isError) return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView style={{ flex: 1 }}>
        {backBtn}
        <Centered>
          <MotiView from={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20, stiffness: 220 }}>
            <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <ChefHat size={30} color={Palette.textSecondary} />
            </View>
          </MotiView>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, textAlign: 'center' }}>couldn't load your application</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>Check your connection and try again.</Text>
          <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry"
            style={{ marginTop: 4, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: '#fff' }}>retry</Text>
          </PressableScale>
        </Centered>
      </SafeAreaView>
    </View>
  );

  if (application) {
    const map = {
      pending:   { Icon: Clock,     tint: Palette.amber,         title: 'Application under review',   body: "Thanks for applying! Our team is reviewing your kitchen. We'll notify you once you're approved — usually within 1–2 days.", cta: null },
      approved:  { Icon: Sparkles,  tint: Palette.success,       title: "You're approved!",            body: 'Welcome to Preppa. Your kitchen is live — start adding meals and taking preorders.',                                        cta: { label: 'Open my kitchen', onPress: () => router.replace('/dashboard') } },
      rejected:  { Icon: ShieldX,   tint: Palette.danger,        title: 'Application not approved',   body: application.rejection_note || 'Your application was not approved at this time. Reach out to support for details.',             cta: null },
      suspended: { Icon: ShieldX,   tint: Palette.textSecondary, title: 'Kitchen paused',             body: 'Your prepper account is currently paused. Contact support to reactivate.',                                                    cta: null },
    }[application.status];
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView style={{ flex: 1 }}>
          {backBtn}
          <Centered>
            <MotiView from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 200 }}>
              <View style={{ width: 82, height: 82, borderRadius: 28, backgroundColor: map.tint + '1F', alignItems: 'center', justifyContent: 'center' }}>
                <map.Icon size={36} color={map.tint} />
              </View>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, textAlign: 'center', letterSpacing: -0.6 }}>{map.title}</Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 320 }}>{map.body}</Text>
            </MotiView>
            {map.cta ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
                <PressableScale onPress={() => { feedback.tap(); map.cta!.onPress(); }} accessibilityRole="button" accessibilityLabel={map.cta.label}
                  style={{ marginTop: 8, paddingHorizontal: 28, height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{map.cta.label}</Text>
                </PressableScale>
              </MotiView>
            ) : null}
          </Centered>
        </SafeAreaView>
      </View>
    );
  }

  if (!signupsOpen) return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView style={{ flex: 1 }}>
        {backBtn}
        <Centered>
          <MotiView from={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20, stiffness: 220 }}>
            <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <Clock size={30} color={Palette.textSecondary} />
            </View>
          </MotiView>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, textAlign: 'center' }}>Applications are closed</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>
            We&apos;re not accepting new preppers right now. Check back soon!
          </Text>
        </Centered>
      </SafeAreaView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView style={{ flex: 1 }}>
        {backBtn}
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 52 }}>

          {/* ── Hero ─────────────────────────────────────────────────────────── */}
          <LinearGradient colors={[Palette.brandTint, Palette.canvas]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={{ alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 30 }}>

            <MotiView from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 16, stiffness: 180 }}>
              <View style={{ width: 86, height: 86, borderRadius: 30, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', ...Shadow.floating }}>
                <ChefHat size={42} color="#fff" />
              </View>
            </MotiView>

            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 80 }}
              style={{ alignItems: 'center', gap: 7 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.8, textAlign: 'center' }}>
                Become a Prepper
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 21 }}>
                Share your cooking, build a following, and earn from your kitchen.
              </Text>
            </MotiView>

            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 180 }}>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {([
                  { Icon: TrendingUp, label: 'Earn per meal' },
                  { Icon: Users,      label: 'Build following' },
                  { Icon: Award,      label: 'Verified chef' },
                ] as const).map(({ Icon, label }) => (
                  <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7, ...Shadow.card }}>
                    <Icon size={13} color={ORANGE} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: INK }}>{label}</Text>
                  </View>
                ))}
              </View>
            </MotiView>
          </LinearGradient>

          <View style={{ paddingHorizontal: 16 }}>

            {/* ── What happens next callout ─────────────────────────────────── */}
            <View style={{ backgroundColor: Palette.surface, borderRadius: 12, padding: 16, marginBottom: 20, marginTop: 8 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink, marginBottom: 8 }}>What happens next</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 20 }}>
                1. Submit your application (~10 min){'\n'}
                2. Our team reviews within 1–2 business days{'\n'}
                3. Get approved and start earning
              </Text>
            </View>

            {/* ── 01 Kitchen basics ────────────────────────────────────────── */}
            <SectionCard step="step 01" title="Kitchen basics" icon={<ChefHat size={22} color={ORANGE} />} delay={60}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft, marginBottom: 6 }}>Kitchen / chef name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="e.g. Kelsi's Kitchen"
                placeholderTextColor={Palette.textSecondary} autoCapitalize="words" maxLength={80}
                accessibilityLabel="Kitchen or chef name"
                style={{ height: 52, borderRadius: 14, backgroundColor: Palette.canvas, paddingHorizontal: 16, fontSize: 15, fontFamily: Font.body, color: INK }} />

              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft, marginTop: 16, marginBottom: 6 }}>About your kitchen</Text>
              <TextInput value={bio} onChangeText={setBio} placeholder="Tell customers what makes your food special…"
                placeholderTextColor={Palette.textSecondary} multiline maxLength={500}
                accessibilityLabel="About your kitchen"
                style={{ minHeight: 92, borderRadius: 14, backgroundColor: Palette.canvas, padding: 16, fontSize: 15, fontFamily: Font.body, color: INK, textAlignVertical: 'top' }} />

              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft, marginTop: 16, marginBottom: 10 }}>Specialties</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SPECIALTIES.map((s) => {
                  const on = picked.includes(s);
                  return (
                    <MotiView key={s}
                      animate={{ backgroundColor: on ? Palette.brandTint : Palette.canvas, borderColor: on ? ORANGE : Palette.border }}
                      transition={{ type: 'timing', duration: 160 }}
                      style={{ borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}>
                      <PressableScale onPress={() => { feedback.tap(); toggle(s); }}
                        accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={s}
                        style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? ORANGE : Palette.inkSoft }}>{s}</Text>
                      </PressableScale>
                    </MotiView>
                  );
                })}
              </View>
            </SectionCard>

            {/* ── 02 Identity verification ──────────────────────────────────── */}
            <SectionCard step="step 02" title="Identity verification" icon={<ShieldCheck size={21} color={ORANGE} />} delay={140}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Palette.canvas, borderRadius: 14, padding: 14, marginBottom: 2 }}>
                <Lock size={15} color={Palette.textSecondary} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>
                  Upload the front and back of your driver's license, passport, or state ID. Kept private — only our review team can see it.{!requireGovtId ? ' (optional)' : ''}
                </Text>
              </View>
              {user && <DocUploadGrid label="Government ID" items={idDocs} setItems={setIdDocs} max={4} userId={user.id} allowMultiple />}
            </SectionCard>

            {/* ── 03 Food safety certificates ───────────────────────────────── */}
            <SectionCard step="step 03" title="Food safety certificates" icon={<Award size={22} color={ORANGE} />} delay={220}>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20, marginBottom: 16 }}>
                Upload photos of your food handler's permit or food safety certificate. Multiple photos accepted — front and back, or several certs.{!requireFoodSafety ? ' (optional)' : ''}
              </Text>

              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                Don't have one yet?
              </Text>
              <View style={{ gap: 8 }}>
                {CERT_RESOURCES.map((r) => (
                  <PressableScale key={r.url} onPress={() => { feedback.tap(); void Linking.openURL(r.url); }}
                    accessibilityRole="link" accessibilityLabel={`Open ${r.label}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, backgroundColor: Palette.canvas }}>
                    <ExternalLink size={15} color={ORANGE} />
                    <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13.5, color: INK }}>{r.label}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>→</Text>
                  </PressableScale>
                ))}
              </View>

              {user && (
                <DocUploadGrid label="Certificates" items={certDocs} setItems={setCertDocs} max={6} userId={user.id} allowMultiple />
              )}
            </SectionCard>

            {/* ── 04 Kitchen photos ──────────────────────────────────────── */}
            <SectionCard step="step 04" title="Kitchen photos" icon={<Camera size={22} color={ORANGE} />} delay={300}>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20, marginBottom: 2 }}>
                Show us your cooking space. Clear, well-lit photos help reviewers verify your setup.{!requireKitchenPhotos ? ' (optional)' : ''}
              </Text>
              {user && (
                <DocUploadGrid label="Kitchen" items={kitchenDocs} setItems={setKitchenDocs} max={8} userId={user.id} allowMultiple />
              )}
            </SectionCard>

            {/* ── 05 Fridge & equipment ──────────────────────────────────── */}
            <SectionCard step="step 05" title="Fridge & equipment" icon={<Box size={22} color={ORANGE} />} delay={380}>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20, marginBottom: 2 }}>
                Photos of your fridge interior and key cooking equipment. Confirms proper storage and safety standards.{!requireFridgePhotos ? ' (optional)' : ''}
              </Text>
              {user && (
                <DocUploadGrid label="Fridge" items={fridgeDocs} setItems={setFridgeDocs} max={6} userId={user.id} allowMultiple />
              )}
            </SectionCard>

            {/* ── 06 Certifications & documents ──────────────────────────── */}
            {user && (
              <SectionCard step="step 06" title="certifications" icon={<FileText size={22} color={ORANGE} />} delay={460}>
                <CertificationsStep
                  userId={user.id}
                  foodHandler={foodHandler}
                  setFoodHandler={setFoodHandler}
                  insurance={insurance}
                  setInsurance={setInsurance}
                  bizLicense={bizLicense}
                  setBizLicense={setBizLicense}
                />
              </SectionCard>
            )}

            {/* ── Review & submit ─────────────────────────────────────────── */}
            {err ? (
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 200 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.danger, marginBottom: 14, textAlign: 'center' }}>{err}</Text>
              </MotiView>
            ) : null}

            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 540 }}>
              <PressableScale onPress={() => { void handleReview(); }}
                accessibilityRole="button" accessibilityLabel="Review and accept terms"
                style={{ height: 56, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', ...Shadow.floating }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Review & accept terms</Text>
              </PressableScale>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 18 }}>
                Reviewed within 1–2 days. You'll be notified once approved.
              </Text>
            </MotiView>

          </View>
        </ScrollView>
      </SafeAreaView>

      <PrepperTermsModal
        visible={showTerms}
        isPending={apply.isPending}
        onClose={() => setShowTerms(false)}
        onAccept={submit}
      />
    </View>
  );
}
