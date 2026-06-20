import { usePathname, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { Activity, ChefHat, Crown, Home, MessageSquare, Plus, ShoppingBag, TrendingUp, User, type LucideIcon } from 'lucide-react-native';
import { View, Text } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const ORANGE = Palette.brand;
const CARD = Palette.surface;

export function ActionItem({ Icon, label, color, onPress }: { Icon: LucideIcon; label: string; color: string; onPress?: () => void }) {
  return (
    <PressableScale
      onPress={onPress ? () => { feedback.tap(); onPress(); } : undefined}
      accessibilityRole="button" accessibilityLabel={label}
      style={{ alignItems: 'center', gap: 5, width: 58 }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} />
      </View>
      <Text style={{ fontFamily: Font.medium, fontSize: 10, color: Palette.textSecondary }} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

export function NavTab({ Icon, label, active, badge, onPress }: { Icon: LucideIcon; label: string; active?: boolean; badge?: number; onPress?: () => void }) {
  const color = active ? ORANGE : Palette.textSecondary;
  return (
    <PressableScale
      onPress={onPress ? () => { feedback.tap(); onPress(); } : undefined}
      accessibilityRole="tab" accessibilityState={{ selected: !!active }} accessibilityLabel={label}
      style={{ alignItems: 'center', gap: 3 }}
    >
      <View>
        <Icon size={22} color={color} strokeWidth={active ? 2.4 : 2} />
        {badge ? (
          <View style={{ position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: '#fff' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontFamily: Font.medium, fontSize: 11, color }}>{label}</Text>
    </PressableScale>
  );
}

export interface DashboardFloatingBarProps {
  isPro: boolean;
  isDesktop: boolean;
  newCount: number;
  bottomInset: number;
  router: ReturnType<typeof useRouter>;
}

export function DashboardFloatingBar({ isPro, isDesktop, newCount, bottomInset, router }: DashboardFloatingBarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      <MotiView
        from={{ translateY: 80, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 220, delay: 300 }}
        style={[
          { position: 'absolute', left: 16, right: 16, bottom: Math.max(bottomInset, 16) + (isDesktop ? 0 : 56), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD, borderRadius: 26, paddingVertical: 12, paddingHorizontal: 18, ...Shadow.floating },
          isDesktop && { left: undefined, right: undefined, alignSelf: 'center', width: 520 },
        ]}
      >
        <ActionItem Icon={TrendingUp} label="earnings" color={Palette.inkSoft} onPress={() => router.push('/earnings')} />
        <PressableScale accessibilityRole="button" accessibilityLabel="Add new meal" onPress={() => { feedback.tap(); router.push('/meal-editor'); }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: -26, backgroundColor: ORANGE, ...Shadow.floating, shadowColor: ORANGE, shadowOpacity: 0.45 }}>
            <Plus size={28} color="#fff" />
          </View>
        </PressableScale>
        {isPro
          ? <ActionItem Icon={Activity} label="analytics" color={Palette.success} onPress={() => router.push('/prepper-analytics')} />
          : <ActionItem Icon={Crown} label="go pro" color={ORANGE} onPress={() => router.push('/prepper-premium')} />}
      </MotiView>

      {!isDesktop && (
        <View accessibilityRole="tablist" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: Palette.surface, paddingTop: 10, paddingBottom: Math.max(bottomInset, 16), borderTopLeftRadius: 24, borderTopRightRadius: 24, ...Shadow.navBar }}>
          <NavTab Icon={Home} label="home" active={isActive('/')} onPress={() => router.push('/')} />
          <NavTab Icon={ShoppingBag} label="preorders" badge={newCount || undefined} active={isActive('/prepper-orders')} onPress={() => router.push('/prepper-orders')} />
          <NavTab Icon={ChefHat} label="kitchen" active={isActive('/dashboard')} onPress={() => router.push('/dashboard')} />
          <NavTab Icon={MessageSquare} label="messages" active={isActive('/messages')} onPress={() => router.push('/messages')} />
          <NavTab Icon={User} label="profile" active={isActive('/profile')} onPress={() => router.push('/profile')} />
        </View>
      )}
    </>
  );
}
