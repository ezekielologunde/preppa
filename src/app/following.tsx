import { useRouter } from 'expo-router';
import { ChevronLeft, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useFollowedPreppers } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

export default function FollowingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: preppers, isLoading } = useFollowedPreppers(user?.id);
  const count = preppers?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.7 }}>following</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>
              {isLoading ? 'loading…' : count > 0 ? `${count} kitchen${count !== 1 ? 's' : ''}` : 'no kitchens followed yet'}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={ORANGE} />
          </View>
        ) : count === 0 ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={28} color="#8b5cf6" />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK }}>no kitchens yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
              Follow a kitchen to see their drops here. Their meals appear in your feeds tab too.
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/explore'); }}
              accessibilityRole="button"
              accessibilityLabel="Discover kitchens"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>discover kitchens</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60, flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {preppers!.map((p, i) => (
              <MotiView key={p.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 30 }}>
                <PrepperCard prepper={p} />
              </MotiView>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
