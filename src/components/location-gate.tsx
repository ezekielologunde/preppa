import * as Location from 'expo-location';
import { MapPin, Navigation } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useDeviceLocation } from '@/lib/use-location';

// ─── LocationGate ─────────────────────────────────────────────────────────────
// Non-dismissible half-sheet shown when GPS is denied and no saved address
// exists. User must either re-enable GPS in Settings or supply a ZIP code.
// Red-team patch #3 — GPS fallback loop fix.

export function LocationGate({ visible, onGranted }: { visible: boolean; onGranted: () => void }) {
  const insets = useSafeAreaInsets();
  const { requestDeviceLocation, setManualLocation } = useDeviceLocation();

  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Re-check GPS permission when user returns from Settings
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const result = await requestDeviceLocation();
        if (result === 'granted') onGranted();
      }
    });
    return () => sub.remove();
  }, [visible, requestDeviceLocation, onGranted]);

  async function handleZipSubmit() {
    const trimmed = zip.trim();
    if (trimmed.length < 5) { setError('Enter a valid 5-digit ZIP code'); return; }
    setError('');
    setLoading(true);
    try {
      const results = await Location.geocodeAsync(trimmed);
      if (!results.length) {
        setError("Couldn't find that ZIP — try a nearby city name");
        setLoading(false);
        return;
      }
      const { latitude, longitude } = results[0];
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const city = place?.city ?? place?.district ?? place?.subregion ?? trimmed;
      const state = place?.region ?? '';
      setManualLocation(city, state, { lat: latitude, lng: longitude });
      feedback.tap();
      onGranted();
    } catch {
      setError('Location lookup failed. Please try again.');
    }
    setLoading(false);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={() => { /* non-dismissible */ }}>

      {/* Dimmed backdrop — non-tappable */}
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: Palette.canvas,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: insets.bottom + 24,
          ...Shadow.card,
        }}>
          {/* No drag handle — non-dismissible */}

          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
            <MapPin size={22} color={Palette.brand} />
          </View>

          <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.4, textAlign: 'center' }}>
            Where are you?
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: Palette.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
            We need your location to show Preppers near you.
          </Text>

          {/* Enable location */}
          <PressableScale
            onPress={() => { feedback.tap(); void Linking.openSettings(); }}
            accessibilityRole="button"
            accessibilityLabel="Open settings to enable location access"
            style={{ marginTop: 24, height: 52, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <Navigation size={17} color="#fff" />
            <Text style={{ fontFamily: Font.semibold, fontSize: 15.5, color: '#fff' }}>Enable Location Access</Text>
          </PressableScale>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: Palette.border }} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>or enter your ZIP code</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: Palette.border }} />
          </View>

          {/* ZIP input */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              style={{
                flex: 1, height: 52, borderRadius: 14,
                backgroundColor: Palette.surface,
                paddingHorizontal: 16,
                fontFamily: Font.body, fontSize: 16, color: Palette.ink,
                borderWidth: 1, borderColor: error ? Palette.danger : Palette.border,
              }}
              value={zip}
              onChangeText={(v) => { setZip(v.replace(/\D/g, '').slice(0, 5)); setError(''); }}
              placeholder="e.g. 10001"
              placeholderTextColor={Palette.textSecondary}
              keyboardType="number-pad"
              maxLength={5}
              returnKeyType="done"
              onSubmitEditing={handleZipSubmit}
              accessibilityLabel="Enter your ZIP code"
            />
            <PressableScale
              onPress={handleZipSubmit}
              accessibilityRole="button"
              accessibilityLabel="Continue with this ZIP code"
              style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: zip.length === 5 ? Palette.brand : Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              {loading
                ? <ActivityIndicator size="small" color={zip.length === 5 ? '#fff' : Palette.textSecondary} />
                : <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: zip.length === 5 ? '#fff' : Palette.textSecondary }}>Go</Text>
              }
            </PressableScale>
          </View>

          {error ? (
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger, marginTop: 8, textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
