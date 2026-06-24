import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Camera, X } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, Type } from '@/constants/theme';
import type { ListingForm, LocalPhoto } from '@/app/create-listing';

const MAX_PHOTOS = 5;

type Props = {
  form: ListingForm;
  update: <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => void;
};

export function PhotosStep({ form, update }: Props) {
  const [permissionError, setPermissionError] = useState<string | null>(null);

  async function pickPhotos() {
    setPermissionError(null);
    const remaining = MAX_PHOTOS - form.photos.length;
    if (remaining <= 0) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPermissionError('Photo library access is required. Enable it in Settings.');
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

    update('photos', [...form.photos, ...newPhotos].slice(0, MAX_PHOTOS));
  }

  function removePhoto(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    update('photos', form.photos.filter(p => p.id !== id));
  }

  const canAdd = form.photos.length < MAX_PHOTOS;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Photos</Text>
      <Text style={styles.sub}>
        Add up to {MAX_PHOTOS} photos. The first photo is your cover image.
      </Text>

      {permissionError && (
        <View style={styles.permError}>
          <Text style={styles.permErrorText}>{permissionError}</Text>
        </View>
      )}

      <View style={styles.grid}>
        {form.photos.map((photo, index) => (
          <View key={photo.id} style={styles.photoCard}>
            <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
            {index === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverText}>Cover</Text>
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
            accessibilityLabel="Add photos"
            accessibilityRole="button"
          >
            <Camera size={28} color={Palette.textMuted} strokeWidth={1.5} />
            <Text style={styles.addText}>Add photos</Text>
            <Text style={styles.addCount}>
              {form.photos.length}/{MAX_PHOTOS}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {form.photos.length === 0 && (
        <View style={styles.emptyNote}>
          <Text style={styles.emptyText}>
            Photos help customers choose your meals. Listings with photos get significantly more orders.
          </Text>
        </View>
      )}

      {form.photos.length > 0 && (
        <Text style={styles.tipText}>
          Tip: The first photo is shown as the cover in search results.
        </Text>
      )}
    </ScrollView>
  );
}

const CARD_SIZE = 156;

const styles = StyleSheet.create({
  container: { paddingHorizontal: Space.lg, paddingBottom: 100 },
  heading: { fontFamily: Font.heading, fontSize: Type.displayLg, color: Palette.ink, marginBottom: Space.sm },
  sub: { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, marginBottom: Space.xl },
  permError: {
    backgroundColor: Palette.dangerTint,
    borderRadius: Radius.sm,
    padding: Space.lg,
    marginBottom: Space.lg,
  },
  permErrorText: { fontFamily: Font.medium, fontSize: Type.label, color: Palette.danger },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
  },
  photoCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    bottom: Space.sm,
    left: Space.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverText: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.surface },
  removeBtn: {
    position: 'absolute',
    top: Space.sm,
    right: Space.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Palette.border,
    borderStyle: 'dashed',
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  addText: { fontFamily: Font.medium, fontSize: Type.label, color: Palette.textMuted },
  addCount: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted },
  emptyNote: {
    marginTop: Space.xl,
    backgroundColor: Palette.chip,
    borderRadius: Radius.md,
    padding: Space.lg,
  },
  emptyText: { fontFamily: Font.body, fontSize: Type.label, color: Palette.inkSoft, lineHeight: 22, textAlign: 'center' },
  tipText: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textMuted, marginTop: Space.lg, lineHeight: 20 },
});
