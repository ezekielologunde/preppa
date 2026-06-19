import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Camera, Check, ChefHat, ChevronLeft, MapPin } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyPrepperApplication, usePrepperProfile, useUpdateKitchenProfile } from '@/lib/queries/preppers';
import { pickAndUploadImage, pickAndUploadImageNative } from '@/lib/upload';
import { useAuth } from '@/providers/auth-provider';

// ─── Cuisine chips ─────────────────────────────────────────────────────────────
const SPECIALTIES = [
  'Comfort food', 'Healthy', 'Vegan', 'Vegetarian', 'Desserts',
  'Caribbean', 'Asian', 'Mexican', 'Mediterranean', 'Halal',
  'Keto', 'Paleo', 'Nigerian', 'Italian', 'Indian', 'Soul food',
];

const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, '');
const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

const inputStyle = (hasError?: boolean) => ({
  fontFamily: Font.body as string,
  fontSize: 15,
  color: Palette.ink,
  backgroundColor: Palette.canvas,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderWidth: 1,
  borderColor: hasError ? Palette.danger : Palette.border,
  minHeight: 44,
});

export default function KitchenSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const { data: profile, isLoading } = usePrepperProfile(prepper?.id);
  const update = useUpdateKitchenProfile();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Seed form from loaded profile
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.name ?? '');
    setBio(profile.bio ?? '');
    setCity(profile.city ?? '');
    setSpecialties(profile.specialties ?? []);
    setAvatarUrl(profile.avatar ?? null);
  }, [profile]);

  const toggleSpecialty = useCallback((tag: string) => {
    setSpecialties((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  async function handlePickPhoto() {
    setUploadErr(null);
    setUploading(true);
    try {
      const uid = prepper?.id ?? user?.id ?? 'anon';
      const url =
        Platform.OS === 'web'
          ? await pickAndUploadImage('kitchen-covers', uid)
          : await pickAndUploadImageNative('kitchen-covers', uid);
      if (url) setAvatarUrl(url);
    } catch (e) {
      feedback.error();
      setUploadErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    feedback.tap();
    const name = cleanLine(displayName).trim();
    if (!name || name.length < 2) {
      setNameError('Kitchen name must be at least 2 characters');
      feedback.error();
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      await update.mutateAsync({
        displayName: name,
        bio: cleanBlock(bio).trim() || null,
        avatarUrl,
        specialties,
        city: cleanLine(city).trim() || null,
      });
      feedback.success();
      setSaved(true);
      setTimeout(() => { if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }, 900);
    } catch (e) {
      feedback.error();
      setNameError(e instanceof Error ? e.message : 'Save failed — try again');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Palette.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 }}>
            kitchen profile
          </Text>
          {saved ? (
            <MotiView
              from={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={18} color="#fff" />
            </MotiView>
          ) : null}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }}>

            {/* Cover photo / kitchen avatar */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300 }}
              style={{ alignItems: 'center', marginBottom: 28 }}>
              <Pressable
                onPress={() => { feedback.tap(); void handlePickPhoto(); }}
                accessibilityRole="button"
                accessibilityLabel="Change kitchen photo"
                style={{ position: 'relative' }}>
                <View style={{ width: 100, height: 100, borderRadius: 28, backgroundColor: Palette.chip, overflow: 'hidden', borderWidth: 2, borderColor: Palette.brand + '44', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={{ width: 100, height: 100 }} contentFit="cover" accessibilityLabel="Kitchen cover photo" />
                  ) : (
                    <ChefHat size={36} color={Palette.textMuted} />
                  )}
                </View>
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Palette.canvas }}>
                  {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={15} color="#fff" />}
                </View>
              </Pressable>
              {uploadErr ? (
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>
                  {uploadErr}
                </Text>
              ) : null}
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 6 }}>
                tap to change kitchen photo
              </Text>
            </MotiView>

            {/* Fields */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 40 }}
              style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 16 }}>

              {/* Kitchen name */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <ChefHat size={14} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>kitchen name</Text>
                </View>
                <TextInput
                  value={displayName}
                  onChangeText={(v) => { setDisplayName(v); setNameError(null); }}
                  placeholder="Your kitchen name"
                  placeholderTextColor={Palette.textMuted}
                  returnKeyType="next"
                  maxLength={60}
                  accessibilityLabel="Kitchen name"
                  style={inputStyle(!!nameError)}
                />
                {nameError ? (
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger, marginTop: 4 }}>{nameError}</Text>
                ) : null}
              </View>

              {/* Bio */}
              <View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft, marginBottom: 6 }}>
                  about your kitchen
                </Text>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell customers what makes your kitchen special…"
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  numberOfLines={4}
                  maxLength={200}
                  accessibilityLabel="Kitchen bio"
                  style={{ ...inputStyle(), minHeight: 96, textAlignVertical: 'top' }}
                />
                <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted, marginTop: 4, textAlign: 'right' }}>
                  {bio.length}/200
                </Text>
              </View>

              {/* City */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <MapPin size={14} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>city / location</Text>
                </View>
                <TextInput
                  value={city}
                  onChangeText={(v) => setCity(v.slice(0, 80))}
                  placeholder="City, State"
                  placeholderTextColor={Palette.textMuted}
                  returnKeyType="done"
                  textContentType="addressCity"
                  maxLength={80}
                  accessibilityLabel="City"
                  style={inputStyle()}
                />
              </View>
            </MotiView>

            {/* Cuisine / specialty chips */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 100 }}
              style={{ marginHorizontal: 20, marginTop: 16 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3, marginBottom: 4 }}>
                cuisine specialties
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, marginBottom: 12 }}>
                Select all that apply — these appear on your kitchen page.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SPECIALTIES.map((tag) => {
                  const selected = specialties.includes(tag);
                  return (
                    <PressableScale
                      key={tag}
                      onPress={() => { feedback.tap(); toggleSpecialty(tag); }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={tag}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: Radius.pill,
                        backgroundColor: selected ? Palette.brand : Palette.surface,
                        borderWidth: 1.5,
                        borderColor: selected ? Palette.brand : Palette.border,
                      }}>
                      <Text style={{
                        fontFamily: Font.semibold,
                        fontSize: 13,
                        color: selected ? '#fff' : Palette.ink,
                      }}>
                        {tag}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </MotiView>

            {/* View kitchen page link */}
            {prepper?.id ? (
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 140 }}
                style={{ marginHorizontal: 20, marginTop: 20 }}>
                <PressableScale
                  onPress={() => { feedback.tap(); router.push({ pathname: '/prepper', params: { id: prepper.id } }); }}
                  accessibilityRole="button"
                  accessibilityLabel="View my kitchen page"
                  style={{
                    height: 46,
                    borderRadius: Radius.pill,
                    borderWidth: 1.5,
                    borderColor: Palette.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.brand }}>View my kitchen page →</Text>
                </PressableScale>
              </MotiView>
            ) : null}

            {/* Save button */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 160 }}
              style={{ marginHorizontal: 20, marginTop: 12 }}>
              <PressableScale
                onPress={handleSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Save kitchen profile"
                accessibilityState={{ disabled: saving }}
                style={{
                  height: 52,
                  borderRadius: Radius.pill,
                  backgroundColor: Palette.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: saving ? 0.7 : 1,
                }}>
                {saving ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>saving…</Text>
                  </View>
                ) : (
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>save kitchen profile</Text>
                )}
              </PressableScale>
            </MotiView>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
