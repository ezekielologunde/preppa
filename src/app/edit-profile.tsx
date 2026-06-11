import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, Check, Globe, MapPin, User } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { pickAndUploadImage } from '@/lib/upload';
import { useAuth } from '@/providers/auth-provider';

const NAME_RE = /^[a-zA-Z\s\-']{2,60}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const URL_RE = /^https?:\/\/.+/;

function validate(field: string, value: string): string | null {
  if (field === 'full_name') {
    if (!value.trim()) return 'Name is required';
    if (!NAME_RE.test(value.trim()))
      return "Name can only contain letters, spaces, hyphens and apostrophes";
  }
  if (field === 'username') {
    if (!value.trim()) return 'Username is required';
    if (!USERNAME_RE.test(value.trim()))
      return '3–20 characters, letters, numbers and underscores only';
  }
  if (field === 'bio') {
    if (value.length > 160) return 'Bio must be 160 characters or less';
  }
  if (field === 'website') {
    if (value && !URL_RE.test(value.trim()))
      return 'Enter a valid URL starting with http:// or https://';
  }
  return null;
}

type Fields = {
  full_name: string;
  username: string;
  bio: string;
  location: string;
  website: string;
};

type Errors = Partial<Record<keyof Fields, string>>;

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (meta.avatar_url as string | null) ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hasChanges =
    fields.full_name !== original.full_name ||
    fields.username !== original.username ||
    fields.bio !== original.bio ||
    fields.location !== original.location ||
    fields.website !== original.website;

  const hasErrors = Object.values(errors).some(Boolean);

  const set = useCallback((key: keyof Fields, val: string) => {
    setFields((f) => ({ ...f, [key]: val }));
    // Clear error on change
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  const onBlur = useCallback((key: keyof Fields) => {
    const err = validate(key, fields[key]);
    setErrors((e) => ({ ...e, [key]: err ?? undefined }));
  }, [fields]);

  const handleSave = async () => {
    // Validate all
    const newErrors: Errors = {};
    (Object.keys(fields) as (keyof Fields)[]).forEach((k) => {
      const err = validate(k, fields[k]);
      if (err) newErrors[k] = err;
    });
    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      feedback.error();
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fields.full_name.trim(),
        username: fields.username.trim(),
        bio: fields.bio,
        location: fields.location.trim(),
        website: fields.website.trim(),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      },
    });
    setSaving(false);

    if (error) {
      feedback.error();
      setErrors((e) => ({ ...e, full_name: error.message }));
      return;
    }

    feedback.success();
    setSaved(true);
    setTimeout(() => router.back(), 1000);
  };

  const handlePickAvatar = async () => {
    setUploadError(null);
    try {
      const url = await pickAndUploadImage('avatars', user?.id ?? 'anon');
      if (url) setAvatarUrl(url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const displayName = fields.full_name || user?.email?.split('@')[0] || 'you';

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 14,
            backgroundColor: Palette.ink,
            gap: 12,
          }}>
          <PressableScale
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ArrowLeft size={22} color="#fff" />
          </PressableScale>
          <Text
            style={{
              flex: 1,
              fontFamily: Font.heading,
              fontSize: 18,
              color: '#fff',
              letterSpacing: -0.3,
            }}>
            edit profile
          </Text>
          {saved ? (
            <MotiView
              from={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: Palette.success,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Check size={18} color="#fff" />
            </MotiView>
          ) : null}
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 48, paddingTop: 24 }}>
            {/* Avatar */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 0 }}
              style={{ alignItems: 'center', marginBottom: 28 }}>
              <View
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 46,
                  borderWidth: 3,
                  borderColor: Palette.brand,
                  padding: 3,
                }}>
                <Avatar name={displayName} url={avatarUrl} size={80} />
                <PressableScale
                  onPress={handlePickAvatar}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: Palette.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: Palette.canvas,
                  }}>
                  <Camera size={14} color="#fff" />
                </PressableScale>
              </View>
              {uploadError ? (
                <Text
                  style={{
                    fontFamily: Font.body,
                    fontSize: 12,
                    color: Palette.danger,
                    marginTop: 8,
                    textAlign: 'center',
                    paddingHorizontal: 24,
                  }}>
                  {uploadError}
                </Text>
              ) : null}
            </MotiView>

            {/* Fields card */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 60 }}
              style={{
                marginHorizontal: 20,
                backgroundColor: Palette.surface,
                borderRadius: 20,
                padding: 16,
                gap: 16,
              }}>
              {/* Full name */}
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 120 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <User size={14} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>
                    full name
                  </Text>
                </View>
                <TextInput
                  value={fields.full_name}
                  onChangeText={(v) => set('full_name', v)}
                  onBlur={() => onBlur('full_name')}
                  placeholder="Your full name"
                  placeholderTextColor={Palette.textMuted}
                  accessibilityLabel="Full name"
                  style={{
                    fontFamily: Font.body,
                    fontSize: 15,
                    color: Palette.ink,
                    backgroundColor: Palette.canvas,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: errors.full_name ? Palette.danger : Palette.border,
                    minHeight: 44,
                  }}
                />
                {errors.full_name ? (
                  <Text
                    style={{
                      fontFamily: Font.body,
                      fontSize: 12,
                      color: Palette.danger,
                      marginTop: 4,
                    }}>
                    {errors.full_name}
                  </Text>
                ) : null}
              </MotiView>

              {/* Username */}
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 180 }}>
                <Text
                  style={{
                    fontFamily: Font.semibold,
                    fontSize: 13,
                    color: Palette.inkSoft,
                    marginBottom: 6,
                  }}>
                  username
                </Text>
                <TextInput
                  value={fields.username}
                  onChangeText={(v) => set('username', v.toLowerCase())}
                  onBlur={() => onBlur('username')}
                  placeholder="your_handle"
                  placeholderTextColor={Palette.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Username"
                  style={{
                    fontFamily: Font.body,
                    fontSize: 15,
                    color: Palette.ink,
                    backgroundColor: Palette.canvas,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: errors.username ? Palette.danger : Palette.border,
                    minHeight: 44,
                  }}
                />
                {fields.username.length >= 3 && !errors.username ? (
                  <Text
                    style={{
                      fontFamily: Font.body,
                      fontSize: 12,
                      color: Palette.textMuted,
                      marginTop: 4,
                    }}>
                    preppa.live/@{fields.username.toLowerCase()}
                  </Text>
                ) : null}
                {errors.username ? (
                  <Text
                    style={{
                      fontFamily: Font.body,
                      fontSize: 12,
                      color: Palette.danger,
                      marginTop: 4,
                    }}>
                    {errors.username}
                  </Text>
                ) : null}
              </MotiView>

              {/* Bio */}
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 240 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>
                    bio
                  </Text>
                  <Text
                    style={{
                      fontFamily: Font.body,
                      fontSize: 12,
                      color: fields.bio.length > 160 ? Palette.danger : Palette.textMuted,
                    }}>
                    {fields.bio.length}/160
                  </Text>
                </View>
                <TextInput
                  value={fields.bio}
                  onChangeText={(v) => set('bio', v)}
                  onBlur={() => onBlur('bio')}
                  placeholder="Tell people a little about yourself…"
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  numberOfLines={3}
                  accessibilityLabel="Bio"
                  style={{
                    fontFamily: Font.body,
                    fontSize: 15,
                    color: Palette.ink,
                    backgroundColor: Palette.canvas,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: errors.bio ? Palette.danger : Palette.border,
                    minHeight: 88,
                    textAlignVertical: 'top',
                  }}
                />
                {errors.bio ? (
                  <Text
                    style={{
                      fontFamily: Font.body,
                      fontSize: 12,
                      color: Palette.danger,
                      marginTop: 4,
                    }}>
                    {errors.bio}
                  </Text>
                ) : null}
              </MotiView>

              {/* Location */}
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 300 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <MapPin size={14} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>
                    location
                  </Text>
                </View>
                <TextInput
                  value={fields.location}
                  onChangeText={(v) => set('location', v.slice(0, 80))}
                  placeholder="City, State"
                  placeholderTextColor={Palette.textMuted}
                  accessibilityLabel="Location"
                  style={{
                    fontFamily: Font.body,
                    fontSize: 15,
                    color: Palette.ink,
                    backgroundColor: Palette.canvas,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: Palette.border,
                    minHeight: 44,
                  }}
                />
              </MotiView>

              {/* Website */}
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 360 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Globe size={14} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>
                    website{' '}
                    <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>(optional)</Text>
                  </Text>
                </View>
                <TextInput
                  value={fields.website}
                  onChangeText={(v) => set('website', v)}
                  onBlur={() => onBlur('website')}
                  placeholder="https://yoursite.com"
                  placeholderTextColor={Palette.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  accessibilityLabel="Website URL"
                  style={{
                    fontFamily: Font.body,
                    fontSize: 15,
                    color: Palette.ink,
                    backgroundColor: Palette.canvas,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: errors.website ? Palette.danger : Palette.border,
                    minHeight: 44,
                  }}
                />
                {errors.website ? (
                  <Text
                    style={{
                      fontFamily: Font.body,
                      fontSize: 12,
                      color: Palette.danger,
                      marginTop: 4,
                    }}>
                    {errors.website}
                  </Text>
                ) : null}
              </MotiView>
            </MotiView>

            {/* Save button */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 420 }}
              style={{ marginHorizontal: 20, marginTop: 24 }}>
              <PressableScale
                onPress={handleSave}
                disabled={!hasChanges || hasErrors || saving}
                accessibilityRole="button"
                accessibilityLabel="Save profile changes"
                accessibilityState={{ disabled: !hasChanges || hasErrors || saving }}
                style={{
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: Palette.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !hasChanges || hasErrors || saving ? 0.5 : 1,
                }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                  {saving ? 'saving…' : 'save changes'}
                </Text>
              </PressableScale>
            </MotiView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
