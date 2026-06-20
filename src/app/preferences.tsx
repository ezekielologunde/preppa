import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useUpdateUserPrefs, useUserPrefs } from '@/lib/queries/user-prefs';
import { useAuth } from '@/providers/auth-provider';

// ── Constants — identical to step-2.tsx and step-3.tsx ──────────────────────
const DIETARY_OPTIONS = [
  'Vegan', 'Vegetarian', 'Halal', 'Gluten-free',
  'Dairy-free', 'Kosher', 'Nut-free', 'No pork', 'No shellfish', 'Pescatarian',
];

const CUISINE_OPTIONS = [
  'Nigerian', 'Caribbean', 'Soul Food', 'African',
  'Mediterranean', 'Asian', 'Mexican', 'American',
  'Middle Eastern', 'Jamaican', 'Ethiopian', 'Indian',
];

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <MotiView
      animate={{
        backgroundColor: active ? Palette.brand + '20' : Palette.surface,
        borderColor: active ? Palette.brand : Palette.border,
      }}
      transition={{ type: 'spring', damping: 14, stiffness: 260 }}
      style={{ borderRadius: 20, borderWidth: 1.5, overflow: 'hidden' }}>
      <PressableScale
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: active }}
        accessibilityLabel={label}
        style={{ paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: active ? Font.semibold : Font.medium,
            fontSize: 13,
            color: active ? Palette.brand : Palette.inkSoft,
          }}>
          {label}
        </Text>
      </PressableScale>
    </MotiView>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontFamily: Font.display,
        fontSize: 15,
        color: Palette.ink,
        letterSpacing: -0.2,
        marginBottom: 12,
      }}>
      {title}
    </Text>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: savedPrefs, isLoading: loadingPrefs } = useUserPrefs(user?.id);
  const update = useUpdateUserPrefs(user?.id);

  // Dietary is stored display-cased in metadata; the read hook lowercases them
  // for feed filtering but we need the originals for the chip UI. Re-derive
  // display-cased selections by matching lowercased saved values against the
  // option list (same approach avoids needing a second round-trip).
  const [dietary, setDietary] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!loadingPrefs && !seeded) {
      // savedPrefs.dietary is lowercased by useUserPrefs; map back to display labels
      const savedDietaryLower = savedPrefs.dietary; // e.g. ['halal', 'vegan']
      const matchedDietary = DIETARY_OPTIONS.filter((o) =>
        savedDietaryLower.includes(o.toLowerCase()),
      );
      setDietary(matchedDietary);
      setCuisines(savedPrefs.cuisines);
      setSeeded(true);
    }
  }, [loadingPrefs, savedPrefs, seeded]);

  const isDirty =
    JSON.stringify([...dietary].sort()) !== JSON.stringify([...savedPrefs.dietary.map((d) => {
      const match = DIETARY_OPTIONS.find((o) => o.toLowerCase() === d);
      return match ?? d;
    })].sort()) ||
    JSON.stringify([...cuisines].sort()) !== JSON.stringify([...savedPrefs.cuisines].sort());

  function toggleDietary(opt: string) {
    feedback.tap();
    setDietary((s) => s.includes(opt) ? s.filter((o) => o !== opt) : [...s, opt]);
  }

  function toggleCuisine(opt: string) {
    feedback.tap();
    setCuisines((s) => s.includes(opt) ? s.filter((o) => o !== opt) : [...s, opt]);
  }

  async function handleSave() {
    feedback.tap();
    await update.mutateAsync({ dietary, cuisines });
    feedback.success();
    router.back();
  }

  const saving = update.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>

        {/* ── Nav bar ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: Palette.border,
            backgroundColor: Palette.canvas,
          }}>
          <Pressable
            onPress={() => { feedback.tap(); router.back(); }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.inkSoft} strokeWidth={2} />
          </Pressable>

          <Text
            style={{
              flex: 1,
              fontFamily: Font.semibold,
              fontSize: 15,
              color: Palette.ink,
              textAlign: 'center',
            }}>
            Food Preferences{isDirty ? ' •' : ''}
          </Text>

          {/* Save text button */}
          <Pressable
            onPress={() => { void handleSave(); }}
            disabled={saving || !isDirty}
            accessibilityRole="button"
            accessibilityLabel="Save preferences"
            hitSlop={8}
            style={{ width: 48, height: 36, alignItems: 'flex-end', justifyContent: 'center' }}>
            {saving ? (
              <ActivityIndicator size="small" color={Palette.brand} />
            ) : (
              <Text
                style={{
                  fontFamily: Font.semibold,
                  fontSize: 15,
                  color: isDirty ? Palette.brand : Palette.textSecondary,
                }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        {/* ── Content ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, gap: 24 }}>

          {/* Dietary section */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0 }}>
            <SectionHeader title="Dietary needs" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DIETARY_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  active={dietary.includes(opt)}
                  onToggle={() => toggleDietary(opt)}
                />
              ))}
            </View>
          </MotiView>

          {/* Cuisine section */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 60 }}>
            <SectionHeader title="Cuisine interests" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CUISINE_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  active={cuisines.includes(opt)}
                  onToggle={() => toggleCuisine(opt)}
                />
              ))}
            </View>
          </MotiView>

          {/* Info box */}
          <MotiView
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 120 }}>
            <View
              style={{
                backgroundColor: Palette.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}>
              <Text
                style={{
                  fontFamily: Font.body,
                  fontSize: 13,
                  color: Palette.textSecondary,
                  lineHeight: 19,
                  textAlign: 'center',
                }}>
                Your preferences help us show you meals you'll love in your "For You" feed.
              </Text>
            </View>
          </MotiView>

          {/* Bottom save pill */}
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 160 }}>
            <PressableScale
              onPress={() => { void handleSave(); }}
              disabled={saving || !isDirty}
              accessibilityRole="button"
              accessibilityLabel="Save preferences"
              style={{
                height: 54,
                borderRadius: Radius.pill,
                backgroundColor: isDirty ? Palette.brand : Palette.divider,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : null}
              <Text
                style={{
                  fontFamily: Font.heading,
                  fontSize: 16,
                  color: '#fff',
                }}>
                Save preferences
              </Text>
            </PressableScale>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
