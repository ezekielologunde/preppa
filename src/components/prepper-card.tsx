import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BadgeCheck, Star, Trophy } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { FavoriteButton } from '@/components/ui/favorite-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';
import type { TopPrepper } from '@/lib/queries/preppers';

/** Reputation-rank badge for the "Top kitchens" rail. #1 = Trophy; #2/#3 = chip. */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#11151C', borderRadius: 999, paddingLeft: 8, paddingRight: 11, height: 28 }}>
        <Trophy size={13} color="#FFD24A" fill="#FFD24A" />
        <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: '#fff', letterSpacing: 0.2 }}>Top rated</Text>
      </View>
    );
  }
  return (
    <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(17,21,28,0.82)', borderRadius: 999, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff', fontVariant: ['tabular-nums'] }}>#{rank}</Text>
    </View>
  );
}

/** "Top preppers near you" card — chef hero, rating, tags, starting price.
 *  Pass `showRank` to surface the reputation-rank badge (top-kitchens rail). */
export function PrepperCard({ prepper, showRank = false }: { prepper: TopPrepper; showRank?: boolean }) {
  const router = useRouter();
  const ranked = showRank && prepper.rank != null && prepper.rank <= 3;
  return (
    <PressableScale onPress={() => { feedback.tap(); router.push(`/prepper?id=${prepper.id}`); }} style={{ width: 210 }} accessibilityRole="button" accessibilityLabel={`${ranked ? `Ranked number ${prepper.rank}, ` : ''}${prepper.name}, ${prepper.rating.toFixed(1)} stars — view kitchen`}>
      <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: Palette.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 }}>
        <View style={{ height: 130, backgroundColor: '#FCE9DD' }}>
          {prepper.image ? <Image source={imgUrl(prepper.image, 420)} style={{ flex: 1 }} contentFit="cover" transition={250} /> : null}
          {ranked ? <RankBadge rank={prepper.rank!} /> : null}
          <View style={{ position: 'absolute', top: 10, right: 10 }}>
            <FavoriteButton id={`prepper:${prepper.id}`} />
          </View>
        </View>
        <View style={{ padding: 12, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink, flexShrink: 1 }}>{prepper.name}</Text>
            {prepper.verified ? <BadgeCheck size={15} color={Palette.brand} fill={Palette.brand} stroke="#fff" /> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Star size={13} color={Palette.amber} fill={Palette.amber} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.inkSoft }}>{prepper.rating.toFixed(1)}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>({prepper.reviews})</Text>
          </View>
          {prepper.tags.length ? (
            <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{prepper.tags.join(' · ')}</Text>
          ) : null}
          {prepper.from != null ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: Palette.brandTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brand, fontVariant: ['tabular-nums'] }}>from ${prepper.from.toFixed(0)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}
