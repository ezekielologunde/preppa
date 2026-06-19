import { useRouter } from 'expo-router';
import { Bookmark, ShoppingCart, UtensilsCrossed, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Alert, Modal, Pressable, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { toggleFavorite } from '@/lib/favorites';
import { useAddToCart } from '@/lib/queries/cart';
import { useAuth } from '@/providers/auth-provider';
import type { Meal } from '@/components/meal-card';

type Props = {
  meal: Meal;
  visible: boolean;
  onClose: () => void;
};

export function MealCardActionSheet({ meal, visible, onClose }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const addToCart = useAddToCart();

  function handleAddToCart() {
    onClose();
    if (!user) { router.push('/auth?mode=signup'); return; }
    if (meal.inStock === false) {
      Alert.alert('Sold out', 'This meal is no longer available.'); return;
    }
    addToCart.mutate(
      { userId: user.id, mealId: meal.id, price: meal.price },
      {
        onSuccess: () => feedback.success(),
        onError: () => Alert.alert('Error', 'Could not add to cart. Please try again.'),
      },
    );
  }

  function handleSave() {
    onClose();
    toggleFavorite(`meal:${meal.id}`, user?.id ?? undefined);
  }

  function handleViewKitchen() {
    onClose();
    router.push(`/prepper?name=${encodeURIComponent(meal.prepper)}`);
  }

  const actions = [
    {
      icon: ShoppingCart,
      label: 'Add to Cart',
      sublabel: `$${meal.price.toFixed(2)}`,
      onPress: handleAddToCart,
      color: Palette.brand,
      disabled: meal.inStock === false,
    },
    {
      icon: Bookmark,
      label: 'Save for later',
      sublabel: 'Add to your favorites',
      onPress: handleSave,
      color: Palette.ink,
      disabled: false,
    },
    {
      icon: UtensilsCrossed,
      label: 'View Kitchen',
      sublabel: `by ${meal.prepper}`,
      onPress: handleViewKitchen,
      color: Palette.ink,
      disabled: false,
    },
  ] as const;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ type: 'timing', duration: 180 }}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: Palette.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close menu" />
        <MotiView
          from={{ translateY: 60, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260, delay: 20 }}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 36, ...Shadow.floating }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Palette.divider, alignSelf: 'center', marginBottom: 16 }} />
          {/* Title row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 }}>
            <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink, flex: 1 }}>{meal.title}</Text>
            <PressableScale onPress={onClose} accessibilityLabel="Close" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color={Palette.textSecondary} />
            </PressableScale>
          </View>
          {/* Actions */}
          <View style={{ paddingHorizontal: 12, gap: 4 }}>
            {actions.map((action) => (
              <PressableScale
                key={action.label}
                onPress={action.onPress}
                disabled={action.disabled}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: Radius.sm, backgroundColor: Palette.canvas, opacity: action.disabled ? 0.4 : 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: action.color === Palette.brand ? Palette.brandTint : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <action.icon size={18} color={action.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: action.disabled ? Palette.textMuted : Palette.ink }}>{action.label}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>{action.sublabel}</Text>
                </View>
              </PressableScale>
            ))}
          </View>
        </MotiView>
      </MotiView>
    </Modal>
  );
}
