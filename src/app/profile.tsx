import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Bell,
  Bookmark,
  Camera,
  ChefHat,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  Crown,
  Gift,
  Heart,
  HelpCircle,
  Leaf,
  MapPin,
  Moon,
  Pencil,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = '#f15f22';
const INK = '#111827';

const quickLinks = [
  { label: 'favorites', sub: '24 meals', Icon: Heart, color: '#ef4444', bg: '#FEE2E2' },
  { label: 'saved', sub: '18 items', Icon: Bookmark, color: '#f59e0b', bg: '#FEF3C7' },
  { label: 'recent', sub: '32 meals', Icon: Clock, color: '#16a34a', bg: '#DCFCE7' },
  { label: 'following', sub: '12 preppers', Icon: Users, color: '#8b5cf6', bg: '#EDE9FE' },
  { label: 'referrals', sub: 'invite', Icon: Ticket, color: '#f59e0b', bg: '#FEF3C7' },
];

const hub: { label: string; sub: string; Icon: LucideIcon; accent?: boolean }[] = [
  { label: 'addresses', sub: '2 saved', Icon: MapPin },
  { label: 'payment methods', sub: 'Visa •••• 4242', Icon: CreditCard },
  { label: 'notifications', sub: 'email, sms, push', Icon: Bell },
  { label: 'help center', sub: 'faq & support', Icon: HelpCircle },
  { label: 'dietary preferences', sub: 'manage', Icon: Leaf },
  { label: 'become a prepper', sub: 'share your kitchen', Icon: ChefHat, accent: true },
  { label: 'invite friends', sub: 'earn rewards', Icon: UserPlus },
];

function Badge({ Icon, label, color }: { Icon: LucideIcon; label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
      <Icon size={14} color={color} />
      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#374151' }}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, isAdmin } = useAuth();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'guest';

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F8' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 130 }}>
          {/* Top actions */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, gap: 10 }}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Settings" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Settings size={19} color={INK} /></PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel="Notifications" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Bell size={19} color={INK} /></PressableScale>
          </View>

          {/* Identity */}
          <View style={{ alignItems: 'center', paddingHorizontal: 20, marginTop: 6 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: ORANGE, padding: 3 }}>
              <Image source="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=60" style={{ flex: 1, borderRadius: 42 }} contentFit="cover" />
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F7F7F8' }}>
                <Camera size={14} color="#fff" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6 }}>{displayName}</Text>
              <Pencil size={16} color={ORANGE} />
            </View>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#6b7280', marginTop: 2 }}>good food. good mood. always.</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <MapPin size={13} color="#9ca3af" />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#6b7280' }}>New York, NY</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Badge Icon={Sparkles} label="foodie" color="#f59e0b" />
              <Badge Icon={Compass} label="explorer" color="#8b5cf6" />
              <Badge Icon={Heart} label="plan lover" color="#ef4444" />
            </View>
          </View>

          {/* Rewards / tier */}
          <LinearGradient colors={['#FFE9D6', '#FFDDBE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ marginHorizontal: 20, marginTop: 22, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#7c5a42' }}>your balance</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 28, color: ORANGE, letterSpacing: -0.5 }}>1,250 <Text style={{ fontSize: 15 }}>pts</Text></Text>
              <Text style={{ fontFamily: Font.medium, fontSize: 12, color: '#7c5a42', marginTop: 2 }}>$12.50 in rewards ›</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <Crown size={15} color="#d97706" />
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>gold chef</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#7c5a42' }}>· 750 pts to go</Text>
              </View>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)', marginTop: 8, overflow: 'hidden' }}>
                <View style={{ width: '62%', height: 7, borderRadius: 4, backgroundColor: ORANGE }} />
              </View>
            </View>
            <Gift size={56} color="#d97706" />
          </LinearGradient>

          {/* Admin console — only granted admins see this */}
          {isAdmin ? (
            <PressableScale
              onPress={() => router.push('/admin')}
              accessibilityRole="button"
              accessibilityLabel="Open admin console"
              style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: '#0C0E13', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(241,95,34,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>admin console</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#9AA1AD', marginTop: 1 }}>approvals, orders, earnings & features</Text>
              </View>
              <ChevronRight size={18} color="#6B7280" />
            </PressableScale>
          ) : null}

          {/* Quick links */}
          <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            {quickLinks.map((q) => (
              <PressableScale key={q.label} accessibilityRole="button" accessibilityLabel={`${q.label}, ${q.sub}`} style={{ alignItems: 'center', gap: 7, flex: 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: q.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <q.Icon size={19} color={q.color} />
                </View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#374151' }}>{q.label}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10, color: '#9ca3af' }}>{q.sub}</Text>
              </PressableScale>
            ))}
          </View>

          {/* Hub */}
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginTop: 28, marginBottom: 12 }}>your hub</Text>
          <View style={{ marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' }}>
            {hub.map((h, i) => (
              <PressableScale
                key={h.label}
                onPress={() => h.accent && router.push('/become-prepper')}
                accessibilityRole="button"
                accessibilityLabel={`${h.label}, ${h.sub}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#f3f4f6' }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: h.accent ? '#FDEDE4' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                  <h.Icon size={18} color={h.accent ? ORANGE : '#6b7280'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: h.accent ? ORANGE : INK }}>{h.label}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{h.sub}</Text>
                </View>
                <ChevronRight size={18} color="#d1d5db" />
              </PressableScale>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Moon size={18} color="#6b7280" />
              </View>
              <Text style={{ flex: 1, fontFamily: Font.heading, fontSize: 15, color: INK }}>dark mode</Text>
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: '#e5e7eb', justifyContent: 'center', paddingHorizontal: 3 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
              </View>
            </View>
          </View>

          <PressableScale
            onPress={() => (user ? signOut() : router.push('/auth?mode=signin'))}
            accessibilityRole="button"
            accessibilityLabel={user ? 'Sign out' : 'Sign in or create account'}
            style={{ marginHorizontal: 20, marginTop: 16, alignItems: 'center', paddingVertical: 15, borderRadius: 16, backgroundColor: user ? '#fff' : ORANGE }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: user ? '#ef4444' : '#fff' }}>
              {user ? 'sign out' : 'sign in / create account'}
            </Text>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
