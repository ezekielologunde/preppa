import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BadgeCheck, Crown, MapPin, Star, Trophy } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { FavoriteButton } from '@/components/ui/favorite-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';
import { getCurrentRush, getRushUrgency } from '@/lib/rush-hour';
import { formatDistance } from '@/lib/distance';
import type { TopPrepper } from '@/lib/queries/preppers';

/** Reputation-rank badge for the "Top kitchens" rail. #1 = Trophy; #2/#3 = chip. */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Palette.ink, borderRadius: Radius.pill, paddingLeft: 8, paddingRight: 11, height: 28 }}>
        <Trophy size={13} color="#FFD24A" fill="#FFD24A" />
        <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: '#fff', letterSpacing: 0.2 }}>Top rated</Text>
      </View>
    );
  }
  return (
    <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(17,21,28,0.82)', borderRadius: Radius.pill, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff', fontVariant: ['tabular-nums'] }}>#{rank}</Text>
    </View>
  );
}

/** Shown on the card image during an active rush window (morning / lunch / dinner). */
function LiveBadge() {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  if (getRushUrgency(hour, minute) !== 'live') return null;
  const win = getCurrentRush(hour);
  if (!win) return null;
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 200 }}
      style={{ position: 'absolute', bottom: 8, left: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: win.color + 'E6', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4 }}>
        <MotiView
          from={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 750, loop: true, repeatReverse: true }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' }} />
        </MotiView>
        <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: '#fff', letterSpacing: 0.2 }}>
          {win.label.toLowerCase()}
        </Text>
      </View>
    </MotiView>
  );
}

/** Red pulsing "● LIVE" badge shown when the prepper has an active broadcast.
 *  Positioned top-left; pass offsetDown=true to stack below a RankBadge. */
function StreamingLiveBadge({ offsetDown }: { offsetDown?: boolean }) {
  return (
    <MotiView
      from={{ scale: 1 }}
      animate={{ scale: 1.08 }}
      transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
      style={{ position: 'absolute', top: offsetDown ? 44 : 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#EF4444', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' }} />
      <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff', letterSpacing: 0.3 }}>LIVE</Text>
    </MotiView>
  );
}

/** "Top preppers near you" card — chef hero, rating, tags, starting price.
 *  Pass `showRank` to surface the reputation-rank badge (top-kitchens rail).
 *  Pass `isLive` to show a pulsing LIVE badge when the prepper is broadcasting.
 *  Pass `distanceKm` (or rely on prepper.distanceKm) to show "X km away". */
export function PrepperCard({ prepper, showRank = false, isLive = false }: { prepper: TopPrepper; showRank?: boolean; isLive?: boolean }) {
  const distanceKm = prepper.distanceKm;
  const router = useRouter();
  const ranked = showRank && prepper.rank != null && prepper.rank <= 3;
  return (
    <PressableScale onPress={() => { feedback.tap(); router.push(`/prepper?id=${prepper.id}`); }} accessibilityRole="button" style={{ width: 210 }} accessibilityLabel={`${isLive ? 'Live now — ' : ''}${ranked ? `Ranked number ${prepper.rank}, ` : ''}${prepper.name}, ${prepper.rating.toFixed(1)} stars — view kitchen`}>
      <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: Palette.surface, ...Shadow.card }}>
        <View style={{ height: 130, backgroundColor: Palette.brandTint }}>
          {prepper.image ? <Image source={imgUrl(prepper.image, 420)} style={{ flex: 1 }} contentFit="cover" transition={250} /> : null}
          {ranked ? <RankBadge rank={prepper.rank!} /> : null}
          <LiveBadge />
          {isLive ? <StreamingLiveBadge offsetDown={ranked} /> : null}
          <View style={{ position: 'absolute', top: 10, right: 10 }} accessibilityLabel="Save to favorites" accessibilityRole="none">
            <FavoriteButton id={`prepper:${prepper.id}`} />
          </View>
        </View>
        <View style={{ padding: 12, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink, flexShrink: 1 }}>{prepper.name}</Text>
            {prepper.verified ? <View accessibilityLabel="Verified kitchen" accessibilityRole="image"><BadgeCheck size={15} color={Palette.brand} fill={Palette.brand} stroke="#fff" /></View> : null}
            {prepper.isPro ? (
              <View accessibilityLabel="Pro kitchen" accessibilityRole="image" style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F59E0B18', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Crown size={11} color="#F59E0B" fill="#F59E0B" />
                <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#F59E0B' }}>pro</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Star size={13} color={Palette.amber} fill={Palette.amber} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.inkSoft }}>{prepper.rating.toFixed(1)}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>({prepper.reviews})</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 7, color: prepper.isOpenNow ? '#10B981' : Palette.textMuted, lineHeight: 12 }}>{prepper.isOpenNow ? '●' : '○'}</Text>
            <Text style={{ fontFamily: Font.medium, fontSize: 10, color: prepper.isOpenNow ? '#10B981' : Palette.textMuted }}>
              {prepper.isOpenNow ? 'Open' : 'Closed'}
            </Text>
          </View>
          {prepper.tags.length ? (
            <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{prepper.tags.join(' · ')}</Text>
          ) : null}
          {distanceKm != null && distanceKm < Infinity ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <MapPin size={10} color={Palette.textMuted} />
              <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted }}>{formatDistance(distanceKm)}</Text>
            </View>
          ) : null}
          {prepper.from != null ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brand, fontVariant: ['tabular-nums'] }}>from ${prepper.from.toFixed(0)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}
