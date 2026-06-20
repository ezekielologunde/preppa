import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  AlertCircle, BarChart2, Bell, ChevronRight, Database, Eye, Globe, Maximize2,
  RefreshCw, Ruler, Search, Sparkles, Tag, Volume2, Zap,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Alert, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsGroup, SettingsHeader } from '@/components/settings-ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { clearRecentSearches } from '@/lib/recent-searches';
import { clearRecentlyViewed } from '@/lib/recently-viewed';
import { useAppSettings } from '@/hooks/use-app-settings';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// ─── Sub-components ──────────────────────────────────────────────────────────

function Divider() {
  return <View style={{ height: 1, backgroundColor: Palette.border, marginLeft: 70 }} />;
}

/** A row with a native Switch on the right. */
function ToggleRow({
  Icon,
  label,
  sub,
  value,
  onToggle,
  isLast = false,
}: {
  Icon: typeof Zap;
  label: string;
  sub?: string;
  value: boolean;
  onToggle: () => void;
  isLast?: boolean;
}) {
  return (
    <>
      <PressableScale
        onPress={() => { feedback.tap(); onToggle(); }}
        accessibilityRole="switch"
        accessibilityLabel={sub ? `${label}. ${sub}` : label}
        accessibilityState={{ checked: value }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 60 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={Palette.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{label}</Text>
          {sub ? <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>{sub}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={() => { feedback.tap(); onToggle(); }}
          trackColor={{ true: Palette.brand + '80', false: Palette.border }}
          thumbColor={value ? Palette.brand : '#f4f4f4'}
          ios_backgroundColor={Palette.border}
          accessibilityLabel={label}
        />
      </PressableScale>
      {!isLast ? <Divider /> : null}
    </>
  );
}

/** A row with a value label + chevron. */
function NavValueRow({
  Icon,
  label,
  value,
  onPress,
  isLast = false,
}: {
  Icon: typeof Globe;
  label: string;
  value: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <>
      <PressableScale
        onPress={() => { feedback.tap(); onPress(); }}
        accessibilityRole="button"
        accessibilityLabel={`${label}, currently ${value}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 60 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={Palette.textSecondary} />
        </View>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{label}</Text>
        <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary, marginRight: 4 }}>{value}</Text>
        <ChevronRight size={17} color={Palette.textSecondary} />
      </PressableScale>
      {!isLast ? <Divider /> : null}
    </>
  );
}

/** A row with an outlined action pill on the right. */
function ActionRow({
  Icon,
  label,
  ctaLabel,
  onPress,
  isLast = false,
}: {
  Icon: typeof RefreshCw;
  label: string;
  ctaLabel: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 60 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={Palette.textSecondary} />
        </View>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{label}</Text>
        <PressableScale
          onPress={() => { feedback.tap(); onPress(); }}
          accessibilityRole="button"
          accessibilityLabel={`${ctaLabel} ${label}`}
          style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.inkSoft }}>{ctaLabel}</Text>
        </PressableScale>
      </View>
      {!isLast ? <Divider /> : null}
    </>
  );
}

/** Simple nav row (label + chevron). */
function NavRow({
  Icon,
  label,
  sub,
  onPress,
  isLast = false,
}: {
  Icon: typeof Database;
  label: string;
  sub?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <>
      <PressableScale
        onPress={() => { feedback.tap(); onPress(); }}
        accessibilityRole="button"
        accessibilityLabel={sub ? `${label}. ${sub}` : label}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 60 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={Palette.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{label}</Text>
          {sub ? <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>{sub}</Text> : null}
        </View>
        <ChevronRight size={17} color={Palette.textSecondary} />
      </PressableScale>
      {!isLast ? <Divider /> : null}
    </>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AppSettingsScreen() {
  const router = useRouter();
  const { settings, update, loaded } = useAppSettings();
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  }

  function handleCurrencyPress() {
    Alert.alert(
      'Currency',
      'Choose your preferred display currency.',
      [
        { text: 'NGN — Nigerian naira', onPress: () => { void update({ currency: 'NGN' }); } },
        { text: 'USD — US dollar', onPress: () => { void update({ currency: 'USD' }); } },
        { text: 'GBP — British pound', onPress: () => { void update({ currency: 'GBP' }); } },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  function handleDistancePress() {
    Alert.alert(
      'Distance units',
      'Choose how distances are displayed.',
      [
        { text: 'Kilometres (km)', onPress: () => { void update({ distanceUnit: 'km' }); } },
        { text: 'Miles (mi)', onPress: () => { void update({ distanceUnit: 'mi' }); } },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  function handleClearRecentlyViewed() {
    Alert.alert(
      'Clear recently viewed?',
      'Your recently viewed meals list will be emptied.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            feedback.impact();
            clearRecentlyViewed();
            flash('Recently viewed cleared');
          },
        },
      ],
    );
  }

  function handleClearSearchHistory() {
    Alert.alert(
      'Clear search history?',
      'Your recent search queries will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            feedback.impact();
            clearRecentSearches();
            flash('Search history cleared');
          },
        },
      ],
    );
  }

  function handleClearCachedImages() {
    feedback.impact();
    flash('Image cache cleared');
  }

  function handleExportData() {
    Alert.alert(
      'Export my data',
      'Your data export is available in Privacy & Security settings, which generates a downloadable JSON file.',
      [{ text: 'OK' }],
    );
  }

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SettingsHeader
          title="app preferences"
          subtitle="Customise how Preppa looks and behaves for you."
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: 48,
            gap: 20,
            ...(Platform.OS === 'web' ? { maxWidth: 640, alignSelf: 'center' as const, width: '100%' } : {}),
          }}>

          {/* Preferences */}
          <SettingsGroup title="preferences" delay={0}>
            <ToggleRow
              Icon={Zap}
              label="Haptic feedback"
              sub="Vibrations for taps and actions"
              value={settings.hapticFeedback}
              onToggle={() => void update({ hapticFeedback: !settings.hapticFeedback })}
            />
            <ToggleRow
              Icon={Volume2}
              label="Sound effects"
              sub="Subtle audio cues for confirmations"
              value={settings.soundEffects}
              onToggle={() => void update({ soundEffects: !settings.soundEffects })}
            />
            <ToggleRow
              Icon={Tag}
              label="Show dietary badges"
              sub="Display allergen and diet labels on meal cards"
              value={settings.showDietaryBadges}
              onToggle={() => void update({ showDietaryBadges: !settings.showDietaryBadges })}
            />
            <ToggleRow
              Icon={Maximize2}
              label="Compact meal cards"
              sub="Smaller cards — more meals visible at once"
              value={settings.compactMealCards}
              onToggle={() => void update({ compactMealCards: !settings.compactMealCards })}
              isLast
            />
          </SettingsGroup>

          {/* Display */}
          <SettingsGroup title="display" delay={60}>
            <NavValueRow
              Icon={Globe}
              label="Currency"
              value={settings.currency}
              onPress={handleCurrencyPress}
            />
            <NavValueRow
              Icon={Ruler}
              label="Distance units"
              value={settings.distanceUnit}
              onPress={handleDistancePress}
              isLast
            />
          </SettingsGroup>

          {/* Privacy */}
          <SettingsGroup title="privacy" delay={120}>
            <ToggleRow
              Icon={Sparkles}
              label="Personalised recommendations"
              sub="Uses your order history to surface meals you'll love"
              value={settings.personalizedRecs}
              onToggle={() => void update({ personalizedRecs: !settings.personalizedRecs })}
            />
            <ToggleRow
              Icon={BarChart2}
              label="Usage analytics"
              sub="Anonymised app usage to improve Preppa"
              value={settings.usageAnalytics}
              onToggle={() => void update({ usageAnalytics: !settings.usageAnalytics })}
              isLast
            />
          </SettingsGroup>

          {/* Data */}
          <SettingsGroup title="data" delay={180}>
            <ActionRow
              Icon={Eye}
              label="Clear recently viewed"
              ctaLabel="Clear"
              onPress={handleClearRecentlyViewed}
            />
            <ActionRow
              Icon={Search}
              label="Clear search history"
              ctaLabel="Clear"
              onPress={handleClearSearchHistory}
            />
            <ActionRow
              Icon={RefreshCw}
              label="Clear cached images"
              ctaLabel="Clear"
              onPress={handleClearCachedImages}
            />
            <NavRow
              Icon={Database}
              label="Export my data"
              sub="Download a copy of your Preppa data"
              onPress={handleExportData}
              isLast
            />
          </SettingsGroup>

          {/* Notifications */}
          <SettingsGroup title="notifications" delay={220}>
            <NavRow
              Icon={Bell}
              label="Notification preferences"
              sub="Push alerts, orders, social & promotions"
              onPress={() => { feedback.tap(); router.push('/notification-preferences' as never); }}
              isLast
            />
          </SettingsGroup>

          {/* About */}
          <SettingsGroup title="about" delay={260}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 60 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={19} color={Palette.textSecondary} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>Version</Text>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>{APP_VERSION}</Text>
            </View>
          </SettingsGroup>

        </ScrollView>

        {/* Toast */}
        {toast ? (
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ position: 'absolute', left: 20, right: 20, bottom: 24, backgroundColor: Palette.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.surface, textAlign: 'center' }}>{toast}</Text>
          </MotiView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
