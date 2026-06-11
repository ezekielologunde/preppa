import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { FavoriteButton } from '@/components/ui/favorite-button';
import { feedback } from '@/lib/feedback';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { Cuisine } from '@/constants/mock';
import { Font } from '@/constants/fonts';

/** Cuisine tile — image with gradient scrim, name + meal count, heart. */
export function CuisineCard({ cuisine, onPress }: { cuisine: Cuisine; onPress?: () => void }) {
  return (
    <PressableScale onPress={() => { feedback.tap(); onPress?.(); }} style={{ width: 150, height: 150, borderRadius: 20, overflow: 'hidden', backgroundColor: '#eee' }} accessibilityRole="button" accessibilityLabel={`${cuisine.name} cuisine, ${cuisine.meals} meals`}>
      <Image source={cuisine.image} style={{ flex: 1 }} contentFit="cover" transition={250} />
      <View style={{ position: 'absolute', inset: 0, experimental_backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.65))' }} />
      <View style={{ position: 'absolute', top: 10, right: 10 }}>
        <FavoriteButton id={`cuisine:${cuisine.id}`} />
      </View>
      <View style={{ position: 'absolute', left: 12, bottom: 12 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 17, color: '#fff', letterSpacing: -0.3 }}>{cuisine.name}</Text>
        <Text style={{ fontFamily: Font.medium, fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>{cuisine.meals} meals</Text>
      </View>
    </PressableScale>
  );
}
