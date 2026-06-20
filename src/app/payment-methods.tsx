import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, Lock, Plus, Trash2 } from 'lucide-react-native';
import { feedback } from '@/lib/feedback';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AddCardSheet,
  BRAND_CONFIG,
} from '@/components/add-card-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import {
  PaymentMethod,
  useDetachPaymentMethod,
  usePaymentMethods,
  useSetDefaultPaymentMethod,
} from '@/lib/queries/payment-methods';

// ─── Expiry helpers ──────────────────────────────────────────────────────────

function expiryStatus(expMonth: number, expYear: number): 'expired' | 'soon' | null {
  const now = new Date();
  const exp = new Date(expYear, expMonth - 1, 28); // last usable day of month
  if (exp < now) return 'expired';
  const twoMonthsOut = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  if (exp <= twoMonthsOut) return 'soon';
  return null;
}

// ─── Payment card item ────────────────────────────────────────────────────────

function PaymentCard({
  card,
  index,
  pendingDelete,
  onSetDefault,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  card: PaymentMethod;
  index: number;
  pendingDelete: boolean;
  onSetDefault: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const brand = BRAND_CONFIG[card.brand];

  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280, delay: index * 40 }}>
      {pendingDelete ? (
        <View
          style={{
            backgroundColor: Palette.danger + '14',
            borderRadius: Radius.md,
            padding: Spacing.three,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: Palette.danger,
          }}>
          <Text
            style={{ fontFamily: Font.medium, fontSize: Type.body, color: Palette.danger }}>
            remove this card?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PressableScale
              onPress={() => { feedback.tap(); onCancelDelete(); }}
              accessibilityRole="button"
              accessibilityLabel="Cancel remove card"
              style={{
                paddingHorizontal: 14,
                height: 44,
                borderRadius: Radius.pill,
                backgroundColor: Palette.chip,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{ fontFamily: Font.medium, fontSize: Type.label, color: Palette.inkSoft }}>
                cancel
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => { feedback.tap(); onConfirmDelete(); }}
              accessibilityRole="button"
              accessibilityLabel="Confirm remove card"
              style={{
                paddingHorizontal: 14,
                height: 44,
                borderRadius: Radius.pill,
                backgroundColor: Palette.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{
                  fontFamily: Font.medium,
                  fontSize: Type.label,
                  color: Palette.surface,
                }}>
                remove
              </Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <PressableScale
          onPress={card.isDefault ? undefined : () => { feedback.tap(); onSetDefault(); }}
          accessibilityRole="button"
          accessibilityLabel={`${brand.label} card ending ${card.last4}${card.isDefault ? ', default' : ', tap to set as default'}`}
          style={{
            backgroundColor: Palette.surface,
            borderRadius: Radius.md,
            padding: Spacing.three,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.three,
            ...Shadow.card,
          }}>
          {/* Brand chip */}
          <View
            style={{
              width: 56,
              height: 40,
              borderRadius: 10,
              backgroundColor: brand.bg,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
            <Text
              style={{
                fontFamily: Font.heading,
                fontSize: Type.micro,
                color: brand.textColor,
                letterSpacing: 0.5,
              }}>
              {brand.label.toUpperCase()}
            </Text>
          </View>

          {/* Card details */}
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={{ fontFamily: Font.heading, fontSize: Type.body, color: Palette.ink }}>
                {`•••• •••• •••• ${card.last4}`}
              </Text>
              {card.isDefault && (
                <View
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    borderRadius: Radius.pill,
                    backgroundColor: Palette.brandTint,
                  }}>
                  <Text
                    style={{
                      fontFamily: Font.semibold,
                      fontSize: Type.micro,
                      color: Palette.brandPressed,
                    }}>
                    default
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{
                  fontFamily: Font.body,
                  fontSize: Type.label,
                  color: (() => {
                    const s = expiryStatus(card.expMonth, card.expYear);
                    return s === 'expired' ? Palette.danger : s === 'soon' ? Palette.amber : Palette.textSecondary;
                  })(),
                }}>
                Expires {card.expMonth}/{card.expYear}
              </Text>
              {expiryStatus(card.expMonth, card.expYear) === 'expired' && (
                <View style={{ backgroundColor: Palette.danger + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: Palette.danger }}>Expired</Text>
                </View>
              )}
              {expiryStatus(card.expMonth, card.expYear) === 'soon' && (
                <View style={{ backgroundColor: Palette.amber + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: Palette.amber }}>Expiring soon</Text>
                </View>
              )}
            </View>
          </View>

          {/* Delete */}
          <PressableScale
            onPress={() => { feedback.tap(); onDelete(); }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${brand.label} card ending ${card.last4}`}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: Palette.danger + '14',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
            <Trash2 size={16} color={Palette.danger} />
          </PressableScale>
        </PressableScale>
      )}
    </MotiView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = usePaymentMethods();
  const detachPM = useDetachPaymentMethod();
  const setDefaultPM = useSetDefaultPaymentMethod();
  const cards = data?.methods ?? [];
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [mutationErr, setMutationErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [addedToast, setAddedToast] = useState(false);

  function showAddedToast() {
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2500);
  }
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const triggerDelete = (id: string) => {
    setPendingDeleteId(id);
    setTimeout(() => setPendingDeleteId((prev) => (prev === id ? null : prev)), 3000);
  };

  const confirmDelete = (id: string) => {
    setMutationErr(null);
    detachPM.mutate(id, {
      onError: () => { feedback.error(); setMutationErr('Could not remove card. Please try again.'); },
    });
    setPendingDeleteId(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: Spacing.three,
            paddingVertical: Spacing.two,
            gap: 12,
          }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: Palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text
            style={{
              flex: 1,
              fontFamily: Font.display,
              fontSize: 22,
              letterSpacing: -0.5,
              color: Palette.ink,
            }}>
            payment methods
          </Text>
        </View>

        {addedToast ? (
          <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}
            style={{ marginHorizontal: Spacing.three, marginBottom: 4, backgroundColor: '#14532d22', borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: '#4ade8044', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#4ade80' }}>✓ Card added successfully</Text>
          </MotiView>
        ) : null}
        {mutationErr ? (
          <View style={{ marginHorizontal: Spacing.three, marginBottom: 4, backgroundColor: Palette.danger + '14', borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Palette.danger + '40' }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger }}>{mutationErr}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <ListSkeleton count={2} rowHeight={80} />
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={30} color={Palette.textSecondary} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>couldn't load payment methods</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading payment methods"
              style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView
            contentContainerStyle={{
              padding: Spacing.three,
              gap: Spacing.three,
              paddingBottom: 120,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}>

            {/* Card list */}
            {cards.map((card, index) => (
              <PaymentCard
                key={card.id}
                card={card}
                index={index}
                pendingDelete={pendingDeleteId === card.id}
                onSetDefault={() => { setMutationErr(null); setDefaultPM.mutate(card.id, { onSuccess: () => feedback.success(), onError: () => { feedback.error(); setMutationErr('Could not update default card.'); } }); }}
                onDelete={() => triggerDelete(card.id)}
                onConfirmDelete={() => confirmDelete(card.id)}
                onCancelDelete={() => setPendingDeleteId(null)}
              />
            ))}

            {/* Add new card row */}
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 280, delay: cards.length * 40 }}>
              <PressableScale
                onPress={() => { feedback.tap(); setSheetVisible(true); }}
                accessibilityRole="button"
                accessibilityLabel="Add new payment card"
                style={{
                  backgroundColor: Palette.surface,
                  borderRadius: Radius.md,
                  padding: Spacing.three,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.three,
                  borderWidth: 1.5,
                  borderColor: Palette.border,
                  borderStyle: 'dashed',
                  minHeight: 68,
                }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: Palette.brandTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Plus size={20} color={Palette.brand} />
                </View>
                <Text
                  style={{
                    fontFamily: Font.heading,
                    fontSize: Type.body,
                    color: Palette.brand,
                  }}>
                  add new card
                </Text>
              </PressableScale>
            </MotiView>

            {/* Security note at bottom */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: Spacing.two,
              }}>
              <Lock size={13} color={Palette.textSecondary} />
              <Text
                style={{
                  fontFamily: Font.body,
                  fontSize: Type.micro,
                  color: Palette.textSecondary,
                }}>
                Cards are secured with 256-bit encryption
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <AddCardSheet
        visible={sheetVisible}
        isFirstCard={cards.length === 0}
        onClose={() => setSheetVisible(false)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); setSheetVisible(false); showAddedToast(); }}
      />
    </View>
  );
}
