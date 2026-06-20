import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CalendarCheck, ChevronRight, Clock } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FilterKey = 'all' | 'dinner' | 'lunch' | 'class' | 'popup';

export type FeaturedExperience = {
  id: string;
  title: string;
  hostName: string;
  hostAvatar: string;
  image: string;
  price: number;
  dateLabel: string;
  timeLabel: string;
  spotsLeft: number;
  category: FilterKey;
};

// ─── ExperienceCardSkeleton ────────────────────────────────────────────────────

export function ExperienceCardSkeleton() {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 20, borderRadius: 20, overflow: 'hidden', backgroundColor: Palette.surface }}>
      <Skeleton width="100%" height={200} radius={0} />
      <View style={{ padding: 16, gap: 10 }}>
        <Skeleton width="70%" height={16} radius={8} />
        <Skeleton width="45%" height={13} radius={6} />
        <View style={{ marginTop: 4 }}>
          <Skeleton width="100%" height={48} radius={12} />
        </View>
      </View>
    </View>
  );
}

// ─── FeaturedExperienceCard ────────────────────────────────────────────────────

export interface FeaturedExperienceCardProps {
  exp: FeaturedExperience;
  index: number;
}

export function FeaturedExperienceCard({ exp, index }: FeaturedExperienceCardProps) {
  const router = useRouter();
  const isLowSpots = exp.spotsLeft <= 3;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 240, delay: index * 80 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push(`/experience-request?kind=private_chef`); }}
        accessibilityRole="button"
        accessibilityLabel={exp.title}
        style={{
          marginHorizontal: 16,
          marginBottom: 20,
          borderRadius: 20,
          backgroundColor: Palette.surface,
          overflow: 'hidden',
          ...Shadow.card,
        }}>

        {/* Hero image with overlays */}
        <View style={{ height: 200, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
          <Image
            source={exp.image}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={250}
          />

          {/* Dark gradient from bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }}
          />

          {/* Price badge — top right */}
          <View style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: Palette.brand,
            borderRadius: Radius.pill,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}>
            <Text style={{ fontFamily: Font.display, fontSize: 16, color: '#fff' }}>
              ${exp.price}
            </Text>
          </View>

          {/* Host info — bottom left */}
          <View style={{ position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image
              source={exp.hostAvatar}
              style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' }}
              contentFit="cover"
            />
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>{exp.hostName}</Text>
          </View>
        </View>

        {/* Card body */}
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink, letterSpacing: -0.4 }} numberOfLines={1}>
            {exp.title}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <CalendarCheck size={13} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
                {exp.dateLabel}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={13} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
                {exp.timeLabel}
              </Text>
            </View>
            {/* Spots left chip */}
            <View style={{
              backgroundColor: isLowSpots ? Palette.amberTint : Palette.chip,
              borderRadius: Radius.pill,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: isLowSpots ? '#D97706' : Palette.textSecondary }}>
                {exp.spotsLeft} spot{exp.spotsLeft === 1 ? '' : 's'} left
              </Text>
            </View>
          </View>

          {/* CTA */}
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/experience-request?kind=private_chef'); }}
            accessibilityRole="button"
            accessibilityLabel={`Reserve a spot for ${exp.title}`}
            style={{
              marginTop: 4,
              height: 48,
              backgroundColor: Palette.brand,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Reserve spot</Text>
            <ChevronRight size={16} color="#fff" strokeWidth={2.5} />
          </PressableScale>
        </View>
      </PressableScale>
    </MotiView>
  );
}
