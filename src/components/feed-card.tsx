import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BadgeCheck, CheckCircle, Crown, Heart, Play, Share2, ShoppingCart, Star, UserCheck, UserPlus, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Share, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { toggleFavorite, useFavorite } from '@/lib/favorites';
import { feedback } from '@/lib/feedback';
import { useAddToCart, useCart } from '@/lib/queries/cart';
import type { FeedItem } from '@/lib/queries/feed';
import { useToggleFollow } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORANGE = Palette.brand;

function ActionBtn({
  icon: Icon,
  label,
  caption,
  active,
  color = '#fff',
  onPress,
}: {
  icon: typeof Heart;
  label: string;
  caption?: string;
  active?: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 5 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={21} color={active ? Palette.danger : color} fill={active ? Palette.danger : 'transparent'} />
      </View>
      {caption ? (
        <Text style={{ fontFamily: Font.medium, fontSize: 11, color: 'rgba(255,255,255,0.88)', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
          {caption}
        </Text>
      ) : null}
    </PressableScale>
  );
}

function FollowBtn({ prepperId, followSet }: { prepperId: string; followSet: Set<string> }) {
  const { user } = useAuth();
  const toggle = useToggleFollow(prepperId, user?.id);
  const following = followSet.has(prepperId);
  function handlePress() {
    feedback.tap();
    toggle.mutate(following, { onSuccess: () => feedback.success(), onError: () => feedback.error() });
  }
  return (
    <ActionBtn
      icon={following ? UserCheck : UserPlus}
      label={following ? 'Unfollow kitchen' : 'Follow kitchen'}
      caption={following ? 'following' : 'follow'}
      active={false}
      color={following ? ORANGE : '#fff'}
      onPress={handlePress}
    />
  );
}

function computeCountdown(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMins = Math.floor(ms / 60_000);
  if (totalMins > 60 * 24 * 7) return null;
  if (totalMins > 60 * 24) {
    const days = Math.floor(totalMins / (60 * 24));
    const hrs = Math.floor((totalMins % (60 * 24)) / 60);
    return `${days}d ${hrs}h left`;
  }
  if (totalMins > 60) {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}h ${mins}m left`;
  }
  return `${totalMins}m left`;
}

function urgencyColor(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms < 3_600_000) return Palette.danger;
  if (ms < 86_400_000) return Palette.brand;
  return '#8b5cf6';
}

function useCountdownLabel(expiresAt?: string | null): string | null {
  const [label, setLabel] = useState<string | null>(() => computeCountdown(expiresAt));
  useEffect(() => {
    setLabel(computeCountdown(expiresAt));
    if (!expiresAt) return;
    const id = setInterval(() => setLabel(computeCountdown(expiresAt)), 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return label;
}

export function FeedCard({ item, height, bottomInset, followSet }: { item: FeedItem; height: number; bottomInset: number; followSet: Set<string> }) {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isSaved = useFavorite(`meal:${item.id}`);
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [showMultiChefSheet, setShowMultiChefSheet] = useState(false);
  const addToCart = useAddToCart();
  const { data: cart } = useCart(user?.id);
  const source = item.thumbnail ?? item.image;
  const countdown = useCountdownLabel(item.isLimited && !item.isPost ? (item.expiresAt ?? null) : null);
  const anchorPrepperId = cart?.items[0]?.prepperId ?? null;
  const anchorKitchenName = cart?.items[0]?.prepper ?? null;

  async function doAddToCart() {
    setAddState('adding');
    try {
      await addToCart.mutateAsync({ userId: user!.id, mealId: item.id, price: item.price });
      feedback.success();
      setAddState('added');
      setTimeout(() => setAddState('idle'), 1800);
    } catch {
      feedback.error();
      setAddState('error');
      setTimeout(() => setAddState('idle'), 1800);
    }
  }

  function handleAddToCart() {
    if (!user) { feedback.tap(); router.push('/auth?mode=signup'); return; }
    const cartHasItems = (cart?.items.length ?? 0) > 0;
    const differentKitchen = item.prepper_id && anchorPrepperId && item.prepper_id !== anchorPrepperId;
    if (cartHasItems && differentKitchen) { feedback.tap(); setShowMultiChefSheet(true); return; }
    feedback.tap();
    void doAddToCart();
  }

  async function handleShare() {
    feedback.tap();
    try {
      const msg = item.isPost
        ? `${item.prepper} on Preppa: "${item.title}"`
        : `Try "${item.title}" by ${item.prepper} — $${item.price.toFixed(2)} on Preppa`;
      await Share.share({ message: msg });
    } catch {}
  }

  function handleSave() {
    feedback.tap();
    toggleFavorite(`meal:${item.id}`);
  }

  function goToPrepper() {
    feedback.tap();
    if (item.prepper_id) router.push(`/prepper?id=${item.prepper_id}`);
  }

  return (
    <View style={{ height, width: '100%', backgroundColor: '#000' }}>
      {source ? (
        <Image source={source} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} />
      ) : null}

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.84)']}
        locations={[0, 0.42, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {item.videoUrl ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={28} color="#fff" fill="#fff" />
          </View>
        </View>
      ) : null}
      {countdown && item.expiresAt ? (
        <View
          style={{ position: 'absolute', top: 56, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: urgencyColor(item.expiresAt) + 'DD', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}
          pointerEvents="none">
          <Zap size={11} color="#fff" fill="#fff" />
          <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff' }}>{countdown}</Text>
        </View>
      ) : null}

      <View style={{ position: 'absolute', right: 14, bottom: item.isPost ? bottomInset + 56 : bottomInset + 96, gap: 16, alignItems: 'center' }}>
        <ActionBtn icon={Heart} label={isSaved ? 'Unsave' : 'Save meal'} caption={isSaved ? 'saved' : 'save'} active={isSaved} onPress={handleSave} />
        {item.prepper_id ? <FollowBtn prepperId={item.prepper_id} followSet={followSet} /> : null}
        <ActionBtn icon={Share2} label="Share" caption="share" onPress={handleShare} />
      </View>


      <View style={{ position: 'absolute', left: 16, right: 80, bottom: item.isPost ? bottomInset + 16 : bottomInset + 88, gap: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <PressableScale onPress={goToPrepper} accessibilityRole="button" accessibilityLabel={`View ${item.prepper}'s kitchen`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: 'rgba(255,255,255,0.95)' }}>{item.prepper}</Text>
            {item.verified ? <BadgeCheck size={14} color="#fff" fill={ORANGE} stroke="#fff" /> : null}
            {item.isPro ? (
              <View accessibilityLabel="Pro kitchen" accessibilityRole="image" style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Palette.amber + '18', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Crown size={11} color={Palette.amber} fill={Palette.amber} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: Palette.amber }}>pro</Text>
              </View>
            ) : null}
          </PressableScale>
          {!item.isPost && item.rating > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 2 }}>
              <Star size={11} color={Palette.amber} fill={Palette.amber} />
              <Text style={{ fontFamily: Font.medium, fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>{item.rating.toFixed(1)}</Text>
              {item.reviews > 0 ? (
                <Text style={{ fontFamily: Font.medium, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>({item.reviews})</Text>
              ) : null}
            </View>
          ) : null}
          {item.isPost ? (
            <View style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 11, color: '#fff' }}>post</Text>
            </View>
          ) : null}
        </View>

        {item.title ? (
          <Text
            numberOfLines={3}
            style={{
              fontFamily: item.isPost ? Font.body : Font.display,
              fontSize: item.isPost ? 15 : 26,
              color: '#fff',
              letterSpacing: item.isPost ? 0 : -0.5,
              lineHeight: item.isPost ? 22 : 30,
            }}>
            {item.title}
          </Text>
        ) : null}

        {item.isPost ? (
          <PressableScale
            onPress={goToPrepper}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.prepper}'s kitchen`}
            style={{ alignSelf: 'flex-start', height: 42, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>View kitchen</Text>
          </PressableScale>
        ) : (
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', fontVariant: ['tabular-nums'], letterSpacing: -0.4 }}>
            ${item.price.toFixed(2)}
          </Text>
        )}
      </View>

      {/* Add-to-cart FAB — bottom-right, outside video/scroll tap zone */}
      {!item.isPost ? (
        <MotiView
          animate={{ scale: addState === 'adding' ? 0.92 : 1, backgroundColor: addState === 'added' ? Palette.success : addState === 'error' ? Palette.danger : Palette.brand }}
          transition={{ type: 'spring', damping: 14, stiffness: 280 }}
          style={{ position: 'absolute', right: 14, bottom: bottomInset + 16, width: 44, height: 44, borderRadius: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4 }}>
          <PressableScale
            onPress={handleAddToCart}
            disabled={addState === 'adding'}
            accessibilityRole="button"
            accessibilityLabel={addState === 'added' ? 'Added to cart' : `Add ${item.title} to cart`}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }}>
            {addState === 'adding'
              ? <ActivityIndicator size="small" color="#fff" />
              : addState === 'added'
              ? <CheckCircle size={20} color="#fff" />
              : <ShoppingCart size={20} color="#fff" />}
          </PressableScale>
        </MotiView>
      ) : null}

      {/* Multi-chef disclosure sheet */}
      <Modal visible={showMultiChefSheet} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={() => setShowMultiChefSheet(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Palette.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.3, marginBottom: 8 }}>Adding from a different kitchen</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: Palette.textSecondary, lineHeight: 22, marginBottom: 24 }}>
              Your cart has items from {anchorKitchenName}. Adding from {item.prepper} will create a separate preorder — each kitchen fulfils and prices independently.
            </Text>
            <PressableScale
              onPress={() => { setShowMultiChefSheet(false); void doAddToCart(); }}
              accessibilityRole="button"
              accessibilityLabel={`Add from ${item.prepper}`}
              style={{ height: 52, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 15.5, color: '#fff' }}>Add from {item.prepper}</Text>
            </PressableScale>
            <PressableScale
              onPress={() => setShowMultiChefSheet(false)}
              accessibilityRole="button"
              accessibilityLabel="Keep current cart"
              style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Keep my current cart</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </View>
  );
}
