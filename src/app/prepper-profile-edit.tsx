import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, ChevronLeft, Home, Truck } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { supabase } from '@/lib/supabase';
import {
  useMyPrepperProfile,
  useUpdatePrepperAvatar,
  useUpdatePrepperCover,
  useUpdatePrepperProfile,
} from '@/lib/queries/prepper-profile';
import { useAuth } from '@/providers/auth-provider';

// ── Constants ──────────────────────────────────────────────────────────────────

const BG     = Palette.canvas;
const CARD   = Palette.surface;
const INK    = Palette.ink;
const MUTED  = Palette.textSecondary;
const BORDER = Palette.border;
const ORANGE = Palette.brand;

const CUISINE_OPTIONS = ['Nigerian', 'West African', 'Caribbean', 'Soul Food', 'African', 'Other'];

const SPECIALTY_OPTIONS = [
  'Jollof', 'Pepper Soup', 'Swallow', 'Grills', 'Desserts',
  'Snacks', 'Soups', 'Rice dishes', 'Pastries', 'Drinks',
];

const MAX_SPECIALTIES = 3;

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: MUTED, letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' }}>
      {text}
    </Text>
  );
}

function StyledInput({
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  keyboardType,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={MUTED}
      multiline={multiline}
      maxLength={maxLength}
      keyboardType={keyboardType ?? 'default'}
      style={{
        fontFamily: Font.body,
        fontSize: 15,
        color: INK,
        backgroundColor: CARD,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: BORDER,
        paddingHorizontal: 14,
        paddingVertical: multiline ? 12 : 0,
        height: multiline ? 100 : 48,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

function ChipRow({
  options,
  selected,
  onToggle,
  single,
  maxSelect,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  single?: boolean;
  maxSelect?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = single
          ? selected[0] === opt
          : selected.includes(opt);
        const disabled = !active && !single && maxSelect !== undefined && selected.length >= maxSelect;
        return (
          <PressableScale
            key={opt}
            onPress={() => { if (!disabled) onToggle(opt); }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active, disabled }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: Radius.pill,
              backgroundColor: active ? ORANGE : CARD,
              borderWidth: 1,
              borderColor: active ? ORANGE : BORDER,
              opacity: disabled ? 0.4 : 1,
            }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: active ? '#fff' : INK }}>
              {opt}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

// ── Image Upload ───────────────────────────────────────────────────────────────

async function pickAndUpload(
  userId: string,
  bucket: string,
  path: string,
  aspect: [number, number],
  useCamera = false,
): Promise<string | null> {
  let asset: ImagePicker.ImagePickerAsset | undefined;

  if (useCamera) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow camera access to take photos.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect, quality: 0.8 });
    if (result.canceled) return null;
    asset = result.assets[0];
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to upload images.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect, quality: 0.8 });
    if (result.canceled) return null;
    asset = result.assets[0];
  }

  if (!asset?.uri) return null;
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const fullPath = `${userId}/${path}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function PrepperProfileEditScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyPrepperProfile(user?.id);
  const updateProfile = useUpdatePrepperProfile();
  const updateAvatar = useUpdatePrepperAvatar();
  const updateCover = useUpdatePrepperCover();

  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [cuisineType, setCuisineType] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [localCover, setLocalCover] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  // Fulfillment
  const [delivers, setDelivers] = useState(false);
  const [pickup, setPickup] = useState(true);
  const [deliveryFeeText, setDeliveryFeeText] = useState('');
  const [deliveryRadiusText, setDeliveryRadiusText] = useState('');

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setTagline(profile.tagline ?? '');
    setBio(profile.bio ?? '');
    setCity(profile.city ?? '');
    setCuisineType(profile.cuisine_type ? [profile.cuisine_type] : []);
    setSpecialties(profile.specialties ?? []);
    setLocalAvatar(profile.avatar_url ?? null);
    setLocalCover(profile.cover_url ?? null);
    setDelivers(!!profile.delivers);
    setPickup(profile.pickup !== false);
    setDeliveryFeeText(profile.delivery_fee > 0 ? String(profile.delivery_fee) : '');
    setDeliveryRadiusText(profile.delivery_radius_km != null ? String(profile.delivery_radius_km) : '');
  }, [profile]);

  function goBack() { feedback.tap(); if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }

  async function handlePickAvatar() {
    if (!user?.id) return;
    const source = await new Promise<'camera' | 'library' | null>((resolve) => {
      Alert.alert('Change photo', 'Choose a source', [
        { text: 'Camera', onPress: () => resolve('camera') },
        { text: 'Photo Library', onPress: () => resolve('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
    if (!source) return;
    setUploadingAvatar(true);
    try {
      const url = await pickAndUpload(user.id, 'profile-images', 'avatar', [1, 1], source === 'camera');
      if (!url) return;
      setLocalAvatar(url);
      await updateAvatar.mutateAsync(url);
      feedback.success();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      Alert.alert('Upload failed', msg);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handlePickCover() {
    if (!user?.id) return;
    const source = await new Promise<'camera' | 'library' | null>((resolve) => {
      Alert.alert('Change cover', 'Choose a source', [
        { text: 'Camera', onPress: () => resolve('camera') },
        { text: 'Photo Library', onPress: () => resolve('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
    if (!source) return;
    setUploadingCover(true);
    try {
      const url = await pickAndUpload(user.id, 'profile-images', 'cover', [16, 9], source === 'camera');
      if (!url) return;
      setLocalCover(url);
      await updateCover.mutateAsync(url);
      feedback.success();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      Alert.alert('Upload failed', msg);
    } finally {
      setUploadingCover(false);
    }
  }

  function toggleCuisine(val: string) { setCuisineType([val]); }

  function toggleSpecialty(val: string) {
    setSpecialties((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val],
    );
  }

  async function handleSave() {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Kitchen name cannot be empty.');
      return;
    }
    const feeNum = deliveryFeeText.trim() ? parseFloat(deliveryFeeText) : 0;
    const radiusNum = deliveryRadiusText.trim() ? parseFloat(deliveryRadiusText) : null;
    if (delivers && (isNaN(feeNum) || feeNum < 0)) {
      Alert.alert('Invalid fee', 'Enter a valid delivery fee (e.g. 2.50).');
      return;
    }
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        tagline: tagline.trim() || null,
        city: city.trim() || null,
        cuisine_type: cuisineType[0] ?? null,
        specialties: specialties.length ? specialties : null,
        delivers,
        pickup,
        delivery_fee: delivers ? feeNum : 0,
        delivery_radius_km: delivers ? radiusNum : null,
      });
      feedback.success();
      goBack();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      Alert.alert('Could not save', msg);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5, flex: 1 }}>
            edit kitchen profile
          </Text>
          <PressableScale onPress={handleSave} disabled={saving}
            accessibilityRole="button" accessibilityLabel="Save changes"
            style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: ORANGE, opacity: saving ? 0.6 : 1 }}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Save</Text>}
          </PressableScale>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          {/* Cover + Avatar hero */}
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 280 }}>
            <View style={{ height: 200, backgroundColor: CARD, position: 'relative' }}>
              {localCover
                ? <Image source={{ uri: localCover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={28} color={MUTED} />
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 6 }}>tap to add cover photo</Text>
                  </View>}
              <Pressable onPress={handlePickCover}
                style={{ position: 'absolute', inset: 0 }}
                accessibilityRole="button" accessibilityLabel="Change cover photo">
                {uploadingCover && (
                  <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
                <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>Change</Text>
                </View>
              </Pressable>

              {/* Avatar overlapping the cover */}
              <View style={{ position: 'absolute', bottom: -36, left: 0, right: 0, alignItems: 'center' }}>
                <Pressable onPress={handlePickAvatar} accessibilityRole="button" accessibilityLabel="Change avatar">
                  <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: BG, overflow: 'hidden', backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
                    {localAvatar
                      ? <Image source={{ uri: localAvatar }} style={{ width: 72, height: 72 }} resizeMode="cover" />
                      : <Camera size={22} color={MUTED} />}
                    {uploadingAvatar && (
                      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={11} color="#fff" />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Spacer for avatar overflow */}
            <View style={{ height: 44 }} />
          </MotiView>

          {/* Form fields */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 60 }}>
            <View style={{ paddingHorizontal: 20, gap: 20 }}>

              {/* Kitchen name */}
              <View>
                <SectionLabel text="Kitchen name *" />
                <StyledInput value={displayName} onChangeText={setDisplayName} placeholder="Mama's Kitchen" maxLength={60} />
              </View>

              {/* Tagline */}
              <View>
                <SectionLabel text="Tagline (shown in search results)" />
                <StyledInput value={tagline} onChangeText={setTagline} placeholder="Authentic Nigerian home cooking" maxLength={80} />
              </View>

              {/* Bio */}
              <View>
                <SectionLabel text="About your kitchen" />
                <StyledInput value={bio} onChangeText={setBio} placeholder="We specialize in..." multiline maxLength={400} />
              </View>

              {/* City */}
              <View>
                <SectionLabel text="City" />
                <StyledInput value={city} onChangeText={setCity} placeholder="Lagos" maxLength={60} />
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: BORDER }} />

              {/* Cuisine type */}
              <View>
                <SectionLabel text="Cuisine type (pick one)" />
                <ChipRow options={CUISINE_OPTIONS} selected={cuisineType} onToggle={toggleCuisine} single />
              </View>

              {/* Specialties */}
              <View>
                <SectionLabel text={`Specialties (pick up to ${MAX_SPECIALTIES})`} />
                <ChipRow
                  options={SPECIALTY_OPTIONS}
                  selected={specialties}
                  onToggle={toggleSpecialty}
                  maxSelect={MAX_SPECIALTIES}
                />
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: BORDER }} />

              {/* Fulfillment */}
              <View>
                <SectionLabel text="How do you fulfill orders?" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <PressableScale
                    onPress={() => { feedback.tap(); setPickup((v) => !v); }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: pickup }}
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: Radius.md,
                      backgroundColor: pickup ? ORANGE : CARD,
                      borderWidth: 1.5, borderColor: pickup ? ORANGE : BORDER,
                      alignItems: 'center', gap: 4,
                    }}>
                    <Home size={20} color={pickup ? '#fff' : INK} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: pickup ? '#fff' : INK }}>Pickup</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={() => { feedback.tap(); setDelivers((v) => !v); }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: delivers }}
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: Radius.md,
                      backgroundColor: delivers ? ORANGE : CARD,
                      borderWidth: 1.5, borderColor: delivers ? ORANGE : BORDER,
                      alignItems: 'center', gap: 4,
                    }}>
                    <Truck size={20} color={delivers ? '#fff' : INK} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: delivers ? '#fff' : INK }}>Delivery</Text>
                  </PressableScale>
                </View>
              </View>

              {delivers ? (
                <MotiView
                  from={{ opacity: 0, translateY: -6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={{ gap: 12 }}>
                  <View>
                    <SectionLabel text="Delivery fee ($)" />
                    <StyledInput
                      value={deliveryFeeText}
                      onChangeText={setDeliveryFeeText}
                      placeholder="e.g. 2.50"
                      keyboardType="decimal-pad"
                      maxLength={6}
                    />
                  </View>
                  <View>
                    <SectionLabel text="Delivery radius (km)" />
                    <StyledInput
                      value={deliveryRadiusText}
                      onChangeText={setDeliveryRadiusText}
                      placeholder="e.g. 5"
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                  </View>
                </MotiView>
              ) : null}

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: BORDER }} />

              {/* Bottom save CTA */}
              <PressableScale onPress={handleSave} disabled={saving}
                accessibilityRole="button" accessibilityLabel="Save changes"
                style={{
                  backgroundColor: ORANGE,
                  borderRadius: Radius.pill,
                  paddingVertical: 16,
                  alignItems: 'center',
                  opacity: saving ? 0.6 : 1,
                }}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Save changes</Text>}
              </PressableScale>

            </View>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
