import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChefHat, ChevronRight, type LucideIcon, Megaphone, Sparkles } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

export type PromoKind = 'meal_plans' | 'post_request' | 'become_prepper';

const promoImg = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;

type Promo = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  /** Literal union (not bare string) so expo-router's typed push accepts it. */
  route: '/meal-plans' | '/experience-request' | '/become-prepper';
  Icon: LucideIcon;
  /** Brand-accent backdrop, shown if the image fails or while it loads. */
  gradient: [string, string];
  image?: string;
};

/** App-level promos woven into the feed stream (native "ads" / CTAs). */
export const PROMOS: Record<PromoKind, Promo> = {
  meal_plans: {
    eyebrow: 'Preppa Plans',
    title: 'Eat well,\non autopilot',
    subtitle: 'Weekly meals from local kitchens — delivered on repeat, zero planning.',
    cta: 'Explore meal plans',
    route: '/meal-plans',
    Icon: Sparkles,
    gradient: ['#F1872E', '#D9430F'],
    image: promoImg('photo-1490645935967-10de6ba17061'),
  },
  post_request: {
    eyebrow: "Can't find it?",
    title: 'Ask a chef\nto make it',
    subtitle: 'Post a request, set your budget, and get bids from Preppas near you.',
    cta: 'Post a request',
    route: '/experience-request',
    Icon: Megaphone,
    gradient: ['#7C3AED', '#4C1D95'],
    image: promoImg('photo-1556910103-1c02745aae4d'),
  },
  become_prepper: {
    eyebrow: 'Earn with Preppa',
    title: 'Cook for your\nneighborhood',
    subtitle: 'Turn your kitchen into income — sell meals to people right near you.',
    cta: 'Become a Prepper',
    route: '/become-prepper',
    Icon: ChefHat,
    gradient: ['#0F766E', '#064E3B'],
    image: promoImg('photo-1577219491135-ce391730fb2c'),
  },
};

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Full-bleed promo card that snaps in the vertical feed like a meal card. */
export function FeedPromoCard({
  kind,
  height,
  bottomInset,
}: {
  kind: PromoKind;
  height: number;
  bottomInset: number;
}) {
  const router = useRouter();
  const p = PROMOS[kind];

  return (
    <View style={{ height, width: '100%', backgroundColor: '#000' }}>
      {/* Brand backdrop — always present, so the card looks intentional even if the image 404s */}
      <LinearGradient colors={p.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={FILL} />
      {p.image ? <Image source={p.image} style={FILL} contentFit="cover" transition={220} /> : null}
      <LinearGradient
        colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.86)']}
        locations={[0, 0.46, 1]}
        style={FILL}
      />

      {/* Sponsored chip */}
      <View style={{ position: 'absolute', top: 70, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
        <Sparkles size={11} color="#fff" />
        <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff', letterSpacing: 0.3 }}>Preppa</Text>
      </View>

      {/* Content */}
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: bottomInset + 40, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <p.Icon size={22} color="#fff" />
          </View>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,0.86)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {p.eyebrow}
          </Text>
        </View>

        <Text style={{ fontFamily: Font.display, fontSize: 34, color: '#fff', letterSpacing: -0.8, lineHeight: 38 }}>
          {p.title}
        </Text>

        <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.78)', lineHeight: 21, maxWidth: 320 }}>
          {p.subtitle}
        </Text>

        <PressableScale
          onPress={() => { feedback.tap(); router.push(p.route); }}
          accessibilityRole="button"
          accessibilityLabel={p.cta}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, height: 54, paddingHorizontal: 24, borderRadius: Radius.pill, backgroundColor: Palette.brand }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{p.cta}</Text>
          <ChevronRight size={18} color="#fff" />
        </PressableScale>
      </View>
    </View>
  );
}
