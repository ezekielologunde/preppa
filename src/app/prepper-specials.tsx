import { useRouter } from 'expo-router';
import { ChevronLeft, Clock, Flame, Percent, Plus } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const BG = Palette.canvas;
const S1 = { shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 };

const DISCOUNTS = ['10%', '15%', '20%', 'Custom'];
const WINDOWS = [
  { label: 'Breakfast', sub: '7–10 am' },
  { label: 'Lunch', sub: '12–2 pm' },
  { label: 'Dinner', sub: '6–9 pm' },
];

export default function PrepperSpecialsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application } = useMyPrepperApplication(user?.id);

  const [dishName, setDishName] = useState('');
  const [discount, setDiscount] = useState('15%');
  const [customDiscount, setCustomDiscount] = useState('');
  const [window, setWindow] = useState('Lunch');
  const [note, setNote] = useState('');
  const [publishing, setPublishing] = useState(false);

  const effectiveDiscount = discount === 'Custom' ? (customDiscount ? `${customDiscount}%` : '') : discount;

  async function handlePublish() {
    if (!dishName.trim()) {
      feedback.error();
      Alert.alert('Name required', 'Enter a dish name for your special.');
      return;
    }
    if (!effectiveDiscount) {
      feedback.error();
      Alert.alert('Discount required', 'Enter a discount amount.');
      return;
    }
    if (!application?.id) return;

    setPublishing(true);
    try {
      const windowInfo = WINDOWS.find((w) => w.label === window);
      const caption = `${dishName.trim()} — ${effectiveDiscount} off!${note.trim() ? ` ${note.trim()}` : ''} Available ${windowInfo?.label} window (${windowInfo?.sub}).`;
      const { error } = await supabase.from('feed_posts').insert({
        prepper_id: application.id,
        caption,
        tags: ['Meal prep', 'Quick & easy'],
      });
      if (error) throw error;
      feedback.success();
      Alert.alert('Special posted!', 'Your rush-hour special is now live in the feed.', [
        { text: 'Done', onPress: () => { if (router.canGoBack()) router.back(); else router.replace('/dashboard'); } },
      ]);
    } catch {
      feedback.error();
      Alert.alert('Could not publish', 'Please try again.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }}
            accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.5 }}>rush specials</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}>

          {/* Info banner */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <View style={{ backgroundColor: ORANGE + '12', borderRadius: Radius.lg, padding: 16, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: ORANGE + '30' }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: ORANGE + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={17} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Palette.ink }}>Rush-hour specials</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2, lineHeight: 18 }}>
                  Specials appear at the top of the feed during Breakfast, Lunch and Dinner rush windows. Active specials get 3× more views.
                </Text>
              </View>
            </View>
          </MotiView>

          {/* Form card */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
            <View style={{ backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 18, ...S1 }}>

              {/* Dish name */}
              <View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft, marginBottom: 7 }}>dish name</Text>
                <TextInput
                  value={dishName}
                  onChangeText={setDishName}
                  placeholder="e.g. Jollof Rice, Pepper Chicken…"
                  placeholderTextColor={Palette.textSecondary}
                  maxLength={80}
                  returnKeyType="next"
                  accessibilityLabel="Dish name"
                  style={{ fontFamily: Font.body, fontSize: 15, color: Palette.ink, backgroundColor: Palette.canvas, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Palette.border, minHeight: 44 }}
                />
              </View>

              {/* Discount picker */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Percent size={13} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>discount</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {DISCOUNTS.map((d) => {
                    const on = discount === d;
                    return (
                      <PressableScale key={d} onPress={() => { feedback.tap(); setDiscount(d); }}
                        accessibilityRole="radio" accessibilityState={{ selected: on }}
                        style={{ paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: on ? ORANGE : Palette.canvas, borderWidth: 1.5, borderColor: on ? ORANGE : Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? '#fff' : Palette.ink }}>{d}</Text>
                      </PressableScale>
                    );
                  })}
                </View>
                {discount === 'Custom' ? (
                  <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={customDiscount}
                      onChangeText={(v) => setCustomDiscount(v.replace(/[^0-9]/g, '').slice(0, 2))}
                      placeholder="25"
                      placeholderTextColor={Palette.textSecondary}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={{ fontFamily: Font.body, fontSize: 15, color: Palette.ink, backgroundColor: Palette.canvas, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Palette.border, width: 80 }}
                    />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.ink }}>%</Text>
                  </View>
                ) : null}
              </View>

              {/* Time window */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Clock size={13} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>time window</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {WINDOWS.map(({ label, sub }) => {
                    const on = window === label;
                    return (
                      <PressableScale key={label} onPress={() => { feedback.tap(); setWindow(label); }}
                        accessibilityRole="radio" accessibilityState={{ selected: on }}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: on ? ORANGE + '14' : Palette.canvas, borderWidth: 1.5, borderColor: on ? ORANGE : Palette.border, alignItems: 'center', gap: 2 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: on ? ORANGE : Palette.ink }}>{label}</Text>
                        <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary }}>{sub}</Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>

              {/* Note */}
              <View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft, marginBottom: 7 }}>note (optional)</Text>
                <TextInput
                  value={note}
                  onChangeText={(v) => setNote(v.slice(0, 120))}
                  placeholder="What makes it special? Fresh-caught, family recipe…"
                  placeholderTextColor={Palette.textSecondary}
                  multiline
                  numberOfLines={2}
                  maxLength={120}
                  style={{ fontFamily: Font.body, fontSize: 14, color: Palette.ink, backgroundColor: Palette.canvas, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Palette.border, minHeight: 72, textAlignVertical: 'top' }}
                />
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, textAlign: 'right', marginTop: 3 }}>{note.length}/120</Text>
              </View>
            </View>
          </MotiView>

          {/* Preview */}
          {dishName.trim() && effectiveDiscount ? (
            <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 240 }}>
              <View style={{ backgroundColor: Palette.surface, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: ORANGE + '40', ...S1 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 11, color: ORANGE, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>preview</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>{effectiveDiscount} off</Text>
                  </View>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink, flex: 1 }}>{dishName.trim()}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <Clock size={12} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
                    {WINDOWS.find((w) => w.label === window)?.label} · {WINDOWS.find((w) => w.label === window)?.sub}
                  </Text>
                </View>
              </View>
            </MotiView>
          ) : null}

          {/* CTA */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
            <PressableScale
              onPress={handlePublish}
              disabled={publishing || !dishName.trim() || !effectiveDiscount}
              accessibilityRole="button" accessibilityLabel="Publish special"
              style={{ height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
                opacity: publishing || !dishName.trim() || !effectiveDiscount ? 0.5 : 1 }}>
              {publishing
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Plus size={18} color="#fff" />
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Publish special →</Text>
                  </>}
            </PressableScale>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
