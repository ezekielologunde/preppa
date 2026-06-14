import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ChefHat, ChevronLeft, Clock, ExternalLink, Plus, ShieldCheck, ShieldX, Sparkles, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useApplyAsPrepper, useMyPrepperApplication } from '@/lib/queries/preppers';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, '');
const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

const ORANGE = Palette.brand;
const INK = Palette.ink;
const SPECIALTIES = ['Comfort food', 'Healthy', 'Vegan', 'Desserts', 'Caribbean', 'Asian', 'Mexican', 'Mediterranean', 'Halal', 'Keto'];
const CERT_RESOURCES = [
  { label: 'ServSafe Food Handler', url: 'https://www.servsafe.com/food-handler' },
  { label: 'State Food Safety', url: 'https://www.statefoodsafety.com' },
  { label: 'NRFSP Certification', url: 'https://www.nrfsp.com' },
];

type UploadItem = { localUri: string; storagePath: string | null; uploading: boolean; error: boolean };

async function uploadDoc(localUri: string, userId: string, label: string): Promise<string> {
  const ext = (localUri.split('.').pop() ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const path = `${userId}/application/${label}_${Date.now()}.${ext}`;
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const { data, error } = await supabase.storage
    .from('certifications')
    .upload(path, decode(base64), { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false });
  if (error) throw error;
  return data.path;
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
      {icon}
      <Text style={{ fontFamily: Font.heading, fontSize: 12, color: ORANGE, letterSpacing: 0.6, textTransform: 'uppercase' }}>{title}</Text>
    </View>
  );
}

function DocSection({
  label, hint, items, setItems, max = 4, userId,
}: {
  label: string; hint: string; items: UploadItem[];
  setItems: React.Dispatch<React.SetStateAction<UploadItem[]>>;
  max?: number; userId: string;
}) {
  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    let insertIdx = 0;
    setItems((prev) => { insertIdx = prev.length; return [...prev, { localUri: uri, storagePath: null, uploading: true, error: false }]; });
    try {
      const path = await uploadDoc(uri, userId, label.toLowerCase().replace(/\s+/g, '-'));
      setItems((prev) => prev.map((d, i) => i === insertIdx ? { ...d, storagePath: path, uploading: false } : d));
    } catch {
      setItems((prev) => prev.map((d, i) => i === insertIdx ? { ...d, uploading: false, error: true } : d));
    }
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginBottom: 10, lineHeight: 18 }}>{hint}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((item, idx) => (
          <View key={`${idx}-${item.localUri}`} style={{ width: 88, height: 88, borderRadius: 14, overflow: 'hidden', backgroundColor: Palette.canvas }}>
            <Image source={{ uri: item.localUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            {item.uploading && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
            {item.error && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(220,38,38,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontFamily: Font.semibold, fontSize: 11 }}>Failed</Text>
              </View>
            )}
            <PressableScale onPress={() => { feedback.tap(); setItems((p) => p.filter((_, i) => i !== idx)); }}
              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} color="#fff" />
            </PressableScale>
          </View>
        ))}
        {items.length < max && (
          <PressableScale onPress={() => { feedback.tap(); void pick(); }}
            style={{ width: 88, height: 88, borderRadius: 14, borderWidth: 1.5, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.canvas, gap: 4 }}>
            <Plus size={20} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary }}>Add photo</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>{children}</View>;
}

