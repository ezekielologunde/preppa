import { useRouter } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Globe, MapPin, Salad, User } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, '');
const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

const NAME_RE = /^[a-zA-Z\s\-']{2,60}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const URL_RE = /^https?:\/\/.+/;

function validate(field: string, value: string): string | null {
  if (field === 'full_name') {
    if (!value.trim()) return 'Name is required';
    if (!NAME_RE.test(value.trim())) return "Letters, spaces, hyphens and apostrophes only";
  }
  if (field === 'username') {
    if (!value.trim()) return 'Username is required';
    if (!USERNAME_RE.test(value.trim())) return '3–20 characters, letters, numbers and underscores';
  }
  if (field === 'bio' && value.length > 200) return 'Bio must be 200 characters or less';
  if (field === 'website' && value && !URL_RE.test(value.trim())) return 'Enter a valid URL starting with https://';
  return null;
}

type Fields = { full_name: string; username: string; bio: string; location: string; website: string };
type Errors = Partial<Record<keyof Fields, string>>;

function ProfileField({ label, icon, error, hint, delay, children }: {
  label: string; icon?: ReactNode; error?: string; hint?: string; delay: number; children: ReactNode;
}) {
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>{label}</Text>
      </View>
      {children}
      {hint ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 4 }}>{hint}</Text> : null}
      {error ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger, marginTop: 4 }}>{error}</Text> : null}
    </MotiView>
  );
}

const inputStyle = (hasError?: boolean) => ({
  fontFamily: Font.body, fontSize: 15, color: Palette.ink, backgroundColor: Palette.canvas,
  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1,
  borderColor: hasError ? Palette.danger : Palette.border, minHeight: 44,
});

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const meta = user?.user_metadata ?? {};

  const [fields, setFields] = useState<Fields>({
    full_name: (meta.full_name as string) ?? '',
    username: (meta.username as string) ?? '',
    bio: (meta.bio as string) ?? '',
    location: (meta.location as string) ?? '',
    website: (meta.website as string) ?? '',
  });
  const [original] = useState<Fields>({ ...fields });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasChanges = (Object.keys(fields) as (keyof Fields)[]).some((k) => fields[k] !== original[k]);
  const hasErrors = Object.values(errors).some(Boolean);

  const set = useCallback((key: keyof Fields, val: string) => {
    setFields((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  const onBlur = useCallback((key: keyof Fields) => {
    const err = validate(key, fields[key]);
    setErrors((e) => ({ ...e, [key]: err ?? undefined }));
  }, [fields]);

  async function handleSave() {
    feedback.tap();
    const newErrors: Errors = {};
    (Object.keys(fields) as (keyof Fields)[]).forEach((k) => {
      const err = validate(k, fields[k]);
      if (err) newErrors[k] = err;
    });
    if (Object.values(newErrors).some(Boolean)) { setErrors(newErrors); feedback.error(); return; }
    setSaving(true);
    const fullName = cleanLine(fields.full_name).trim();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName, username: fields.username.trim(), bio: cleanBlock(fields.bio).trim(),
              location: cleanLine(fields.location).trim(), website: cleanLine(fields.website).trim() },
    });
    if (error) { setSaving(false); feedback.error(); setErrors((e) => ({ ...e, full_name: error.message })); return; }
    if (user?.id) {
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
    }
    setSaving(false);
    feedback.success();
    setSaved(true);
    setTimeout(() => router.back(), 1000);
  }


  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 }}>edit profile</Text>
          {saved ? (
            <MotiView from={{ scale: 0.82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={18} color="#fff" />
            </MotiView>
          ) : null}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48, paddingTop: 24 }}>

            {/* Fields */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 40 }}
              style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 16 }}>

              <ProfileField label="full name" icon={<User size={14} color={Palette.textSecondary} />} error={errors.full_name} delay={80}>
                <TextInput value={fields.full_name} onChangeText={(v) => set('full_name', v)} onBlur={() => onBlur('full_name')}
                  placeholder="Your full name" placeholderTextColor={Palette.textSecondary} accessibilityLabel="Full name"
                  returnKeyType="next" textContentType="name" maxLength={80}
                  style={inputStyle(!!errors.full_name)} />
              </ProfileField>

              <ProfileField label="username" error={errors.username} delay={120}
                hint={fields.username.length >= 3 && !errors.username ? `preppa.live/@${fields.username.toLowerCase()}` : undefined}>
                <TextInput value={fields.username} onChangeText={(v) => set('username', v.toLowerCase())} onBlur={() => onBlur('username')}
                  placeholder="your_handle" placeholderTextColor={Palette.textSecondary} autoCapitalize="none" autoCorrect={false}
                  returnKeyType="next" textContentType="username" maxLength={30}
                  accessibilityLabel="Username" style={inputStyle(!!errors.username)} />
              </ProfileField>

              <ProfileField label="bio" error={errors.bio} delay={160}
                hint={`${fields.bio.length}/200`}>
                <TextInput value={fields.bio} onChangeText={(v) => set('bio', v)} onBlur={() => onBlur('bio')}
                  placeholder="Tell people a little about yourself…" placeholderTextColor={Palette.textSecondary}
                  multiline numberOfLines={3} maxLength={200} accessibilityLabel="Bio"
                  style={{ ...inputStyle(!!errors.bio), minHeight: 88, textAlignVertical: 'top' }} />
              </ProfileField>

              <ProfileField label="location" icon={<MapPin size={14} color={Palette.textSecondary} />} delay={200}>
                <TextInput value={fields.location} onChangeText={(v) => set('location', v.slice(0, 80))}
                  placeholder="City, State" placeholderTextColor={Palette.textSecondary} accessibilityLabel="Location"
                  returnKeyType="next" textContentType="location" maxLength={80}
                  style={inputStyle()} />
              </ProfileField>

              <ProfileField label="website (optional)" icon={<Globe size={14} color={Palette.textSecondary} />} error={errors.website} delay={240}>
                <TextInput value={fields.website} onChangeText={(v) => set('website', v)} onBlur={() => onBlur('website')}
                  placeholder="https://yoursite.com" placeholderTextColor={Palette.textSecondary}
                  autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Website URL"
                  returnKeyType="done" textContentType="URL" maxLength={200}
                  style={inputStyle(!!errors.website)} />
              </ProfileField>
            </MotiView>

            {/* Dietary preferences shortcut */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 260 }}
              style={{ marginHorizontal: 20, marginTop: 12 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3, marginBottom: 8 }}>preferences</Text>
              <PressableScale onPress={() => { feedback.tap(); router.push('/dietary-preferences'); }}
                accessibilityRole="button" accessibilityLabel="Edit dietary preferences"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <Salad size={17} color={Palette.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>Dietary preferences</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, marginTop: 1 }}>Restrictions, allergies & cuisines</Text>
                </View>
                <ChevronRight size={15} color={Palette.textSecondary} />
              </PressableScale>
            </MotiView>

            {/* Save */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 280 }}
              style={{ marginHorizontal: 20, marginTop: 24 }}>
              <PressableScale onPress={handleSave} disabled={!hasChanges || hasErrors || saving}
                accessibilityRole="button" accessibilityLabel="Save profile changes" accessibilityState={{ disabled: !hasChanges || hasErrors || saving }}
                style={{ height: 52, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', opacity: !hasChanges || hasErrors || saving ? 0.5 : 1 }}>
                {saving ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>saving…</Text>
                  </View>
                ) : (
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>save changes</Text>
                )}
              </PressableScale>
            </MotiView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
