import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { Bell, ChefHat, ChevronLeft, Search } from 'lucide-react-native';
import { View, Text } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { greeting } from '@/lib/greeting';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const INK = Palette.ink;
const MUTED = Palette.textSecondary;
const CARD = Palette.surface;

export interface DashboardHeaderProps {
  size: 'tablet' | 'mobile';
  displayName: string | undefined;
  avatarUrl: string | undefined;
  newCount: number;
  isOpen: boolean;
  isHomeCookAvailable: boolean;
  router: ReturnType<typeof useRouter>;
  onToggleOpen: () => void;
  onToggleHomeCook: () => void;
}

export function DashboardHeader({ size, displayName, avatarUrl, newCount, isOpen, isHomeCookAvailable, router, onToggleOpen, onToggleHomeCook }: DashboardHeaderProps) {
  const s = size === 'tablet';
  const btnSize = s ? 46 : 42;
  const btnRadius = s ? 23 : 21;
  const iconSize = s ? 20 : 19;
  const avatarRim = s ? 50 : 46;
  const avatarSize = s ? 46 : 42;

  return (
    <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: s ? 14 : 0, paddingBottom: s ? 10 : 0, gap: 12 }}>
        <PressableScale
          onPress={() => { feedback.tap(); router.canGoBack() ? router.back() : router.replace('/profile'); }}
          accessibilityRole="button" accessibilityLabel="Back to customer view"
          style={{ width: s ? 44 : 40, height: s ? 44 : 40, borderRadius: s ? 22 : 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={22} color={INK} />
        </PressableScale>

        <View style={{ width: avatarRim, height: avatarRim, borderRadius: avatarRim / 2, borderWidth: 2, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Avatar name={displayName ?? 'chef'} url={avatarUrl} size={avatarSize} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>{greeting()}, chef</Text>
          <Text style={{ fontFamily: Font.display, fontSize: s ? 24 : 22, color: INK, letterSpacing: -0.6 }}>my kitchen</Text>
          {!s && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <MotiView animate={{ backgroundColor: isOpen ? GREEN + '22' : Palette.chip }} transition={{ type: 'timing', duration: 200 }} style={{ borderRadius: Radius.pill, overflow: 'hidden' }}>
                <PressableScale
                  onPress={onToggleOpen}
                  accessibilityRole="switch" accessibilityState={{ checked: isOpen }}
                  accessibilityLabel={isOpen ? 'Kitchen is open — tap to close' : 'Kitchen is closed — tap to open'}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4 }}
                >
                  <MotiView animate={{ backgroundColor: isOpen ? GREEN : MUTED }} transition={{ type: 'timing', duration: 200 }} style={{ width: 8, height: 8, borderRadius: 4 }} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isOpen ? GREEN : Palette.textSecondary }}>{isOpen ? 'Open' : 'Closed'}</Text>
                </PressableScale>
              </MotiView>

              <MotiView animate={{ backgroundColor: isHomeCookAvailable ? Palette.homeCookTint : Palette.chip }} transition={{ type: 'timing', duration: 200 }} style={{ borderRadius: Radius.pill, overflow: 'hidden' }}>
                <PressableScale
                  onPress={onToggleHomeCook}
                  accessibilityRole="switch" accessibilityState={{ checked: isHomeCookAvailable }}
                  accessibilityLabel={isHomeCookAvailable ? 'Home cooking on — tap to disable' : 'Home cooking off — tap to enable'}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4 }}
                >
                  <ChefHat size={11} color={isHomeCookAvailable ? Palette.homeCook : Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isHomeCookAvailable ? Palette.homeCook : Palette.textSecondary }}>Home cook</Text>
                </PressableScale>
              </MotiView>
            </View>
          )}
        </View>

        <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }} accessibilityRole="button" accessibilityLabel="Search" style={{ width: btnSize, height: btnSize, borderRadius: btnRadius, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
          <Search size={iconSize} color={INK} />
        </PressableScale>

        <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel="New orders" style={{ width: btnSize, height: btnSize, borderRadius: btnRadius, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
          <Bell size={iconSize} color={INK} />
          {newCount > 0 && (
            <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>{newCount}</Text>
            </View>
          )}
        </PressableScale>
      </View>
      {s && <View style={{ height: 1, backgroundColor: Palette.border, marginHorizontal: 20 }} />}
    </MotiView>
  );
}
