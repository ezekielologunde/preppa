import { ChefHat, QrCode, X } from 'lucide-react-native';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { HC, HC_TINT, CARD, ORANGE, money } from '@/components/prepper-order-card';
import type { OrderSummary } from '@/lib/queries/orders';
import type { HomeCookRequest } from '@/lib/queries/home-cook';

// ── Decline confirmation modal ──────────────────────────────────────────────
export interface DeclineModalProps {
  order: OrderSummary | null;
  onDecline: (order: OrderSummary) => void;
  onClose: () => void;
}

export function DeclineModal({ order, onDecline, onClose }: DeclineModalProps) {
  return (
    <Modal visible={!!order} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Keep the preorder"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ width: '100%', maxWidth: 360, backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: '#7f1d1d', alignItems: 'center', justifyContent: 'center' }}>
            <X size={24} color="#fca5a5" strokeWidth={2.6} />
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>Decline this preorder?</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textMuted, lineHeight: 19 }}>
            {order ? `${order.customer}'s preorder (${money(order.total)}) will be cancelled and the customer refunded automatically.` : ''}
          </Text>
          <PressableScale
            onPress={() => { feedback.tap(); if (order) onDecline(order); }}
            accessibilityRole="button"
            accessibilityLabel="Yes, decline the preorder"
            style={{ height: 50, borderRadius: 14, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Yes, decline</Text>
          </PressableScale>
          <PressableScale
            onPress={() => { feedback.tap(); onClose(); }}
            accessibilityRole="button"
            accessibilityLabel="Keep the preorder"
            style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textMuted }}>Keep the preorder</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Verify handoff modal ────────────────────────────────────────────────────
export interface VerifyHandoffModalProps {
  order: OrderSummary | null;
  pin: string;
  setPin: (v: string) => void;
  verifyMsg: string | null;
  setVerifyMsg: (v: string | null) => void;
  isPending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export function VerifyHandoffModal({ order, pin, setPin, verifyMsg, setVerifyMsg, isPending, onSubmit, onClose }: VerifyHandoffModalProps) {
  return (
    <Modal visible={!!order} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ width: '100%', maxWidth: 360, backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: ORANGE + '26', alignItems: 'center', justifyContent: 'center' }}>
              <QrCode size={22} color={ORANGE} />
            </View>
            <PressableScale
              onPress={() => { feedback.tap(); onClose(); }}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#252a34', alignItems: 'center', justifyContent: 'center' }}>
              <X size={17} color={Palette.textMuted} />
            </PressableScale>
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>Verify the handoff</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textMuted, lineHeight: 19 }}>
            Ask {order?.customer ?? 'the customer'} for their 3-digit code, or scan their QR with your camera.
          </Text>
          <TextInput
            value={pin}
            onChangeText={(t) => { setPin(t.replace(/\D/g, '').slice(0, 3)); setVerifyMsg(null); }}
            placeholder="•••"
            placeholderTextColor={Palette.textMuted}
            keyboardType="number-pad"
            maxLength={3}
            autoFocus
            accessibilityLabel="Enter 3-digit pickup code"
            style={{ height: 64, borderRadius: 16, backgroundColor: '#1d2129', textAlign: 'center', fontSize: 30, letterSpacing: 16, fontFamily: Font.display, color: '#fff' }}
          />
          {verifyMsg ? <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#fca5a5', textAlign: 'center' }}>{verifyMsg}</Text> : null}
          <PressableScale
            onPress={() => { feedback.tap(); onSubmit(); }}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel="Confirm handoff"
            style={{ height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Confirm & complete</Text>}
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Propose terms modal (home cook jobs) ────────────────────────────────────
export interface ProposeTermsModalProps {
  target: HomeCookRequest | null;
  cookingFee: string;
  setCookingFee: (v: string) => void;
  travelFee: string;
  setTravelFee: (v: string) => void;
  termsErr: string | null;
  isPending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export function ProposeTermsModal({ target, cookingFee, setCookingFee, travelFee, setTravelFee, termsErr, isPending, onSubmit, onClose }: ProposeTermsModalProps) {
  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ width: '100%', maxWidth: 360, backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: HC + '26', alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={20} color={HC_TINT} />
            </View>
            <PressableScale
              onPress={() => { feedback.tap(); onClose(); }}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#252a34', alignItems: 'center', justifyContent: 'center' }}>
              <X size={17} color={Palette.textMuted} />
            </PressableScale>
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>Propose your terms</Text>
          {target ? (
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, lineHeight: 18 }}>
              {target.guestCount} guests · {target.requestedDate} · ingredient budget ${target.ingredientBudget}
            </Text>
          ) : null}
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Your cooking fee ($)</Text>
            <TextInput
              value={cookingFee}
              onChangeText={setCookingFee}
              placeholder="e.g. 120"
              placeholderTextColor={Palette.textMuted}
              keyboardType="numeric"
              maxLength={7}
              style={{ height: 50, borderRadius: 13, backgroundColor: '#1d2129', paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: '#fff' }}
              accessibilityLabel="Cooking fee"
            />
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>
              Travel / ingredients transport ($){' '}
              <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>optional</Text>
            </Text>
            <TextInput
              value={travelFee}
              onChangeText={setTravelFee}
              placeholder="e.g. 15"
              placeholderTextColor={Palette.textMuted}
              keyboardType="numeric"
              maxLength={7}
              style={{ height: 50, borderRadius: 13, backgroundColor: '#1d2129', paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: '#fff' }}
              accessibilityLabel="Travel or transport fee"
            />
          </View>
          {target && cookingFee ? (
            <View style={{ backgroundColor: HC + '22', borderRadius: 11, padding: 10, gap: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: HC_TINT }}>Customer pays total</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>
                  ${target.ingredientBudget + (parseFloat(cookingFee) || 0) + (parseFloat(travelFee) || 0)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: HC_TINT }}>You receive (cooking fee)</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: HC_TINT }}>${parseFloat(cookingFee) || 0}</Text>
              </View>
            </View>
          ) : null}
          {termsErr ? <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#fca5a5' }}>{termsErr}</Text> : null}
          <PressableScale
            onPress={onSubmit}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel="Send proposal to customer"
            style={{ height: 52, borderRadius: Radius.pill, backgroundColor: HC, alignItems: 'center', justifyContent: 'center', opacity: isPending ? 0.7 : 1 }}>
            {isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Send proposal to customer</Text>}
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
