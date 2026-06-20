/**
 * KitchenHero — full-bleed cover photo (240px) with overlapping avatar + follow button.
 * Extracted from prepper.tsx to keep that file under 500 lines.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Share2, ChevronLeft, UserPlus } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

const COVER_H = 240;
const AVATAR_SIZE = 80;
const AVATAR_OVERLAP = 40; // how much avatar bleeds below cover

interface KitchenHeroProps {
  name: string | undefined;
  avatarUrl: string | null | undefined;
  /** Currently following? */
  following: boolean | undefined;
  /** Mutation is in-flight */
  followPending: boolean;
  isLoading: boolean;
  /** Kitchen currently has an active live session */
  isLive?: boolean;
  onBack: () => void;
  onShare: () => void;
  onToggleFollow: () => void;
}

export function KitchenHero({
  name,
  avatarUrl,
  following,
  followPending,
  isLoading,
  isLive = false,
  onBack,
  onShare,
  onToggleFollow,
}: KitchenHeroProps) {
  return (
    <View style={{ marginBottom: AVATAR_OVERLAP + 8 }}>
      {/* ── Cover photo ── */}
      {isLoading ? (
        <Skeleton width="100%" height={COVER_H} radius={0} />
      ) : (
        <LinearGradient
          colors={['#FF8C42', Palette.brand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: COVER_H }}>
          {/* A real cover photo sits on top of the gradient if the prepper ever uploads one */}
        </LinearGradient>
      )}

      {/* ── Nav row (back + share) floats over cover ── */}
      <SafeAreaView
        edges={['top']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <View style={{
          paddingHorizontal: 16, paddingTop: 8,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <PressableScale
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.30)',
              alignItems: 'center', justifyContent: 'center',
            }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>

          {!isLoading ? (
            <PressableScale
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel={`Share ${name ?? ''}'s kitchen`}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(0,0,0,0.30)',
                alignItems: 'center', justifyContent: 'center',
              }}>
              <Share2 size={17} color="#fff" />
            </PressableScale>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </SafeAreaView>

      {/* ── Avatar row (overlaps cover bottom) ── */}
      <View style={{
        position: 'absolute',
        bottom: -(AVATAR_OVERLAP),
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}>
        {/* Avatar with brand ring + optional LIVE badge */}
        {isLoading ? (
          <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} radius={AVATAR_SIZE / 2} />
        ) : (
          <View style={{ position: 'relative' }}>
            <View style={{
              width: AVATAR_SIZE + 6,
              height: AVATAR_SIZE + 6,
              borderRadius: (AVATAR_SIZE + 6) / 2,
              borderWidth: 3,
              borderColor: isLive ? Palette.danger : Palette.brand,
              backgroundColor: Palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.14,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
            }}>
              <Avatar name={name ?? 'preppa'} url={avatarUrl ?? undefined} size={AVATAR_SIZE} />
            </View>
            {isLive ? (
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200 }}
                style={{
                  position: 'absolute',
                  bottom: -4,
                  alignSelf: 'center',
                  backgroundColor: Palette.danger,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderWidth: 1.5,
                  borderColor: Palette.surface,
                }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff', letterSpacing: 0.5 }}>LIVE</Text>
              </MotiView>
            ) : null}
          </View>
        )}

        {/* Follow button */}
        {!isLoading && (
          <MotiView
            animate={{
              backgroundColor: following ? Palette.surface : Palette.brand,
              borderColor: following ? Palette.brand : Palette.brand,
            }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ borderWidth: 1.5, borderRadius: 18, overflow: 'hidden', marginBottom: 4 }}>
            <PressableScale
              onPress={onToggleFollow}
              disabled={followPending}
              accessibilityRole="button"
              accessibilityLabel={following ? `Following. Tap to unfollow` : `Follow ${name ?? ''}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                height: 36, paddingHorizontal: 18,
              }}>
              {following
                ? <Check size={14} color={Palette.brand} />
                : <UserPlus size={14} color="#fff" />
              }
              <Text style={{
                fontFamily: Font.semibold, fontSize: 13.5,
                color: following ? Palette.brand : '#fff',
              }}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </PressableScale>
          </MotiView>
        )}
      </View>
    </View>
  );
}
