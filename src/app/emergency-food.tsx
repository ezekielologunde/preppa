import { useRouter } from 'expo-router';
import { AlertCircle, ChevronLeft, ChevronRight, Clock, MapPin, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { useAddresses } from '@/lib/queries/addresses';
import { useCreateEmergencyRequest } from '@/lib/queries/emergency-requests';
import { useTopPreppers } from '@/lib/queries/preppers';
import { Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

const URGENCY_OPTIONS = [
  { label: '30 min', sub: 'I need food now', mins: 30, color: Palette.danger },
  { label: '1 hour', sub: 'Pretty urgent', mins: 60, color: ORANGE },
  { label: '2 hours', sub: 'Flexible but soon', mins: 120, color: Palette.amber },
];

const CUISINE_QUICK = ['anything', 'Nigerian', 'Italian', 'Mexican', 'Asian', 'Healthy', 'Comfort'];

export default function EmergencyFoodScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: addresses } = useAddresses(user?.id);
  const { data: preppers } = useTopPreppers();
  const [urgencyIdx, setUrgencyIdx] = useState(0);
  const [cuisine, setCuisine] = useState('anything');
  const [notes, setNotes] = useState('');
  const [sent, setSent] = useState(false);

  const defaultAddr = addresses?.find((a) => a.isDefault) ?? addresses?.[0];
  const urgency = URGENCY_OPTIONS[urgencyIdx];
  // TopPrepper carries no availability flag; show the top kitchens as-is.
  const availablePreppers = (preppers ?? []).slice(0, 5);

  const sendRequest = useCreateEmergencyRequest();

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }

  async function handleSend() {
    if (!user?.id) return;
    const addressLine = defaultAddr
      ? [defaultAddr.street1, defaultAddr.city, defaultAddr.state].filter(Boolean).join(', ')
      : null;
    try {
      await sendRequest.mutateAsync({
        cuisine,
        notes,
        urgencyMins: urgency.mins,
        addressLine,
      });
      feedback.success();
      setSent(true);
    } catch {
      feedback.error();
      Alert.alert('Could not send', 'Your request failed to send. Please try again.');
    }
  }

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
          </View>
          <MotiView from={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 300 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={32} color="#fff" />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6, textAlign: 'center' }}>request sent</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 21 }}>
              Nearby preppers have been notified. You'll hear back within minutes. Check your messages.
            </Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/messages?tab=messages'); }} accessibilityRole="button" accessibilityLabel="Go to messages" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 13 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>open messages</Text>
              <ChevronRight size={16} color="#fff" />
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>emergency food</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>notify nearby preppers instantly</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.danger + '1A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
            <AlertCircle size={12} color={Palette.danger} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.danger }}>urgent</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 32 }}>

          {/* Urgency selector */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textSecondary, marginBottom: 10 }}>how urgent?</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {URGENCY_OPTIONS.map((u, i) => {
              const sel = urgencyIdx === i;
              return (
                <MotiView
                  key={u.label}
                  animate={{ backgroundColor: sel ? u.color : Palette.surface, borderColor: sel ? u.color : Palette.border }}
                  transition={{ type: 'timing', duration: 180 }}
                  style={{ flex: 1, borderRadius: 14, borderWidth: 1, overflow: 'hidden' }}>
                  <PressableScale onPress={() => { feedback.tap(); setUrgencyIdx(i); }} accessibilityRole="button" accessibilityLabel={`${u.label} urgency`}
                    style={{ padding: 12, alignItems: 'center', gap: 4 }}>
                    <Clock size={17} color={sel ? '#fff' : u.color} />
                    <Text style={{ fontFamily: Font.heading, fontSize: 14, color: sel ? '#fff' : INK }}>{u.label}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 11, color: sel ? 'rgba(255,255,255,0.8)' : Palette.textMuted, textAlign: 'center' }}>{u.sub}</Text>
                  </PressableScale>
                </MotiView>
              );
            })}
          </View>
          </MotiView>

          {/* Cuisine preference */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textSecondary, marginBottom: 10 }}>cuisine preference</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CUISINE_QUICK.map((c) => {
              const sel = cuisine === c;
              return (
                <MotiView
                  key={c}
                  animate={{ backgroundColor: sel ? ORANGE : Palette.surface, borderColor: sel ? ORANGE : Palette.border }}
                  transition={{ type: 'timing', duration: 180 }}
                  style={{ borderRadius: Radius.pill, borderWidth: 1, overflow: 'hidden' }}>
                  <PressableScale onPress={() => { feedback.tap(); setCuisine(c); }} accessibilityRole="button" accessibilityLabel={`${c} cuisine`}
                    style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: sel ? '#fff' : INK }}>{c}</Text>
                  </PressableScale>
                </MotiView>
              );
            })}
          </View>
          </MotiView>

          {/* Delivery location */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textSecondary, marginBottom: 10 }}>delivery to</Text>
          <PressableScale onPress={() => { feedback.tap(); router.push('/addresses'); }} accessibilityRole="button" accessibilityLabel="Change delivery address"
            style={{ backgroundColor: Palette.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Palette.border }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={16} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              {defaultAddr ? (
                <>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }} numberOfLines={1}>{defaultAddr.label ?? 'Home'}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }} numberOfLines={1}>{defaultAddr.street1}</Text>
                </>
              ) : (
                <Text style={{ fontFamily: Font.medium, fontSize: 14, color: ORANGE }}>Add a delivery address</Text>
              )}
            </View>
            <ChevronRight size={16} color={Palette.textMuted} />
          </PressableScale>
          </MotiView>

          {/* Notes */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textSecondary, marginBottom: 10 }}>special instructions</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="E.g. no nuts, vegetarian, extra spicy…"
            placeholderTextColor={Palette.textMuted}
            multiline
            numberOfLines={3}
            maxLength={300}
            accessibilityLabel="Special instructions"
            style={{ fontFamily: Font.body, fontSize: 14, color: INK, backgroundColor: Palette.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Palette.border, minHeight: 80, textAlignVertical: 'top' }}
          />
          </MotiView>

          {/* Available preppers preview */}
          {availablePreppers.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 180 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textSecondary, marginBottom: 10 }}>
              {availablePreppers.length} kitchen{availablePreppers.length !== 1 ? 's' : ''} nearby
            </Text>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden' }}>
              {availablePreppers.slice(0, 3).map((p, i) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.success }} />
                  <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13.5, color: INK }}>{p.name}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>★ {p.rating.toFixed(1)}</Text>
                </View>
              ))}
            </View>
            </MotiView>
          ) : null}

          {/* CTA */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 220 }}>
          <PressableScale
            onPress={handleSend}
            disabled={sendRequest.isPending}
            accessibilityRole="button"
            accessibilityLabel="Send emergency food request"
            style={{ height: 56, borderRadius: Radius.sm, backgroundColor: urgency.color, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, opacity: sendRequest.isPending ? 0.7 : 1 }}>
            {sendRequest.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Zap size={18} color="#fff" />
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>notify preppers · {urgency.label}</Text>
              </>
            )}
          </PressableScale>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, textAlign: 'center', marginTop: 8 }}>
            Preppers in your area will see your request and respond via messages.
          </Text>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
