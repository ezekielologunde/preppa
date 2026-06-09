import { Image } from 'expo-image';
import { Heart } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import type { Cuisine } from '@/constants/mock';
import { Font } from '@/constants/fonts';

/** Cuisine tile — image with gradient scrim, name + meal count, heart. */
export function CuisineCard({ cuisine }: { cuisine: Cuisine }) {
  return (
    <Pressable style={{ width: 150, height: 150, borderRadius: 20, overflow: 'hidden', backgroundColor: '#eee' }}>
      <Image source={cuisine.image} style={{ flex: 1 }} contentFit="cover" transition={250} />
      <View style={{ position: 'absolute', inset: 0, experimental_backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.65))' }} />
      <View style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
        <Heart size={15} color="#6b7280" />
      </View>
      <View style={{ position: 'absolute', left: 12, bottom: 12 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 17, color: '#fff', letterSpacing: -0.3 }}>{cuisine.name}</Text>
        <Text style={{ fontFamily: Font.medium, fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>{cuisine.meals} meals</Text>
      </View>
    </Pressable>
  );
}
