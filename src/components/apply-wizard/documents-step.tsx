import { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Camera, FileText, X } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, TouchTarget, Type } from '@/constants/theme';
import type { ApplicationForm, LocalPhoto } from '@/app/apply/index';

const MAX_PHOTOS = 3;

type Props = {
  form: ApplicationForm;
  update: <K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) => void;
};

export function DocumentsStep({ form, update }: Props) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [certName, setCertName] = useState<string | null>(null);

  async function pickPhotos() {
    setPhotoError(null);
    const remaining = MAX_PHOTOS - form.kitchenPhotos.length;
    if (remaining <= 0) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPhotoError('Photo library access is required. Enable it in Settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });

    if (result.canceled || !result.assets.length) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPhotos: LocalPhoto[] = result.assets.map(a => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri: a.uri,
    }));
    update('kitchenPhotos', [...form.kitchenPhotos, ...newPhotos].slice(0, MAX_PHOTOS));
  }

  function removePhoto(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    update('kitchenPhotos', form.kitchenPhotos.filter(p => p.id !== id));
  }

  async function pickCert() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    update('foodSafetyCertUri', asset.uri);
    setCertName(asset.name ?? 'Certificate uploaded');
  }

  function handleDateInput(raw: string) {
    // Auto-insert slashes for DD/MM/YYYY
    const digits = raw.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
    update('certExpirationDate', formatted.slice(0, 10));
  }

  const canAdd = form.kitchenPhotos.length < MAX_PHOTOS;
  const hasEnoughPhotos = form.kitchenPhotos.length >= 2;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Documents</Text>
      <Text style={styles.sub}>Evidence for our Trust & Safety team. Not shared publicly.</Text>

      {/* ── Kitchen Photos ─────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Kitchen photos</Text>
      <Text style={styles.hint}>
        At least 2 required. Show your preparation area, equipment, and hygiene setup.
      </Text>

      {photoError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{photoError}</Text>
        </View>
      )}

      <View style={styles.photoGrid}>
        {form.kitchenPhotos.map((photo, i) => (
          <View key={photo.id} style={styles.photoCard}>
            <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
            {i === 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Main</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removePhoto(photo.id)}
              accessibilityLabel="Remove photo"
              accessibilityRole="button"
              hitSlop={10}
            >
              <X size={14} color={Palette.surface} strokeWidth={3} />
            </TouchableOpacity>
          </View>
        ))}

        {canAdd && (
          <TouchableOpacity
            style={styles.addCard}
            onPress={pickPhotos}
            accessibilityLabel={`Add kitchen photos (${form.kitchenPhotos.length} of ${MAX_PHOTOS})`}
            accessibilityRole="button"
          >
            <Camera size={26} color={Palette.textMuted} strokeWidth={1.5} />
            <Text style={styles.addText}>Add photos</Text>
            <Text style={styles.addCount}>{form.kitchenPhotos.length}/{MAX_PHOTOS}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!hasEnoughPhotos && form.kitchenPhotos.length > 0 && (
        <Text style={styles.photoHint}>Add at least one more photo to continue.</Text>
      )}

      <View style={styles.divider} />

      {/* ── Food Safety Certificate ────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Food safety certificate</Text>
      <Text style={styles.hint}>
        Your Level 2 (or above) Award in Food Safety. PDF or photo. Strongly recommended — applications without a cert typically take longer to approve.
      </Text>

      <TouchableOpacity
        style={[styles.certPicker, form.foodSafetyCertUri && styles.certPickerFilled]}
        onPress={pickCert}
        accessibilityRole="button"
        accessibilityLabel="Upload food safety certificate"
      >
        <FileText
          size={20}
          color={form.foodSafetyCertUri ? Palette.brand : Palette.textMuted}
          strokeWidth={1.5}
        />
        <Text style={[styles.certPickerText, form.foodSafetyCertUri && styles.certPickerTextFilled]}>
          {certName ?? 'Choose file (PDF or image)'}
        </Text>
      </TouchableOpacity>

      {form.foodSafetyCertUri && (
        <>
          <Text style={styles.certLabel}>Certificate expiry date</Text>
          <TextInput
            style={styles.input}
            value={form.certExpirationDate}
            onChangeText={handleDateInput}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={Palette.textMuted}
            keyboardType="numeric"
            maxLength={10}
          />
          <Text style={styles.hint} />
        </>
      )}
    </ScrollView>
  );
}

const CARD_SIZE = 150;

const styles = StyleSheet.create({
  container:          { paddingHorizontal: Space.lg, paddingBottom: 120 },
  heading:            { fontFamily: Font.heading, fontSize: Type.displayLg, color: Palette.ink, marginBottom: Space.sm },
  sub:                { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, marginBottom: Space.xl, lineHeight: 22 },
  sectionTitle:       { fontFamily: Font.semibold, fontSize: Type.title, color: Palette.ink, marginBottom: Space.sm },
  hint:               { fontFamily: Font.body, fontSize: Type.label, color: Palette.textMuted, lineHeight: 20, marginBottom: Space.md },
  errorBanner: {
    backgroundColor: Palette.dangerTint,
    borderRadius: Radius.sm,
    padding: Space.md,
    marginBottom: Space.md,
  },
  errorText:          { fontFamily: Font.medium, fontSize: Type.label, color: Palette.danger },
  photoGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md, marginBottom: Space.md },
  photoCard:          { width: CARD_SIZE, height: CARD_SIZE, borderRadius: Radius.lg, overflow: 'hidden', position: 'relative' },
  photo:              { width: '100%', height: '100%' },
  badge: {
    position: 'absolute', bottom: Space.sm, left: Space.sm,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText:          { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.surface },
  removeBtn: {
    position: 'absolute', top: Space.sm, right: Space.sm,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  addCard: {
    width: CARD_SIZE, height: CARD_SIZE,
    borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: Palette.border, borderStyle: 'dashed',
    backgroundColor: Palette.surface,
    alignItems: 'center', justifyContent: 'center', gap: Space.sm,
  },
  addText:            { fontFamily: Font.medium, fontSize: Type.label, color: Palette.textMuted },
  addCount:           { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted },
  photoHint:          { fontFamily: Font.body, fontSize: Type.micro, color: Palette.brand, marginBottom: Space.md },
  divider:            { height: 1, backgroundColor: Palette.border, marginVertical: Space.xl },
  certPicker: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    minHeight: TouchTarget, paddingHorizontal: Space.lg,
    borderWidth: 1.5, borderColor: Palette.border, borderStyle: 'dashed',
    borderRadius: Radius.sm, backgroundColor: Palette.surface,
    marginBottom: Space.lg,
  },
  certPickerFilled:   { borderStyle: 'solid', borderColor: Palette.brand },
  certPickerText:     { flex: 1, fontFamily: Font.body, fontSize: Type.body, color: Palette.textMuted },
  certPickerTextFilled: { color: Palette.ink },
  certLabel:          { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink, marginBottom: Space.sm },
  input: {
    height: TouchTarget,
    borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm,
    paddingHorizontal: Space.lg,
    fontFamily: Font.body, fontSize: Type.body, color: Palette.ink,
    backgroundColor: Palette.surface, marginBottom: Space.sm,
  },
});
