import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Fingerprint,
  Flame,
  Gift,
  Globe,
  HelpCircle,
  Info,
  Lock,
  Mail,
  Moon,
  MapPin,
  MessageCircle,
  Phone,
  Salad,
  Shield,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Linking, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { toggleDarkMode, useDarkMode } from '@/lib/theme-mode';

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <PressableScale
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={value ? 'On' : 'Off'}
      scaleTo={0.96}
      style={{
        width: 40,
        height: 24,
        borderRadius: 12,
        backgroundColor: value ? Palette.brand : Palette.border,
        justifyContent: 'center',
        paddingHorizontal: 3,
        alignItems: 'flex-start',
      }}>
      <MotiView
        animate={{ translateX: value ? 16 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: Palette.surface }}
      />
    </PressableScale>
  );
}

// ─── Value chip ───────────────────────────────────────────────────────────────

function ValueChip({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: Radius.pill,
        backgroundColor: Palette.chip,
      }}>
      <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.inkSoft }}>{label}</Text>
    </View>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

type RowRight =
  | { type: 'chevron' }
  | { type: 'toggle'; value: boolean; onToggle: () => void }
  | { type: 'chip'; label: string }
  | { type: 'value'; label: string };

interface RowProps {
  Icon: LucideIcon;
  label: string;
  iconBg?: string;
  iconColor?: string;
  labelColor?: string;
  right: RowRight;
  onPress: () => void;
  isLast?: boolean;
}

function Row({ Icon, label, iconBg, iconColor, labelColor, right, onPress, isLast }: RowProps) {
  const chipBg = iconBg ?? Palette.chip;
  const chipColor = iconColor ?? Palette.textSecondary;

  return (
    <>
      <PressableScale
        onPress={onPress}
        accessibilityRole={right.type === 'toggle' ? 'switch' : 'button'}
        accessibilityLabel={label}
        accessibilityState={right.type === 'toggle' ? { checked: right.value } : undefined}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          minHeight: 56,
          gap: 12,
        }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: chipBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon size={17} color={chipColor} />
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: Font.medium,
            fontSize: 15,
            color: labelColor ?? Palette.ink,
          }}>
          {label}
        </Text>
        {right.type === 'chevron' && <ChevronRight size={17} color={Palette.textSecondary} />}
        {right.type === 'toggle' && <Toggle value={right.value} onToggle={right.onToggle} />}
        {right.type === 'chip' && <ValueChip label={right.label} />}
        {right.type === 'value' && (
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
            {right.label}
          </Text>
        )}
      </PressableScale>
      {!isLast && <View style={{ height: 1, backgroundColor: Palette.border, marginLeft: 64 }} />}
    </>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay }}
      style={{ marginHorizontal: 20 }}>
      <Text
        style={{
          fontFamily: Font.display,
          fontSize: 13,
          color: Palette.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 8,
          paddingHorizontal: 4,
        }}>
        {title}
      </Text>
      <View
        style={{
          backgroundColor: Palette.surface,
          borderRadius: 20,
          overflow: 'hidden',
          ...Shadow.card,
        }}>
        {children}
      </View>
    </MotiView>
  );
}

// ─── Delete-account confirmation modal ───────────────────────────────────────

