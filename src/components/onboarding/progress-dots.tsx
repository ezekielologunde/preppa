import { MotiView } from 'moti';
import { View } from 'react-native';

import { Palette } from '@/constants/theme';

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View
      accessibilityLabel={`Step ${current} of ${total}`}
      style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 20, paddingBottom: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const active = i === current - 1;
        return (
          <MotiView
            key={i}
            animate={{
              width: active ? 24 : 8,
              height: 8,
              backgroundColor: active ? Palette.brand : Palette.divider,
            }}
            transition={{ type: 'spring', damping: 16, stiffness: 200 }}
            style={{ borderRadius: 4 }}
          />
        );
      })}
    </View>
  );
}
