import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BadgeCheck, Clapperboard, Play, Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { useFeed, type FeedItem } from '@/lib/queries/feed';

const ORANGE = Palette.brand;
const TAB_BAR = 88; // customer bottom nav overlays the feed

function PostCard({ item, height, bottomInset }: { item: FeedItem; height: number; bottomInset: number }) {
  const router = useRouter();
  const source = item.thumbnail ?? item.image;
  return (
    <View style={{ height, width: '100%', backgroundColor: '#000' }}>
      {source ? <Image source={source} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} /> : null}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']} locations={[0, 0.5, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }} />
      {item.videoUrl ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={28} color="#fff" fill="#fff" />
          </View>
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: bottomInset + TAB_BAR + 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: 'rgba(255,255,255,0.92)' }}>{item.prepper}</Text>
          {item.verified ? <BadgeCheck size={15} color="#fff" fill={ORANGE} stroke="#fff" /> : null}
          <View style={{ marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 12, color: '#fff' }}>post</Text>
          </View>
        </View>
        {item.title ? <Text style={{ fontFamily: Font.body, fontSize: 16, color: 'rgba(255,255,255,0.9)', lineHeight: 23 }} numberOfLines={3}>{item.title}</Text> : null}
        <PressableScale onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={`View ${item.prepper}'s profile`}
          style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>View profile</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function FeedCard({ item, height, bottomInset }: { item: FeedItem; height: number; bottomInset: number }) {
  const router = useRouter();
  const source = item.thumbnail ?? item.image;
  return (
    <View style={{ height, width: '100%', backgroundColor: '#000' }}>
      {source ? <Image source={source} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} /> : null}
      {/* Scrim for text legibility (functional contrast, not decoration) */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
      />

      {item.videoUrl ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={28} color="#fff" fill="#fff" />
          </View>
        </View>
      ) : null}

      {/* Content */}
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: bottomInset + TAB_BAR + 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: 'rgba(255,255,255,0.92)' }}>{item.prepper}</Text>
          {item.verified ? <BadgeCheck size={15} color="#fff" fill={ORANGE} stroke="#fff" /> : null}
          {item.rating > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 2 }}>
              <Star size={12} color="#fbbf24" fill="#fbbf24" />
              <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>{item.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: Font.display, fontSize: 28, color: '#fff', letterSpacing: -0.6, lineHeight: 32 }} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff', fontVariant: ['tabular-nums'] }}>${item.price.toFixed(2)}</Text>
          <PressableScale
            onPress={() => router.push(`/meal?id=${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Order ${item.title}`}
            style={{ flex: 1, height: 50, borderRadius: 15, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Order now</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

export default function FeedsScreen() {
  const { data: items, isLoading } = useFeed();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pageHeight = height;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ORANGE} />
      </View>
    );
  }

  if (!items?.length) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0D', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <MotiView from={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', duration: 400, bounce: 0.2 }}>
        <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(241,95,34,0.16)', alignItems: 'center', justifyContent: 'center' }}>
          <Clapperboard size={40} color={ORANGE} />
        </View>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 28, color: '#fff', letterSpacing: -0.6 }}>feeds</Text>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 290, lineHeight: 22 }}>
          Meal drops from the preppers you follow will appear here. Check back when kitchens go live.
        </Text>
        </MotiView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ScrollView
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageHeight}
        snapToAlignment="start">
        {items.map((item) =>
          item.isPost
            ? <PostCard key={item.id} item={item} height={pageHeight} bottomInset={insets.bottom} />
            : <FeedCard key={item.id} item={item} height={pageHeight} bottomInset={insets.bottom} />
        )}
      </ScrollView>
    </View>
  );
}
