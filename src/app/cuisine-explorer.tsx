import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Globe } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type CultureEntry = {
  id: string;
  flag: string;
  name: string;
  region: string;
  color: string;
  story: string;
  dishes: string[];
  image: string;
};

const CULTURES: CultureEntry[] = [
  {
    id: 'nigerian',
    flag: '🇳🇬',
    name: 'Nigerian',
    region: 'West Africa',
    color: Palette.success,
    story: 'One of Africa\'s richest culinary traditions, shaped by 250+ ethnic groups. Jollof rice, suya, and egusi soup have become global icons.',
    dishes: ['Jollof Rice', 'Egusi Soup', 'Pounded Yam'],
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80',
  },
  {
    id: 'mexican',
    flag: '🇲🇽',
    name: 'Mexican',
    region: 'North America',
    color: '#dc2626',
    story: 'A UNESCO-recognized culinary heritage fusing indigenous Mesoamerican and Spanish colonial traditions. Corn, chilli, and cacao are at the heart of every dish.',
    dishes: ['Tacos al Pastor', 'Mole Oaxaqueño', 'Enchiladas'],
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80',
  },
  {
    id: 'italian',
    flag: '🇮🇹',
    name: 'Italian',
    region: 'Southern Europe',
    color: '#2563eb',
    story: 'Regional and hyper-seasonal — Sicilian, Roman, and Neapolitan kitchens barely resemble each other. Fresh pasta, olive oil, and simplicity define the craft.',
    dishes: ['Cacio e Pepe', 'Risotto Milanese', 'Tiramisu'],
    image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80',
  },
  {
    id: 'indian',
    flag: '🇮🇳',
    name: 'Indian',
    region: 'South Asia',
    color: '#d97706',
    story: 'A spice-driven civilization of cooking — thousands of sub-cuisines across 28 states. The spice trade literally changed the world because of Indian culinary tradition.',
    dishes: ['Biryani', 'Butter Chicken', 'Masala Dosa'],
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=80',
  },
  {
    id: 'mediterranean',
    flag: '🌊',
    name: 'Mediterranean',
    region: 'Multi-regional',
    color: '#0891b2',
    story: 'The original health diet. Greek, Turkish, and Lebanese kitchens share olive oil, legumes, and fresh herbs — each with a distinct identity rooted in thousands of years of trade.',
    dishes: ['Falafel & Hummus', 'Shakshuka', 'Moussaka'],
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&q=80',
  },
  {
    id: 'asian',
    flag: '🍜',
    name: 'East Asian',
    region: 'East Asia',
    color: '#7c3aed',
    story: 'From Japanese umami mastery to Korean fermentation science and Chinese dim sum culture — East Asian kitchens are among the world\'s most technically sophisticated.',
    dishes: ['Ramen', 'Bibimbap', 'Dim Sum'],
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80',
  },
  {
    id: 'ethiopian',
    flag: '🇪🇹',
    name: 'Ethiopian',
    region: 'East Africa',
    color: '#b45309',
    story: 'Injera (a sourdough flatbread) is both plate and utensil — eating is communal. Berbere and niter kibbeh are spice mixes that take weeks to perfect.',
    dishes: ['Injera with Wat', 'Tibs', 'Kitfo'],
    image: 'https://images.unsplash.com/photo-1548868868-93e69cded56f?w=600&q=80',
  },
  {
    id: 'caribbean',
    flag: '🌴',
    name: 'Caribbean',
    region: 'Caribbean Islands',
    color: '#0284c7',
    story: 'Born from the meeting of African, Indigenous, and European influences — jerk seasoning, scotch bonnet peppers, and plantains are foundational. Food is celebration here.',
    dishes: ['Jerk Chicken', 'Oxtail Stew', 'Ackee & Saltfish'],
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80',
  },
];

export default function CuisineExplorerScreen() {
  const router = useRouter();

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/explore'); } }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>world kitchens</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>8 cultures · their stories · their dishes</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={18} color={ORANGE} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 32 }}>
          {CULTURES.map((c, i) => (
            <MotiView key={c.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 50 }}>
              <PressableScale
                onPress={() => { feedback.tap(); router.push(`/search?q=${encodeURIComponent(c.name)}`); }}
                accessibilityRole="button"
                accessibilityLabel={`Explore ${c.name} cuisine`}
                style={{ borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Palette.surface }}>
                {/* Hero image */}
                <View style={{ position: 'relative', height: 140 }}>
                  <Image source={c.image} style={{ width: '100%', height: 140 }} contentFit="cover" transition={300} />
                  <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)' }} />
                  <View style={{ position: 'absolute', bottom: 12, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 26 }}>{c.flag}</Text>
                    <View>
                      <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>{c.name}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{c.region}</Text>
                    </View>
                  </View>
                </View>

                {/* Body */}
                <View style={{ padding: 14, gap: 10 }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{c.story}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {c.dishes.map((d) => (
                      <View key={d} style={{ backgroundColor: c.color + '14', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ fontFamily: Font.medium, fontSize: 12, color: c.color }}>{d}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: c.color }}>explore {c.name.toLowerCase()} meals</Text>
                    <ChevronRight size={13} color={c.color} />
                  </View>
                </View>
              </PressableScale>
            </MotiView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
