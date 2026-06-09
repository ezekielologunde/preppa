import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PreppaLogo } from './preppa-logo';

type Props = {
  onGetStarted: () => void;
  onSignIn?: () => void;
};

/** Orange brand welcome / onboarding splash. */
export function Onboarding({ onGetStarted, onSignIn }: Props) {
  return (
    <View className="absolute inset-0 z-[1500] bg-[#F15F22]">
      <SafeAreaView className="flex-1 items-center justify-between px-7 pb-10 pt-6">
        {/* Brand block */}
        <View className="flex-1 items-center justify-center">
          <Animated.View entering={FadeIn.duration(500)} className="items-center gap-5">
            <PreppaLogo size={108} tileColor="rgba(255,255,255,0.14)" />
            <Text className="text-5xl font-extrabold tracking-tight text-white">preppa</Text>
            <Text className="max-w-[18rem] text-center text-xl leading-7 text-white/90">
              Real food from real local Preppas near you.
            </Text>
          </Animated.View>
        </View>

        {/* Actions */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(150)}
          className="w-full items-center gap-4">
          <View className="flex-row items-center gap-3 rounded-full bg-white/15 px-4 py-2">
            <View className="flex-row">
              <View className="h-6 w-6 rounded-full border-2 border-[#F15F22] bg-white/90" />
              <View className="-ml-2 h-6 w-6 rounded-full border-2 border-[#F15F22] bg-white/70" />
              <View className="-ml-2 h-6 w-6 rounded-full border-2 border-[#F15F22] bg-white/50" />
            </View>
            <Text className="font-medium text-white">Local Preppas joining now</Text>
          </View>

          <Pressable
            onPress={onGetStarted}
            accessibilityRole="button"
            className="w-full items-center rounded-2xl bg-white py-4 active:opacity-90">
            <Text className="text-lg font-bold text-[#D94F14]">Get Started — It&apos;s Free</Text>
          </Pressable>

          <Pressable onPress={onSignIn} accessibilityRole="button" className="active:opacity-70">
            <Text className="text-white/90">
              Already a member? <Text className="font-bold text-white underline">Sign in →</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