function DeleteModal({ visible, onCancel, onConfirm }: { visible: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
        <MotiView from={{ opacity: 0, translateY: 24 }} animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 260 }}
          style={{ backgroundColor: Palette.surface, borderRadius: 24, padding: 24, gap: 8 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Palette.danger + '1A', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 }}>
            <AlertTriangle size={24} color={Palette.danger} />
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, textAlign: 'center', marginBottom: 4 }}>
            Delete account?
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
            This will permanently delete your Preppa account, orders, and all saved data. This action cannot be undone.
          </Text>
          <PressableScale onPress={() => { feedback.warning(); onConfirm(); }} accessibilityRole="button" accessibilityLabel="Confirm delete account"
            style={{ marginTop: 16, paddingVertical: 15, borderRadius: 16, backgroundColor: Palette.danger, alignItems: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.surface }}>Yes, delete my account</Text>
          </PressableScale>
          <PressableScale onPress={() => { feedback.tap(); onCancel(); }} accessibilityRole="button" accessibilityLabel="Cancel"
            style={{ paddingVertical: 15, borderRadius: 16, backgroundColor: Palette.chip, alignItems: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>Cancel</Text>
          </PressableScale>
        </MotiView>
      </View>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();

  const dark = useDarkMode();
  const [toast, setToast] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);

  // notification toggles
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [nearbyPreppers, setNearbyPreppers] = useState(true);
  const [rushAlerts, setRushAlerts] = useState(false);
  const [weeklyPicks, setWeeklyPicks] = useState(false);
  const [holidaySpecials, setHolidaySpecials] = useState(false);

  // privacy toggles
  const [activityStatus, setActivityStatus] = useState(true);
  const [dataAnalytics, setDataAnalytics] = useState(true);

  // payments toggles
  const [applePay, setApplePay] = useState(false);

  // meal prefs
  const [allergenAlerts, setAllergenAlerts] = useState(true);

  // accessibility toggles
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [screenReaderHints, setScreenReaderHints] = useState(false);

  // security toggles
  const [biometric, setBiometric] = useState(false);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  };

  const soon = (label: string) => {
    feedback.warning();
    flash(`${label} — coming soon`);
  };

  const go = (route: string) => { feedback.tap(); router.push(route as never); };

  const handleDeleteConfirm = () => {
    setDeleteVisible(false);
    feedback.error();
    flash('Account deletion requested — check your email to confirm.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 260 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: Platform.OS === 'web' ? 16 : 8,
            paddingBottom: 12,
            gap: 12,
          }}>
          <PressableScale
            onPress={() => { feedback.tap(); router.back(); }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: Palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
              ...Shadow.card,
            }}>
            <ChevronLeft size={20} color={Palette.ink} />
          </PressableScale>
          <Text
            style={{
              fontFamily: Font.display,
              fontSize: 22,
              color: Palette.ink,
              letterSpacing: -0.5,
            }}>
            settings
          </Text>
        </MotiView>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 130, gap: 24, paddingTop: 4 }}>

          {/* ACCOUNT */}
          <Section title="account" delay={0}>
            <Row Icon={User} label="edit profile" right={{ type: 'chevron' }} onPress={() => go('/edit-profile')} />
            <Row Icon={Mail} label="change email" right={{ type: 'chevron' }} onPress={() => go('/change-email')} />
            <Row Icon={Lock} label="change password" right={{ type: 'chevron' }} onPress={() => go('/change-password')} />
            <Row Icon={Globe} label="linked accounts" right={{ type: 'chevron' }} onPress={() => soon('Linked accounts')} />
            <Row Icon={Phone} label="verify phone" right={{ type: 'chevron' }} onPress={() => soon('Verify phone')} />
            <Row
              Icon={Trash2}
              label="delete account"
              iconBg={Palette.danger + '1A'}
              iconColor={Palette.danger}
              labelColor={Palette.danger}
              right={{ type: 'chevron' }}
              onPress={() => {
                feedback.impact();
                setDeleteVisible(true);
              }}
              isLast
            />
          </Section>

          {/* DISPLAY */}
          <Section title="display" delay={35}>
            <Row Icon={Moon} label="dark mode" right={{ type: 'toggle', value: dark, onToggle: toggleDarkMode }} onPress={toggleDarkMode} isLast />
          </Section>

          {/* NOTIFICATIONS */}
          <Section title="notifications" delay={40}>
            <Row Icon={Bell} label="notification preferences" right={{ type: 'chevron' }} onPress={() => go('/notification-settings')} />
            <Row Icon={Bell} label="push notifications" right={{ type: 'toggle', value: pushEnabled, onToggle: () => setPushEnabled((v) => !v) }} onPress={() => setPushEnabled((v) => !v)} />
            <Row Icon={Mail} label="email digest" right={{ type: 'toggle', value: emailDigest, onToggle: () => setEmailDigest((v) => !v) }} onPress={() => setEmailDigest((v) => !v)} />
            <Row Icon={Zap} label="order updates" right={{ type: 'toggle', value: orderUpdates, onToggle: () => setOrderUpdates((v) => !v) }} onPress={() => setOrderUpdates((v) => !v)} />
            <Row Icon={MapPin} label="new preppers nearby" right={{ type: 'toggle', value: nearbyPreppers, onToggle: () => setNearbyPreppers((v) => !v) }} onPress={() => setNearbyPreppers((v) => !v)} />
            <Row Icon={Flame} label="rush hour alerts" right={{ type: 'toggle', value: rushAlerts, onToggle: () => setRushAlerts((v) => !v) }} onPress={() => setRushAlerts((v) => !v)} />
            <Row Icon={TrendingUp} label="weekly picks" right={{ type: 'toggle', value: weeklyPicks, onToggle: () => setWeeklyPicks((v) => !v) }} onPress={() => setWeeklyPicks((v) => !v)} />
            <Row Icon={Gift} label="holiday specials" right={{ type: 'toggle', value: holidaySpecials, onToggle: () => setHolidaySpecials((v) => !v) }} onPress={() => setHolidaySpecials((v) => !v)} isLast />
          </Section>

          {/* PRIVACY */}
          <Section title="privacy" delay={80}>
            <Row Icon={Eye} label="profile visibility" right={{ type: 'chip', label: 'Public' }} onPress={() => soon('Profile visibility')} />
            <Row Icon={User} label="activity status" right={{ type: 'toggle', value: activityStatus, onToggle: () => setActivityStatus((v) => !v) }} onPress={() => setActivityStatus((v) => !v)} />
            <Row Icon={TrendingUp} label="data & analytics" right={{ type: 'toggle', value: dataAnalytics, onToggle: () => setDataAnalytics((v) => !v) }} onPress={() => setDataAnalytics((v) => !v)} />
            <Row Icon={MapPin} label="location services" right={{ type: 'chevron' }} onPress={() => soon('Location services')} isLast />
          </Section>

          {/* PAYMENTS */}
          <Section title="payments" delay={120}>
            <Row Icon={CreditCard} label="saved cards" right={{ type: 'chevron' }} onPress={() => go('/payment-methods')} />
            <Row Icon={Wallet} label="default payment" right={{ type: 'chip', label: 'Visa ••4242' }} onPress={() => go('/payment-methods')} />
            <Row Icon={Smartphone} label="apple pay / google pay" right={{ type: 'toggle', value: applePay, onToggle: () => setApplePay((v) => !v) }} onPress={() => setApplePay((v) => !v)} isLast />
          </Section>

          {/* ADDRESSES */}
          <Section title="addresses" delay={160}>
            <Row Icon={MapPin} label="manage addresses" right={{ type: 'chevron' }} onPress={() => go('/addresses')} />
            <Row Icon={MapPin} label="default address" right={{ type: 'chip', label: 'Home · 123 Main St' }} onPress={() => go('/addresses')} isLast />
          </Section>

          {/* MEAL PREFERENCES */}
          <Section title="meal preferences" delay={200}>
            <Row Icon={Salad} label="dietary restrictions" right={{ type: 'chevron' }} onPress={() => go('/dietary-preferences')} />
            <Row Icon={Globe} label="cuisine preferences" right={{ type: 'chevron' }} onPress={() => go('/dietary-preferences')} />
            <Row Icon={Zap} label="spice tolerance" right={{ type: 'chip', label: 'Medium' }} onPress={() => go('/dietary-preferences')} />
            <Row Icon={AlertTriangle} label="allergen alerts" right={{ type: 'toggle', value: allergenAlerts, onToggle: () => setAllergenAlerts((v) => !v) }} onPress={() => setAllergenAlerts((v) => !v)} isLast />
          </Section>

          {/* ACCESSIBILITY */}
          <Section title="accessibility" delay={240}>
            <Row Icon={Info} label="text size" right={{ type: 'chip', label: 'System default' }} onPress={() => Linking.openSettings().catch(() => soon('Text size'))} />
            <Row Icon={Eye} label="reduce motion" right={{ type: 'toggle', value: reduceMotion, onToggle: () => setReduceMotion((v) => !v) }} onPress={() => setReduceMotion((v) => !v)} />
            <Row Icon={Eye} label="high contrast" right={{ type: 'toggle', value: highContrast, onToggle: () => setHighContrast((v) => !v) }} onPress={() => setHighContrast((v) => !v)} />
            <Row Icon={MessageCircle} label="screen reader hints" right={{ type: 'toggle', value: screenReaderHints, onToggle: () => setScreenReaderHints((v) => !v) }} onPress={() => setScreenReaderHints((v) => !v)} isLast />
          </Section>

          {/* SECURITY */}
          <Section title="security" delay={280}>
            <Row Icon={Shield} label="two-factor authentication" right={{ type: 'chip', label: 'Off' }} onPress={() => soon('Two-factor authentication')} />
            <Row Icon={Smartphone} label="active sessions" right={{ type: 'chip', label: '1 device' }} onPress={() => soon('Active sessions')} />
            <Row Icon={Fingerprint} label="biometric login" right={{ type: 'toggle', value: biometric, onToggle: () => setBiometric((v) => !v) }} onPress={() => setBiometric((v) => !v)} isLast />
          </Section>

          {/* SUPPORT */}
          <Section title="support" delay={320}>
            <Row Icon={HelpCircle} label="help center" right={{ type: 'chevron' }} onPress={() => Linking.openURL('mailto:support@preppa.live?subject=Preppa%20support').catch(() => soon('Help center'))} />
            <Row Icon={AlertTriangle} label="report a problem" right={{ type: 'chevron' }} onPress={() => Linking.openURL('mailto:support@preppa.live?subject=Report%20a%20Problem').catch(() => soon('Report a problem'))} />
            <Row Icon={Star} label="rate the app" right={{ type: 'chevron' }} onPress={() => soon('Rate the app')} />
            <Row Icon={MessageCircle} label="chat support" right={{ type: 'chevron' }} onPress={() => soon('Chat support')} isLast />
          </Section>

          {/* ABOUT */}
          <Section title="about" delay={360}>
            <Row Icon={Info} label="app version" right={{ type: 'value', label: '1.0.0' }} onPress={() => {}} />
            <Row Icon={ShieldCheck} label="terms of service" right={{ type: 'chevron' }} onPress={() => Linking.openURL('https://preppa.live/terms').catch(() => {})} />
            <Row Icon={Lock} label="privacy policy" right={{ type: 'chevron' }} onPress={() => Linking.openURL('https://preppa.live/privacy').catch(() => {})} />
            <Row Icon={Globe} label="licenses" right={{ type: 'chevron' }} onPress={() => soon('Licenses')} isLast />
          </Section>

        </ScrollView>

        {/* Toast */}
        {toast ? (
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: 24,
              backgroundColor: Palette.ink,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 13,
              ...Shadow.floating,
            }}>
            <Text
              style={{
                fontFamily: Font.medium,
                fontSize: 13.5,
                color: Palette.surface,
                textAlign: 'center',
              }}>
              {toast}
            </Text>
          </MotiView>
        ) : null}
      </SafeAreaView>

      <DeleteModal
        visible={deleteVisible}
        onCancel={() => setDeleteVisible(false)}
        onConfirm={handleDeleteConfirm}
      />
    </View>
  );
}
