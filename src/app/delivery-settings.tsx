import { useRouter } from 'expo-router';
import { ChevronLeft, Truck } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useDeliverySettings, useMyPrepperApplication, useUpdateDeliverySettings } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function DeliverySettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const { data: settings, isLoading } = useDeliverySettings(prepper?.id);
  const updateSettings = useUpdateDeliverySettings();

  const [delivers, setDelivers] = useState(true);
  const [pickup, setPickup] = useState(true);
  const [fee, setFee] = useState('3.99');
  const [minOrder, setMinOrder] = useState('0');
  const [radius, setRadius] = useState('10');
  const [days, setDays] = useState<number[]>([]);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [city, setCity] = useState('');
  const [kitchenState, setKitchenState] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setDelivers(settings.delivers);
    setPickup(settings.pickup);
    setFee(settings.fee.toFixed(2));
    setMinOrder(settings.minOrder > 0 ? settings.minOrder.toFixed(2) : '');
    setRadius(settings.radius != null ? String(Math.round(settings.radius)) : '10');
    setDays(settings.days ?? []);
    setWindowStart(settings.windowStart ?? '');
    setWindowEnd(settings.windowEnd ?? '');
    setCity(settings.city ?? '');
    setKitchenState(settings.state ?? '');
  }, [settings]);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  }

  async function save() {
    const feeNum = parseFloat(fee);
    if (isNaN(feeNum) || feeNum < 2.99) { setErr('Delivery fee must be at least $2.99'); return; }
    const minNum = parseFloat(minOrder) || 0;
    const radNum = parseFloat(radius) || null;
    setErr(null);
    try {
      await updateSettings.mutateAsync({
        delivers,
        pickup,
        fee: feeNum,
        minOrder: minNum,
        radius: radNum,
        days: days.length ? days : null,
        windowStart: windowStart.trim() || null,
        windowEnd: windowEnd.trim() || null,
        city: city.trim() || null,
        state: kitchenState.trim() || null,
      });
      feedback.success();
      router.back();
    } catch (e) {
      feedback.error();
      setErr(e instanceof Error ? e.message : 'Could not save settings');
    }
  }

  const saving = updateSettings.isPending;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Palette.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={() => { feedback.tap(); router.back(); }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 }}>delivery settings</Text>
          </View>
          <PressableScale onPress={save} disabled={saving} accessibilityRole="button" accessibilityLabel="Save delivery settings"
            style={{ paddingHorizontal: 18, height: 40, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Save</Text>}
          </PressableScale>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}>

          {/* Kitchen location — determines which customers can discover this kitchen */}
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Palette.chip }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary }}>KITCHEN LOCATION</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, marginTop: 3 }}>Customers browse kitchens near their location — set yours so locals can find you.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14 }}>
              <View style={{ flex: 2, gap: 4 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>City</Text>
                <TextInput value={city} onChangeText={setCity}
                  placeholder="Houston" placeholderTextColor={Palette.textSecondary}
                  autoCorrect={false} autoCapitalize="words"
                  accessibilityLabel="Kitchen city"
                  style={{ height: 48, backgroundColor: Palette.canvas, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 12, fontFamily: Font.body, fontSize: 15, color: Palette.ink }} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>State</Text>
                <TextInput value={kitchenState} onChangeText={setKitchenState}
                  placeholder="TX" placeholderTextColor={Palette.textSecondary}
                  autoCorrect={false} autoCapitalize="characters" maxLength={3}
                  accessibilityLabel="Kitchen state"
                  style={{ height: 48, backgroundColor: Palette.canvas, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 12, fontFamily: Font.body, fontSize: 15, color: Palette.ink, textAlign: 'center' }} />
              </View>
            </View>
          </View>

          {/* Fulfillment toggles */}
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Palette.chip }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary }}>FULFILLMENT OPTIONS</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Palette.chip }}>
              <View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.ink }}>I deliver</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>You personally drop off orders</Text>
              </View>
              <Switch value={delivers} onValueChange={(v) => { feedback.tap(); setDelivers(v); }}
                trackColor={{ false: Palette.border, true: Palette.brand }} thumbColor={Palette.surface}
                accessibilityRole="switch" accessibilityLabel="I deliver toggle" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 16 }}>
              <View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.ink }}>Customer pickup</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>Customers collect from you</Text>
              </View>
              <Switch value={pickup} onValueChange={(v) => { feedback.tap(); setPickup(v); }}
                trackColor={{ false: Palette.border, true: Palette.brand }} thumbColor={Palette.surface}
                accessibilityRole="switch" accessibilityLabel="Customer pickup toggle" />
            </View>
          </View>

          {/* Delivery configuration — shown when delivers is on */}
          {delivers ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}
              style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden' }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Palette.chip }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary }}>DELIVERY CONFIGURATION</Text>
              </View>

              {/* Fee */}
              <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Palette.chip, gap: 6 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>Delivery fee <Text style={{ color: Palette.textSecondary }}>(min $2.99)</Text></Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 12, height: 48, gap: 4 }}>
                  <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink }}>$</Text>
                  <TextInput value={fee} onChangeText={(t) => { setFee(t.replace(/[^0-9.]/g, '')); setErr(null); }}
                    keyboardType="decimal-pad" maxLength={5} accessibilityLabel="Delivery fee"
                    style={{ flex: 1, fontFamily: Font.display, fontSize: 18, color: Palette.ink }} />
                </View>
              </View>

              {/* Min order */}
              <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Palette.chip, gap: 6 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>Minimum order <Text style={{ color: Palette.textSecondary }}>(optional)</Text></Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 12, height: 48, gap: 4 }}>
                  <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink }}>$</Text>
                  <TextInput value={minOrder} onChangeText={(t) => setMinOrder(t.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad" maxLength={6} placeholder="0" placeholderTextColor={Palette.textSecondary}
                    accessibilityLabel="Minimum order amount"
                    style={{ flex: 1, fontFamily: Font.display, fontSize: 18, color: Palette.ink }} />
                </View>
              </View>

              {/* Radius */}
              <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Palette.chip, gap: 6 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>Delivery radius</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 12, height: 48, gap: 8 }}>
                  <TextInput value={radius} onChangeText={(t) => setRadius(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad" maxLength={3} placeholder="10" placeholderTextColor={Palette.textSecondary}
                    accessibilityLabel="Delivery radius in kilometers"
                    style={{ flex: 1, fontFamily: Font.display, fontSize: 18, color: Palette.ink }} />
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>km</Text>
                </View>
              </View>

              {/* Available days */}
              <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Palette.chip, gap: 10 }}>
                <View>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>Available days</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, marginTop: 2 }}>Leave all unselected for every day</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {DAY_LABELS.map((label, i) => {
                    const active = days.includes(i);
                    return (
                      <MotiView key={i} animate={{ backgroundColor: active ? Palette.brand : Palette.canvas, borderColor: active ? Palette.brand : Palette.border }}
                        transition={{ type: 'timing', duration: 160 }}
                        style={{ flex: 1, borderWidth: 1.5, borderRadius: 10, overflow: 'hidden' }}>
                        <PressableScale onPress={() => { feedback.tap(); toggleDay(i); }}
                          accessibilityRole="checkbox" accessibilityState={{ checked: active }}
                          accessibilityLabel={`${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]}`}
                          style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: active ? '#fff' : Palette.textSecondary }}>{label}</Text>
                        </PressableScale>
                      </MotiView>
                    );
                  })}
                </View>
              </View>

              {/* Time window */}
              <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}>
                <View>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>Delivery window</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, marginTop: 2 }}>Leave blank for no time restriction</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>From</Text>
                    <TextInput value={windowStart} onChangeText={setWindowStart}
                      placeholder="08:00" placeholderTextColor={Palette.textSecondary} maxLength={5}
                      accessibilityLabel="Delivery window start time"
                      style={{ height: 48, backgroundColor: Palette.canvas, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 12, fontFamily: Font.body, fontSize: 15, color: Palette.ink, textAlign: 'center' }} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>To</Text>
                    <TextInput value={windowEnd} onChangeText={setWindowEnd}
                      placeholder="20:00" placeholderTextColor={Palette.textSecondary} maxLength={5}
                      accessibilityLabel="Delivery window end time"
                      style={{ height: 48, backgroundColor: Palette.canvas, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 12, fontFamily: Font.body, fontSize: 15, color: Palette.ink, textAlign: 'center' }} />
                  </View>
                </View>
              </View>
            </MotiView>
          ) : null}

          {err ? (
            <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger, textAlign: 'center' }}>{err}</Text>
            </MotiView>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: Palette.brandTint, borderRadius: Radius.md }}>
            <Truck size={15} color={Palette.brand} />
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 12.5, color: Palette.brandPressed, lineHeight: 18 }}>
              Delivery fee minimum is $2.99. These settings apply to all future orders.
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
