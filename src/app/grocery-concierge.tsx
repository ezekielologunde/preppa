import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Leaf, Package, ShoppingBag, Sparkles } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type MealKit = {
  id: string;
  name: string;
  cuisine: string;
  flag: string;
  serves: number;
  prepMins: number;
  price: number;
  ingredients: string[];
  color: string;
  tag: string;
};

const KITS: MealKit[] = [
  {
    id: 'k1', name: 'Jollof Rice Kit', cuisine: 'Nigerian', flag: '🇳🇬', serves: 4,
    prepMins: 45, price: 28, color: '#dc2626', tag: 'bestseller',
    ingredients: ['Parboiled rice', 'Tomato paste', 'Red bell pepper', 'Scotch bonnet', 'Bay leaves', 'Chicken stock'],
  },
  {
    id: 'k2', name: 'Pasta Carbonara Kit', cuisine: 'Italian', flag: '🇮🇹', serves: 2,
    prepMins: 25, price: 22, color: '#2563eb', tag: 'quick',
    ingredients: ['Fresh spaghetti', 'Guanciale', 'Pecorino Romano', 'Fresh eggs', 'Black pepper'],
  },
  {
    id: 'k3', name: 'Chicken Tinga Tacos', cuisine: 'Mexican', flag: '🇲🇽', serves: 3,
    prepMins: 35, price: 24, color: '#16a34a', tag: 'family hit',
    ingredients: ['Corn tortillas', 'Chicken thighs', 'Chipotle peppers', 'Tomatoes', 'Onion', 'Cotija cheese'],
  },
  {
    id: 'k4', name: 'Butter Chicken Kit', cuisine: 'Indian', flag: '🇮🇳', serves: 4,
    prepMins: 50, price: 32, color: '#d97706', tag: 'comfort',
    ingredients: ['Chicken breast', 'Butter', 'Heavy cream', 'Tomato purée', 'Garam masala', 'Ginger-garlic paste'],
  },
  {
    id: 'k5', name: 'Ramen Base Kit', cuisine: 'Japanese', flag: '🇯🇵', serves: 2,
    prepMins: 30, price: 26, color: '#7c3aed', tag: 'artisan',
    ingredients: ['Ramen noodles', 'Tare sauce', 'Soft-boiled eggs', 'Nori sheets', 'Chashu pork', 'Green onion'],
  },
  {
    id: 'k6', name: 'Shakshuka Kit', cuisine: 'Mediterranean', flag: '🌊', serves: 2,
    prepMins: 20, price: 18, color: '#0891b2', tag: 'healthy',
    ingredients: ['Crushed tomatoes', 'Free-range eggs', 'Feta cheese', 'Cumin', 'Paprika', 'Pita bread'],
  },
];

const TAG_COLORS: Record<string, string> = {
  bestseller: Palette.amber,
  quick: '#06b6d4',
  'family hit': Palette.success,
  comfort: ORANGE,
  artisan: '#8b5cf6',
  healthy: Palette.success,
};

export default function GroceryConciergeScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }

  function handleOrder(kit: MealKit) {
    feedback.success();
    router.push(`/bid-requests?kit=${encodeURIComponent(kit.name)}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>grocery concierge</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>pre-portioned kits, delivered by preppers</Text>
          </View>
          <ShoppingBag size={20} color={ORANGE} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 32 }}>

          {/* Value prop banner */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
          <View style={{ backgroundColor: INK, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Leaf size={20} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>cook restaurant-quality at home</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2, lineHeight: 18 }}>Pre-portioned ingredients, no waste. Fulfiled by local preppers who know the cuisine.</Text>
            </View>
          </View>
          </MotiView>

          {/* Eco stat row */}
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 60 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { value: '40%', label: 'less food waste vs supermarket' },
              { value: '2×', label: 'cheaper than meal-kit brands' },
              { value: 'same day', label: 'local pickup or delivery' },
            ].map(({ value, label }) => (
              <View key={label} style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 12, padding: 10, alignItems: 'center', gap: 3 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 18, color: ORANGE }}>{value}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10, color: Palette.textSecondary, textAlign: 'center', lineHeight: 14 }}>{label}</Text>
              </View>
            ))}
          </View>
          </MotiView>

          {/* Kit cards */}
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4, marginTop: 4 }}>available kits</Text>
          {KITS.map((kit, i) => {
            const isOpen = selected === kit.id;
            return (
              <MotiView key={kit.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 80 + i * 40 }}>
              <MotiView
                animate={{ borderColor: isOpen ? kit.color : Palette.surface }}
                transition={{ type: 'timing', duration: 200 }}
                style={{ borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' }}>
              <PressableScale
                onPress={() => { feedback.tap(); setSelected(isOpen ? null : kit.id); }}
                accessibilityRole="button"
                accessibilityLabel={`${kit.name}, $${kit.price}, serves ${kit.serves}`}
                style={{ backgroundColor: Palette.surface }}>
                <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 28 }}>{kit.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{kit.name}</Text>
                      <View style={{ backgroundColor: (TAG_COLORS[kit.tag] ?? ORANGE) + '1A', borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: Font.medium, fontSize: 10, color: TAG_COLORS[kit.tag] ?? ORANGE }}>{kit.tag}</Text>
                      </View>
                    </View>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
                      Serves {kit.serves} · {kit.prepMins} min prep · ${kit.price}
                    </Text>
                  </View>
                  <Package size={17} color={isOpen ? kit.color : Palette.textSecondary} />
                </View>

                {isOpen ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                    <View style={{ height: 1, backgroundColor: Palette.divider }} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary }}>included ingredients</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {kit.ingredients.map((ing) => (
                        <View key={ing} style={{ backgroundColor: kit.color + '14', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ fontFamily: Font.medium, fontSize: 12, color: kit.color }}>{ing}</Text>
                        </View>
                      ))}
                    </View>
                    <PressableScale
                      onPress={() => handleOrder(kit)}
                      accessibilityRole="button"
                      accessibilityLabel={`Order ${kit.name} kit`}
                      style={{ backgroundColor: kit.color, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Sparkles size={14} color="#fff" />
                      <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>request this kit · ${kit.price}</Text>
                    </PressableScale>
                  </View>
                ) : null}
              </PressableScale>
              </MotiView>
              </MotiView>
            );
          })}

          {/* Custom request CTA */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 400 }}>
          <PressableScale onPress={() => { feedback.tap(); router.push('/bid-requests'); }} accessibilityRole="button" accessibilityLabel="Request a custom ingredient kit"
            style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: Palette.border }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>custom ingredient kit</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2 }}>Describe what you want to cook and get bids from local preppers</Text>
            </View>
            <ChevronRight size={16} color={Palette.textSecondary} />
          </PressableScale>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
