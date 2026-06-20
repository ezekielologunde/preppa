/**
 * AboutKitchenCard — "about this kitchen" info card shown on the public kitchen profile.
 */
import { Award, MapPin, Star, UtensilsCrossed } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';

function memberSince(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

interface AboutKitchenCardProps {
  bio: string | null;
  city: string | null;
  specialties: string[];
  memberSinceIso: string | null;
  certified: boolean;
}

export function AboutKitchenCard({ bio, city, specialties, memberSinceIso, certified }: AboutKitchenCardProps) {
  const joined = memberSince(memberSinceIso);
  const hasContent = bio || city || specialties.length || joined || certified;
  if (!hasContent) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260 }}
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: Palette.surface,
        borderRadius: Radius.md,
        padding: 16,
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        about this kitchen
      </Text>

      {bio ? (
        <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.inkSoft, lineHeight: 21 }}>
          {bio}
        </Text>
      ) : null}

      <View style={{ gap: 7 }}>
        {city ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} color={Palette.brand} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.inkSoft }}>{city}</Text>
          </View>
        ) : null}

        {specialties.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <UtensilsCrossed size={14} color={Palette.brand} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.inkSoft }}>
              {specialties.slice(0, 4).join(' · ')}
            </Text>
          </View>
        ) : null}

        {joined ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Star size={14} color={Palette.amber} fill={Palette.amber} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.inkSoft }}>Joined {joined}</Text>
          </View>
        ) : null}

        {certified ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Award size={14} color={Palette.success} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.successDark }}>Food handler certified</Text>
          </View>
        ) : null}
      </View>
    </MotiView>
  );
}
