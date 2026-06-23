import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CreditCard,
  HelpCircle,
  LogOut,
  MapPin,
  ShieldCheck,
  Star,
  ChefHat,
} from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

// ── Types ────────────────────────────────────────────────────────────────────

type Stats = { orderCount: number; memberSince: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(email: string): string {
  return email.charAt(0).toUpperCase();
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ email }: { email: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarInitial}>{initials(email)}</Text>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  danger,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.settingsRow}>
      <View style={[styles.settingsIcon, danger && styles.settingsIconDanger]}>
        {icon}
      </View>
      <Text style={[styles.settingsLabel, danger && styles.settingsLabelDanger]}>{label}</Text>
      <View style={styles.settingsRight}>
        {value ? <Text style={styles.settingsValue}>{value}</Text> : null}
        {!danger && <ChevronRight size={15} color={Palette.textMuted} strokeWidth={2} />}
      </View>
    </TouchableOpacity>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', user.id)
      .then(({ count }) => {
        setStats({
          orderCount: count ?? 0,
          memberSince: memberSince(user.created_at ?? new Date().toISOString()),
        });
      });
  }, [user]);

  const handleSignOut = () => {
    Alert.alert('sign out', 'are you sure you want to sign out?', [
      { text: 'cancel', style: 'cancel' },
      { text: 'sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.unauthWrap}>
          <View style={styles.unauthIcon}>
            <Star size={32} color={Palette.textMuted} strokeWidth={1.4} />
          </View>
          <Text style={styles.unauthTitle}>sign in to view your profile</Text>
          <Text style={styles.unauthSub}>track orders, manage preferences, and earn rewards</Text>
          <TouchableOpacity
            onPress={() => router.push('/auth' as never)}
            activeOpacity={0.85}
            style={styles.unauthBtn}
          >
            <Text style={styles.unauthBtnText}>sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Profile hero ─────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Avatar email={user.email ?? 'U'} />
          <View style={styles.heroInfo}>
            <Text style={styles.heroEmail} numberOfLines={1}>{user.email}</Text>
            {stats && (
              <Text style={styles.heroSince}>member since {stats.memberSince}</Text>
            )}
          </View>
        </View>

        {/* ── Stats ────────────────────────────────────────────── */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.orderCount}</Text>
              <Text style={styles.statLabel}>orders</Text>
            </View>
            <View style={styles.statDivider} />
            <TouchableOpacity
              onPress={() => router.push('/orders' as never)}
              activeOpacity={0.8}
              style={[styles.statCard, { flex: 1 }]}
            >
              <Text style={[styles.statValue, { color: Palette.brand }]}>view all</Text>
              <Text style={styles.statLabel}>order history</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Prepper mode ─────────────────────────────────────── */}
        <SettingsSection title="seller">
          <SettingsRow
            icon={<ChefHat size={17} color={Palette.brand} strokeWidth={1.8} />}
            label="kitchen dashboard"
            onPress={() => router.push('/prepper' as never)}
          />
        </SettingsSection>

        {/* ── Account ──────────────────────────────────────────── */}
        <SettingsSection title="account">
          <SettingsRow
            icon={<Bell size={17} color={Palette.brand} strokeWidth={1.8} />}
            label="notifications"
            onPress={() => {}}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<MapPin size={17} color={Palette.brand} strokeWidth={1.8} />}
            label="saved addresses"
            onPress={() => {}}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<CreditCard size={17} color={Palette.brand} strokeWidth={1.8} />}
            label="payment methods"
            onPress={() => {}}
          />
        </SettingsSection>

        {/* ── Support ──────────────────────────────────────────── */}
        <SettingsSection title="support">
          <SettingsRow
            icon={<HelpCircle size={17} color={Palette.brand} strokeWidth={1.8} />}
            label="help & faq"
            onPress={() => {}}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon={<ShieldCheck size={17} color={Palette.brand} strokeWidth={1.8} />}
            label="privacy policy"
            onPress={() => {}}
          />
        </SettingsSection>

        {/* ── Sign out ─────────────────────────────────────────── */}
        <SettingsSection title="">
          <SettingsRow
            icon={<LogOut size={17} color={Palette.danger} strokeWidth={1.8} />}
            label="sign out"
            onPress={handleSignOut}
            danger
          />
        </SettingsSection>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  scroll: { paddingHorizontal: Space.xl, paddingTop: 16, paddingBottom: 32 },

  // Unauthenticated state
  unauthWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl,
  },
  unauthIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  unauthTitle: {
    fontFamily: Font.display, fontSize: Type.title,
    color: Palette.ink, marginBottom: 8, letterSpacing: -0.3,
  },
  unauthSub: {
    fontFamily: Font.body, fontSize: Type.body,
    color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },
  unauthBtn: {
    backgroundColor: Palette.brand, borderRadius: Radius.pill,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  unauthBtnText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },

  // Hero
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Palette.surface, borderRadius: 20,
    padding: 18, marginBottom: 12, ...Shadow.card,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 20,
    backgroundColor: Palette.brand,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: { fontFamily: Font.display, fontSize: 26, color: Palette.surface },
  heroInfo: { flex: 1 },
  heroEmail: { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.ink },
  heroSince: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 4 },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Palette.surface, borderRadius: 18,
    padding: 18, marginBottom: 20, ...Shadow.card,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontFamily: Font.display, fontSize: Type.displayLg, color: Palette.ink },
  statLabel: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary },
  statDivider: { width: 1, height: 36, backgroundColor: Palette.border, marginHorizontal: 8 },

  // Settings section
  section: { marginBottom: 16 },
  sectionTitle: {
    fontFamily: Font.semibold, fontSize: Type.micro,
    color: Palette.textSecondary, letterSpacing: 0.4,
    textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Palette.surface, borderRadius: 18, ...Shadow.card, overflow: 'hidden',
  },

  settingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14, minHeight: 56,
  },
  settingsIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Palette.brandTint,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  settingsIconDanger: { backgroundColor: Palette.dangerTint },
  settingsLabel: { flex: 1, fontFamily: Font.semibold, fontSize: Type.body, color: Palette.ink },
  settingsLabelDanger: { color: Palette.danger },
  settingsRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingsValue: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary },

  rowDivider: { height: 1, backgroundColor: Palette.border, marginLeft: 64 },
});
