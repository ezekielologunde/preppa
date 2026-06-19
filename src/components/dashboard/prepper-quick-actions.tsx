import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { ChevronRight, Crown, Pencil, Radio, Share2, Truck, Video, type LucideIcon } from 'lucide-react-native';
import { View, Text } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const MUTED = Palette.textMuted;

const LINK_STYLE = { marginHorizontal: 20, marginBottom: 10, backgroundColor: Palette.surface, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, borderWidth: 1, borderColor: ORANGE + '28' };

function KitchenLink({ Icon, label, delay, onPress }: { Icon: LucideIcon; label: string; delay: number; onPress: () => void }) {
  return (
    <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay }}>
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={LINK_STYLE}>
        <Icon size={15} color={ORANGE} />
        <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13, color: MUTED }}>{label}</Text>
        <ChevronRight size={14} color={ORANGE} />
      </PressableScale>
    </MotiView>
  );
}

export interface PrepperQuickActionsProps {
  isOpen: boolean;
  isPro: boolean;
  hasPrepperId: boolean;
  router: ReturnType<typeof useRouter>;
  onToggleOpen: () => void;
  onGoLive: () => void;
  onShareKitchen: () => void;
}

export function PrepperQuickActions({ isOpen, isPro, hasPrepperId, router, onToggleOpen, onGoLive, onShareKitchen }: PrepperQuickActionsProps) {
  return (
    <>
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 60 }}>
        <View style={{ paddingHorizontal: 20, marginTop: 14, gap: 10 }}>
          {/* Open / Closed pill */}
          <MotiView
            animate={{ backgroundColor: isOpen ? GREEN + '18' : Palette.danger + '18', borderColor: isOpen ? GREEN + '55' : Palette.danger + '55' }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            style={{ borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden', alignSelf: 'flex-start' }}
          >
            <PressableScale
              onPress={onToggleOpen}
              accessibilityRole="switch" accessibilityState={{ checked: isOpen }}
              accessibilityLabel={isOpen ? 'Kitchen is open for preorders — tap to close' : 'Kitchen is closed — tap to open'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <MotiView animate={{ backgroundColor: isOpen ? GREEN : Palette.danger }} transition={{ type: 'spring', damping: 20, stiffness: 260 }} style={{ width: 9, height: 9, borderRadius: 5 }} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: isOpen ? GREEN : Palette.danger }}>
                {isOpen ? 'Open for preorders' : 'Kitchen closed'}
              </Text>
            </PressableScale>
          </MotiView>

          {/* Create content row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/post-video'); }}
              accessibilityRole="button" accessibilityLabel="Post a video"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: Radius.lg, backgroundColor: ORANGE + '18', borderWidth: 1.5, borderColor: ORANGE + '55' }}
            >
              <Video size={17} color={ORANGE} strokeWidth={2.2} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>Post Video</Text>
            </PressableScale>

            <PressableScale
              onPress={() => { feedback.tap(); onGoLive(); }}
              accessibilityRole="button" accessibilityLabel={isPro ? 'Go live' : 'Go live — Pro feature'}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: Radius.lg, backgroundColor: '#8b5cf618', borderWidth: 1.5, borderColor: '#8b5cf655' }}
            >
              <Radio size={17} color="#8b5cf6" strokeWidth={2.2} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#8b5cf6' }}>Go Live</Text>
              <View style={{ backgroundColor: '#8b5cf6', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: '#fff', letterSpacing: 0.3 }}>PRO</Text>
              </View>
            </PressableScale>
          </View>
        </View>
      </MotiView>

      {!isPro && <KitchenLink Icon={Crown} label="Go Pro — boosts, livestream & AI tools · $29/mo" delay={220} onPress={() => { feedback.tap(); router.push('/prepper-premium'); }} />}
      {hasPrepperId && <KitchenLink Icon={Share2} label="Share your kitchen with friends & followers" delay={230} onPress={onShareKitchen} />}
      {hasPrepperId && <KitchenLink Icon={Pencil} label="Edit kitchen profile" delay={238} onPress={() => { feedback.tap(); router.push('/kitchen-settings'); }} />}
      {hasPrepperId && <KitchenLink Icon={Truck} label="Delivery & pickup settings" delay={240} onPress={() => { feedback.tap(); router.push('/delivery-settings'); }} />}
    </>
  );
}