export default function BecomePrepperScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const signupsOpen = useFeatureEnabled('prepper_signups');
  const { data: application, isLoading } = useMyPrepperApplication(user?.id);
  const apply = useApplyAsPrepper();

  const [name, setName] = useState((user?.user_metadata?.full_name as string) ?? '');
  const [bio, setBio] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [idDocs, setIdDocs] = useState<UploadItem[]>([]);
  const [certDocs, setCertDocs] = useState<UploadItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }
  function toggle(s: string) { setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s])); }
  function submit() {
    setErr(null);
    if (!user) return router.push('/auth?mode=signup');
    if (name.trim().length < 2) return setErr('Enter your kitchen or chef name.');
    if ([...idDocs, ...certDocs].some((d) => d.uploading)) return setErr('Please wait for uploads to finish.');
    const docs = [...idDocs, ...certDocs].filter((d) => d.storagePath).map((d) => d.storagePath!);
    apply.mutate(
      { userId: user.id, displayName: cleanLine(name).trim(), bio: cleanBlock(bio).trim(), specialties: picked, applicationDocuments: docs },
      { onSuccess: () => feedback.success(), onError: (e) => setErr(e instanceof Error ? e.message : 'Something went wrong.') },
    );
  }

  const Header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
      <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={22} color={INK} />
      </PressableScale>
    </View>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <ListSkeleton count={4} rowHeight={60} />
        </SafeAreaView>
      </View>
    );
  }

  if (application) {
    const map = {
      pending: { Icon: Clock, tint: Palette.amber, title: 'Application under review', body: "Thanks for applying! Our team is reviewing your kitchen. We'll notify you once you're approved — usually within 1–2 days.", cta: null },
      approved: { Icon: Sparkles, tint: Palette.success, title: "You're approved!", body: 'Welcome to Preppa. Your kitchen is live — start adding meals and taking preorders.', cta: { label: 'Open my kitchen', onPress: () => router.replace('/dashboard') } },
      rejected: { Icon: ShieldX, tint: Palette.danger, title: 'Application not approved', body: application.rejection_note || 'Your application was not approved at this time. Reach out to support for details.', cta: null },
      suspended: { Icon: ShieldX, tint: Palette.textSecondary, title: 'Kitchen paused', body: 'Your prepper account is currently paused. Contact support to reactivate.', cta: null },
    }[application.status];
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <Centered>
            <MotiView from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 200 }}>
              <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: map.tint + '1F', alignItems: 'center', justifyContent: 'center' }}>
                <map.Icon size={32} color={map.tint} />
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
                  style={{ marginTop: 8, paddingHorizontal: 24, height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{map.cta.label}</Text>
                </PressableScale>
              </MotiView>
            ) : null}
          </Centered>
        </SafeAreaView>
      </View>
    );
  }

  if (!signupsOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <Centered>
            <MotiView from={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20, stiffness: 220 }}>
              <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={30} color={Palette.textMuted} />
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
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <SafeAreaView style={{ flex: 1 }}>
        {Header}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }}>
            <View style={{ alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 24 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <ChefHat size={30} color={ORANGE} />
              </View>
              <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.7 }}>Become a Prepper</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 300, lineHeight: 21 }}>
                Share your cooking, build a following, and earn from your kitchen.
              </Text>
            </View>
          </MotiView>

          {/* Kitchen basics */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
            <SectionHeader icon={<ChefHat size={14} color={ORANGE} />} title="Kitchen basics" />
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK, marginTop: 14, marginBottom: 8 }}>Kitchen / chef name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Kelsi's Kitchen" placeholderTextColor={Palette.textMuted} autoCapitalize="words"
              accessibilityLabel="Kitchen or chef name"
              style={{ height: 54, borderRadius: 16, backgroundColor: Palette.canvas, paddingHorizontal: 16, fontSize: 16, fontFamily: Font.body, color: INK }} />
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK, marginTop: 18, marginBottom: 8 }}>About your kitchen</Text>
            <TextInput value={bio} onChangeText={setBio} placeholder="Tell customers what makes your food special…" placeholderTextColor={Palette.textMuted} multiline
              accessibilityLabel="About your kitchen"
              style={{ minHeight: 88, borderRadius: 16, backgroundColor: Palette.canvas, padding: 16, fontSize: 15, fontFamily: Font.body, color: INK, textAlignVertical: 'top' }} />
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK, marginTop: 18, marginBottom: 10 }}>Specialties</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SPECIALTIES.map((s) => {
                const on = picked.includes(s);
                return (
                  <MotiView
                    key={s}
                    animate={{
                      backgroundColor: on ? Palette.brandTint : Palette.chip,
                      borderColor: on ? ORANGE : Palette.chip,
                    }}
                    transition={{ type: 'timing', duration: 180 }}
                    style={{ borderRadius: Radius.pill, borderWidth: 1, overflow: 'hidden' }}>
                    <PressableScale
                      onPress={() => { feedback.tap(); toggle(s); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={s}
                      style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? ORANGE : Palette.inkSoft }}>{s}</Text>
                    </PressableScale>
                  </MotiView>
                );
              })}
            </View>
          </MotiView>

          {/* Identity verification */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
            <View style={{ marginTop: 22 }}>
              <SectionHeader icon={<ShieldCheck size={14} color={ORANGE} />} title="Identity verification" />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 6, marginBottom: 4, lineHeight: 18 }}>
                A photo of your driver's licence, passport, or state ID. Kept private — only our review team can see it.
              </Text>
              {user && (
                <DocSection label="Government ID" hint="Upload the front of your ID." items={idDocs} setItems={setIdDocs} max={2} userId={user.id} />
              )}
            </View>
          </MotiView>

          {/* Food safety */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 160 }}>
            <View style={{ marginTop: 22 }}>
              <SectionHeader icon={<ShieldCheck size={14} color={ORANGE} />} title="Food safety certification" />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 6, marginBottom: 12, lineHeight: 18 }}>
                Upload your food handler's permit or food safety certificate. Don't have one yet? Get certified through one of these providers:
              </Text>
              <View style={{ gap: 8 }}>
                {CERT_RESOURCES.map((r) => (
                  <PressableScale key={r.url} onPress={() => { feedback.tap(); void Linking.openURL(r.url); }} accessibilityRole="link" accessibilityLabel={`Open ${r.label}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: Palette.canvas, borderWidth: 1, borderColor: Palette.border }}>
                    <ExternalLink size={15} color={ORANGE} />
                    <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 14, color: INK }}>{r.label}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>Get certified →</Text>
                  </PressableScale>
                ))}
              </View>
              {user && (
                <DocSection label="Certificates" hint="Upload photos of your food safety certificate(s). Multiple uploads accepted." items={certDocs} setItems={setCertDocs} max={4} userId={user.id} />
              )}
            </View>
          </MotiView>

          {err ? <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.danger, marginTop: 16 }}>{err}</Text> : null}

          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
            <PressableScale onPress={() => { feedback.tap(); submit(); }} disabled={apply.isPending} accessibilityRole="button" accessibilityLabel="Submit application"
              style={{ height: 54, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 24, opacity: apply.isPending ? 0.7 : 1 }}>
              {apply.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Submit application</Text>}
            </PressableScale>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, textAlign: 'center', marginTop: 12 }}>
              Reviewed within 1–2 days. You&apos;ll be notified once approved.
            </Text>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
