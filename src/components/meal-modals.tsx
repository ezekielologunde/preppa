import { Image } from 'expo-image';
import { Check, ChevronLeft, ChevronRight, ShoppingBag, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type LightboxProps = {
  visible: boolean;
  onClose: () => void;
  images: string[];
  lightboxIdx: number;
  onPrev: () => void;
  onNext: () => void;
  title?: string;
  prepper?: string;
};

export function MealLightboxModal({ visible, onClose, images, lightboxIdx, onPrev, onNext, title, prepper }: LightboxProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        {images[lightboxIdx] ? (
          <Image source={imgUrl(images[lightboxIdx], 1400)} style={{ width: '100%', height: '80%' }} contentFit="contain" />
        ) : null}
        <PressableScale
          onPress={() => { feedback.tap(); onClose(); }}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          style={{ position: 'absolute', top: 60, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <X size={22} color="#fff" />
        </PressableScale>
        {images.length > 1 ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }} pointerEvents="box-none">
            {lightboxIdx > 0 ? (
              <PressableScale onPress={onPrev} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={22} color="#fff" />
              </PressableScale>
            ) : <View style={{ width: 44 }} />}
            {lightboxIdx < images.length - 1 ? (
              <PressableScale onPress={onNext} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={22} color="#fff" />
              </PressableScale>
            ) : <View style={{ width: 44 }} />}
          </View>
        ) : null}
        {images.length > 1 ? (
          <View style={{ position: 'absolute', bottom: 100, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
            {images.map((_, i) => (
              <MotiView key={i} animate={{ width: i === lightboxIdx ? 16 : 6, backgroundColor: i === lightboxIdx ? '#fff' : 'rgba(255,255,255,0.4)' }} transition={{ type: 'timing', duration: 200 }} style={{ height: 6, borderRadius: 3 }} />
            ))}
          </View>
        ) : null}
        {title ? (
          <View style={{ position: 'absolute', bottom: 56, left: 24, right: 24 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', textAlign: 'center', letterSpacing: -0.4 }}>{title}</Text>
            {prepper ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 4 }}>by {prepper}</Text> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

type ConfirmSheetProps = {
  visible: boolean;
  onClose: () => void;
  onGoToCart: () => void;
  meal: { title: string; prepper: string; price: number; images: string[] } | null | undefined;
  cartCount: number;
  insetsBottom: number;
};

export function MealConfirmSheet({ visible, onClose, onGoToCart, meal, cartCount, insetsBottom }: ConfirmSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 180 }} style={{ flex: 1 }}>
        <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: Palette.overlay }} accessibilityLabel="Dismiss" />
        <MotiView
          from={{ translateY: 340 }}
          animate={{ translateY: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 20, paddingBottom: insetsBottom + 24, gap: 14 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginBottom: 4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MotiView from={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 16 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={17} color="#fff" strokeWidth={3} />
              </View>
            </MotiView>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }}>Added to cart!</Text>
          </View>
          {meal ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: 14, padding: 12 }}>
              {meal.images[0] ? (
                <Image source={imgUrl(meal.images[0], 200)} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" transition={150} />
              ) : null}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK, lineHeight: 20 }} numberOfLines={2}>{meal.title}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>by {meal.prepper}</Text>
                <Text style={{ fontFamily: Font.display, fontSize: 17, color: ORANGE, marginTop: 2 }}>${meal.price.toFixed(2)}</Text>
              </View>
            </View>
          ) : null}
          {cartCount > 0 ? (
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center' }}>
              {cartCount} item{cartCount !== 1 ? 's' : ''} in your cart
            </Text>
          ) : null}
          <PressableScale
            onPress={onGoToCart}
            accessibilityRole="button"
            accessibilityLabel="View cart"
            style={{ height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>View Cart</Text>
          </PressableScale>
          <PressableScale
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Keep browsing"
            style={{ height: 46, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Keep browsing</Text>
          </PressableScale>
        </MotiView>
      </MotiView>
    </Modal>
  );
}

type SwitchPromptProps = {
  visible: boolean;
  onClose: () => void;
  cartPrepperName: string;
  mealPrepper: string | undefined;
  isPending: boolean;
  onSwitch: () => void;
};

export function MealSwitchPrompt({ visible, onClose, cartPrepperName, mealPrepper, isPending, onSwitch }: SwitchPromptProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: Palette.surface, borderRadius: 22, padding: 22, gap: 10 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={22} color={ORANGE} />
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>Start a new cart?</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 14.5, lineHeight: 21, color: Palette.textSecondary }}>
            Your cart has items from {cartPrepperName}. Each preorder is from one kitchen, so adding {mealPrepper} will clear your current cart.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <PressableScale onPress={() => { feedback.tap(); onClose(); }} accessibilityRole="button" accessibilityLabel="Keep current cart" style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Keep cart</Text>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); onSwitch(); }} disabled={isPending} accessibilityRole="button" accessibilityLabel="Start a new cart" style={{ flex: 1, height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: isPending ? 0.7 : 1 }}>
              {isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>New cart</Text>}
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
