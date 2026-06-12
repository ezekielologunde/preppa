import { useRouter } from 'expo-router';
import { ChefHat, ChevronLeft, Clock, ShieldX, Sparkles } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useApplyAsPrepper, useMyPrepperApplication } from '@/lib/queries/preppers';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const SPECIALTIES = ['Comfort food', 'Healthy', 'Vegan', 'Desserts', 'Caribbean', 'Asian', 'Mexican', 'Mediterranean', 'Halal', 'Keto'];

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
  const [err, setErr] = useState<string | null>(null);

  function goBack() {
    feedback.tap();
    try { router.back(); } catch { router.replace('/profile'); }
  }

  function toggle(s: string) {
    setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  }

  function submit() {
    setErr(null);
    if (!user) return router.push('/auth?mode=signup');
    if (name.trim().length < 2) return setErr('Enter your kitchen or chef name.');
    apply.mutate(
      { userId: user.id, displayName: name.trim(), bio: bio.trim(), specialties: picked },
      { onError: (e) => setErr(e instanceof Error ? e.message : 'Something went wrong.') },
    );
  }

  const Header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
      <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={22} color={INK} />
      </PressableScale>
    </View>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView style={{ flex: 1 }}>{Header}<Centered><ActivityIndicator color={ORANGE} /></Centered></SafeAreaView>
      </View>
    );
  }

  // --- Lifecycle states for an existing application ---
  if (application) {
    const map = {
      pending: { Icon: Clock, tint: '#F59E0B', title: 'Application under review', body: "Thanks for applying! Our team is reviewing your kitchen. We'll notify you once you're approved — usually within 1–2 days.", cta: null },
      approved: { Icon: Sparkles, tint: Palette.success, title: "You're approved!", body: 'Welcome to Preppa. Your kitchen is live — start adding meals and taking orders.', cta: { label: 'Open my kitchen', onPress: () => router.replace('/dashboard') } },
      rejected: { Icon: ShieldX, tint: '#EF4444', title: 'Application not approved', body: application.rejection_note || 'Your application was not approved at this time. Reach out to support for details.', cta: null },
      suspended: { Icon: ShieldX, tint: '#6B7280', title: 'Kitchen paused', body: 'Your prepper account is currently paused. Contact support to reactivate.', cta: null },
    }[application.status];
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <Centered>
            <MotiView from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', duration: 380, bounce: 0.2 }}>
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
                <PressableScale onPress={() => { feedback.tap(); map.cta!.onPress(); }} accessibilityRole="button" accessibilityLabel={map.cta.label} style={{ marginTop: 8, paddingHorizontal: 24, height: 52, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{map.cta.label}</Text>
                </PressableScale>
              </MotiView>
            ) : null}
          </Centered>
        </SafeAreaView>
      </View>
    );
  }

  // --- Signups closed (admin feature flag off) ---
  if (!signupsOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <Centered>
            <MotiView from={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', duration: 360, bounce: 0.15 }}>
              <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={30} color={Palette.textMuted} />
              </View>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, textAlign: 'center' }}>Applications are closed</Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>
                We&apos;re not accepting new preppers right now. Check back soon!
              </Text>
            </MotiView>
          </Centered>
        </SafeAreaView>
      </View>
    );
  }

  // --- Application form ---
  return (
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <SafeAreaView style={{ flex: 1 }}>
        {Header}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }}>
          <View style={{ alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={30} color={ORANGE} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.8 }}>Become a Prepper</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', maxWidth: 300, lineHeight: 22 }}>
              Share your cooking, build a following, and earn from your kitchen.
            </Text>
          </View>
          </MotiView>

          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK, marginBottom: 8 }}>Kitchen / chef name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Kelsi's Kitchen" placeholderTextColor={Palette.textMuted} autoCapitalize="words"
              style={{ height: 54, borderRadius: 16, backgroundColor: Palette.canvas, paddingHorizontal: 16, fontSize: 16, fontFamily: Font.body, color: INK }} />
          </MotiView>

          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK, marginTop: 18, marginBottom: 8 }}>About your kitchen</Text>
            <TextInput value={bio} onChangeText={setBio} placeholder="Tell customers what makes your food special…" placeholderTextColor={Palette.textMuted} multiline
              style={{ minHeight: 96, borderRadius: 16, backgroundColor: Palette.canvas, padding: 16, fontSize: 15, fontFamily: Font.body, color: INK, textAlignVertical: 'top' }} />
          </MotiView>

          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK, marginTop: 18, marginBottom: 10 }}>Specialties</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SPECIALTIES.map((s) => {
                const on = picked.includes(s);
                return (
                  <PressableScale key={s} onPress={() => { feedback.tap(); toggle(s); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={s}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill, backgroundColor: on ? Palette.brandTint : '#F4F4F6', borderWidth: 1, borderColor: on ? ORANGE : 'transparent' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? ORANGE : Palette.inkSoft }}>{s}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </MotiView>

          {err ? <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.danger, marginTop: 16 }}>{err}</Text> : null}

          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 260 }}>
            <PressableScale onPress={() => { feedback.tap(); submit(); }} disabled={apply.isPending} accessibilityRole="button" accessibilityLabel="Submit application"
              style={{ height: 54, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 24, opacity: apply.isPending ? 0.7 : 1 }}>
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
