import { MapPin, Plus } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AddressSheet, resolvedLabel, type FormState, type Address } from '@/components/address-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAddresses, useUpsertAddress } from '@/lib/queries/addresses';

function formatAddress(a: Address): string {
  return [a.street1, a.street2, a.city, a.state].filter(Boolean).join(', ');
}

export function DeliveryAddressPicker({
  userId,
  selectedId,
  onSelect,
}: {
  userId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: addresses = [], isLoading } = useAddresses(userId);
  const upsert = useUpsertAddress(userId);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!selectedId && addresses.length > 0) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      onSelect(def.id);
    }
  }, [addresses, selectedId, onSelect]);

  function handleSave(form: FormState) {
    upsert.mutate(
      {
        label: resolvedLabel(form),
        street1: form.street1,
        street2: form.street2 || undefined,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country || 'US',
        isDefault: form.isDefault,
      },
      { onSuccess: () => { setSheetOpen(false); feedback.success(); } },
    );
  }

  if (isLoading) {
    return (
      <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={Palette.brand} />
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {addresses.map((address) => {
        const selected = selectedId === address.id;
        return (
          <MotiView
            key={address.id}
            animate={{ borderColor: selected ? Palette.brand : Palette.border, backgroundColor: selected ? Palette.brandTint : Palette.surface }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ borderWidth: 1.5, borderRadius: Radius.md, overflow: 'hidden' }}>
            <PressableScale
              onPress={() => { feedback.tap(); onSelect(address.id); }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Deliver to ${address.label}: ${formatAddress(address)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: selected ? 0 : 2, borderColor: selected ? 'transparent' : Palette.border, backgroundColor: selected ? Palette.brand : 'transparent', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {selected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.surface }} /> : null}
              </View>
              <MapPin size={14} color={selected ? Palette.brand : Palette.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: selected ? Palette.brandPressed : Palette.ink }}>{address.label}</Text>
                <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>{formatAddress(address)}</Text>
              </View>
            </PressableScale>
          </MotiView>
        );
      })}

      <PressableScale
        onPress={() => { feedback.tap(); setSheetOpen(true); }}
        accessibilityRole="button"
        accessibilityLabel="Add a new delivery address"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Palette.border, paddingHorizontal: 14 }}>
        <Plus size={16} color={Palette.brand} />
        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.brand }}>
          {addresses.length ? 'Add another address' : 'Add a delivery address'}
        </Text>
      </PressableScale>

      <AddressSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onSave={handleSave} />
    </View>
  );
}
