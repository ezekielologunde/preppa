import { useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Pencil, Plus, Trash2 } from 'lucide-react-native';
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
  Address,
  AddressSheet,
  FormState,
  resolvedLabel,
} from '@/components/address-sheet';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAddresses, useDeleteAddress, useSetDefaultAddress, useUpsertAddress } from '@/lib/queries/addresses';
import { useAuth } from '@/providers/auth-provider';

// ─── Address Card ─────────────────────────────────────────────────────────────

function AddressCard({
  address,
  index,
  pendingDelete,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onSetDefault,
}: {
  address: Address;
  index: number;
  pendingDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: index * 40 }}>
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
            delete this address?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PressableScale
              onPress={() => { feedback.tap(); onCancelDelete(); }}
              accessibilityRole="button"
              accessibilityLabel="Cancel delete"
              style={{
                paddingHorizontal: 16,
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
              accessibilityLabel="Confirm delete address"
              style={{
                paddingHorizontal: 16,
                height: 44,
                borderRadius: Radius.pill,
                backgroundColor: Palette.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{ fontFamily: Font.medium, fontSize: Type.label, color: Palette.surface }}>
                delete
              </Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <PressableScale
          onPress={address.isDefault ? undefined : () => { feedback.tap(); onSetDefault(); }}
          accessibilityRole="button"
          accessibilityLabel={`${address.label} address${address.isDefault ? ', default' : ', tap to set as default'}`}
          style={{
            backgroundColor: Palette.surface,
            borderRadius: Radius.md,
            padding: Spacing.three,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.three,
            ...Shadow.card,
          }}>
          {/* Icon chip */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: Palette.brandTint,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
            <MapPin size={20} color={Palette.brand} />
          </View>

          {/* Content */}
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={{ fontFamily: Font.heading, fontSize: Type.body, color: Palette.ink }}>
                {address.label}
              </Text>
              {address.isDefault && (
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
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: Type.label,
                color: Palette.textSecondary,
              }}
              numberOfLines={2}>
              {address.street1}
              {address.street2 ? `, ${address.street2}` : ''}
              {'\n'}
              {address.city}, {address.state} {address.postalCode}
            </Text>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 4, flexShrink: 0 }}>
            <PressableScale
              onPress={() => { feedback.tap(); onEdit(); }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${address.label} address`}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: Palette.chip,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Pencil size={16} color={Palette.textSecondary} />
            </PressableScale>
            <PressableScale
              onPress={() => { feedback.tap(); onDelete(); }}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${address.label} address`}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: Palette.danger + '14',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Trash2 size={16} color={Palette.danger} />
            </PressableScale>
          </View>
        </PressableScale>
      )}
    </MotiView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddressesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: addresses = [], isLoading, isError, refetch } = useAddresses(user?.id);
  const upsertAddress = useUpsertAddress(user?.id);
  const deleteAddress = useDeleteAddress(user?.id);
  const setDefaultAddress = useSetDefaultAddress(user?.id);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<Address | undefined>(undefined);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mutationErr, setMutationErr] = useState<string | null>(null);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const triggerDelete = (id: string) => {
    setPendingDeleteId(id);
    setTimeout(() => setPendingDeleteId((prev) => (prev === id ? null : prev)), 3000);
  };

  const confirmDelete = (id: string) => {
    setMutationErr(null);
    deleteAddress.mutate(id, {
      onSuccess: () => feedback.success(),
      onError: () => { feedback.error(); setMutationErr('Could not delete address. Please try again.'); },
    });
    setPendingDeleteId(null);
  };

  const openAdd = () => { setEditing(undefined); setSheetVisible(true); };
  const openEdit = (address: Address) => { setEditing(address); setSheetVisible(true); };

  const handleSave = (form: FormState) => {
    const label = resolvedLabel(form);
    setMutationErr(null);
    upsertAddress.mutate(
      { ...form, label, id: editing?.id },
      {
        onSuccess: () => { feedback.success(); setSheetVisible(false); },
        onError: () => { feedback.error(); setSheetVisible(false); setMutationErr('Could not save address. Please try again.'); },
      },
    );
  };

  const setDefault = (id: string) => {
    setMutationErr(null);
    setDefaultAddress.mutate({ id, allIds: addresses.map((a) => a.id) }, {
      onSuccess: () => feedback.success(),
      onError: () => { feedback.error(); setMutationErr('Could not update default address.'); },
    });
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
              width: 40,
              height: 40,
              borderRadius: 20,
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
            addresses
          </Text>
          <PressableScale
            onPress={() => { feedback.tap(); openAdd(); }}
            accessibilityRole="button"
            accessibilityLabel="Add new address"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: Palette.brand,
              alignItems: 'center',
              justifyContent: 'center',
              ...Shadow.card,
            }}>
            <Plus size={20} color={Palette.surface} />
          </PressableScale>
        </View>

        {mutationErr ? (
          <View style={{ marginHorizontal: Spacing.three, marginTop: 4, backgroundColor: Palette.danger + '14', borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Palette.danger + '40' }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger }}>{mutationErr}</Text>
          </View>
        ) : null}

        {/* Content */}
        {isLoading ? (
          <ListSkeleton count={3} />
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.danger + '14', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={28} color={Palette.danger} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>couldn't load addresses</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading addresses"
              style={{ marginTop: 6, backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : addresses.length === 0 ? (
          /* Empty state */
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 300 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: Palette.chip,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: Spacing.three,
              }}>
              <MapPin size={36} color={Palette.textMuted} />
            </View>
            <Text
              style={{
                fontFamily: Font.heading,
                fontSize: Type.title,
                color: Palette.ink,
                marginBottom: 8,
                textAlign: 'center',
              }}>
              no addresses yet
            </Text>
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: Type.body,
                color: Palette.textSecondary,
                textAlign: 'center',
                marginBottom: Spacing.four,
              }}>
              save your delivery spots so checkout is a breeze.
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); openAdd(); }}
              accessibilityRole="button"
              accessibilityLabel="Add your first address"
              style={{
                backgroundColor: Palette.brand,
                borderRadius: Radius.pill,
                paddingHorizontal: Spacing.four,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                minHeight: 48,
              }}>
              <Plus size={18} color={Palette.surface} />
              <Text
                style={{
                  fontFamily: Font.heading,
                  fontSize: Type.body,
                  color: Palette.surface,
                }}>
                add your first address
              </Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
            contentContainerStyle={{
              padding: Spacing.three,
              gap: Spacing.three,
              paddingBottom: 120,
            }}
            showsVerticalScrollIndicator={false}>
            {addresses.map((address, index) => (
              <AddressCard
                key={address.id}
                address={address}
                index={index}
                pendingDelete={pendingDeleteId === address.id}
                onEdit={() => openEdit(address)}
                onDelete={() => triggerDelete(address.id)}
                onConfirmDelete={() => confirmDelete(address.id)}
                onCancelDelete={() => setPendingDeleteId(null)}
                onSetDefault={() => setDefault(address.id)}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      <AddressSheet
        visible={sheetVisible}
        initial={editing}
        onClose={() => setSheetVisible(false)}
        onSave={handleSave}
      />
    </View>
  );
}
