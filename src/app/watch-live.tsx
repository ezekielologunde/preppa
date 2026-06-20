import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Radio, ShoppingCart } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

const BG = '#0C0E13';
const CARD = '#161820';
const RED = '#EF4444';
const MUTED = '#9CA3AF';
const ORANGE = Palette.brand;

type LiveSession = {
  id: string;
  started_at: string;
  title: string | null;
  viewer_count: number;
  prepper: { id: string; display_name: string; avatar_url: string | null } | null;
  featured_meal: { id: string; title: string; base_price: number; image_url: string | null } | null;
};

function useDuration(isoString: string | undefined | null): string {
  const [, tick] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isoString) return;
    ref.current = setInterval(() => tick((n) => n + 1), 60_000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [isoString]);

  if (!isoString) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export default function WatchLiveScreen() {
  const router = useRouter();
  const { prepperId } = useLocalSearchParams<{ prepperId: string }>();

  const { data: session, isLoading } = useQuery({
    queryKey: ['watch-live', prepperId],
    enabled: !!prepperId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<LiveSession | null> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select(`
          id, started_at, title, viewer_count,
          prepper:preppers(id, display_name, avatar_url),
          featured_meal:meals(id, title, base_price, meal_images(url))
        `)
        .eq('prepper_id', prepperId!)
        .is('ended_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const d = data as any;
      const prepper = Array.isArray(d.prepper) ? d.prepper[0] : d.prepper;
      const meal = Array.isArray(d.featured_meal) ? d.featured_meal[0] : d.featured_meal;
      return {
        id: d.id,
        started_at: d.started_at,
        title: d.title,
        viewer_count: d.viewer_count ?? 0,
        prepper: prepper ?? null,
        featured_meal: meal
          ? {
              id: meal.id,
              title: meal.title,
              base_price: meal.base_price,
              image_url: (Array.isArray(meal.meal_images) ? meal.meal_images[0]?.url : null) ?? null,
            }
          : null,
      };
    },
  });

  const duration = useDuration(session?.started_at);

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) router.back(); else router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 }}>
          <PressableScale
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 22, color: '#fff', letterSpacing: -0.5 }}>live</Text>
          {session && (
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 300 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: RED + '22',
                borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: RED + '55' }}>
              <MotiView
                from={{ opacity: 1 }}
                animate={{ opacity: 0.3 }}
                transition={{ type: 'timing', duration: 800, loop: true, repeatReverse: true }}
                style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: RED }} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: RED }}>LIVE</Text>
            </MotiView>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 16 }}>

          {isLoading ? (
            <View style={{ height: 260, borderRadius: 20, backgroundColor: CARD }} />
          ) : !session ? (
            <MotiView
              from={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 200 }}
              style={{ height: 260, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 28 }}>
              <Radio size={40} color={MUTED} />
              <Text style={{ fontFamily: Font.heading, fontSize: 17, color: '#fff' }}>Not live right now</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21 }}>
                This kitchen isn't live at the moment. Follow them to get notified when they start.
              </Text>
            </MotiView>
          ) : (
            <>
              {/* Stream viewport */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 280 }}>
                <View style={{ height: 260, borderRadius: 20, backgroundColor: CARD, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  <Radio size={48} color={ORANGE} />
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, marginTop: 12 }}>
                    Video stream coming soon
                  </Text>

                  {/* Viewer count */}
                  <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 13 }}>👀</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>{session.viewer_count}</Text>
                  </View>

                  {/* Duration */}
                  {duration ? (
                    <View style={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.65)',
                      borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 12, color: '#fff' }}>{duration}</Text>
                    </View>
                  ) : null}
                </View>
              </MotiView>

              {/* Kitchen info */}
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 280, delay: 60 }}>
                <View style={{ backgroundColor: CARD, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar
                    name={session.prepper?.display_name ?? 'K'}
                    url={session.prepper?.avatar_url ?? null}
                    size={46}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>
                      {session.prepper?.display_name ?? 'Kitchen'}
                    </Text>
                    {session.title ? (
                      <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, marginTop: 2 }} numberOfLines={2}>
                        {session.title}
                      </Text>
                    ) : null}
                  </View>
                  {session.prepper?.id && (
                    <PressableScale
                      onPress={() => { feedback.tap(); router.push(`/prepper?id=${session.prepper!.id}` as never); }}
                      accessibilityRole="button"
                      accessibilityLabel="Visit kitchen"
                      style={{ backgroundColor: ORANGE + '1A', borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: ORANGE + '44' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>Kitchen</Text>
                    </PressableScale>
                  )}
                </View>
              </MotiView>

              {/* Featured meal */}
              {session.featured_meal && (
                <MotiView
                  from={{ opacity: 0, translateY: 8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 280, delay: 120 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
                    Featured meal
                  </Text>
                  <PressableScale
                    onPress={() => { feedback.tap(); router.push(`/meal?id=${session.featured_meal!.id}` as never); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Order ${session.featured_meal.title}`}
                    style={{ backgroundColor: CARD, borderRadius: 18, overflow: 'hidden' }}>
                    {session.featured_meal.image_url && (
                      <Image
                        source={session.featured_meal.image_url}
                        style={{ width: '100%', height: 160 }}
                        contentFit="cover"
                      />
                    )}
                    <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }} numberOfLines={1}>
                          {session.featured_meal.title}
                        </Text>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: ORANGE, marginTop: 2 }}>
                          ${session.featured_meal.base_price.toFixed(2)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ORANGE + '22',
                        borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10,
                        borderWidth: 1, borderColor: ORANGE + '55' }}>
                        <ShoppingCart size={14} color={ORANGE} />
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>Order</Text>
                      </View>
                    </View>
                  </PressableScale>
                </MotiView>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
