import { usePathname, useRouter } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Platform, Text, useWindowDimensions } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { useCart } from '@/lib/queries/cart';
import { useAuth } from '@/providers/auth-provider';

const HIDE_ON = ['/cart', '/dashboard', '/earnings', '/prepper-orders', '/auth'];

export function FloatingCartBar() {
  const { user } = useAuth();
  const { data: cart } = useCart(user?.id);
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  // Hidden on desktop (sidebar nav handles it) and on screens where it's irrelevant
  if (width >= BP.desktop) return null;
  if (!cart || cart.count === 0) return null;
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  const count = cart.count;
  const label = `${count} item${count !== 1 ? 's' : ''} in cart`;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: 20 }}
      exitTransition={{ type: 'timing', duration: 180 }}
      transition={{ type: 'spring', damping: 18, stiffness: 220 }}
      style={{ position: 'absolute', bottom: (Platform.OS === 'ios' ? 66 : 96), left: 16, right: 16, zIndex: 60 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/cart'); }}
        accessibilityRole="button"
        accessibilityLabel={`${label} — tap to view cart`}
        style={{
          backgroundColor: Palette.brand,
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: Palette.brand,
          shadowOpacity: 0.32,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 5 },
          elevation: 8,
        }}>
        <ShoppingBag size={20} color="#fff" />
        <Text style={{ flex: 1, fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>
          {label}
        </Text>
        <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
          View →
        </Text>
      </PressableScale>
    </MotiView>
  );
}
